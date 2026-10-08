import { Injectable } from '@angular/core';

/** Precisión máxima aceptable, en metros. */
export const PRECISION_MAXIMA_M = 33;
/**
 * A partir de cuántos metros de error una lectura ni siquiera se acumula.
 *
 * ⚠️ **Es el tope que tenía el plugin nativo** (`accuracy <= 80` en
 * `NativeLocationPlugin.java`) y que el port había perdido: al agotarse el
 * tiempo se usaba cualquier lectura, y una tomada por red —cientos de metros
 * de error— alcanzaba para que la marcación detectara otra sucursal. Pasó en
 * bodega el 06/10/2026: parado en el depósito, la pantalla mostró una
 * sucursal a más de un kilómetro.
 *
 * Entre `PRECISION_MAXIMA_M` y esto la lectura es «aproximada»: sirve si no
 * llega nada mejor. Peor que esto no dice dónde está la persona.
 */
export const PRECISION_DESCARTE_M = 80;
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

/**
 * Qué decir cuando solo llegaron lecturas peores que `PRECISION_DESCARTE_M`.
 *
 * Nombra «Ubicación precisa» porque es la causa que no se arregla esperando:
 * con ese ajuste apagado el teléfono informa kilómetros de error, siempre.
 */
export function mensajePocoPrecisa(precision: number | null): string {
  const cuanto = precision != null ? ` (±${Math.round(precision)} m)` : '';
  return `La ubicación es poco precisa${cuanto}. Revisá que «Ubicación precisa» esté activada para el navegador, probá cerca de una ventana y volvé a intentar.`;
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
 * umbral del aviso de distancia —que no es `PRECISION_MAXIMA_M`— con datos
 * reales en vez de adivinarlo.
 *
 * ⚠️ **Una lectura peor que `PRECISION_DESCARTE_M` no se usa nunca**, ni
 * cuando no hay otra. Es el único caso en que la precisión impide marcar: sin
 * eso, la sucursal que se detecta puede ser cualquiera.
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
      // La precisión de la última lectura que no se pudo usar, para decirla.
      let descartada: number | null = null;
      let huboDescartadas = false;
      let limite: ReturnType<typeof setTimeout> | undefined;

      const cerrar = (resultado: Posicion | null, mensaje: string, estado: ProgresoGeo['estado']) => {
        if (terminado) {
          return;
        }
        terminado = true;
        navigator.geolocation.clearWatch(vigilancia);
        clearTimeout(limite);
        alAvanzar?.({
          estado,
          precisionActual: resultado?.precision ?? descartada ?? undefined,
          lecturas: lecturas.length,
          lecturasNecesarias: LECTURAS_MINIMAS,
          mensaje,
        });
        resolver(resultado);
      };

      const vigilancia = navigator.geolocation.watchPosition(
        (posicion) => {
          const precision = posicion.coords.accuracy;
          // Una lectura así no dice dónde está la persona: no se acumula ni
          // para el caso de que no llegue nada mejor. Se anota aunque caiga
          // en el calentamiento, porque es lo que decide si vale esperar más.
          if (precision > PRECISION_DESCARTE_M) {
            huboDescartadas = true;
          }
          // Las lecturas del calentamiento se descartan: son las peores y
          // arrastrarían el promedio.
          if (Date.now() - inicio < CALENTAMIENTO_MS) {
            return;
          }
          if (precision > PRECISION_DESCARTE_M) {
            descartada = precision;
            alAvanzar?.({
              estado: 'buscando',
              precisionActual: precision,
              lecturas: lecturas.length,
              lecturasNecesarias: LECTURAS_MINIMAS,
              mensaje: `Ubicación poco precisa todavía… ±${Math.round(precision)} m`,
            });
            return;
          }
          lecturas.push(posicion);
          alAvanzar?.({
            estado: 'buscando',
            precisionActual: precision,
            lecturas: lecturas.length,
            lecturasNecesarias: LECTURAS_MINIMAS,
            mensaje: `Buscando ubicación… ±${Math.round(precision)} m`,
          });

          const buenas = lecturas.filter((l) => l.coords.accuracy <= PRECISION_MAXIMA_M);
          if (buenas.length >= LECTURAS_MINIMAS) {
            cerrar(this.promediar(buenas), 'Ubicación obtenida.', 'listo');
          }
        },
        (error) => {
          // ⚠️ Solo el permiso negado cierra acá. El tiempo agotado y la
          // posición no disponible los decide el reloj propio, que sabe si
          // hubo lecturas descartadas: cerrar con «revisá el permiso» mandaba
          // a tocar un ajuste que estaba bien.
          if (error?.code === 1) {
            cerrar(null, 'No se pudo obtener la ubicación. Revisá el permiso.', 'error');
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: TIEMPO_MAXIMO_MS },
      );

      const alAgotarse = (esSegundaVentana: boolean) => {
        // Se agotó el tiempo: vale más una posición aproximada —con su
        // precisión registrada— que ninguna. Quien mira la evidencia después
        // puede distinguir una de otra.
        const buenas = lecturas.filter((l) => l.coords.accuracy <= PRECISION_MAXIMA_M);
        const usables = buenas.length > 0 ? buenas : lecturas;
        if (usables.length > 0) {
          cerrar(this.promediar(usables), 'Ubicación aproximada.', 'listo');
          return;
        }
        // El teléfono está informando, pero mal: suele ser la primera lectura
        // por red, antes de que el GPS enganche. Se espera una ventana más,
        // una sola, que es el segundo intento que hacía `frc-mobile` cuando el
        // plugin rechazaba.
        if (huboDescartadas && !esSegundaVentana) {
          limite = setTimeout(() => alAgotarse(true), TIEMPO_MAXIMO_MS);
          return;
        }
        cerrar(
          null,
          // Sin ninguna lectura lo más común es la ubicación del teléfono
          // apagada: el navegador lo informa como «no disponible», no como
          // permiso negado.
          huboDescartadas
            ? mensajePocoPrecisa(descartada)
            : 'No se pudo obtener la ubicación. Revisá que la ubicación del teléfono esté encendida.',
          'error',
        );
      };

      limite = setTimeout(() => alAgotarse(false), TIEMPO_MAXIMO_MS);
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
