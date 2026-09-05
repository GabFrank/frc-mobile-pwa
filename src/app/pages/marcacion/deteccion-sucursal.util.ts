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
 * kilómetros: el corte lo decide la pantalla, que avisa y deja marcar igual
 * con la distancia registrada. Recortar acá convertiría un GPS malo —que es
 * lo normal en un interior— en «no podés marcar».
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
