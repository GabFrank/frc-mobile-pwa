import {
  EtapaTransferencia,
  MotivoModificacion,
  MotivoRechazo,
  Transferencia,
  TransferenciaItem,
  TransferenciaItemInput,
} from 'src/app/domains/transferencia/transferencia.model';
import { aIso } from 'src/app/shared/campos/fecha-py';

/**
 * Las reglas del avance de etapa, sin UI.
 *
 * Están acá y no en la pantalla porque son la parte del módulo que tiene
 * consecuencias: cada avance dispara movimientos de stock en el central, y
 * una condición mal copiada despacha mercadería que nadie preparó. Al vivir
 * en funciones puras se prueban sin montar el componente.
 *
 * Portado de `InfoTransferenciaComponent` de `frc-mobile`.
 */

/** Las tres etapas en las que se verifican los ítems uno por uno. */
export type EtapaVerificacion =
  | EtapaTransferencia.PREPARACION_MERCADERIA
  | EtapaTransferencia.TRANSPORTE_VERIFICACION
  | EtapaTransferencia.RECEPCION_EN_VERIFICACION;

/**
 * El sufijo de los campos por etapa.
 *
 * `TransferenciaItem` repite cada campo cuatro veces —`cantidadPreparacion`,
 * `cantidadTransporte`…— y el grupo que corresponde lo decide la etapa. Con
 * el sufijo se arma el nombre del campo en un solo lugar en vez de repetir
 * un `switch` de tres ramas en cada acción.
 */
type Sufijo = 'PreTransferencia' | 'Preparacion' | 'Transporte' | 'Recepcion';

/** Qué grupo de campos escribe cada etapa, y de cuál copia al confirmar. */
const CAMPOS: Record<EtapaVerificacion, { escribe: Sufijo; copiaDe: Sufijo }> = {
  [EtapaTransferencia.PREPARACION_MERCADERIA]: {
    escribe: 'Preparacion',
    copiaDe: 'PreTransferencia',
  },
  [EtapaTransferencia.TRANSPORTE_VERIFICACION]: {
    escribe: 'Transporte',
    copiaDe: 'Preparacion',
  },
  [EtapaTransferencia.RECEPCION_EN_VERIFICACION]: {
    escribe: 'Recepcion',
    copiaDe: 'Transporte',
  },
};

export const ETAPA_ETIQUETAS: Record<EtapaTransferencia, string> = {
  [EtapaTransferencia.PRE_TRANSFERENCIA_CREACION]: 'En creación',
  [EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN]: 'Pendiente en origen',
  [EtapaTransferencia.PREPARACION_MERCADERIA]: 'Preparando mercadería',
  [EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA]: 'Preparación concluida',
  [EtapaTransferencia.TRANSPORTE_VERIFICACION]: 'Verificando para transporte',
  [EtapaTransferencia.TRANSPORTE_EN_CAMINO]: 'En camino',
  [EtapaTransferencia.TRANSPORTE_EN_DESTINO]: 'Entregada en destino',
  [EtapaTransferencia.RECEPCION_EN_VERIFICACION]: 'Verificando recepción',
  [EtapaTransferencia.RECEPCION_CONCLUIDA]: 'Recepción concluida',
};

export const MOTIVO_RECHAZO_ETIQUETAS: Record<MotivoRechazo, string> = {
  [MotivoRechazo.FALTA_PRODUCTO]: 'Falta de producto',
  [MotivoRechazo.PRODUCTO_AVERIADO]: 'Producto averiado',
  [MotivoRechazo.PRODUCTO_EQUIVOCADO]: 'Producto equivocado',
  [MotivoRechazo.PRODUCTO_VENCIDO]: 'Producto vencido',
};

/**
 * El aviso que se muestra antes de avanzar, textual de `frc-mobile`.
 *
 * No es decorativo: dos de estos avisan que al aceptar se mueve stock, y esa
 * es la única advertencia que recibe el operador antes de que ocurra.
 */
