import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import {
  DatosSeleccionarLote,
  LoteElegido,
  SeleccionarLoteDialogComponent,
} from './seleccionar-lote-dialog.component';
import { excedeElStock } from './transferencia-alta';

/** Lo que el operador carga de un renglón. */
export interface TransferenciaItemDraft {
  cantidad: number;
  /** `yyyy-MM-dd`, o vacío. */
  vencimiento: string | null;
  observacion: string;
  /**
   * El lote elegido a mano. `null` significa **que lo resuelva FEFO**, que es
   * lo normal: solo los productos con `lote = true` llegan a tener uno.
   */
  lote: LoteElegido | null;
}

export interface TransferenciaItemData {
  producto: Producto;
  presentacion: Presentacion;
  /** De dónde sale la mercadería: define contra qué stock se avisa. */
  sucursalOrigenId?: number;
  /** Para encabezar el selector de lotes: el saldo es el de esta sucursal. */
  sucursalOrigenNombre?: string;
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
 *
 * ⚠️ **El lote solo aparece si el producto lo lleva** (`producto.lote`), y
 * elegirlo es **opcional**: sin lote el central resuelve el desglose por FEFO,
 * que es lo que hicieron siempre todos los clientes. Con un lote elegido el
 * aviso de stock pasa a comparar contra el saldo **de ese lote** y no contra
 * el de la sucursal: es el número que de verdad limita lo que se puede sacar.
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

      @if (llevaLote) {
        <button type="button" class="fila-lote" (click)="elegirLote()">
          <span class="datos-lote">
            <span class="etiqueta-lote">Lote</span>
            @if (lote(); as elegido) {
              <span class="numero-lote">{{ elegido.numeroLote }}</span>
              <span class="detalle-lote">
                @if (vencimientoDelLote(); as vence) {
                  Vence {{ vence }}
                }
                @if (disponibleDelLote(); as saldo) {
                  @if (vencimientoDelLote()) {
                    ·
                  }
                  {{ saldo }} disponible
                }
              </span>
            } @else {
              <span class="numero-lote">Elegir lote</span>
              <span class="detalle-lote">Opcional. Sin elegir, se manda lo que vence antes.</span>
            }
          </span>
          <span class="chevron" aria-hidden="true">›</span>
        </button>
      }

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

