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

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import type { CompraNota, CompraPedido, CompraPedidoItem } from 'src/app/domains/compras/compras.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { aId } from './compras-reglas';
import { ComprasService } from './compras.service';
import { ElegirTipoFacturaComponent, type ElegirTipoFacturaData, type TipoFacturaElegido } from './elegir-tipo-factura.component';
import { EscanearFacturaService } from './escanear-factura.service';

/**
 * Un pedido en la etapa de notas: qué falta facturar, qué facturas ya se
 * cargaron, y los dos gestos del celular — escanear la próxima factura y
 * finalizar la conciliación.
 *
 * ⚠️ **Queda en el escritorio**: dividir un ítem entre notas, rechazar ítems,
 * editar a mano la distribución por sucursal y cargar la nota de un proveedor
 * sin factura electrónica. La pantalla lo dice en vez de esconderlo.
 */
@Component({
  selector: 'frc-compra-pedido',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    ImporteComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="'Pedido ' + (id() ?? '')" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (pedido(); as p) {
        <frc-seccion titulo="Pedido" [panel]="true">
          <frc-dato etiqueta="Proveedor" [valor]="p.proveedorNombre ?? '—'" />
          <frc-dato etiqueta="RUC" [valor]="p.proveedorRuc ?? '—'" />
          <frc-dato etiqueta="Fecha" [valor]="fecha(p.fecha)" />
          <frc-dato etiqueta="Etapa de notas">
            <frc-estado-chip [etiqueta]="etiquetaEtapa(p.estadoEtapa)" [tono]="p.puedeCargarFacturas ? 'info' : 'neutral'" />
          </frc-dato>
          <frc-dato etiqueta="Total del pedido">
            <frc-importe [valor]="p.totalPedido ?? null" [moneda]="p.monedaDenominacion ?? null" [simbolo]="p.monedaSimbolo ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Total facturado">
            <frc-importe [valor]="p.totalFacturado ?? null" [moneda]="p.monedaDenominacion ?? null" [simbolo]="p.monedaSimbolo ?? null" />
          </frc-dato>
          @if (p.motivoNoOpera) {
            <p class="aviso">{{ p.motivoNoOpera }}</p>
          }
        </frc-seccion>

        <frc-seccion [titulo]="'Facturas cargadas (' + p.notas.length + ')'">
          @for (n of p.notas; track n.id) {
            <frc-card
              [titulo]="'Factura ' + (n.numeroCompleto ?? n.numero ?? n.id)"
              [subtitulo]="subtituloNota(n)"
              icono="documento"
              [clickable]="false"
            >
              <frc-estado-chip pie [etiqueta]="n.estadoEtiqueta ?? n.estado ?? '—'" [tono]="tonoNota(n)" />
              <frc-importe aparte [valor]="n.valor ?? null" [simbolo]="n.monedaSimbolo ?? null" />
              @if (n.puedeEliminar) {
                <div botonera>
                  <button matButton [disabled]="eliminando() === n.id" (click)="eliminar(n)">
                    {{ eliminando() === n.id ? 'Eliminando…' : 'Eliminar' }}
                  </button>
                </div>
              }
            </frc-card>
            @if ((n.itemsSinDistribuir ?? 0) > 0) {
              <p class="aviso warn">
                {{ n.itemsSinDistribuir }} ítem(s) de esta factura no tienen la distribución por sucursal
                completa: terminalos en el sistema de escritorio.
              </p>
            }
          } @empty {
            <p class="vacio">Todavía no se cargó ninguna factura.</p>
          }
        </frc-seccion>

        <frc-seccion [titulo]="'Falta facturar (' + pendientes().length + ')'">
          @for (i of pendientes(); track i.pedidoItemId) {
            <frc-card
              [titulo]="i.descripcion ?? 'Producto ' + i.productoId"
              [subtitulo]="subtituloItem(i)"
              icono="producto"
              [clickable]="false"
            />
          } @empty {
            <p class="vacio">Todo el pedido está facturado.</p>
          }
        </frc-seccion>

        @if (completos().length > 0) {
          <frc-seccion>
            <button matButton (click)="verCompletos.set(!verCompletos())">
              {{ verCompletos() ? 'Ocultar' : 'Ver' }} los facturados completos ({{ completos().length }})
            </button>
            @if (verCompletos()) {
              @for (i of completos(); track i.pedidoItemId) {
                <frc-card
                  [titulo]="i.descripcion ?? 'Producto ' + i.productoId"
                  [subtitulo]="subtituloItem(i)"
                  icono="checkCirculo"
                  [clickable]="false"
                />
              }
            }
          </frc-seccion>
        }

        <p class="aclaracion">
          Dividir un ítem entre facturas, rechazar ítems, cambiar la distribución por sucursal
          y cargar la nota de un proveedor sin factura electrónica se hacen en el sistema de escritorio.
        </p>
      }

      @if (pedido(); as p) {
        <div acciones class="botonera">
          @if (p.puedeFinalizar) {
            <button matButton [disabled]="finalizando()" (click)="finalizar()">
              {{ finalizando() ? 'Finalizando…' : 'Finalizar' }}
            </button>
          }
          @if (p.puedeCargarFacturas) {
            <button matButton="filled" [disabled]="leyendo()" (click)="escanear()">
              {{ leyendo() ? 'Consultando SIFEN…' : 'Cargar factura' }}
            </button>
          }
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .botonera { display: flex; gap: var(--sp-2); justify-content: flex-end; }
    .botonera:empty { display: none; }
    .aviso { margin: var(--sp-2) 0 0; font-size: var(--fs-label); color: var(--text-mute); }
    .aviso.warn { color: var(--warn); margin: 0 0 var(--sp-3); }
    .vacio { color: var(--text-mute); font-size: var(--fs-label); margin: 0; }
    .aclaracion { color: var(--text-mute); font-size: var(--fs-caption); margin: var(--sp-3) 0 0; }
  `,
})
export class CompraPedidoPage {
  private readonly servicio = inject(ComprasService);
  private readonly escaneo = inject(EscanearFacturaService);
  private readonly dialogo = inject(DialogoService);

  /** Llega de la ruta `:pedidoId`. */
  readonly pedidoId = input<string>();
  readonly id = computed(() => aId(this.pedidoId()));

  readonly pedido = signal<CompraPedido | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly leyendo = signal(false);
  readonly finalizando = signal(false);
  readonly eliminando = signal<number | null>(null);
  readonly verCompletos = signal(false);

  readonly pendientes = computed<CompraPedidoItem[]>(() =>
    (this.pedido()?.items ?? []).filter((i) => (i.cantidadPendiente ?? 0) > 0.001),
  );
  readonly completos = computed<CompraPedidoItem[]>(() =>
    (this.pedido()?.items ?? []).filter((i) => (i.cantidadPendiente ?? 0) <= 0.001),
  );

  constructor() {
    effect(() => {
      if (this.pedidoId() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = this.id();
    if (id == null) {
      this.error.set('El pedido no tiene un identificador válido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.pedido(id).subscribe({
      next: (p) => {
        this.pedido.set(p ?? null);
        if (!p) this.error.set('El pedido ' + id + ' no existe.');
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  async escanear(): Promise<void> {
    const id = this.id();
    if (id == null) return;
    const tipo = await this.dialogo.abrir<ElegirTipoFacturaComponent, ElegirTipoFacturaData, TipoFacturaElegido>(
      ElegirTipoFacturaComponent,
      { pedidoId: id },
    );
    if (tipo !== 'qr') return;
    this.leyendo.set(true);
    try {
      await this.escaneo.escanearParaPedido(id);
    } finally {
      this.leyendo.set(false);
    }
  }

  /**
   * Antes de finalizar se muestra lo que queda afuera: un ítem sin facturar no
   * entra en la recepción de mercadería, y eso no se deshace desde acá.
   */
  finalizar(): void {
    const id = this.id();
    if (id == null) return;
    this.finalizando.set(true);
    this.servicio.resumenFinalizar(id).subscribe({
      next: async (r) => {
        if (!r.puedeFinalizar) {
          this.finalizando.set(false);
          await this.dialogo.confirmar({
            titulo: 'Todavía no se puede finalizar',
            mensaje: r.motivo ?? 'La etapa de notas no está en proceso.',
            confirmar: 'Entendido',
          });
          return;
        }
        const partes = [
          (r.cantidadNotas === 1 ? '1 factura' : r.cantidadNotas + ' facturas') +
            ' cargadas. El pedido pasa a recepción de mercadería.',
          ...r.avisos,
        ];
        const ok = await this.dialogo.confirmar({
          titulo: 'Finalizar la conciliación',
          mensaje: partes.join(' '),
          confirmar: 'Finalizar',
        });
        if (!ok) {
          this.finalizando.set(false);
          return;
        }
        this.servicio.finalizar(id).subscribe({
          next: (p) => {
            this.pedido.set(p);
            this.finalizando.set(false);
          },
          error: () => this.finalizando.set(false),
        });
      },
      error: () => this.finalizando.set(false),
    });
  }

  async eliminar(n: CompraNota): Promise<void> {
    const ok = await this.dialogo.confirmarEliminacion(
      'la factura ' + (n.numeroCompleto ?? n.numero) + ' de este pedido (la nota y sus ítems)',
    );
    if (!ok) return;
    this.eliminando.set(n.id);
    this.servicio.eliminarNota(n.id).subscribe({
      next: (p) => {
        this.pedido.set(p);
        this.eliminando.set(null);
      },
      error: () => this.eliminando.set(null),
    });
  }

  fecha(valor: string | null | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  etiquetaEtapa(estado: string | null | undefined): string {
    switch (estado) {
      case 'EN_PLANIFICACION':
        return 'En planificación';
      case 'PENDIENTE':
        return 'Esperando factura';
      case 'EN_PROCESO':
        return 'Cargando facturas';
      case 'COMPLETADA':
        return 'Finalizada';
      case null:
      case undefined:
        return 'Sin iniciar';
      default:
        return estado.toLowerCase().replace('_', ' ');
    }
  }

  subtituloNota(n: CompraNota): string {
    const items = n.cantidadItems ?? 0;
    return [
      fechaLegible(n.fecha, { conHora: false }),
      items === 1 ? '1 ítem' : items + ' ítems',
      n.electronica ? 'electrónica' : 'cargada a mano',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  tonoNota(n: CompraNota): 'ok' | 'warn' | 'info' {
    if (n.estado === 'CONCILIADA') return 'ok';
    if (n.estado === 'PENDIENTE_CONCILIACION') return 'warn';
    return 'info';
  }

  subtituloItem(i: CompraPedidoItem): string {
    return [i.presentacionDescripcion, i.esBonificacion ? 'bonificación' : null, i.pendienteTexto]
      .filter(Boolean)
      .join(' · ');
  }
}
