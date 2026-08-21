import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import { firstValueFrom } from 'rxjs';
import {
  ConfirmacionData,
  ConfirmacionDialogComponent,
} from './confirmacion-dialog.component';
import { TextoDialogComponent, TextoDialogData } from './texto-dialog.component';

/**
 * Diálogos de la app.
 *
 * Diferencia con el repo anterior: `DialogoService.open()` devolvía el
 * objeto crudo del alert y cada llamador comparaba `res.role === 'aceptar'`.
 * Acá devuelve un booleano.
 */
@Injectable({ providedIn: 'root' })
export class DialogoService {
  private readonly dialog = inject(MatDialog);

  /**
   * Pide un texto corto. Devuelve `undefined` si el usuario canceló.
   *
   * Existe para que nadie tenga que recurrir a `window.prompt`, que se ve
   * ajeno a la app y que los navegadores suprimen cuando la página corre
   * como PWA instalada.
   */
  async pedirTexto(data: TextoDialogData): Promise<string | undefined> {
    const ref = this.dialog.open<TextoDialogComponent, TextoDialogData, string | undefined>(
      TextoDialogComponent,
      {
        data,
        width: '380px',
        maxWidth: '92vw',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        /*
          Anclado arriba, no centrado.

          Este diálogo enfoca su campo al abrirse, así que en el teléfono el
          teclado sube siempre. El teclado tapa la mitad inferior de la
          pantalla pero NO achica el viewport de layout, así que un diálogo
          centrado queda con sus botones debajo del teclado: se veía el
          campo y no se podía confirmar. Verificado en un Motorola real.
        */
        position: { top: '8vh' },
      },
    );
    return await firstValueFrom(ref.afterClosed());
  }

  /** `true` si el usuario confirmó. */
  async confirmar(data: ConfirmacionData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmacionDialogComponent, {
      data,
      width: '340px',
      maxWidth: '92vw',
      // Sin esto, `cdkFocusInitial` del botón de confirmación no tiene
      // efecto y el diálogo abre sin foco: inutilizable con teclado o
      // lector de pantalla.
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /** Atajo para borrados: preconfigura el estilo destructivo. */
  async confirmarEliminacion(que: string): Promise<boolean> {
    return this.confirmar({
      titulo: 'Confirmar eliminación',
      mensaje: `Se va a eliminar ${que}. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar',
      destructivo: true,
    });
  }

  /** Abre cualquier componente como diálogo y devuelve su resultado. */
  async abrir<T, D = unknown, R = unknown>(
    componente: ComponentType<T>,
    data?: D,
    ancho = '420px',
  ): Promise<R | undefined> {
    const ref = this.dialog.open(componente, {
      data,
      width: ancho,
      maxWidth: '95vw',
      // Igual que en `confirmar()`: con `false`, Material ni siquiera mira
      // `cdkFocusInitial`, y el foco se quedaba en el contenedor del
      // diálogo. Un componente que quiera decidir dónde empieza el foco lo
      // marca; el resto arranca en su primer elemento enfocable.
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    return await firstValueFrom(ref.afterClosed());
  }
}
