import { inject, Injectable } from '@angular/core';

import { NotificacionService } from './notificacion.service';

/**
 * Abre PDFs que el backend devuelve en base64.
 *
 * Reemplaza al `PdfViewerService` de `frc-mobile`, que dependía de plugins de
 * Capacitor para escribir el archivo y lanzarlo con un visor nativo. Acá se
 * hace con APIs del navegador: `Blob` + `URL.createObjectURL`, que funcionan
 * igual en escritorio, en el teléfono y con la PWA instalada.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  private readonly notificacion = inject(NotificacionService);

  /**
   * Abre el PDF en una pestaña nueva.
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
    const ventana = window.open(url, '_blank');

    if (!ventana) {
      // Sin ventana, se descarga: es preferible a no dar nada.
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
    }

    // No se revoca en el acto: la pestaña recién abierta todavía no leyó el
    // blob y quedaría en blanco. Un minuto alcanza de sobra y evita retener
    // el archivo en memoria por el resto de la sesión.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