      @if (lote(); as elegido) {
        @if (disponible() !== null) {
          <p class="stock" [class.excede]="excede()">
            El lote {{ elegido.numeroLote }} tiene {{ existencia() }} unidades.
            @if (excede()) {
              Estás pidiendo {{ pedidas() }}: se manda igual, pero revisá.
            }
          </p>
        }
      } @else if (stock() !== null) {
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
    .fila-lote {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      margin-bottom: var(--sp-3);
      padding: var(--sp-3);
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      font: inherit;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .fila-lote:hover { background: var(--surface-sunken); }
    .datos-lote { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .etiqueta-lote { font-size: var(--fs-caption); color: var(--text-mute); }
    .numero-lote { font-weight: var(--fw-medium); }
    .detalle-lote {
      font-size: var(--fs-caption);
      color: var(--text-mute);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chevron { flex-shrink: 0; color: var(--text-mute); }
  `,
})
export class TransferenciaItemDialogComponent {
  readonly data = inject<TransferenciaItemData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<TransferenciaItemDialogComponent, TransferenciaItemDraft | undefined>>(
      MatDialogRef,
    );
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly dialogo = inject(DialogoService);

  readonly etiqueta = etiquetaPresentacion(this.data.presentacion);

  /**
   * ⚠️ **Lo dice el producto, no la presencia de lotes.** Un producto sin
   * control de lote puede tener filas en el ledger por una carga vieja, y
   * ofrecer elegir ahí sugeriría una trazabilidad que el negocio no lleva.
   */
  readonly llevaLote = this.data.producto?.lote === true;

  readonly cantidad = signal<number | null>(
    this.data.draft?.cantidad ?? this.data.cantidadInicial ?? null,
  );
  readonly vencimiento = signal<string | null>(this.data.draft?.vencimiento ?? null);
  readonly observacion = signal(this.data.draft?.observacion ?? '');
  readonly lote = signal<LoteElegido | null>(this.data.draft?.lote ?? null);

  /**
   * La existencia en origen. `null` mientras no se sabe: «no pude
   * consultarla» y «no hay» son respuestas distintas, y mostrar cero sería
   * afirmar la segunda.
   */
  readonly stock = signal<number | null>(null);

  /**
   * Contra qué existencia se avisa.
   *
   * ⚠️ **Con un lote elegido manda el saldo del lote.** El de la sucursal
   * suma todos los lotes: comparar contra él diría que hay mercadería de
   * sobra mientras el lote del que se va a sacar está casi vacío, que es
   * justamente el caso que elegir a mano viene a resolver.
   */
  readonly disponible = computed(() => {
    const elegido = this.lote();
    // Con lote elegido el saldo de la sucursal deja de ser la referencia
    // correcta, así que tampoco se usa como reemplazo cuando el del lote no
    // se conoce: ahí no se dice nada, que es la respuesta honesta.
    return elegido ? (elegido.cantidadDisponible ?? null) : this.stock();
  });

  readonly existencia = computed(() => formatearCantidad(this.disponible() ?? 0, 0));
  readonly pedidas = computed(() =>
    formatearCantidad((this.cantidad() ?? 0) * (this.data.presentacion?.cantidad ?? 1), 0),
  );
  readonly excede = computed(() =>
    excedeElStock(this.cantidad() ?? 0, this.data.presentacion, this.disponible()),
  );
  /** El saldo en presentaciones, o vacío si no se consultó. */
  readonly disponibleDelLote = computed(() => {
    const saldo = this.lote()?.cantidadDisponiblePresentacion;
    return saldo == null ? '' : formatearCantidad(saldo, 0);
  });
  readonly vencimientoDelLote = computed(() =>
    fechaLegible(this.lote()?.fechaVencimiento, { conHora: false }),
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

  /**
   * Abre el selector.
   *
   * ⚠️ **Tres resultados, no dos.** Un lote reemplaza al anterior, `null` es
   * «sacale el lote» y `undefined` es cancelar, que no toca lo que había.
   */
  async elegirLote(): Promise<void> {
    const productoId = this.data.producto?.id;
    const sucursalOrigenId = this.data.sucursalOrigenId;
    if (productoId == null || sucursalOrigenId == null) {
      return;
    }

    const elegido = await this.dialogo.abrir<
      SeleccionarLoteDialogComponent,
      DatosSeleccionarLote,
      LoteElegido | null | undefined
    >(SeleccionarLoteDialogComponent, {
      productoId,
      productoDescripcion: this.data.producto.descripcion ?? '',
      sucursalOrigenId,
      sucursalOrigenNombre: this.data.sucursalOrigenNombre,
      presentacionId: this.data.presentacion?.id as number | undefined,
      loteElegidoId: this.lote()?.loteId,
    });

    if (elegido === undefined) {
      return;
    }
    this.lote.set(elegido);
    this.sugerirVencimiento(elegido);
  }

  /**
   * Escribe el vencimiento del lote **solo si el campo está vacío**.
   *
   * El dato ya vino con el lote y tipearlo de nuevo es una oportunidad más de
   * equivocarse; pero pisar lo que el operador escribió sería peor: el papel
   * que tiene en la mano gana sobre lo que el maestro dice.
   */
  private sugerirVencimiento(elegido: LoteElegido | null): void {
    if (elegido?.fechaVencimiento && !this.vencimiento()) {
      this.vencimiento.set(elegido.fechaVencimiento);
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
      lote: this.lote(),
    });
  }

  cancelar(): void {
    this.ref.close(undefined);
  }
}
