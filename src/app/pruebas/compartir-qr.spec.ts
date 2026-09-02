import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CompartirService } from '../core/dispositivo/compartir.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { enlaceAlRegistro } from '../core/dispositivo/escaneo-ruteo';
import { nombreImagenQr, textoParaCompartir } from '../shared/qr/qr-imagen';

/**
 * Compartir el QR por WhatsApp es lo que hacía `frc-mobile` con
 * `@capacitor/share`. Acá lo hace la hoja del sistema, que **no está en el
 * escritorio** y que rechaza la promesa también cuando el usuario se
 * arrepiente. Estos casos fijan qué camino toma cada situación, y sobre todo
 * que ninguno termine en una descarga: bajar el PNG y no abrir nada es lo
 * que se leyó como «no comparte».
 */
describe('CompartirService — la hoja del sistema y sus planes B', () => {
  let notificacion: {
    ok: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
    neutral: ReturnType<typeof vi.fn>;
  };
  let compartido: ShareData | null;
  let clickeado: HTMLAnchorElement | null;
  let navegado: string | null;
  let abierto: string | null;

  const uaOriginal = navigator.userAgent;

  const archivo = () => ({
    blob: new Blob(['png falso'], { type: 'image/png' }),
    nombre: 'transferencia-54061.png',
  });

  /**
   * `hoja`: qué ofrece el sistema. `undefined` = no hay `navigator.share`,
   * como en Firefox de escritorio.
   */
  function sistema(opciones: {
    hoja?: 'con-archivos' | 'solo-texto';
    resultado?: 'ok' | 'cancelado' | 'error';
    ios?: boolean;
    popupBloqueado?: boolean;
  }): void {
    window.open = ((url: string) => {
      abierto = url;
      return opciones.popupBloqueado ? null : ({} as Window);
    }) as unknown as typeof window.open;

    Object.defineProperty(navigator, 'userAgent', {
      value: opciones.ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari' : uaOriginal,
      configurable: true,
    });

    if (!opciones.hoja) {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      return;
    }

    Object.defineProperty(navigator, 'canShare', {
      value: (datos: ShareData) => !datos.files?.length || opciones.hoja === 'con-archivos',
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: (datos: ShareData) => {
        compartido = datos;
        if (opciones.resultado === 'cancelado') {
          const abortada = new Error('cancelado');
          abortada.name = 'AbortError';
          return Promise.reject(abortada);
        }
        if (opciones.resultado === 'error') {
          return Promise.reject(new Error('la hoja explotó'));
        }
        return Promise.resolve();
      },
      configurable: true,
    });
  }

  beforeEach(() => {
    compartido = null;
    clickeado = null;
    navegado = null;
    abierto = null;
    notificacion = { ok: vi.fn(), warn: vi.fn(), danger: vi.fn(), neutral: vi.fn() };

    URL.createObjectURL = vi.fn(() => 'blob:falso');
    URL.revokeObjectURL = vi.fn();

    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clickeado = this;
    };

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

    TestBed.configureTestingModule({
      providers: [{ provide: NotificacionService, useValue: notificacion }],
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: uaOriginal, configurable: true });
  });

  const servicio = () => TestBed.inject(CompartirService);

  const datos = () => ({ titulo: 'Compartir transferencia', texto: 'Transferencia #54061', archivo: archivo() });

  it('el teléfono adjunta la imagen: eso es lo que llega a WhatsApp', async () => {
    sistema({ hoja: 'con-archivos' });

    expect(await servicio().compartir(datos())).toBe('compartido');
    expect(compartido!.files).toHaveLength(1);
    expect(compartido!.files![0].name).toBe('transferencia-54061.png');
    expect(compartido!.files![0].type).toBe('image/png');
  });

  it('sin soporte de archivos manda el texto igual — el código se puede pegar a mano', async () => {
    sistema({ hoja: 'solo-texto' });

    expect(await servicio().compartir(datos())).toBe('compartido');
    expect(compartido!.files).toBeUndefined();
    expect(compartido!.text).toBe('Transferencia #54061');
  });

  it('cerrar la hoja no es un error', async () => {
    sistema({ hoja: 'con-archivos', resultado: 'cancelado' });

    expect(await servicio().compartir(datos())).toBe('cancelado');
    expect(notificacion.danger).not.toHaveBeenCalled();
    // Y no cae a la descarga: el usuario no pidió un archivo.
    expect(clickeado).toBeNull();
  });

  it('sin hoja de compartir —el escritorio— abre WhatsApp, NO descarga', async () => {
    // Es el caso que motivó todo esto: Chrome de Linux no tiene
    // `navigator.share`, y la versión anterior bajaba el PNG y no abría nada.
    sistema({});

    expect(await servicio().compartir(datos())).toBe('whatsapp');
    expect(abierto).toContain('https://wa.me/?text=');
    expect(decodeURIComponent(abierto!)).toContain('Transferencia #54061');
    expect(clickeado).toBeNull();
  });

  it('si la hoja falla de verdad, también termina en WhatsApp', async () => {
    sistema({ hoja: 'con-archivos', resultado: 'error' });

    expect(await servicio().compartir(datos())).toBe('whatsapp');
    expect(abierto).toContain('wa.me');
  });

  it('con el popup bloqueado navega igual: nunca se queda sin hacer nada', async () => {
    sistema({ popupBloqueado: true });

    expect(await servicio().compartir(datos())).toBe('whatsapp');
    expect(navegado).toContain('wa.me');
  });

  it('sin archivo tampoco descarga: abre WhatsApp con el texto', async () => {
    sistema({});

    expect(await servicio().compartir({ titulo: 'Algo', texto: 'x' })).toBe('whatsapp');
    expect(decodeURIComponent(abierto!)).toContain('x');
  });
});

