// Portado de `frc-mobile`. **El formato de galería no se toca**: es el que el
// central ya tiene guardado, y cambiarlo invalida los rostros enrolados. Los
// umbrales sí se ajustaron (issue #144), con datos y en coseno, igual que el desktop.
import type { CapturaFacial } from 'src/app/core/dispositivo/reconocimiento-facial.service';

export interface EmbeddingGaleriaItem {
  pose: string;
  embedding: number[];
  score: number;
}

export interface EmbeddingGaleria {
  master: number[];
  gallery: EmbeddingGaleriaItem[];
}

const POSES_CAPTURA = ['left', 'right', 'front'];

/*
 * Umbrales en coseno, los mismos del desktop. Calibrados el 2026-11-12 con las
 * galerías sanas de producción (58 personas, 650 capturas de marcación):
 *   - dos personas distintas: mediana 0,53, el 99,9 % por debajo de 0,75;
 *   - la misma persona, promedio de frames: mediana 0,89;
 *   - la misma persona, un frame suelto: mediana 0,84 (un frame es más ruidoso).
 */
/** 1:N: lo mínimo que tiene que dar el central para el mejor candidato. El 0,55 anterior no separaba personas. */
export const UMBRAL_SIMILITUD_FACIAL = 0.70;
/** Cada frame de la tanda, para contar como válido. */
export const UMBRAL_SIMILITUD_FRAME_VERIFICACION = 0.70;
/**
 * 1:1 final, sobre el embedding promedio de la tanda. Con 0,75 un impostor pasa
 * el 0,13 % de las veces y la persona correcta queda afuera el 1,4 %.
 */
export const UMBRAL_SIMILITUD_VERIFICACION = 0.75;
/**
 * 1:N del kiosco: cuánto le tiene que sacar el mejor candidato al segundo.
 * Con 0,05 la persona correcta queda afuera un 0,3 % más de las veces, y deja
 * de alcanzar con parecerse a un compañero casi tanto como a uno mismo.
 */
export const MARGEN_MINIMO_IDENTIFICACION = 0.05;
export const SCORE_MINIMO_DETECCION = 0.45;
export const SCORE_MINIMO_FRAME = 0.55;
export const SCORE_MINIMO_FRAME_VERIFICACION = 0.6;
export const SCORE_MINIMO_GALERIA = 0.7;
export const FRAMES_MINIMOS_VERIFICACION = 3;
export const HITS_CONSECUTIVOS_VERIFICACION = 3;

export interface FrameCalidadFacial {
  embedding: number[];
  score: number;
  similitud?: number;
}

