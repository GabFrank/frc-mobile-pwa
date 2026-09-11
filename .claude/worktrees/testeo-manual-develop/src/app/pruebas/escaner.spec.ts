import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EscanerDialogComponent } from '../core/dispositivo/escaner-dialog.component';
import { FORMATOS_QR } from '../core/dispositivo/escaner.types';

/**
 * ZXing es el camino de Safari e iOS. Se reemplaza por un doble para poder
 * ejercitarlo sin cámara: sin esto, el único motor con test sería el de
 * Chromium, que es justo el que **no** hace falta cuidar.
 */
const zxing = vi.hoisted(() => ({
  emitir: null as ((texto: string) => void) | null,
  detener: vi.fn(),
  pistas: null as unknown,
  fallar: false,
}));

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    constructor(pistas?: unknown) {
      zxing.pistas = pistas;
    }
    async decodeFromStream(
      _stream: unknown,
      _video: unknown,
      callback: (resultado?: { getText(): string }) => void,
    ) {
      if (zxing.fallar) {
        throw new Error('sin soporte');
      }
      zxing.emitir = (texto) => callback({ getText: () => texto });
      return { stop: zxing.detener };
    }
  },
}));

vi.mock('@zxing/library', () => ({
  BarcodeFormat: { QR_CODE: 11, EAN_13: 3 },
  DecodeHintType: { POSSIBLE_FORMATS: 2 },
}));

/**
 * El escáner toca tres APIs del navegador que jsdom no trae: `mediaDevices`,
 * `BarcodeDetector` y la reproducción de `<video>`. Se arman acá y se
 * desarman después de cada caso, para que un test no le deje la cámara
 * simulada abierta al siguiente.
 */
