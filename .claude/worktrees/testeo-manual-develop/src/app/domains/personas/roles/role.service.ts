import { Injectable } from '@angular/core';
import { ROLES } from './roles.enum';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private readonly rolesCaja = [ROLES.ADMIN, ROLES.VENTA_TOUCH];

  puedeAccederCaja(roles: string[] | null | undefined): boolean {
    return this.tieneAlgunRol(roles, this.rolesCaja);
  }

  tieneAlgunRol(
    roles: string[] | null | undefined,
    rolesRequeridos: readonly string[],
  ): boolean {
    if (!roles?.length || !rolesRequeridos.length) {
      return false;
    }

    return rolesRequeridos.some((rol) => roles.includes(rol));
  }

  tieneRol(roles: string[] | null | undefined, rol: string): boolean {
    return roles?.includes(rol) ?? false;
  }
}
