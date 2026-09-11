import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { Venta, VentaItem } from 'src/app/domains/venta/venta.model';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { MisFinanzasService } from './mis-finanzas.service';

export interface VentaDetalleData {
  ventaId: number;
  /** Obligatorio: la venta vive en la base de la filial donde se hizo. */
  sucursalId: number;
}

/**
 * Ítems de la venta que originó un convenio.
 *
 * ⚠️ **`sucId` no es opcional.** Las ventas se guardan en la filial, y el
 * id no es único entre filiales: sin sucursal el central resuelve contra su
 * propia base y devuelve otra venta, o ninguna.
 */
@Component({
  selector: 'frc-venta-detalle-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    ImporteComponent,
    SkeletonComponent,
    EstadoErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Venta {{ data.ventaId }}</h2>

    <mat-dialog-content>
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (items().length === 0) {
        <p class="vacio">La venta no tiene ítems registrados.</p>
      } @else {
        <ul class="items">
          @for (item of items(); track item.id) {
            <li class="item">
              <div class="descripcion">
                <span class="producto">{{ item.producto?.descripcion ?? 'Producto' }}</span>
                <span class="cantidad">
                  {{ item.cantidad }} ×
                  <frc-importe [valor]="item.precio ?? 0" moneda="Guaraní" simbolo="₲" />
                </span>
              </div>
              <frc-importe
                class="total"
                [valor]="item.valorTotal ?? 0"
                moneda="Guaraní"
                simbolo="₲"
              />
            </li>
          }
        </ul>

        <div class="resumen">
          <span>Total</span>
          <frc-importe [valor]="venta()?.valorTotal ?? 0" moneda="Guaraní" simbolo="₲" />
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton cdkFocusInitial (click)="cerrar()">Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-3);
      padding-bottom: var(--sp-2);
      border-bottom: 1px solid var(--border-light);
    }
    .descripcion {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .producto {
      overflow-wrap: anywhere;
    }
    .cantidad {
      font-size: var(--fs-caption);
      color: var(--text-soft);
    }
    .total {
      flex-shrink: 0;
      font-weight: var(--fw-medium);
    }
    .resumen {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      margin-top: var(--sp-3);
      font-weight: var(--fw-medium);
    }
    .vacio {
      color: var(--text-soft);
      margin: 0;
    }
  `,
})
export class VentaDetalleDialogComponent {
  readonly data = inject<VentaDetalleData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<VentaDetalleDialogComponent>>(MatDialogRef);
  private readonly finanzas = inject(MisFinanzasService);

  readonly venta = signal<Venta | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  items(): VentaItem[] {
    return this.venta()?.ventaItemList ?? [];
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.finanzas.venta(this.data.ventaId, this.data.sucursalId).subscribe({
      next: (venta) => {
        this.venta.set(venta ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  cerrar(): void {
    this.ref.close();
  }
}