export const AVISO_ETAPA: Record<EtapaTransferencia, string> = {
  [EtapaTransferencia.PRE_TRANSFERENCIA_CREACION]:
    'La transferencia vuelve a quedar en creación.',
  [EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN]:
    'Estás iniciando la etapa de preparación de productos, verificá con cuidado cada ítem.',
  [EtapaTransferencia.PREPARACION_MERCADERIA]:
    'Estás iniciando la etapa de preparación de productos, verificá con cuidado cada ítem.',
  [EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA]:
    'Estás culminando la etapa de preparación de productos, aguardando transporte.',
  [EtapaTransferencia.TRANSPORTE_VERIFICACION]:
    'Estás iniciando la etapa de verificación de productos para su transporte.',
  [EtapaTransferencia.TRANSPORTE_EN_CAMINO]:
    'Estás iniciando el transporte de la sucursal de origen a la de destino. Al aceptar, se da de baja el stock en origen.',
  [EtapaTransferencia.TRANSPORTE_EN_DESTINO]:
    'Estás culminando la entrega de productos en la sucursal de destino, aguardá su verificación.',
  [EtapaTransferencia.RECEPCION_EN_VERIFICACION]:
    'Estás iniciando la etapa de recepción de productos, verificá con cuidado cada ítem.',
  [EtapaTransferencia.RECEPCION_CONCLUIDA]:
    'Estás culminando la etapa de recepción. Al aceptar, la mercadería se carga en el stock de destino.',
};

/** El botón que avanza el workflow desde la etapa actual. */
export interface AccionEtapa {
  destino: EtapaTransferencia;
  texto: string;
  /**
   * `true` si hay que verificar todos los ítems antes de habilitarlo.
   *
   * Son las etapas que cierran una verificación: concluir con ítems sin
   * tocar despacharía cantidades que nadie miró.
   */
  exigeItemsVerificados: boolean;
  /**
   * `true` si antes hay que escanear el QR de la sucursal de destino.
   *
   * Solo al iniciar la recepción: es el control de que la mercadería se está
   * abriendo donde debía llegar.
   */
  exigeQrDeDestino: boolean;
}

/**
 * Qué avance corresponde desde la etapa actual, o `null` si no hay ninguno.
 *
 * ⚠️ **`TRANSPORTE_EN_DESTINO` avanza igual que `TRANSPORTE_EN_CAMINO`.** El
 * flujo real saltea esa etapa —el central la permite explícitamente— y la
 * lista de «llegan» muestra las dos. Contemplar solo `EN_CAMINO` deja
 * clavadas las transferencias que sí la registraron.
 *
 * ⚠️ **`PRE_TRANSFERENCIA_ORIGEN` solo avanza si nadie tomó la preparación.**
 * `usuarioPreparacion` es la marca de que otro ya la está preparando; el
 * botón desaparece para que dos depósitos no se pisen.
 */
export function accionDeEtapa(transferencia: Transferencia | null): AccionEtapa | null {
  if (!transferencia?.etapa) {
    return null;
  }
  switch (transferencia.etapa) {
    case EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN:
      if (transferencia.usuarioPreparacion?.id != null) {
        return null;
      }
      return accion(EtapaTransferencia.PREPARACION_MERCADERIA, 'Preparar productos');
    case EtapaTransferencia.PREPARACION_MERCADERIA:
      return accion(
        EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA,
        'Concluir preparación',
        { exigeItemsVerificados: true },
      );
    case EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA:
      return accion(EtapaTransferencia.TRANSPORTE_VERIFICACION, 'Verificar para transporte');
    case EtapaTransferencia.TRANSPORTE_VERIFICACION:
      return accion(EtapaTransferencia.TRANSPORTE_EN_CAMINO, 'Concluir y despachar', {
        exigeItemsVerificados: true,
      });
    case EtapaTransferencia.TRANSPORTE_EN_CAMINO:
    case EtapaTransferencia.TRANSPORTE_EN_DESTINO:
      return accion(EtapaTransferencia.RECEPCION_EN_VERIFICACION, 'Iniciar recepción', {
        exigeQrDeDestino: true,
      });
    case EtapaTransferencia.RECEPCION_EN_VERIFICACION:
      return accion(EtapaTransferencia.RECEPCION_CONCLUIDA, 'Concluir recepción', {
        exigeItemsVerificados: true,
      });
    default:
      // PRE_TRANSFERENCIA_CREACION se cierra con `finalizarTransferencia`, y
      // RECEPCION_CONCLUIDA es el final del recorrido.
      return null;
  }
}

function accion(
  destino: EtapaTransferencia,
  texto: string,
  extra: { exigeItemsVerificados?: boolean; exigeQrDeDestino?: boolean } = {},
): AccionEtapa {
  return {
    destino,
    texto,
    exigeItemsVerificados: extra.exigeItemsVerificados ?? false,
    exigeQrDeDestino: extra.exigeQrDeDestino ?? false,
  };
}

/** `true` si en esta etapa los ítems se verifican uno por uno. */
export function esEtapaDeVerificacion(
  etapa: EtapaTransferencia | undefined,
): etapa is EtapaVerificacion {
  return etapa != null && etapa in CAMPOS;
}

