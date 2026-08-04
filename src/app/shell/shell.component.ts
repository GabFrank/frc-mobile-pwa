import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs/operators';

import { AuthService } from '../core/auth/auth.service';
import { CargandoService } from '../core/ui/cargando.service';
import { TemaService } from '../core/tema/tema.service';
import { IconoComponent } from '../shared/icono/icono.component';
import { DESTINOS } from './nav';

/**
 * Layout autenticado.
 *
 * Barra inferior en teléfono, riel lateral en tablet. La navegación primaria
 * se filtra por rol.
 */
@Component({
  selector: 'frc-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.tablet]="esTablet()">
      @if (esTablet()) {
        <nav class="rail" aria-label="Navegación principal">
          @for (d of destinos(); track d.ruta) {
            <a
              [routerLink]="d.ruta"
              routerLinkActive="activo"
              class="destino"
              [attr.aria-label]="d.etiqueta"
            >
              <frc-icono [nombre]="d.icono" [tamano]="22" />
              <span>{{ d.etiqueta }}</span>
            </a>
          }
        </nav>
      }

      <div class="area">
        @if (cargando.cargando()) {
          <div class="barra-carga" role="progressbar" aria-label="Cargando"></div>
        }
        <router-outlet />
      </div>

      @if (!esTablet()) {
        <nav class="bottom" aria-label="Navegación principal">
          @for (d of destinos(); track d.ruta) {
            <a [routerLink]="d.ruta" routerLinkActive="activo" class="destino">
              <frc-icono [nombre]="d.icono" [tamano]="21" />
              <span>{{ d.etiqueta }}</span>
            </a>
          }
        </nav>
      }
    </div>
  `,
  styles: `
    :host { display: block; height: 100dvh; }
    .shell { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .shell.tablet { flex-direction: row; }

    /*
      ⚠️ Dos cosas hacen que esta zona sea delicada, y las dos juntas hacían
      que la app entera renderizara a media pantalla y pegada a la derecha:

      1. router-outlet NO envuelve al componente ruteado. Angular lo inserta
         como HERMANO, justo después. Así que .area tiene dos hijos y el
         outlet —vacío— competía por el ancho.
      2. El componente ruteado lo crea el router, no esta plantilla, así que
         NO lleva el atributo de encapsulación del shell. Cualquier regla
         del tipo ".area > *" queda scopeada y nunca lo alcanza: la pantalla
         se quedaba sin ancho asignado y colapsaba a su contenido.

      Por eso el estiramiento NO se pide con una regla sobre los hijos, sino
      que lo da el contenedor: en grid, el item ocupa la celda sin que haga
      falta un selector que lo apunte. Y el outlet, con display:none, sale
      del grid en vez de reservar una celda.
    */
    .area {
      flex: 1;
      min-height: 0;
      min-width: 0;
      position: relative;
      display: grid;
      grid-template-rows: 1fr;
      grid-template-columns: 1fr;
    }
    .area > router-outlet { display: none; }

    .barra-carga {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--brand-accent);
      animation: avance 1.1s ease-in-out infinite;
      z-index: 10;
    }
    @keyframes avance {
      0% { transform: scaleX(0); transform-origin: left; }
      50% { transform: scaleX(1); transform-origin: left; }
      51% { transform: scaleX(1); transform-origin: right; }
      100% { transform: scaleX(0); transform-origin: right; }
    }

    .destino {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: 10px;
      color: var(--text-mute);
      text-decoration: none;
      padding: var(--sp-2) var(--sp-1);
    }
    .destino.activo { color: var(--brand-text); }
    .destino:focus-visible { outline: 2px solid var(--brand-text); outline-offset: -2px; }

    .bottom {
      display: flex;
      border-top: 1px solid var(--border);
      background: var(--surface);
      flex-shrink: 0;
      padding-bottom: env(safe-area-inset-bottom);
    }
    .bottom .destino { flex: 1; }

    .rail {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-2);
      border-right: 1px solid var(--border);
      background: var(--surface);
      flex-shrink: 0;
    }
    .rail .destino { width: 60px; }
  `,
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly breakpoints = inject(BreakpointObserver);
  readonly cargando = inject(CargandoService);
  readonly tema = inject(TemaService);

  readonly esTablet = toSignal(
    this.breakpoints
      .observe([Breakpoints.Medium, Breakpoints.Large, Breakpoints.XLarge])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  readonly destinos = computed(() => {
    const roles = this.auth.roles();
    return DESTINOS.filter(
      (d) => !d.roles?.length || d.roles.some((r) => roles.includes(r)),
    );
  });
}
