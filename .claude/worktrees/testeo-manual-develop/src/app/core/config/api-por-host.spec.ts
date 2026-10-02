import { describe, expect, it } from 'vitest';

import { API_POR_HOST, apiParaHost } from './api-por-host';

describe('apiParaHost', () => {
  it('cada puerta apunta a su instancia', () => {
    expect(apiParaHost('farmacia.app.frcsuite.com')).toBe('https://farmacia-api.frcsuite.com');
    expect(apiParaHost('bodega.app.frcsuite.com')).toBe('https://bodega-api.frcsuite.com');
    expect(apiParaHost('alpha.app.frcsuite.com')).toBe('https://alpha-api.frcsuite.com');
  });

  it('un host desconocido devuelve null, no producción', () => {
    // Una preview de Pages, un dominio apuntado por alguien, un localhost.
    // Defaultear a producción sería la clase de decisión que nadie recuerda
    // haber tomado hasta que una prueba escribe en la base equivocada.
    expect(apiParaHost('abc123.frc-pwa-alpha.pages.dev')).toBeNull();
    expect(apiParaHost('localhost')).toBeNull();
  });

  it('ninguna puerta apunta a una API por HTTP', () => {
    // La PWA se sirve por HTTPS: una API en HTTP plano la bloquea el navegador
    // por mixed content antes de que la request salga.
    for (const api of Object.values(API_POR_HOST)) {
      expect(api.startsWith('https://')).toBe(true);
    }
  });

  it('ninguna URL termina en barra', () => {
    // `ServerConfigService` concatena `/graphql` directamente.
    for (const api of Object.values(API_POR_HOST)) {
      expect(api.endsWith('/')).toBe(false);
    }
  });
});
