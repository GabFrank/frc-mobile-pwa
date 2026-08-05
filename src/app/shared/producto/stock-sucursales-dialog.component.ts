import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { esSucursalReal } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { Producto } from 'src/app/domains/productos/producto.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoErrorComponent } from '../estados-ui/estado-error.component';
import { SkeletonComponent } from '../estados-ui/skeleton.component';

export interface StockSucursalesData {
  producto: Producto;
  /** Si viene, se consulta **solo** esa sucursal. */
  sucursalId?: number;
}

interface FilaStock {
  id: number;
  nombre: string;
  cantidad: number;
}

/**
 * Existencia del producto en cada sucursal.
 *
 * **Una sola consulta para todas.** `stockPorSucursales` agrupa en la base y
 * vuelve en un request. La alternativa —`productoPorSucursalStock` una vez
 * por sucursal— son 18 requests y el navegador abre 6 conexiones por origen:
 * salen en tandas y ocupan todo el pool mientras duran, así que cualquier
 * otra consulta de la app queda esperando. Medido contra la instancia real,
 * mediana de 6 productos: **32 ms contra 83 ms**.
 *
 * ⚠️ **La sucursal `0` es el SERVIDOR y se excluye.** No es un local, no
 * tiene depósito, y preguntarle el stock de un producto no significa nada.
 * Ver `sucursal.util.ts`.
 *
 * ⚠️ **Una sucursal sin movimientos no vuelve en la consulta**: no hay filas
 * que sumar. Se muestra en cero, que es lo que significa.
 */
@Component({
  selector: 'frc-stock-sucursales-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, SkeletonComponent, EstadoErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Stock por sucursal</h2>

    <mat-dialog-content>
      <p class="producto">{{ data.producto.descripcion }}</p>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <p class="vacio">No hay sucursales para consultar.</p>
      } @else {
        <ul class="filas">
          @for (fila of filas(); track fila.id) {
            <li class="fila">
              <span class="nombre">{{ fila.nombre }}</span>
              <span class="cantidad" [class.negativo]="fila.cantidad < 0">
                {{ legible(fila.cantidad) }}
              </span>
            </li>
          }
        </ul>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton cdkFocusInitial (click)="cerrar()">Cerrar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .producto {
      margin: 0 0 var(--sp-3);
      font-weight: var(--fw-medium);
    }
    .filas {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .fila {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-3);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-light);
      font-size: var(--fs-label);
    }
    .fila:last-child { border-bottom: none; }
    .nombre {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cantidad {
      flex-shrink: 0;
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    /* Un stock negativo es un problema de inventario: tiene que saltar. */
    .negativo { color: var(--danger); }
    .pendiente {
      flex-shrink: 0;
      color: var(--text-mute);
      font-size: var(--fs-caption);
    }
    .vacio { color: var(--text-soft); margin: 0; }
  `,
})
export class StockSucursalesDialogComponent {
  readonly data = inject<StockSucursalesData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<StockSucursalesDialogComponent>>(MatDialogRef);
  private readonly sucursales = inject(SucursalService);
  private readonly busqueda = inject(ProductoBusquedaService);

  readonly filas = signal<FilaStock[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    const productoId = this.data.producto?.id;
    if (productoId == null) {
      this.error.set('El producto no tiene id.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    // Las dos salen juntas: los nombres no dependen del stock ni al revés.
    forkJoin({
      sucursales: this.sucursales.todas(),
      stock: this.busqueda.stockPorSucursales(productoId),
    }).subscribe({
      next: ({ sucursales, stock }) => {
        // Acotar a una sucursal solo tiene sentido si es un local de verdad.
        // Con la sesión parada en el SERVIDOR —caso real— restringir a esa
        // «sucursal» dejaba el diálogo vacío: se filtraba a la 0 y después
        // se la descartaba por no ser un local. Sin local al que acotar, se
        // muestran todos, que es justo lo que se vino a ver.
        const objetivo = esSucursalReal(this.data.sucursalId) ? this.data.sucursalId : null;

        this.filas.set(
          (sucursales ?? [])
            .filter((s) => esSucursalReal(s.id))
            // Comparación por valor: los ids llegan como string desde GraphQL.
            .filter((s) => objetivo == null || String(s.id) === String(objetivo))
            .map((s) => ({
              id: s.id!,
              nombre: s.nombre ?? `Sucursal ${s.id}`,
              // Sin movimientos no hay fila en el resultado: eso es cero.
              cantidad: stock.get(String(s.id)) ?? 0,
            })),
        );
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  legible(cantidad: number): string {
    return formatearCantidad(cantidad, Number.isInteger(cantidad) ? 0 : 2);
  }

  cerrar(): void {
    this.ref.close();
  }
}
