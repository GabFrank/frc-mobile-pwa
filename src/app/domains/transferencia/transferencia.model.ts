import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { EstadoLote } from 'src/app/domains/lote/lote.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';

/**
 * Estado macro de la transferencia.
 *
 * ⚠️ **`CONLCUIDA` está mal escrito y así viaja al backend.** No se corrige
 * del lado del cliente: el string tiene que coincidir con el del central.
 */
export enum TransferenciaEstado {
  /** Se está creando. */
  ABIERTA = 'ABIERTA',
  /** Creada, todavía en el depósito de origen. */
  EN_ORIGEN = 'EN_ORIGEN',
  /** En camino. */
  EN_TRANSITO = 'EN_TRANSITO',
  /** Llegó al destino y está en verificación. */
  EN_DESTINO = 'EN_DESTINO',
  FALTA_REVISION_EN_ORIGEN = 'FALTA_REVISION_EN_ORIGEN',
  FALTA_REVISION_EN_DESTINO = 'FALTA_REVISION_EN_DESTINO',
  CONLCUIDA = 'CONLCUIDA',
  CANCELADA = 'CANCELADA',
}

/**
 * Paso fino del workflow.
 *
 * ⚠️ **`estado` y `etapa` son dos dimensiones distintas.** Una transferencia
 * `EN_TRANSITO` puede estar en `TRANSPORTE_EN_CAMINO` o en
 * `TRANSPORTE_EN_DESTINO`. Filtrar por una cuando la pantalla usa la otra
 * devuelve listas vacías **sin error**.
 */
export enum EtapaTransferencia {
  PRE_TRANSFERENCIA_CREACION = 'PRE_TRANSFERENCIA_CREACION',
  PRE_TRANSFERENCIA_ORIGEN = 'PRE_TRANSFERENCIA_ORIGEN',
  PREPARACION_MERCADERIA = 'PREPARACION_MERCADERIA',
  PREPARACION_MERCADERIA_CONCLUIDA = 'PREPARACION_MERCADERIA_CONCLUIDA',
  TRANSPORTE_VERIFICACION = 'TRANSPORTE_VERIFICACION',
  TRANSPORTE_EN_CAMINO = 'TRANSPORTE_EN_CAMINO',
  TRANSPORTE_EN_DESTINO = 'TRANSPORTE_EN_DESTINO',
  RECEPCION_EN_VERIFICACION = 'RECEPCION_EN_VERIFICACION',
  RECEPCION_CONCLUIDA = 'RECEPCION_CONCLUIDA',
}

export enum TipoTransferencia {
  MANUAL = 'MANUAL',
  AUTOMATICA = 'AUTOMATICA',
  MIXTA = 'MIXTA',
}

/** «Esto no va». */
export enum MotivoRechazo {
  FALTA_PRODUCTO = 'FALTA_PRODUCTO',
  PRODUCTO_AVERIADO = 'PRODUCTO_AVERIADO',
  PRODUCTO_VENCIDO = 'PRODUCTO_VENCIDO',
  PRODUCTO_EQUIVOCADO = 'PRODUCTO_EQUIVOCADO',
}

/** «Va, pero distinto a lo declarado». */
export enum MotivoModificacion {
  CANTIDAD_INCORRECTA = 'CANTIDAD_INCORRECTA',
  VENCIMIENTO_INCORRECTO = 'VENCIMIENTO_INCORRECTO',
  PRESENTACION_INCORRECTA = 'PRESENTACION_INCORRECTA',
}

/**
 * En qué etapa se eligieron los lotes de un ítem.
 *
 * ⚠️ **No son las cuatro etapas de la transferencia**, son las dos en las que
 * todavía se puede decidir de qué lote sale la mercadería. `PREPARACION` pisa
 * a `PRE_TRANSFERENCIA` al resolver el desglose, pero las dos quedan
 * guardadas: así se puede auditar que lo pedido y lo preparado salieron de
 * lotes distintos.
 */
export enum EtapaAsignacionLote {
  PRE_TRANSFERENCIA = 'PRE_TRANSFERENCIA',
  PREPARACION = 'PREPARACION',
}

/**
 * Una porción de la cantidad de un ítem, atada a un lote concreto.
 *
 * ⚠️ **Es la INTENCIÓN del operador, no el movimiento.** El desglose real del
 * stock vive en `movimiento_stock_lote`; esto es lo que se pidió sacar. Si no
 * hay ninguno, el central reparte por FEFO.
 *
 * ⚠️ **`cantidad` viene en unidades y `cantidadPresentacion` en la
 * presentación del ítem.** La segunda es la que se le muestra al operador,
 * porque es la unidad en la que cargó el renglón.
 */
