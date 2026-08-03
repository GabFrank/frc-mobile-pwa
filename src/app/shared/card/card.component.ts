import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  input,
  Output,
} from '@angular/core';
import { IconoComponent } from '../icono/icono.component';

/**
 * Card de entidad — el componente más usado de la app.
 *
 * Un solo formato para los 14 módulos. Reemplaza los cuatro patrones de
 * lista que convivían en `frc-mobile` (`ion-list`, `ion-card`, `ion-grid` y
 * una clase `.card` propia).
 *
 * Las piezas son opcionales, la estructura no cambia:
 *
 *   <frc-card [titulo]="d.identificador" [subtitulo]="'12 items'" (abrir)="ver(d)">
 *     <frc-estado-chip pie enumerado="EstadoDevolucion" [valor]="d.estado" />
 *     <frc-importe aparte [valor]="d.total" simbolo="₲" />
 *   </frc-card>
 */
@Component({
  selector: 'frc-card',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="card"
      [class.clickable]="esInteractiva()"
      [attr.role]="esInteractiva() ? 'button' : null"
      [attr.tabindex]="esInteractiva() ? 0 : null"
      (click)="alAbrir($event)"
      (keydown.enter)="alAbrir($event)"
      (keydown.space)="alAbrir($event)"
    >
      @if (icono()) {
        <div class="thumb" [class.round]="redondo()">
          <frc-icono [nombre]="icono()!" [tamano]="22" />
        </div>
      }

      <div class="main">
        <div class="titulo">{{ titulo() }}</div>
        @if (subtitulo()) {
          <div class="subtitulo">{{ subtitulo() }}</div>
        }
        <div class="pie"><ng-content select="[pie]" /></div>
      </div>

      <div class="aside"><ng-content select="[aparte]" /></div>
    </article>
  `,
  styles: `
    .card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      box-shadow: var(--elev-1);
      padding: var(--sp-3);
      display: flex;
      gap: var(--sp-3);
      align-items: flex-start;
    }
    .card.clickable { cursor: pointer; }
    .card.clickable:hover { background: var(--surface-sunken); }
    .card.clickable:focus-visible {
      outline: 2px solid var(--brand);
      outline-offset: 2px;
    }
    .thumb {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
      background: var(--surface-sunken);
      display: grid;
      place-items: center;
      color: var(--text-mute);
      flex-shrink: 0;
    }
    .thumb.round { border-radius: var(--radius-full); }
    .main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .titulo {
      font-weight: var(--fw-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .subtitulo {
      font-size: var(--fs-label);
      color: var(--text-soft);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pie:empty { display: none; }
    .pie {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-top: var(--sp-1);
      flex-wrap: wrap;
    }
    .aside:empty { display: none; }
    .aside {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--sp-1);
      flex-shrink: 0;
    }
  `,
})
export class CardComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string | null>(null);
  /** Nombre del ícono de la miniatura. Ver `frc-icono`. */
  readonly icono = input<string | null>(null);
  /** Miniatura circular, para personas. */
  readonly redondo = input(false);
  /**
   * Por defecto `false`: una card sin acción no debe anunciarse como botón ni
   * capturar el foco. Se activa sola si alguien escucha `(abrir)`.
   */
  readonly clickable = input<boolean | null>(null);

  /**
   * `@Output()` en vez de `output()` porque `EventEmitter.observed` permite
   * saber si hay quien escuche, y de eso depende que la card se anuncie o no
   * como interactiva. La API de signals no expone esa información.
   */
  @Output() readonly abrir = new EventEmitter<void>();

  /** Interactiva si se pidió explícitamente, o si hay quien escuche `(abrir)`. */
  readonly esInteractiva = computed(() => this.clickable() ?? this.abrir.observed);

  alAbrir(evento?: Event): void {
    if (!this.esInteractiva()) {
      return;
    }
    // Un control dentro de los slots (un botón de acción, por ejemplo) no
    // debe disparar además la apertura de la card.
    const origen = evento?.target as HTMLElement | null;
    if (origen?.closest('button, a, input, select, textarea')) {
      return;
    }
    evento?.preventDefault();
    this.abrir.emit();
  }
}