describe('Escáner de códigos', () => {
  let detener: ReturnType<typeof vi.fn>;
  let capacidades: { torch?: boolean };
  let restricciones: unknown[];
  let cerrar: ReturnType<typeof vi.fn>;

  const original = {
    mediaDevices: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
    detector: (globalThis as Record<string, unknown>)['BarcodeDetector'],
  };

  /** Stream con una pista de video que registra lo que le aplican. */
  function streamFalso(): MediaStream {
    const pista = {
      stop: detener,
      getCapabilities: () => capacidades,
      applyConstraints: (c: unknown) => {
        restricciones.push(c);
        return Promise.resolve();
      },
    };
    return { getTracks: () => [pista], getVideoTracks: () => [pista] } as unknown as MediaStream;
  }

  function montarCamara(opciones: { getUserMedia?: () => Promise<MediaStream> } = {}): void {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: opciones.getUserMedia ?? (() => Promise.resolve(streamFalso())) },
      configurable: true,
    });
  }

  function montarDetector(codigos: { rawValue?: string }[], formatosSoportados?: string[]): string[] {
    const pedidos: string[] = [];
    class DetectorFalso {
      constructor(opciones: { formats: string[] }) {
        pedidos.push(...opciones.formats);
      }
      detect() {
        return Promise.resolve(codigos);
      }
      static getSupportedFormats() {
        return Promise.resolve(formatosSoportados ?? [...FORMATOS_QR, 'ean_13']);
      }
    }
    (globalThis as Record<string, unknown>)['BarcodeDetector'] = DetectorFalso;
    return pedidos;
  }

  function crear(data: Record<string, unknown> = {}) {
    cerrar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: cerrar } },
      ],
    });
    const f = TestBed.createComponent(EscanerDialogComponent);
    f.detectChanges();
    return f;
  }

  /**
   * Deja correr lo pendiente sin esperar el intervalo real de detección.
   *
   * Alterna micro y macrotareas porque el arranque encadena las dos: los
   * `await` del componente y el `import()` dinámico de ZXing.
   */
  const asentar = async () => {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
    }
  };

  beforeEach(() => {
    detener = vi.fn();
    capacidades = {};
    restricciones = [];
    zxing.emitir = null;
    zxing.pistas = null;
    zxing.fallar = false;
    zxing.detener.mockClear();
    // jsdom no implementa la reproducción ni expone un readyState útil.
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      get: () => 4,
      configurable: true,
    });
  });

  afterEach(() => {
    if (original.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', original.mediaDevices);
    } else {
      delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
    }
    (globalThis as Record<string, unknown>)['BarcodeDetector'] = original.detector;
  });

  it('devuelve el código leído y suelta la cámara', async () => {
    montarCamara();
    montarDetector([{ rawValue: 'frc-1-VENTA_CREDITO-11-0--abc-123' }]);

    crear();
    await asentar();

    expect(cerrar).toHaveBeenCalledWith('frc-1-VENTA_CREDITO-11-0--abc-123');
    // Sin esto el led del teléfono queda prendido después de escanear.
    expect(detener).toHaveBeenCalled();
  });

  it('solo pide los formatos que el navegador declara soportar', async () => {
    montarCamara();
    const pedidos = montarDetector([], ['qr_code']);

    crear({ formatos: ['qr_code', 'formato_inventado'] });
    await asentar();

    // Un formato desconocido en la lista puede hacer fallar el constructor
    // entero: se descarta antes en vez de perder el escaneo completo.
    expect(pedidos).toEqual(['qr_code']);
  });

  it('sin cámara en el navegador ofrece la carga manual', async () => {
    delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
    montarDetector([]);

    const f = crear();
    await asentar();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('no da acceso a la cámara');
    expect(f.nativeElement.querySelector('input')).toBeTruthy();
  });

  it('sin BarcodeDetector lee con ZXing — el camino de iOS', async () => {
    montarCamara();
    delete (globalThis as Record<string, unknown>)['BarcodeDetector'];

    const f = crear({ formatos: ['qr_code'] });
    await asentar();
    f.detectChanges();

    // La cámara arrancó: no cayó en la carga manual.
    expect(f.nativeElement.querySelector('input')).toBeFalsy();
    expect(zxing.emitir).toBeTruthy();

    // Los formatos se acotan también acá: sin eso ZXing prueba todos los
    // decodificadores en cada frame.
    expect((zxing.pistas as Map<number, number[]>).get(2)).toEqual([11]);

    zxing.emitir?.('frc-3-VENTA_CREDITO-11-0--clave-1770000000000');
    expect(cerrar).toHaveBeenCalledWith('frc-3-VENTA_CREDITO-11-0--clave-1770000000000');
    expect(zxing.detener).toHaveBeenCalled();
  });

  it('si tampoco anda ZXing ofrece la carga manual', async () => {
    montarCamara();
    delete (globalThis as Record<string, unknown>)['BarcodeDetector'];
    zxing.fallar = true;

    const f = crear();
    await asentar();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('no puede leer códigos con la cámara');
  });

  it('explica el permiso denegado en vez de decir "algo salió mal"', async () => {
    montarCamara({
      getUserMedia: () => Promise.reject(Object.assign(new Error('denegado'), { name: 'NotAllowedError' })),
    });
    montarDetector([]);

    const f = crear();
    await asentar();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('No diste permiso');
  });

  it('el código cargado a mano sale por el mismo camino', async () => {
    delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
    montarDetector([]);

    const f = crear();
    await asentar();
    f.detectChanges();

    f.componentInstance.codigoManual.set('  7840001  ');
    f.componentInstance.confirmarManual();

    expect(cerrar).toHaveBeenCalledWith('7840001');
  });

  it('no ofrece la linterna si el teléfono no la declara', async () => {
    montarCamara();
    montarDetector([]);

    const f = crear();
    await asentar();
    f.detectChanges();

    expect(f.componentInstance.puedeLinterna()).toBe(false);
  });

  it('prende la linterna cuando la cámara la soporta', async () => {
    capacidades = { torch: true };
    montarCamara();
    montarDetector([]);

    const f = crear();
    await asentar();

    expect(f.componentInstance.puedeLinterna()).toBe(true);
    await f.componentInstance.alternarLinterna();

    expect(restricciones).toEqual([{ advanced: [{ torch: true }] }]);
    expect(f.componentInstance.linterna()).toBe(true);
  });

  it('cancelar cierra sin código y suelta la cámara', async () => {
    montarCamara();
    montarDetector([]);

    const f = crear();
    await asentar();
    f.componentInstance.cancelar();

    expect(cerrar).toHaveBeenCalledWith(undefined);
    expect(detener).toHaveBeenCalled();
  });
});
