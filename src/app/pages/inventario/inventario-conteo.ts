import {
  InventarioProducto,
  InventarioProductoItem,
} from 'src/app/domains/inventario/inventario.model';

/** Cómo va el conteo de una zona o de todo el inventario. */
export interface ResumenConteo {
  /** Ítems con cantidad contada. */
  contados: number;
  /**
   * Ítems que nadie contó.
   *
   * ⚠️ **Al finalizar no se les toca el stock**, y por eso hay que decirlo
   * antes: el central los saltea. Tomarlos como cero le llevaría el stock a
   * cero a un producto que nadie miró.
   */
  sinContar: number;
  /** De esos, los que quedaron marcados como corregidos por un supervisor. */
  revisados: number;
  /** Suma de las diferencias contado − sistema. */
  diferencia: number;
  /** Ítems donde lo contado no coincide con el sistema. */
  conDiferencia: number;
}

/**
 * Diferencia de un ítem: **lo contado menos lo que dice el sistema**.
 *
 * Positivo es sobrante, negativo es faltante. `null` si todavía no se contó
 * — que no es lo mismo que una diferencia de cero.
 *
 * ⚠️ **Los nombres de los campos están al revés de lo que sugieren.** Lo
 * contado va en `cantidad`; el stock del sistema, en `cantidadFisica`. No es
 * una interpretación: `InventarioGraphQL.finalizarInventarioEnSucursal()`
 * suma `ipi.getCantidad() * presentacion.getCantidad()` y le resta el saldo
 * de `movimiento_stock`, así que `cantidad` **es** el conteo para el central.
 * `frc-mobile` coincide: el campo del diálogo de conteo escribe `cantidad`, y
 * `cantidadFisica`/`cantidadAnterior` guardan el stock al crear el ítem.
 *
 * Leerlo al derecho —como hacía esta función— dejaba el conteo cargado desde
 * la PWA fuera del cálculo de finalización: el central ajustaba el stock
 * contra un número que nadie contó.
 */
export function diferenciaDe(item: InventarioProductoItem): number | null {
  if (item.cantidad == null) {
    return null;
  }
  return item.cantidad - (item.cantidadFisica ?? 0);
}

/**
 * Contado es tener `cantidad`; cero cuenta, `null` no.
 *
 * Un ítem recién sumado a la toma llega con `cantidadFisica` cargada —el
 * stock del sistema— y `cantidad` vacía: trae el número del sistema, pero
 * nadie fue a la góndola todavía.
 *
 * ⚠️ **No hay forma de saber si un ítem se arrastró de una toma anterior.**
 * `frc-mobile` lo marca con `copiedFromItemId`, pero es una marca de memoria
 * de su diálogo de edición: nunca se manda al central, que no tiene dónde
 * guardarla. Pedirla hacía que rechazara la consulta entera.
 */
export function fueContadoEnEstaToma(item: InventarioProductoItem): boolean {
  return item.cantidad != null;
}

/** Cuántos renglones sin contar se nombran antes de resumir el resto. */
const NOMBRES_EN_EL_AVISO = 3;

/**
 * Por qué **no** se puede dar la zona por contada. `null` si se puede.
 *
 * Una zona concluida afirma «acá ya se contó todo», y esa afirmación tiene
 * consecuencia real: al finalizar, el central **saltea** los ítems sin contar,
 * así que ese producto no se ajusta y nadie se entera. Concluir con un renglón
 * vacío es firmar un conteo que no ocurrió.
 *
 * ⚠️ **Contar cero SÍ deja concluir.** El cero dice «no hay nada en la góndola»
 * y ajusta el stock; el vacío dice «nadie fue a mirar». Es la misma distinción
 * que hace {@link fueContadoEnEstaToma} y la que aplica el central.
 *
 * ⚠️ **El renglón sin lote se nombra aparte.** Su campo *Contado* está
 * bloqueado —no se puede contar sin lote— así que decirle al operador que
 * escriba una cantidad lo manda a hacer algo que la pantalla no le permite. Lo
 * que le falta es elegir el lote, y eso es lo que hay que decirle.
 *
 * El texto sale armado para mostrarse tal cual: la pantalla no interpreta.
 */
