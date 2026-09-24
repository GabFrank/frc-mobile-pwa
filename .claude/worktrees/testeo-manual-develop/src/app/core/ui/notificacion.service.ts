import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Tonos del vocabulario semántico. Ver styles/_tokens.scss. */
export type TonoNotificacion = 'ok' | 'warn' | 'danger' | 'neutral';

/**
 * Avisos breves. Envuelve `MatSnackBar` para que la duración y el tono sean
 * consistentes en toda la app.
 *
 * Diferencia con el repo anterior: la duración se expresa en milisegundos y
 * la fija el tono, no el llamador. Allá `open(msg, tipo, duracion)` recibía
 * segundos y multiplicaba por 1000, lo que producía toasts de 33 minutos
 * cuando alguien pasaba 2000 creyendo que eran milisegundos.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly snackBar = inject(MatSnackBar);

  /** Duración por tono: un error necesita más tiempo de lectura que un éxito. */
  private readonly DURACION: Record<TonoNotificacion, number> = {
    ok: 2500,
    neutral: 2500,
    warn: 4000,
    danger: 5000,
  };

  ok(mensaje: string): void {
    this.mostrar(mensaje, 'ok');
  }

  warn(mensaje: string): void {
    this.mostrar(mensaje, 'warn');
  }

  danger(mensaje: string): void {
    this.mostrar(mensaje, 'danger');
  }

  neutral(mensaje: string): void {
    this.mostrar(mensaje, 'neutral');
  }

  /** Aviso con acción. Devuelve una promesa que resuelve si se pulsó la acción. */
  conAccion(mensaje: string, accion: string, tono: TonoNotificacion = 'neutral'): Promise<boolean> {
    const ref = this.snackBar.open(mensaje, accion, {
      duration: this.DURACION[tono],
      panelClass: [`frc-snack--${tono}`],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
    return new Promise((resolve) => {
      ref.onAction().subscribe(() => resolve(true));
      ref.afterDismissed().subscribe((info) => {
        if (!info.dismissedByAction) {
          resolve(false);
        }
      });
    });
  }

  private mostrar(mensaje: string, tono: TonoNotificacion): void {
    this.snackBar.open(mensaje, undefined, {
      duration: this.DURACION[tono],
      panelClass: [`frc-snack--${tono}`],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
