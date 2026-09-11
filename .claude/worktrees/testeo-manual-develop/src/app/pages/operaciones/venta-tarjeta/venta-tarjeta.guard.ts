import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { VentaTarjetaService } from './venta-tarjeta.service';

/**
 * La función se habilita por **configuración del backend**.
 *
 * **Con el flag en caché navega al instante y refresca en segundo plano.**
 * Solo la primera navegación espera la red — en una LAN de sucursal, hacer
 * un round-trip por cada entrada al módulo era inaceptable, y por eso el
 * repo anterior lo resolvió así (PR #87 de `frc-mobile`).
 *
 * ⚠️ **Si la consulta falla, bloquea.** Es deliberado: con el central caído
 * es preferible no entrar a registrar cupones contra una configuración
 * desconocida.
 *
 * Es el patrón de referencia para cualquier función con flag de backend.
 */
export const ventaTarjetaHabilitadaGuard: CanActivateFn = () => {
  const servicio = inject(VentaTarjetaService);
  const notificacion = inject(NotificacionService);
  const router = inject(Router);

  const resolver = (habilitada: boolean) => {
    if (habilitada) {
      return true;
    }
    notificacion.warn('La venta con tarjeta no está habilitada.');
    return router.createUrlTree(['/operaciones']);
  };

  const cacheada = servicio.habilitadaCacheada();
  if (cacheada !== null) {
    // Refresco silencioso: no bloquea esta navegación, pero deja el caché
    // fresco para la próxima.
    servicio.habilitada().pipe(catchError(() => of(null))).subscribe();
    return of(resolver(cacheada));
  }

  return servicio.habilitada().pipe(
    map(resolver),
    catchError(() => of(router.createUrlTree(['/operaciones']))),
  );
};
