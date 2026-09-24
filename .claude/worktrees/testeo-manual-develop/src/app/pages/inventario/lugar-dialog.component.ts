import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

/** Qué se está editando. Cambia el título y nada más. */
export type TipoLugar = 'sector' | 'zona';

export interface DatosLugar {
  tipo: TipoLugar;
  /** Ausente cuando se está creando. */
  descripcion?: string;
  activo?: boolean;
  /** De dónde cuelga: la sucursal para un sector, el sector para una zona. */
  contexto?: string;
  /** Solo se puede dar de baja algo que ya existe. */
  puedeEliminar?: boolean;
}

export type ResultadoLugar =
  | { accion: 'guardar'; descripcion: string; activo: boolean }
  | { accion: 'eliminar' };

const TITULOS: Record<TipoLugar, { nuevo: string; editar: string }> = {
  sector: { nuevo: 'Nuevo sector', editar: 'Sector' },
  zona: { nuevo: 'Nueva zona', editar: 'Zona' },
};

/**
 * Alta y edición de un sector o de una zona.
 *
 * Los dos tienen los mismos dos campos —descripción y activo—, así que
 * comparten diálogo. `frc-mobile` les da una pantalla completa a cada uno,
 * con un formulario de dos filas y un `ion-content` anidado dentro de otro;
 * acá no hay nada que justifique salir de la lista para escribir un nombre.
 *
 * ⚠️ **La descripción se guarda en mayúsculas.** No es cosmética: en el
 * central, sectores y zonas se comparan por texto y conviven cargas de años
 * distintos. `frc-mobile` hace lo mismo con `.toUpperCase()` al guardar, y
 * romper eso llenaría el listado de duplicados que se ven iguales.
 */
@Component({
  selector: 'frc-lugar-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>{{ titulo }}</h2>
      @if (datos.contexto) {
        <!-- Etiqueta tenue y valor destacado, como frc-dato. -->
        <p class="contexto">
          <span class="etiqueta">{{ etiquetaContexto }}</span>
          {{ datos.contexto | titlecase }}
        </p>
      }

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Descripción</mat-label>
        <input
          matInput
          [ngModel]="descripcion()"
          (ngModelChange)="descripcion.set($event)"
          maxlength="60"
          autocomplete="off"
          cdkFocusInitial
        />
      </mat-form-field>

      <mat-slide-toggle [ngModel]="activo()" (ngModelChange)="activo.set($event)">
        Activo
      </mat-slide-toggle>
      @if (!activo()) {
        <p class="aviso">Inactivo no se puede asignar en un conteo nuevo.</p>
      }

      <div class="acciones">
        @if (datos.puedeEliminar) {
          <button matButton class="baja" (click)="eliminar()">Eliminar</button>
        }
        <span class="empuje"></span>
        <button matButton (click)="ref.close()">Cancelar</button>
        <button matButton="filled" [disabled]="!valido()" (click)="guardar()">Guardar</button>
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
    .aviso { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .acciones { display: flex; align-items: center; gap: var(--sp-2); }
    .empuje { flex: 1; }
    .baja { color: var(--danger); }
  `,
})
export class LugarDialogComponent {
  readonly datos = inject<DatosLugar>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<LugarDialogComponent, ResultadoLugar | undefined>>(MatDialogRef);

  readonly descripcion = signal(this.datos.descripcion ?? '');
  readonly activo = signal(this.datos.activo ?? true);

  readonly titulo = this.datos.descripcion
    ? TITULOS[this.datos.tipo].editar
    : TITULOS[this.datos.tipo].nuevo;

  /** De dónde cuelga: un sector de la sucursal, una zona de su sector. */
  readonly etiquetaContexto = this.datos.tipo === 'sector' ? 'Sucursal' : 'Sector';

  valido(): boolean {
    return this.descripcion().trim().length > 0;
  }

  guardar(): void {
    if (!this.valido()) {
      return;
    }
    this.ref.close({
      accion: 'guardar',
      descripcion: this.descripcion().trim().toUpperCase(),
      activo: this.activo(),
    });
  }

  eliminar(): void {
    // La confirmación la pide la pantalla: acá solo se declara la intención.
    this.ref.close({ accion: 'eliminar' });
  }
}
