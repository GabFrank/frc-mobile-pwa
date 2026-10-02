import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { NotificacionService } from '../ui/notificacion.service';
import { EscanerService } from './escaner.service';
import { FORMATOS_PRODUCTO } from './escaner.types';
import { rutearEscaneo } from './escaneo-ruteo';

/**
 * Escanear una vez y caer donde corresponda.
 *
 * Es lo que hay detrás del botón flotante: abre la cámara sin preguntar qué
 * se va a leer, y decide después. Un QR de transferencia abre esa
 * transferencia; el de un inventario, ese inventario; un código de barras
 * abre el producto en Buscar.
 *
 * ⚠️ **Se piden todos los formatos, no solo QR.** Es la diferencia con los
 * escaneos de cada pantalla, que restringen a propósito —el de venta con
 * tarjeta pide solo `qr_code` para que la cámara no lea de refilón el código
 * de barras de lo que está sobre el mostrador—. Acá no hay contexto que
 * permita restringir: el punto es justamente no saber de antemano.
 *
 * El camino de Safari lo resuelve `EscanerDialogComponent` cargando ZXing,
 * igual que para los demás escaneos: este servicio no toca la cámara.
 */
@Injectable({ providedIn: 'root' })
export class EscanerUniversalService {
  private readonly escaner = inject(EscanerService);
  private readonly router = inject(Router);
  private readonly notificacion = inject(NotificacionService);

  /**
   * Abre la cámara y navega.
   *
   * Devuelve `true` si terminó navegando. `false` cubre tres casos que no son
   * error —cancelar, no leer nada, leer algo que no abre ninguna pantalla—;
   * el aviso al usuario ya se mostró donde correspondía.
   */
  async escanearYNavegar(): Promise<boolean> {
    const texto = await this.escaner.escanear({
      titulo: 'Escanear',
      ayuda: 'Apuntá a un código de barras o a un QR del sistema',
      formatos: FORMATOS_PRODUCTO,
      etiquetaManual: 'Código o QR',
    });
    if (!texto) {
      return false;
    }

    const destino = rutearEscaneo(texto);

    switch (destino.clase) {
      case 'navegar':
        await this.router.navigate([...destino.ruta], {
          queryParams: destino.queryParams,
        });
        return true;

      case 'producto':
        // El código todavía no se resolvió contra el servidor: eso lo hace
        // el buscador, que ya sabe distinguir un código de balanza de uno
        // común y probar los candidatos en orden de especificidad.
        await this.router.navigate(['/buscar'], {
          queryParams: { codigo: destino.codigo },
        });
        return true;

      case 'desconocido':
        this.notificacion.warn(destino.mensaje);
        return false;
    }
  }
}
