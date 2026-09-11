/**
 * Qué instancia del central le corresponde a cada dirección desde la que se
 * sirve la app.
 *
 * **Una sola compilación sirve todas las puertas.** La alternativa era una
 * configuración de build por canal con `fileReplacements`, y se descartó por
 * tres motivos:
 *
 * 1. Agregar una empresa pasa a ser una línea acá, no una compilación nueva.
 * 2. El artefacto que se prueba en beta es **byte a byte** el que va a
 *    producción. Con un build por canal, no lo es.
 * 3. Una PWA sí sabe desde qué host se sirvió: leerlo es más honesto que
 *    hornearlo.
 *
 * El **canal** no vive acá: lo define qué proyecto de Cloudflare Pages sirvió
 * la página, que es lo que gobierna el tren de releases.
 */
export const API_POR_HOST: Readonly<Record<string, string>> = {
  // Producción — proyecto `frc-pwa-prod`, dos puertas
  'farmacia.app.frcsuite.com': 'https://farmacia-api.frcsuite.com',
  'bodega.app.frcsuite.com': 'https://bodega-api.frcsuite.com',

  // Canal beta — proyecto `frc-pwa-beta`
  'beta.app.frcsuite.com': 'https://farmacia-api.frcsuite.com',

  // Canal alpha — proyecto `frc-pwa-alpha`. La API sale por un túnel de
  // Cloudflare hasta mauro, que no tiene IP pública.
  'alpha.app.frcsuite.com': 'https://alpha-api.frcsuite.com',
};

/**
 * La API que corresponde al host actual, o `null` si el host no está en el
 * mapa.
 *
 * ⚠️ **Devolver `null` es deliberado.** Un host desconocido —una preview de
 * Pages, un `localhost`, un dominio que alguien apuntó por su cuenta— tiene que
 * caer al valor de `environment`, que apunta a alpha. Defaultear a producción
 * sería la clase de decisión que nadie recuerda haber tomado hasta que una
 * prueba escribe en la base equivocada.
 */
export function apiParaHost(hostname: string): string | null {
  return API_POR_HOST[hostname] ?? null;
}
