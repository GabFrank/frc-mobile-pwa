import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { SelectorComponent, type OpcionSeleccion } from 'src/app/shared/selector/selector.component';
import type { Sector } from 'src/app/domains/sector/sector.model';
import type { ZonaDisponible } from './inventario-alta';

export interface DatosZona {
  /** Las que todavía se pueden sumar. Ya vienen sin las usadas ni las inactivas. */
  disponibles: ZonaDisponible[];
  /** Los sectores de la sucursal, para poder crear una zona que falte. */
  sectores: Sector[];
  /** La sucursal de la toma, para ubicar al operador. */
  contexto?: string;
}

/**
 * Elegir una zona existente, o pedir que se cree una.
 *
 * El alta se resuelve en la pantalla y no acá porque necesita el servicio y
 * el manejo de errores; el diálogo solo declara la intención, igual que
 * `LugarDialogComponent` con su acción de eliminar.
 */
export type ResultadoZona =
  | { accion: 'elegir'; zonaId: number }
  | { accion: 'crear'; descripcion: string; sectorId: number | null; sectorNuevo?: string };

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
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    SelectorComponent,
    TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Agregar zona</h2>
      @if (datos.contexto) {
        <!--
          Etiqueta tenue, valor destacado: la forma que ya tiene frc-dato en
          todo el repo. Antes iba al revés —el nombre de la sucursal suelto y
          en gris chico—, y es el dato que evita agregarle la zona a la toma
          equivocada.
        -->
        <p class="contexto">
          <span class="etiqueta">Sucursal</span>
          {{ datos.contexto | titlecase }}
        </p>
      }

      @if (creando()) {
        <!--
          Crear al paso lo que falta para poder contar. La administración de
          sectores y zonas sigue viviendo en Lugares del depósito: acá no se
          borra ni se desactiva nada, solo se da de alta lo que hace falta
          ahora — que es lo que hacía útil el flujo del repo anterior sin
          heredar sus seis rutas anidadas.
        -->
        @if (sectorNuevo() == null) {
          <frc-selector
            etiqueta="Sector"
            [opciones]="opcionesSector()"
            [valor]="sectorId()"
            (valorChange)="sectorId.set($event)"
          />
          <button matButton class="enlace" (click)="empezarSectorNuevo()">
            El sector tampoco está
          </button>
        } @else {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Sector nuevo</mat-label>
            <input
              matInput
              [ngModel]="sectorNuevo()"
              (ngModelChange)="sectorNuevo.set($event)"
              maxlength="60"
              autocomplete="off"
            />
          </mat-form-field>
          <button matButton class="enlace" (click)="sectorNuevo.set(null)">
            Elegir un sector que ya existe
          </button>
        }

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Zona</mat-label>
          <input
            matInput
            [ngModel]="descripcion()"
            (ngModelChange)="descripcion.set($event)"
            maxlength="60"
            autocomplete="off"
            cdkFocusInitial
          />
        </mat-form-field>
      } @else if (datos.disponibles.length === 0) {
        <p class="vacio">
          No quedan zonas para agregar: o ya están todas en la toma, o todavía
          no se creó ninguna.
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
        @if (!creando()) {
          <button matButton class="enlace" (click)="creando.set(true)">
            {{ datos.disponibles.length === 0 ? 'Crear una zona' : 'No está la zona' }}
          </button>
        }
        <span class="empuje"></span>
        <button matButton (click)="volver()">Cancelar</button>
        @if (creando()) {
          <button matButton="filled" [disabled]="!valido()" (click)="crear()">Crear</button>
        }
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); }
    h2 { margin: 0; font-size: var(--fs-title); font-weight: var(--fw-medium); color: var(--text); }
    .contexto {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      margin: 0;
      font-size: var(--fs-body);
      font-weight: var(--fw-medium);
      color: var(--text);
    }
    .contexto .etiqueta {
      font-size: var(--fs-label);
      font-weight: var(--fw-regular);
      color: var(--text-soft);
    }
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
    .enlace { color: var(--brand-text); }
  `,
})
export class ZonaDialogComponent {
  readonly datos = inject<DatosZona>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<ZonaDialogComponent, ResultadoZona | undefined>>(MatDialogRef);

  readonly filtro = signal('');
  readonly creando = signal(false);
  readonly descripcion = signal('');
  readonly sectorId = signal<unknown>(this.datos.sectores?.[0]?.id ?? null);
  /** `null` mientras se elija uno existente; el texto cuando se está creando. */
  readonly sectorNuevo = signal<string | null>(null);

  readonly opcionesSector = computed<OpcionSeleccion[]>(() =>
    (this.datos.sectores ?? []).map((s) => ({
      valor: s.id,
      texto: s.descripcion ?? `Sector ${s.id}`,
    })),
  );

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
    this.ref.close({ accion: 'elegir', zonaId });
  }

  empezarSectorNuevo(): void {
    // Cadena vacía y no `null`: `null` es «elegir uno existente».
    this.sectorNuevo.set('');
  }

  valido(): boolean {
    if (this.descripcion().trim().length === 0) {
      return false;
    }
    const nuevo = this.sectorNuevo();
    return nuevo == null ? this.sectorId() != null : nuevo.trim().length > 0;
  }

  crear(): void {
    if (!this.valido()) {
      return;
    }
    const nuevo = this.sectorNuevo();
    this.ref.close({
      accion: 'crear',
      // Mayúsculas al guardar: en el central conviven cargas de años
      // distintos y se comparan por texto. Es el par que ya usa Lugares del
      // depósito, y hay que tomarlo entero.
      descripcion: this.descripcion().trim().toUpperCase(),
      sectorId: nuevo == null ? Number(this.sectorId()) : null,
      sectorNuevo: nuevo?.trim().toUpperCase(),
    });
  }

  /** Volver de la creación a la lista, en vez de cerrar de una. */
  volver(): void {
    if (this.creando()) {
      this.creando.set(false);
      return;
    }
    this.ref.close();
  }
}
