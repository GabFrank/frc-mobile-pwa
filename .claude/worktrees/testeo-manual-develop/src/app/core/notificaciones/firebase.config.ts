/**
 * Firebase Web, para las notificaciones push.
 *
 * ⚠️ **No vive en `environment.ts`, y es a propósito.** El proyecto de
 * Firebase es **uno solo** para alpha, beta y producción: no cambia con el
 * canal, así que no es configuración de entorno. Ponerlo ahí obligaría a
 * repetir los mismos cuatro valores en cada archivo de entorno y a mantenerlos
 * sincronizados a mano.
 *
 * ⚠️ **Nada de esto es secreto, y por eso está en el repo.** La `apiKey` web y
 * la clave VAPID **pública** viajan dentro del bundle de cualquier PWA: quien
 * abra el DevTools de la app las ve. Son configuración, no credenciales. Lo
 * que sí es secreto es el service account que usa el central para *mandar*
 * (`FCMInitializer`), y ese no vive en este repo.
 *
 * A la `apiKey` la protege la **restricción por sitio** en Google Cloud
 * Console (Credenciales → `Browser key` → Sitios web), no el esconderla.
 *
 * ⚠️ **Si alguno de los tres últimos queda vacío, la app no ofrece activar las
 * notificaciones** y dice que no están configuradas. Lo que no hace es pedir
 * el permiso del navegador para después no poder registrar nada — ese permiso,
 * una vez denegado, no se vuelve a pedir en ese dispositivo.
 *
 * Ver `docs/arquitectura/web-push.md`.
 */
export const firebaseWeb = {
  /** Del proyecto, iguales para todas las plataformas. */
  projectId: 'bodega-franco-frc',
  messagingSenderId: '170136643206',

  /** De la app Web registrada en la consola. */
  apiKey: 'AIzaSyB7GvFybGqFw66lqRBgarhh_fdyGuSrVEA',
  appId: '1:170136643206:web:6c0951d5ffaff0e1a5d307',

  /** Clave pública del certificado Web Push. */
  vapidKey: 'BD2NBAWDMVmY7hiM9HJB-F9E1oMCBcBS9-JeJ1CxNDkDdrlp8jWzHngYHPnNqqmkFJPNU-5xPMpCpt3hGMPrSLM',
};
