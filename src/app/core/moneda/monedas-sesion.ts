import { Injectable, signal } from '@angular/core';

import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import type { MonedaReferencia } from 'src/app/generic/utils/moneda.util';

/**
 * Las monedas que la sesión ya conoce: la de la empresa y el catálogo.
 *
 * Es solo estado, sin dependencias, a propósito: lo leen `frc-importe`, el
 * pipe `importe` y `frc-campo-importe`, que aparecen en decenas de pantallas
 * y specs. Si para mostrar un número hubiera que inyectar Apollo, cada spec
 * que renderiza un importe tendría que proveerlo. Quien lo llena es
 * `MonedaModuloService`, al cargar la sesión.
 *
 * Mientras no cargó —o si el central no contestó— todo queda en `null` y los
 * importes se formatean como siempre.
 */
@Injectable({ providedIn: 'root' })
export class MonedasSesion {
  /** La moneda de la empresa. `null` = todavía no se sabe. */
  readonly empresa = signal<Moneda | null>(null);
  /** Las monedas del central, con `decimales` cuando el central los expone. */
  readonly catalogo = signal<readonly Moneda[]>([]);

  /**
   * La moneda con la que se formatea un importe que no dijo la suya.
   *
   * Lee signals: llamado desde un `computed` o una plantilla, se reevalúa
   * cuando la sesión termina de cargar.
   */
  paraImporte(moneda: MonedaReferencia, simbolo?: string | null): MonedaReferencia {
    return monedaParaImporte(moneda, simbolo, this.empresa(), this.catalogo());
  }

  limpiar(): void {
    this.empresa.set(null);
    this.catalogo.set([]);
  }
}

/**
 * Qué moneda define los decimales de un importe.
 *
 * 1. **La que vino.** Un texto no vacío o una moneda: lo de siempre, y todo
 *    uso explícito —`moneda="Guaraní"`— sigue igual.
 * 2. **Sin moneda pero con símbolo**, la del catálogo con ese símbolo, si es
 *    una sola. Si no hay catálogo, la de la empresa cuando el símbolo es el
 *    suyo. Si no, el símbolo como texto (`₲` y `Gs.` se reconocen como
 *    guaraní). Compras muestra los importes de la factura con el símbolo de
 *    **su** moneda: una factura en dólares no puede salir sin centavos solo
 *    porque la empresa trabaja en guaraníes.
 * 3. **Sin nada**, la de la empresa. Es el arreglo del «,00» en guaraníes de
 *    las pantallas que no pasaban moneda.
 * 4. Sin empresa todavía, `null`: dos decimales, como antes.
 */
export function monedaParaImporte(
  moneda: MonedaReferencia,
  simbolo: string | null | undefined,
  empresa: Moneda | null,
  catalogo: readonly Moneda[],
): MonedaReferencia {
  if (typeof moneda === 'string' ? moneda.trim() !== '' : moneda != null) {
    return moneda;
  }
  const s = normalizarSimbolo(simbolo);
  if (s) {
    const coincidencias = catalogo.filter((m) => normalizarSimbolo(m.simbolo) === s);
    if (coincidencias.length === 1) {
      return coincidencias[0];
    }
    if (empresa && normalizarSimbolo(empresa.simbolo) === s) {
      return empresa;
    }
    return simbolo;
  }
  return empresa;
}

function normalizarSimbolo(simbolo: string | null | undefined): string {
  return (simbolo ?? '').trim().toUpperCase();
}
