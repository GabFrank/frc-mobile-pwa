import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { banderaDeMoneda } from 'src/app/domains/moneda/bandera-moneda';
import type { PreciosEnMoneda } from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { IconoComponent } from 'src/app/shared/icono/icono.component';

/**
 * El selector de moneda del kiosco: el FAB de banderas de `frc-mobile`.
 *
 * Va justo debajo de la barra, a la izquierda, como el FAB de `frc-mobile`.
 * Cerrado muestra la bandera de la moneda en uso; abierto, el botón pasa a
 * X y las demás banderas se despliegan a su derecha.
 * Solo elige: los importes los convierte el central y los pinta
 * `KioscoPage`.
 */
@Component({
  selector: 'frc-kiosco-monedas',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="monedas" role="group" aria-label="Moneda de los precios">
      <button
        type="button"
        class="moneda-btn actual"
        [attr.aria-expanded]="abierto()"
        [attr.aria-label]="abierto() ? 'Cerrar monedas' : 'Ver los precios en otra moneda'"
        (click)="abierto.set(!abierto())"
      >
        @if (abierto()) {
          <frc-icono nombre="cerrar" [tamano]="24" />
        } @else if (bandera(actual()); as src) {
          <img class="bandera" [src]="src" alt="" />
        } @else {
          <span class="simbolo">{{ actual()?.moneda?.simbolo }}</span>
        }
      </button>
      @if (abierto()) {
        <div class="opciones">
        @for (m of monedas(); track m.moneda.id) {
          <button
            type="button"
            class="moneda-btn opcion"
            [class.activa]="m === actual()"
            [attr.aria-pressed]="m === actual()"
            [attr.aria-label]="'Precios en ' + (m.moneda.denominacion ?? m.moneda.simbolo)"
            (click)="elegirUna(m)"
          >
            @if (bandera(m); as src) {
              <img class="bandera" [src]="src" alt="" />
            } @else {
              <span class="simbolo">{{ m.moneda.simbolo }}</span>
            }
          </button>
        }
        </div>
      }
    </div>
  `,
  styles: `
    /*
      Cuelga de la barra (position: relative en KioscoPage), no del panel:
      así queda pegado debajo de ella aunque el panel haga scroll.
    */
    :host {
      position: absolute;
      top: calc(100% + var(--sp-3));
      left: var(--sp-4);
      /* En una pantalla angosta la fila baja a otra línea en vez de salirse. */
      right: var(--sp-4);
      pointer-events: none;
    }
    .monedas, .opciones { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3); }
    .moneda-btn { pointer-events: auto; }
    .moneda-btn {
      width: var(--kiosco-moneda);
      height: var(--kiosco-moneda);
      padding: 0;
      border: none;
      border-radius: var(--radius-full);
      background: var(--brand-fill);
      color: var(--on-tono);
      box-shadow: var(--elev-2);
      display: grid;
      place-items: center;
      cursor: pointer;
      outline: 3px solid transparent;
      outline-offset: 2px;
    }
    .moneda-btn.opcion { animation: aparecer var(--kiosco-transicion) both; }
    .moneda-btn.activa { outline-color: var(--on-tono); }
    .moneda-btn:focus-visible { outline-color: var(--brand-accent); }
    .bandera {
      width: 62%;
      height: 62%;
      object-fit: cover;
      border-radius: var(--radius-full);
    }
    .simbolo {
      font-family: var(--font-num);
      font-size: var(--fs-label);
      font-weight: var(--fw-bold);
    }
    @keyframes aparecer {
      from { opacity: 0; transform: translateY(calc(-1 * var(--sp-2))) scale(0.8); }
    }
    @media (prefers-reduced-motion: reduce) {
      .moneda-btn.opcion { animation: none; }
    }
  `,
})
export class KioscoMonedasComponent {
  readonly monedas = input.required<PreciosEnMoneda[]>();
  /** La moneda en uso; `null` si el central no mandó la del guaraní. */
  readonly actual = input<PreciosEnMoneda | null>(null);
  readonly elegir = output<PreciosEnMoneda>();

  readonly abierto = signal(false);

  elegirUna(m: PreciosEnMoneda): void {
    this.abierto.set(false);
    this.elegir.emit(m);
  }

  /** Sin moneda en uso, la del guaraní: es la base de todos los precios. */
  bandera(m: PreciosEnMoneda | null): string | null {
    return banderaDeMoneda(m?.moneda ?? { denominacion: 'GUARANI' });
  }
}
