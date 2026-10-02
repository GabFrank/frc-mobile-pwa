import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import {
  MotivoModificacion,
  TransferenciaItem,
} from 'src/app/domains/transferencia/transferencia.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { declaradoEnEtapaAnterior, EtapaVerificacion, VerificacionItem } from './etapas';

export interface ModificarItemData {
  item: TransferenciaItem;
  etapa: EtapaVerificacion;
  /** Cómo se llama la etapa en la pantalla: «Preparado», «Despachado»… */
  etiquetaEtapa: string;
}

/**
 * «Va, pero distinto a lo declarado».
 *
 * ⚠️ **Se muestra siempre lo que declaró la etapa anterior.** Modificar sin
 * ver contra qué es adivinar: la diferencia entre lo pedido y lo preparado es
 * el dato que el módulo existe para conservar.
 *
 * ⚠️ **La presentación se puede cambiar, y cambia el significado del número.**
 * Se pide en cajas y se despacha en unidades: 2 cajas de 12 y 24 unidades son
 * lo mismo, y una cantidad sin su presentación no dice nada.
 */
@Component({
  selector: 'frc-modificar-item-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    SelectorComponent,
    CampoFechaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Modificar ítem</h2>

    <mat-dialog-content>
      <p class="producto">{{ data.item.producto?.descripcion ?? 'Producto' }}</p>

      <div class="anterior">
        <div class="dato">
          <span class="etiqueta">Cantidad declarada</span>
          <span class="cifra">{{ cantidadAnterior() }}</span>
        </div>
        <div class="dato">
          <span class="etiqueta">Presentación declarada</span>
          <span class="cifra">{{ porBultoAnterior() }}</span>
        </div>
      </div>

      <mat-form-field appearance="outline" class="campo">
        <mat-label>Nueva cantidad</mat-label>
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

      @if (opcionesPresentacion().length > 0) {
        <frc-selector
          etiqueta="Presentación"
          [opciones]="opcionesPresentacion()"
          [valor]="presentacionId()"
          (valorChange)="presentacionId.set($any($event))"
        />
      }

      <frc-campo-fecha
        etiqueta="Vencimiento"
        ayuda="Dejalo vacío si el producto no vence."
        [valor]="vencimiento()"
        (valorChange)="vencimiento.set($event)"
      />
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cerrar()">Cancelar</button>
      <button matButton="filled" [disabled]="!valido()" (click)="aceptar()">Guardar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .producto {
      font-weight: var(--fw-medium);
      margin: 0 0 var(--sp-3);
    }
    .anterior {
      display: flex;
      gap: var(--sp-4);
      margin-bottom: var(--sp-4);
    }
    .dato {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .etiqueta {
      color: var(--text-mute);
      font-size: var(--fs-caption);
    }
    .cifra {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .campo { width: 100%; }
  `,
})
export class ModificarItemDialogComponent {
  readonly data = inject<ModificarItemData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<ModificarItemDialogComponent, VerificacionItem | undefined>>(MatDialogRef);
  private readonly productos = inject(ProductoBusquedaService);

  private readonly anterior = declaradoEnEtapaAnterior(this.data.item, this.data.etapa);

  readonly cantidad = signal<number | null>(this.anterior.cantidad ?? null);
  readonly presentacionId = signal<number | null>(this.anterior.presentacionId ?? null);
  readonly vencimiento = signal<string | null>(soloFecha(this.anterior.vencimiento));

  private readonly presentaciones = signal<Presentacion[]>([]);

  readonly opcionesPresentacion = computed<OpcionSeleccion[]>(() =>
    this.presentaciones()
      .filter((p) => p.id != null)
      .map((p) => ({ valor: p.id as number, texto: etiquetaPresentacion(p) })),
  );

  /** Cantidad en cero es válida: es «va, pero ninguno». Vacío no lo es. */
  readonly valido = computed(() => {
    const valor = this.cantidad();
    return valor != null && Number.isFinite(Number(valor)) && Number(valor) >= 0;
  });

  constructor() {
    const productoId = this.data.item.producto?.id;
    if (productoId != null) {
      // Si falla, el selector no aparece y se modifica la cantidad sola: es
      // preferible a bloquear la verificación entera por no poder listar
      // presentaciones.
      this.productos.detalle(productoId).subscribe({
        next: (producto) => this.presentaciones.set(producto?.presentaciones ?? []),
        error: () => this.presentaciones.set([]),
      });
    }
  }

  cantidadAnterior(): string {
    const valor = this.anterior.cantidad;
    return valor == null ? '—' : formatearCantidad(valor, Number.isInteger(valor) ? 0 : 2);
  }

  porBultoAnterior(): string {
    const valor = this.anterior.porBulto;
    return valor == null ? '—' : formatearCantidad(valor, Number.isInteger(valor) ? 0 : 2);
  }

  aceptar(): void {
    this.ref.close({
      cantidad: Number(this.cantidad()),
      presentacionId: this.presentacionId() ?? this.anterior.presentacionId ?? null,
      vencimiento: this.vencimiento(),
      motivoModificacion: this.motivoDelCambio(),
    });
  }

  cerrar(): void {
    this.ref.close(undefined);
  }

  /**
   * Qué se modificó, de verdad.
   *
   * ⚠️ `frc-mobile` graba siempre `CANTIDAD_INCORRECTA`, aun cuando lo que
   * cambió fue el vencimiento o la presentación. El enum tiene los tres
   * valores justamente para poder distinguirlos después; grabar el motivo
   * equivocado hace que el reporte de diferencias mienta.
   *
   * Si no cambió nada, no hay modificación: el ítem queda confirmado tal
   * como venía.
   */
  private motivoDelCambio(): MotivoModificacion | null {
    const presentacionElegida = this.presentacionId() ?? this.anterior.presentacionId ?? null;
    if (
      this.anterior.presentacionId != null &&
      presentacionElegida != null &&
      Number(presentacionElegida) !== Number(this.anterior.presentacionId)
    ) {
      return MotivoModificacion.PRESENTACION_INCORRECTA;
    }
    if (Number(this.cantidad()) !== Number(this.anterior.cantidad ?? NaN)) {
      return MotivoModificacion.CANTIDAD_INCORRECTA;
    }
    if (this.vencimiento() !== soloFecha(this.anterior.vencimiento)) {
      return MotivoModificacion.VENCIMIENTO_INCORRECTO;
    }
    return null;
  }
}

/**
 * `yyyy-MM-dd` de lo que llegue.
 *
 * El vencimiento viene del central como `Date` de GraphQL, que Apollo entrega
 * como texto ISO con hora, y `frc-campo-fecha` trabaja en fecha sola.
 */
function soloFecha(valor: string | undefined): string | null {
  if (!valor) {
    return null;
  }
  const encontrada = /^\d{4}-\d{2}-\d{2}/.exec(valor);
  return encontrada ? encontrada[0] : null;
}
