import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { aId } from './compras-reglas';

/** Lo que de la factura hace falta para resolver su moneda. */
export interface MonedaDeFactura {
  moneda?: string | null;
  monedaId?: number | string | null;
  monedaSimbolo?: string | null;
  cotizacion?: number | null;
}

/**
 * La moneda del sistema de la factura, del catálogo: por id y, si la factura
 * no lo trae, por símbolo cuando es uno solo. `null` si no se puede resolver;
 * ahí los importes se formatean por el símbolo, como antes.
 */
export function monedaDeFactura(f: MonedaDeFactura | null | undefined, catalogo: readonly Moneda[]): Moneda | null {
  if (f == null) {
    return null;
  }
  const id = aId(f.monedaId);
  if (id != null) {
    return catalogo.find((m) => m.id === id) ?? null;
  }
  const simbolo = (f.monedaSimbolo ?? '').trim().toUpperCase();
  if (simbolo) {
    const coinciden = catalogo.filter((m) => (m.simbolo ?? '').trim().toUpperCase() === simbolo);
    return coinciden.length === 1 ? coinciden[0] : null;
  }
  return null;
}

/**
 * «Moneda · cotización N»: la cotización se muestra cuando la moneda de la
 * factura no es la de la empresa. Si no se puede saber (sin empresa o sin
 * moneda resuelta) rige la regla de siempre: cotización mayor que 1.
 */
export function textoMoneda(
  f: MonedaDeFactura,
  monedaFactura: Moneda | null,
  empresa: Moneda | null,
  numero: (v: number) => string,
): string {
  const base = f.moneda ?? '—';
  const cotizacion = f.cotizacion ?? 0;
  const otra =
    monedaFactura?.id != null && empresa?.id != null
      ? monedaFactura.id !== empresa.id && cotizacion > 0
      : cotizacion > 1;
  return otra ? base + ' · cotización ' + numero(cotizacion) : base;
}
