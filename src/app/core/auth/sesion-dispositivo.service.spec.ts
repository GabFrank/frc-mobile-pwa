import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InicioSesion } from 'src/app/domains/configuracion/inicio-sesion.model';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { InicioSesionListPorUsuarioIdAndAbiertoGQL } from 'src/app/graphql/personas/usuario/graphql/inicioSesionPorUsuarioIdAndAbierto';
import { SaveInicioSesionGQL } from 'src/app/graphql/personas/usuario/graphql/saveInicioSesion';
import { DatosService } from '../graphql/datos.service';
import { PushService } from '../notificaciones/push.service';
import { SesionDispositivoService } from './sesion-dispositivo.service';

const ESTE_APARATO = 'aparato-pwa';

function sesion(datos: Partial<InicioSesion>): InicioSesion {
  return Object.assign(new InicioSesion(), datos);
}

describe('SesionDispositivoService', () => {
  let servicio: SesionDispositivoService;
  let mutar: ReturnType<typeof vi.fn>;
  let porId: ReturnType<typeof vi.fn>;
  let sincronizar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('frc.idDispositivo', ESTE_APARATO);
    mutar = vi.fn(() => of(sesion({ id: 1 })));
    porId = vi.fn(() => of({ getContent: [] }));
    sincronizar = vi.fn(() => Promise.resolve());

    TestBed.configureTestingModule({
      providers: [
        SesionDispositivoService,
        { provide: DatosService, useValue: { mutar, porId } },
        { provide: SaveInicioSesionGQL, useValue: { document: {} } },
        { provide: InicioSesionListPorUsuarioIdAndAbiertoGQL, useValue: { document: {} } },
        { provide: PushService, useValue: { sincronizar } },
      ],
    });
    servicio = TestBed.inject(SesionDispositivoService);
  });

  const guardada = () => (mutar.mock.calls[0][1] as { entity: Record<string, unknown> }).entity;

  it('reusa la sesión de este aparato aunque la última del usuario sea de otro', async () => {
    // El central devuelve en `usuario.inicioSesion` la última sesión abierta
    // de cualquier aparato: acá, la del desktop.
    const usuario = Object.assign(new Usuario(), {
      id: 42,
      inicioSesion: sesion({ id: 901, idDispositivo: 'desktop', token: 'token-desktop', sucursal: { id: 1 } as never }),
    });
    porId.mockReturnValue(
      of({
        getContent: [
          sesion({ id: 901, idDispositivo: 'desktop', token: 'token-desktop' }),
          sesion({ id: 777, idDispositivo: ESTE_APARATO, token: 'token-pwa', sucursal: { id: 5 } as never }),
        ],
      }),
    );

    await servicio.registrar(usuario);

    expect(guardada()['id']).toBe(777);
    expect(guardada()['token']).toBe('token-pwa');
    // La clave de inicio_sesion es (id, sucursal): mezclar el id de una fila
    // con la sucursal de otra crearía una fila nueva en vez de reusarla.
    expect(guardada()['sucursalId']).toBe(5);
  });

  it('no consulta nada si la sesión que trajo el login ya es de este aparato', async () => {
    const usuario = Object.assign(new Usuario(), {
      id: 42,
      inicioSesion: sesion({ id: 777, idDispositivo: ESTE_APARATO, token: 'token-pwa' }),
    });

    await servicio.registrar(usuario);

    expect(porId).not.toHaveBeenCalled();
    expect(guardada()['id']).toBe(777);
    expect(guardada()['token']).toBe('token-pwa');
  });

  it('crea una sesión nueva si este aparato no tiene ninguna abierta', async () => {
    const usuario = Object.assign(new Usuario(), {
      id: 42,
      inicioSesion: sesion({ id: 901, idDispositivo: 'desktop', token: 'token-desktop' }),
    });

    await servicio.registrar(usuario);

    expect(guardada()['id']).toBeUndefined();
    expect(guardada()['token']).toBeUndefined();
  });

  it('si la búsqueda falla igual registra la sesión', async () => {
    porId.mockReturnValue(throwError(() => new Error('sin red')));
    const usuario = Object.assign(new Usuario(), { id: 42 });

    await servicio.registrar(usuario);

    expect(mutar).toHaveBeenCalledTimes(1);
  });

  it('después de registrar la sesión resincroniza el push', async () => {
    await servicio.registrar(Object.assign(new Usuario(), { id: 42 }));
    expect(sincronizar).toHaveBeenCalledTimes(1);
  });

  it('si no pudo registrar la sesión no manda el token', async () => {
    // Sin la fila de este aparato, el central escribe el token en la primera
    // sesión abierta del usuario, que puede ser la de otro aparato.
    mutar.mockReturnValue(throwError(() => new Error('central caído')));
    await servicio.registrar(Object.assign(new Usuario(), { id: 42 }));
    expect(sincronizar).not.toHaveBeenCalled();
  });
});
