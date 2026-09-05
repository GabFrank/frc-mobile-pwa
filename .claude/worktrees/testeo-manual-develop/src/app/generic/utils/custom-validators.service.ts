import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Validadores propios.
 *
 * Son funciones puras, no un servicio inyectable: un validador no necesita
 * inyección y así se pueden componer directamente en el `FormControl`.
 */

/** Rechaza valores compuestos solo por espacios. */
export function sinEspaciosEnBlanco(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (valor == null || valor === '') {
      return null;
    }
    return String(valor).trim().length === 0 ? { espaciosEnBlanco: true } : null;
  };
}

/** Exige que el número sea mayor a cero. Para cantidades e importes. */
export function mayorACero(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (valor == null || valor === '') {
      return null;
    }
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? null : { mayorACero: true };
  };
}
