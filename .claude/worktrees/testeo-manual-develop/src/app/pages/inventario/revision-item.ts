import type { InventarioProductoItem } from 'src/app/domains/inventario/inventario.model';

/**
 * Cómo quedó un ítem después de que alguien lo contó.
 *
 * ⚠️ **`verificado` y `revisado` no son «hecho» y «más hecho»**: son dos
 * resultados distintos del mismo paso. Quien cuenta marca `verificado`
 * cuando lo contado coincide con lo que decía el sistema, y `revisado`
 * cuando tuvo que corregirlo. Por eso nunca son las dos cosas a la vez, y
 * por eso el que corrige es el que le interesa al supervisor.
 */
export type EstadoRevision = 'exacta' | 'modificado' | 'sinEstado';

/** El orden que el central sabe aplicar. `null` deja el natural, por id. */
export type OrdenRevision = 'cantidadExacta' | 'modificado' | null;

/**
 * ⚠️ **`null` cuenta como `false`.** El central lo resuelve así en su
 * `ORDER BY` (`revisado = false OR revisado IS NULL`), y si acá se exigiera
 * `=== false` un ítem con la columna en `null` saldría primero en la lista
 * pero rotulado «sin estado» — el orden diría una cosa y el cartel otra.
 */
export function estadoDeRevision(item: InventarioProductoItem | null | undefined): EstadoRevision {
  if (!item) {
    return 'sinEstado';
  }
  const verificado = item.verificado === true;
  const revisado = item.revisado === true;

  if (verificado && !revisado) {
    return 'exacta';
  }
  if (revisado && !verificado) {
    return 'modificado';
  }
  return 'sinEstado';
}

const TEXTOS: Record<EstadoRevision, string> = {
  exacta: 'Cantidad exacta',
  modificado: 'Modificado',
  sinEstado: 'Sin revisar',
};

export function textoDeRevision(estado: EstadoRevision): string {
  return TEXTOS[estado];
}

/** Las dos marcas que lleva un ítem al guardarse un conteo. */
export interface MarcasDeConteo {
  verificado: boolean;
  revisado: boolean;
}

/**
 * Qué marcas le corresponden a un conteo recién cargado.
 *
 * ⚠️ **Las escribe quien cuenta, no un supervisor aparte.** Salen de
 * comparar lo contado contra lo que decía el sistema, que es lo que hace
 * `frc-mobile` al guardar el ítem. Son excluyentes por construcción: es la
 * misma regla que {@link estadoDeRevision} lee del otro lado.
 *
 * Regresión: la carga marcaba `verificado: true` fijo. Con eso, todo ítem
 * contado aparecía como «cantidad exacta» en la pantalla de revisión —
 * incluidos los que tenían diferencia, que son justo los que el supervisor
 * está buscando.
 */
export function marcasDeConteo(
  contado: number,
  sistema: number | null | undefined,
): MarcasDeConteo {
  const coincide = contado === (sistema ?? 0);
  return { verificado: coincide, revisado: !coincide };
}
