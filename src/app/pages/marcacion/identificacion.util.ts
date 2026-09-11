import {
  UMBRAL_SIMILITUD_FACIAL,
  UMBRAL_SIMILITUD_VERIFICACION,
  mejorSimilitudConGaleria,
  parsearGaleriaFacial,
} from 'src/app/domains/marcacion/embedding-galeria.util';

/** Lo mínimo que hace falta del usuario que devuelve el central. */
export interface UsuarioIdentificable {
  id?: number | string;
  nickname?: string;
  persona?: {
    id?: number;
    nombre?: string;
    imagenes?: unknown;
    embeddingFacial?: string | null;
  } | null;
}

/** Lo que devuelve `usuarioPorEmbedding`. */
export interface RespuestaIdentificacion {
  usuario?: UsuarioIdentificable | null;
  similitud?: number | null;
  similitudSegundo?: number | null;
  /** Cuánto le sacó al segundo. `undefined` contra un central sin el campo. */
  margen?: number | null;
}

export interface Identificacion {
  usuario: UsuarioIdentificable;
  /** Lo que dijo el central, sobre su caché de galerías. */
  similitudCentral: number;
  /** Lo recalculado acá contra la galería que vino en la respuesta. */
  similitudLocal: number;
  /**
   * Cuánto le sacó al segundo candidato, si el central lo informa.
   *
   * ⚠️ **Se registra, no se usa para decidir.** Poner un umbral de margen hoy
   * sería inventar el número que la medición existe para averiguar: hace
   * falta ver qué margen dan estas caras, estas cámaras y esta luz. Cuando
   * haya datos, es una línea.
   */
  margen: number | null;
  /** Si las dos superan su umbral. Solo con esto en `true` se marca. */
  confiable: boolean;
}

/**
 * Comprueba a quién dijo el central que reconoció.
 *
 * ⚠️ **Son dos controles independientes y los dos tienen que pasar.** El
 * central resuelve el 1:N contra su caché en memoria y devuelve **el mejor
 * match y nada más**: `findBestMatch()` calcula el máximo y descarta el resto,
 * y `UsuarioSimilitudResult` solo lleva `usuario` y `similitud`. Un `0.71`
 * contra un segundo candidato de `0.69` llega **indistinguible** de un `0.71`
 * contra un `0.45`, y el primero es una moneda al aire. Desde `V216.5` el
 * central informa `margen`, que se **registra** con la marcación; el umbral
 * sobre ese margen no se fija todavía, porque el número tiene que salir de los
 * datos de esta población y no de una suposición. Mientras tanto, el control
 * que decide es recalcular acá contra la galería que vino.
 *
 * ⚠️ **El umbral local es el de verificación (`0.75`), no el de búsqueda
 * (`0.55`).** `frc-mobile` acepta con `0.55` en las dos puntas
 * (`buscarYValidarUsuario`), pero lo usa para **elegir** a quién marcar en una
 * pantalla donde después hay una verificación 1:1. Acá el 1:N es la única
 * puerta y el dispositivo es compartido: un rechazo de más cuesta un
 * reintento, un falso positivo deja una marcación a nombre de otra persona en
 * el registro de asistencia.
 *
 * Devuelve `null` cuando el central no reconoció a nadie —que es distinto de
 * reconocer a alguien sin confianza suficiente, y se dice distinto.
 */
export function validarIdentificacion(
  embedding: number[],
  respuesta: RespuestaIdentificacion | null | undefined,
  umbralLocal = UMBRAL_SIMILITUD_VERIFICACION,
): Identificacion | null {
  const usuario = respuesta?.usuario;
  if (!usuario?.id) {
    return null;
  }

  const similitudCentral = respuesta?.similitud ?? 0;
  const galeria = parsearGaleriaFacial(usuario.persona?.embeddingFacial);

  // Sin galería en la respuesta no hay nada que recalcular. No se cae al
  // veredicto del central: quedarse con un solo control es justamente lo que
  // esta función existe para evitar.
  const similitudLocal = galeria ? mejorSimilitudConGaleria(embedding, galeria) : 0;

  return {
    usuario,
    similitudCentral,
    similitudLocal,
    margen: respuesta?.margen ?? null,
    confiable: similitudCentral >= UMBRAL_SIMILITUD_FACIAL && similitudLocal >= umbralLocal,
  };
}
