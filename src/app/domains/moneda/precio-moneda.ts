import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { esMonedaEmpresa } from 'src/app/pages/operaciones/recepcion/recepcion-moneda';
import { esGuarani, type MonedaReferencia } from 'src/app/generic/utils/moneda.util';

/**
 * Precios en otra moneda: la lógica que no depende de pantallas.
 *
 * Contrato con el central: `PrecioPorSucursal.moneda` `null` = la moneda de
 * la empresa. `PrecioPorSucursalInput.monedaId` `null` en un precio nuevo =
 * la del módulo PRECIOS; en una edición = conserva la guardada.
 */

/** Prefijo con el que el central rechaza guardar en otra moneda sin escritorio nuevo. */
export const PREFIJO_VERSION_MINIMA = 'VERSION_MINIMA:';

/** Las monedas de los precios que están en otra moneda, por id de precio (como texto). */
export function monedasPorPrecio(
  filas: readonly { precioId: number | string; moneda?: (Omit<Partial<Moneda>, 'id'> & { id?: number | string }) | null }[] | null | undefined,
): Map<string, Moneda> {
  const mapa = new Map<string, Moneda>();
  for (const fila of filas ?? []) {
    if (fila?.precioId != null && fila.moneda?.id != null) {
      const id = Number(fila.moneda.id);
      mapa.set(String(fila.precioId), Object.assign(new Moneda(), fila.moneda, { id: Number.isFinite(id) ? id : undefined }));
    }
  }
  return mapa;
}

function mismaMoneda(a: Moneda | null | undefined, b: Moneda | null | undefined): boolean {
  return a?.id != null && b?.id != null && String(a.id) === String(b.id);
}

/**
 * Qué `monedaId` mandar en `savePrecioPorSucursal`, o `undefined` para no
 * mandar la clave.
 *
 * ⚠️ **Omitir la clave, no mandar `null`**: un central que no conoce
 * `monedaId` rechaza el input entero. Por eso, con todo en la moneda de la
 * empresa, el input sale idéntico al de siempre.
 *
 * - `soportado` false (la lectura de monedas falló: central viejo) → nunca.
 * - Edición de un precio con moneda guardada → esa misma.
 * - Precio nuevo: la elegida si no es la de la empresa; y también si es la
 *   de la empresa pero el default del módulo es otra (omitirla la dejaría
 *   en esa otra moneda sin que la persona lo haya pedido).
 */
export function monedaIdParaGuardar(datos: {
  soportado: boolean;
  empresa: Moneda | null | undefined;
  /** La moneda que el precio ya tiene guardada (edición). */
  guardada?: Moneda | null;
  /** La que la persona eligió para un precio nuevo. */
  elegida?: Moneda | null;
  /** La del módulo PRECIOS: lo que el central usa si no llega `monedaId`. */
  porDefecto?: Moneda | null;
}): number | undefined {
  if (!datos.soportado) {
    return undefined;
  }
  if (datos.guardada?.id != null) {
    return Number(datos.guardada.id);
  }
  const { elegida, porDefecto, empresa } = datos;
  if (elegida?.id == null) {
    return undefined;
  }
  if (!esMonedaEmpresa(elegida, empresa)) {
    return Number(elegida.id);
  }
  if (porDefecto && !esMonedaEmpresa(porDefecto, empresa)) {
    return Number(elegida.id);
  }
  return undefined;
}

/**
 * ¿Se ofrece elegir la moneda de un precio nuevo?
 *
 * Solo si la empresa ya trabaja precios en otra moneda: el módulo PRECIOS
 * está en una que no es la de la empresa, o ya hay algún precio en otra
 * moneda. Si no, el selector no aparece y la pantalla es la de siempre
 * (bodega).
 */
