import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { esKude } from './compras-reglas';
import { ComprasService } from './compras.service';

const OPCIONES_ESCANEO = {
  titulo: 'Escanear factura',
  ayuda: 'Apuntá al QR del KuDE (la factura electrónica impresa del proveedor)',
  // Solo QR: en el escritorio del comprador suele haber mercadería, y la
  // cámara no tiene que leer de refilón un código de barras.
  formatos: FORMATOS_QR,
  etiquetaManual: 'CDC de la factura (44 dígitos)',
};

/**
 * Escanear el KuDE. Lo comparten la lista, el pedido y el botón universal.
 *
 * El CDC se puede **escribir a mano** en el campo del escáner: si el QR del
 * KuDE impreso en A4 no se deja leer, los 44 dígitos están debajo.
 */
@Injectable({ providedIn: 'root' })
export class EscanearFacturaService {
  private readonly escaner = inject(EscanerService);
  private readonly servicio = inject(ComprasService);
  private readonly router = inject(Router);
  private readonly notificacion = inject(NotificacionService);

  /** Sin pedido elegido: el CDC dice de qué proveedor es, y se busca su pedido. */
  async escanearSinPedido(): Promise<void> {
    const texto = await this.escaner.escanear(OPCIONES_ESCANEO);
    if (!texto) {
      return;
    }
    if (!esKude(texto)) {
      this.notificacion.warn('Ese código no es el QR ni el CDC de una factura electrónica.');
      return;
    }
    await this.router.navigate(['/operaciones/compras/factura'], {
      queryParams: { qr: texto.trim() },
    });
  }

  /**
   * Con el pedido ya elegido: el central trae la factura de SIFEN, la valida
   * contra el pedido y la cruza. Devuelve `true` si terminó navegando.
   */
  async escanearParaPedido(pedidoId: number): Promise<boolean> {
    const texto = await this.escaner.escanear(OPCIONES_ESCANEO);
    if (!texto) {
      return false;
    }
    if (!esKude(texto)) {
      this.notificacion.warn('Ese código no es el QR ni el CDC de una factura electrónica.');
      return false;
    }
    return await this.leerYAbrir(pedidoId, texto.trim());
  }

  /**
   * Pide la factura al central y abre la compra nueva que se va a crear con ella.
   * Devuelve `null` si abrió, o el motivo del central si no: la pantalla lo deja
   * escrito, porque el aviso flotante se va solo.
   */
  abrirNuevaCompra(qr: string, reemplazar = false): Promise<string | null> {
    return new Promise((resolver) => {
      this.servicio.leerFacturaNuevaCompra(qr).subscribe({
        next: (factura) => {
          void this.router
            .navigate(['/operaciones/compras/nueva', factura.id], { replaceUrl: reemplazar })
            .then(() => resolver(null));
        },
        error: (err: unknown) =>
          resolver(err instanceof Error && err.message ? err.message : 'No se pudo abrir la factura.'),
      });
    });
  }

  /** Pide la factura al central y abre la conciliación. */
  leerYAbrir(pedidoId: number, qr: string, reemplazar = false): Promise<boolean> {
    return new Promise((resolver) => {
      this.servicio.leerFactura(pedidoId, qr).subscribe({
        next: (factura) => {
          void this.router
            .navigate(['/operaciones/compras', pedidoId, 'factura', factura.id], {
              replaceUrl: reemplazar,
            })
            .then(() => resolver(true));
        },
        // El rechazo (no es del proveedor, ya cargada, SIFEN no la encuentra…)
        // ya lo mostró DatosService con el mensaje del central.
        error: () => resolver(false),
      });
    });
  }
}
