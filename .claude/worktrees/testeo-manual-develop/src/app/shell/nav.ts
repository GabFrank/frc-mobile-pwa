export interface DestinoNav {
  ruta: string;
  etiqueta: string;
  icono: string;
  /** Si se declara, el destino solo aparece si el usuario tiene alguno. */
  roles?: readonly string[];
}

/**
 * Navegación primaria.
 *
 * Cuatro destinos de uso diario a un toque; el resto vive dentro de ellos.
 * Reemplaza el menú lateral desplegable de `frc-mobile`, donde todo estaba
 * a dos toques y detrás de acordeones.
 */
export const DESTINOS: readonly DestinoNav[] = [
  { ruta: '/inicio', etiqueta: 'Inicio', icono: 'home' },
  { ruta: '/operaciones', etiqueta: 'Operaciones', icono: 'caja' },
  { ruta: '/buscar', etiqueta: 'Buscar', icono: 'buscar' },
  { ruta: '/cuenta', etiqueta: 'Cuenta', icono: 'cuenta' },
];
