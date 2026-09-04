import { Injectable, signal } from '@angular/core';

/**
 * El evento que Chromium dispara cuando la app es instalable. No está en
 * `lib.dom`, así que se declara el mínimo que se usa.
 */
interface EventoInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Ofrecer instalar la PWA.
 *
 * ⚠️ **Los dos navegadores lo hacen distinto y no hay forma de unificarlo.**
 *
 * - **Chromium** dispara `beforeinstallprompt`. Hay que **guardar el evento**
 *   y llamar a `prompt()` después, desde un gesto del usuario: el navegador
 *   lo dispara cuando quiere, y si no se lo captura no vuelve.
 * - **Safari de iOS** no dispara nada y no tiene prompt. La única vía es que
 *   la persona use «Compartir → Añadir a inicio», así que ahí lo que
 *   corresponde es **explicarlo**, no ofrecer un botón que no hace nada.
 *
 * Por eso hay dos señales y no una: `sePuedeInstalar` es para el botón, y
 * `esIOS` para las instrucciones.
 */
@Injectable({ providedIn: 'root' })
export class InstalacionService {
  private evento: EventoInstalacion | null = null;

  /** Chromium ya avisó que se puede instalar. */
  readonly sePuedeInstalar = signal(false);

  /** Ya está instalada y corriendo como app. */
  readonly instalada = signal(this.detectarInstalada());

  /** Safari de iOS: hay que explicar, no ofrecer botón. */
  readonly esIOS = signal(this.detectarIOS());

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      // Sin el preventDefault, Chrome muestra su propia barra y el evento se
      // consume: el botón de la app quedaría sin nada que disparar.
      e.preventDefault();
      this.evento = e as EventoInstalacion;
      this.sePuedeInstalar.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.evento = null;
      this.sePuedeInstalar.set(false);
      this.instalada.set(true);
    });
  }

  /**
   * Muestra el prompt del navegador. Devuelve `true` si la persona aceptó.
   *
   * ⚠️ **El evento se puede usar una sola vez.** Si se descarta, Chromium no
   * lo vuelve a disparar en esa carga, así que el botón se esconde: dejarlo
   * visible daría un botón que no hace nada.
   */
  async instalar(): Promise<boolean> {
    if (!this.evento) {
      return false;
    }
    const evento = this.evento;
    this.evento = null;
    this.sePuedeInstalar.set(false);

    await evento.prompt();
    const { outcome } = await evento.userChoice;
    if (outcome === 'accepted') {
      this.instalada.set(true);
      return true;
    }
    return false;
  }

  /**
   * `true` si la app está corriendo instalada.
   *
   * Se miran las dos formas porque ninguna sola alcanza: `display-mode` es lo
   * estándar y `navigator.standalone` es lo único que reporta iOS.
   */
  private detectarInstalada(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    const comoApp = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
    const enIOS = (navigator as { standalone?: boolean }).standalone === true;
    return comoApp || enIOS;
  }

  private detectarIOS(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
      return true;
    }

    // ⚠️ **El iPad moderno se declara `Macintosh`** y solo se lo distingue
    // por el táctil. Pero esa heurística sola da falso positivo en **Chrome
    // de escritorio con emulación de dispositivo activada**, que también
    // reporta `maxTouchPoints > 1` — y ahí terminaba mostrando «Compartir →
    // Añadir a inicio» a alguien que tiene un botón de instalar de verdad.
    //
    // Se exige además que sea WebKit: en un iPad no hay otra cosa, y en un
    // Chrome emulando iPad el UA sigue diciendo Chrome.
    const esWebKitPuro = /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
    return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && esWebKitPuro;
  }
}
