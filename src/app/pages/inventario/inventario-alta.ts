import {
  Inventario,
  InventarioEstado,
  InventarioInput,
  InventarioProducto,
  InventarioProductoItem,
  InventarioProductoItemInput,
  TipoInventario,
} from 'src/app/domains/inventario/inventario.model';
import type { Sector } from 'src/app/domains/sector/sector.model';
import { marcasDeConteo } from './revision-item';

/** Una zona que todavía se puede sumar a la toma. */
export interface ZonaDisponible {
  zonaId: number;
  /** La zona. */
  texto: string;
  /** El sector, que es como se la ubica en el salón. */
  detalle: string;
}

/**
 * El input de una toma nueva.
 *
 * ⚠️ **Sin `id`.** `saveInventario` decide si es alta con
 * `input.getId() == null`, y de eso depende que se dispare el aviso push de
 * «inventario iniciado». Mandar `id: null` explícito funciona hoy, pero deja
 * la intención escrita al revés.
 *
 * El tipo es siempre `ZONA`: toda la app —el detalle, la carga, la
 * revisión— cuenta por zona, y `frc-mobile` tampoco lo deja elegir. Un
 * inventario `ABC` o `CATEGORIA` define su alcance en el escritorio.
 */
export function nuevoInventarioInput(datos: {
  sucursalId: number;
  usuarioId: number;
}): InventarioInput {
  return {
    sucursalId: datos.sucursalId,
    usuarioId: datos.usuarioId,
    abierto: true,
    estado: InventarioEstado.ABIERTO,
    tipo: TipoInventario.ZONA,
  };
}

/**
 * Qué zonas se le pueden sumar a una toma.
 *
 * ⚠️ **Las ya agregadas se descuentan.** La unicidad de `inventario_producto`
 * es `(inventario_id, zona_id)`: ofrecer una repetida termina en un error del
 * central donde tenía que haber una lista más corta.
 *
 * Las inactivas tampoco se ofrecen — que es justamente para lo que existe el
 * toggle de *Activo*: sacar una zona de las tomas nuevas sin tocar el
 * histórico de las viejas.
 */
export function zonasDisponibles(
  sectores: Sector[],
  yaEnLaToma: InventarioProducto[],
): ZonaDisponible[] {
  const usadas = new Set(
    (yaEnLaToma ?? []).map((p) => p.zona?.id).filter((id): id is number => id != null),
  );

  return (sectores ?? []).flatMap((sector) =>
    (sector.zonaList ?? [])
      .filter((zona) => zona.id != null && zona.activo !== false && !usadas.has(zona.id))
      .map((zona) => ({
        zonaId: zona.id as number,
        texto: zona.descripcion ?? `Zona ${zona.id}`,
        detalle: sector.descripcion ?? '',
      })),
  );
}

/**
 * ⚠️ **Una sola zona abierta a la vez.** Es la regla de `frc-mobile`
 * (`verificarAbiertos`): dos zonas en curso desde el mismo teléfono mezclan
 * los conteos.
 *
 * `concluido` sin valor cuenta como abierta — el central deja la columna en
 * `null` hasta que alguien la concluye.
 */
export function hayZonaSinConcluir(zonas: InventarioProducto[]): boolean {
  return (zonas ?? []).some((z) => z.concluido !== true);
}

/**
 * Hace cuántos días se abrió una toma.
 *
 * ⚠️ **No usa `new Date(string)`.** El central manda `yyyy-MM-dd HH:mm` —con
 * espacio, no con la `T` de ISO—, que Chrome interpreta como hora local y
 * Safari como `Invalid Date`. Se parsea a mano, igual que `fechaLegible()`.
 *
 * `null` cuando no hay fecha, incluida la época Unix: el central serializa un
 * `Date` nulo como `1970-01-01 00:00`, y eso es una fecha ausente, no una
 * toma de hace 56 años.
 */
export function antiguedadEnDias(
  fechaInicio: string | undefined | null,
  ahora: Date,
): number | null {
  if (!fechaInicio) {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(fechaInicio);
  if (!m) {
    return null;
  }
  const [, anio, mes, dia, hora, minuto] = m;
  if (anio === '1970' && mes === '01' && dia === '01') {
    return null;
  }
  const inicio = new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia),
    Number(hora ?? 0),
    Number(minuto ?? 0),
  );
  const dias = Math.floor((ahora.getTime() - inicio.getTime()) / 86_400_000);
  return dias < 0 ? 0 : dias;
}

