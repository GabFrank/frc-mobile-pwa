import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import {
  DevolucionItemDraft,
  MotivoAveria,
} from 'src/app/domains/devolucion/devolucion.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import type { LoteDeProducto } from 'src/app/domains/lote/lote.model';
import {
  BuscadorLoteDialogComponent,
  type DatosBuscadorLote,
} from 'src/app/pages/inventario/buscador-lote-dialog.component';

export interface DevolucionItemData {
  producto: Producto;
  presentacion: Presentacion;
  motivos: MotivoAveria[];
  /** Cantidad leída de un código de balanza, si vino de un pesable. */
  cantidadInicial?: number;
  /** Para editar un ítem ya cargado. */
  draft?: DevolucionItemDraft;
  /** Sucursal de origen: el saldo de cada lote se muestra para esa sucursal. */
  sucursalId?: number;
}

/**
 * Datos del producto que se devuelve: cuánto, por qué, de qué lote.
 *
 * Se abre después de elegir el producto en el buscador. Lo que decide el
 * destino económico de la devolución es el **motivo**: sus flags
 * `generaGasto` y `aplicaProveedor` determinan si la pérdida es de la empresa
 * o si se le puede reclamar al proveedor.
 */
@Component({
  selector: 'frc-devolucion-item-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    SelectorComponent,
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

      <frc-selector
        etiqueta="Motivo de avería"
        [opciones]="opcionesMotivo"
        [valor]="motivoId()"
        (valorChange)="motivoId.set($event)"
      />

      @if (motivoElegido(); as m) {
        <p class="destino">
          @if (m.aplicaProveedor) {
            Se le puede reclamar al proveedor.
          } @else {
            <!--
              Es la consecuencia económica del motivo y conviene verla antes
              de guardar, no al final del circuito cuando ya no se puede
              cambiar: un motivo que no aplica al proveedor no puede terminar
              en ACREDITADO.
            -->
            Sin reclamo al proveedor: la pérdida es de la empresa.
          }
        </p>
      }

      @if (llevaLote) {
        <!--
          Producto con control de lote: el lote se elige del maestro, no se
          tipea. Al separar, el central descuenta la baja de ese lote.
        -->
        @if (loteId() != null) {
          <p class="elegido">
            Lote {{ lote() }}
            <button type="button" class="cambiar" (click)="quitarLote()">Quitar</button>
          </p>
        } @else {
          <p class="destino">Sin lote elegido, la baja sale del que vence primero.</p>
        }
        <button matButton="tonal" (click)="elegirLote()">
          {{ loteId() != null ? 'Cambiar lote' : 'Elegir lote' }}
        </button>
      } @else {
        <mat-form-field appearance="outline" class="campo">
          <mat-label>Lote</mat-label>
          <input matInput [ngModel]="lote()" (ngModelChange)="lote.set($event)" autocapitalize="characters" />
        </mat-form-field>
      }

      <mat-form-field appearance="outline" class="campo">
        <mat-label>Vencimiento</mat-label>
        <input matInput type="date" [ngModel]="vencimiento()" (ngModelChange)="vencimiento.set($event)" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="campo">
        <mat-label>Observación</mat-label>
        <input matInput [ngModel]="motivo()" (ngModelChange)="motivo.set($event)" />
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cancelar()">Cancelar</button>
      <button matButton="filled" [disabled]="!valido()" (click)="aceptar()">Agregar</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      padding-top: var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .presentacion {
      margin: 0;
      color: var(--text-soft);
      font-size: var(--fs-label);
    }
    .campo { width: 100%; }
    .destino {
      margin: 0;
      font-size: var(--fs-caption);
      color: var(--text-soft);
    }
    .elegido {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-weight: var(--fw-medium);
      margin: 0;
    }
    .cambiar {
      background: none;
      border: 0;
      color: var(--brand-text);
      font-size: var(--fs-caption);
      cursor: pointer;
      padding: var(--sp-1);
    }
  `,
})
export class DevolucionItemDialogComponent {
  readonly data = inject<DevolucionItemData>(MAT_DIALOG_DATA);
  private readonly dialogo = inject(DialogoService);
  private readonly ref =
    inject<MatDialogRef<DevolucionItemDialogComponent, DevolucionItemDraft | undefined>>(
      MatDialogRef,
    );

  readonly etiqueta = etiquetaPresentacion(this.data.presentacion);

  readonly cantidad = signal<number | null>(
    this.data.draft?.cantidad ?? this.data.cantidadInicial ?? null,
  );
  readonly motivoId = signal<unknown>(this.data.draft?.motivoAveria?.id ?? null);
  /** El producto lleva control de lote: el lote se elige del maestro. */
  readonly llevaLote = this.data.producto.lote === true;
  readonly lote = signal(this.data.draft?.lote ?? '');
  readonly loteId = signal<number | null>(this.data.draft?.loteId ?? null);
  readonly vencimiento = signal(this.data.draft?.vencimiento ?? '');
  readonly motivo = signal(this.data.draft?.motivo ?? '');

  readonly opcionesMotivo: OpcionSeleccion[] = this.data.motivos.map((m) => ({
    valor: m.id,
    texto: String(m.descripcion ?? ''),
    detalle: m.aplicaProveedor ? 'con proveedor' : 'sin proveedor',
  }));

  readonly motivoElegido = computed(() =>
    this.data.motivos.find((m) => String(m.id) === String(this.motivoId())),
  );

  /** Cantidad mayor a cero y motivo elegido: lo demás es opcional. */
  readonly valido = computed(() => (this.cantidad() ?? 0) > 0 && this.motivoElegido() != null);

  aceptar(): void {
    const motivoAveria = this.motivoElegido();
    const cantidad = this.cantidad();
    if (!motivoAveria || cantidad == null || cantidad <= 0) {
      return;
    }
    this.ref.close({
      producto: this.data.producto,
      presentacion: this.data.presentacion,
      motivoAveria,
      cantidad,
      lote: this.lote().trim() || undefined,
      loteId: this.llevaLote ? (this.loteId() ?? undefined) : undefined,
      vencimiento: this.vencimiento() || undefined,
      motivo: this.motivo().trim() || undefined,
    });
  }

  /**
   * Abre el buscador de lotes del inventario. Lista también los lotes sin
   * saldo y los bloqueados: quien devuelve tiene el lote en la mano, y un
   * lote en recall es justamente lo que se devuelve.
   */
  async elegirLote(): Promise<void> {
    const productoId = Number(this.data.producto.id);
    if (this.data.producto.id == null || !Number.isFinite(productoId)) {
      return;
    }
    const elegido = await this.dialogo.abrir<
      BuscadorLoteDialogComponent,
      DatosBuscadorLote,
      LoteDeProducto | undefined
    >(BuscadorLoteDialogComponent, {
      productoId,
      productoDescripcion: String(this.data.producto.descripcion ?? ''),
      sucursalId: this.data.sucursalId,
      titulo: 'Lote que se devuelve',
    });
    if (elegido?.loteId == null) {
      return;
    }
    this.loteId.set(Number(elegido.loteId));
    this.lote.set(elegido.numeroLote ?? '');
    // El vencimiento del lote, si el campo todavía está vacío.
    if (!this.vencimiento() && elegido.fechaVencimiento) {
      this.vencimiento.set(elegido.fechaVencimiento.slice(0, 10));
    }
  }

  quitarLote(): void {
    this.loteId.set(null);
    this.lote.set('');
  }

  cancelar(): void {
    this.ref.close(undefined);
  }
}
