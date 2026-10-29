import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { esGuarani } from 'src/app/generic/utils/moneda.util';

/** Denominaciones que identifican la moneda local cuando no se sabe cuál es la de la empresa. */
const LOCALES = ['GUARANI', 'GS'];

/**
 * ¿Es la moneda de la empresa? Esa es la que no necesita cotización.
 *
 * Se compara por id. Solo si la empresa no se pudo resolver (central viejo
 * sin respuesta) se cae al reconocimiento por nombre de siempre, que es el
 * guaraní.
 */
export function esMonedaEmpresa(moneda: Moneda | null | undefined, empresa: Moneda | null | undefined): boolean {
  if (moneda == null) {
    return false;
  }
  if (empresa?.id != null && moneda.id != null) {
    return String(moneda.id) === String(empresa.id);
  }
  const denominacion = (moneda.denominacion ?? '').toUpperCase();
  return LOCALES.some((l) => denominacion.includes(l));
}

/**
 * La moneda con la que arranca una recepción nueva: la de COMPRAS si está en
 * la lista; si no, la de la empresa y, en último caso, la primera. Sin
 * configuración, COMPRAS es la de la empresa: igual que antes.
 */
export function monedaInicial(
  lista: readonly Moneda[],
  deCompras: Moneda | null | undefined,
  empresa: Moneda | null | undefined,
): Moneda | undefined {
  const porId = (m: Moneda | null | undefined) =>
    m?.id != null ? lista.find((x) => String(x.id) === String(m.id)) : undefined;
  return porId(deCompras) ?? lista.find((m) => esMonedaEmpresa(m, empresa)) ?? lista[0];
}

/** «guaraníes» o el nombre de la moneda de la empresa, para la ayuda de la cotización. */
export function nombreMonedaEmpresa(empresa: Moneda | null | undefined): string {
  if (empresa == null || esGuarani(empresa)) {
    return 'guaraníes';
  }
  return empresa.denominacion ?? empresa.simbolo ?? 'la moneda de la empresa';
}