export interface TransferenciaItemLote {
  id?: number;
  loteId?: number;
  numeroLote?: string;
  /** En unidades base, como vive en el ledger. */
  cantidad?: number;
  /** La misma cantidad en la presentación del ítem, ya convertida por el central. */
  cantidadPresentacion?: number;
  etapa?: EtapaAsignacionLote;
  fechaVencimiento?: string;
  fechaRetiro?: string;
  estadoLote?: EstadoLote;
}

/**
 * Un ítem, con **lo que registró cada una de las cuatro etapas**.
 *
 * ⚠️ **Cada etapa guarda lo suyo y no pisa lo anterior.** Si se piden 10, el
 * depósito prepara 8, se despachan 8 y llegan 7, quedan las cuatro cifras: la
 * diferencia 10→8 es falta de stock en origen y la 8→7 es un faltante en
 * tránsito. **Colapsarlas en un campo destruye la posibilidad de auditar.**
 *
 * ⚠️ **La presentación también cambia entre etapas.** Se pide en cajas y se
 * despacha en unidades: comparar cantidades sin comparar la presentación da
 * diferencias falsas.
 */
export interface TransferenciaItem {
  id?: number;
  producto?: Producto;

  cantidadPreTransferencia?: number;
  presentacionPreTransferencia?: Presentacion;
  vencimientoPreTransferencia?: string;
  observacionPreTransferencia?: string;
  motivoModificacionPreTransferencia?: MotivoModificacion;
  motivoRechazoPreTransferencia?: MotivoRechazo;

  cantidadPreparacion?: number;
  presentacionPreparacion?: Presentacion;
  vencimientoPreparacion?: string;
  observacionPreparacion?: string;
  motivoModificacionPreparacion?: MotivoModificacion;
  motivoRechazoPreparacion?: MotivoRechazo;

  cantidadTransporte?: number;
  presentacionTransporte?: Presentacion;
  vencimientoTransporte?: string;
  observacionTransporte?: string;
  motivoModificacionTransporte?: MotivoModificacion;
  motivoRechazoTransporte?: MotivoRechazo;

  cantidadRecepcion?: number;
  presentacionRecepcion?: Presentacion;
  vencimientoRecepcion?: string;
  observacionRecepcion?: string;
  motivoModificacionRecepcion?: MotivoModificacion;
  motivoRechazoRecepcion?: MotivoRechazo;

  /**
   * Los lotes elegidos a mano para este ítem.
   *
   * ⚠️ **Vacío no es un error: significa FEFO.** Sin asignación el central
   * saca la mercadería del lote que vence antes, que es lo que hicieron
   * siempre todos los clientes. Elegir a mano es la excepción, para cuando lo
   * que hay en la góndola no coincide con el orden teórico.
   */
  lotesAsignados?: TransferenciaItemLote[];
}

export interface Transferencia {
  id?: number;
  sucursalOrigen?: Sucursal;
  sucursalDestino?: Sucursal;
  estado?: TransferenciaEstado;
  tipo?: TipoTransferencia;
  etapa?: EtapaTransferencia;
  observacion?: string;
  /** Quién intervino en cada etapa. */
  usuarioPreTransferencia?: Usuario;
  usuarioPreparacion?: Usuario;
  usuarioTransporte?: Usuario;
  usuarioRecepcion?: Usuario;
  /**
   * ⚠️ **Vienen resueltos por el backend.** La misma transferencia se ve
   * distinto según de qué lado estés: en origen se prepara y despacha, en
   * destino se recibe y verifica. **No inferir el rol comparando ids de
   * sucursal en el cliente.**
   */
  isOrigen?: boolean;
  isDestino?: boolean;
  creadoEn?: string;
  items?: TransferenciaItem[];
}

/**
 * Lo que viaja al central para guardar un ítem.
 *
 * ⚠️ **`saveTransferenciaItem` es un PATCH: un campo ausente significa «no lo
 * toques», nunca «borralo».** Para vaciar una etapa existe la mutation
 * `desconfirmarTransferenciaItem`. Mandar `null` —como hace `frc-mobile` al
 * desconfirmar— no borra nada y deja la pantalla mostrando algo que el
 * central no guardó.
 *
 * ⚠️ **`usuarioId` es obligatorio**: la columna es `NOT NULL` y el central
 * rechaza el input sin él. Lo completa `DatosService.guardar()` con el
 * usuario en sesión.
 */
