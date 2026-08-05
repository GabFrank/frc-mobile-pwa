import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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

type EstadoFila = 'cargando' | 'listo' | 'falló';

interface FilaStock {
  id: number;
  nombre: string;
  cantidad: number | null;
  estado: EstadoFila;
}

/**
 * Existencia del producto en cada sucursal.
 *
 * ⚠️ **No hay una operación que devuelva el stock de todas las sucursales de
 * una vez.** `productoPorSucursalStock` es por sucursal, así que se consulta
 * una vez por cada una.
 *
 * ⚠️ **La sucursal `0` es el SERVIDOR y se excluye.** No es un local, no
 * tiene depósito, y preguntarle el stock de un producto no significa nada.
 * Ver `sucursal.util.ts`.
 *
 * **La lista aparece completa y cada fila se llena cuando contesta.** Son 13
 * sucursales o más: esperar a que respondan todas para mostrar algo deja la
 * pantalla en blanco por el tiempo de la más lenta, y basta con una filial
 * caída para que ese tiempo sea el timeout. Con las filas ya dibujadas, el
 * usuario ve enseguida qué se está consultando y los números van cayendo.
 * `frc-mobile` esperaba a todas.
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

      @if (cargandoLista()) {
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
              @switch (fila.estado) {
                @case ('cargando') {
                  <span class="pendiente" aria-label="Consultando">···</span>
                }
                @case ('falló') {
                  <span class="pendiente">sin dato</span>
                }
                @default {
                  <span class="cantidad" [class.negativo]="(fila.cantidad ?? 0) < 0">
                    {{ legible(fila.cantidad!) }}
                  </span>
                }
              }
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
  /** Solo cubre traer la lista de sucursales, no los stocks. */
  readonly cargandoLista = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    const productoId = this.data.producto?.id;
    if (productoId == null) {
      this.error.set('El producto no tiene id.');
      this.cargandoLista.set(false);
      return;
    }

    this.cargandoLista.set(true);
    this.error.set(null);

    this.sucursales.todas().subscribe({
      next: (todas) => {
        const objetivo = this.data.sucursalId;
        const lista = (todas ?? [])
          .filter((s) => esSucursalReal(s.id))
          .filter((s) => objetivo == null || s.id === objetivo);

        this.filas.set(
          lista.map((s) => ({
            id: s.id!,
            nombre: s.nombre ?? `Sucursal ${s.id}`,
            cantidad: null,
            estado: 'cargando' as EstadoFila,
          })),
        );
        this.cargandoLista.set(false);

        // Todas salen a la vez y cada una pinta su fila al llegar: la lenta
        // no retiene a las demás.
        for (const s of lista) {
          this.busqueda.stock(productoId, s.id!).subscribe({
            next: (cantidad) => this.completar(s.id!, cantidad, 'listo'),
            // Una filial caída no puede ocultar el stock de las demás.
            error: () => this.completar(s.id!, null, 'falló'),
          });
        }
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargandoLista.set(false);
      },
    });
  }

  private completar(id: number, cantidad: number | null, estado: EstadoFila): void {
    this.filas.update((filas) =>
      filas.map((f) => (f.id === id ? { ...f, cantidad, estado } : f)),
    );
  }

  legible(cantidad: number): string {
    return formatearCantidad(cantidad, Number.isInteger(cantidad) ? 0 : 2);
  }

  cerrar(): void {
    this.ref.close();
  }
}
