import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PdfService } from '../core/ui/pdf.service';
import { NotificacionService } from '../core/ui/notificacion.service';

/**
 * Abrir un PDF no es igual en todas las plataformas, y la diferencia no se
 * puede preguntar: Safari no falla, abre algo que no sirve. Estos casos fijan
 * qué camino toma cada una para que no se pierda en el próximo refactor.
 */
describe('PdfService — un camino por plataforma', () => {
  const PDF = btoa('%PDF-1.4 fake');

  let abrir: ReturnType<typeof vi.fn>;
  let notificacion: { ok: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let navegado: string | null;
  let clickeado: HTMLAnchorElement | null;

  const uaOriginal = navigator.userAgent;
  const matchMediaOriginal = window.matchMedia;

  function plataforma(opciones: {
    ua?: string;
    tactil?: number;
    instalada?: boolean;
    popupBloqueado?: boolean;
  }): void {
    Object.defineProperty(navigator, 'userAgent', {
      value: opciones.ua ?? uaOriginal,
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: opciones.tactil ?? 0,
      configurable: true,
    });
    Object.defineProperty(navigator, 'standalone', {
      value: opciones.instalada === true,
      configurable: true,
    });
    window.matchMedia = ((consulta: string) =>
      ({
        matches: opciones.instalada === true && consulta.includes('standalone'),
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    abrir = vi.fn(() => (opciones.popupBloqueado ? null : ({} as Window)));
    window.open = abrir as unknown as typeof window.open;
  }

  beforeEach(() => {
    navegado = null;
    clickeado = null;
    notificacion = { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() };

    URL.createObjectURL = vi.fn(() => 'blob:falso');
    URL.revokeObjectURL = vi.fn();

    // jsdom no navega: se intercepta la asignación para poder afirmarla.
    Object.defineProperty(window, 'location', {
      value: {
        set href(destino: string) {
          navegado = destino;
        },
        get href() {
          return navegado ?? '';
        },
      },
      configurable: true,
    });

    // El click de un <a download> tampoco hace nada en jsdom.
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickeado = this;
    };

    TestBed.configureTestingModule({
      providers: [{ provide: NotificacionService, useValue: notificacion }],
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: uaOriginal, configurable: true });
    window.matchMedia = matchMediaOriginal;
  });

  const servicio = () => TestBed.inject(PdfService);

  it('Android: pestaña nueva', () => {
    plataforma({ ua: 'Mozilla/5.0 (Linux; Android 13) Chrome/120' });
    servicio().abrirBase64(PDF, 'recibo.pdf');

    expect(abrir).toHaveBeenCalledWith('blob:falso', '_blank');
    expect(navegado).toBeNull();
  });

  it('Android con el popup bloqueado: descarga', () => {
    plataforma({ ua: 'Mozilla/5.0 (Linux; Android 13) Chrome/120', popupBloqueado: true });
    servicio().abrirBase64(PDF, 'recibo.pdf');

    expect(clickeado!.download).toBe('recibo.pdf');
  });

  it('iPhone en el navegador: pestaña nueva', () => {
    plataforma({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari' });
    servicio().abrirBase64(PDF, 'recibo.pdf');

    expect(abrir).toHaveBeenCalled();
    expect(navegado).toBeNull();
  });

  it('iPhone con el popup bloqueado: navega en la misma pestaña y avisa', () => {
    plataforma({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari', popupBloqueado: true });
    servicio().abrirBase64(PDF, 'recibo.pdf');

    // `download` no sirve de plan B en iOS: se navega, que es lo que funciona.
    expect(navegado).toBe('blob:falso');
    expect(clickeado).toBeNull();
    expect(notificacion.warn).toHaveBeenCalled();
  });

  it('PWA instalada en iPhone: nunca abre pestaña — se iría a Safari', () => {
    plataforma({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari', instalada: true });
    servicio().abrirBase64(PDF, 'recibo.pdf');

    expect(abrir).not.toHaveBeenCalled();
    expect(navegado).toBe('blob:falso');
  });

  it('iPad se reconoce aunque diga ser un Mac', () => {
    // Desde iPadOS 13 se anuncia como Macintosh; lo delata el táctil.
    plataforma({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', tactil: 5, instalada: true });
    servicio().abrirBase64(PDF, 'recibo.pdf');

    expect(navegado).toBe('blob:falso');
  });

  it('un Mac de verdad no es iOS', () => {
    plataforma({ ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', tactil: 0 });
    servicio().abrirBase64(PDF, 'recibo.pdf');

    expect(abrir).toHaveBeenCalled();
  });

  it('un base64 vacío avisa en vez de abrir una pestaña en blanco', () => {
    plataforma({ ua: 'Mozilla/5.0 (Linux; Android 13) Chrome/120' });
    servicio().abrirBase64('', 'recibo.pdf');

    expect(notificacion.danger).toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('saca el prefijo data: antes de decodificar', () => {
    plataforma({ ua: 'Mozilla/5.0 (Linux; Android 13) Chrome/120' });
    servicio().abrirBase64(`data:application/pdf;base64,${PDF}`, 'recibo.pdf');

    expect(notificacion.danger).not.toHaveBeenCalled();
    expect(abrir).toHaveBeenCalled();
  });
});
