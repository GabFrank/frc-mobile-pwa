import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActualizarTokenFcmGQL } from 'src/app/graphql/personas/usuario/graphql/actualizarTokenFcm';
import { DatosService } from '../graphql/datos.service';
import { PushService } from './push.service';

/**
 * `sincronizar` corre en cada arranque, sin que nadie toque nada. Lo que se
 * prueba es que vuelve a mandar el token cuando el permiso ya está concedido,
 * y que nunca pide permiso ni molesta a la persona.
 */
describe('PushService.sincronizar', () => {
  let push: PushService;
  let mutar: ReturnType<typeof vi.fn>;
  let requestPermission: ReturnType<typeof vi.fn>;

  function conPermiso(permission: NotificationPermission): void {
    requestPermission = vi.fn(() => Promise.resolve(permission));
    vi.stubGlobal('Notification', { permission, requestPermission });
  }

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('frc.idDispositivo', 'aparato-pwa');
    conPermiso('granted');
    if (!('PushManager' in window)) {
      vi.stubGlobal('PushManager', function PushManager() {});
    }
    if (!('serviceWorker' in navigator)) {
      Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true });
    }
    mutar = vi.fn(() => of(true));

    TestBed.configureTestingModule({
      providers: [
        PushService,
        { provide: DatosService, useValue: { mutar } },
        { provide: ActualizarTokenFcmGQL, useValue: { document: {} } },
      ],
    });
    push = TestBed.inject(PushService);
  });

  afterEach(() => vi.unstubAllGlobals());

  const acunar = (resultado: () => Promise<string | null>) =>
    vi.spyOn(push as unknown as { acunarToken: () => Promise<string | null> }, 'acunarToken').mockImplementation(resultado);

  it('con el permiso concedido vuelve a mandar el token y queda activo', async () => {
    acunar(() => Promise.resolve('token-nuevo'));

    await push.sincronizar();

    expect(mutar).toHaveBeenCalledTimes(1);
    expect(mutar.mock.calls[0][1]).toEqual({ tokenFcm: 'token-nuevo', idDispositivo: 'aparato-pwa' });
    expect(push.estado()).toBe('activo');
  });

  it('sin permiso concedido no hace nada y no lo pide', async () => {
    conPermiso('default');
    const acunarToken = acunar(() => Promise.resolve('token'));

    await push.sincronizar();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(acunarToken).not.toHaveBeenCalled();
    expect(mutar).not.toHaveBeenCalled();
  });

  it('si falla no rompe el arranque ni muestra error', async () => {
    acunar(() => Promise.reject(new Error('sin service worker')));

    await expect(push.sincronizar()).resolves.toBeUndefined();

    expect(push.error()).toBeNull();
    expect(push.estado()).toBe('desactivado');
  });

  it('si el central rechaza el token no queda como activo', async () => {
    acunar(() => Promise.resolve('token'));
    mutar.mockReturnValue(throwError(() => new Error('central caído')));

    await push.sincronizar();

    expect(push.estado()).toBe('desactivado');
  });
});
