import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PdfService } from 'src/app/core/ui/pdf.service';
import { EstadoDevolucion } from 'src/app/domains/devolucion/devolucion.enums';
import { Devolucion, DevolucionItem } from 'src/app/domains/devolucion/devolucion.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { DevolucionService } from './devolucion.service';

/**
 * Detalle de una devolución, y el punto donde avanza de estado.
 *
 * ⚠️ **Solo se ofrece «Separar».** El resto de las transiciones —colectar,
 * retirar, canjear, acreditar— las hacen otros actores desde otras pantallas
 * que todavía no están portadas. Ofrecer un botón por cada estado dejaría
 * avanzar el circuito desde el lugar equivocado.
 *
 * ⚠️ **Qué transición es legal lo decide el backend.** Acá solo se muestra el
 * botón cuando la devolución está en `PENDIENTE`; si el central rechaza, se
 * muestra su mensaje. La máquina de estados no se replica.
 */
@Component({
  selector: 'frc-devolucion-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Devolución" [conVolver]="true">
      @if (puedeSeparar()) {
        <div acciones>
          <button matButton="filled" [disabled]="operando()" (click)="separar()">
            {{ operando() ? 'Separando…' : 'Separar e imprimir etiqueta' }}
          </button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (devolucion(); as d) {
        <frc-seccion titulo="Datos" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip enumerado="EstadoDevolucion" [valor]="d.estado ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Identificador" [valor]="d.identificador ?? '—'" />
          <frc-dato etiqueta="Fecha" [valor]="fecha()" />
          <frc-dato etiqueta="Origen" [valor]="d.sucursalOrigen?.nombre ?? '—'" />
          <!--
            Ubicación solo si difiere del origen: mientras no se colecte son
            la misma, y repetir el dato no informa nada.
          -->
          @if (ubicacionDistinta()) {
            <frc-dato etiqueta="Ubicación" [valor]="d.sucursalUbicacion?.nombre ?? '—'" />
          }
          @if (d.proveedor?.persona?.nombre) {
            <frc-dato etiqueta="Proveedor" [valor]="d.proveedor!.persona!.nombre!" />
          }
          @if (d.observacion) {
            <frc-dato etiqueta="Observación" [valor]="d.observacion" />
          }
        </frc-seccion>

        <frc-seccion [titulo]="'Productos (' + (d.items?.length ?? 0) + ')'">
          @for (item of d.items ?? []; track item.id) {
            <frc-card
              [titulo]="item.producto?.descripcion ?? 'Producto'"
              [subtitulo]="detalleDe(item)"
              icono="producto"
            >
              <span aparte class="cantidad">{{ cantidadDe(item) }}</span>
              @if (item.motivoAveria?.descripcion) {
                <span pie class="motivo">{{ item.motivoAveria!.descripcion }}</span>
              }
            </frc-card>
          }
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: `
    .cantidad {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .motivo {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
  `,
})
export class DevolucionDetallePage {
  private readonly servicio = inject(DevolucionService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly pdf = inject(PdfService);

  /**
   * Llega por la ruta `detalle/:id`.
   *
   * ⚠️ **No es `input.required`.** Con `withComponentInputBinding`, el router
   * crea el componente y **recién después** asigna los inputs de ruta: un
   * `required` leído en el constructor tira `NG0950` y la pantalla queda en
   * blanco. Mismo motivo por el que `caja-detalle` usa un input opcional.
   */
  readonly id = input<string>();

  readonly devolucion = signal<Devolucion | null>(null);
  readonly cargando = signal(true);
  readonly operando = signal(false);
  readonly error = signal<string | null>(null);

  readonly fecha = computed(() => fechaLegible(this.devolucion()?.fecha) ?? '—');
  readonly puedeSeparar = computed(
    () => this.devolucion()?.estado === EstadoDevolucion.PENDIENTE,
  );
  readonly ubicacionDistinta = computed(() => {
    const d = this.devolucion();
    const origen = d?.sucursalOrigen?.id;
    const ubicacion = d?.sucursalUbicacion?.id;
    return ubicacion != null && String(ubicacion) !== String(origen);
  });

  constructor() {
    // Por lo mismo, la carga va en un efecto y no en el constructor: se
    // dispara cuando el input ya tiene valor.
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id)) {
      this.error.set('Identificador de devolución inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (d) => {
        this.devolucion.set(d ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  detalleDe(item: DevolucionItem): string {
    const partes = [
      item.presentacion?.cantidad != null ? `Cantidad: ${item.presentacion.cantidad}` : '',
      item.lote ? `Lote ${item.lote}` : '',
      fechaLegible(item.vencimiento) ? `Vence ${fechaLegible(item.vencimiento)}` : '',
    ];
    return partes.filter(Boolean).join(' · ');
  }

  cantidadDe(item: DevolucionItem): string {
    const cantidad = item.cantidad ?? 0;
    return formatearCantidad(cantidad, Number.isInteger(cantidad) ? 0 : 3);
  }

  /**
   * Pasa a `SEPARADO` y ofrece la etiqueta.
   *
   * ⚠️ **La etiqueta se pide después de que el backend confirme.** Es lo que
   * identifica físicamente el producto apartado: imprimirla antes dejaría
   * pegada una etiqueta de un estado que no llegó a existir.
   */
  async separar(): Promise<void> {
    const d = this.devolucion();
    const usuarioId = this.auth.usuario()?.id;
    if (d?.id == null || usuarioId == null) {
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Separar devolución',
      mensaje: 'El producto queda apartado y se imprime su etiqueta.',
      confirmar: 'Separar',
    });
    if (!ok) {
      return;
    }

    this.operando.set(true);
    this.servicio.avanzarEstado(d.id, EstadoDevolucion.SEPARADO, usuarioId).subscribe({
      next: () => {
        this.operando.set(false);
        this.notificacion.ok('Devolución separada.');
        this.cargar();
        this.imprimirEtiqueta(d.id!);
      },
      error: (err: Error) => {
        this.operando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  private imprimirEtiqueta(devolucionId: number): void {
    this.servicio.etiquetas(devolucionId).subscribe({
      next: (base64) => {
        if (base64) {
          this.pdf.abrirBase64(base64, `etiquetas-devolucion-${devolucionId}.pdf`);
        }
      },
      // La devolución ya avanzó: que falle la etiqueta no invalida el paso.
      error: () => this.notificacion.warn('No se pudieron obtener las etiquetas.'),
    });
  }
}
