import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AUTH_TOKEN_KEY, AUTH_USER_ID_KEY } from '../auth/auth.tokens';
import { ServerConfigService } from './server-config.service';

describe('ServerConfigService', () => {
  let config: ServerConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    config = TestBed.inject(ServerConfigService);
  });

  it('arma las URLs a partir de la base', () => {
    config.cambiarServidor('https://alpha.ejemplo.com');
    expect(config.graphqlUrl).toBe('https://alpha.ejemplo.com/graphql');
    expect(config.loginUrl).toBe('https://alpha.ejemplo.com/login');
  });

  it('convierte http/https a ws/wss en las suscripciones', () => {
    config.cambiarServidor('https://alpha.ejemplo.com');
    expect(config.subscriptionsUrl).toBe('wss://alpha.ejemplo.com/subscriptions');

    config.cambiarServidor('http://192.168.0.10:8083');
    expect(config.subscriptionsUrl).toBe('ws://192.168.0.10:8083/subscriptions');
  });

  it('normaliza la barra final', () => {
    config.cambiarServidor('https://alpha.ejemplo.com///');
    expect(config.baseUrl()).toBe('https://alpha.ejemplo.com');
  });

  it('invalida la sesión al cambiar de instancia', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'token-viejo');
    localStorage.setItem(AUTH_USER_ID_KEY, '42');

    config.cambiarServidor('https://otra.ejemplo.com');

    // El token de una instancia no vale en otra: seguir mandándolo produce
    // 401 que parecen "contraseña incorrecta".
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_ID_KEY)).toBeNull();
  });

  it('no invalida la sesión si el servidor no cambió', () => {
    const actual = config.baseUrl();
    localStorage.setItem(AUTH_TOKEN_KEY, 'token');
    config.cambiarServidor(actual);
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('token');
  });
});
