import { ChangeDetectionStrategy, Component, EventEmitter, inject, input, Output } from '@angular/core';
import { Location } from '@angular/common';
import { IconoComponent } from '../icono/icono.component';

/**
 * Layout canónico de pantalla: barra superior, contenido y —opcionalmente—
 * una barra de acciones fija al pie.
 *
 * Se usa en listas, detalles y formularios. La estructura no cambia entre
 * módulos: eso es lo que hace que la app se sienta una sola app.
 *
 *   <frc-pagina titulo="Devoluciones" [conVolver]="true">
 *     <div acciones>…</div>       <!-- barra fija al pie, opcional -->
 *     …contenido…
 *   </frc-pagina>
 */
@Component({
  selector: 'frc-pagina',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="barra">
      @if (conVolver()) {
        <button type="button" class="icono-btn" (click)="volver()" aria-label="Volver">
          <frc-icono nombre="atras" [tamano]="22" />
        </button>
      }
      <h1>{{ titulo() }}</h1>
      <ng-content select="[accionBarra]" />
    </header>

    <main class="contenido">
      <ng-content />
    </main>

    <footer class="acciones">
      <ng-content select="[acciones]" />
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .barra {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--brand-fill);
      color: var(--on-brand);
      flex-shrink: 0;
    }
    .barra h1 {
      flex: 1;
      margin: 0;
      font-size: var(--fs-title);
      font-weight: var(--fw-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .icono-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: var(--sp-1);
      border-radius: var(--radius-sm);
      line-height: 0;
    }
    .icono-btn:hover { background: rgb(255 255 255 / 0.16); }
    .contenido {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .acciones:empty { display: none; }
    .acciones {
      flex-shrink: 0;
      padding: var(--sp-3) var(--sp-4);
      border-top: 1px solid var(--border);
      background: var(--surface);
      display: flex;
      gap: var(--sp-2);
    }
  `,
})
export class PaginaComponent {
  private readonly location = inject(Location);

  readonly titulo = input.required<string>();
  readonly conVolver = input(false);

  /**
   * Si alguien lo escucha, **reemplaza** al comportamiento por defecto.
   *
   * Es lo que permite que un formulario intercepte el botón de volver para
   * preguntar "¿salir sin guardar?".
   *
   * Se usa `@Output()` y no `output()` porque `EventEmitter` expone
   * `observed`, que es justamente lo que hace falta para saber si hay quien
   * escuche. La API de signals no lo ofrece.
   */
  @Output() readonly atras = new EventEmitter<void>();

  volver(): void {
    if (this.atras.observed) {
      this.atras.emit();
      return;
    }
    // `Location.back()` en vez de navegar: evita apilar entradas en el
    // historial cuando el objetivo es simplemente volver.
    this.location.back();
  }
}