export function debeMostrarSelectorMoneda(datos: {
  soportado: boolean;
  /** Cuántas monedas activas hay para elegir. */
  cantidadElegibles: number;
  empresa: Moneda | null | undefined;
  porDefecto: Moneda | null | undefined;
  /** Cuántos precios están en otra moneda que la de la empresa. */
  preciosEnOtraMoneda: number;
}): boolean {
  if (!datos.soportado || datos.cantidadElegibles <= 1) {
    return false;
  }
  const defectoOtra = datos.porDefecto != null && !esMonedaEmpresa(datos.porDefecto, datos.empresa);
  return defectoOtra || datos.preciosEnOtraMoneda > 0;
}

/**
 * Cómo se muestra el importe de un precio: la moneda y el símbolo.
 *
 * Sin moneda propia (o con la de la empresa si es guaraní) sale lo de
 * siempre, `Guaraní` / `₲`: bodega ve exactamente lo mismo que antes.
 */
export function referenciaDePrecio(
  moneda: Moneda | null | undefined,
  empresa: Moneda | null | undefined,
): { moneda: MonedaReferencia; simbolo: string } {
  const efectiva = moneda ?? empresa ?? null;
  if (efectiva == null || esGuarani(efectiva)) {
    return { moneda: 'Guaraní', simbolo: '₲' };
  }
  return { moneda: efectiva, simbolo: efectiva.simbolo ?? '' };
}

/**
 * La moneda de cada precio de un producto, activos e inactivos (#137): por id
 * de precio (texto). Valor `null` = la moneda de la empresa (el precio no
 * tiene moneda propia). Un id que **no está** en el mapa no se sabe: no es lo
 * mismo que `null`.
 */
export function monedasDePreciosDeProducto(
  producto:
    | {
        presentaciones?:
          | { precios?: { id?: number | string; moneda?: unknown }[] | null }[]
          | null;
      }
    | null
    | undefined,
): Map<string, Moneda | null> {
  const mapa = new Map<string, Moneda | null>();
  for (const presentacion of producto?.presentaciones ?? []) {
    for (const precio of presentacion?.precios ?? []) {
      if (precio?.id == null) continue;
      const m = precio.moneda as (Omit<Partial<Moneda>, 'id'> & { id?: number | string }) | null | undefined;
      if (m?.id == null) {
        mapa.set(String(precio.id), null);
      } else {
        const id = Number(m.id);
        mapa.set(String(precio.id), Object.assign(new Moneda(), m, { id: Number.isFinite(id) ? id : undefined }));
      }
    }
  }
  return mapa;
}

/** `true` si el central rechazó guardar porque el escritorio mínimo no soporta precios en moneda. */
export function esErrorVersionMinima(mensaje: string | null | undefined): boolean {
  return (mensaje ?? '').trim().startsWith(PREFIJO_VERSION_MINIMA);
}

/** El texto del rechazo, sin el prefijo técnico, listo para mostrar. */
export function textoVersionMinima(mensaje: string): string {
  const detalle = mensaje.trim().slice(PREFIJO_VERSION_MINIMA.length).trim();
  return (
    'No se puede guardar el precio en esa moneda todavía.' + (detalle ? ' ' + detalle : '')
  );
}

/** Los importes de las presentaciones, agrupados por la moneda en que están. */
export interface GrupoOrigen {
  /** `null` = la moneda de la empresa. */
  monedaOrigenId: number | null;
  /** Posición de cada importe en la lista original. */
  indices: number[];
  montos: (number | null)[];
}

export function agruparPorOrigen(
  items: readonly { monto: number | null; moneda: Moneda | null | undefined }[],
  empresa: Moneda | null | undefined,
): GrupoOrigen[] {
  const grupos = new Map<number | null, GrupoOrigen>();
  items.forEach((item, i) => {
    // Una moneda igual a la de la empresa es la de siempre: sin origen.
    const origen =
      item.moneda?.id != null && !esMonedaEmpresa(item.moneda, empresa) ? Number(item.moneda.id) : null;
    let grupo = grupos.get(origen);
    if (!grupo) {
      grupo = { monedaOrigenId: origen, indices: [], montos: [] };
      grupos.set(origen, grupo);
    }
    grupo.indices.push(i);
    grupo.montos.push(item.monto);
  });
  return [...grupos.values()];
}

export { mismaMoneda };
