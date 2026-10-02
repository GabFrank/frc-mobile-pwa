import { Injectable } from '@angular/core';

/** Precisión máxima aceptable, en metros. */
export const PRECISION_MAXIMA_M = 33;
/** Lecturas iniciales que se descartan mientras el GPS se estabiliza. */
export const CALENTAMIENTO_MS = 700;
/** Cuánto se espera antes de rendirse con lo que haya. */
export const TIEMPO_MAXIMO_MS = 6300;
/** Lecturas mínimas para promediar. */
export const LECTURAS_MINIMAS = 2;

export interface Posicion {
  latitud: number;
  longitud: number;
  /** Metros. Cuanto más bajo, mejor. */
  precision: number;
  lecturas: number;
}

export interface ProgresoGeo {
  estado: 'pidiendo-permiso' | 'buscando' | 'listo' | 'error';
  precisionActual?: number;
  lecturas: number;
  lecturasNecesarias: number;
  mensaje: string;
}

/**
 * Ubicación del dispositivo.
 *
 * Reemplaza al `NativeLocationPlugin` de `frc-mobile`, un plugin Java de 155
 * líneas sobre `FusedLocationProvider`. La web no ofrece el fusionado de
 * sensores de Google Play Services, pero **el patrón que lo hacía útil sí se
 * reimplementa**: calentar, exigir varias lecturas, filtrar por precisión y
 * promediar. Se conservan sus constantes.
 *
 * ⚠️ **Es la pérdida técnica más concreta de la migración.** Sin el fusionado
 * nativo, la precisión en interiores empeora — y marcar asistencia se hace
 * justo adentro. Por eso la marcación **guarda la evidencia** (`precisionGps`
 * y `distanciaSucursalMetros`) además del veredicto: permite recalibrar el
 * umbral con datos reales en vez de adivinarlo.
 *
 * ⚠️ **Contexto seguro obligatorio**, igual que la cámara: `geolocation` solo
 * existe en HTTPS o `localhost`. Funciona en Safari e iOS sin nada especial.
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  get disponible(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  /**
   * Toma varias lecturas y devuelve el promedio de las buenas.
   *
   * Promediar y no quedarse con la primera es lo que evita que una lectura
   * mala —típica al abrir el GPS— decida si alguien está en la sucursal.
   */
  async posicionActual(alAvanzar?: (p: ProgresoGeo) => void): Promise<Posicion | null> {
    if (!this.disponible) {
      alAvanzar?.({
        estado: 'error',
        lecturas: 0,
        lecturasNecesarias: LECTURAS_MINIMAS,
        mensaje: 'Este dispositivo no informa la ubicación.',
      });
      return null;
    }

    alAvanzar?.({
      estado: 'pidiendo-permiso',
      lecturas: 0,
      lecturasNecesarias: LECTURAS_MINIMAS,
      mensaje: 'Pidiendo permiso de ubicación…',
    });

    return new Promise<Posicion | null>((resolver) => {
      const lecturas: GeolocationPosition[] = [];
      const inicio = Date.now();
      let terminado = false;

      const cerrar = (resultado: Posicion | null, mensaje: string, estado: ProgresoGeo['estado']) => {
        if (terminado) {
          return;
        }
        terminado = true;
        navigator.geolocation.clearWatch(vigilancia);
        clearTimeout(limite);
        alAvanzar?.({
          estado,
          precisionActual: resultado?.precision,
          lecturas: lecturas.length,
          lecturasNecesarias: LECTURAS_MINIMAS,
          mensaje,
        });
        resolver(resultado);
      };

      const vigilancia = navigator.geolocation.watchPosition(
        (posicion) => {
          // Las lecturas del calentamiento se descartan: son las peores y
          // arrastrarían el promedio.
          if (Date.now() - inicio < CALENTAMIENTO_MS) {
            return;
          }
          lecturas.push(posicion);
          alAvanzar?.({
            estado: 'buscando',
            precisionActual: posicion.coords.accuracy,
            lecturas: lecturas.length,
            lecturasNecesarias: LECTURAS_MINIMAS,
            mensaje: `Buscando ubicación… ±${Math.round(posicion.coords.accuracy)} m`,
          });

          const buenas = lecturas.filter((l) => l.coords.accuracy <= PRECISION_MAXIMA_M);
          if (buenas.length >= LECTURAS_MINIMAS) {
            cerrar(this.promediar(buenas), 'Ubicación obtenida.', 'listo');
          }
        },
        () =>
          cerrar(
            null,
            'No se pudo obtener la ubicación. Revisá el permiso.',
            'error',
          ),
        { enableHighAccuracy: true, maximumAge: 0, timeout: TIEMPO_MAXIMO_MS },
      );

      const limite = setTimeout(() => {
        // Se agotó el tiempo: vale más una posición imprecisa —con su
        // precisión registrada— que ninguna. Quien mira la evidencia después
        // puede distinguir una de otra.
        const buenas = lecturas.filter((l) => l.coords.accuracy <= PRECISION_MAXIMA_M);
        const usables = buenas.length > 0 ? buenas : lecturas;
        cerrar(
          usables.length > 0 ? this.promediar(usables) : null,
          usables.length > 0 ? 'Ubicación aproximada.' : 'No se pudo obtener la ubicación.',
          usables.length > 0 ? 'listo' : 'error',
        );
      }, TIEMPO_MAXIMO_MS);
    });
  }

  private promediar(lecturas: GeolocationPosition[]): Posicion {
    const n = lecturas.length;
    return {
      latitud: lecturas.reduce((s, l) => s + l.coords.latitude, 0) / n,
      longitud: lecturas.reduce((s, l) => s + l.coords.longitude, 0) / n,
      // La precisión resultante es la mejor de las usadas, no el promedio:
      // promediar posiciones no empeora la precisión de la mejor.
      precision: Math.min(...lecturas.map((l) => l.coords.accuracy)),
      lecturas: n,
    };
  }

  /**
   * Distancia en metros entre dos coordenadas (fórmula del haversine).
   *
   * Es el número que se **guarda con la marcación**, no solo el sí o no:
   * una marcación a 300 m con precisión de 500 m es un caso distinto de una
   * a 300 m con precisión de 5 m, y solo se puede distinguir después si se
   * guardaron los dos datos.
   */
  distanciaMetros(latA: number, lngA: number, latB: number, lngB: number): number {
    const RADIO_TIERRA_M = 6_371_000;
    const aRad = (g: number) => (g * Math.PI) / 180;
    const dLat = aRad(latB - latA);
    const dLng = aRad(lngB - lngA);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLng / 2) ** 2 * Math.cos(aRad(latA)) * Math.cos(aRad(latB));
    return RADIO_TIERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
