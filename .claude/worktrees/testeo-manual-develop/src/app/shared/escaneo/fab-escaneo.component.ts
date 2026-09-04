import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { EscanerUniversalService } from 'src/app/core/dispositivo/escaner-universal.service';
import { IconoComponent } from '../icono/icono.component';

/**
 * Botón flotante de escaneo, presente en toda la app.
 *
 * Un toque abre la cámara; lo que se lea decide adónde ir. Reemplaza al FAB
 * de `frc-mobile`, que desplegaba un menú de cuatro atajos: esos atajos ahora
 * son accesos rápidos de Inicio, y el FAB quedó para lo único que se hace
 * decenas de veces por turno y desde cualquier pantalla.
 *
 * ⚠️ **Lo renderiza `frc-pagina`, no el shell.** Puesto en el shell quedaba
 * tapando la barra de acciones fija de las pantallas que la tienen —guardar,
 * finalizar, confirmar—, porque el shell no sabe si la pantalla de adentro
 * tiene una. `frc-pagina` sí: es la dueña de las dos piezas y puede
 * ubicarlo encima. Ese es el motivo de que un componente de `shared/`
 * dependa de un servicio de `core/`.
 */
@Component({
  selector: 'frc-fab-escaneo',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="fab"
      [disabled]="abriendo()"
      aria-label="Escanear código"
      title="Escanear código"
      (click)="escanear()"
    >
      <frc-icono nombre="escanear" [tamano]="24" />
    </button>
  `,
  styles: `
    :host {
      position: absolute;
      right: var(--sp-4);
      bottom: var(--sp-4);
      z-index: 5;
      line-height: 0;
    }
    .fab {
      width: var(--sp-12);
      height: var(--sp-12);
      border: none;
      border-radius: var(--radius-full);
      background: var(--brand-fill);
      color: var(--on-tono);
      box-shadow: var(--elev-2);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .fab:hover { background: var(--brand-hover); }
    .fab:focus-visible { outline: 2px solid var(--brand-text); outline-offset: 2px; }
    .fab:disabled { opacity: 0.6; cursor: default; }
  `,
})
export class FabEscaneoComponent {
  private readonly universal = inject(EscanerUniversalService);

  /** Evita abrir dos cámaras con un doble toque. */
  readonly abriendo = signal(false);

  async escanear(): Promise<void> {
    if (this.abriendo()) {
      return;
    }
    this.abriendo.set(true);
    try {
      await this.universal.escanearYNavegar();
    } finally {
      this.abriendo.set(false);
    }
  }
}
