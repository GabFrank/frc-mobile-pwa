import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import {
  Transferencia,
  TransferenciaItem,
} from 'src/app/domains/transferencia/transferencia.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { TransferenciaService } from './transferencia.service';

/** Lo que registró una etapa sobre un ítem. */
interface Paso {
  etiqueta: string;
  cantidad?: number;
  porBulto?: number;
  observacion?: string;
  rechazo?: string;
}

/**
 * Detalle con **las cuatro etapas de cada ítem**.
 *
 * Es la razón de ser del módulo: si se piden 10, se preparan 8, se despachan
 * 8 y llegan 7, las cuatro cifras quedan a la vista. La diferencia 10→8 es
 * falta de stock en origen; la 8→7, un faltante en tránsito. Mostrar solo la
 * última haría indistinguibles los dos casos.
 *
 * ⚠️ **Se muestra también la presentación de cada etapa.** Se pide en cajas y
 * se despacha en unidades: comparar cantidades sin mirar la presentación da
 * diferencias falsas.
 */
@Component({
  selector: 'frc-transferencia-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Transferencia" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (transferencia(); as t) {
        <frc-seccion titulo="Transferencia" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip enumerado="TransferenciaEstado" [valor]="t.estado ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Etapa" [valor]="etapaLegible()" />
          <frc-dato etiqueta="Origen" [valor]="t.sucursalOrigen?.nombre ?? '—'" />
          <frc-dato etiqueta="Destino" [valor]="t.sucursalDestino?.nombre ?? '—'" />
          <!--
            De qué lado está el usuario decide qué puede hacer. Lo resuelve el
            backend: no se infiere comparando ids de sucursal.
          -->
          <frc-dato etiqueta="Tu rol" [valor]="rol()" />
          <frc-dato etiqueta="Creada" [valor]="fecha(t.creadoEn)" />
          @if (t.observacion) {
            <frc-dato etiqueta="Observación" [valor]="t.observacion" />
          }
        </frc-seccion>

        <frc-seccion titulo="Quién intervino" [panel]="true">
          <frc-dato etiqueta="Pidió" [valor]="quien(t.usuarioPreTransferencia)" />
          <frc-dato etiqueta="Preparó" [valor]="quien(t.usuarioPreparacion)" />
          <frc-dato etiqueta="Transportó" [valor]="quien(t.usuarioTransporte)" />
          <frc-dato etiqueta="Recibió" [valor]="quien(t.usuarioRecepcion)" />
        </frc-seccion>

        @if (items().length === 0) {
          <frc-estado-vacio
            titulo="Sin productos"
            detalle="La transferencia todavía no tiene ítems cargados."
            icono="producto"
          />
        } @else {
          <frc-seccion [titulo]="'Productos (' + items().length + ')'">
            @for (item of items(); track item.id) {
              <article class="item">
                <div class="nombre">{{ item.producto?.descripcion ?? 'Producto' }}</div>
                <ul class="pasos">
                  @for (p of pasosDe(item); track p.etiqueta) {
                    <li class="paso">
                      <span class="etapa">{{ p.etiqueta }}</span>
                      <span class="cifra">
                        {{ cantidad(p) }}
                        @if (p.porBulto && p.porBulto > 1) {
                          <span class="bulto">× {{ p.porBulto }}</span>
                        }
                      </span>
                      @if (p.rechazo) {
                        <span class="rechazo">{{ legible(p.rechazo) }}</span>
                      }
                    </li>
                  }
                </ul>
              </article>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .item {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: var(--sp-3);
    }
    .nombre { font-weight: var(--fw-medium); }
    .pasos {
      list-style: none;
      margin: var(--sp-2) 0 0;
      padding: 0;
    }
    .paso {
      display: flex;
      align-items: baseline;
      gap: var(--sp-2);
      padding: 2px 0;
      font-size: var(--fs-label);
    }
    .etapa {
      flex: 1;
      color: var(--text-soft);
    }
    .cifra {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .bulto {
      font-weight: var(--fw-regular);
      color: var(--text-mute);
    }
    .rechazo {
      font-size: var(--fs-caption);
      color: var(--danger);
    }
  `,
})
export class TransferenciaDetallePage {
  private readonly servicio = inject(TransferenciaService);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly transferencia = signal<Transferencia | null>(null);
  readonly items = signal<TransferenciaItem[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly etapaLegible = computed(() => this.legible(this.transferencia()?.etapa ?? ''));
  readonly rol = computed(() => {
    const t = this.transferencia();
    if (t?.isOrigen && t?.isDestino) {
      return 'Origen y destino';
    }
    if (t?.isOrigen) {
      return 'Origen — preparás y despachás';
    }
    if (t?.isDestino) {
      return 'Destino — recibís y verificás';
    }
    return 'Solo consulta';
  });

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
      this.error.set('Identificador de transferencia inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (t) => {
        this.transferencia.set(t ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });

    this.servicio.items(id).subscribe({
      next: (lista) => this.items.set(lista),
      // Los ítems son secundarios respecto de la cabecera: si fallan, el
      // detalle sigue mostrando en qué estado está la transferencia.
      error: () => undefined,
    });
  }

  /**
   * Las cuatro etapas de un ítem, **omitiendo las que todavía no pasaron**.
   *
   * Una etapa sin cantidad no es «cero unidades»: es «no llegó ahí».
   * Mostrarla en cero diría algo falso.
   */
  pasosDe(item: TransferenciaItem): Paso[] {
    const todos: Paso[] = [
      {
        etiqueta: 'Pedido',
        cantidad: item.cantidadPreTransferencia,
        porBulto: item.presentacionPreTransferencia?.cantidad,
        rechazo: item.motivoRechazoPreTransferencia,
      },
      {
        etiqueta: 'Preparado',
        cantidad: item.cantidadPreparacion,
        porBulto: item.presentacionPreparacion?.cantidad,
        rechazo: item.motivoRechazoPreparacion,
      },
      {
        etiqueta: 'Despachado',
        cantidad: item.cantidadTransporte,
        porBulto: item.presentacionTransporte?.cantidad,
        rechazo: item.motivoRechazoTransporte,
      },
      {
        etiqueta: 'Recibido',
        cantidad: item.cantidadRecepcion,
        porBulto: item.presentacionRecepcion?.cantidad,
        rechazo: item.motivoRechazoRecepcion,
      },
    ];
    return todos.filter((p) => p.cantidad != null);
  }

  cantidad(p: Paso): string {
    return formatearCantidad(p.cantidad ?? 0, Number.isInteger(p.cantidad ?? 0) ? 0 : 2);
  }

  quien(usuario: { persona?: { nombre?: string } } | undefined): string {
    return usuario?.persona?.nombre ?? '—';
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  legible(valor: string): string {
    const limpio = String(valor ?? '').replace(/_/g, ' ').toLowerCase();
    return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : '—';
  }
}
