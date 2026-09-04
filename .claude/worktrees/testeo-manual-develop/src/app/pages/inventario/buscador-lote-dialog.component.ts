import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { LoteService } from 'src/app/domains/lote/lote.service';
import { ESTADO_LOTE_TEXTO, EstadoLote, type LoteDeProducto } from 'src/app/domains/lote/lote.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';

export interface DatosBuscadorLote {
  productoId: number;
  productoDescripcion: string;
  sucursalId?: number;
  /** Lotes que la zona ya tiene: se muestran deshabilitados en vez de esconderse. */
  yaEnLaZona?: number[];
}

/**
 * Elegir un lote de un producto para sumarlo al conteo.
 *
 * ⚠️ **Lista los lotes con saldo CERO también, y es a propósito.** Son
 * exactamente los que hacen falta para atribuir mercadería que está en la
 * góndola sin lote asignado: si solo se ofrecieran los que el sistema cree
 * tener, el operador no podría registrar el lote que tiene en la mano. El
 * central los devuelve por eso (`buscarLotesDeProducto` parte del maestro, no
 * del saldo).
 *
 * ⚠️ **El filtro lo aplica el central, no esta pantalla.** Un producto de
 * rotación alta acumula un lote por recepción: traerlos todos para filtrar en
 * memoria deja de funcionar apenas pasan unas decenas. Además el central
 * normaliza el texto igual que al crear el lote, así que «l-20» encuentra
 * «L-2026-88» — replicarlo acá sería tener la regla en dos lados.
 *
 * ⚠️ **Los lotes que la zona ya tiene se muestran deshabilitados, no ocultos.**
 * Esconderlos deja al operador buscando un lote que ve en la góndola y no
 * aparece en la lista, sin ninguna explicación.
 */
@Component({
  selector: 'frc-buscador-lote-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Agregar lote</h2>
      <p class="contexto">
        <span class="etiqueta">Producto</span>
        {{ datos.productoDescripcion }}
      </p>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Buscar por número de lote</mat-label>
        <input
          matInput
          [ngModel]="texto()"
          (ngModelChange)="filtrar($event)"
          autocomplete="off"
          enterkeyhint="search"
        />
      </mat-form-field>

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="buscar()" />
      } @else if (lotes().length === 0) {
        <frc-estado-vacio
          titulo="Sin lotes"
          [detalle]="
            texto()
              ? 'Ningún lote de este producto coincide con lo buscado.'
              : 'Este producto todavía no tiene ningún lote registrado. Se crean al recibir mercadería o desde el ajuste de stock del escritorio.'
          "
          icono="producto"
        />
      } @else {
        <ul class="lista">
          @for (lote of lotes(); track lote.loteId) {
            <li>
              <button
                type="button"
                class="opcion"
                [disabled]="yaEsta(lote)"
                (click)="elegir(lote)"
              >
                <span class="datos">
                  <span class="numero">{{ lote.numeroLote }}</span>
                  <span class="detalle">
                    @if (lote.fechaVencimiento) {
                      Vence {{ legible(lote.fechaVencimiento) }}
                    } @else {
                      Sin vencimiento cargado
                    }
                    @if (lote.estado && lote.estado !== liberado) {
                      · {{ textoEstado(lote.estado) }}
                    }
                  </span>
                </span>
                <span class="saldo">
                  @if (yaEsta(lote)) {
                    ya está
                  } @else {
                    {{ formatear(lote.saldo) }}
                  }
                </span>
              </button>
            </li>
          }
        </ul>
      }

      <div class="acciones">
        <button matButton (click)="cerrar()">Cancelar</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; }
    h2 { margin: 0; font-size: var(--fs-title); }
    .contexto { margin: 0; display: flex; flex-direction: column; }
    .etiqueta { font-size: var(--fs-caption); color: var(--text-mute); }
    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      max-height: 50vh;
      overflow-y: auto;
    }
    .opcion {
      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3);
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      font: inherit;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .opcion:hover:not(:disabled) { background: var(--surface-sunken); }
    .opcion:disabled { opacity: 0.5; cursor: default; }
    .datos { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .numero { font-weight: var(--fw-medium); }
    .detalle {
      font-size: var(--fs-caption);
      color: var(--text-mute);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .saldo {
      flex-shrink: 0;
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-size: var(--fs-label);
      color: var(--text-soft);
    }
    .acciones { display: flex; justify-content: flex-end; }
  `,
})
export class BuscadorLoteDialogComponent {
  private readonly lotes_ = inject(LoteService);
  private readonly ref = inject<MatDialogRef<BuscadorLoteDialogComponent, LoteDeProducto | undefined>>(
    MatDialogRef,
  );
  readonly datos = inject<DatosBuscadorLote>(MAT_DIALOG_DATA);

  readonly liberado = EstadoLote.LIBERADO;

  readonly texto = signal('');
  readonly lotes = signal<LoteDeProducto[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /**
   * El texto que se está esperando para buscar.
   *
   * Sin esto, cada tecla es un viaje al central. Con un `setTimeout` alcanza:
   * no hay que traer una librería para un debounce de un solo campo.
   */
  private pendiente?: ReturnType<typeof setTimeout>;

  constructor() {
    this.buscar();
  }

  filtrar(valor: string): void {
    this.texto.set(valor);
    clearTimeout(this.pendiente);
    this.pendiente = setTimeout(() => this.buscar(), 300);
  }

  buscar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.lotes_
      .buscar(this.datos.productoId, this.datos.sucursalId, this.texto(), 0, 20)
      .subscribe({
        next: (pagina) => {
          this.lotes.set(pagina?.getContent ?? []);
          this.cargando.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.cargando.set(false);
        },
      });
  }

  yaEsta(lote: LoteDeProducto): boolean {
    return (this.datos.yaEnLaZona ?? []).includes(Number(lote.loteId));
  }

  elegir(lote: LoteDeProducto): void {
    this.ref.close(lote);
  }

  cerrar(): void {
    this.ref.close(undefined);
  }

  legible(fecha: string): string {
    return fechaLegible(fecha, { conHora: false }) ?? fecha;
  }

  formatear(saldo: number | undefined): string {
    return formatearCantidad(saldo ?? 0, 2);
  }

  textoEstado(estado: EstadoLote): string {
    return ESTADO_LOTE_TEXTO[estado] ?? estado;
  }
}
