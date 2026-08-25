import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { ZonaDisponible } from './inventario-alta';

export interface DatosZona {
  /** Las que todavía se pueden sumar. Ya vienen sin las usadas ni las inactivas. */
  disponibles: ZonaDisponible[];
  /** La sucursal de la toma, para ubicar al operador. */
  contexto?: string;
}

export interface ResultadoZona {
  zonaId: number;
}

/**
 * Elegir qué zona sumar a la toma.
 *
 * ⚠️ **Lista, no selector.** Un depósito grande tiene decenas de zonas y se
 * las busca por nombre («rack 4», «heladera»), así que lleva un campo de
 * filtro. `frc-mobile` usa un acordeón de sectores con las zonas adentro:
 * funciona con pocos sectores y obliga a abrir uno por uno cuando hay
 * muchos.
 *
 * Las que ya están en la toma no llegan hasta acá: las descuenta
 * {@link zonasDisponibles}, porque la unicidad de `inventario_producto` es
 * `(inventario_id, zona_id)` y el central rechaza el duplicado.
 */
@Component({
  selector: 'frc-zona-dialog',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Agregar zona</h2>
      @if (datos.contexto) {
        <p class="contexto">{{ datos.contexto }}</p>
      }

      @if (datos.disponibles.length === 0) {
        <p class="vacio">
          No quedan zonas para agregar. O ya están todas en la toma, o hay que
          crearlas en Lugares del depósito.
        </p>
      } @else {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Buscar zona</mat-label>
          <input
            matInput
            [ngModel]="filtro()"
            (ngModelChange)="filtro.set($event)"
            autocomplete="off"
            cdkFocusInitial
          />
        </mat-form-field>

        @if (filtradas().length === 0) {
          <p class="vacio">Ninguna zona coincide con eso.</p>
        } @else {
          <ul class="lista">
            @for (z of filtradas(); track z.zonaId) {
              <li>
                <button type="button" class="opcion" (click)="elegir(z.zonaId)">
                  <span class="zona">{{ z.texto }}</span>
                  @if (z.detalle) {
                    <span class="sector">{{ z.detalle }}</span>
                  }
                </button>
              </li>
            }
          </ul>
        }
      }

      <div class="acciones">
        <span class="empuje"></span>
        <button matButton (click)="ref.close()">Cancelar</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); }
    h2 { margin: 0; font-size: var(--fs-title); font-weight: var(--fw-medium); color: var(--text); }
    .contexto { margin: 0; font-size: var(--fs-label); color: var(--text-soft); }
    .vacio { margin: 0; font-size: var(--fs-label); color: var(--text-mute); }
    .lista { list-style: none; margin: 0; padding: 0; max-height: 45vh; overflow-y: auto; }
    .opcion {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-1);
      width: 100%;
      padding: var(--sp-3);
      border: none;
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text);
      text-align: left;
      cursor: pointer;
      font: inherit;
    }
    .opcion:hover, .opcion:focus-visible { background: var(--surface-sunken); }
    .zona { font-weight: var(--fw-medium); text-transform: capitalize; }
    .sector { font-size: var(--fs-caption); color: var(--text-soft); text-transform: capitalize; }
    .acciones { display: flex; align-items: center; gap: var(--sp-2); }
    .empuje { flex: 1; }
  `,
})
export class ZonaDialogComponent {
  readonly datos = inject<DatosZona>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ZonaDialogComponent, ResultadoZona | undefined>>(MatDialogRef);

  readonly filtro = signal('');

  readonly filtradas = computed(() => {
    const texto = this.filtro().trim().toLowerCase();
    if (!texto) {
      return this.datos.disponibles;
    }
    return this.datos.disponibles.filter(
      (z) =>
        z.texto.toLowerCase().includes(texto) || z.detalle.toLowerCase().includes(texto),
    );
  });

  elegir(zonaId: number): void {
    this.ref.close({ zonaId });
  }
}
