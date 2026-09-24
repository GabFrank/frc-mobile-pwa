import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';

import { NotaRecepcionItem } from 'src/app/domains/pedidos/recepcion.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';

export interface SeleccionarNotaRechazoData {
  producto: string;
  /** Cuánto se está rechazando, en unidad base. */
  cantidadRechazada: number;
  items: NotaRecepcionItem[];
}

/**
 * A qué nota se le imputa el rechazo.
 *
 * ⚠️ **No es una formalidad administrativa.** El backend reparte lo recibido
 * entre las notas por su cuenta, pero el rechazo lo asigna **solo** a la
 * línea que se elija acá. Si llegara sin línea, el rechazo se pierde en
 * silencio: la mutation devuelve `true` y las cantidades rechazadas quedan
 * en cero. Por eso la pantalla nunca manda un rechazo sin este id.
 *
 * ⚠️ **La nota elegida tiene que tener pendiente suficiente.** Si no, el
 * backend rechaza la operación entera. Por eso cada opción muestra cuánto
 * queda pendiente en esa nota.
 */
@Component({
  selector: 'frc-seleccionar-nota-rechazo-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatRadioModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>¿A qué nota se imputa el rechazo?</h2>

    <mat-dialog-content>
      <p class="contexto">
        {{ data.producto }} · se rechazan {{ legible(data.cantidadRechazada) }} unidades
      </p>
      <p class="ayuda">
        El producto viene en más de una nota. El reclamo al proveedor sale
        contra la que elijas.
      </p>

      <mat-radio-group class="opciones" [value]="elegido()" (change)="elegir($event.value)">
        @for (item of data.items; track item.id) {
          <mat-radio-button [value]="item.id" [disabled]="!alcanza(item)">
            <span class="nota">Nota {{ numero(item) }}</span>
            <span class="detalle">{{ detalle(item) }}</span>
          </mat-radio-button>
        }
      </mat-radio-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cerrar()">Cancelar</button>
      <button matButton="filled" [disabled]="elegido() == null" (click)="confirmar()">
        Continuar
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .contexto { font-weight: var(--fw-medium); margin-bottom: var(--sp-1); }
    .ayuda {
      color: var(--text-mute);
      font-size: var(--fs-caption);
      margin-bottom: var(--sp-3);
    }
    .opciones { display: flex; flex-direction: column; gap: var(--sp-2); }
    .nota { font-weight: var(--fw-medium); }
    .detalle {
      display: block;
      color: var(--text-mute);
      font-size: var(--fs-caption);
    }
  `,
})
export class SeleccionarNotaRechazoDialogComponent {
  readonly data = inject<SeleccionarNotaRechazoData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<SeleccionarNotaRechazoDialogComponent, number | undefined>>(MatDialogRef);

  readonly elegido = signal<number | null>(null);

  constructor() {
    // Si una sola nota puede absorber el rechazo, viene preseleccionada: es
    // la única respuesta posible y no tiene sentido hacerla elegir.
    const posibles = this.data.items.filter((i) => this.alcanza(i));
    if (posibles.length === 1) {
      this.elegido.set(posibles[0].id ?? null);
    }
  }

  alcanza(item: NotaRecepcionItem): boolean {
    return this.pendiente(item) >= this.data.cantidadRechazada;
  }

  numero(item: NotaRecepcionItem): string {
    return String(item.notaRecepcion?.numero ?? item.notaRecepcion?.id ?? '—');
  }

  detalle(item: NotaRecepcionItem): string {
    const partes = [
      legibleCon(item.cantidadEnNota, 'en la nota'),
      legibleCon(this.pendiente(item), 'pendientes'),
    ].filter(Boolean);
    const texto = partes.join(' · ');
    return this.alcanza(item) ? texto : texto + ' · no alcanza para este rechazo';
  }

  legible(valor: number | undefined): string {
    return formatearCantidad(valor ?? 0, 0);
  }

  elegir(id: number): void {
    this.elegido.set(id);
  }

  confirmar(): void {
    this.ref.close(this.elegido() ?? undefined);
  }

  cerrar(): void {
    this.ref.close(undefined);
  }

  /**
   * Lo que falta recibir en esa línea.
   *
   * Si el backend no manda `cantidadPendiente` se calcula; si tampoco hay
   * cantidades, se asume que toda la nota está pendiente, que es el estado
   * inicial de una línea recién creada.
   */
  private pendiente(item: NotaRecepcionItem): number {
    if (item?.cantidadPendiente != null) {
      return item.cantidadPendiente;
    }
    const enNota = item?.cantidadEnNota ?? 0;
    return enNota - (item?.cantidadRecibida ?? 0) - (item?.cantidadRechazada ?? 0);
  }
}

function legibleCon(valor: number | undefined, sufijo: string): string {
  if (valor == null) {
    return '';
  }
  return formatearCantidad(valor, 0) + ' ' + sufijo;
}
