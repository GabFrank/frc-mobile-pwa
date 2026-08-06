import { NotaRecepcion } from 'src/app/domains/pedidos/recepcion.model';
import {
  PagoEstado,
  SolicitudPago,
  SolicitudPagoEstado,
} from 'src/app/domains/pedidos/solicitud-pago.model';

/**
 * Reglas de la solicitud de pago, sin Angular en el medio.
 *
 * Viven acá y no en la pantalla para poder probarlas: son las que deciden si
 * una solicitud se puede guardar y qué se le muestra al operador sobre plata
 * que todavía no está calculada.
 */

/** Lo que falta para poder guardar, o `null` si está todo. */
export function faltaParaGuardar(datos: {
  proveedorId?: number | null;
  monedaId?: number | null;
  formaPagoId?: number | null;
  notas: NotaRecepcion[];
}): string | null {
  if (datos.proveedorId == null) {
    return 'Elegí un proveedor.';
  }
  if (datos.notas.length === 0) {
    return 'Agregá al menos una nota de recepción.';
  }
  if (datos.monedaId == null) {
    return 'Elegí la moneda.';
  }
  if (datos.formaPagoId == null) {
    return 'Elegí la forma de pago.';
  }
  return null;
}

/**
 * Suma de las notas cargadas, **estimada**.
 *
 * ⚠️ **No es el monto de la solicitud.** El backend recalcula la cabecera
 * nota por nota: le descuenta los rechazos de la recepción
 * (`valorTotalConRechazos`) y la convierte a la moneda de la solicitud con la
 * cotización de cada nota. Con un solo producto rechazado, este número es más
 * alto que el real.
 *
 * `frc-mobile` mostraba esta misma suma y la mandaba como `montoTotal` sin
 * aclarar nada, así que el operador leía una cifra que no era la que quedaba
 * guardada. Acá se muestra rotulada como estimación y la pantalla de detalle
 * enseña la del backend.
 */
export function totalEstimado(notas: NotaRecepcion[]): number {
  return notas.reduce((suma, nota) => suma + (nota.valorTotal ?? 0), 0);
}

/** Si la nota ya está en la lista. Compara como texto: el id llega mixto. */
export function yaEstaEnLaLista(notas: NotaRecepcion[], nota: NotaRecepcion): boolean {
  return notas.some((n) => String(n.id) === String(nota.id));
}

/**
 * Si las notas cargadas no comparten moneda.
 *
 * No bloquea —el backend convierte todo a la moneda de la cabecera— pero hay
 * que avisarlo: el total deja de ser la suma de lo que se ve en pantalla.
 */
export function hayMonedasMezcladas(notas: NotaRecepcion[]): boolean {
  const monedas = new Set(
    notas.map((n) => (n.moneda?.id != null ? String(n.moneda.id) : '')).filter(Boolean),
  );
  return monedas.size > 1;
}

/**
 * Solo una solicitud `PENDIENTE` se puede tocar.
 *
 * El central lo valida en `actualizarSolicitudPago` y tira
 * `IllegalStateException` con cualquier otro estado. Se replica acá para no
 * ofrecer una acción que va a fallar.
 */
export function esEditable(estado: SolicitudPagoEstado | null | undefined): boolean {
  return estado === SolicitudPagoEstado.PENDIENTE;
}

/**
 * Qué decir del pago asociado.
 *
 * `null` cuando todavía no hay pago: la solicitud está esperando que
 * tesorería la tome. No es un error ni un estado pendiente de la solicitud.
 */
export function resumenDelPago(solicitud: SolicitudPago | null | undefined): string | null {
  const pago = solicitud?.pago;
  if (pago?.id == null) {
    return null;
  }
  const partes = ['Pago #' + pago.id];
  if (pago.estado != null) {
    partes.push(etiquetaPago(pago.estado));
  }
  if (pago.programado === true) {
    partes.push('programado');
  }
  const autoriza = pago.autorizadoPor?.persona?.nombre;
  if (autoriza) {
    partes.push('autorizado por ' + autoriza);
  }
  return partes.join(' · ');
}

function etiquetaPago(estado: PagoEstado): string {
  const etiquetas: Record<PagoEstado, string> = {
    [PagoEstado.ABIERTO]: 'abierto',
    [PagoEstado.PENDIENTE]: 'pendiente',
    [PagoEstado.PARCIAL]: 'parcial',
    [PagoEstado.CONCLUIDO]: 'concluido',
    [PagoEstado.CANCELADO]: 'cancelado',
  };
  return etiquetas[estado] ?? String(estado);
}

/**
 * Fecha en el formato que parsea el central: `yyyy-MM-dd HH:mm`.
 *
 * ⚠️ El backend acepta también `yyyy-MM-dd` a secas —le agrega `00:00`—, pero
 * con 19 caracteres usa otro formateador. Mandar siempre la forma de 16
 * evita depender de cuál de las tres ramas cae.
 */
export function fechaParaBackend(valor: string | null | undefined): string | undefined {
  const limpio = (valor ?? '').trim();
  if (!limpio) {
    return undefined;
  }
  return limpio.length <= 10 ? limpio + ' 00:00' : limpio;
}
