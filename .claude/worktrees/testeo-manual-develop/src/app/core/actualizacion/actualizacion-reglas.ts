/**
 * Cuándo volver a ofrecer una actualización que el usuario postergó.
 *
 * La regla de fondo: **postergar no es rechazar**. El operador que está en
 * medio de una recepción dice «ahora no» y tiene que poder seguir; pero si no
 * se le vuelve a preguntar, se queda en una versión vieja para siempre y nadie
 * se entera. Eso es exactamente lo que el testeo del bloque 5 encontró.
 *
 * Vive aparte del servicio para poder probarlo sin service worker ni reloj
 * real.
 */

/** Cuánto se calla el aviso cuando el usuario dice «ahora no». */
export const ESPERA_MS = 2 * 60 * 60 * 1000; // 2 horas

/** Lo que se recuerda de la decisión del usuario, entre aperturas de la app. */
export interface Postergacion {
  /** Qué versión se postergó. Si llega otra distinta, la espera no aplica. */
  hash: string;
  /** Cuándo se postergó, en milisegundos. */
  cuando: number;
}

/**
 * Si corresponde ofrecer la actualización.
 *
 * Tres razones para volver a preguntar, y las tres importan:
 *
 * 1. **No se postergó nada** — es la primera vez que se ofrece.
 * 2. **Es otra versión** — postergar la de ayer no cubre la de hoy, que puede
 *    traer justo el arreglo que el usuario necesita.
 * 3. **Pasó la espera** — dos horas es más que un turno de descarga de camión y
 *    menos que una jornada.
 *
 * ⚠️ **La apertura de la app no alcanza por sí sola para volver a preguntar.**
 * Una PWA instalada se «abre» muchas veces por día —cada vez que se vuelve a
 * ella— y preguntar en cada una es la interrupción que se quiso evitar. Por eso
 * el corte es el tiempo, no el arranque.
 */
export function debeOfrecer(
  hashDisponible: string | null | undefined,
  postergada: Postergacion | null | undefined,
  ahora: number,
): boolean {
  if (!hashDisponible) {
    return false;
  }
  if (!postergada || postergada.hash !== hashDisponible) {
    return true;
  }
  return ahora - postergada.cuando >= ESPERA_MS;
}

/**
 * Lee la postergación guardada, tolerando basura.
 *
 * Si el JSON está roto o le faltan campos se devuelve `null`: en la duda,
 * ofrecer. Perder una postergación molesta un poco; perder una actualización
 * deja al operador con una versión vieja sin saberlo.
 */
export function leerPostergacion(crudo: string | null): Postergacion | null {
  if (!crudo) {
    return null;
  }
  try {
    const dato = JSON.parse(crudo) as Partial<Postergacion>;
    if (typeof dato?.hash !== 'string' || typeof dato?.cuando !== 'number') {
      return null;
    }
    return { hash: dato.hash, cuando: dato.cuando };
  } catch {
    return null;
  }
}

/**
 * Cómo se nombra una versión en el botón.
 *
 * El `appData` lo sella la build (`scripts/sello-version.mjs`). Si por lo que
 * sea no llegó, se cae al hash corto: **decir "Actualizar" a secas esconde que
 * hay dos versiones distintas en juego**, y el hash al menos es comparable con
 * lo que muestra «Aplicación».
 */
export function etiquetaDeVersion(appData: unknown, hash: string): string {
  const etiqueta = (appData as { etiqueta?: unknown } | null)?.etiqueta;
  if (typeof etiqueta === 'string' && etiqueta.trim().length > 0) {
    return etiqueta;
  }
  return hash.slice(0, 7);
}
