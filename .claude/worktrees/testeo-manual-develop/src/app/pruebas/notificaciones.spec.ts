import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificacionService } from '../core/ui/notificacion.service';
import {
  DESCRIPCION_POR_TIPO,
  NotificacionComentario,
  descripcionDeTipo,
} from '../domains/notificacion/notificacion.model';
import { ComentariosPage } from '../pages/notificaciones/comentarios.page';
import { NotificacionesService } from '../pages/notificaciones/notificacion.service';
import { PreferenciasPage } from '../pages/notificaciones/preferencias.page';

describe('Tipos de notificación', () => {
  it('describe los tipos conocidos', () => {
    expect(descripcionDeTipo('DIFERENCIA_MALETIN')).toBe(DESCRIPCION_POR_TIPO['DIFERENCIA_MALETIN']);
  });

  it('un tipo nuevo del backend no deja la fila vacía', () => {
    // El mapa vive en el cliente pero `tipo` es un string libre: un tipo que
    // el central agregue no está acá hasta que alguien lo sume.
    expect(descripcionDeTipo('ALGO_NUEVO_DEL_CENTRAL')).toBe('Algo nuevo del central');
  });

  it('sin tipo tampoco', () => {
    expect(descripcionDeTipo(null)).toBe('Notificación');
    expect(descripcionDeTipo(undefined)).toBe('Notificación');
  });
});

describe('Hilo de comentarios', () => {
  let servicio: {
    comentarios: ReturnType<typeof vi.fn>;
    comentar: ReturnType<typeof vi.fn>;
  };

  const comentario = (id: number, padreId?: number): NotificacionComentario => ({
    id,
    comentario: `texto ${id}`,
    creadoEn: '2026-08-05T10:00',
    usuario: { id: 1, nickname: 'gabriel' } as never,
    comentarioPadre: padreId != null ? { id: padreId } : undefined,
  });

  beforeEach(() => {
    servicio = {
      comentarios: vi.fn(() => of([])),
      comentar: vi.fn(() => of(comentario(99))),
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: NotificacionesService, useValue: servicio }],
    });
  });

  const montar = (id = '5') => {
    const f = TestBed.createComponent(ComentariosPage);
    f.componentRef.setInput('id', id);
    f.detectChanges();
    return f;
  };

  it('agrupa los comentarios planos en padre y respuestas', () => {
    // El backend los devuelve planos; el árbol se arma acá.
    servicio.comentarios.mockReturnValue(
      of([comentario(1), comentario(2, 1), comentario(3), comentario(4, 1)]),
    );
    const f = montar();

    const hilos = f.componentInstance.hilos();
    expect(hilos.map((h) => h.comentario.id)).toEqual([1, 3]);
    expect(hilos[0].respuestas.map((r) => r.id)).toEqual([2, 4]);
    expect(hilos[1].respuestas).toEqual([]);
  });

  it('responder a una respuesta engancha al mismo padre, no anida más', () => {
    servicio.comentarios.mockReturnValue(of([comentario(1), comentario(2, 1)]));
    const f = montar();

    f.componentInstance.responder(comentario(2, 1));
    f.componentInstance.texto.set('mi respuesta');
    f.componentInstance.enviar();

    // Tres niveles de sangría en un teléfono dejan el texto en una columna
    // de cinco caracteres.
    expect(servicio.comentar).toHaveBeenCalledWith(5, 'mi respuesta', 1);
  });

  it('un comentario raíz se manda sin padre', () => {
    const f = montar();
    f.componentInstance.texto.set('primero');
    f.componentInstance.enviar();

    expect(servicio.comentar).toHaveBeenCalledWith(5, 'primero', undefined);
  });

  it('no manda un comentario vacío', () => {
    const f = montar();
    f.componentInstance.texto.set('   ');
    f.componentInstance.enviar();

    expect(servicio.comentar).not.toHaveBeenCalled();
  });
});

describe('Preferencias de notificación', () => {
  let servicio: {
    configuraciones: ReturnType<typeof vi.fn>;
    cambiarPreferencia: ReturnType<typeof vi.fn>;
  };
  let avisos: { ok: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };

  const OBLIGATORIA = {
    tipo: 'DIFERENCIA_MALETIN',
    descripcion: 'Diferencia en maletín',
    habilitado: true,
    esObligatorio: true,
  };
  const OPCIONAL = {
    tipo: 'RETIRO',
    descripcion: 'Retiro en sucursal',
    habilitado: true,
    esObligatorio: false,
  };

  beforeEach(() => {
    servicio = {
      configuraciones: vi.fn(() => of([OBLIGATORIA, OPCIONAL])),
      cambiarPreferencia: vi.fn(() => of(true)),
    };
    avisos = { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificacionesService, useValue: servicio },
        { provide: NotificacionService, useValue: avisos },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(PreferenciasPage);
    f.detectChanges();
    return f;
  };

  it('las obligatorias se muestran, no se ocultan', () => {
    const f = montar();

    // Esconderlas haría creer que el aviso no va a llegar.
    expect(f.nativeElement.textContent).toContain('Diferencia en maletín');
    expect(f.nativeElement.textContent).toContain('Siempre se envía');
  });

  it('una obligatoria no se puede apagar', () => {
    const f = montar();
    f.componentInstance.cambiar(OBLIGATORIA, false);

    expect(servicio.cambiarPreferencia).not.toHaveBeenCalled();
  });

  it('apagar una opcional la manda al backend', () => {
    const f = montar();
    f.componentInstance.cambiar(OPCIONAL, false);

    expect(servicio.cambiarPreferencia).toHaveBeenCalledWith('RETIRO', false);
    expect(f.componentInstance.configuraciones().find((c) => c.tipo === 'RETIRO')?.habilitado).toBe(
      false,
    );
  });

  it('la lista se ordena por su etiqueta', () => {
    // El central la arma desde un HashMap: sin ordenar, los interruptores
    // saltan de lugar entre una entrada y la siguiente.
    servicio.configuraciones.mockReturnValue(of([OPCIONAL, OBLIGATORIA]));
    const f = montar();

    expect(f.componentInstance.configuraciones().map((c) => c.tipo)).toEqual([
      'DIFERENCIA_MALETIN',
      'RETIRO',
    ]);
  });

  it('sin descripcion del central, la fila usa la del tipo', () => {
    servicio.configuraciones.mockReturnValue(of([{ ...OPCIONAL, descripcion: undefined }]));
    const f = montar();

    expect(f.nativeElement.textContent).toContain(DESCRIPCION_POR_TIPO['RETIRO']);
  });

  it('si el backend rechaza, el interruptor vuelve', () => {
    servicio.cambiarPreferencia.mockReturnValue(throwError(() => new Error('no')));
    const f = montar();
    f.componentInstance.cambiar(OPCIONAL, false);

    // Dejarlo apagado dejaría la pantalla mintiendo.
    expect(f.componentInstance.configuraciones().find((c) => c.tipo === 'RETIRO')?.habilitado).toBe(
      true,
    );
    expect(avisos.danger).toHaveBeenCalled();
  });
});
