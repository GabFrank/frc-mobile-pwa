import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import { excedeElStock } from './transferencia-alta';

/** Lo que el operador carga de un renglón. */
export interface TransferenciaItemDraft {
  cantidad: number;
  /** `yyyy-MM-dd`, o vacío. */
  vencimiento: string | null;
  observacion: string;
}

export interface TransferenciaItemData {
  producto: Producto;
  presentacion: Presentacion;
  /** De dónde sale la mercadería: define contra qué stock se avisa. */
  sucursalOrigenId?: number;
  /** Kilos leídos de un código de balanza. */
  cantidadInicial?: number;
  /** Para editar un renglón ya cargado. */
  draft?: TransferenciaItemDraft;
}

/**
 * Cuánto se pide de este producto, y con qué vencimiento.
 *
 * ⚠️ **El aviso de stock no bloquea.** Pedir más de lo que hay es un caso
 * real —se repone contra lo que va llegando— y el descuento ocurre recién al
 * despachar. Lo que sí importa es **verlo antes de guardar**: cargar 3 cajas
 * de algo que tiene 12 unidades en origen es el error que este número
 * previene.
 *
 * ⚠️ **La cantidad es en presentaciones, no en unidades.** «3» son tres cajas
 * si la presentación es una caja de 12; por eso el aviso multiplica antes de
 * comparar contra la existencia, que el central lleva en unidades.
 */
@Component({
  selector: 'frc-transferencia-item-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    CampoFechaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.producto.descripcion }}</h2>

    <mat-dialog-content>
      <p class="presentacion">{{ etiqueta }}</p>

      <mat-form-field appearance="outline" class="campo">
        <mat-label>Cantidad</mat-label>
        <input
          matInput
          cdkFocusInitial
          type="number"
          inputmode="decimal"
          min="0"
          [ngModel]="cantidad()"
          (ngModelChange)="cantidad.set($event)"
        />
      </mat-form-field>

      @if (stock() !== null) {
        <p class="stock" [class.excede]="excede()">
          En origen hay {{ existencia() }} unidades.
          @if (excede()) {
            Estás pidiendo {{ pedidas() }}: se manda igual, pero revisá.
          }
        </p>
      }

      <frc-campo-fecha
        etiqueta="Vencimiento"
        ayuda="Opcional. Es el del lote que se manda."
        [valor]="vencimiento()"
        (valorChange)="vencimiento.set($event)"
      />

      <mat-form-field appearance="outline" class="campo">
        <mat-label>Observación</mat-label>
        <input matInput [ngModel]="observacion()" (ngModelChange)="observacion.set($event)" />
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancelar()">Cancelar</button>
      <button matButton="filled" [disabled]="!puedeGuardar()" (click)="guardar()">
        {{ data.draft ? 'Guardar' : 'Agregar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .campo { width: 100%; }
    .presentacion {
      margin: 0 0 var(--sp-3);
      font-size: var(--fs-label);
      color: var(--text-soft);
    }
    .stock {
      margin: 0 0 var(--sp-3);
      font-size: var(--fs-label);
      color: var(--text-soft);
    }
    .stock.excede { color: var(--warn); }
  `,
})
export class TransferenciaItemDialogComponent {
  readonly data = inject<TransferenciaItemData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<TransferenciaItemDialogComponent, TransferenciaItemDraft | undefined>>(
      MatDialogRef,
    );
  private readonly busqueda = inject(ProductoBusquedaService);

  readonly etiqueta = etiquetaPresentacion(this.data.presentacion);

  readonly cantidad = signal<number | null>(
    this.data.draft?.cantidad ?? this.data.cantidadInicial ?? null,
  );
  readonly vencimiento = signal<string | null>(this.data.draft?.vencimiento ?? null);
  readonly observacion = signal(this.data.draft?.observacion ?? '');

  /**
   * La existencia en origen. `null` mientras no se sabe: «no pude
   * consultarla» y «no hay» son respuestas distintas, y mostrar cero sería
   * afirmar la segunda.
   */
  readonly stock = signal<number | null>(null);

  readonly existencia = computed(() => formatearCantidad(this.stock() ?? 0, 0));
  readonly pedidas = computed(() =>
    formatearCantidad((this.cantidad() ?? 0) * (this.data.presentacion?.cantidad ?? 1), 0),
  );
  readonly excede = computed(() =>
    excedeElStock(this.cantidad() ?? 0, this.data.presentacion, this.stock()),
  );

  readonly puedeGuardar = computed(() => (this.cantidad() ?? 0) > 0);

  constructor() {
    const productoId = this.data.producto?.id;
    const sucursalId = this.data.sucursalOrigenId;
    if (productoId != null && sucursalId != null) {
      this.busqueda.stock(productoId, sucursalId).subscribe({
        next: (cantidad) => this.stock.set(cantidad),
        // El stock es apoyo: si falla, el renglón se carga igual.
        error: () => undefined,
      });
    }
  }

  guardar(): void {
    const cantidad = this.cantidad() ?? 0;
    if (cantidad <= 0) {
      return;
    }
    this.ref.close({
      cantidad,
      vencimiento: this.vencimiento(),
      observacion: this.observacion(),
    });
  }

  cancelar(): void {
    this.ref.close(undefined);
  }
}
