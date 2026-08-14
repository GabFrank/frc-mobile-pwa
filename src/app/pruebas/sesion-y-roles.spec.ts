import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { authGuard } from '../core/auth/auth.guard';
import { AuthService } from '../core/auth/auth.service';
import { AUTH_TOKEN_KEY } from '../core/auth/auth.tokens';
import { InicioPage } from '../pages/inicio/inicio.page';
import { MisFinanzasService } from '../pages/mis-finanzas/mis-finanzas.service';
import { OperacionesPage } from '../pages/operaciones/operaciones.page';
import { Usuario } from '../domains/personas/usuario.model';
import type { Persona } from '../domains/personas/persona.model';
import { ROLES } from '../domains/personas/roles/roles.enum';

/**
 * Casos 1.1, 1.2 y 2.4 del plan de testeo manual, automatizados.
 *
 * Verifican la corrección del defecto más grave que encontró la revisión:
 * la sesión no cargaba el `Usuario`, así que `roles` quedaba vacío y la UI
 * ocultaba en silencio todo lo que depende de ellos.
 */
describe('Sesión y control de acceso por rol', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        // Inicio muestra el resumen de crédito, que consulta al central. Acá
        // se prueban los roles, no el crédito: sin este doble, montar la
        // pantalla exigiría Apollo y el test hablaría de otra cosa.
        { provide: MisFinanzasService, useValue: { resumenCredito: () => of(null) } },
      ],
    });
  });

  const usuarioCon = (roles: string[], nombre = 'Marcela Ayala') => {
    // `Persona` es una interfaz, no una clase: se construye como objeto.
    const persona = { id: 1, nombre } as Persona;
    return Object.assign(new Usuario(), { id: 42, nickname: 'mayala', persona, roles });
  };

  describe('1.1 · El saludo usa el nombre del usuario', () => {
    it('muestra el primer nombre cuando la sesión cargó', () => {
      TestBed.inject(AuthService).establecerUsuario(usuarioCon([]));
      const fixture = TestBed.createComponent(InicioPage);
      fixture.detectChanges();

      // Si dijera "Bodega Franco", el usuario no se cargó.
      expect(fixture.componentInstance.saludo()).toBe('Hola, Marcela');
    });

    it('cae a la marca si todavía no hay usuario', () => {
      const fixture = TestBed.createComponent(InicioPage);
      fixture.detectChanges();
      expect(fixture.componentInstance.saludo()).toBe('Bodega Franco');
    });
  });

  describe('1.2 · Los accesos rápidos respetan el rol', () => {
    it('ADMIN ve el acceso a Caja', () => {
      TestBed.inject(AuthService).establecerUsuario(usuarioCon([ROLES.ADMIN]));
      const fixture = TestBed.createComponent(InicioPage);
      fixture.detectChanges();

      const etiquetas = fixture.componentInstance.accesos().map((a) => a.etiqueta);
      expect(etiquetas).toContain('Caja');
    });

    it('VENTA_TOUCH también', () => {
      TestBed.inject(AuthService).establecerUsuario(usuarioCon([ROLES.VENTA_TOUCH]));
      const fixture = TestBed.createComponent(InicioPage);
      fixture.detectChanges();
      expect(fixture.componentInstance.accesos().map((a) => a.etiqueta)).toContain('Caja');
    });

    it('un usuario sin esos roles NO lo ve', () => {
      TestBed.inject(AuthService).establecerUsuario(usuarioCon(['OTRO_ROL']));
      const fixture = TestBed.createComponent(InicioPage);
      fixture.detectChanges();

      const etiquetas = fixture.componentInstance.accesos().map((a) => a.etiqueta);
      expect(etiquetas).not.toContain('Caja');
      // Pero sí ve los accesos sin restricción: el filtro no puede vaciar todo.
      expect(etiquetas.length).toBeGreaterThan(0);
    });

    it('la card de Caja en Operaciones sigue la misma regla', () => {
      const auth = TestBed.inject(AuthService);

      auth.establecerUsuario(usuarioCon([ROLES.ADMIN]));
      const conRol = TestBed.createComponent(OperacionesPage);
      conRol.detectChanges();
      expect(conRol.componentInstance.puedeCaja()).toBe(true);

      auth.establecerUsuario(usuarioCon(['OTRO']));
      const sinRol = TestBed.createComponent(OperacionesPage);
      sinRol.detectChanges();
      expect(sinRol.componentInstance.puedeCaja()).toBe(false);
    });
  });

  describe('2.4 · Ruta protegida sin sesión', () => {
    const correrGuard = () =>
      TestBed.runInInjectionContext(() =>
        authGuard({} as never, { url: '/operaciones/caja' } as never),
      );

    it('redirige al login', () => {
      const resultado = correrGuard();
      expect(resultado).not.toBe(true);
      expect(String(resultado)).toContain('/login');
    });

    it('conserva a dónde quería ir', () => {
      expect(String(correrGuard())).toContain('volverA');
    });

    it('deja pasar con token guardado', () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'abc');
      expect(correrGuard()).toBe(true);
    });

    it('la cadena "null" heredada no cuenta como token', () => {
      localStorage.setItem(AUTH_TOKEN_KEY, 'null');
      expect(correrGuard()).not.toBe(true);
    });

    it('deja pasar con sesión en memoria', () => {
      TestBed.inject(AuthService).establecerUsuario(usuarioCon([]));
      expect(correrGuard()).toBe(true);
    });
  });
});
