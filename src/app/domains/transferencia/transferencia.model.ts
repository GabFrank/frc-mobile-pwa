import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
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

  usuarioId?: number;
}
