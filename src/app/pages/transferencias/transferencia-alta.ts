import type { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import type { Presentacion } from 'src/app/domains/productos/presentacion.model';
import {
  EtapaAsignacionLote,
  EtapaTransferencia,
  TipoTransferencia,
  Transferencia,
  TransferenciaEstado,
  TransferenciaInput,
  TransferenciaItem,
  TransferenciaItemInput,
  TransferenciaItemLote,
} from 'src/app/domains/transferencia/transferencia.model';

/**
 * Las reglas del alta y del borrador, sin UI.
 *
 * Viven acá por lo mismo que [`etapas.ts`](./etapas.ts): lo que se manda al
 * central en el alta decide qué queda registrado —y qué se pierde— en un
 * documento que después mueve mercadería. En funciones puras se prueban sin
 * montar la pantalla.
 */

/**
 * El input de una transferencia nueva.
 *
 * ⚠️ **Sin `id`.** El central preserva los campos ausentes solo cuando
 * reconoce una fila existente; con `id: null` explícito la intención queda
 * escrita al revés.
 *
 * ⚠️ **El responsable va en `usuarioPreTransferenciaId`.** Es el único campo
 * que `saveTransferencia` mira para asignarlo: el `usuarioId` genérico no lo
 * toca. `frc-mobile` no lo manda y sus borradores figuran sin responsable
 * hasta que alguien los finaliza.
 *
 * El tipo es siempre `MANUAL`: `AUTOMATICA` es la que genera el sistema por
 * reposición y `MIXTA` la que nace automática y se completa a mano; las dos
 * las arma el escritorio, no un operador con el teléfono.
 */
export function nuevaTransferenciaInput(datos: {
  sucursalOrigenId: number;
  sucursalDestinoId: number;
  usuarioId: number;
}): TransferenciaInput {
  return {
    sucursalOrigenId: datos.sucursalOrigenId,
    sucursalDestinoId: datos.sucursalDestinoId,
    estado: TransferenciaEstado.ABIERTA,
    tipo: TipoTransferencia.MANUAL,
    etapa: EtapaTransferencia.PRE_TRANSFERENCIA_CREACION,
    usuarioPreTransferenciaId: datos.usuarioId,
  };
}

/**
 * Las sucursales que quedan como destino.
 *
 * ⚠️ **La de origen se saca de la lista, no se valida después.** Una
 * transferencia de una sucursal a sí misma no mueve nada y el central la
 * acepta; `frc-mobile` la filtra igual, y avisar con un error después de
 * elegirla es peor que no ofrecerla.
 *
 * La comparación es por valor: el id que devuelve el selector llega como
 * texto.
 */
export function destinosPosibles(
  sucursales: Sucursal[],
  origenId: number | string | null | undefined,
): Sucursal[] {
  if (origenId == null || origenId === '') {
    return [];
  }
  return (sucursales ?? []).filter((s) => String(s.id) !== String(origenId));
}

/**
 * El ítem que se agrega al borrador.
 *
 * ⚠️ **Escribe solo el grupo `PreTransferencia`.** Las otras tres etapas son
 * la razón de ser del módulo: mandar sus campos acá —aunque fuera en cero—
 * borraría la diferencia entre «se pidió» y «todavía no llegó a esa etapa».
 * `frc-mobile` los manda todos en cero o en nulo; contra este central, que
 * trata el save como un PATCH, es ruido que puede pisar lo que no debe.
 *
 * ⚠️ **Un campo ausente significa «no lo toques».** Por eso el vencimiento y
 * la observación se omiten cuando están vacíos en vez de viajar en `null`:
 * mandar `null` no borra nada, y deja la pantalla mostrando algo que el
 * central no guardó.
 *
 * `usuarioId` lo completa `DatosService.guardar()` con el de la sesión; el
 * central lo exige porque la columna es `NOT NULL`.
 */
export function itemDePreTransferencia(datos: {
  /** Solo al editar un ítem ya cargado. */
  id?: number;
  transferenciaId: number;
  presentacionId: number;
  cantidad: number;
  /** `yyyy-MM-dd`. */
  vencimiento?: string | null;
  observacion?: string | null;
  /** El lote elegido a mano, o `null` si se decidió no usar ninguno. */
  lote?: { loteId: number } | null;
  /** El lote que el ítem tenía antes de esta edición, para saber si hay algo que borrar. */
  loteAnterior?: number | null;
}): TransferenciaItemInput {
  const vencimiento = datos.vencimiento?.trim() ?? '';
  const observacion = datos.observacion?.trim() ?? '';

  return {
    ...(datos.id != null ? { id: datos.id } : {}),
    transferenciaId: datos.transferenciaId,
    presentacionPreTransferenciaId: datos.presentacionId,
    cantidadPreTransferencia: datos.cantidad,
    ...(vencimiento ? { vencimientoPreTransferencia: vencimiento } : {}),
    ...(observacion ? { observacionPreTransferencia: observacion } : {}),
    ...asignacionDeLote(datos.lote, datos.cantidad, datos.loteAnterior),
    activo: true,
    poseeVencimiento: !!vencimiento,
  };
}

/**
 * La parte del input que dice de qué lote sale el ítem.
 *
 * ⚠️ **`lotesAsignados` tiene tres valores, no dos**, y confundirlos es el
 * error que este pedazo aísla:
 *
 * | Situación | Qué viaja | Qué hace el central |
 * |---|---|---|
 * | Se eligió un lote | `[{ loteId, cantidad }]` | reemplaza la asignación |
 * | Se sacó el lote que tenía | `[]` | borra y el ítem vuelve a FEFO |
 * | No hay lote ni lo hubo | **nada** | no toca la asignación |
 *
 * El tercer caso es el importante: mandar `[]` cuando no había nada que
 * borrar es ruido, y mandar `null` **no borra** —para el central un campo
 * ausente y uno en `null` son lo mismo: «no lo toques»—.
 *
 * ⚠️ **La cantidad va en presentaciones**, la misma unidad que
 * `cantidadPreTransferencia`. El central la convierte a unidades con la
 * presentación de la etapa; mandarla ya convertida sacaría del lote tantas
 * veces de más como unidades tenga la presentación.
 */
export function asignacionDeLote(
  lote: { loteId: number } | null | undefined,
  cantidad: number,
  loteAnterior?: number | null,
): Pick<TransferenciaItemInput, 'lotesAsignados' | 'etapaAsignacionLote'> {
  if (lote?.loteId != null) {
    return {
      lotesAsignados: [{ loteId: lote.loteId, cantidad }],
      etapaAsignacionLote: EtapaAsignacionLote.PRE_TRANSFERENCIA,
    };
  }
  if (loteAnterior != null) {
    return {
      lotesAsignados: [],
      etapaAsignacionLote: EtapaAsignacionLote.PRE_TRANSFERENCIA,
    };
  }
  return {};
}

/**
 * El lote que un ítem ya tiene asignado en la etapa de creación, si tiene.
 *
 * ⚠️ **Se filtra por etapa.** Un ítem puede llegar con la asignación de
 * `PREPARACION` hecha desde el escritorio, y esa no es la que edita esta
 * pantalla: mostrarla acá invitaría a pisar la decisión de quien preparó.
 */
export function loteDePreTransferencia(
  item: TransferenciaItem | null | undefined,
): TransferenciaItemLote | null {
  return (
    (item?.lotesAsignados ?? []).find(
      (l) => l.etapa === EtapaAsignacionLote.PRE_TRANSFERENCIA && l.loteId != null,
    ) ?? null
  );
}

/**
 * Cuántas unidades hay cargadas.
 *
 * ⚠️ **Cada renglón se convierte por su presentación antes de sumar.** «2
 * cajas + 3 unidades = 5» es un número que no existe en ningún depósito, y es
 * lo que sale de sumar las cantidades tal como se cargaron.
 */
export function unidadesDelBorrador(items: TransferenciaItem[]): number {
  return (items ?? []).reduce(
    (total, item) =>
      total +
      (item.cantidadPreTransferencia ?? 0) * (item.presentacionPreTransferencia?.cantidad ?? 1),
    0,
  );
}

/** `true` mientras la transferencia se está creando. */
export function esBorrador(transferencia: Transferencia | null | undefined): boolean {
  return transferencia?.etapa === EtapaTransferencia.PRE_TRANSFERENCIA_CREACION;
}

/**
 * Si se puede cerrar la creación.
 *
 * ⚠️ **Un borrador vacío no se finaliza.** El central no lo valida:
 * `finalizarTransferencia` solo mira que el estado sea `ABIERTA`, así que una
 * transferencia sin ítems queda pendiente en origen y alguien la va a abrir
 * para preparar lo que no hay.
 */
export function puedeFinalizar(
  transferencia: Transferencia | null | undefined,
  items: TransferenciaItem[],
): boolean {
  return (
    esBorrador(transferencia) &&
    transferencia?.estado === TransferenciaEstado.ABIERTA &&
    (items?.length ?? 0) > 0
  );
}

/**
 * Si lo cargado supera la existencia en origen.
 *
 * ⚠️ **Es un aviso, no un bloqueo.** Pedir más de lo que hay es un caso real
 * —se repone contra lo que va llegando— y el stock recién se descuenta al
 * despachar. Sin stock conocido no se avisa nada: «no pude consultarlo» y
 * «no hay» son respuestas distintas.
 */
export function excedeElStock(
  cantidad: number,
  presentacion: Presentacion | null | undefined,
  stock: number | null | undefined,
): boolean {
  if (stock == null || !(cantidad > 0)) {
    return false;
  }
  return cantidad * (presentacion?.cantidad ?? 1) > stock;
}
