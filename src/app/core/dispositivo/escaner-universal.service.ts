import { inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';

import { TipoEntidad } from 'src/app/domains/enums/tipo-entidad.enum';
import { descodificarQr } from 'src/app/generic/utils/qrUtils';
import { TransferenciaService } from 'src/app/pages/transferencias/transferencia.service';

import { NotificacionService } from '../ui/notificacion.service';
import { EscanerService } from './escaner.service';
import { FORMATOS_PRODUCTO } from './escaner.types';
import { rutearEscaneo, transferenciaDelQr } from './escaneo-ruteo';

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
  private readonly injector = inject(Injector);

  /**
   * Le avisa al central que este QR se escaneó, si es de una transferencia.
   *
   * Es lo que cierra el diálogo del QR en el desktop que lo está mostrando.
   * Va fuera de `rutearEscaneo` porque esa función es pura a propósito —no
   * toca el router ni el servidor— y acá hace falta justamente lo segundo.
   *
   * ⚠️ **No se espera la respuesta ni se corta la navegación si falla.** El
   * escaneo sirve para abrir la transferencia; que el desktop se entere es
   * un extra. Encadenarlo haría que un central caído deje al operario sin
   * poder entrar.
   *
   * ⚠️ **`TransferenciaService` se pide recién acá, no en un campo.** Este
   * servicio es infraestructura: lo usa el botón flotante de toda la app.
   * Inyectarlo arriba le colgaba encima toda la capa GraphQL de
   * transferencias, y cualquier pantalla que montara el FAB pasaba a
   * necesitar Apollo —78 tests de pantallas se cayeron así—. Diferirlo
   * mantiene el acoplamiento donde corresponde: solo el que escanea una
   * transferencia paga ese costo.
   */
  private avisarSiEsTransferencia(texto: string): void {
    const qr = descodificarQr(texto);
    if (qr?.tipoEntidad !== TipoEntidad.TRANSFERENCIA) {
      return;
    }
    const id = Number(qr.idOrigen ?? qr.idCentral);
    const sucursalId = Number(qr.sucursalId);
    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(sucursalId) || sucursalId <= 0) {
      return;
    }
    this.injector.get(TransferenciaService).avisarQrEscaneado(id, sucursalId).subscribe({
      error: () => {
        // Silencioso a propósito: ver el comentario de arriba.
      },
    });
  }

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
    this.avisarSiEsTransferencia(texto);

    switch (destino.clase) {
      case 'navegar': {
        // El QR de una transferencia viaja con ella hasta el detalle: es la
        // prueba de que a quien la abre le pasaron el código, y lo que lo
        // habilita a tomarla aunque esté a nombre de otro. Vale igual si el
        // código se cargó a mano. Ver `transferenciaDelQr`.
        const queryParams =
          transferenciaDelQr(texto) != null ? { qr: texto.trim() } : destino.queryParams;
        await this.router.navigate([...destino.ruta], { queryParams });
        return true;
      }

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
