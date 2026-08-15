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
};
