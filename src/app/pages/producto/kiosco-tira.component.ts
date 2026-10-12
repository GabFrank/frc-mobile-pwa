import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';

/**
 * La tira de presentaciones al costado de la foto del kiosco.
 *
 * Una miniatura por presentación con su «×12» debajo; la elegida va con el
 * borde de marca y las demás atenuadas. El precio no va acá: lo anuncia la
 * ficha, que tiene `aria-live`.
 *
 * ⚠️ **Toma la altura del contenedor, no la suya.** El scroll interno va en
 * absoluto para que cinco presentaciones no estiren la fila de la foto: el
 * host tiene que estar posicionado (`position: relative`) por quien lo usa.
 */
@Component({
  selector: 'frc-kiosco-tira',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tira-scroll" role="radiogroup" aria-label="Presentaciones">
      @for (pr of presentaciones(); track pr.id) {
        <button
          type="button"
          class="miniatura"
          role="radio"
          [class.activa]="pr.id === seleccionadaId()"
          [attr.aria-checked]="pr.id === seleccionadaId()"
          [attr.aria-label]="etiqueta(pr)"
          (click)="elegir.emit(pr)"
        >
          <span class="placa">
            @if (imagen(pr); as src) {
              <img [src]="src" alt="" />
            } @else {
              <frc-icono nombre="producto" [tamano]="24" />
            }
          </span>
          <span class="multiplo">×{{ multiplo(pr) }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .tira-scroll {
      position: absolute;
      inset: 0;
      overflow-y: auto;
      scrollbar-width: none;
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      padding: var(--sp-1);
      margin: calc(-1 * var(--sp-1));
    }
    .miniatura {
      flex-shrink: 0;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: var(--text-soft);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-1);
    }
    .placa {
      width: 100%;
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: var(--vitrina-fondo);
      color: var(--vitrina-icono);
      border-radius: var(--radius-sm);
      outline: 3px solid transparent;
      outline-offset: 2px;
      opacity: 0.5;
      transition: opacity var(--kiosco-transicion), outline-color var(--kiosco-transicion);
    }
    .placa img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      animation: aparecer var(--kiosco-transicion) both;
    }
    .multiplo {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-size: var(--fs-label);
    }
    .miniatura.activa { color: var(--text); }
    .miniatura.activa .placa { opacity: 1; outline-color: var(--brand-fill); }
    .miniatura.activa .multiplo { font-weight: var(--fw-bold); }
    .miniatura:focus-visible { outline: none; }
    .miniatura:focus-visible .placa { opacity: 1; outline-color: var(--brand-accent); }
    @keyframes aparecer {
      from { opacity: 0; transform: scale(0.96); }
    }
    @media (prefers-reduced-motion: reduce) {
      .placa { transition: none; }
      .placa img { animation: none; }
    }
  `,
})
export class KioscoTiraComponent {
  readonly presentaciones = input.required<Presentacion[]>();
  readonly seleccionadaId = input<number | null>(null);
  /** Fotos por id de presentación; las que faltan muestran el ícono. */
  readonly imagenes = input<Map<number, string>>(new Map());
  readonly elegir = output<Presentacion>();

  imagen(p: Presentacion): string | null {
    return p.id != null ? (this.imagenes().get(Number(p.id)) ?? null) : null;
  }

  etiqueta(p: Presentacion): string {
    return etiquetaPresentacion(p);
  }

  /** `12` para la miniatura: la etiqueta entera no entra en 68 px. */
  multiplo(p: Presentacion): string {
    const cantidad = p.cantidad ?? 1;
    return formatearCantidad(cantidad, Number.isInteger(cantidad) ? 0 : 2);
  }
}