export interface TransferenciaItemInput {
  id?: number;
  transferenciaId?: number;

  presentacionPreTransferenciaId?: number;
  presentacionPreparacionId?: number;
  presentacionTransporteId?: number;
  presentacionRecepcionId?: number;

  cantidadPreTransferencia?: number;
  cantidadPreparacion?: number;
  cantidadTransporte?: number;
  cantidadRecepcion?: number;

  observacionPreTransferencia?: string;
  observacionPreparacion?: string;
  observacionTransporte?: string;
  observacionRecepcion?: string;

  /** ⚠️ Texto `yyyy-MM-dd`, no un `Date`: el input del central es `String`. */
  vencimientoPreTransferencia?: string;
  vencimientoPreparacion?: string;
  vencimientoTransporte?: string;
  vencimientoRecepcion?: string;

  motivoModificacionPreTransferencia?: MotivoModificacion;
  motivoModificacionPreparacion?: MotivoModificacion;
  motivoModificacionTransporte?: MotivoModificacion;
  motivoModificacionRecepcion?: MotivoModificacion;

  motivoRechazoPreTransferencia?: MotivoRechazo;
  motivoRechazoPreparacion?: MotivoRechazo;
  motivoRechazoTransporte?: MotivoRechazo;
  motivoRechazoRecepcion?: MotivoRechazo;

  /** Sigue vigente. El central no lo completa solo en un ítem nuevo. */
  activo?: boolean;
  /** Si el renglón declara vencimiento. Espeja a `vencimientoPreTransferencia`. */
  poseeVencimiento?: boolean;

  usuarioId?: number;

  /**
   * De qué lotes sale este ítem. **Tiene tres valores, no dos.**
   *
   * | Qué mandás | Qué hace el central |
   * |---|---|
   * | ausente / `undefined` | no toca la asignación que ya tenga — es lo que manda cualquier pantalla que no sabe de lotes |
   * | `[]` | **borra** la asignación de esa etapa y el ítem vuelve a resolverse por FEFO |
   * | una lista | reemplaza la asignación de esa etapa |
   *
   * ⚠️ **Un `null` no borra.** Como el resto del input, la ausencia significa
   * «no lo toques»: para volver a FEFO hay que mandar la lista vacía.
   *
   * ⚠️ **La cantidad va EN PRESENTACIONES**, la misma unidad que
   * `cantidadPreTransferencia` y que devuelve `stockPorLoteEnPresentacion`. El
   * central la convierte a unidades con la presentación de la etapa.
   * Mandarla ya en unidades saca del lote tantas veces de más como unidades
   * tenga la presentación, y nadie se entera hasta el arqueo.
   */
  lotesAsignados?: { loteId: number; cantidad: number }[];
  /**
   * A qué etapa corresponde `lotesAsignados`. **Se ignora si la lista no
   * viene**, y por defecto el central asume `PRE_TRANSFERENCIA`.
   */
  etapaAsignacionLote?: EtapaAsignacionLote;
}

/**
 * Lo que viaja al central para guardar la cabecera.
 *
 * ⚠️ **`usuarioId` no alcanza para dejar el responsable.** `saveTransferencia`
 * solo asigna `usuarioPreTransferencia` cuando el input trae
 * `usuarioPreTransferenciaId`; el `usuarioId` genérico que completa
 * `DatosService.guardar()` lo ignora. `frc-mobile` no lo manda, así que sus
 * borradores no tienen responsable hasta que alguien los finaliza —y ahí lo
 * escribe `finalizarTransferencia`, no el alta.
 *
 * ⚠️ **Sin `id` es un alta.** El central preserva los campos ausentes solo
 * cuando el input trae un `id` existente.
 */
export interface TransferenciaInput {
  id?: number;
  sucursalOrigenId?: number;
  sucursalDestinoId?: number;
  estado?: TransferenciaEstado;
  tipo?: TipoTransferencia;
  etapa?: EtapaTransferencia;
  observacion?: string;
  usuarioPreTransferenciaId?: number;
  usuarioPreparacionId?: number;
  usuarioTransporteId?: number;
  usuarioRecepcionId?: number;
  usuarioId?: number;
}
