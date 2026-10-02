import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Exige sesión para entrar.
 *
 * A diferencia de `frc-mobile`, donde ninguna ruta declaraba `canActivate` y
 * el control era solo mostrar u ocultar ítems del menú, acá navegar por URL
 * a una ruta protegida sí queda bloqueado.
 *
 * ⚠️ Sigue siendo control de UI: la barrera real es el backend.
 */
export const authGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.autenticado() || auth.hayTokenGuardado) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { volverA: estado.url },
  });
};
