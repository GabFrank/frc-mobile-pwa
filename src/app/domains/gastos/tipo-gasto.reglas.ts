/**
 * Qué activo y qué campos exige cada tipo de gasto.
 *
 * **Es el corazón del módulo de caja chica**, y es lógica pura: se porta
 * verbatim y se prueba sin montar nada. Las reglas están en el backend
 * también, pero la solicitud se arma en el cliente y necesita saberlas para
 * pedir los datos correctos.
 */

export type ModuloPadreGasto =
  | 'MUEBLE'
  | 'INMUEBLE'
  | 'PERSONAS'
  | 'VEHICULO'
  | 'EQUIPOS'
  | 'ANDE'
  | 'JUNTA_SANEAMIENTO'
  | 'IMPUESTO'
  | 'INTERNET'
  | 'SEGURIDAD'
  | 'BASURA'
  | 'SEGURO'
  | 'OTRO';

export type TipoNaturalezaGasto = 'VARIABLE' | 'CONTINUO' | 'RECURRENTE';

export type TipoEnte = 'VEHICULO' | 'MUEBLE' | 'INMUEBLE' | 'EQUIPO';

/**
 * Servicios facturados periódicamente.
 *
 * ⚠️ **Todos se imputan a un `INMUEBLE`**, aunque su módulo padre diga otra
 * cosa: la luz, el agua o el internet los consume un local, no una categoría.
 */
const SERVICIOS_CONTINUOS: readonly ModuloPadreGasto[] = [
  'ANDE',
  'JUNTA_SANEAMIENTO',
  'IMPUESTO',
  'INTERNET',
  'SEGURIDAD',
  'BASURA',
  'SEGURO',
];

const CON_CUOTAS_ACTIVO: readonly ModuloPadreGasto[] = [
  'INMUEBLE',
  'MUEBLE',
  'VEHICULO',
  'EQUIPOS',
];

export function esModuloServicioContinuo(modulo?: string | null): boolean {
  return SERVICIOS_CONTINUOS.includes(modulo as ModuloPadreGasto);
}

export function esGastoContinuoRecurrente(naturaleza?: string | null): boolean {
  return naturaleza === 'CONTINUO' || naturaleza === 'RECURRENTE';
}

/**
 * Qué activo hay que elegir para este módulo.
 *
 * ⚠️ **`EQUIPOS` (plural) mapea a `EQUIPO` (singular).** El módulo padre y el
 * tipo de ente no usan el mismo string; compararlos directo falla.
 */
export function tipoEnteDesdeModuloPadre(modulo?: string | null): TipoEnte | null {
  if (modulo === 'VEHICULO' || modulo === 'MUEBLE' || modulo === 'INMUEBLE') {
    return modulo;
  }
  if (modulo === 'EQUIPOS') {
    return 'EQUIPO';
  }
  if (esModuloServicioContinuo(modulo)) {
    return 'INMUEBLE';
  }
  // `PERSONAS` y `OTRO` no se imputan a ningún activo.
  return null;
}

export function requiereEnteActivo(modulo?: string | null): boolean {
  return tipoEnteDesdeModuloPadre(modulo) != null;
}

export function esModuloPadreConCuotasActivo(modulo?: string | null): boolean {
  return CON_CUOTAS_ACTIVO.includes(modulo as ModuloPadreGasto);
}

/**
 * Si corresponde ofrecer el pago de una cuota del activo.
 *
 * El orden importa: un `esPagoCuotaActivo` explícito **manda sobre la
 * naturaleza**, porque es una decisión que alguien ya tomó para esa
 * solicitud.
 *
 * ⚠️ **Todavía no tiene consumidor fuera de sus propios tests.** La tarjeta
 * de resumen del alta usa `vistaResumen().mostrarCuotas`
 * (`ente-financiero.reglas.ts`), que sale de `cuotasTotales > 0` — un
 * criterio distinto. Esta función es la regla de dominio portada tal como
 * la tiene el backend, correcta y necesaria, pero para el **pago** de una
 * cuota de un activo, que está fuera del alcance de `alta-solicitud-caja-chica`.
 * Se conserva con sus tests a la espera de ese módulo; no la borres por no
 * tener quién la llame todavía.
 */
export function mostrarCuotasActivo(
  modulo?: string | null,
  naturaleza?: string | null,
  esPagoCuotaActivo?: boolean | null,
): boolean {
  if (!esModuloPadreConCuotasActivo(modulo)) {
    return false;
  }
  if (typeof esPagoCuotaActivo === 'boolean') {
    return esPagoCuotaActivo;
  }
  return esGastoContinuoRecurrente(naturaleza);
}

/** Cómo se le llama al activo en pantalla. */
export function etiquetaModuloPadre(modulo?: string | null): string {
  switch (modulo) {
    case 'VEHICULO':
      return 'Vehículo';
    case 'MUEBLE':
      return 'Mueble';
    case 'INMUEBLE':
      return 'Inmueble';
    case 'EQUIPOS':
      return 'Equipo';
    case 'PERSONAS':
      return 'Persona';
    // Los servicios continuos dicen a qué inmueble se refieren: «Inmueble»
    // a secas no distingue el de la luz del de el agua.
    case 'ANDE':
      return 'Inmueble (ANDE)';
    case 'JUNTA_SANEAMIENTO':
      return 'Inmueble (agua)';
    case 'IMPUESTO':
      return 'Inmueble / Activo';
    case 'INTERNET':
    case 'SEGURIDAD':
    case 'BASURA':
      return 'Inmueble / Sucursal';
    case 'SEGURO':
      return 'Activo asegurado';
    default:
      return 'Activo';
  }
}
