import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { EscanerDialogComponent } from './escaner-dialog.component';
import { OpcionesEscaneo, hayCamara } from './escaner.types';

/**
 * Lectura de códigos de barra y QR.
 *
 * Es la única puerta al escáner en toda la app. Las pantallas piden un código
 * y reciben un string; no saben si vino de la cámara, de la carga manual o
 * —el día que haga falta— de un lector Bluetooth.
 *
 * ⚠️ **Necesita contexto seguro.** `getUserMedia` solo existe en HTTPS o en
 * `localhost`. Para probar en un teléfono por USB: `adb reverse tcp:4300
 * tcp:4300`, y el teléfono ve `localhost` con la cámara habilitada. Servir el
 * dev server por IP de red **no** funciona.
 */
@Injectable({ providedIn: 'root' })
export class EscanerService {
  private readonly dialog = inject(MatDialog);

  /**
   * `true` si este navegador puede leer con la cámara.
   *
   * Alcanza con tener cámara: sin `BarcodeDetector` —Safari, Firefox— el
   * diálogo carga ZXing. Condicionar esto al detector nativo dejaría a los
   * iPhone sin escáner por una capacidad que no necesitan.
   */
  get disponible(): boolean {
    return hayCamara();
  }

  /**
   * Abre el escáner y resuelve con el código leído, o `undefined` si el
   * usuario canceló.
   *
   * Siempre se abre el diálogo, incluso donde `disponible` es `false`: ahí
   * cae directo en la carga manual, que es una respuesta útil. Chequear
   * `disponible` sirve para decidir si mostrar el botón de escanear como
   * acción principal, no para bloquear la llamada.
   */
  async escanear(opciones: OpcionesEscaneo = {}): Promise<string | undefined> {
    const ref = this.dialog.open<EscanerDialogComponent, OpcionesEscaneo, string | undefined>(
      EscanerDialogComponent,
      {
        data: opciones,
        // A pantalla completa: el marco de guía necesita el alto entero para
        // que el usuario pueda acercar y alejar el teléfono.
        width: '100vw',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        panelClass: 'frc-escaner-panel',
        // Con `false` Material ni mira `cdkFocusInitial`, y el campo de carga
        // manual abriría sin foco: en el teléfono, sin teclado.
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      },
    );
    return await firstValueFrom(ref.afterClosed());
  }
}
