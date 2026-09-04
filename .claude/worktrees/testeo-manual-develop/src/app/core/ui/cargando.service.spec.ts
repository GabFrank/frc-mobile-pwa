import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CargandoService } from './cargando.service';

describe('CargandoService', () => {
  let cargando: CargandoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    cargando = TestBed.inject(CargandoService);
  });

  it('arranca sin operaciones en curso', () => {
    expect(cargando.cargando()).toBe(false);
  });

  it('cuenta operaciones concurrentes', () => {
    cargando.iniciar();
    cargando.iniciar();
    expect(cargando.cargando()).toBe(true);

    cargando.finalizar();
    // Todavía queda una: el indicador no debe apagarse antes de tiempo.
    expect(cargando.cargando()).toBe(true);

    cargando.finalizar();
    expect(cargando.cargando()).toBe(false);
  });

  it('no baja de cero aunque se finalice de más', () => {
    cargando.finalizar();
    cargando.finalizar();
    expect(cargando.cargando()).toBe(false);

    cargando.iniciar();
    expect(cargando.cargando()).toBe(true);
  });

  it('limpia el mensaje al terminar todo', () => {
    cargando.iniciar('Guardando…');
    expect(cargando.mensaje()).toBe('Guardando…');
    cargando.finalizar();
    expect(cargando.mensaje()).toBeNull();
  });

  it('con() libera el contador aunque la promesa falle', async () => {
    await expect(cargando.con(Promise.reject(new Error('x')))).rejects.toThrow();
    expect(cargando.cargando()).toBe(false);
  });

  it('con() devuelve el resultado', async () => {
    expect(await cargando.con(Promise.resolve(7))).toBe(7);
    expect(cargando.cargando()).toBe(false);
  });
});