/** Un año y medio sin cerrarse: ya no es una toma en curso. */
const DIAS_ABANDONADA = 180;

/**
 * Qué decir cuando la sucursal ya tiene tomas abiertas.
 *
 * ⚠️ **Avisa, no bloquea.** La regla «una sola toma abierta por sucursal»
 * es real, pero nunca se aplicó: en la base de bodega, `SUC. CENTRAL` tiene
 * 24 en estado `ABIERTO`, la más vieja de mayo de 2023 y casi todas vacías.
 * Bloquear hasta cerrarlas deja el alta inutilizable, y empuja a
 * **finalizarlas** — que es la peor salida, porque finalizar aplica las
 * diferencias de aquella toma contra el stock de **hoy**.
 *
 * `frc-mobile` también avisa y sigue. La diferencia es que acá el aviso dice
 * **cuántas** son y qué antigüedad tienen: ver una sola hace pensar «la
 * cierro y sigo»; ver que son 24 dice que el problema es otro.
 */
export function avisoDeTomasAbiertas(abiertas: Inventario[], ahora: Date): string | null {
  const lista = abiertas ?? [];
  if (lista.length === 0) {
    return null;
  }

  if (lista.length === 1) {
    const [unica] = lista;
    return `Esta sucursal ya tiene la toma #${unica.id} abierta${sufijoAntiguedad(unica, ahora)}.`;
  }

  const masVieja = lista.reduce((peor, actual) =>
    (antiguedadEnDias(actual.fechaInicio, ahora) ?? 0) > (antiguedadEnDias(peor.fechaInicio, ahora) ?? 0)
      ? actual
      : peor,
  );
  return `Esta sucursal ya tiene ${lista.length} tomas abiertas. La más vieja es la #${masVieja.id}${sufijoAntiguedad(masVieja, ahora)}.`;
}

function sufijoAntiguedad(inventario: Inventario, ahora: Date): string {
  const dias = antiguedadEnDias(inventario.fechaInicio, ahora);
  if (dias == null || dias < DIAS_ABANDONADA) {
    return '';
  }
  return `, desde hace ${dias} días`;
}

/**
 * ⚠️ **La regla del renglón duplicado NO vive acá.**
 *
 * La aplica el central en `InventarioProductoItemService.save()`: un duplicado
 * es la misma zona, la misma presentación y el mismo vencimiento. Este archivo
 * tuvo su propia copia —`presentacionYaEnLaZona()`— y el resultado fue el
 * defecto que la copia existe para evitar: la app se cuidaba por
 * `(zona, presentación)` mientras el central validaba por
 * `(inventario, producto, vencimiento)`, así que agregar un producto que ya
 * estaba en **otra zona** pasaba el chequeo local y moría en el servidor con
 * un `IllegalStateException` en pantalla.
 *
 * El cliente muestra el mensaje que manda el central, que ya viene escrito
 * para el operador. Es el patrón del punto 11 de `PATRONES.md`.
 */

/**
 * El ítem que se crea al sumar un producto a la zona.
 *
 * ⚠️ **El stock del sistema va a `cantidadFisica`, no a `cantidad`.** Los
 * nombres engañan y esta es la trampa: `cantidad` es lo contado y es lo que
 * el central suma al finalizar. Ponerle el stock ahí haría que la toma se
 * cerrara sola, con cero diferencia, sin que nadie hubiera contado.
 *
 * Nace sin `verificado` ni `revisado`: son el resultado de contar, y todavía
 * no contó nadie. La excepción es el peso de un código de balanza, que **es**
 * el conteo — pesar, escanear la etiqueta y que la cantidad salga del código
 * es el flujo real de la balanza.
 */
export function nuevoItemInput(datos: {
  inventarioProductoId: number;
  presentacionId: number;
  stock: number | null | undefined;
  usuarioId: number;
  peso?: number;
}): InventarioProductoItemInput {
  const sistema = datos.stock ?? 0;
  const base: InventarioProductoItemInput = {
    inventarioProductoId: datos.inventarioProductoId,
    presentacionId: datos.presentacionId,
    cantidadFisica: sistema,
    cantidadAnterior: sistema,
    usuarioId: datos.usuarioId,
    verificado: false,
    revisado: false,
  };

  if (datos.peso == null) {
    return base;
  }
  return { ...base, cantidad: datos.peso, ...marcasDeConteo(datos.peso, sistema) };
}
