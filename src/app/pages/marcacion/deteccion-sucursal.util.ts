import { soloOperables, SucursalOperable } from 'src/app/domains/empresarial/sucursal/sucursal.util';

/** Una sucursal con lo mínimo para poder ubicarla en el mapa. */
export interface SucursalUbicable extends SucursalOperable {
  /** `"lat,lng"` como texto, que es como lo guarda el central. */
  localizacion?: string | null;
}

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface SucursalDetectada<T> {
  sucursal: T;
  metros: number;
}

/**
 * Hasta cuántos metros de la sucursal se puede marcar. Más lejos, no se marca.
 *
 * ⚠️ **Es el mismo número que valida el central** (`DistanciaMarcacion` en
 * `franco-system-backend-servidor`). Si se cambia acá hay que cambiarlo allá:
 * el central rechaza igual, y la pantalla dejaría marcar para que después
 * falle el guardado.
 *
 * ⚠️ **No es la precisión del GPS.** `PRECISION_MAXIMA_M` (±33 m) filtra qué
 * lecturas son confiables; esto mide qué tan lejos quedó la persona.
 *
 * Elegido con las marcaciones de producción del 15 al 29/10/2026, ya con la
 * coordenada de Aquario corregida: de ~770, solo 10 pasaron los 80 m, y casi
 * todas a 160–400 m —marcadas desde afuera—.
 */
export const DISTANCIA_MAXIMA_M = 80;

/**
 * Si la marcación queda demasiado lejos para marcar.
 *
 * Compara la distancia **redondeada**, que es la que se muestra y la que se
 * guarda, igual que el central: así un 80,4 m no se acepta acá y se rechaza allá.
 */
export function estaLejos(metros: number): boolean {
  return Math.round(metros) > DISTANCIA_MAXIMA_M;
}

/** El haversine, inyectado para que esta util no dependa de Angular. */
export type MedirDistancia = (latA: number, lngA: number, latB: number, lngB: number) => number;

/**
 * Lee el `"lat,lng"` de una sucursal.
 *
 * ⚠️ **Las dos mitades o ninguna.** El dato se carga a mano, así que llega
 * con espacios, vacío o con un texto en vez de números. Un `Number('')` da
 * `0` y un `-25.5` suelto deja la longitud en `NaN`: las dos cosas ubicarían
 * la sucursal en un lugar que no existe, y eso es peor que no tener el dato,
 * porque después se mide una distancia contra ese punto y el número parece
 * legítimo.
 */
export function coordenadasDe(localizacion: string | null | undefined): Coordenadas | null {
  const partes = String(localizacion ?? '').split(',');
  if (partes.length !== 2) {
    return null;
  }
  const lat = Number(partes[0].trim());
  const lng = Number(partes[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  // Un campo vacío pasa por `Number('')` como 0 y quedaría en el golfo de
  // Guinea. Se descarta antes de que se convierta en una distancia.
  if (partes[0].trim() === '' || partes[1].trim() === '') {
    return null;
  }
  return { lat, lng };
}

/**
 * Cuál es la sucursal en la que se está, según la posición.
 *
 * Devuelve la **operable más cercana** con coordenadas cargadas, y a cuántos
 * metros quedó. `null` si ninguna sucursal tiene coordenadas para comparar —
 * que no es lo mismo que estar lejos de todas.
 *
 * ⚠️ **No aplica ningún radio.** Devuelve la más cercana aunque queden
 * kilómetros, para que la pantalla pueda decir dónde estás y a cuánto. Quien
 * decide si se puede marcar es {@link estaLejos}.
 * Lo que no dice dónde está nadie se descarta antes, en `GeoService`
 * (`PRECISION_DESCARTE_M`): acá ya llega una posición que vale la pena medir.
 *
 * ⚠️ **Filtra con `soloOperables()` adentro, no en quien llama.** `SERVIDOR`
 * y `COMPRAS` son virtuales y llevan las coordenadas del central: dejarlas
 * competir les daría todas las marcaciones de quien esté cerca de la casa
 * central. Que el filtro sea interno hace imposible olvidarlo.
 */
export function detectarSucursal<T extends SucursalUbicable>(
  sucursales: T[],
  posicion: { latitud: number; longitud: number },
  distancia: MedirDistancia,
): SucursalDetectada<T> | null {
  let mejor: SucursalDetectada<T> | null = null;

  for (const sucursal of soloOperables(sucursales ?? [])) {
    const coords = coordenadasDe(sucursal.localizacion);
    if (!coords) {
      continue;
    }
    const metros = distancia(coords.lat, coords.lng, posicion.latitud, posicion.longitud);
    if (!mejor || metros < mejor.metros) {
      mejor = { sucursal, metros };
    }
  }

  return mejor;
}
