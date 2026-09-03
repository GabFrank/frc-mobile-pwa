import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import {
  ESTADO_LOTE_TEXTO,
  EstadoLote,
  type StockLotePresentacion,
} from 'src/app/domains/lote/lote.model';
import { LoteService } from 'src/app/domains/lote/lote.service';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';

/** Cuántos lotes por página. Un producto de rotación alta acumula uno por recepción. */
const POR_PAGINA = 10;

/**
 * Deja una fecha del central en `yyyy-MM-dd`.
 *
 * ⚠️ **El central serializa todo `Date` como `yyyy-MM-dd HH:mm`**, incluso un
 * vencimiento que es un día y no un instante. Ese texto entra igual en
 * `frc-campo-fecha` —lee los primeros diez caracteres— pero **vuelve al
 * central tal cual si nadie toca el campo**, y en pantalla se lee
 * «12/12/2026 00:00», una hora que no significa nada. Recortarlo acá deja una
 * sola forma de la fecha dando vueltas.
 */
function soloFecha(valor: string | undefined): string | undefined {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(valor ?? '');
  return m ? m[0] : undefined;
}

export interface DatosSeleccionarLote {
  productoId: number;
  productoDescripcion: string;
  /** De dónde sale la mercadería: el saldo es el de ESA sucursal. */
  sucursalOrigenId: number;
  sucursalOrigenNombre?: string;
  /** Contra qué presentación se expresa el saldo. Es la del renglón que se carga. */
  presentacionId?: number;
  /** El lote que el ítem ya tenía asignado, para poder corregirlo en vez de recargarlo. */
  loteElegidoId?: number;
}

/**
 * El lote que el diálogo devuelve. `null` es «que lo decida el sistema».
 *
 * ⚠️ **El saldo es opcional y su ausencia significa «no lo sé»**, no «cero».
 * Un ítem que se reabre para editar trae de la asignación guardada el número
 * de lote pero no su saldo —es otra consulta y de otro momento—, y afirmar
 * cero ahí diría que el lote está vacío cuando nadie lo consultó.
 */
export interface LoteElegido {
  loteId: number;
  numeroLote: string;
  /** Saldo del lote en unidades base: es contra esto que la carga avisa si se excede. */
  cantidadDisponible?: number;
  /** El mismo saldo en presentaciones completas, para mostrarlo. */
  cantidadDisponiblePresentacion?: number;
  /** `yyyy-MM-dd`, ya recortado de lo que manda el central. */
  fechaVencimiento?: string;
}

/**
 * De qué lote sale un ítem de transferencia.
 *
 * Por defecto el central reparte por **FEFO** —lo que vence antes sale
 * primero—, y eso es lo correcto casi siempre. Este diálogo existe para el
 * caso en que el depósito real no coincide con ese orden teórico: el lote que
 * vence antes está al fondo de la estiba y el que se manda es otro.
 *
 * ⚠️ **Elegir es opcional, y salir sin elegir no es un error.** Sin
 * asignación el ítem se resuelve por FEFO, que es exactamente lo que hicieron
 * todos los clientes hasta ahora. Obligar a elegir trabaría la carga cada vez
 * que el número no se lee en el envase.
 *
 * ⚠️ **Un solo lote por ítem.** El central acepta repartir un renglón entre
 * varios, pero ninguna pantalla lo hace: cargar dos veces el mismo producto es
 * más simple de entender y de auditar que un renglón partido.
 *
 * ⚠️ **El saldo viene convertido del central**, no dividido acá. Es la misma
 * regla con la que después reparte el stock contra el lote elegido; tenerla
 * también en la pantalla es la forma de que el número mostrado y el
 * descontado dejen de coincidir.
 *
 * ⚠️ **Los lotes que no están `LIBERADO` se listan deshabilitados, no
 * ocultos.** Bloquear un lote es el mecanismo de recall: si desapareciera de
 * la lista, el operador buscaría el que tiene en la mano y no entendería por
 * qué no está.
 */
