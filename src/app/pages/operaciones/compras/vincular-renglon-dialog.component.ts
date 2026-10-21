import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import type { RenglonFactura, SugerenciaProducto } from 'src/app/domains/compras/compras.model';
import { BuscadorProductoDialogComponent } from 'src/app/shared/producto/buscador-producto-dialog.component';
import type { OpcionesBuscador, SeleccionProducto } from 'src/app/shared/producto/buscador.types';
import { textoFactor, textoParaBuscar } from './compras-reglas';

export interface VincularRenglonData {
  renglon: RenglonFactura;
  /** Una sugerencia ya elegida en la tarjeta: arranca con ella. */
  sugerencia?: SugerenciaProducto;
}

export interface VincularRenglonResultado {
  presentacionId: number;
  factor: number;
  recordar: boolean;
}

interface Elegida {
  presentacionId: number;
  producto: string;
  presentacion: string;
  factor: number;
}

/**
 * Vincula un renglón de la factura con una presentación nuestra.
 *
 * El **factor** es cuántas unidades base trae cada unidad que factura el
 * proveedor: «1 CAJ = 20 u.». Arranca en la cantidad de la presentación
 * elegida y se puede corregir, porque el proveedor a veces factura cajas con
 * otra cantidad que la nuestra.
 *
 * «Recordar» guarda el vínculo para ese proveedor y ese código: la próxima
 * factura lo reconoce sola. Arranca prendido porque es lo que se quiere casi
 * siempre; se apaga para un caso excepcional.
 */
@Component({
  selector: 'frc-vincular-renglon-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Vincular producto</h2>
    <mat-dialog-content>
      <p class="factura">
        <span class="etiqueta">En la factura</span>
        <strong>{{ data.renglon.descripcion }}</strong>
        <span class="codigo">
          {{ codigos() }}
        </span>
      </p>

      @if (elegida(); as e) {
        <p class="elegida">
          <span class="etiqueta">Producto nuestro</span>
          <strong>{{ e.producto }}</strong>
          <span>{{ e.presentacion }}</span>
        </p>
        <mat-form-field appearance="outline" class="campo">
          <mat-label>Unidades por cada {{ data.renglon.unidadMedida || 'unidad' }} de la factura</mat-label>
          <input
            matInput
            type="number"
            inputmode="decimal"
            min="0"
            [ngModel]="factor()"
            (ngModelChange)="factor.set(+$event)"
          />
          <mat-hint>{{ ayudaFactor() }}</mat-hint>
        </mat-form-field>
        <mat-checkbox [ngModel]="recordar()" (ngModelChange)="recordar.set($event)">
          Recordar para las próximas facturas de este proveedor
        </mat-checkbox>
      }

      <button matButton class="buscar" (click)="buscar()">
        {{ elegida() ? 'Elegir otro producto' : 'Buscar el producto' }}
      </button>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="cancelar()">Cancelar</button>
      <button matButton="filled" [disabled]="!valido()" (click)="guardar()">Vincular</button>
    </mat-dialog-actions>
  `,
  styles: `
    .factura, .elegida { display: flex; flex-direction: column; gap: var(--sp-1); margin: 0 0 var(--sp-3); }
    .etiqueta { color: var(--text-mute); font-size: var(--fs-caption); }
    .codigo { color: var(--text-soft); font-size: var(--fs-caption); font-family: var(--font-num); }
    .campo { width: 100%; }
    .buscar { margin-top: var(--sp-3); }
  `,
})
export class VincularRenglonDialogComponent {
  readonly data = inject<VincularRenglonData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<VincularRenglonDialogComponent, VincularRenglonResultado | undefined>>(MatDialogRef);
  private readonly dialogo = inject(DialogoService);

  readonly elegida = signal<Elegida | null>(this.desdeSugerencia(this.data.sugerencia));
  readonly factor = signal<number>(this.data.sugerencia?.factor ?? 1);
  readonly recordar = signal(true);

  readonly valido = computed(() => this.elegida() != null && Number.isFinite(this.factor()) && this.factor() > 0);
  readonly ayudaFactor = computed(() => textoFactor(this.factor(), this.data.renglon.unidadMedida));
  readonly codigos = computed(() =>
    [
      this.data.renglon.codigoProveedor ? 'Cód. ' + this.data.renglon.codigoProveedor : null,
      this.data.renglon.gtin ? 'Barras ' + this.data.renglon.gtin : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );

  async buscar(): Promise<void> {
    const opciones: OpcionesBuscador = { devuelve: 'presentacion' };
    const seleccion = await this.dialogo.abrir<
      BuscadorProductoDialogComponent,
      { titulo: string; opciones: OpcionesBuscador; textoInicial?: string },
      SeleccionProducto
    >(
      BuscadorProductoDialogComponent,
      {
        titulo: 'Buscar el producto de la factura',
        opciones,
        textoInicial: textoParaBuscar(this.data.renglon.descripcion) || undefined,
      },
      '520px',
    );
    const p = seleccion?.presentacion;
    if (!seleccion || !p?.id) {
      return;
    }
    const cantidad = Number(p.cantidad);
    this.elegida.set({
      presentacionId: p.id,
      producto: seleccion.producto?.descripcion ?? 'Producto ' + seleccion.producto?.id,
      presentacion: p.descripcion ?? 'Presentación ' + p.id,
      factor: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
    });
    this.factor.set(Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1);
  }

  guardar(): void {
    const e = this.elegida();
    if (!e || !this.valido()) return;
    this.ref.close({ presentacionId: e.presentacionId, factor: this.factor(), recordar: this.recordar() });
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  private desdeSugerencia(s: SugerenciaProducto | undefined): Elegida | null {
    if (!s) return null;
    return {
      presentacionId: s.presentacionId,
      producto: s.descripcion ?? 'Producto ' + s.productoId,
      presentacion: s.presentacionDescripcion ?? '',
      factor: s.factor ?? 1,
    };
  }
}
