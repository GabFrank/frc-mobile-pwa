import { Injectable, signal } from '@angular/core';

import type { CabeceraFacturaFoto } from 'src/app/domains/compras/compras.model';

/**
 * La cabecera que la IA leyó de la foto, de camino a la pantalla de revisión.
 *
 * No hay una consulta que la devuelva después: la mutación `leerFacturaFotoMobile` es la única
 * que la trae, así que se pasa de una pantalla a la otra por acá. Si el usuario recarga la
 * página se pierde, y la pantalla lo dice en vez de mostrar un formulario vacío.
 */
@Injectable({ providedIn: 'root' })
export class FacturaFotoEstado {
  readonly cabecera = signal<CabeceraFacturaFoto | null>(null);
}