export function motivoNoConcluir(items: InventarioProductoItem[] | undefined | null): string | null {
  const sinContar = (items ?? []).filter((item) => !fueContadoEnEstaToma(item));
  if (sinContar.length === 0) {
    return null;
  }

  const sinLote = sinContar.filter(
    (item) => item.presentacion?.producto?.lote === true && item.lote?.id == null,
  );
  // Si TODOS los que faltan son por falta de lote, el reclamo es ese y no
  // «contalos»: son dos acciones distintas.
  const porLote = sinLote.length === sinContar.length;

  const nombres = sinContar
    .slice(0, NOMBRES_EN_EL_AVISO)
    .map((item) => item.presentacion?.producto?.descripcion ?? 'un producto')
    .join(', ');
  const resto = sinContar.length - Math.min(sinContar.length, NOMBRES_EN_EL_AVISO);
  const lista = resto > 0 ? `${nombres} y ${resto} más` : nombres;

  const cuantos = sinContar.length === 1 ? '1 producto' : `${sinContar.length} productos`;

  if (porLote) {
    return sinContar.length === 1
      ? `Falta elegir el lote de ${lista}. Sin lote no se puede contar.`
      : `Faltan ${cuantos} sin lote: ${lista}. Sin lote no se pueden contar.`;
  }

  return sinContar.length === 1
    ? `Queda ${cuantos} sin contar: ${lista}. Si no hay nada en la góndola, cargá 0.`
    : `Quedan ${cuantos} sin contar: ${lista}. Si no hay nada en la góndola, cargá 0.`;
}

/**
 * Por qué **no** se puede finalizar la toma. `null` si se puede.
 *
 * Finalizar **ajusta el stock**: el central escribe los movimientos que llevan
 * la existencia de hoy a lo contado. Con una zona todavía abierta eso es
 * ajustar contra un conteo a medio hacer, y **no hay vuelta atrás** — reabrir
 * la toma no deshace los ajustes ya escritos.
 *
 * ⚠️ **Una toma sin zonas no se traba.** No hay ninguna zona abierta que
 * concluir; frenarla la dejaría sin forma de cerrarse desde el teléfono.
 *
 * El texto sale armado para mostrarse tal cual.
 */
export function motivoNoFinalizar(zonas: InventarioProducto[] | undefined | null): string | null {
  const abiertas = (zonas ?? []).filter((z) => z.concluido !== true);
  if (abiertas.length === 0) {
    return null;
  }

  const nombres = abiertas
    .slice(0, NOMBRES_EN_EL_AVISO)
    .map((z) => z.zona?.descripcion ?? 'una zona')
    .join(', ');
  const resto = abiertas.length - Math.min(abiertas.length, NOMBRES_EN_EL_AVISO);
  const lista = resto > 0 ? `${nombres} y ${resto} más` : nombres;

  return abiertas.length === 1
    ? `Falta concluir 1 zona: ${lista}. Finalizar ajusta el stock y no se puede deshacer.`
    : `Faltan concluir ${abiertas.length} zonas: ${lista}. Finalizar ajusta el stock y no se puede deshacer.`;
}

/** Resume una lista de ítems. */
export function resumirItems(items: InventarioProductoItem[]): ResumenConteo {
  const resumen: ResumenConteo = {
    contados: 0,
    sinContar: 0,
    revisados: 0,
    diferencia: 0,
    conDiferencia: 0,
  };

  for (const item of items ?? []) {
    if (!fueContadoEnEstaToma(item)) {
      resumen.sinContar += 1;
      continue;
    }
    resumen.contados += 1;
    if (item.revisado) {
      resumen.revisados += 1;
    }
    const dif = diferenciaDe(item) ?? 0;
    if (dif !== 0) {
      resumen.conDiferencia += 1;
      resumen.diferencia += dif;
    }
  }

  return resumen;
}

/** Ídem sobre todas las zonas del inventario. */
export function resumirInventario(productos: InventarioProducto[]): ResumenConteo {
  const todos = (productos ?? []).flatMap((p) => p.inventarioProductoItemList ?? []);
  return resumirItems(todos);
}

/** Cuántas zonas quedaron marcadas como concluidas. */
export function productosConcluidos(productos: InventarioProducto[]): number {
  return (productos ?? []).filter((p) => p.concluido).length;
}
