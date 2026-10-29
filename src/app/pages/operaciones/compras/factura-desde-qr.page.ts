import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import type { CompraPedidoResumen, PedidosParaFactura } from 'src/app/domains/compras/compras.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { facturaYaUsada } from './compras-reglas';
import { ComprasService } from './compras.service';
import { EscanearFacturaService } from './escanear-factura.service';

/**
 * Se llega acá escaneando un KuDE sin haber elegido el pedido: desde el botón
 * universal o desde «Nueva compra» en la lista.
 *
 * El CDC trae el RUC del emisor, así que el central ya sabe de qué proveedor
 * es sin ir a SIFEN. Si ningún pedido de ese proveedor espera factura —el caso
 * normal—, la factura **crea la compra** entera: se abre directo. Si alguno la
 * espera (un pedido planificado en el escritorio), se ofrecen las dos cosas.
 */
@Component({
  selector: 'frc-factura-desde-qr',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    ImporteComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Factura del proveedor" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (datos(); as d) {
        @if (!d.proveedorId) {
          <frc-estado-vacio titulo="Proveedor no encontrado" [detalle]="vacio(d)" icono="documento" />
        } @else if (d.pedidos.length === 0) {
          <frc-estado-vacio
            titulo="No se pudo abrir la factura"
            [detalle]="motivo() ?? 'El central no pudo leer la factura. Probá de nuevo.'"
            icono="documento"
          />
          @if (!yaUsada()) {
            <button matButton="filled" class="nueva" [disabled]="abriendo()" (click)="nuevaCompra()">
              {{ abriendo() ? 'Consultando SIFEN…' : 'Crear la compra con esta factura' }}
            </button>
          }
        } @else {
          <p class="intro">
            {{ d.tipoDocumentoDescripcion }} {{ d.numeroCompleto }} de
            <strong>{{ d.proveedorNombre }}</strong>. Creá la compra con esta factura, o cargala a un
            pedido que ya la espera.
          </p>
          <button matButton="filled" class="nueva" [disabled]="abriendo()" (click)="nuevaCompra()">
            {{ abriendo() ? 'Consultando SIFEN…' : 'Crear una compra nueva' }}
          </button>
          <p class="intro">Pedidos de {{ d.proveedorNombre }} esperando factura:</p>
          @for (p of d.pedidos; track p.pedidoId) {
            <frc-card
              [titulo]="'Pedido ' + p.pedidoId"
              [subtitulo]="subtitulo(p)"
              icono="documento"
              (abrir)="elegir(p)"
            >
              <frc-importe aparte [valor]="p.totalPedido ?? null" [simbolo]="p.monedaSimbolo ?? null" />
            </frc-card>
          }
        }
      }
    </frc-pagina>
  `,
  styles: `
    .intro { margin: 0 0 var(--sp-3); font-size: var(--fs-label); }
    .nueva { width: 100%; margin-bottom: var(--sp-4); }
  `,
})
export class FacturaDesdeQrPage {
  private readonly servicio = inject(ComprasService);
  private readonly escaneo = inject(EscanearFacturaService);

  /** Llega por `?qr=`. */
  readonly qr = input<string>();

  readonly datos = signal<PedidosParaFactura | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly abriendo = signal(false);
  /** Por qué el central no abrió la factura: queda escrito en la pantalla. */
  readonly motivo = signal<string | null>(null);
  readonly yaUsada = computed(() => facturaYaUsada(this.motivo()));

  constructor() {
    effect(() => {
      if (this.qr() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const qr = (this.qr() ?? '').trim();
    if (!qr) {
      this.error.set('No llegó el código de la factura. Escaneala de nuevo.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.pedidosParaFactura(qr).subscribe({
      next: (d) => {
        if (d?.proveedorId && (d.pedidos?.length ?? 0) === 0) {
          // Ningún pedido la espera: la factura crea la compra, desde la etapa de creación
          void this.escaneo.abrirNuevaCompra(qr, true).then((motivo) => {
            if (motivo) {
              this.motivo.set(motivo);
              this.datos.set(d);
              this.cargando.set(false);
            }
          });
          return;
        }
        this.datos.set(d ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  nuevaCompra(): void {
    this.abriendo.set(true);
    void this.escaneo.abrirNuevaCompra((this.qr() ?? '').trim()).then((motivo) => {
      if (motivo) this.motivo.set(motivo);
      this.abriendo.set(false);
    });
  }

  elegir(p: CompraPedidoResumen): void {
    void this.escaneo.leerYAbrir(p.pedidoId, (this.qr() ?? '').trim(), true);
  }

  subtitulo(p: CompraPedidoResumen): string {
    const pendientes = p.itemsPendientes ?? 0;
    return [
      fechaLegible(p.fecha, { conHora: false }),
      pendientes === 1 ? '1 ítem sin facturar' : pendientes + ' ítems sin facturar',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  vacio(d: PedidosParaFactura): string {
    return (
      'El RUC ' + (d.proveedorRuc ?? '') +
      ' de esta factura no corresponde a ningún proveedor cargado. Dalo de alta como proveedor en el sistema de escritorio.'
    );
  }
}
