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
 * Si esa presentación ya está contada en la zona.
 *
 * ⚠️ **La clave real es `(inventario_producto, presentacion)`**, no el
 * producto: «unidad» y «caja x12» son dos ítems legítimos del mismo
 * producto. Pero dos renglones de la **misma** presentación dan un conteo
 * sumado que no corresponde a nada — el central los suma a los dos al
 * finalizar.
 *
 * Los ids se comparan como texto porque GraphQL los devuelve a veces como
 * número y a veces como string.
 */
export function presentacionYaEnLaZona(
  items: InventarioProductoItem[] | undefined | null,
  presentacionId: number,
): boolean {
  return (items ?? []).some(
    (item) => String(item.presentacion?.id ?? '') === String(presentacionId),
  );
}

/** Por qué no se puede sumar esta presentación a la toma. */
export interface RechazoAlta {
  /** Para el test: asegura que se rechazó **por la razón correcta**. */
  motivo: 'presentacion-repetida' | 'producto-sin-vencimiento';
  /** Para la pantalla. */
  mensaje: string;
}

/**
 * Un ítem sin fecha de vencimiento.
 *
 * La época Unix cuenta como ausente: el central serializa un `Date` nulo
 * como `1970-01-01 00:00`, así que en la base ese ítem **no tiene** fecha y
 * va a chocar igual que uno en blanco.
 */
function sinVencimiento(item: InventarioProductoItem): boolean {
  const texto = String(item.vencimiento ?? '').trim();
  return texto === '' || texto.startsWith('1970-01-01');
}

/**
 * Si el alta va a ser rechazada, y por qué.
 *
 * ⚠️ **La unicidad que aplica el central es `(inventario, producto,
 * vencimiento)`**, no `(zona, presentación)` como este archivo asumía.
 * `InventarioProductoItemService.save()` busca por
 * `findByInventarioIdAndProductoId` —que une hasta `inventario`, sin mirar la
 * zona— y compara con `Objects.equals(item.getVencimiento(), ...)`.
 *
 * De ahí salen las tres diferencias que costaron el bug:
 *
 * 1. **El alcance es toda la toma.** Un producto contado en «gondola 1»
 *    bloquea agregarlo en «gondola 2».
 * 2. **La clave es el producto**, no la presentación. «Unidad» y «caja x12»
 *    son el mismo producto para esta regla.
 * 3. **Dos nulos son iguales.** Y `nuevoItemInput()` no manda vencimiento, así
 *    que todo ítem recién agregado nace en colisión con cualquier otro ítem
 *    de su producto que tampoco tenga fecha.
 *
 * Lo que **no** se hace es bloquear cuando el que ya está tiene fecha: ahí las
 * dos no son iguales y el central lo acepta. Inventar la restricción de más
 * dejaría sin poder cargar «caja x12» de un producto ya contado, que es un
 * caso legítimo.
 *
 * Regresión: sin esta función el alta llegaba al central y volvía como un
 * `IllegalStateException` crudo, con el texto de Java en pantalla y sin
 * decirle al operador en qué zona estaba el producto que chocaba.
 */
export function rechazoAlAgregar(datos: {
  /** Todas las zonas de la toma, no solo la que se está contando. */
  zonas: InventarioProducto[] | undefined | null;
  /** El `InventarioProducto` de la zona actual. */
  inventarioProductoId: number;
  productoId: number;
  presentacionId: number;
}): RechazoAlta | null {
  const zonas = datos.zonas ?? [];
  const esLaZonaActual = (z: InventarioProducto) =>
    String(z.id ?? '') === String(datos.inventarioProductoId);

  const enLaZona = zonas.find(esLaZonaActual)?.inventarioProductoItemList ?? [];
  if (presentacionYaEnLaZona(enLaZona, datos.presentacionId)) {
    // Regla de la app, no del central: dos renglones de la misma presentación
    // se suman los dos al finalizar y el conteo sale doble.
    return {
      motivo: 'presentacion-repetida',
      mensaje: 'Esa presentación ya está en esta zona.',
    };
  }

  for (const zona of zonas) {
    for (const item of zona.inventarioProductoItemList ?? []) {
      // Los ids se comparan como texto porque GraphQL los devuelve a veces
      // como número y a veces como string.
      const mismoProducto =
        String(item.presentacion?.producto?.id ?? '') === String(datos.productoId);
      if (!mismoProducto || !sinVencimiento(item)) {
        continue;
      }
      const donde = zona.zona?.descripcion?.trim();
      return {
        motivo: 'producto-sin-vencimiento',
        mensaje: esLaZonaActual(zona)
          ? 'Ese producto ya está en esta zona sin vencimiento cargado. Cargale la fecha antes de sumar otra presentación.'
          : `Ese producto ya está en esta toma, en «${donde || 'otra zona'}», sin vencimiento cargado. Contalo ahí, o cargale la fecha antes de agregarlo de nuevo.`,
      };
    }
  }

  return null;
}

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

/**
 * Qué mostrar si el central rechaza el alta igual.
 *
 * `rechazoAlAgregar()` cubre lo que la app puede ver, pero no todo: otro
 * teléfono puede haber agregado el producto entre la consulta y el guardado.
 * Cuando eso pasa, lo que llegaba a pantalla era el texto de un
 * `IllegalStateException` — correcto para un log, inútil frente a la góndola.
 */
export function mensajeDeErrorAlAgregar(error: string): string {
  return (error ?? '').includes('ya fue registrado en este inventario')
    ? 'Ese producto ya está en esta toma con el mismo vencimiento. Buscalo en las zonas de la toma y contalo ahí.'
    : error;
}
