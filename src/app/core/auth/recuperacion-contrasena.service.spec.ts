import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ServerConfigService } from '../config/server-config.service';
import { mensajeDeRecuperacion, RecuperacionContrasenaService } from './recuperacion-contrasena.service';

describe('RecuperacionContrasenaService', () => {
  let servicio: RecuperacionContrasenaService;
  let http: HttpTestingController;
  let base: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(RecuperacionContrasenaService);
    http = TestBed.inject(HttpTestingController);
    base = TestBed.inject(ServerConfigService).baseUrl() + '/public/recuperacion-contrasena';
  });

  afterEach(() => http.verify());

  it('pide el captcha por GET, sin token', async () => {
    const promesa = servicio.captcha();
    const req = http.expectOne(base + '/captcha');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ id: 'c1', imagen: 'AAA' });
    expect(await promesa).toEqual({ id: 'c1', imagen: 'AAA' });
  });

  it('manda el cuerpo que espera el central al restablecer', async () => {
    const promesa = servicio.restablecer(9, 'ABCD-EFGH', '1234567', 'nueva');
    const req = http.expectOne(base + '/restablecer');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      solicitudId: 9,
      codigo: 'ABCD-EFGH',
      documento: '1234567',
      nuevaContrasena: 'nueva',
    });
    req.flush({ solicitudId: 9, tipo: 'RRHH', estado: 'COMPLETADA', puedeRestablecer: false, mensaje: 'ok' });
    expect((await promesa).estado).toBe('COMPLETADA');
  });

  it('rechaza con el mensaje del central', async () => {
    const promesa = servicio.verificar('X', '1', 'c', 'abcde');
    http
      .expectOne(base + '/verificar')
      .flush({ message: 'Los datos no coinciden.' }, { status: 400, statusText: 'Bad Request' });
    await expect(promesa).rejects.toThrow('Los datos no coinciden.');
    await expect(promesa).rejects.toMatchObject({ rechazado: true });
  });

  it('un 5xx no es un rechazo: no se sabe si se aplicó', async () => {
    const promesa = servicio.restablecer(9, 'c', null, 'nueva');
    http.expectOne(base + '/restablecer').flush('<html>', { status: 502, statusText: 'Bad Gateway' });
    await expect(promesa).rejects.toMatchObject({ rechazado: false });
  });
});

describe('mensajeDeRecuperacion', () => {
  const error = (status: number, cuerpo: unknown = null) =>
    new HttpErrorResponse({ status, error: cuerpo });

  it('sin conexión', () => {
    expect(mensajeDeRecuperacion(error(0))).toContain('conectar');
  });

  it('central sin la función', () => {
    expect(mensajeDeRecuperacion(error(404))).toContain('todavía no tiene');
  });

  it('timeout', () => {
    expect(mensajeDeRecuperacion({ name: 'TimeoutError' })).toContain('a tiempo');
  });

  it('cualquier otra cosa', () => {
    expect(mensajeDeRecuperacion(error(500, '<html>'))).toContain('No se pudo procesar');
  });
});
