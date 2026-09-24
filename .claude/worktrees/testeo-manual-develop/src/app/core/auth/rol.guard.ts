import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AreaProtegida, PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { NotificacionService } from '../ui/notificacion.service';
import { AuthService } from './auth.service';

/**
 * Exige un rol para entrar a un área.
 *
 * Es la segunda mitad del control: `authGuard` verifica que haya **sesión**,
 * este que la sesión **alcance**. Sin él, esconder un ítem del menú es
 * cosmético — la URL escrita a mano entra igual, y ese es exactamente el
 * camino de alguien que ya vio la pantalla en el teléfono de un compañero.
 *
 * ```ts
 * { path: 'caja', canActivate: [rolGuard('caja')], … }
 * ```
 *
 * El área se declara en [`permisos.ts`](../../domains/personas/roles/permisos.ts),
 * que es la misma tabla que lee el menú. Un área nueva se agrega ahí una vez y
 * las dos capas quedan de acuerdo.
 *
 * ⚠️ **Esto sigue siendo control de interfaz, no seguridad.** Mientras los
 * resolvers del central no validen rol, quien arme el request a mano pasa
 * igual. Sirve para que nadie vea ni toque lo que no le corresponde, que es
 * un problema distinto y también real.
 */
export function rolGuard(area: AreaProtegida): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const roles = inject(RoleService);
    const router = inject(Router);
    const notificacion = inject(NotificacionService);

    if (roles.tieneAlgunRol(auth.roles(), PERMISOS[area])) {
      return true;
    }

    // Se avisa en vez de rebotar en silencio: quien llegó acá por un enlace
    // compartido o un QR necesita saber que le falta permiso, no creer que la
    // pantalla está rota.
    notificacion.warn('No tenés permiso para entrar a esa sección.');
    return router.createUrlTree(['/inicio']);
  };
}