@Component({
  selector: 'frc-seleccionar-lote-dialog',
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
      <h2>Elegir lote</h2>
      <p class="contexto">
        <span class="etiqueta">Producto</span>
        {{ datos.productoDescripcion }}
        @if (datos.sucursalOrigenNombre) {
          <span class="etiqueta">Saldo en {{ datos.sucursalOrigenNombre }}</span>
        }
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
              : 'Este producto no tiene lotes con saldo en esta sucursal. Se puede mandar igual: el sistema resuelve el desglose por FEFO.'
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
                [class.elegida]="esElegido(lote)"
                [disabled]="!esElegible(lote)"
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
                      · {{ textoEstado(lote.estado) }} — no se puede mandar
                    }
                  </span>
                </span>
                <span class="saldo">
                  <span class="cifra">{{ enPresentacion(lote) }}</span>
                  @if (sobrantes(lote); as detalle) {
                    <span class="sueltas">{{ detalle }}</span>
                  }
                </span>
              </button>
            </li>
          }
        </ul>

        @if (hayMas()) {
          <button matButton [disabled]="trayendoMas()" (click)="traerMas()">
            {{ trayendoMas() ? 'Trayendo…' : 'Ver más lotes' }}
          </button>
        }
      }

      <!--
        Salir sin lote no es cancelar: es la opción por defecto del sistema, y
        la única forma de sacarle a un renglón un lote elegido antes.
      -->
      <div class="acciones">
        <button matButton (click)="sinLote()">
          {{ datos.loteElegidoId ? 'Sacar el lote' : 'Que decida el sistema' }}
        </button>
        <button matButton (click)="cerrar()">Cancelar</button>
      </div>
      <p class="fefo">Sin lote elegido, se manda lo que vence antes (FEFO).</p>
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
    .opcion.elegida { border-color: var(--brand-text); }
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
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
    }
    .cifra { font-size: var(--fs-label); color: var(--text-soft); }
    .sueltas { font-size: var(--fs-caption); color: var(--text-mute); }
    .acciones { display: flex; justify-content: flex-end; gap: var(--sp-2); }
    .fefo { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
  `,
})
export class SeleccionarLoteDialogComponent {
  private readonly lotes_ = inject(LoteService);
  private readonly ref =
    inject<MatDialogRef<SeleccionarLoteDialogComponent, LoteElegido | null | undefined>>(
      MatDialogRef,
    );
  readonly datos = inject<DatosSeleccionarLote>(MAT_DIALOG_DATA);

  readonly liberado = EstadoLote.LIBERADO;

  readonly texto = signal('');
  readonly lotes = signal<StockLotePresentacion[]>([]);
  readonly cargando = signal(true);
  readonly trayendoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  /** Página traída. La lista acumula: en el teléfono se scrollea, no se pagina. */
  private pagina = 0;

  /**
   * El texto que se está esperando para buscar. Sin esto cada tecla es un
   * viaje al central; con un `setTimeout` alcanza para un solo campo.
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
    this.pagina = 0;
    this.cargando.set(true);
    this.error.set(null);
    this.traer(true);
  }

  traerMas(): void {
    this.pagina += 1;
    this.trayendoMas.set(true);
    this.traer(false);
  }

  private traer(reemplaza: boolean): void {
    this.lotes_
      .stockEnPresentacion(
        this.datos.productoId,
        this.datos.sucursalOrigenId,
        this.datos.presentacionId,
        this.texto(),
        this.pagina,
        POR_PAGINA,
      )
      .subscribe({
        next: (paginaResultado) => {
          const traidos = paginaResultado?.getContent ?? [];
          this.lotes.set(reemplaza ? traidos : [...this.lotes(), ...traidos]);
          this.hayMas.set(paginaResultado?.hasNext === true);
          this.cargando.set(false);
          this.trayendoMas.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.cargando.set(false);
          this.trayendoMas.set(false);
        },
      });
  }

  /** Solo los `LIBERADO` salen del depósito: bloquear un lote es el recall. */
  esElegible(lote: StockLotePresentacion): boolean {
    return lote.estado === EstadoLote.LIBERADO;
  }

  esElegido(lote: StockLotePresentacion): boolean {
    return this.datos.loteElegidoId != null && Number(lote.loteId) === this.datos.loteElegidoId;
  }

  elegir(lote: StockLotePresentacion): void {
    if (!this.esElegible(lote) || lote.loteId == null) {
      return;
    }
    this.ref.close({
      loteId: Number(lote.loteId),
      numeroLote: lote.numeroLote ?? '',
      cantidadDisponible: lote.cantidadDisponible,
      cantidadDisponiblePresentacion: lote.cantidadDisponiblePresentacion,
      fechaVencimiento: soloFecha(lote.fechaVencimiento),
    });
  }

  /**
   * ⚠️ **`null` y `undefined` significan cosas distintas acá.** `null` es
   * «sacale el lote, que lo resuelva FEFO» y llega hasta el central como una
   * lista vacía; `undefined` es cancelar, y no toca nada.
   */
  sinLote(): void {
    this.ref.close(null);
  }

  cerrar(): void {
    this.ref.close(undefined);
  }

  /** El saldo en presentaciones completas, que es la unidad del renglón. */
  enPresentacion(lote: StockLotePresentacion): string {
    return formatearCantidad(lote.cantidadDisponiblePresentacion ?? 0, 0);
  }

  /**
   * El detalle en unidades, solo cuando la presentación vale más de una.
   *
   * ⚠️ **Las unidades sobrantes se muestran a propósito.** Un lote con 20
   * unidades y presentación «caja x 6» da 3 cajas: sin decir que sobran 2, el
   * operador cree que se le perdieron.
   */
  sobrantes(lote: StockLotePresentacion): string {
    if ((lote.unidadesPorPresentacion ?? 1) <= 1) {
      return '';
    }
    const total = formatearCantidad(lote.cantidadDisponible ?? 0, 0) + ' unid.';
    return lote.unidadesSobrantes ? total + ' · sobran ' + lote.unidadesSobrantes : total;
  }

  legible(fecha: string): string {
    return fechaLegible(fecha, { conHora: false }) ?? fecha;
  }

  textoEstado(estado: EstadoLote): string {
    return ESTADO_LOTE_TEXTO[estado] ?? estado;
  }
}
