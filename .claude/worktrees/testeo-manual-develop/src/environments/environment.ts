/**
 * Configuración de desarrollo.
 *
 * `defaultServerUrl` es el **último recurso**: solo se usa cuando el host desde
 * el que se sirvió la app no está en `core/config/api-por-host.ts` y el usuario
 * no eligió un servidor a mano. En la práctica eso significa desarrollo local y
 * las previews de Cloudflare Pages.
 *
 * En desarrollo se apunta al central por HTTP directo: `localhost` es contexto
 * seguro para el navegador, así que cámara, geolocalización y service worker
 * funcionan igual sin HTTPS.
 *
 * **No hay `environment.prod.ts`.** No hace falta: el backend de cada canal
 * sale del hostname, no del build, y una sola compilación sirve las cuatro
 * puertas. Ver `api-por-host.ts` para el porqué.
 */
export const environment = {
  production: false,
  defaultServerUrl: 'https://alpha-api.frcsuite.com', // alpha, por el túnel a mauro
};
