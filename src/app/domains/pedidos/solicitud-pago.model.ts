import { FormaPago } from 'src/app/domains/forma-pago/forma-pago.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { NotaRecepcion } from 'src/app/domains/pedidos/recepcion.model';
import { Proveedor } from 'src/app/domains/personas/proveedor.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';

/**
 * Solicitud de pago a proveedor.
 *
 * Es la continuación del circuito de compra: se recibe la mercadería y
 * después se pide autorización para pagarla.
 *
 * ```
 * Pedido → NotaRecepcion → RecepcionMercaderia → SolicitudPago → Pago
 * ```
 *
 * ⚠️ **`Pago` no se porta como pantalla.** Es tesorería de escritorio —alta
 * de pagos, cuotas, cajas con clave compuesta y autorización por un segundo
 * usuario— y en `frc-mobile` su servicio existía sin que ningún componente lo
 * inyectara. Acá solo se **lee** el estado del pago asociado, para poder
 * decir si la solicitud ya fue pagada. Ver `docs/modulos/operaciones-pagos-y-varios.md`.
 */

/**
 * ⚠️ **`PENDIENTE` no significa «esperando el pago».** Desde que el central
 * sumó `SOLICITADO` (migración `V194.5`), el ciclo es:
 *
 * ```
 * PENDIENTE ──solicitar──> SOLICITADO ──pago parcial──> PARCIAL ──> CONCLUIDO
 *      ^                        │
 *      └───────reabrir──────────┘
 * ```
 *
 * `PENDIENTE` es un **borrador** y **no es pagable**: el diálogo con el que
 * tesorería paga (`PagoProveedorService.listarPendientes`) solo mira
 * `SOLICITADO` y `PARCIAL`. Una solicitud que se queda en `PENDIENTE` no la
 * ve nadie del otro lado.
 */
export enum SolicitudPagoEstado {
  /** Borrador. Se puede editar, y **no** entra en la cola de pagos. */
  PENDIENTE = 'PENDIENTE',
  /** Validada y lista para pagar. Es la que ve tesorería. */
  SOLICITADO = 'SOLICITADO',
  PARCIAL = 'PARCIAL',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO',
}

/**
 * Estado del pago que cubre la solicitud. **Solo lectura.**
 *
 * ⚠️ **Tiene `ABIERTO` y `SolicitudPagoEstado` no**: cinco valores contra
 * cuatro. Se parecen pero no son intercambiables, y confundirlos hace que una
 * solicitud se muestre en un estado que el backend nunca le asignó.
 */
export enum PagoEstado {
  ABIERTO = 'ABIERTO',
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL',
  CONCLUIDO = 'CONCLUIDO',
  CANCELADO = 'CANCELADO',
}

/**
 * El pago visto desde la solicitud.
 *
 * ⚠️ En `frc-mobile` este campo estaba tipado `any` —se perdió la relación al
 * portarlo del desktop— así que acceder a `pago.estado` no tenía ayuda del
 * compilador. Acá se tipa lo que efectivamente se lee.
 *
 * ⚠️ **Un pago cubre varias solicitudes**, no una: en el central es
 * `@OneToMany(mappedBy = "pago") List<SolicitudPago>`. Desde la solicitud se
 * ve uno solo porque es el lado dueño de la relación.
 */
export interface PagoResumen {
  id?: number;
  estado?: PagoEstado;
  programado?: boolean;
  creadoEn?: string;
  /**
   * Quién autorizó la salida de dinero.
   *
   * ⚠️ Es un usuario **distinto** del que registra el pago: doble
   * intervención sobre la caja. No se colapsan en un campo.
   */
  autorizadoPor?: Usuario;
}

/** La nota dentro de la solicitud, con cuánto de ella se está pagando. */
export interface SolicitudPagoNotaRecepcion {
  id?: number;
  notaRecepcion?: NotaRecepcion;
  /**
   * ⚠️ **No tiene por qué ser el total de la nota.** Una factura grande puede
   * pagarse en varias solicitudes —de ahí el estado `PARCIAL`—, y el backend
   * además le descuenta los rechazos y la convierte a la moneda de la
   * cabecera. Nunca asumir que es igual a `notaRecepcion.valorTotal`.
   */
  montoIncluido?: number;
  creadoEn?: string;
}

export interface SolicitudPago {
  id?: number;
  proveedor?: Proveedor;
  /** Lo genera el backend con el formato `SP-000001`. El cliente no lo manda. */
  numeroSolicitud?: string;
  fechaSolicitud?: string;
  /** Sugerida, no comprometida: es una propuesta al área de pagos. */
  fechaPagoPropuesta?: string;
  montoTotal?: number;
  montoPagado?: number;
  moneda?: Moneda;
  formaPago?: FormaPago;
  estado?: SolicitudPagoEstado;
  observaciones?: string;
  creadoEn?: string;
  usuario?: Usuario;
  pago?: PagoResumen;
  notasRecepcion?: SolicitudPagoNotaRecepcion[];
}

/**
 * Lo que el backend precarga al crear una solicitud desde una recepción.
 *
 * Ya viene resuelto: las notas elegibles, la moneda —si las notas difieren,
 * guaraníes—, la forma de pago —si difieren, efectivo— y la fecha propuesta
 * —hoy más el plazo de crédito más largo entre los pedidos—.
 */
export interface DatosInicialesSolicitudPago {
  notas?: NotaRecepcion[];
  monedaId?: number | null;
  formaPagoId?: number | null;
  fechaPagoPropuesta?: string | null;
}

/**
 * Lo que se manda al crear la solicitud.
 *
 * ⚠️ **`montoTotal` viaja porque el esquema lo exige (`Float!`), pero el
 * backend no lo usa para la cabecera**: recalcula el total nota por nota
 * descontando rechazos y convirtiendo a la moneda de la solicitud. El valor
 * que se manda solo alimenta el detalle de pago cuando no se envían
 * `detalles`. Ver la regla 6 del repo: el dinero lo calcula el backend.
 */
export interface SolicitudPagoInput {
  proveedorId: number;
  montoTotal: number;
  monedaId: number;
  formaPagoId: number;
  estado: SolicitudPagoEstado;
  notaRecepcionIds: number[];
  fechaPagoPropuesta?: string;
  observaciones?: string;
  usuarioId?: number;
}
