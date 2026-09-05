import { Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_NATIVE_DATE_FORMATS,
  NativeDateAdapter,
} from '@angular/material/core';

import { formatearFechaPy, parsearFechaPy } from './fecha-py';

/*
  Separado de `fecha-py.ts` a propósito: ese archivo es puro y se prueba
  llamando funciones, sin TestBed y sin arrastrar Angular Material. Juntarlos
  obligaba al test de las conversiones a levantar el compilador.
*/

/**
 * El adaptador que le enseña a Material a leer y escribir fechas de acá.
 *
 * Solo se tocan las dos operaciones del **campo de texto**. El calendario
 * —nombres de meses, primer día de la semana— lo resuelve `NativeDateAdapter`
 * con el locale de la app, y reimplementarlo sería traer un problema
 * resuelto.
 */
export class FechaPyDateAdapter extends NativeDateAdapter {
  override parse(valor: unknown): Date | null {
    if (valor instanceof Date) {
      return valor;
    }
    return parsearFechaPy(typeof valor === 'number' ? String(valor) : (valor as string));
  }

  override format(fecha: Date, formato: Object): string {
    // El formato del campo es el único que se fija acá; el resto —cabecera
    // del calendario, etiquetas de accesibilidad— sigue siendo el nativo.
    if (formato === FORMATOS_FECHA_PY.display.dateInput) {
      return formatearFechaPy(fecha);
    }
    return super.format(fecha, formato);
  }
}

/** `dd/MM/yyyy` en el campo; lo demás, los formatos nativos. */
export const FORMATOS_FECHA_PY = {
  ...MAT_NATIVE_DATE_FORMATS,
  parse: { ...MAT_NATIVE_DATE_FORMATS.parse, dateInput: 'dd/MM/yyyy' },
  display: { ...MAT_NATIVE_DATE_FORMATS.display, dateInput: 'dd/MM/yyyy' },
};

/**
 * Se proveen **en el componente**, no en `app.config.ts`.
 *
 * Es lo que deja que una pantalla que mañana necesite otro formato lo
 * declare sin discutir con una configuración global, y evita que el
 * adaptador se cargue en el arranque de la app para las pantallas que no
 * tienen ninguna fecha.
 */
export const PROVEEDORES_FECHA_PY: Provider[] = [
  { provide: DateAdapter, useClass: FechaPyDateAdapter },
  { provide: MAT_DATE_FORMATS, useValue: FORMATOS_FECHA_PY },
];
