/**
 * Configuración de desarrollo.
 *
 * En desarrollo se apunta al central por HTTP directo: `localhost` es
 * contexto seguro para el navegador, así que cámara, geolocalización y
 * service worker funcionan igual sin HTTPS.
 *
 * En producción esto pasa a los subdominios HTTPS de Cloudflare
 * (ver docs/analisis/runbook-cloudflare.md del repo frc-mobile).
 */
export const environment = {
  production: false,
  defaultServerUrl: 'http://159.203.86.103:8083', // alpha

  /**
   * Firebase Web, para las notificaciones push.
   *
   * ⚠️ **Está sin completar a propósito, y la app lo sabe.** El proyecto
   * `bodega-franco-frc` tiene registradas las dos apps Android pero **ninguna
   * app Web**, así que no existen todavía ni la `apiKey` ni el `appId` web, ni
   * el certificado Web Push del que sale la `vapidKey`. Las tres salen de la
   * consola de Firebase y no se pueden inventar.
   *
   * Con esto vacío, la app **no ofrece** activar notificaciones y dice por qué;
   * lo que no hace es pedir permiso de notificaciones para después no poder
   * registrar nada.
   *
   * `projectId` y `messagingSenderId` sí son los reales: salen de
   * `android/app/google-services.json` del repo `frc-mobile` y son los mismos
   * para todas las plataformas del proyecto.
   */
  firebaseWeb: {
    projectId: 'bodega-franco-frc',
    messagingSenderId: '170136643206',
    apiKey: '',
    appId: '',
    vapidKey: '',
  },
};
