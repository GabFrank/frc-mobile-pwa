import type {
  FuenteVerdadVencimiento,
  ProductoVencido,
} from 'src/app/domains/productos/producto-vencido.model';

/** El vencimiento que la app propone para una presentación. */
export interface SugerenciaVencimiento {
  /** `yyyy-MM-dd`, listo para un input de tipo date. */
  fecha: string;
  /** La fecha ya pasó: hay mercadería caduca en esa zona. */
  vencido: boolean;
  fuente?: FuenteVerdadVencimiento;
  /** Texto ya armado por el central: «Nota de compra #123 (15/03/2026)». */
  detalle?: string;
}

const NOMBRE_FUENTE: Record<FuenteVerdadVencimiento, string> = {
  INVENTARIO: 'el último inventario',
  COMPRA: 'una compra',
  TRANSFERENCIA: 'una transferencia',
};

/**
 * Qué vencimiento proponer para una presentación.
 *
 * ⚠️ **La elección de la fuente no se hace acá.** `productosVencidos` del
 * central ya unifica inventario, compra y transferencia y se queda con una
 * fila por presentación y fecha, con esta regla:
 *
 * ```sql
 * CASE WHEN fuente_verdad <> 'INVENTARIO' AND fecha_fuente > ultimo_inventario
 *      THEN 0 ELSE 1 END, fecha_fuente DESC
 * ```
 *
 * Es decir: gana una compra o transferencia **posterior** al último
 * inventario; si no, la fuente más reciente. Repetir ese criterio en el
 * cliente sería tenerlo escrito en dos lugares que se van a desincronizar.
 *
 * Lo único que se decide acá es **cuál de las fechas que sobrevivieron** va
 * al campo: la más próxima a vencer que todavía no venció. Es la que le
 * importa a quien está frente a la góndola.
 *
 * Si todas ya vencieron devuelve la más próxima igual, con `vencido` en
 * `true`: hay mercadería caduca y el conteo tiene que poder registrarla. Lo
 * que no se hace es prellenar una fecha pasada sin decirlo.
 */
export function vencimientoSugerido(
  filas: ProductoVencido[] | undefined | null,
  presentacionId: number,
  hoy: Date,
  /**
   * Fechas que **otro renglón de la misma presentación** ya se llevó.
   *
   * ⚠️ Dos renglones de una presentación son **dos lotes**, y dos lotes no
   * comparten fecha. Sin esto, todos los renglones recibían la misma
   * sugerencia —la función mira solo el `presentacionId`—, así que cargarle
   * el vencimiento a uno terminaba escribiendo el mismo en el otro al
   * guardar. El operador lo ve como «le puse la fecha a uno y me la puso en
   * los dos», y el central lo rechaza por renglón duplicado.
   */
  excluir?: ReadonlySet<string>,
): SugerenciaVencimiento | null {
  const candidatas = (filas ?? [])
    .filter((f) => String(f.presentacionId ?? '') === String(presentacionId))
    .map((f) => ({ fila: f, fecha: soloFecha(f.vencimiento) }))
    .filter((c): c is { fila: ProductoVencido; fecha: string } => c.fecha !== null)
    .filter((c) => !excluir?.has(c.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (candidatas.length === 0) {
    return null;
  }

  const corte = soloFecha(hoy.toISOString()) as string;
  // Lo que vence hoy todavía no venció: la mercadería está en góndola y se
  // puede vender durante el día.
  const vigente = candidatas.find((c) => c.fecha >= corte);
  const elegida = vigente ?? candidatas[candidatas.length - 1];

  return {
    fecha: elegida.fecha,
    vencido: vigente == null,
    fuente: elegida.fila.fuenteVerdad,
    detalle: elegida.fila.detalleFuente,
  };
}

/**
 * De dónde viene la fecha, a secas: «Nota de compra #123», «una compra».
 *
 * ⚠️ **No hay texto de «Sugerido de…», y es una decisión.** El campo ya no se
 * prellena: lo conocido se ofrece abajo, con la fecha escrita al lado y un
 * botón para adoptarlo. Ahí «Sugerido de» nombraría la fecha dos veces.
 */
export function origenDeSugerencia(sugerencia: SugerenciaVencimiento): string {
  return (
    sugerencia.detalle?.trim() ||
    (sugerencia.fuente ? NOMBRE_FUENTE[sugerencia.fuente] : 'un registro anterior')
  );
}

/**
 * ⚠️ **No usa `new Date(string)`.** El central manda `yyyy-MM-dd HH:mm` —con
 * espacio, no con la `T` de ISO—, que Safari lee como `Invalid Date`. Se
 * recorta el texto, que además es lo que necesita un input de tipo date.
 *
 * La época Unix es cómo llega una fecha ausente, no un vencimiento de 1970.
 */
function soloFecha(valor: string | undefined | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
  if (!m) {
    return null;
  }
  const fecha = `${m[1]}-${m[2]}-${m[3]}`;
  return fecha === '1970-01-01' ? null : fecha;
}
