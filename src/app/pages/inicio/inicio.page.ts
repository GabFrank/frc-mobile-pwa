import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { ROLES } from 'src/app/domains/personas/roles/roles.enum';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

interface AccesoRapido {
  etiqueta: string;
  ruta: string;
  icono: string;
  /** Si se declara, requiere alguno de estos roles. */
  roles?: readonly string[];
}

@Component({
  selector: 'frc-inicio',
  standalone: true,
  imports: [PaginaComponent, SeccionComponent, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="saludo()">
      <frc-seccion titulo="Accesos rápidos">
        <div class="grilla">
          @for (a of accesos(); track a.ruta) {
            <button type="button" class="acceso" (click)="ir(a.ruta)">
              <frc-icono [nombre]="a.icono" [tamano]="24" />
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
  `,
})
export class InicioPage {
  private readonly auth = inject(AuthService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);

  /**
   * Los accesos usan el enum `ROLES`, no strings inline.
   *
   * En `frc-mobile` convivían ambos estilos, con nombres inconsistentes
   * entre sí (`'NUEVO-PRODUCTO'` con guion, `'VER INVENTARIO'` con espacio).
   */
  private readonly TODOS: readonly AccesoRapido[] = [
    { etiqueta: 'Caja', ruta: '/operaciones/caja', icono: 'dinero', roles: [ROLES.ADMIN, ROLES.VENTA_TOUCH] },
    { etiqueta: 'Operaciones', ruta: '/operaciones', icono: 'caja' },
    { etiqueta: 'Buscar producto', ruta: '/buscar', icono: 'buscar' },
    { etiqueta: 'Notificaciones', ruta: '/notificaciones', icono: 'bandeja' },
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
