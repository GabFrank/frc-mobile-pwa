import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { IconoComponent } from '../icono/icono.component';

/**
 * Estado de error.
 *
 * Dice qué falló y qué puede hacer la persona. Si no puede hacer nada, dice
 * a quién avisar. Sin "Ups!! Algo salió mal", que era el mensaje único de
 * `frc-mobile` para cualquier fallo.
 */
@Component({
  selector: 'frc-estado-error',
  standalone: true,
  imports: [MatButtonModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="estado" role="alert">
      <frc-icono class="icono" nombre="alerta" [tamano]="40" />
      <h3>{{ titulo() }}</h3>
      @if (detalle()) {
        <p>{{ detalle() }}</p>
      }
      <button matButton="outlined" (click)="reintentar.emit()">Reintentar</button>
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
    .icono { color: var(--danger); }
    h3 { margin: 0; font-size: var(--fs-body); font-weight: var(--fw-medium); }
    p {
      margin: 0;
      color: var(--text-soft);
      font-size: var(--fs-label);
      max-width: 40ch;
    }
  `,
})
export class EstadoErrorComponent {
  readonly titulo = input('No se pudieron cargar los datos');
  readonly detalle = input<string | null>(
    'Verificá que el dispositivo tenga conexión. Si el problema sigue, avisá al encargado de sistemas.',
  );
  readonly reintentar = output<void>();
}
