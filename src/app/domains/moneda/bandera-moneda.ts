/**
 * La bandera de una moneda, con la misma correspondencia que `frc-mobile`
 * (`mostrar-precio.component.ts`): por denominación o por símbolo. Una
 * moneda que no está acá se muestra con su símbolo en texto.
 */
export function banderaDeMoneda(moneda: { denominacion?: string; simbolo?: string } | null | undefined): string | null {
  const denominacion = (moneda?.denominacion ?? '').trim().toUpperCase();
  const simbolo = (moneda?.simbolo ?? '').trim();
  if (denominacion === 'GUARANI' || denominacion === 'GUARANÍ' || simbolo === 'Gs.' || simbolo === 'Gs') {
    return 'assets/flags/paraguay.png';
  }
  if (denominacion === 'REAL' || simbolo === 'R$') {
    return 'assets/flags/brazil.png';
  }
  if (denominacion === 'DOLAR' || denominacion === 'DÓLAR' || simbolo === '$' || simbolo === 'US$') {
    return 'assets/flags/eeuu.png';
  }
  if (denominacion === 'PESO ARGENTINO' || simbolo === 'AR$') {
    return 'assets/flags/argentina.png';
  }
  return null;
}