/**
 * El responsable de la etapa actual: el que puede tocar los ítems.
 *
 * Devuelve `undefined` en las etapas que no tienen uno asignado todavía.
 */
export function responsableDeEtapa(
  transferencia: Transferencia | null,
): Transferencia['usuarioPreparacion'] {
  switch (transferencia?.etapa) {
    case EtapaTransferencia.PRE_TRANSFERENCIA_CREACION:
    case EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN:
      return transferencia?.usuarioPreTransferencia;
    case EtapaTransferencia.PREPARACION_MERCADERIA:
    case EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA:
      return transferencia?.usuarioPreparacion;
    case EtapaTransferencia.TRANSPORTE_VERIFICACION:
    case EtapaTransferencia.TRANSPORTE_EN_CAMINO:
      return transferencia?.usuarioTransporte;
    case EtapaTransferencia.TRANSPORTE_EN_DESTINO:
    case EtapaTransferencia.RECEPCION_EN_VERIFICACION:
    case EtapaTransferencia.RECEPCION_CONCLUIDA:
      return transferencia?.usuarioRecepcion;
    default:
      return undefined;
  }
}

/**
 * `true` si el usuario puede tocar los ítems de esta etapa.
 *
 * La etapa la trabaja **quien la tomó**: el que aprieta «Preparar productos»
 * queda como `usuarioPreparacion` y es el único que confirma sus ítems.
 * Mientras nadie la tomó —responsable en blanco— está abierta a cualquiera.
 *
 * ⚠️ **Se recalcula en cada cambio de etapa.** En `frc-mobile` el flag se
 * prende y nunca se apaga, así que alcanzaba con haber sido responsable de
 * una etapa para poder editar las siguientes.
 */
export function puedeEditarEtapa(
  transferencia: Transferencia | null,
  usuarioId: number | null | undefined,
): boolean {
  const responsable = responsableDeEtapa(transferencia);
  if (responsable?.id == null) {
    return true;
  }
  return usuarioId != null && Number(responsable.id) === Number(usuarioId);
}

/**
 * `true` si el ítem ya se verificó en esta etapa.
 *
 * Basta con **cualquiera** de las tres marcas: la cantidad, el vencimiento o
 * el motivo de rechazo. Rechazar también es haber mirado el ítem — es lo que
 * distingue «no va» de «todavía no lo revisé».
 */
export function itemVerificado(item: TransferenciaItem, etapa: EtapaVerificacion): boolean {
  const s = CAMPOS[etapa].escribe;
  return (
    valor(item, `cantidad${s}`) != null ||
    valor(item, `vencimiento${s}`) != null ||
    valor(item, `motivoRechazo${s}`) != null
  );
}

/** Los ítems que faltan verificar en esta etapa. */
export function itemsSinVerificar(
  items: readonly TransferenciaItem[],
  etapa: EtapaTransferencia | undefined,
): TransferenciaItem[] {
  if (!esEtapaDeVerificacion(etapa)) {
    return [];
  }
  return items.filter((item) => !itemVerificado(item, etapa));
}

/** `true` si el ítem quedó rechazado en esta etapa. */
export function itemRechazado(
  item: TransferenciaItem,
  etapa: EtapaTransferencia | undefined,
): boolean {
  if (!esEtapaDeVerificacion(etapa)) {
    return false;
  }
  return valor(item, `motivoRechazo${CAMPOS[etapa].escribe}`) != null;
}

/** `true` si el ítem se modificó respecto de lo que declaraba la etapa anterior. */
export function itemModificado(
  item: TransferenciaItem,
  etapa: EtapaTransferencia | undefined,
): boolean {
  if (!esEtapaDeVerificacion(etapa)) {
    return false;
  }
  return valor(item, `motivoModificacion${CAMPOS[etapa].escribe}`) != null;
}

/** Lo que la etapa anterior dejó declarado: el valor por defecto de esta. */
export function declaradoEnEtapaAnterior(
  item: TransferenciaItem,
  etapa: EtapaVerificacion,
): { cantidad?: number; presentacionId?: number; porBulto?: number; vencimiento?: string } {
  const { escribe, copiaDe } = CAMPOS[etapa];
  // Lo ya cargado en esta etapa gana sobre lo heredado: al reabrir el diálogo
  // se ve lo que quedó guardado, no lo que se pidió originalmente.
  const presentacion =
    (valorObjeto(item, `presentacion${escribe}`) ?? valorObjeto(item, `presentacion${copiaDe}`)) ??
    undefined;
  return {
    cantidad:
      (valor(item, `cantidad${escribe}`) as number | undefined) ??
      (valor(item, `cantidad${copiaDe}`) as number | undefined),
    presentacionId: presentacion?.id,
    porBulto: presentacion?.cantidad,
    vencimiento:
      (valor(item, `vencimiento${escribe}`) as string | undefined) ??
      (valor(item, `vencimiento${copiaDe}`) as string | undefined),
  };
}

