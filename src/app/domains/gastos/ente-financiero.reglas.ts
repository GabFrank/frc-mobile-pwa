import type { ResumenFinancieroEnte } from 'src/app/graphql/operaciones/gastos/enteFinancialSummary';
import type {
  BeneficiarioTipo,
  DetalleFinanciero,
  MonedaResumen,
} from './pre-gasto.model';

/**
 * Cómo se lee lo que el central sabe de la deuda de un activo, y qué de eso
 * puede completar el formulario solo.
 *
 * Es lógica pura: acá se decide qué se muestra y qué se autocompleta, pero
 * **los montos no se recalculan** — vienen del backend.
 */

export interface VistaResumenEnte {
  titulo: string;
  /**
   * `null` cuando el central no informó el campo — **no** es lo mismo que
   * «no debe nada». Todos los campos de `EnteFinancialSummary` son
   * nullables en el esquema (`pre_gasto.graphqls`): un `{}` es un resumen
   * sin datos, no uno que afirme deuda cero.
   */
  montoTotal: number | null;
  /** Mismo criterio que `montoTotal`: `null` es «no lo informó», no cero. */
  montoPendiente: number | null;
  montoCuota: number | null;
  /** La denominación decide la precisión: el guaraní no lleva decimales. */
  denominacion: string;
  simbolo: string;
  cuotaTexto: string;
  cuotasFaltantesTexto: string;
  vencimientoTexto: string;
  notificacion: string | null;
  mostrarCuotas: boolean;
}

/** Qué tan cerca está el vencimiento, o `null` si el central no lo informó. */
export function avisoVencimiento(diasParaVencer?: number | null): string | null {
  if (diasParaVencer == null) {
    return null;
  }
  if (diasParaVencer < 0) {
    return `Cuota vencida hace ${Math.abs(diasParaVencer)} días`;
  }
  if (diasParaVencer <= 10) {
    return `Vence en ${diasParaVencer} días`;
  }
  return `Próximo vencimiento en ${diasParaVencer} días`;
}

export function construirVistaResumen(
  resumen: ResumenFinancieroEnte,
  monedas: MonedaResumen[],
): VistaResumenEnte {
  // ⚠️ GraphQL serializa `ID` como string: `monedas` llega con `id: "1"`, no
  // `id: 1`, aunque el modelo lo tipe `number`. Comparar por `String()` de los
  // dos lados no depende de con qué forma haya llegado cada uno.
  const moneda = monedas.find((m) => String(m.id) === String(resumen.monedaId));
  const mostrarCuotas = (resumen.cuotasTotales ?? 0) > 0;
  const cuotaActual = resumen.numeroCuotaActual ?? (resumen.cuotasPagadas ?? 0) + 1;
  const faltantes = resumen.cuotasFaltantes ?? 0;

  return {
    titulo: resumen.descripcion || 'Activo vinculado',
    montoTotal: resumen.montoTotal ?? null,
    montoPendiente: resumen.montoPendiente ?? null,
    montoCuota: mostrarCuotas && (resumen.montoSugerido ?? 0) > 0
      ? (resumen.montoSugerido as number)
      : null,
    denominacion: moneda?.denominacion ?? '',
    simbolo: moneda?.simbolo ?? resumen.monedaSimbolo ?? '',
    cuotaTexto: mostrarCuotas
      ? `Cuota ${cuotaActual}/${resumen.cuotasTotales}`
      : resumen.estadoCuota || 'Sin cuotas',
    cuotasFaltantesTexto: mostrarCuotas
      ? `${faltantes} ${faltantes === 1 ? 'cuota pendiente' : 'cuotas pendientes'}`
      : '',
    vencimientoTexto: resumen.diaVencimiento
      ? `Día ${resumen.diaVencimiento} del mes`
      : 'Sin día fijo',
    notificacion: avisoVencimiento(resumen.diasParaVencer),
    mostrarCuotas,
  };
}

export interface EstadoAutocompletable {
  fechaVencimiento: string;
  detalles: DetalleFinanciero[];
  beneficiarioTipo: BeneficiarioTipo;
  beneficiarioProveedorId: number | null;
  textoProveedor: string;
}

/**
 * Lo que el formulario puede completar solo al elegir un activo.
 *
 * ⚠️ **No pisa lo que el operador ya cargó.** `frc-mobile` reemplazaba el
 * primer detalle cada vez que se elegía un activo, así que cambiar de activo
 * borraba el importe tipeado sin ningún aviso.
 */
export function aplicarAutocompletado(
  resumen: ResumenFinancieroEnte,
  actual: EstadoAutocompletable,
): EstadoAutocompletable {
  const fechaSugerida = recortarFecha(resumen.fechaVencimientoSugerida);
  const fechaVencimiento = actual.fechaVencimiento || fechaSugerida || '';

  const detalles = [...actual.detalles];
  const primero = detalles[0];
  const puedeCompletarMonto =
    primero != null &&
    primero.monto == null &&
    resumen.autocompletarMonto !== false &&
    resumen.montoSugerido != null;

  if (puedeCompletarMonto) {
    detalles[0] = {
      ...primero,
      monto: Number(resumen.montoSugerido),
      monedaId: resumen.monedaId != null ? Number(resumen.monedaId) : primero.monedaId,
    };
  }

  if (resumen.proveedorId != null) {
    return {
      fechaVencimiento,
      detalles,
      beneficiarioTipo: 'PROVEEDOR',
      beneficiarioProveedorId: Number(resumen.proveedorId),
      textoProveedor: (resumen.proveedorNombre ?? '').toUpperCase(),
    };
  }

  return {
    fechaVencimiento,
    detalles,
    beneficiarioTipo: actual.beneficiarioTipo,
    beneficiarioProveedorId: actual.beneficiarioProveedorId,
    textoProveedor: actual.textoProveedor,
  };
}

/** `2026-10-05T00:00:00` → `2026-10-05`. */
function recortarFecha(fecha?: string | null): string {
  if (!fecha) {
    return '';
  }
  return fecha.length >= 10 ? fecha.substring(0, 10) : fecha;
}
