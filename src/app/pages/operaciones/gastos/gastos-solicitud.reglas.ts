import type {
  BeneficiarioTipo,
  DetalleFinanciero,
  MonedaResumen,
} from 'src/app/domains/gastos/pre-gasto.model';
import {
  etiquetaModuloPadre,
  requiereEnteActivo,
} from 'src/app/domains/gastos/tipo-gasto.reglas';

/**
 * Reglas del alta de una solicitud de caja chica, sin Angular en el medio.
 *
 * Viven acá y no en la pantalla para poder probarlas: deciden si se puede
 * pedir la plata y, cuando no, qué le falta al operador.
 */

export interface DatosSolicitud {
  sucursalId: number | null;
  responsableId: number | null;
  tipoGastoId: number | null;
  moduloPadre: string | null;
  enteId: number | null;
  beneficiarioTipo: BeneficiarioTipo;
  beneficiarioPersonaId: number | null;
  beneficiarioProveedorId: number | null;
  detalles: DetalleFinanciero[];
}

/** Lo que falta para poder guardar, o `null` si está todo. */
export function faltaParaGuardar(datos: DatosSolicitud): string | null {
  if (!datos.sucursalId) {
    return 'Seleccione una sucursal de retiro';
  }
  if (!datos.responsableId) {
    // El retiro se imputa a la persona, no al usuario. Sin persona asociada
    // es un problema de datos, no de pantalla.
    return 'No se encontró la persona del usuario en sesión';
  }
  if (!datos.tipoGastoId) {
    return 'Seleccione un tipo de gasto';
  }
  if (requiereEnteActivo(datos.moduloPadre) && !datos.enteId) {
    return `Seleccione ${etiquetaModuloPadre(datos.moduloPadre)}`;
  }
  if (datos.beneficiarioTipo === 'PERSONA' && !datos.beneficiarioPersonaId) {
    return 'Seleccione la persona beneficiaria';
  }
  if (datos.beneficiarioTipo === 'PROVEEDOR' && !datos.beneficiarioProveedorId) {
    return 'Seleccione el proveedor beneficiario';
  }

  for (const [indice, detalle] of datos.detalles.entries()) {
    if (detalle.monedaId == null || !detalle.formaPago) {
      return `Complete la moneda y la forma de pago del detalle ${indice + 1}`;
    }
    if (detalle.monto == null || detalle.monto <= 0) {
      return `Cargue un monto mayor a cero en el detalle ${indice + 1}`;
    }
  }

  // ⚠️ Una moneda por detalle, sin repetir. El modelo del central es una
  // lista de {monto, moneda, forma de pago}: dos filas en la misma moneda no
  // se pueden distinguir después.
  const monedas = datos.detalles.map((d) => d.monedaId);
  if (new Set(monedas).size !== monedas.length) {
    return 'No repita la misma moneda en más de un detalle';
  }

  return null;
}

export interface TotalPorMoneda {
  monedaId: number;
  denominacion: string;
  simbolo: string;
  total: number;
}

/**
 * Cuánto se pide en cada moneda.
 *
 * Devuelve la **denominación**, no solo el símbolo: es el nombre lo que
 * decide si el importe lleva decimales, y el guaraní no lleva.
 */
export function totalesPorMoneda(
  detalles: DetalleFinanciero[],
  monedas: MonedaResumen[],
): TotalPorMoneda[] {
  const porMoneda = new Map<number, number>();

  for (const detalle of detalles) {
    if (detalle.monedaId == null || detalle.monto == null || detalle.monto <= 0) {
      continue;
    }
    porMoneda.set(detalle.monedaId, (porMoneda.get(detalle.monedaId) ?? 0) + detalle.monto);
  }

  return [...porMoneda.entries()].map(([monedaId, total]) => {
    const moneda = monedas.find((m) => m.id === monedaId);
    return {
      monedaId,
      denominacion: moneda?.denominacion ?? '',
      simbolo: moneda?.simbolo ?? '',
      total,
    };
  });
}