/** Lo que se escribe en el ítem al verificarlo en esta etapa. */
export interface VerificacionItem {
  cantidad?: number | null;
  presentacionId?: number | null;
  vencimiento?: string | null;
  motivoModificacion?: MotivoModificacion | null;
  motivoRechazo?: MotivoRechazo | null;
}

/**
 * Arma el input de `saveTransferenciaItem` para una etapa.
 *
 * ⚠️ **Siempre viaja una cantidad y una presentación para la etapa.** El
 * central multiplica `cantidad * presentacion.cantidad` para armar el
 * movimiento de stock, y con cualquiera de las dos en `null` responde un
 * error del servidor, no una validación. Si la verificación no las trae, se
 * heredan de la etapa anterior — que es lo que el avance de etapa ya había
 * copiado.
 *
 * ⚠️ **Solo se mandan los campos de la etapa en curso.** El save es un PATCH
 * y mandar de más pisa etapas anteriores, que es justo lo que el módulo
 * existe para conservar.
 */
export function inputDeVerificacion(
  item: TransferenciaItem,
  transferenciaId: number,
  etapa: EtapaVerificacion,
  cambios: VerificacionItem,
): TransferenciaItemInput {
  const sufijo = CAMPOS[etapa].escribe;
  const anterior = declaradoEnEtapaAnterior(item, etapa);

  const input: Record<string, unknown> = {
    id: item.id,
    transferenciaId,
  };
  input[`cantidad${sufijo}`] = cambios.cantidad ?? anterior.cantidad;
  input[`presentacion${sufijo}Id`] = cambios.presentacionId ?? anterior.presentacionId;

  const vencimiento = cambios.vencimiento ?? anterior.vencimiento;
  if (vencimiento != null) {
    input[`vencimiento${sufijo}`] = normalizarFecha(vencimiento);
  }
  if (cambios.motivoModificacion != null) {
    input[`motivoModificacion${sufijo}`] = cambios.motivoModificacion;
  }
  if (cambios.motivoRechazo != null) {
    input[`motivoRechazo${sufijo}`] = cambios.motivoRechazo;
  }

  return input as TransferenciaItemInput;
}

/**
 * `true` si hay que desconfirmar antes de guardar.
 *
 * El save del central es un PATCH: mandar `motivoRechazo: null` **no borra**
 * el motivo anterior. Así que para que confirmar un ítem antes rechazado
 * quede efectivamente confirmado, primero hay que vaciar la etapa con
 * `desconfirmarTransferenciaItem`.
 */
export function requiereDesconfirmarAntes(
  item: TransferenciaItem,
  etapa: EtapaVerificacion,
  cambios: VerificacionItem,
): boolean {
  const teniaMotivo = itemRechazado(item, etapa) || itemModificado(item, etapa);
  const quedaConMotivo = cambios.motivoRechazo != null || cambios.motivoModificacion != null;
  return teniaMotivo && !quedaConMotivo;
}

/**
 * Fecha lista para el input del central: `yyyy-MM-dd`.
 *
 * El vencimiento llega del central como `Date` de GraphQL —que Apollo
 * entrega como string ISO con hora— y el input lo espera como texto. Se
 * recorta acá y no con `toISOString()`, que corre el día en zonas al oeste
 * de UTC. Paraguay está en UTC−3 o −4: una fecha guardada así se guarda un
 * día antes.
 */
function normalizarFecha(valorFecha: string): string {
  const soloFecha = /^\d{4}-\d{2}-\d{2}/.exec(valorFecha);
  if (soloFecha) {
    return soloFecha[0];
  }
  const parseada = new Date(valorFecha);
  return Number.isNaN(parseada.getTime()) ? valorFecha : (aIso(parseada) ?? valorFecha);
}

function valor(item: TransferenciaItem, campo: string): unknown {
  return (item as unknown as Record<string, unknown>)[campo];
}

function valorObjeto(
  item: TransferenciaItem,
  campo: string,
): { id?: number; cantidad?: number } | undefined {
  return valor(item, campo) as { id?: number; cantidad?: number } | undefined;
}
