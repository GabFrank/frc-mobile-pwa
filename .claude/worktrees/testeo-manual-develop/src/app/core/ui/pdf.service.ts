import { inject, Injectable } from '@angular/core';

import { esInstalada, esIos } from '../dispositivo/plataforma';
import { NotificacionService } from './notificacion.service';

/**
 * Abre PDFs que el backend devuelve en base64.
 *
 * Reemplaza al `PdfViewerService` de `frc-mobile`, que dependía de plugins de
 * Capacitor para escribir el archivo y lanzarlo con un visor nativo. Acá se
 * hace con APIs del navegador: `Blob` + `URL.createObjectURL`.
 *
 * ⚠️ **Abrir un PDF no es igual en todas las plataformas**, y las diferencias
 * no se detectan preguntando por una capacidad: Safari no falla, abre algo
 * que no sirve. Ver `docs/arquitectura/pdf.md`.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private readonly notificacion = inject(NotificacionService);

  /**
   * Abre el PDF de la forma que funcione en esta plataforma.
   *
   * ⚠️ **Tiene que llamarse desde el manejador del clic**, sin `await` en el
   * medio. Los navegadores permiten abrir una ventana solo mientras dura el
   * gesto del usuario; si se abre después de esperar una respuesta de red, el
   * bloqueador de popups la corta. Por eso el `base64` se recibe ya resuelto.
   */
  abrirBase64(base64: string, nombre: string): void {
    const blob = this.aBlob(base64);
    if (!blob) {
      this.notificacion.danger('El documento llegó vacío o dañado.');
      return;
    }

    const url = URL.createObjectURL(blob);

    if (esIos()) {
      this.abrirEnIos(url, nombre);
    } else {
      this.abrirEnElResto(url, nombre);
    }

    // No se revoca en el acto: la pestaña recién abierta todavía no leyó el
    // blob y quedaría en blanco. Un minuto alcanza de sobra y evita retener
    // el archivo en memoria por el resto de la sesión.
    //
    // Si la navegación fue en la misma pestaña, este timer muere con el
    // documento y el navegador libera el blob solo al descartarlo.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  /**
   * iOS.
   *
   * Tres cosas que Safari hace distinto y que juntas rompían este camino:
   *
   * 1. **Instalada, `window.open` se va a Safari.** La PWA no tiene pestañas:
   *    abrir una saca al usuario de la app, con un PDF en otro programa y sin
   *    forma obvia de volver. Navegando en la misma vista, el visor de PDF de
   *    Safari toma el control **dentro** de la app y el gesto de volver
   *    regresa a la pantalla anterior.
   * 2. **El atributo `download` no sirve como plan B.** iOS lo trata como una
   *    navegación normal en varias versiones, así que como red de contención
   *    no contiene nada: se termina en el mismo lugar, pero después de haber
   *    intentado otra cosa.
   * 3. **`window.open` bloqueado devuelve `null` sin avisar.** Sin un plan B
   *    real, el usuario toca «Ver recibo» y no pasa absolutamente nada.
   */
  private abrirEnIos(url: string, nombre: string): void {
    if (esInstalada()) {
      window.location.href = url;
      return;
    }

    const ventana = window.open(url, '_blank');
    if (!ventana) {
      // En el navegador, con el popup bloqueado, la navegación en la misma
      // pestaña es lo único que queda: acá el botón de atrás existe.
      this.notificacion.warn(`Abriendo ${nombre}. Usá el botón de atrás para volver.`);
      window.location.href = url;
    }
  }

  /** Chromium y Firefox: pestaña nueva y, si está bloqueada, descarga. */
  private abrirEnElResto(url: string, nombre: string): void {
    const ventana = window.open(url, '_blank');
    if (ventana) {
      return;
    }
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
  }

  /**
   * base64 → `Blob`.
   *
   * ⚠️ **Hay que sacar el prefijo `data:...;base64,`.** El backend a veces lo
   * manda y a veces no; `atob` con el prefijo tira `InvalidCharacterError`.
   * En el repo anterior cada pantalla se acordaba —o se olvidaba— de
   * limpiarlo por su cuenta.
   */
  private aBlob(base64: string): Blob | null {
    const limpio = (base64 ?? '').replace(/^data:[^;]*;base64,/, '').trim();
    if (!limpio) {
      return null;
    }
    try {
      const binario = atob(limpio);
      const bytes = new Uint8Array(binario.length);
      for (let i = 0; i < binario.length; i++) {
        bytes[i] = binario.charCodeAt(i);
      }
      return new Blob([bytes], { type: 'application/pdf' });
    } catch {
      return null;
    }
  }
}
