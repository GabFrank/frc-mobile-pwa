import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RoleService } from './role.service';
import { ROLES } from './roles.enum';

describe('RoleService', () => {
  let roles: RoleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    roles = TestBed.inject(RoleService);
  });

  it('habilita caja a ADMIN y a VENTA_TOUCH', () => {
    expect(roles.puedeAccederCaja([ROLES.ADMIN])).toBe(true);
    expect(roles.puedeAccederCaja([ROLES.VENTA_TOUCH])).toBe(true);
  });

  it('niega caja a otros roles', () => {
    expect(roles.puedeAccederCaja(['OTRO_ROL'])).toBe(false);
  });

  it('niega el acceso cuando no hay roles', () => {
    // Es el caso que se daba cuando la sesión no cargaba el usuario: sin
    // roles, todo queda oculto.
    expect(roles.puedeAccederCaja([])).toBe(false);
    expect(roles.puedeAccederCaja(null)).toBe(false);
    expect(roles.puedeAccederCaja(undefined)).toBe(false);
  });

  it('tieneAlgunRol requiere intersección', () => {
    expect(roles.tieneAlgunRol(['A', 'B'], ['B', 'C'])).toBe(true);
    expect(roles.tieneAlgunRol(['A'], ['B'])).toBe(false);
    expect(roles.tieneAlgunRol(['A'], [])).toBe(false);
  });

  it('tieneRol chequea uno puntual', () => {
    expect(roles.tieneRol(['ADMIN'], 'ADMIN')).toBe(true);
    expect(roles.tieneRol(['ADMIN'], 'OTRO')).toBe(false);
    expect(roles.tieneRol(null, 'ADMIN')).toBe(false);
  });
});
