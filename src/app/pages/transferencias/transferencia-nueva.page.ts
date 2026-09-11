import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { destinosPosibles, nuevaTransferenciaInput } from './transferencia-alta';
import { TransferenciaService } from './transferencia.service';

/**
 * Elegir de dónde sale y a dónde va.
 *
 * Es el primero de los dos pasos del alta: acá se crea el **borrador** —una
 * transferencia `ABIERTA` en etapa de creación— y la carga de productos ocurre
 * en la pantalla siguiente, que ya tiene un id contra el cual guardar.
 *
 * ⚠️ **El borrador se crea en el central, no en memoria.** El input de la
 * cabecera no acepta ítems anidados: sin transferencia guardada no hay dónde
 * poner el primer producto. Acumularlos en el teléfono hasta el final sería
 * perder una carga de cuarenta renglones porque el service worker se
 * actualizó en el medio.
 *
 * ⚠️ **Solo sucursales operables.** Sin depósito no hay stock que mover:
 * `SERVIDOR` y `COMPRAS` no participan de transferencias.
 */
@Component({
  selector: 'frc-transferencia-nueva',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SelectorComponent,
    DatoComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
    TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nueva transferencia" [conVolver]="true" [conEscaner]="false">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargarSucursales()" />
      } @else {
        <frc-selector
          etiqueta="Sucursal de origen"
          [opciones]="opcionesOrigen()"
          [valor]="origenId()"
          (valorChange)="cambiarOrigen($event)"
        />
        <frc-selector
          etiqueta="Sucursal de destino"
          [opciones]="opcionesDestino()"
          [valor]="destinoId()"
          (valorChange)="cambiarDestino($event)"
        />

        <frc-seccion titulo="Se va a crear" [panel]="true">
          <frc-dato etiqueta="Sale de" [valor]="nombreOrigen() | titlecase" />
          <frc-dato etiqueta="Llega a" [valor]="nombreDestino() | titlecase" />
          <frc-dato etiqueta="Responsable" [valor]="responsable() | titlecase" />
          <frc-dato etiqueta="Tipo" valor="Manual" />
        </frc-seccion>

        <frc-seccion titulo="Después de crear" [panel]="true">
          <p class="aviso">
            Queda como borrador: se le cargan los productos y recién al
            finalizarla sale de la sucursal de origen. Nada se descuenta del
            stock hasta que se despacha.
          </p>
        </frc-seccion>
      }

      @if (!cargando() && !error()) {
        <div acciones>
          <button matButton="filled" [disabled]="!puedeCrear() || creando()" (click)="crear()">
            {{ creando() ? 'Creando…' : 'Crear y cargar productos' }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .aviso { margin: 0; font-size: var(--fs-label); color: var(--text-soft); }
  `,
})
export class TransferenciaNuevaPage {
  private readonly servicio = inject(TransferenciaService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  readonly origenId = signal<unknown>(null);
  readonly destinoId = signal<unknown>(null);
  readonly cargando = signal(true);
  readonly creando = signal(false);
  readonly error = signal<string | null>(null);

  private readonly lista = signal<Sucursal[]>([]);

  readonly opcionesOrigen = computed<OpcionSeleccion[]>(() => this.opciones(this.lista()));

  readonly opcionesDestino = computed<OpcionSeleccion[]>(() =>
    this.opciones(destinosPosibles(this.lista(), this.origenId() as number | null)),
  );

  readonly nombreOrigen = computed(() => this.nombreDe(this.origenId()));
  readonly nombreDestino = computed(() => this.nombreDe(this.destinoId()));

  readonly responsable = computed(
    () => this.auth.usuario()?.persona?.nombre ?? this.auth.usuario()?.nickname ?? '—',
  );

  readonly puedeCrear = computed(() => this.origenId() != null && this.destinoId() != null);

  constructor() {
    this.cargarSucursales();
  }

  cargarSucursales(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.sucursales.todas().subscribe({
      next: (todas) => {
        const operables = soloOperables(todas ?? []);
        this.lista.set(operables);
        this.cargando.set(false);

        // La de la sesión como origen por defecto: es de donde sale la
        // mercadería en el caso normal. El destino se elige siempre.
        const propia = this.auth.sucursal()?.id;
        const elegida = operables.some((s) => String(s.id) === String(propia))
          ? propia
          : operables[0]?.id;
        if (elegida != null) {
          this.origenId.set(elegida);
        }
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * ⚠️ **Cambiar el origen puede invalidar el destino.** Si el que estaba
   * elegido pasa a ser el origen, se limpia: dejarlo ahí armaría una
   * transferencia de una sucursal a sí misma.
   */
  cambiarOrigen(valor: unknown): void {
    this.origenId.set(valor);
    if (String(this.destinoId()) === String(valor)) {
      this.destinoId.set(null);
    }
  }

  cambiarDestino(valor: unknown): void {
    this.destinoId.set(valor);
  }

  async crear(): Promise<void> {
    // ⚠️ El id se compara contra `null` **antes** de convertirlo: `Number(null)`
    // es 0, que es finito, y con eso un destino sin elegir pasaba el chequeo y
    // creaba una transferencia hacia la sucursal 0.
    const sucursalOrigenId = this.origenId() == null ? NaN : Number(this.origenId());
    const sucursalDestinoId = this.destinoId() == null ? NaN : Number(this.destinoId());
    const usuarioId = this.auth.usuario()?.id;

    if (!Number.isFinite(sucursalOrigenId) || !Number.isFinite(sucursalDestinoId)) {
      this.notificacion.warn('Elegí la sucursal de origen y la de destino.');
      return;
    }
    if (sucursalOrigenId === sucursalDestinoId) {
      this.notificacion.warn('El destino no puede ser la misma sucursal que el origen.');
      return;
    }
    if (usuarioId == null) {
      this.notificacion.danger('La sesión no tiene usuario.');
      return;
    }

    this.creando.set(true);
    this.servicio
      .crear(nuevaTransferenciaInput({ sucursalOrigenId, sucursalDestinoId, usuarioId }))
      .subscribe({
        next: (transferencia) => {
          this.creando.set(false);
          if (transferencia?.id == null) {
            this.notificacion.danger('El central no devolvió la transferencia creada.');
            return;
          }
          // `replaceUrl`: volver atrás desde la carga de productos no puede
          // crear una segunda transferencia vacía.
          void this.router.navigate(['/transferencias', transferencia.id, 'borrador'], {
            replaceUrl: true,
          });
        },
        error: () => this.creando.set(false),
      });
  }

  private opciones(sucursales: Sucursal[]): OpcionSeleccion[] {
    return sucursales.map((s) => ({ valor: s.id, texto: String(s.nombre ?? `Sucursal ${s.id}`) }));
  }

  private nombreDe(id: unknown): string {
    if (id == null) {
      return '—';
    }
    return this.lista().find((s) => String(s.id) === String(id))?.nombre ?? '—';
  }
}
