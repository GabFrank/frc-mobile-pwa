import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { IconoComponent } from '../icono/icono.component';

/**
 * Estado vacío.
 *
 * Explica **por qué** está vacío y ofrece qué hacer. "Sin resultados" a
 * secas deja al usuario sin saber si falló algo o si realmente no hay nada.
 *
 * Reemplaza los ocho mensajes sueltos escritos a mano en `frc-mobile`.
 */
@Component({
  selector: 'frc-estado-vacio',
  standalone: true,
  imports: [MatButtonModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="estado">
      <frc-icono class="icono" [nombre]="icono()" [tamano]="40" />
      <h3>{{ titulo() }}</h3>
      @if (detalle()) {
        <p>{{ detalle() }}</p>
      }
      @if (accion()) {
        <button matButton="outlined" (click)="ejecutar.emit()">{{ accion() }}</button>
      }
    </div>
  `,
  styles: `
    .estado {
      text-align: center;
      padding: var(--sp-12) var(--sp-4);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
    }
    .icono { color: var(--text-mute); }
    h3 { margin: 0; font-size: var(--fs-body); font-weight: var(--fw-medium); }
    p {
      margin: 0;
      color: var(--text-soft);
      font-size: var(--fs-label);
      max-width: 40ch;
    }
  `,
})
export class EstadoVacioComponent {
  readonly titulo = input.required<string>();
  /** Por qué está vacío, en una frase. */
  readonly detalle = input<string | null>(null);
  readonly icono = input('bandeja');
  /** Texto del botón. Si no se pasa, no se muestra. */
  readonly accion = input<string | null>(null);

  readonly ejecutar = output<void>();
}
