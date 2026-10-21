import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import type { CompraPedidoResumen, PedidosParaFactura } from 'src/app/domains/compras/compras.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { ComprasService } from './compras.service';
import { EscanearFacturaService } from './escanear-factura.service';

/**
 * Se llega acá escaneando un KuDE sin haber elegido el pedido: desde el botón
 * universal o desde «Escanear factura» en la lista.
 *
 * El CDC trae el RUC del emisor, así que el central ya sabe de qué proveedor
 * es sin ir a SIFEN. Si ese proveedor tiene **un solo** pedido esperando
 * factura, se abre directo; si tiene varios, se elige; si no tiene ninguno,
 * se dice por qué en vez de abrir una factura que no va a ningún lado.
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Factura del proveedor" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (datos(); as d) {
        @if (d.pedidos.length === 0) {
          <frc-estado-vacio
            [titulo]="d.proveedorId ? 'Ningún pedido espera esta factura' : 'Proveedor no encontrado'"
            [detalle]="vacio(d)"
            icono="documento"
          />
        } @else {
          <p class="intro">
            {{ d.tipoDocumentoDescripcion }} {{ d.numeroCompleto }} de
            <strong>{{ d.proveedorNombre }}</strong>. ¿A qué pedido se carga?
          </p>
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
        if (d?.pedidos?.length === 1) {
          // Un solo candidato: directo a la factura, sin dejar esta pantalla en el historial
          void this.escaneo.leerYAbrir(d.pedidos[0].pedidoId, qr, true).then((ok) => {
            if (!ok) {
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
    if (!d.proveedorId) {
      return 'El RUC ' + (d.proveedorRuc ?? '') + ' de esta factura no corresponde a ningún proveedor cargado.';
    }
    return (
      d.proveedorNombre +
      ' no tiene pedidos esperando factura. El pedido tiene que estar en la etapa de notas (planificación finalizada en el sistema de escritorio).'
    );
  }
}
