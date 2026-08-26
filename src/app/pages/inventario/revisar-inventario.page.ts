import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import type { InventarioProductoItem } from 'src/app/domains/inventario/inventario.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { TonoEstado } from 'src/app/shared/estado/estado-registry';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { diferenciaDe } from './inventario-conteo';
import { InventarioService } from './inventario.service';
import { EstadoRevision, OrdenRevision, estadoDeRevision, textoDeRevision } from './revision-item';

const TAMANO = 15;

/**
 * ⚠️ **«Natural» no puede valer `null` en el selector.** `mat-select` trata
 * `null` como «sin elegir» y muestra el campo vacío, aunque haya una opción
 * con ese valor. Por eso viaja como texto y recién se traduce a `null` al
 * llamar al central, que es donde `null` sí significa «sin orden especial».
 */
const ORDEN_NATURAL = 'natural';

const ORDENES: readonly { clave: string; texto: string }[] = [
  { clave: ORDEN_NATURAL, texto: 'Los últimos primero' },
  { clave: 'modificado', texto: 'Modificados primero' },
  { clave: 'cantidadExacta', texto: 'Cantidades exactas primero' },
];

const TONOS: Record<EstadoRevision, TonoEstado> = {
  exacta: 'ok',
  modificado: 'info',
  sinEstado: 'neutral',
};

/**
 * La segunda etapa del inventario: alguien contó, y acá se mira **qué quedó**.
 *
 * ⚠️ **Esta pantalla no corrige nada.** El conteo se edita en la carga, con
 * el producto delante; acá se recorre lo que ya está para decidir si el
 * inventario se finaliza. Poner un botón de editar sería invitar a cambiar
 * cantidades sin tener la mercadería a la vista.
 *
 * ⚠️ **El selector ordena, no filtra.** Es lo único que el central sabe
 * hacer con ese parámetro: sube los que coinciden y deja el resto detrás.
 * `frc-mobile` lo presenta igual —«Modificados primero»— pero además avisa
 * «no se encontraron productos con el criterio seleccionado» cuando la
 * página vuelve vacía, y eso hace leer como filtro algo que no lo es.
 */
@Component({
  selector: 'frc-revisar-inventario',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    SelectorComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Revisión de inventario" [conVolver]="true">
      <frc-selector
        etiqueta="Orden"
        [opciones]="opcionesOrden"
        [valor]="orden()"
        (valorChange)="cambiarOrden($event)"
      />

      @if (cargando()) {
        <frc-skeleton [cantidad]="5" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (items().length === 0) {
        <frc-estado-vacio
          titulo="Sin productos para revisar"
          detalle="Este inventario todavía no tiene ítems cargados."
          icono="inventario"
        />
      } @else {
        <p class="total">{{ total() }} ítem{{ total() === 1 ? '' : 's' }}</p>

        @for (item of items(); track item.id) {
          <frc-card [titulo]="descripcion(item)" [subtitulo]="presentacion(item)" icono="producto">
            <frc-estado-chip
              aparte
              [etiqueta]="textoEstado(item)"
              [tono]="tonoEstado(item)"
            />
            <span pie class="conteo">{{ conteo(item) }}</span>
            <span pie class="anterior">Anterior: {{ cantidad(item.cantidadAnterior) }}</span>
            @if (diferencia(item); as dif) {
              <span pie class="dif" [class.negativa]="dif.startsWith('−')">{{ dif }}</span>
            }
          </frc-card>
        }

        @if (hayMas()) {
          <button matButton class="mas" [disabled]="cargandoMas()" (click)="cargarMas()">
            {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
          </button>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .total { margin: 0; font-size: var(--fs-label); color: var(--text-mute); }
    .conteo, .anterior { font-size: var(--fs-caption); color: var(--text-mute); }
    .dif {
      font-size: var(--fs-caption);
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
      color: var(--warn);
    }
    .dif.negativa { color: var(--danger); }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class RevisarInventarioPage {
  private readonly servicio = inject(InventarioService);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly opcionesOrden: OpcionSeleccion[] = ORDENES.map((o) => ({
    valor: o.clave,
    texto: o.texto,
  }));

  readonly orden = signal<string>(ORDEN_NATURAL);
  readonly items = signal<InventarioProductoItem[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private pagina = 0;

  private readonly inventarioId = computed(() => {
    const valor = Number(this.id());
    return Number.isFinite(valor) && valor > 0 ? valor : null;
  });

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(agregando = false): void {
    const id = this.inventarioId();
    if (id == null) {
      this.error.set('Identificador de inventario inválido.');
      this.cargando.set(false);
      return;
    }

    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.items.set([]);
    }
    this.error.set(null);

    const orden: OrdenRevision =
      this.orden() === ORDEN_NATURAL ? null : (this.orden() as OrdenRevision);

    this.servicio.itemsParaRevisar(id, orden, this.pagina, TAMANO).subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.items.update((previos) => (agregando ? [...previos, ...contenido] : contenido));
        this.total.set(page?.getTotalElements ?? this.items().length);
        this.hayMas.set(page?.hasNext === true);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
    });
  }

  cargarMas(): void {
    this.pagina++;
    this.cargandoMas.set(true);
    this.cargar(true);
  }

  cambiarOrden(valor: unknown): void {
    this.orden.set(String(valor ?? ORDEN_NATURAL));
    this.cargar();
  }

  descripcion(item: InventarioProductoItem): string {
    return item.presentacion?.producto?.descripcion ?? 'Producto';
  }

  /** La presentación es la unidad del conteo, no un detalle del producto. */
  presentacion(item: InventarioProductoItem): string {
    const cantidad = item.presentacion?.cantidad;
    return cantidad != null ? `Presentación x ${cantidad}` : 'Presentación';
  }

  textoEstado(item: InventarioProductoItem): string {
    return textoDeRevision(estadoDeRevision(item));
  }

  tonoEstado(item: InventarioProductoItem): TonoEstado {
    return TONOS[estadoDeRevision(item)];
  }

  /**
   * ⚠️ Lo contado es `cantidad` y el stock del sistema `cantidadFisica`, al
   * revés de lo que sugieren los nombres. Ver {@link diferenciaDe}.
   */
  conteo(item: InventarioProductoItem): string {
    const contado = item.cantidad;
    const sistema = this.cantidad(item.cantidadFisica);
    return contado == null
      ? `Sistema ${sistema} · sin contar`
      : `Sistema ${sistema} · contado ${this.cantidad(contado)}`;
  }

  /** `null` cuando no se contó: sin conteo no hay diferencia que mostrar. */
  diferencia(item: InventarioProductoItem): string | null {
    const valor = diferenciaDe(item);
    if (valor == null || valor === 0) {
      return null;
    }
    const texto = formatearCantidad(Math.abs(valor), Number.isInteger(valor) ? 0 : 2);
    return valor > 0 ? `+${texto}` : `−${texto}`;
  }

  cantidad(valor: number | undefined): string {
    return formatearCantidad(valor ?? 0, Number.isInteger(valor ?? 0) ? 0 : 2);
  }
}