describe('El enlace al registro', () => {
  // El enlace es lo que hace útil el mensaje cuando el otro lo lee desde la
  // computadora: ahí no hay cámara con qué escanear el QR.
  it('sale la misma ruta a la que llega el que escanea', () => {
    expect(enlaceAlRegistro('frc--TRF-54061-54061---')).toContain('/transferencias/54061');
    expect(enlaceAlRegistro('frc-1-INV--2335---')).toContain('/inventario/2335');
    expect(enlaceAlRegistro('frc-1-REC_MERC-431-431---')).toContain('/operaciones/recepcion/431');
  });

  it('un QR que no abre ninguna pantalla no da enlace', () => {
    expect(enlaceAlRegistro('7790001234567')).toBeNull();
    expect(enlaceAlRegistro('frc--TRF------')).toBeNull();
  });

  it('el retiro de caja chica NO da enlace: su token quedaría escrito en el chat', () => {
    // `frc-{sucursalCaja}-PRE_GASTO_RETIRO-{preGastoId}-{sucursalId}-{token}-{ts}`
    expect(enlaceAlRegistro('frc-1-PRE_GASTO_RETIRO-88-3-tok3n-1700000000')).toBeNull();
  });
});

describe('El mensaje y el nombre del archivo', () => {
  it('el nombre identifica el registro: en la galería del otro no quedan cinco «image.png»', () => {
    expect(nombreImagenQr('Transferencia #54061')).toBe('transferencia-54061.png');
    expect(nombreImagenQr('Recepción #431')).toBe('recepcion-431.png');
    expect(nombreImagenQr('')).toBe('qr.png');
  });

  it('con enlace, es lo primero que el otro puede tocar', () => {
    const texto = textoParaCompartir('Inventario #2335', 'frc-1-INV--2335---', 'https://x.test/inventario/2335');

    expect(texto).toContain('Inventario #2335');
    expect(texto).toContain('https://x.test/inventario/2335');
    // El código sigue estando: es la salida para el que no puede tocar nada.
    expect(texto).toContain('frc-1-INV--2335---');
  });

  it('sin enlace, el mensaje sigue sirviendo con el código solo', () => {
    const texto = textoParaCompartir('Inventario #2335', 'A-B-C');

    expect(texto).toContain('Inventario #2335');
    expect(texto).toContain('A-B-C');
    expect(texto).not.toContain('http');
  });
});
