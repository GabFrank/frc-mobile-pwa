import type {
  BeneficiarioTipo,
  DetalleFinanciero,
  MonedaResumen,
  PreGastoInput,
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
  /** `true` cuando el último intento de resolver el `Ente`/su resumen falló. */
  errorResumen: boolean;
  beneficiarioTipo: BeneficiarioTipo;
  beneficiarioPersonaId: number | null;
  beneficiarioProveedorId: number | null;
  detalles: DetalleFinanciero[];
}

/** Lo que falta para poder guardar, o `null` si está todo. */
export function faltaParaGuardar(datos: DatosSolicitud): string | null {
  // ⚠️ `== null` a propósito, no `!datos.sucursalId`: un id `0` es un id
  // válido y un valor "falsy". Con `!` una sucursal con id `0` quedaba
  // marcada como sin elegir aunque estuviera seleccionada y visible.
  if (datos.sucursalId == null) {
    return 'Seleccione una sucursal de retiro';
  }
  // ⚠️ El central rechaza cualquier sucursal con id ≤ 0 al guardar
  // (`PreGastoGraphQL.java`: "Debe indicar una sucursal válida para
  // registrar la solicitud."). SERVIDOR es esa sucursal — id `0`, virtual,
  // sin lugar físico de retiro. La pantalla ya no la ofrece en el selector
  // (ver `gastos-solicitud-nueva.page.ts`), pero esta regla queda acá
  // también: es la fuente de verdad de qué sucursal "vale", y sin ella un
  // `sucursalId` de `0` colado por otra vía volvería a llegar a Guardar.
  if (datos.sucursalId <= 0) {
    return 'Esa sucursal no puede recibir solicitudes de caja chica';
  }
  if (datos.responsableId == null) {
    // El retiro se imputa a la persona, no al usuario. Sin persona asociada
    // es un problema de datos, no de pantalla.
    return 'No se encontró la persona del usuario en sesión';
  }
  if (datos.tipoGastoId == null) {
    return 'Seleccione un tipo de gasto';
  }
  if (requiereEnteActivo(datos.moduloPadre) && !datos.enteId) {
    return `Seleccione ${etiquetaModuloPadre(datos.moduloPadre)}`;
  }
  // ⚠️ Aunque `enteId` haya quedado cargado, un resumen que falló no se
  // puede guardar: sin él no hay forma de confirmar que el activo elegido
  // es el que terminó resuelto. Ver la Task de arreglos finales — un
  // `elegirActivo` que falla al resolver el segundo activo dejaba imputado
  // el primero, en silencio.
  if (requiereEnteActivo(datos.moduloPadre) && datos.errorResumen) {
    return `No se pudo confirmar ${etiquetaModuloPadre(datos.moduloPadre).toLowerCase()}, intente de nuevo`;
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
    // ⚠️ Mismo motivo que en `ente-financiero.reglas.ts`: el `ID` de GraphQL
    // llega como string (`m.id === "1"`), así que comparar por `String()` no
    // depende de si terminó siendo string o number.
    const moneda = monedas.find((m) => String(m.id) === String(monedaId));
    return {
      monedaId,
      denominacion: moneda?.denominacion ?? '',
      simbolo: moneda?.simbolo ?? '',
      total,
    };
  });
}

export interface DatosParaInput {
  sucursalId: number;
  responsableId: number;
  tipoGastoId: number;
  enteId: number | null;
  beneficiarioTipo: BeneficiarioTipo;
  beneficiarioPersonaId: number | null;
  beneficiarioProveedorId: number | null;
  fechaVencimiento: string;
  nivelUrgencia: string;
  descripcion: string;
  detalles: DetalleFinanciero[];
}

/**
 * Lo que se le manda a `savePreGasto`.
 *
 * ⚠️ **Sin `cajaId` y sin `usuarioId`.** El primero es el campo muerto de
 * `frc-mobile` —sale de una clave de localStorage que nadie escribe—; el
 * segundo lo completa `DatosService.guardar` desde la sesión, y pisarlo acá
 * atribuiría la solicitud a otro usuario.
 */
export function construirPreGastoInput(datos: DatosParaInput): PreGastoInput {
  const descripcion = datos.descripcion.trim();

  return {
    sucursalId: datos.sucursalId,
    // La caja de la que se retira es la de la sucursal elegida.
    sucursalCajaId: datos.sucursalId,
    funcionarioId: datos.responsableId,
    tipoGastoId: datos.tipoGastoId,
    enteId: datos.enteId ?? undefined,
    // Solo el beneficiario que corresponde: mandar los dos dejaría al central
    // decidiendo cuál vale.
    beneficiarioPersonaId:
      datos.beneficiarioTipo === 'PERSONA' ? datos.beneficiarioPersonaId ?? undefined : undefined,
    beneficiarioProveedorId:
      datos.beneficiarioTipo === 'PROVEEDOR'
        ? datos.beneficiarioProveedorId ?? undefined
        : undefined,
    // ⚠️ Con hora, siempre. `campo-fecha.component.ts` entrega `yyyy-MM-dd`,
    // pero el central parsea este campo con
    // `LocalDateTime.parse(input.getFechaVencimiento(), DateTimeFormatter.ISO_DATE_TIME)`
    // dentro de un `try/catch` que traga la excepción (`PreGastoGraphQL.java`):
    // una fecha sin hora no matchea `ISO_DATE_TIME`, la mutation responde OK
    // igual y el vencimiento queda `null` en silencio. No "simplificar"
    // sacando el `T00:00:00`.
    fechaVencimiento: datos.fechaVencimiento ? `${datos.fechaVencimiento}T00:00:00` : undefined,
    nivelUrgencia: datos.nivelUrgencia,
    descripcion: descripcion || undefined,
    finanzas: datos.detalles.map((d) => ({
      monto: d.monto as number,
      monedaId: d.monedaId as number,
      formaPago: d.formaPago as string,
    })),
  };
}
