import { inject, Pipe, PipeTransform } from '@angular/core';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import { formatearImporte, type MonedaReferencia } from 'src/app/generic/utils/moneda.util';

/**
 * Formatea un importe según su moneda.
 *
 * ⚠️ El guaraní no lleva decimales. Usar este pipe —o el componente
 * `frc-importe`— en vez de `| number` es lo que evita que la regla se
 * duplique y diverja.
 *
 *   {{ venta.totalGs | importe: 'Guaraní' : '₲' }}
 *
 * Sin moneda usa la de la empresa, igual que `frc-importe`.
 *
 * **Es impuro, y a propósito.** Un pipe puro solo se reevalúa cuando cambian
 * sus argumentos: si la pantalla se pinta antes de que la sesión cargue la
 * moneda de la empresa, el importe se quedaría con dos decimales hasta que
 * cambie el valor. Impuro, la plantilla lo vuelve a correr en cada detección
 * de cambios de su vista, y como lee un signal, la vista se marca sola cuando
 * la moneda llega. Para que eso no cueste, recuerda el último resultado y
 * solo formatea de nuevo si cambió algo.
 */
@Pipe({ name: 'importe', standalone: true, pure: false })
export class ImportePipe implements PipeTransform {
  private readonly monedas = inject(MonedasSesion);

  private ultimo: {
    valor: number | null | undefined;
    moneda: MonedaReferencia;
    simbolo: string | null | undefined;
    empresa: Moneda | null;
    catalogo: readonly Moneda[];
    texto: string;
  } | null = null;

  transform(
    valor: number | null | undefined,
    moneda?: MonedaReferencia,
    simbolo?: string | null,
  ): string {
    const empresa = this.monedas.empresa();
    const catalogo = this.monedas.catalogo();
    const u = this.ultimo;
    if (
      u &&
      Object.is(u.valor, valor) &&
      u.moneda === moneda &&
      u.simbolo === simbolo &&
      u.empresa === empresa &&
      u.catalogo === catalogo
    ) {
      return u.texto;
    }
    const texto = formatearImporte(valor, this.monedas.paraImporte(moneda, simbolo), simbolo);
    this.ultimo = { valor, moneda, simbolo, empresa, catalogo, texto };
    return texto;
  }
}
