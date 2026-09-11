import { Pipe, PipeTransform } from '@angular/core';
import { formatearImporte } from 'src/app/generic/utils/moneda.util';

/**
 * Formatea un importe según su moneda.
 *
 * ⚠️ El guaraní no lleva decimales. Usar este pipe —o el componente
 * `frc-importe`— en vez de `| number` es lo que evita que la regla se
 * duplique y diverja.
 *
 *   {{ venta.totalGs | importe: 'Guaraní' : '₲' }}
 */
@Pipe({ name: 'importe', standalone: true })
export class ImportePipe implements PipeTransform {
  transform(
    valor: number | null | undefined,
    moneda?: string | null,
    simbolo?: string | null,
  ): string {
    return formatearImporte(valor, moneda, simbolo);
  }
}
