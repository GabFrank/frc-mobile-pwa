import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PdfService } from 'src/app/core/ui/pdf.service';
import type { KudeProveedor } from 'src/app/domains/compras/compras.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { esKude } from './compras-reglas';
import { ComprasService } from './compras.service';

/**
 * «Factura del proveedor (PDF)»: escanear el QR del KuDE y ver la factura en
 * PDF, armada por el central con los datos de SIFEN y la plantilla de nuestras
 * facturas electrónicas. Solo consulta: no crea compras ni notas.
 *
 * ⚠️ El PDF se abre desde el clic de «Ver PDF», con el base64 ya en memoria:
 * abrirlo después de esperar la respuesta lo corta el bloqueador de popups
 * (ver `PdfService`).
 */
@Component({
  selector: 'frc-factura-proveedor-pdf',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    ImporteComponent,
    EstadoChipComponent,
    EstadoVacioComponent,
    SkeletonComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Factura del proveedor" [conVolver]="true">
      @if (cargando()) {
        <p class="ayuda">Consultando la factura en SIFEN…</p>
        <frc-skeleton [cantidad]="3" />
      } @else if (kude(); as k) {
        <frc-seccion [titulo]="k.tipoDocumentoDescripcion ?? 'Factura'" [panel]="true">
          @if (k.cancelada) {
            <frc-estado-chip etiqueta="Cancelada por el proveedor" tono="danger" />
          }
          <frc-dato etiqueta="Proveedor" [valor]="k.emisorNombre ?? '—'" />
          <frc-dato etiqueta="RUC" [valor]="k.emisorRuc ?? '—'" />
          <frc-dato etiqueta="Número" [valor]="k.numeroCompleto ?? '—'" />
          <frc-dato etiqueta="Emitida" [valor]="fecha(k.fechaEmision)" />
          <frc-dato etiqueta="Condición" [valor]="k.condicion ?? '—'" />
          <frc-dato etiqueta="Renglones" [valor]="k.cantidadRenglones ?? 0" />
          <frc-dato etiqueta="Total">
            <frc-importe [valor]="k.totalGeneral ?? null" [simbolo]="k.monedaSimbolo ?? null" />
          </frc-dato>
          <p class="cdc">CDC {{ k.cdc }}</p>
        </frc-seccion>
        <p class="ayuda">
          Es el KuDE armado con los datos que informa la SET y el formato de nuestras facturas: no es
          una copia del papel del proveedor, pero tiene todos sus datos legales, el CDC y el QR.
        </p>
      } @else {
        <frc-estado-vacio
          titulo="Escaneá la factura"
          detalle="Apuntá al QR del KuDE del proveedor, o escribí el CDC de 44 dígitos, y la vas a ver en PDF."
          icono="documento"
        />
      }

      <div acciones class="botonera">
        @if (kude(); as k) {
          <button matButton="filled" (click)="verPdf(k)">Ver PDF</button>
          <button matButton (click)="escanear()" [disabled]="cargando()">Escanear otra</button>
        } @else {
          <button matButton="filled" (click)="escanear()" [disabled]="cargando()">
            {{ cargando() ? 'Consultando…' : 'Escanear factura' }}
          </button>
        }
      </div>
    </frc-pagina>
  `,
  styles: `
    .ayuda { color: var(--text-mute); font-size: var(--fs-caption); margin: var(--sp-2) 0; }
    .cdc { font-family: var(--font-mono, monospace); font-size: var(--fs-caption); color: var(--text-mute); word-break: break-all; margin: var(--sp-2) 0 0; }
    .botonera { display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-1); }
  `,
})
export class FacturaProveedorPdfPage {
  private readonly escaner = inject(EscanerService);
  private readonly servicio = inject(ComprasService);
  private readonly pdf = inject(PdfService);
  private readonly notificacion = inject(NotificacionService);

  readonly kude = signal<KudeProveedor | null>(null);
  readonly cargando = signal(false);

  async escanear(): Promise<void> {
    const texto = await this.escaner.escanear({
      titulo: 'Escanear factura',
      ayuda: 'Apuntá al QR del KuDE (la factura electrónica impresa del proveedor)',
      formatos: FORMATOS_QR,
      etiquetaManual: 'CDC de la factura (44 dígitos)',
    });
    if (!texto) return;
    if (!esKude(texto)) {
      this.notificacion.warn('Ese código no es el QR ni el CDC de una factura electrónica.');
      return;
    }
    this.cargando.set(true);
    this.servicio.kudeFacturaProveedor(texto.trim()).subscribe({
      next: (k) => {
        this.kude.set(k ?? null);
        this.cargando.set(false);
      },
      // El motivo (no es una factura, no es nuestra, SIFEN no la encuentra…) ya lo mostró DatosService
      error: () => this.cargando.set(false),
    });
  }

  /** Desde el clic, con el PDF ya en memoria. */
  verPdf(k: KudeProveedor): void {
    this.pdf.abrirBase64(k.pdf, k.nombreArchivo ?? 'factura-proveedor.pdf');
  }

  fecha(valor: string | null | undefined): string {
    return fechaLegible(valor, { conHora: true }) ?? '—';
  }
}
