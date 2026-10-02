import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TemaService } from './tema.service';

describe('TemaService', () => {
  let tema: TemaService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
    tema = TestBed.inject(TemaService);
    TestBed.tick();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('arranca siguiendo la preferencia del sistema', () => {
    expect(tema.tema()).toBe('sistema');
    // En modo sistema no se estampa nada: manda prefers-color-scheme.
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('al elegir explícitamente estampa data-theme', () => {
    tema.establecer('oscuro');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    tema.establecer('claro');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('vuelve a sistema quitando el atributo', () => {
    tema.establecer('oscuro');
    TestBed.tick();
    tema.establecer('sistema');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('persiste la elección', () => {
    tema.establecer('oscuro');
    TestBed.tick();
    expect(localStorage.getItem('frc.tema')).toBe('oscuro');
  });

  it('alternar cambia entre claro y oscuro', () => {
    tema.establecer('claro');
    TestBed.tick();
    tema.alternar();
    TestBed.tick();
    expect(tema.tema()).toBe('oscuro');

    tema.alternar();
    TestBed.tick();
    expect(tema.tema()).toBe('claro');
  });
});
