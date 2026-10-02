import { Injectable, signal } from '@angular/core';

/**
 * Cómo lee los códigos este kiosco.
 *
 * - `lector`: hay un lector HID conectado. Escribe donde esté el foco, así
 *   que el campo se mantiene enfocado y el teclado en pantalla se suprime.
 * - `camara`: no hay lector. La cámara queda a cargo, y se vuelve a abrir
 *   sola después de cada consulta.
 */
export type ModoLectura = 'lector' | 'camara';

const CLAVE = 'frc.kioscoModo';

/**
 * Preferencias del modo kiosco.
 *
 * ⚠️ **Es por dispositivo, no por usuario.** El kiosco es una tablet fija a
 * la góndola: la configura quien la instala y no vuelve a tocarse. Por eso
 * vive en `localStorage` y no en el perfil del central — el mismo usuario
 * que lo configuró va a entrar mañana desde su teléfono, donde no hay
 * ningún lector conectado.
 *
 * ⚠️ **El default es `lector`.** Es lo que hay en las góndolas hoy, y
 * abrir la cámara sola a alguien que solo quería consultar un precio pide
 * un permiso que no esperaba.
 */
@Injectable({ providedIn: 'root' })
export class KioscoConfigService {
  readonly modo = signal<ModoLectura>(this.leer());

  cambiarModo(modo: ModoLectura): void {
    this.modo.set(modo);
    localStorage.setItem(CLAVE, modo);
  }

  private leer(): ModoLectura {
    return localStorage.getItem(CLAVE) === 'camara' ? 'camara' : 'lector';
  }
}
