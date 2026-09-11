import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { rolGuard } from '../core/auth/rol.guard';
import { PERMISOS } from '../domains/personas/roles/permisos';
import { ROLES } from '../domains/personas/roles/roles.enum';
import { Usuario } from '../domains/personas/usuario.model';

/**
 * El control de acceso tiene **dos capas**: esconder del menú lo que no
 * corresponde, y que la ruta rebote a quien escriba la URL igual. Esto cubre
 * la segunda, que es la que de verdad impide entrar.
 */
describe('Permisos y guard de rol', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  const entrarCon = (roles: string[], area: Parameters<typeof rolGuard>[0]) => {
    TestBed.inject(AuthService).establecerUsuario(
      Object.assign(new Usuario(), { id: 1, nickname: 'x', roles }),
    );
    return TestBed.runInInjectionContext(() => rolGuard(area)({} as never, {} as never));
  };

  describe('la tabla de permisos', () => {
    it('deja entrar a ADMIN a todas las áreas', () => {
      // No es un permiso más: es con el que soporte entra a mirar cuando
      // alguien reporta algo. Un área sin ADMIN se vuelve inauditable.
      for (const area of Object.keys(PERMISOS) as (keyof typeof PERMISOS)[]) {
        expect(PERMISOS[area], `el área ${area} no incluye ADMIN`).toContain(ROLES.ADMIN);
      }
    });

    it('no declara ningún rol que el central no conozca', () => {
      // Regresión: `DIRECTIVO` no existe en `personas.role`, así que el
      // chequeo daba siempre falso y el permiso no se podía delegar. Un rol
      // inventado no falla: esconde la opción para siempre, en silencio.
      const conocidos = new Set<string>(Object.values(ROLES));
      for (const [area, roles] of Object.entries(PERMISOS)) {
        for (const rol of roles) {
          expect(conocidos.has(rol), `${area} pide un rol inexistente: ${rol}`).toBe(true);
        }
      }
    });
  });

  describe('el guard', () => {
    it('deja pasar con el rol del área', () => {
      expect(entrarCon([ROLES.VER_INVENTARIO], 'inventario')).toBe(true);
    });

    it('deja pasar a ADMIN aunque no tenga el rol específico', () => {
      expect(entrarCon([ROLES.ADMIN], 'recepcion')).toBe(true);
    });

    it('rebota a Inicio a quien no lo tiene', () => {
      const resultado = entrarCon([ROLES.VENTA_TOUCH], 'inventario');

      expect(resultado).not.toBe(true);
      expect(String(resultado)).toContain('/inicio');
    });

    it('rebota a quien no tiene ningún rol', () => {
      expect(entrarCon([], 'caja')).not.toBe(true);
    });

    it('no confunde un área con otra', () => {
      // Tener caja no habilita inventario. Suena obvio y es el error que
      // aparece cuando alguien copia una línea de guard y no cambia el área.
      expect(entrarCon([ROLES.VENTA_TOUCH], 'caja')).toBe(true);
      expect(entrarCon([ROLES.VENTA_TOUCH], 'inventario')).not.toBe(true);
    });

    it('el rol se compara con el nombre exacto del central, con espacios', () => {
      // `VER INVENTARIO`, no `VER_INVENTARIO`. Comparar contra la versión con
      // guiones bajos no coincide con nada y esconde la opción sin avisar.
      expect(entrarCon(['VER INVENTARIO'], 'inventario')).toBe(true);
      expect(entrarCon(['VER_INVENTARIO'], 'inventario')).not.toBe(true);
    });
  });

  it('Router está disponible para el redirect', () => {
    expect(TestBed.inject(Router)).toBeTruthy();
  });
});
