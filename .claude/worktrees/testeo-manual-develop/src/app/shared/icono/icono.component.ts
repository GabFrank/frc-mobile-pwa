import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Íconos.
 *
 * Se inlinean como SVG en vez de cargar una fuente de íconos desde un CDN.
 *
 * El motivo es una lección del repo anterior: allá el motor de
 * reconocimiento facial descargaba sus modelos de `cdn.jsdelivr.net`, así
 * que la marcación no funcionaba en una sucursal sin salida a internet
 * (TODO_TECNICO #52). Una PWA que depende de un CDN para su tipografía de
 * íconos tiene el mismo problema, más chico pero de la misma familia.
 *
 * Para agregar un ícono: sumá su `path` acá. Son trazos de 24×24.
 */

const TRAZOS: Record<string, string> = {
  // Navegación
  home: 'M3 10.5 12 3l9 7.5V21H3z',
  caja: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-3.5-3.5',
  cuenta: 'M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6',
  atras: 'M15 18l-6-6 6-6',
  cerrar: 'M18 6L6 18M6 6l12 12',
  mas: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  masOpciones: 'M12 4.3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z M12 10.3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z M12 17.3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z',
  chevronAbajo: 'M6 9l6 6 6-6',
  filtrar: 'M4 6h16M7 12h10M10 18h4',
  ajustes:
    'M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',

  // Cámara y escaneo
  camara: 'M4 8h3l1.8-2h6.4L17 8h3v11H4z M12 10.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z',
  escanear: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8 M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8 M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16 M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16 M4 12h16',
  linterna: 'M13 3L6 13.5h5L10 21l7-10.5h-5z',

  // Estado
  check: 'M4 12.5l5.5 5.5L20 7',
  checkCirculo: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 12.2l2.7 2.7L16 9.5',
  error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7.5v5.5 M12 16.2v.01',
  alerta: 'M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z M12 9v4 M12 16.5v.01',
  reloj: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5.2l3.4 2',
  cancelar: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8.5 8.5l7 7 M15.5 8.5l-7 7',
  verificado: 'M12 3l2.4 1.8 3-.2.9 2.9 2.4 1.8-1.2 2.8 1.2 2.8-2.4 1.8-.9 2.9-3-.2L12 21l-2.4-1.8-3 .2-.9-2.9L3.3 14.7l1.2-2.8-1.2-2.8 2.4-1.8.9-2.9 3 .2z M9 12l2 2 4-4',

  // Dominio
  producto: 'M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 4 9-4 M12 11v10',
  codigo: 'M4 6v12 M7 6v12 M10 6v12 M14 6v12 M17 6v12 M20 6v12',
  inventario: 'M4 8h16v12H4z M4 8l2-4h12l2 4 M9 12h6',
  camion: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z M7 19.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M17.5 19.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  etiqueta: 'M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z M7.5 7.5v.01',
  intercambio: 'M4 8h13l-3-3 M20 16H7l3 3',
  tirar: 'M4 7h16 M9 7V5h6v2 M6 7l1 13h10l1-13',
  persona: 'M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6',
  documento: 'M6 3h8l4 4v14H6z M14 3v4h4 M9 12h6M9 16h4',
  dinero: 'M3 6h18v12H3z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  calendario: 'M4 5h16v15H4z M8 3v4M16 3v4M4 10h16',
  vencido: 'M4 5h16v15H4z M8 3v4M16 3v4M4 10h16 M10 14l4 4M14 14l-4 4',
  entrada: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4 M10 16l4-4-4-4 M14 12H3',
  salida: 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4 M17 16l4-4-4-4 M21 12H9',
  bandeja: 'M4 13h4l1.5 3h5L16 13h4 M4 13l2-8h12l2 8v6H4z',
  ver: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z',
  ocultar: 'M4 4l16 16 M9.9 5.2A9.6 9.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4 M6.5 7.5A17 17 0 0 0 2 12s3.6 7 10 7c1.4 0 2.6-.3 3.8-.8',
  editar: 'M4 20h4L20 8l-4-4L4 16z',
  sucursal: 'M4 9l8-5 8 5v11H4z M9.5 20v-6h5v6',
  tema: 'M12 3v2 M12 19v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M3 12h2 M19 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
};

@Component({
  selector: 'frc-icono',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="tamano()"
      [attr.height]="tamano()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      @for (d of trazos(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; line-height: 0; }
  `,
})
export class IconoComponent {
  readonly nombre = input.required<string>();
  readonly tamano = input(20);

  readonly trazos = computed(() => {
    const d = TRAZOS[this.nombre()];
    return d ? d.split(' M').map((p, i) => (i === 0 ? p : `M${p}`)) : [];
  });
}

/** Solo para la galería y los tests. */
export function iconosDisponibles(): string[] {
  return Object.keys(TRAZOS);
}