export function parsearGaleriaFacial(json: string | null | undefined): EmbeddingGaleria | null {
  if (!json || json.trim() === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(json);
    if (
      parsed &&
      Array.isArray(parsed.master) &&
      parsed.master.length > 0 &&
      Array.isArray(parsed.gallery) &&
      parsed.gallery.length > 0
    ) {
      return {
        master: parsed.master,
        gallery: parsed.gallery,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function construirGaleriaDesdeCapturas(
  capturas: CapturaFacial[],
  poses: string[] = POSES_CAPTURA
): EmbeddingGaleria | null {
  const validas = capturas.filter((c) => c.embedding?.length > 0);
  if (validas.length === 0) {
    return null;
  }

  const gallery: EmbeddingGaleriaItem[] = validas.map((captura, indice) => ({
    pose: poses[indice] ?? `pose-${indice + 1}`,
    embedding: captura.embedding,
    score: captura.score ?? 0,
  }));

  const master = fusionarEmbeddingsMaestro(validas);
  if (!master) {
    return null;
  }

  return { master, gallery };
}

export function extraerVectoresGaleria(galeria: EmbeddingGaleria): number[][] {
  const vectores: number[][] = [];
  if (galeria.master?.length > 0) {
    vectores.push(galeria.master);
  }
  for (const item of galeria.gallery ?? []) {
    if (item?.embedding?.length > 0) {
      vectores.push(item.embedding);
    }
  }
  return vectores;
}

/** Misma fórmula que EmbeddingGaleriaService.calcularMaximaSimilitud en el backend. */
export function calcularMaximaSimilitudCoseno(consulta: number[], referencias: number[][]): number {
  if (!consulta?.length || !referencias?.length) {
    return 0;
  }
  let maxima = 0;
  for (const referencia of referencias) {
    const similitud = similitudCoseno(consulta, referencia);
    if (similitud > maxima) {
      maxima = similitud;
    }
  }
  return maxima;
}

function similitudCoseno(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length || v1.length === 0) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < v1.length; i++) {
    dot += v1[i] * v2[i];
    normA += v1[i] * v1[i];
    normB += v2[i] * v2[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function serializarGaleriaFacial(galeria: EmbeddingGaleria): string {
  return JSON.stringify(galeria);
}

export function promediarEmbeddingsConScore(frames: FrameCalidadFacial[]): number[] | null {
  const validas = frames.filter((f) => f.embedding?.length > 0 && f.score >= SCORE_MINIMO_DETECCION);
  if (validas.length === 0) {
    return null;
  }

  const dim = validas[0].embedding.length;
  const promedio = new Array(dim).fill(0);
  let pesoTotal = 0;

  for (const frame of validas) {
    const peso = frame.score;
    pesoTotal += peso;
    for (let i = 0; i < dim; i++) {
      promedio[i] += frame.embedding[i] * peso;
    }
  }

  for (let i = 0; i < dim; i++) {
    promedio[i] /= pesoTotal;
  }

  const magnitud = Math.sqrt(promedio.reduce((sum, val) => sum + val * val, 0));
  if (magnitud > 0) {
    for (let i = 0; i < dim; i++) {
      promedio[i] /= magnitud;
    }
  }

  return promedio;
}

export function scorePromedioFrames(frames: FrameCalidadFacial[]): number {
  if (!frames.length) {
    return 0;
  }
  const total = frames.reduce((sum, frame) => sum + frame.score, 0);
  return total / frames.length;
}

function fusionarEmbeddingsMaestro(
  capturas: Array<{ embedding: number[]; score: number }>,
  scoreMinimo = 0.5
): number[] | null {
  const validas = capturas.filter((c) => c.score >= scoreMinimo && c.embedding?.length > 0);
  if (validas.length === 0) {
    return null;
  }

  const dim = validas[0].embedding.length;
  const promedio = new Array(dim).fill(0);

  for (const captura of validas) {
    for (let i = 0; i < dim; i++) {
      promedio[i] += captura.embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    promedio[i] /= validas.length;
  }

  const magnitud = Math.sqrt(promedio.reduce((sum, val) => sum + val * val, 0));
  if (magnitud > 0) {
    for (let i = 0; i < dim; i++) {
      promedio[i] /= magnitud;
    }
  }

  return promedio;
}

// ─────────────────────────────────────────────────────────────────────────
//  Verificación 1:1 contra la galería propia
//
//  Portado del `ReconocimientoFacialHelperService` de `frc-mobile`. Vive acá
//  y no en un servicio porque no depende de nada: se prueba sin montar
//  Angular, que es lo que corresponde a una regla que decide si alguien
//  marca o no marca su entrada.
// ─────────────────────────────────────────────────────────────────────────

/** Mejor parecido del embedding contra cualquier pose de la galería. */
export function mejorSimilitudConGaleria(
  embedding: number[],
  galeria: EmbeddingGaleria,
): number {
  if (!embedding?.length || !galeria) {
    return 0;
  }
  return calcularMaximaSimilitudCoseno(embedding, extraerVectoresGaleria(galeria));
}

/** `true` si un frame suelto ya se parece lo suficiente. */
export function cumpleUmbralVerificacion(
  embedding: number[],
  galeria: EmbeddingGaleria,
  umbral = UMBRAL_SIMILITUD_VERIFICACION,
): boolean {
  return mejorSimilitudConGaleria(embedding, galeria) >= umbral;
}

/**
 * Decide si la tanda de frames alcanza para dar por verificada a la persona.
 *
 * ⚠️ **Son tres controles independientes, y los tres tienen que pasar.** No
 * es redundancia: cada uno tapa una forma distinta de colarse.
 *
 * 1. Al menos `FRAMES_MINIMOS_VERIFICACION` frames **nítidos y parecidos**.
 *    Un solo acierto puede ser casualidad o un reflejo.
 * 2. El embedding **promedio** —ponderado por calidad— también tiene que
 *    superar el umbral. Promediar frames buenos y malos puede dar un vector
 *    que no se parece a nadie.
 * 3. El **promedio de las similitudes** tiene que superarlo igual. Sin esto,
 *    dos frames excelentes compensarían varios apenas por encima del corte.
 *
 * Devuelve el embedding consolidado —el que se manda al central— o `null`.
 */
export function confirmarVerificacionFinal(
  frames: FrameCalidadFacial[],
  galeria: EmbeddingGaleria,
  umbralFrame = UMBRAL_SIMILITUD_FRAME_VERIFICACION,
  umbralFinal = UMBRAL_SIMILITUD_VERIFICACION,
): { embedding: number[]; score: number; similitud: number } | null {
  const validos = frames.filter(
    (f) =>
      f.embedding?.length > 0 &&
      f.score >= SCORE_MINIMO_FRAME_VERIFICACION &&
      (f.similitud == null || f.similitud >= umbralFrame),
  );
  if (validos.length < FRAMES_MINIMOS_VERIFICACION) {
    return null;
  }

  const embedding = promediarEmbeddingsConScore(validos);
  if (!embedding) {
    return null;
  }

  const similitudFinal = mejorSimilitudConGaleria(embedding, galeria);
  if (similitudFinal < umbralFinal) {
    return null;
  }

  const similitudPromedio =
    validos.reduce((suma, f) => suma + (f.similitud ?? 0), 0) / validos.length;
  if (similitudPromedio < umbralFrame) {
    return null;
  }

  return { embedding, score: scorePromedioFrames(validos), similitud: similitudFinal };
}
