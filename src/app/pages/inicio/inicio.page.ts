import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { NotificacionesService } from 'src/app/pages/notificaciones/notificacion.service';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { CreditoResumenComponent } from './credito-resumen.component';

interface AccesoRapido {
  etiqueta: string;
  ruta: string;
  icono: string;
  /** Si se declara, requiere alguno de estos roles. */
  roles?: readonly string[];
  /** Cuántos pendientes mostrar en el badge. Sin esto, no lleva badge. */
  pendientes?: () => number;
}

@Component({
  selector: 'frc-inicio',
  standalone: true,
  imports: [PaginaComponent, SeccionComponent, IconoComponent, CreditoResumenComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="saludo()">
      <frc-credito-resumen />

      <frc-seccion titulo="Accesos rápidos">
        <div class="grilla">
          @for (a of accesos(); track a.ruta) {
            <button type="button" class="acceso" (click)="ir(a.ruta)">
              <span class="marco">
                <frc-icono [nombre]="a.icono" [tamano]="24" />
                <!--
                  El badge solo tiene sentido donde hay algo pendiente que
                  contar. Hoy es notificaciones; por eso el acceso declara de
                  dónde sale su número en vez de que la plantilla pregunte por
                  la ruta.
                -->
                @if (a.pendientes; as cuantas) {
                  @if (cuantas() > 0) {
                    <span
                      class="badge"
                      [attr.aria-label]="cuantas() + ' sin leer'"
                    >{{ cuantas() > 99 ? '99+' : cuantas() }}</span>
                  }
                }
              </span>
              <span>{{ a.etiqueta }}</span>
            </button>
          }
        </div>
      </frc-seccion>
    </frc-pagina>
  `,
  styles: `
    .grilla {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--sp-2);
    }
    .acceso {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      box-shadow: var(--elev-1);
      padding: var(--sp-4) var(--sp-2);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      font: inherit;
      font-size: var(--fs-label);
      font-weight: var(--fw-medium);
      color: var(--text);
      cursor: pointer;
      text-align: center;
    }
    .acceso frc-icono { color: var(--brand-text); }
    .acceso:hover { background: var(--surface-sunken); }

    .marco { position: relative; display: inline-flex; line-height: 0; }
    .badge {
      position: absolute;
      top: calc(-1 * var(--sp-1));
      left: 100%;
      transform: translateX(calc(-1 * var(--sp-2)));
      min-width: var(--sp-4);
      padding: 0 var(--sp-1);
      border-radius: var(--radius-full);
      background: var(--danger-fill);
      color: var(--on-tono);
      font-size: var(--fs-caption);
      font-weight: var(--fw-bold);
      line-height: var(--sp-4);
      text-align: center;
    }
  `,
})
export class InicioPage {
  private readonly auth = inject(AuthService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);

  /**
   * Los roles salen de `PERMISOS`, la misma tabla que usan los guards de
   * ruta. Declararlos acá a mano es lo que hace que el menú y la ruta
   * terminen diciendo cosas distintas.
   *
   * En `frc-mobile` convivían strings inline con nombres inconsistentes entre
   * sí (`'NUEVO-PRODUCTO'` con guion, `'VER INVENTARIO'` con espacio).
   *
   * Los accesos sin `roles` son deliberados: autoservicio y consulta. El
   * porqué de cada uno está en `permisos.ts`.
   */
  private readonly TODOS: readonly AccesoRapido[] = [
    { etiqueta: 'Caja', ruta: '/operaciones/caja', icono: 'dinero', roles: PERMISOS.caja },
    { etiqueta: 'Operaciones', ruta: '/operaciones', icono: 'caja' },
    { etiqueta: 'Buscar producto', ruta: '/buscar', icono: 'buscar' },
    { etiqueta: 'Productos vencidos', ruta: '/producto/vencidos', icono: 'vencido' },
    { etiqueta: 'Consultar precio', ruta: '/kiosco', icono: 'etiqueta' },
    { etiqueta: 'Inventario', ruta: '/inventario', icono: 'inventario', roles: PERMISOS.inventario },
    {
      etiqueta: 'Control inventario',
      ruta: '/inventario/control',
      icono: 'verificado',
      roles: PERMISOS.inventario,
    },
    { etiqueta: 'Transferencias', ruta: '/transferencias', icono: 'camion', roles: PERMISOS.transferencias },
    {
      etiqueta: 'Notificaciones',
      ruta: '/notificaciones',
      icono: 'bandeja',
      pendientes: () => this.notificaciones.noLeidas(),
    },
    { etiqueta: 'Marcación', ruta: '/marcacion', icono: 'reloj' },
    { etiqueta: 'Mi trabajo', ruta: '/mi-trabajo', icono: 'persona' },
    { etiqueta: 'Mis finanzas', ruta: '/mis-finanzas', icono: 'dinero' },
    { etiqueta: 'Mi cuenta', ruta: '/cuenta', icono: 'cuenta' },
  ];

  readonly saludo = computed(() => {
    const nombre = this.auth.usuario()?.persona?.nombre;
    return nombre ? `Hola, ${nombre.split(' ')[0]}` : 'Bodega Franco';
  });

  readonly accesos = computed(() => {
    const roles = this.auth.roles();
    return this.TODOS.filter(
      (a) => !a.roles?.length || this.roleService.tieneAlgunRol(roles, a.roles),
    );
  });

  ir(ruta: string): void {
    void this.router.navigate([ruta]);
  }
}
