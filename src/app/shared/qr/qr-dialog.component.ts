import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { NotificacionService } from 'src/app/core/ui/notificacion.service';

export interface DatosQr {
  /** El texto que va adentro. Suele salir de `codificarQr`. */
  codigo: string;
  titulo: string;
  /** Lo que identifica: «Recepción #431». Se muestra debajo del QR. */
  subtitulo?: string;
}

/**
 * Muestra un QR para que otro lo escanee.
 *
 * Es la contraparte del escáner universal: lo que este dibuja,
 * `rutearEscaneo` sabe abrirlo. Sirve para pasarle una recepción, un
 * inventario o una transferencia a un compañero sin dictarle un número.
 *
 * ⚠️ **El texto se genera con `codificarQr`, no a mano.** El formato tiene
 * ocho campos separados por guion y la posición de cada uno importa; ver
 * `docs/arquitectura/qr-del-sistema.md`.
 *
 * ⚠️ **`qrcode` entra por `import()` dinámico.** No tiene sentido que pese en
 * el arranque de quien nunca comparte nada.
 *
 * ⚠️ **La librería sale de `default`, no de un export con nombre.** `qrcode`
 * es CommonJS —`main` sin `module` ni `exports`—, así que el bundle de
 * producción expone un único `export default`. `const { toCanvas } = await
 * import('qrcode')` compila, typechequea (los `@types` declaran exports con
 * nombre) y devuelve `undefined` en release. En `ng serve` y en los tests no
 * se ve porque el pre-bundler de Vite le agrega interop —es la única
 * dependencia con `needsInterop: true`—, que es exactamente por qué el QR
 * andaba en local y en ningún canal desplegado.
 */
@Component({
  selector: 'frc-qr-dialog',
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>{{ datos.titulo }}</h2>

      <div class="marco">
        @if (error()) {
          <p class="fallo">No se pudo generar el código.</p>
        }
        <canvas #lienzo></canvas>
      </div>

      @if (datos.subtitulo) {
        <p class="sub">{{ datos.subtitulo }}</p>
      }
      <p class="ayuda">Pedile al otro que lo escanee con el botón de la app.</p>

      <div class="acciones">
        <button matButton (click)="copiar()">Copiar código</button>
        <button matButton="filled" (click)="ref.close()">Listo</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); align-items: center; }
    h2 { margin: 0; font-size: var(--fs-title); font-weight: var(--fw-medium); color: var(--text); }
    /*
      Fondo claro en los dos temas: un QR sobre fondo oscuro no lo lee ningún
      lector. Por eso tiene token propio y no usa el de superficie.
    */
    .marco {
      background: var(--qr-fondo);
      padding: var(--sp-3);
      border-radius: var(--radius-md);
      line-height: 0;
    }
    canvas { display: block; }
    .sub { margin: 0; font-size: var(--fs-body); font-weight: var(--fw-medium); color: var(--text); }
    .ayuda { margin: 0; font-size: var(--fs-label); color: var(--text-soft); text-align: center; }
    .fallo { margin: 0; font-size: var(--fs-label); color: var(--danger); }
    .acciones { display: flex; gap: var(--sp-2); align-self: stretch; justify-content: flex-end; }
  `,
})
export class QrDialogComponent {
  readonly datos = inject<DatosQr>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<QrDialogComponent>>(MatDialogRef);
  private readonly notificacion = inject(NotificacionService);

  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('lienzo');
  readonly error = signal(false);

  constructor() {
    void this.dibujar();
  }

  private async dibujar(): Promise<void> {
    try {
      const { default: QRCode } = await import('qrcode');
      const el = this.lienzo()?.nativeElement;
      if (!el) {
        return;
      }
      await QRCode.toCanvas(el, this.datos.codigo, {
        width: 240,
        margin: 1,
        // Corrección media: el QR se lee de una pantalla, a veces con brillo
        // bajo o con el dedo encima de una esquina.
        errorCorrectionLevel: 'M',
      });
    } catch (error) {
      // El cartel de la pantalla es genérico a propósito —al usuario no le
      // sirve el detalle—, pero sin este log el error queda invisible: así
      // fue como un `toCanvas` que valía `undefined` en release sobrevivió
      // cinco días en beta pareciendo «el QR no se genera».
      console.error('[qr] No se pudo generar el código:', error);
      this.error.set(true);
    }
  }

  /**
   * Copiar el texto sirve cuando no hay cómo escanear —dos personas por
   * teléfono, o una pantalla rota—: el otro lo pega en la carga manual del
   * escáner.
   */
  async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.datos.codigo);
      this.notificacion.ok('Código copiado.');
    } catch (error) {
      console.warn('[qr] No se pudo copiar el código:', error);
      this.notificacion.warn('No se pudo copiar. Escaneá el código.');
    }
  }
}
