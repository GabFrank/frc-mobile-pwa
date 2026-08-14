export const environment = {
  production: true,
  // Se completa cuando esté lista la Fase 0 (HTTPS con Cloudflare).
  defaultServerUrl: 'https://alpha.<dominio>',

  /**
   * Firebase Web, para las notificaciones push.
   *
   * ⚠️ **Nada de esto es secreto, y por eso está en el repo.** La `apiKey` web
   * y la clave VAPID **pública** viajan dentro del bundle de cualquier PWA:
   * quien abra el DevTools de la app las ve. Son configuración, no
   * credenciales. Lo que sí es secreto es el service account que usa el
   * central para *mandar* (`FCMInitializer`), y ese no vive acá.
   *
   * A la `apiKey` lo que la protege es la **restricción por sitio** en Google
   * Cloud Console (Credenciales → `Browser key` → Sitios web), no el
   * esconderla.
   *
   * Si alguno de los tres valores se vacía, la app **no ofrece** activar
   * notificaciones y dice por qué; lo que no hace es pedir el permiso del
   * navegador para después no poder registrar nada — ese permiso, una vez
   * denegado, no se vuelve a pedir en ese dispositivo.
   *
   * Ver `docs/arquitectura/web-push.md`.
   */
  firebaseWeb: {
    projectId: 'bodega-franco-frc',
    messagingSenderId: '170136643206',
    apiKey: 'AIzaSyB7GvFybGqFw66lqRBgarhh_fdyGuSrVEA',
    appId: '1:170136643206:web:6c0951d5ffaff0e1a5d307',
    vapidKey: 'BD2NBAWDMVmY7hiM9HJB-F9E1oMCBcBS9-JeJ1CxNDkDdrlp8jWzHngYHPnNqqmkFJPNU-5xPMpCpt3hGMPrSLM',
  },
};
