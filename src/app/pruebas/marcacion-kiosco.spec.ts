import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { GeoService } from '../core/dispositivo/geo.service';
import { CapturaFacial, ReconocimientoFacialService } from '../core/dispositivo/reconocimiento-facial.service';
import { DatosService } from '../core/graphql/datos.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import {
  AccionMarcacionPendiente,
  EstadoMarcacionUsuario,
  MarcacionInput,
} from '../domains/marcacion/marcacion.model';
import { PERMISOS } from '../domains/personas/roles/permisos';
import { ROLES } from '../domains/personas/roles/roles.enum';
import { Usuario } from '../domains/personas/usuario.model';
import { KioscoMarcacionPage } from '../pages/marcacion/kiosco-marcacion.page';
import { MarcacionService } from '../pages/marcacion/marcacion.service';
import { UsuarioPorEmbeddingGQL } from '../graphql/personas/usuario/graphql/usuarioPorEmbedding';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * El kiosco de marcación: un dispositivo compartido en la puerta.
 *
 * ⚠️ **Acá el 1:N sí marca por otra persona**, que es justamente para lo que
 * existe. En el teléfono personal se decidió que no: si identifica a alguien
 * distinto del de la sesión, se rechaza. Ver la issue #17.
 */
describe('Kiosco de marcación', () => {
  const ROSTRO = [1, 0, 0, 0, 0, 0, 0, 0];
  const NADIE = [0, 1, 0, 0, 0, 0, 0, 0];

  const galeriaDe = (embedding: number[]) =>
    JSON.stringify({ master: embedding, gallery: [{ pose: 'front', embedding, score: 0.9 }] });

  const FULANO = {
    id: 7,
    nickname: 'FULANO',
    persona: { id: 70, nombre: 'Fulano de Tal', embeddingFacial: galeriaDe(ROSTRO) },
  };

  const ROTONDA = {
    id: 3,
    nombre: 'SUC. ROTONDA',
    deposito: true,
    activo: true,
    localizacion: '-25.5,-54.6',
  };

  const entradaPendiente: EstadoMarcacionUsuario = {
    accionPendiente: AccionMarcacionPendiente.ENTRADA,
    estaEnJornada: false,
    puedeMarcarEntrada: true,
    puedeMarcarSalida: false,
    puedeMarcarSalidaAlmuerzo: false,
    puedeMarcarEntradaAlmuerzo: false,
  };

  const dosSalidas: EstadoMarcacionUsuario = {
    accionPendiente: AccionMarcacionPendiente.SALIDA,
    estaEnJornada: true,
    puedeMarcarEntrada: false,
    puedeMarcarSalida: true,
    puedeMarcarSalidaAlmuerzo: true,
    puedeMarcarEntradaAlmuerzo: false,
  };

  let guardado: MarcacionInput | undefined;
  let servicio: { estado: ReturnType<typeof vi.fn>; guardar: ReturnType<typeof vi.fn> };
  let identificado: { usuario?: unknown; similitud?: number } | null;
  let estadoDevuelto: EstadoMarcacionUsuario;
  let posicion: { latitud: number; longitud: number; precision: number; lecturas: number } | null;
  let sucursales: unknown[];
  let detectar: ReturnType<typeof vi.fn>;
  let detenerCamara: ReturnType<typeof vi.fn>;
  let terminarCarga: () => void;

  const original = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

  const captura = (cambios: Partial<CapturaFacial> = {}): CapturaFacial => ({
    embedding: ROSTRO,
    score: 0.9,
    real: 0.9,
    live: 0.9,
    box: [0, 0, 10, 10],
    ...cambios,
  });

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const microtareas = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  const asentar = async (f: { detectChanges: () => void }, ms = 0) => {
    await microtareas();
    if (ms > 0) {
      await vi.advanceTimersByTimeAsync(ms);
    }
    await microtareas();
    f.detectChanges();
  };

  const crear = () => {
    const haversine = new GeoService();

    TestBed.configureTestingModule({
      imports: APOLLO_DE_PRUEBA,
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MarcacionService, useValue: servicio },
        { provide: SucursalService, useValue: { todas: () => of(sucursales) } },
        { provide: UsuarioPorEmbeddingGQL, useValue: {} },
        {
          provide: GeoService,
          useValue: {
            posicionActual: () => Promise.resolve(posicion),
            distanciaMetros: haversine.distanciaMetros.bind(haversine),
          },
        },
        {
          provide: DatosService,
          useValue: { consultar: () => of(identificado) },
        },
        {
          provide: ReconocimientoFacialService,
          useValue: {
            cargar: () => new Promise<void>((r) => (terminarCarga = r)),
            detectar,
            liberar: vi.fn(),
          },
        },
      ],
    });
    // En la tablet hay una sesión, la del encargado. Lo que se prueba es que
    // la marcación **no** salga a nombre suyo.
    TestBed.inject(AuthService).establecerUsuario(Object.assign(new Usuario(), { id: 99 }));

    const f = TestBed.createComponent(KioscoMarcacionPage);
    f.detectChanges();
    return f;
  };

  /** Monta, deja detectada la sucursal y lista la cámara. */
  const listo = async () => {
    const f = crear();
    await asentar(f);
    terminarCarga?.();
    await asentar(f);
    return f;
  };

  /** El botón cuyo texto coincide, o `undefined`. */
  const boton = (
    f: { nativeElement: HTMLElement },
    etiqueta: string,
  ): HTMLButtonElement | undefined =>
    Array.from(f.nativeElement.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => (b.textContent ?? '').trim() === etiqueta,
    );

  const tocar = async (f: { nativeElement: HTMLElement; detectChanges: () => void }, etiqueta: string) => {
    const b = boton(f, etiqueta);
    expect(b, `no existe el botón «${etiqueta}»`).toBeTruthy();
    b!.click();
    await asentar(f);
  };

  /** Deja que la cuenta llegue a cero y que la tanda de frames termine. */
  const sacarFoto = async (f: { detectChanges: () => void }) => {
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(600);
    await microtareas();
    f.detectChanges();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    guardado = undefined;
    identificado = { usuario: FULANO, similitud: 0.9 };
    estadoDevuelto = entradaPendiente;
    posicion = { latitud: -25.5, longitud: -54.6, precision: 4, lecturas: 3 };
    sucursales = [ROTONDA];
    detectar = vi.fn(() => Promise.resolve(captura()));
    detenerCamara = vi.fn();

    servicio = {
      estado: vi.fn(() => of(estadoDevuelto)),
      guardar: vi.fn((input: MarcacionInput) => {
        guardado = input;
        return of({});
      }),
    };

    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop: detenerCamara }] }) },
      configurable: true,
    });
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
      get: () => 4,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (original) {
      Object.defineProperty(navigator, 'mediaDevices', original);
    } else {
      delete (navigator as unknown as Record<string, unknown>)['mediaDevices'];
    }
  });

  it('el kiosco pide rol, a diferencia de la marcación propia', () => {
    // Marcación no lleva rol porque cada uno ve lo suyo. El kiosco marca
    // **por otros**, así que esa premisa no lo cubre.
    expect(PERMISOS.kioscoMarcacion).toContain(ROLES.ADMIN);
    expect(PERMISOS.kioscoMarcacion.length).toBeGreaterThan(1);
  });

  it('muestra la sucursal que detectó el GPS', async () => {
    const f = await listo();

    expect(texto(f)).toContain('SUC. ROTONDA');
  });

  it('sin sucursal detectada no se puede marcar', async () => {
    posicion = null;

    const f = await listo();

    expect(boton(f, 'Marcar')?.disabled).toBe(true);
  });

  it('identifica y saluda por nombre', async () => {
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    expect(texto(f)).toContain('Fulano de Tal');
  });

  it('marca por la persona identificada, no por la de la sesión', async () => {
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    expect(guardado?.usuarioId).toBe(7);
  });

  it('pregunta el estado de la persona identificada, no el de la sesión', async () => {
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    expect(servicio.estado).toHaveBeenCalledWith(7);
  });

  it('la marcación lleva la sucursal detectada', async () => {
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    expect(guardado?.sucursalId).toBe(3);
  });

  it('si el central no reconoce a nadie, lo dice y no marca', async () => {
    identificado = null;
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    expect(servicio.guardar).not.toHaveBeenCalled();
    expect(texto(f)).toContain('No te reconocimos');
  });

  it('si el central reconoce pero acá no coincide, no marca', async () => {
    // El central dice 0,9; recalculado contra la galería que vino, el rostro
    // capturado es de otra persona. Es el doble control.
    detectar = vi.fn(() => Promise.resolve(captura({ embedding: NADIE })));
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    expect(servicio.guardar).not.toHaveBeenCalled();
    expect(texto(f)).toContain('seguros');
  });

  it('una identificación floja del central tampoco marca', async () => {
    identificado = { usuario: FULANO, similitud: 0.4 };
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    expect(servicio.guardar).not.toHaveBeenCalled();
  });

  it('después del saludo vuelve solo a inicio, listo para el siguiente', async () => {
    const f = await listo();
    await tocar(f, 'Marcar');
    await sacarFoto(f);

    await asentar(f, 5000);

    expect(f.componentInstance.fase()).toBe('inicio');
  });

  it('con las dos salidas habilitadas, pregunta cuál en vez de elegir', async () => {
    estadoDevuelto = dosSalidas;
    const f = await listo();

    await tocar(f, 'Marcar');
    await sacarFoto(f);

    // Elegir por la persona deja la jornada abierta o la cierra sin que se
    // haya pedido. El central manda los dos flags justamente para desambiguar.
    expect(servicio.guardar).not.toHaveBeenCalled();
    expect(texto(f)).toContain('almorzar');
  });

  it('elegida la salida, marca con el flag que corresponde', async () => {
    estadoDevuelto = dosSalidas;
    const f = await listo();
    await tocar(f, 'Marcar');
    await sacarFoto(f);

    await tocar(f, 'Salir a almorzar');

    expect(guardado?.usuarioId).toBe(7);
    expect(guardado?.esSalidaAlmuerzo).toBe(true);
  });
});
