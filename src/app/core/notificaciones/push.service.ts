import { inject, Injectable, signal } from '@angular/core';

import { idDeDispositivo } from '../auth/dispositivo';
import { firebaseWeb } from './firebase.config';
import { DatosService } from '../graphql/datos.service';
import { ActualizarTokenFcmGQL } from 'src/app/graphql/personas/usuario/graphql/actualizarTokenFcm';

/**
 * En qué punto está el push en este dispositivo.
 *
 * Son estados de la app, no del navegador: `sinConfigurar` no es culpa de
 * quien la usa y `bloqueado` no se arregla desde acá.
 */
export type EstadoPush =
  | 'sinSoporte'
  | 'sinConfigurar'
  | 'requiereInstalar'
  | 'desactivado'
  | 'bloqueado'
  | 'activo';

/**
 * Notificaciones push cuando la app está cerrada.
 *
 * El central ya sabe mandarlas: `FCMService.sendToToken` arma el mensaje con
 * `WebpushConfig`, la mutación `actualizarTokenFcm` existe, y `TipoDispositivo`
 * tiene `WEB` y `WEB_MOBILE`. **No hace falta tocar el central.**
 *
 * ⚠️ **El token va atado al `idDispositivo` de esta sesión.** El central busca
 * la sesión activa por `(usuario, idDispositivo)` y, si no la encuentra,
 * escribe el token en *la primera sesión abierta del usuario*. Ese fallback
 * llegó a escribir el token de un Chrome de escritorio sobre una sesión de
 * otro navegador; con otro orden de filas habría caído sobre la sesión de un
 * iPhone. Por eso `SesionDispositivoService` registra la sesión al entrar y
 * las dos mitades comparten `idDeDispositivo()`.
 *
 * Ver `docs/arquitectura/web-push.md`.
 *
 * ⚠️ **Es un token de FCM, no una suscripción cruda.** `SwPush.requestSubscription`
 * devuelve un `PushSubscription` del estándar Web Push, y el central no sabe
 * mandarle nada a eso: `sendToToken` espera un token de FCM. Guardar el JSON de
 * la suscripción en `actualizarTokenFcm` haría que todo *pareciera* funcionar
 * —permiso concedido, mutación en verde— y no llegaría ni una notificación. Por
 * eso se usa el SDK de Firebase para acuñar el token.
 *
 * ⚠️ **Comparte el service worker de Angular.** Firebase busca por defecto un
 * `firebase-messaging-sw.js` propio; registrar un segundo service worker sobre
 * el de Angular es pelearse por el control de la página. Se le pasa la
 * registración de `ngsw-worker.js`, que ya está activa.
 *
 * ⚠️ **En iOS solo funciona con la PWA instalada** (16.4+). En Safari sin
 * instalar, `Notification` ni siquiera existe: por eso hay un estado
 * `requiereInstalar` en vez de un botón que falla.
 *
 * ⚠️ **El SDK entra por `import()` dinámico.** No tiene por qué pesar en el
 * arranque de quien nunca activa las notificaciones.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly datos = inject(DatosService);
  private readonly actualizarTokenGQL = inject(ActualizarTokenFcmGQL);

  readonly estado = signal<EstadoPush>(this.estadoInicial());
  readonly error = signal<string | null>(null);
  readonly trabajando = signal(false);

  /** Sin `apiKey`, `appId` y `vapidKey` no se puede acuñar un token. */
  get configurado(): boolean {
    return Boolean(firebaseWeb.apiKey && firebaseWeb.appId && firebaseWeb.vapidKey);
  }

  /**
   * Pide permiso, acuña el token y se lo manda al central.
   *
   * ⚠️ **El permiso se pide acá y no al arrancar.** Un navegador que recibe el
   * pedido sin que la persona haya hecho nada lo bloquea de una y no vuelve a
   * preguntar: el permiso se quema para siempre en ese dispositivo.
   */
  async activar(): Promise<boolean> {
    if (!this.configurado) {
      this.estado.set('sinConfigurar');
      return false;
    }
    if (!soportaPush()) {
      this.estado.set(esIOSSinInstalar() ? 'requiereInstalar' : 'sinSoporte');
      return false;
    }

    this.trabajando.set(true);
    this.error.set(null);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        this.estado.set(permiso === 'denied' ? 'bloqueado' : 'desactivado');
        return false;
      }

      const token = await this.acunarToken();
      if (!token) {
        this.error.set('El navegador concedió el permiso pero no entregó un token.');
        this.estado.set('desactivado');
        return false;
      }

      await this.registrarEnCentral(token);
      this.estado.set('activo');
      return true;
    } catch (err) {
      this.error.set((err as Error)?.message ?? 'No se pudieron activar las notificaciones.');
      this.estado.set('desactivado');
      return false;
    } finally {
      this.trabajando.set(false);
    }
  }

  private async acunarToken(): Promise<string | null> {
    const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);

    if (!(await isSupported())) {
      this.estado.set('sinSoporte');
      return null;
    }

    const app = getApps()[0] ?? initializeApp({
      apiKey: firebaseWeb.apiKey,
      appId: firebaseWeb.appId,
      projectId: firebaseWeb.projectId,
      messagingSenderId: firebaseWeb.messagingSenderId,
    });

    // La registración de Angular, no una nueva: dos service workers sobre la
    // misma página se disputan el control y el push queda en el que perdió.
    //
    // ⚠️ **`getRegistration()` y no `ready`.** `ready` es una promesa que
    // **nunca se rechaza**: si no hay ningún service worker registrado se
    // queda esperando para siempre, y el botón se congela en «Activando…» sin
    // error ni log. Pasa en `ng serve`, donde `provideServiceWorker` está en
    // `enabled: !isDevMode()`.
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      throw new Error(
        'No hay service worker activo, así que no hay dónde recibir el aviso. ' +
          'En desarrollo está deshabilitado: probalo sobre un build.',
      );
    }

    return await getToken(getMessaging(app), {
      vapidKey: firebaseWeb.vapidKey,
      serviceWorkerRegistration: registration,
    });
  }

  private async registrarEnCentral(token: string): Promise<void> {
    await this.datos
      .mutar<boolean>(
        this.actualizarTokenGQL,
        { tokenFcm: token, idDispositivo: idDeDispositivo() },
        { mostrarCarga: false, mensajeExito: undefined },
      )
      .toPromise();
  }

  private estadoInicial(): EstadoPush {
    if (!this.configurado) {
      return 'sinConfigurar';
    }
    if (!soportaPush()) {
      return esIOSSinInstalar() ? 'requiereInstalar' : 'sinSoporte';
    }
    if (Notification.permission === 'granted') {
      // Concedido no es lo mismo que registrado: el token puede haber
      // caducado o haberse acuñado contra otro servidor. Se rearma al activar.
      return 'desactivado';
    }
    return Notification.permission === 'denied' ? 'bloqueado' : 'desactivado';
  }
}

function soportaPush(): boolean {
  return (
    typeof Notification !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * iOS antes de instalar: Safari expone `PushManager` recién cuando la PWA
 * corre desde la pantalla de inicio.
 */
function esIOSSinInstalar(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const esIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return esIOS && !instalada;
}
