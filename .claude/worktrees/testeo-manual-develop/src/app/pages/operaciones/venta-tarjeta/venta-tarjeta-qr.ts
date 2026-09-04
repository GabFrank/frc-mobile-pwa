import { descodificarQr } from 'src/app/generic/utils/qrUtils';

export type MotivoQrVenta =
  | 'qr-invalido'
  | 'no-es-venta-tarjeta'
  | 'qr-no-reconocido'
  | 'sin-caja'
  | 'caja-distinta';

export interface DatosQrVenta {
  ventaId: number;
  cajaId: number;
  monto: number;
  sucursalId: number;
  ventaTarjetaId: number | null;
}

export interface ResultadoQrVenta {
  ok: boolean;
  motivo?: MotivoQrVenta;
  mensaje?: string;
  datos?: DatosQrVenta;
}

/** El QR de venta con tarjeta se identifica con este `tipoEntidad`. */
const TIPO_ENTIDAD = 'VT';
/** Y con este destino, heredado del nombre del componente del repo anterior. */
const COMPONENTE = 'RegistroVentaTarjetaComponent';

/**
 * Interpreta y valida el QR que emite el punto de venta.
 *
 * Formato, sobre el QR genérico de la app:
 *
 * ```
 * frc-{sucursalId}-VT-{ventaId}-{idCentral}-RegistroVentaTarjetaComponent-{cajaId|monto|ventaTarjetaId}-{ts}
 * ```
 *
 * ⚠️ **El QR solo se acepta desde la caja que lo emitió.** Es la protección
 * central del módulo: sin ella un operador podría imputar el cupón de otra
 * caja, y eso descuadra **dos** arqueos a la vez.
 *
 * ⚠️ **La sucursal sale del QR, no de la caja.** El QR lo genera la filial y
 * su `sucursalId` es el que enruta el guardado al backend correcto; el
 * central puede tener asignado otro id para la misma sucursal.
 *
 * Es una función pura y no un servicio porque no depende de nada: se puede
 * probar sin montar Angular, y la valida un test por cada motivo de rechazo.
 */
export function interpretarQrVenta(
  texto: string,
  cajaActualId: number | string | null | undefined,
): ResultadoQrVenta {
  const qr = descodificarQr(texto);
  if (!qr) {
    return { ok: false, motivo: 'qr-invalido', mensaje: 'QR no válido para este sistema.' };
  }

  if (qr.tipoEntidad !== TIPO_ENTIDAD) {
    return {
      ok: false,
      motivo: 'no-es-venta-tarjeta',
      mensaje: 'Ese QR no corresponde a una venta con tarjeta.',
    };
  }

  if (qr.componentToOpen !== COMPONENTE) {
    return { ok: false, motivo: 'qr-no-reconocido', mensaje: 'QR no reconocido.' };
  }

  if (cajaActualId == null) {
    return { ok: false, motivo: 'sin-caja', mensaje: 'No tenés una caja abierta.' };
  }

  // `data` lleva tres valores separados por `|`: caja, monto y —opcional— el
  // id del registro que el desktop ya creó como pendiente.
  const partes = (qr.data ?? '').split('|');
  const cajaId = Number(partes[0]);
  const monto = Number(partes[1]);
  const ventaTarjetaId = partes[2] ? Number(partes[2]) : null;

  if (!Number.isFinite(cajaId) || cajaId !== Number(cajaActualId)) {
    return {
      ok: false,
      motivo: 'caja-distinta',
      mensaje: 'Este QR pertenece a otra caja. Solo el cajero de turno puede registrar esta venta.',
    };
  }

  return {
    ok: true,
    datos: {
      ventaId: Number(qr.idOrigen),
      cajaId,
      monto,
      sucursalId: Number(qr.sucursalId),
      ventaTarjetaId,
    },
  };
}
