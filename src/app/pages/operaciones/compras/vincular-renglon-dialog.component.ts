import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import type {
  PresentacionCompra,
  RenglonFactura,
  SugerenciaProducto,
} from 'src/app/domains/compras/compras.model';
import { BuscadorProductoDialogComponent } from 'src/app/shared/producto/buscador-producto-dialog.component';
import type { OpcionesBuscador, SeleccionProducto } from 'src/app/shared/producto/buscador.types';
import { aId, textoFactor, textoParaBuscar } from './compras-reglas';
import { ComprasService } from './compras.service';

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

interface ProductoElegido {
  id: number;
  descripcion: string;
}

/**
 * Vincula un renglón de la factura con un producto nuestro **eligiendo la
 * presentación**, no escribiendo números: la cantidad de la factura ya viene,
 * y cada presentación trae sus unidades. El central marca la sugerida (el
 * bulto que dice la descripción, la del código de barras o la unidad).
 *
 * «Otra cantidad» queda para el caso raro de un proveedor que factura cajas
 * con otra cantidad que la nuestra.
 *
 * «Recordar» guarda el vínculo para ese proveedor y ese código: la próxima
 * factura lo reconoce sola.
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
      <p class="bloque">
        <span class="etiqueta">En la factura</span>
        <strong>{{ data.renglon.descripcion }}</strong>
        <span class="codigo">{{ codigos() }}</span>
        <span>Trae {{ cantidadFactura() }} {{ unidad() }}</span>
      </p>

      @if (producto(); as p) {
        <p class="bloque">
          <span class="etiqueta">Producto nuestro</span>
          <strong>{{ p.descripcion }}</strong>
        </p>

        <span class="etiqueta">¿En qué presentación viene?</span>
        @if (cargandoPresentaciones()) {
          <p class="ayuda">Cargando presentaciones…</p>
        } @else if (errorPresentaciones()) {
          <p class="ayuda error">No se pudieron traer las presentaciones.</p>
          <button matButton (click)="cargarPresentaciones(p.id)">Reintentar</button>
        } @else {
          <div class="presentaciones" role="radiogroup">
            @for (pr of presentaciones(); track pr.id) {
              <button
                type="button"
                class="presentacion"
                role="radio"
                [attr.aria-checked]="elegidaId() === pr.id"
                [class.activa]="elegidaId() === pr.id"
                (click)="elegir(pr)"
              >
                <span class="nombre">{{ pr.descripcion }}</span>
                <span class="detalle">
                  {{ numero(pr.cantidad) }} u.
                  @if (pr.codigo) { · {{ pr.codigo }} }
                </span>
                @if (pr.sugerida) {
                  <span class="sugerida">Sugerida{{ pr.motivo ? ': ' + pr.motivo : '' }}</span>
                }
              </button>
            }
          </div>

          @if (otraCantidad()) {
            <mat-form-field appearance="outline" class="campo">
              <mat-label>Unidades por cada {{ unidad() }} de la factura</mat-label>
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
          } @else {
            <button matButton class="otra" (click)="otraCantidad.set(true)">Otra cantidad por bulto</button>
          }

          @if (valido()) {
            <p class="resultado">
              A la nota: {{ cantidadFactura() }} {{ unidad() }} × {{ numero(factor()) }} =
              <strong>{{ numero(totalUnidades()) }} u.</strong>
            </p>
          }

          <mat-checkbox [ngModel]="recordar()" (ngModelChange)="recordar.set($event)">
            Recordar para las próximas facturas de este proveedor
          </mat-checkbox>
        }
      }

      <button matButton class="buscar" (click)="buscar()">
        {{ producto() ? 'Elegir otro producto' : 'Buscar el producto' }}
      </button>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="cancelar()">Cancelar</button>
      <button matButton="filled" [disabled]="!valido()" (click)="guardar()">Vincular</button>
    </mat-dialog-actions>
  `,
  styles: `
    .bloque { display: flex; flex-direction: column; gap: var(--sp-1); margin: 0 0 var(--sp-3); }
    .etiqueta { color: var(--text-mute); font-size: var(--fs-caption); }
    .codigo { color: var(--text-soft); font-size: var(--fs-caption); font-family: var(--font-num); }
    .presentaciones { display: flex; flex-direction: column; gap: var(--sp-2); margin: var(--sp-2) 0; }
    .presentacion {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-1);
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: none;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .presentacion.activa { border-color: var(--brand-fill); background: var(--surface-sunken); }
    .nombre { font-size: var(--fs-label); font-weight: var(--fw-medium); }
    .detalle { color: var(--text-soft); font-size: var(--fs-caption); font-family: var(--font-num); }
    .sugerida { color: var(--ok); font-size: var(--fs-caption); }
    .campo { width: 100%; margin-top: var(--sp-2); }
    .resultado { margin: var(--sp-2) 0; font-size: var(--fs-label); }
    .ayuda { color: var(--text-mute); font-size: var(--fs-caption); }
    .ayuda.error { color: var(--danger); }
    .otra, .buscar { margin-top: var(--sp-1); }
  `,
})
export class VincularRenglonDialogComponent {
  readonly data = inject<VincularRenglonData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<VincularRenglonDialogComponent, VincularRenglonResultado | undefined>>(MatDialogRef);
  private readonly dialogo = inject(DialogoService);
  private readonly servicio = inject(ComprasService);

  readonly producto = signal<ProductoElegido | null>(null);
  readonly presentaciones = signal<PresentacionCompra[]>([]);
  readonly cargandoPresentaciones = signal(false);
  readonly errorPresentaciones = signal(false);
  readonly elegidaId = signal<number | null>(null);
  readonly factor = signal<number>(1);
  readonly otraCantidad = signal(false);
  readonly recordar = signal(true);

  readonly unidad = computed(() => this.data.renglon.unidadMedida || 'unidad');
  readonly cantidadFactura = computed(() => this.numero(this.data.renglon.cantidad));
  /** Solo para mostrar: la cantidad que va a la nota la calcula el central. */
  readonly totalUnidades = computed(() => (this.data.renglon.cantidad ?? 0) * this.factor());
  readonly valido = computed(
    () => this.elegidaId() != null && Number.isFinite(this.factor()) && this.factor() > 0,
  );
  readonly ayudaFactor = computed(() => textoFactor(this.factor(), this.data.renglon.unidadMedida));
  readonly codigos = computed(() =>
    [
      this.data.renglon.codigoProveedor ? 'Cód. ' + this.data.renglon.codigoProveedor : null,
      this.data.renglon.gtin ? 'Barras ' + this.data.renglon.gtin : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );

  /** La presentación que se eligió en el buscador, para preferirla sobre la sugerida. */
  private preferida: number | null = null;

  constructor() {
    const s = this.data.sugerencia;
    if (s) {
      this.preferida = aId(s.presentacionId);
      this.usarProducto({ id: Number(s.productoId), descripcion: s.descripcion ?? 'Producto ' + s.productoId });
    } else if (this.data.renglon.productoId) {
      // «Cambiar producto» sobre uno ya vinculado: arranca con el actual y su presentación
      this.preferida = aId(this.data.renglon.presentacionId);
      this.usarProducto({
        id: Number(this.data.renglon.productoId),
        descripcion: this.data.renglon.productoDescripcion ?? 'Producto ' + this.data.renglon.productoId,
      });
    }
  }

  async buscar(): Promise<void> {
    const opciones: OpcionesBuscador = { devuelve: 'producto' };
    const seleccion = await this.dialogo.abrir<
      BuscadorProductoDialogComponent,
      { titulo: string; opciones: OpcionesBuscador; textoInicial?: string },
      SeleccionProducto
    >(
      BuscadorProductoDialogComponent,
      {
        titulo: 'Buscar el producto de la factura',
        opciones,
        textoInicial: this.data.renglon.gtin || textoParaBuscar(this.data.renglon.descripcion) || undefined,
      },
      '520px',
    );
    const id = aId(seleccion?.producto?.id);
    if (id == null) return;
    this.preferida = aId(seleccion?.presentacion?.id);
    this.usarProducto({ id, descripcion: seleccion?.producto?.descripcion ?? 'Producto ' + id });
  }

  private usarProducto(p: ProductoElegido): void {
    this.producto.set(p);
    this.elegidaId.set(null);
    this.otraCantidad.set(false);
    this.cargarPresentaciones(p.id);
  }

  cargarPresentaciones(productoId: number): void {
    this.cargandoPresentaciones.set(true);
    this.errorPresentaciones.set(false);
    this.servicio.presentaciones(productoId, this.data.renglon.id).subscribe({
      next: (crudas) => {
        // GraphQL manda los ID como texto
        const lista = (crudas ?? []).map((x) => ({ ...x, id: Number(x.id) }));
        this.presentaciones.set(lista);
        const inicial =
          lista.find((x) => x.id === this.preferida) ?? lista.find((x) => x.sugerida) ?? lista[0];
        if (inicial) this.elegir(inicial);
        this.cargandoPresentaciones.set(false);
      },
      error: () => {
        this.errorPresentaciones.set(true);
        this.cargandoPresentaciones.set(false);
      },
    });
  }

  elegir(p: PresentacionCompra): void {
    this.elegidaId.set(p.id);
    this.factor.set(p.cantidad != null && p.cantidad > 0 ? p.cantidad : 1);
  }

  guardar(): void {
    const id = this.elegidaId();
    if (id == null || !this.valido()) return;
    this.ref.close({ presentacionId: id, factor: this.factor(), recordar: this.recordar() });
  }

  cancelar(): void {
    this.ref.close(undefined);
  }

  numero(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('es-PY', { maximumFractionDigits: 3 });
  }
}
