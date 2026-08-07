import { inject, Injectable, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

import { SELLO_VERSION } from '../sello-version';
import { DialogoService } from '../ui/dialogo.service';
import { NotificacionService } from '../ui/notificacion.service';
import {
  debeOfrecer,
  etiquetaDeVersion,
  leerPostergacion,
  Postergacion,
} from './actualizacion-reglas';

const CLAVE_POSTERGADA = 'frc.actualizacion.postergada';

/**
 * Actualización de la app instalada.
 *
 * ⚠️ **Esto existe porque sin ello la app no se actualiza nunca.** El testeo
 * del bloque 5 en un Android real mostró que reabrir la PWA instalada **no
 * re-navega** —restaura la página, incluso sirviendo un chunk que ya no existe
 * en el servidor—, así que la versión nueva puede quedar esperando para
 * siempre. El service worker por sí solo no alcanza: hay que preguntarle,
 * aplicar la versión y recargar.
 *
 * ⚠️ **El usuario puede decir que no.** Puede estar en medio de una recepción
 * o de un arqueo, y una recarga ahí pierde lo que esté cargado en pantalla.
 * Postergar es una respuesta legítima; olvidarse de volver a preguntar, no.
 * Ver `actualizacion-reglas.ts`.
 */
@Injectable({ providedIn: 'root' })
export class ActualizacionService {
  /**
   * ⚠️ **Opcional a propósito.** `SwUpdate` solo existe si la app registró un
   * service worker. Exigirlo haría que el shell —que arranca este servicio—
   * explote en cualquier contexto sin `provideServiceWorker`: los tests, y
   * cualquier entorno donde se decida no registrarlo. Todo lo de acá ya está
   * guardado detrás de `isEnabled`, así que ausente se comporta igual que
   * deshabilitado.
   */
  private readonly sw = inject(SwUpdate, { optional: true });
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);

  /** La versión que está corriendo ahora. La sella la build. */
  readonly instalada = SELLO_VERSION;

  /** Cómo se llama la versión que está esperando, o `null` si no hay. */
  readonly disponible = signal<string | null>(null);

  private hashDisponible: string | null = null;
  private preguntando = false;

  /**
   * Arranca la escucha. Se llama una vez, desde el shell.
   *
   * Sin service worker —desarrollo, o un navegador sin soporte— no hace nada
   * y no rompe: `isEnabled` es falso y la app funciona igual.
   */
  iniciar(): void {
    if (!this.sw?.isEnabled) {
      return;
    }

    this.sw.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe((evento) => {
        this.hashDisponible = evento.latestVersion.hash;
        this.disponible.set(
          etiquetaDeVersion(evento.latestVersion.appData, evento.latestVersion.hash),
        );
        void this.ofrecerSiCorresponde();
      });

    // Una consulta al arrancar, y otra cada media hora mientras la app viva.
    // ⚠️ Sin esto el service worker puede no mirar nunca: la PWA instalada se
    // queda abierta días entre navegaciones reales.
    void this.consultar();
    setInterval(() => void this.consultar(), 30 * 60 * 1000);
  }

  /** Le pregunta al servidor si hay algo nuevo. */
  async consultar(): Promise<boolean> {
    if (!this.sw?.isEnabled) {
      return false;
    }
    try {
      return await this.sw.checkForUpdate();
    } catch {
      // Sin red no hay actualización que buscar. No es un error que mostrar.
      return false;
    }
  }

  /**
   * Aplica la versión que está esperando y recarga.
   *
   * ⚠️ **La recarga es parte de aplicar.** `activateUpdate()` cambia lo que el
   * service worker va a servir, pero la pestaña sigue con el código viejo en
   * memoria hasta que se recarga. Sin el `reload` el usuario toca «Actualizar»,
   * no ve ningún cambio, y vuelve a tocar.
   */
  async aplicar(): Promise<void> {
    if (!this.sw?.isEnabled || this.disponible() == null) {
      return;
    }
    try {
      await this.sw.activateUpdate();
      this.olvidarPostergacion();
      location.reload();
    } catch {
      this.notificacion.danger('No se pudo aplicar la actualización. Probá de nuevo más tarde.');
    }
  }

  /**
   * Ofrece la actualización si toca.
   *
   * `preguntando` evita dos diálogos encimados cuando el evento y la consulta
   * periódica caen juntos.
   */
  private async ofrecerSiCorresponde(): Promise<void> {
    if (this.preguntando) {
      return;
    }
    const postergada = leerPostergacion(localStorage.getItem(CLAVE_POSTERGADA));
    if (!debeOfrecer(this.hashDisponible, postergada, Date.now())) {
      return;
    }

    this.preguntando = true;
    try {
      const ok = await this.dialogo.confirmar({
        titulo: 'Hay una versión nueva',
        mensaje:
          'Actualizar a ' +
          (this.disponible() ?? '') +
          ' recarga la app. Si estás en medio de una carga, dejalo para después: te lo vuelvo a preguntar, y también podés hacerlo desde Mi cuenta.',
        confirmar: 'Actualizar',
        cancelar: 'Ahora no',
      });
      if (ok) {
        await this.aplicar();
      } else {
        this.postergar();
      }
    } finally {
      this.preguntando = false;
    }
  }

  private postergar(): void {
    if (!this.hashDisponible) {
      return;
    }
    const dato: Postergacion = { hash: this.hashDisponible, cuando: Date.now() };
    localStorage.setItem(CLAVE_POSTERGADA, JSON.stringify(dato));
  }

  private olvidarPostergacion(): void {
    localStorage.removeItem(CLAVE_POSTERGADA);
  }
}
