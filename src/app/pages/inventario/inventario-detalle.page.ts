import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  Inventario,
  InventarioEstado,
  InventarioProducto,
} from 'src/app/domains/inventario/inventario.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { TipoEntidad } from 'src/app/domains/enums/tipo-entidad.enum';
import { codificarQr } from 'src/app/generic/utils/qrUtils';
import { DatosQr, QrDialogComponent } from 'src/app/shared/qr/qr-dialog.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { productosConcluidos, resumirInventario, resumirItems } from './inventario-conteo';
import { InventarioService } from './inventario.service';

/**
 * Cómo va la toma y qué diferencias arroja.
 *
 * ⚠️ **La diferencia es el resultado del inventario**, no un error a
 * corregir: es lo contado menos lo que dice el sistema. Por eso se muestra
 * por producto y en total.
 *
 * ⚠️ **Lo arrastrado de tomas anteriores se cuenta aparte.** Un ítem con
 * `copiedFromItemId` no se contó ahora; sumarlo a la cobertura haría creer
 * que se recorrió mercadería que nadie tocó.
 */
@Component({
  selector: 'frc-inventario-detalle',
  standalone: true,
  imports: [
    IconoComponent,
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Inventario" [conVolver]="true">
      <button accionBarra type="button" class="icono-compartir" aria-label="Compartir por QR" (click)="compartir()">
        <frc-icono nombre="codigo" [tamano]="22" />
      </button>
      @if (puedeFinalizar()) {
        <div acciones>
          <button matButton="filled" [disabled]="operando()" (click)="finalizar()">
            {{ operando() ? 'Finalizando…' : 'Finalizar inventario' }}
          </button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (inventario(); as inv) {
        <frc-seccion titulo="Inventario" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip enumerado="InventarioEstado" [valor]="inv.estado ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Sucursal" [valor]="inv.sucursal?.nombre ?? '—'" />
          <frc-dato etiqueta="Tipo" [valor]="inv.tipo ?? '—'" />
          <frc-dato etiqueta="Inicio" [valor]="fecha(inv.fechaInicio)" />
          @if (inv.fechaFin) {
            <frc-dato etiqueta="Fin" [valor]="fecha(inv.fechaFin)" />
          }
          @if (inv.observacion) {
            <frc-dato etiqueta="Observación" [valor]="inv.observacion" />
          }
        </frc-seccion>

        <frc-seccion titulo="Conteo" [panel]="true">
          <frc-dato etiqueta="Productos" [valor]="productos().length" />
          <frc-dato etiqueta="Concluidos" [valor]="concluidos()" />
          <frc-dato etiqueta="Ítems contados" [valor]="resumen().contados" />
          <frc-dato etiqueta="Revisados" [valor]="resumen().revisados" />
          @if (resumen().arrastrados > 0) {
            <!--
              Se muestran aparte porque no se contaron en esta toma: sumarlos
              a los contados diría que se recorrió algo que nadie tocó.
            -->
            <frc-dato etiqueta="Arrastrados" [valor]="resumen().arrastrados" />
          }
          <frc-dato etiqueta="Con diferencia" [valor]="resumen().conDiferencia" />
          <frc-dato etiqueta="Diferencia total" [valor]="diferenciaTotal()" />
        </frc-seccion>

        @if (productos().length === 0) {
          <frc-estado-vacio
            titulo="Sin productos"
            detalle="Todavía no se cargó ningún producto en esta toma."
            icono="inventario"
          />
        } @else {
          <frc-seccion [titulo]="'Productos (' + productos().length + ')'">
            @for (p of productos(); track p.id) {
              <frc-card
                [titulo]="p.producto?.descripcion ?? 'Producto'"
                [subtitulo]="zonaDe(p)"
                icono="producto"
              >
                <span aparte class="dif" [class.negativa]="diferenciaDe(p) < 0">
                  {{ diferenciaLegible(p) }}
                </span>
                <span pie class="conteo">{{ conteoDe(p) }}</span>
                @if (p.concluido) {
                  <span pie class="concluido">Concluido</span>
                }
                @if (abierto()) {
                  <button pie matButton (click)="contar(p)">Contar</button>
                }
              </frc-card>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .dif {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .dif.negativa { color: var(--danger); }
    .conteo, .concluido {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .concluido { color: var(--ok); }
  `,
})
export class InventarioDetallePage {
  private readonly router = inject(Router);
  private readonly servicio = inject(InventarioService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly inventario = signal<Inventario | null>(null);
  readonly cargando = signal(true);
  readonly operando = signal(false);
  readonly error = signal<string | null>(null);

  readonly productos = computed(() => this.inventario()?.inventarioProductoList ?? []);
  readonly resumen = computed(() => resumirInventario(this.productos()));
  readonly concluidos = computed(() => productosConcluidos(this.productos()));
  // `estado` y no `abierto`: son redundantes y nada garantiza que coincidan.
  readonly puedeFinalizar = computed(
    () => this.inventario()?.estado === InventarioEstado.ABIERTO,
  );
  readonly diferenciaTotal = computed(() => this.conSigno(this.resumen().diferencia));

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id)) {
      this.error.set('Identificador de inventario inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (inv) => {
        this.inventario.set(inv ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  zonaDe(p: InventarioProducto): string {
    // Zona y sector se llaman `descripcion`, no `nombre`.
    const zona = p.zona?.descripcion;
    const sector = p.zona?.sector?.descripcion;
    return [sector, zona].filter(Boolean).join(' · ') || 'Sin zona';
  }

  diferenciaDe(p: InventarioProducto): number {
    return resumirItems(p.inventarioProductoItemList ?? []).diferencia;
  }

  diferenciaLegible(p: InventarioProducto): string {
    return this.conSigno(this.diferenciaDe(p));
  }

  conteoDe(p: InventarioProducto): string {
    const r = resumirItems(p.inventarioProductoItemList ?? []);
    const partes = [`${r.contados} contados`];
    if (r.arrastrados > 0) {
      partes.push(`${r.arrastrados} arrastrados`);
    }
    return partes.join(' · ');
  }

  /** El signo importa: `+` es sobrante y `−` faltante. */
  private conSigno(valor: number): string {
    if (valor === 0) {
      return '0';
    }
    const texto = formatearCantidad(Math.abs(valor), Number.isInteger(valor) ? 0 : 2);
    return valor > 0 ? `+${texto}` : `−${texto}`;
  }

  async finalizar(): Promise<void> {
    const inv = this.inventario();
    if (inv?.id == null) {
      return;
    }
    const r = this.resumen();
    const ok = await this.dialogo.confirmar({
      titulo: 'Finalizar inventario',
      // Finalizar no es cerrar: aplica las diferencias contra el stock. Lo
      // que quedó sin contar entra como diferencia.
      mensaje: `Se aplican las diferencias al stock. Hay ${r.conDiferencia} ítems con diferencia y ${this.diferenciaTotal()} de diferencia total.`,
      confirmar: 'Finalizar',
    });
    if (!ok) {
      return;
    }

    this.operando.set(true);
    this.servicio.finalizar(inv.id).subscribe({
      next: () => {
        this.operando.set(false);
        this.notificacion.ok('Inventario finalizado.');
        this.cargar();
      },
      error: (err: Error) => {
        this.operando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * Solo un inventario abierto se puede contar.
   *
   * Concluido o cancelado, el conteo ya es un hecho histórico: escribir
   * encima cambiaría el resultado de una toma cerrada.
   */
  readonly abierto = computed(
    () => String(this.inventario()?.estado ?? '').toUpperCase() === 'ABIERTO',
  );

  contar(p: { id?: number }): void {
    const invId = this.inventario()?.id;
    if (invId == null || p.id == null) {
      return;
    }
    void this.router.navigate(['/inventario', invId, 'producto', p.id]);
  }

  /**
   * Muestra un QR para que otro lo abra escaneándolo.
   *
   * ⚠️ **El id no va en el mismo campo para todos los tipos.** Acá se
   * escriben los que `rutearEscaneo` lee para `INVENTARIO`; la tabla
   * completa está en `docs/arquitectura/qr-del-sistema.md`. Poner el id en
   * el campo equivocado da un QR que se escanea sin error y abre otra cosa.
   */
  async compartir(): Promise<void> {
    const id = this.inventario()?.id;
    if (id == null) {
      return;
    }
    const sucursalId = (this.inventario() as { sucursal?: { id?: number } })?.sucursal?.id;
    await this.dialogo.abrir<QrDialogComponent, DatosQr>(QrDialogComponent, {
      titulo: 'Compartir inventario',
      subtitulo: 'Inventario #' + id,
      codigo: codificarQr({ tipoEntidad: TipoEntidad.INVENTARIO, idCentral: String(id), sucursalId: String(sucursalId ?? '') }),
    });
  }
}
