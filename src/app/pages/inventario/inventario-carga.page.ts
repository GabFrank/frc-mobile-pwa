import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from 'src/app/core/auth/auth.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  Inventario,
  InventarioProducto,
  InventarioProductoEstado,
  InventarioProductoItem,
} from 'src/app/domains/inventario/inventario.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import { diferenciaDe } from './inventario-conteo';
import { InventarioService } from './inventario.service';

const ESTADOS: OpcionSeleccion[] = [
  { valor: InventarioProductoEstado.BUENO, texto: 'Bueno' },
  { valor: InventarioProductoEstado.AVERIADO, texto: 'Averiado' },
  { valor: InventarioProductoEstado.VENCIDO, texto: 'Vencido' },
];

/**
 * Cargar el conteo de una zona.
 *
 * Es la pantalla que faltaba para que el inventario se pudiera **hacer**
 * desde el teléfono y no solo consultar: se para frente a la góndola, cuenta
 * y escribe.
 *
 * ⚠️ **Un `InventarioProducto` es una zona, no un producto.** El central le
 * sacó `producto_id` a esa tabla; acá se listan todos los ítems de la zona y
 * cada uno dice de qué producto es, leyéndolo de `presentacion.producto`.
 *
 * ⚠️ **El conteo es por presentación, no por producto.** Un producto con
 * «unidad» y «caja x12» tiene un ítem por cada una: sumarlos sin convertir
 * da un número sin sentido.
 *
 * ⚠️ **`cantidad` no se toca.** Es lo que dice el sistema, y la diferencia
 * contra `cantidadFisica` **es** el resultado del inventario. Pisar una con
 * la otra borra justamente el resultado; por eso acá solo se escribe
 * `cantidadFisica`.
 *
 * ⚠️ **Solo se cuentan presentaciones que ya están en el inventario.** El
 * central resuelve `inventarioProductoId` pero no lo crea: agregar un
 * producto que la toma no incluye necesita `saveInventarioProducto`, que no
 * está portado. Abrir el inventario —donde se define el alcance— sigue
 * siendo del escritorio.
 */
@Component({
  selector: 'frc-inventario-carga',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SelectorComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true" [conEscaner]="false">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (items().length === 0) {
        <frc-estado-vacio
          titulo="Sin ítems que contar"
          detalle="Esta zona no tiene presentaciones cargadas en esta toma."
          icono="inventario"
        />
      } @else {
        @for (fila of items(); track fila.itemId) {
          <frc-seccion [titulo]="fila.etiqueta" [panel]="true">
            <div class="linea">
              <span class="sistema">{{ fila.presentacion }} · Sistema: {{ fila.sistema }}</span>
              @if (fila.diferencia !== null) {
                <span class="dif" [class.falta]="fila.diferencia < 0" [class.sobra]="fila.diferencia > 0">
                  {{ fila.diferencia > 0 ? '+' : '' }}{{ fila.diferencia }}
                </span>
              }
            </div>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Contado</mat-label>
              <input
                matInput
                type="number"
                inputmode="decimal"
                [value]="fila.contado ?? ''"
                (input)="cambiarContado(fila.itemId, $event)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Vencimiento</mat-label>
              <input
                matInput
                type="date"
                [value]="fila.vencimiento"
                (input)="cambiarVencimiento(fila.itemId, $event)"
              />
            </mat-form-field>

            <frc-selector
              etiqueta="Estado"
              [opciones]="estados"
              [valor]="fila.estado"
              (valorChange)="cambiarEstado(fila.itemId, $event)"
            />
          </frc-seccion>
        }

      }

      <!--
        ⚠️ Fuera del @else y con su propio @if: un bloque de control de flujo
        con más de un nodo raíz no proyecta al slot (NG8011), y el botón de
        guardar caía en el cuerpo en vez de la barra fija.
      -->
      @if (items().length > 0 && !cargando() && !error()) {
        <div acciones>
          <button matButton="filled" [disabled]="!hayCambios() || guardando()" (click)="guardar()">
            {{ guardando() ? 'Guardando…' : 'Guardar conteo (' + cambiados().length + ')' }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .linea { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); }
    .sistema { font-size: var(--fs-label); color: var(--text-soft); }
    .dif {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-bold);
    }
    .dif.falta { color: var(--danger); }
    .dif.sobra { color: var(--warn); }
  `,
})
export class InventarioCargaPage {
  private readonly servicio = inject(InventarioService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);

  readonly id = input<string>();
  readonly productoId = input<string>();

  readonly estados = ESTADOS;

  readonly inventario = signal<Inventario | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  /** Lo editado, por id de ítem. Vacío hasta que alguien escribe. */
  private readonly edicion = signal<
    Map<number, { contado?: number | null; vencimiento?: string; estado?: unknown }>
  >(new Map());

  readonly producto = computed<InventarioProducto | null>(() => {
    const buscado = Number(this.productoId());
    return (
      (this.inventario()?.inventarioProductoList ?? []).find((p) => Number(p.id) === buscado) ??
      null
    );
  });

  readonly titulo = computed(() => this.producto()?.zona?.descripcion || 'Conteo');

  readonly items = computed(() => {
    const cambios = this.edicion();
    return (this.producto()?.inventarioProductoItemList ?? []).map((item) => {
      const itemId = Number(item.id);
      const cambio = cambios.get(itemId);
      const contado = cambio?.contado !== undefined ? cambio.contado : item.cantidadFisica ?? null;
      const sistema = item.cantidad ?? 0;
      return {
        itemId,
        // El producto cuelga de la presentación: `InventarioProducto` es la
        // zona, y en una zona hay más de un producto.
        etiqueta: String(item.presentacion?.producto?.descripcion ?? 'Producto'),
        presentacion: item.presentacion ? etiquetaPresentacion(item.presentacion) : 'Presentación',
        sistema: formatearCantidad(sistema, 2),
        contado,
        // La diferencia se recalcula en vivo con lo que se está escribiendo,
        // que es lo que el operador necesita para decidir si recuenta.
        diferencia: contado == null ? null : contado - sistema,
        vencimiento:
          cambio?.vencimiento ?? (item.vencimiento ? item.vencimiento.slice(0, 10) : ''),
        estado: cambio?.estado ?? item.estado ?? InventarioProductoEstado.BUENO,
        original: item,
      };
    });
  });

  readonly cambiados = computed(() => this.items().filter((f) => this.edicion().has(f.itemId)));
  readonly hayCambios = computed(() => this.cambiados().length > 0);

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('No se entiende qué inventario abrir.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (inv) => {
        this.inventario.set(inv ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  private editar(itemId: number, parche: Record<string, unknown>): void {
    this.edicion.update((mapa) => {
      const copia = new Map(mapa);
      copia.set(itemId, { ...(copia.get(itemId) ?? {}), ...parche });
      return copia;
    });
  }

  cambiarContado(itemId: number, evento: Event): void {
    const crudo = (evento.target as HTMLInputElement).value;
    const n = Number(crudo);
    this.editar(itemId, {
      contado: crudo.trim() !== '' && Number.isFinite(n) ? n : null,
    });
  }

  cambiarVencimiento(itemId: number, evento: Event): void {
    this.editar(itemId, { vencimiento: (evento.target as HTMLInputElement).value });
  }

  cambiarEstado(itemId: number, valor: unknown): void {
    this.editar(itemId, { estado: valor });
  }

  /**
   * Guarda solo lo que se tocó, un ítem por vez.
   *
   * No hay mutation de lote: `saveInventarioProductoItem` guarda de a uno.
   * Se espera a que terminen todas antes de recargar, porque recargar en el
   * medio traería la lista a mitad de camino.
   */
  guardar(): void {
    const filas = this.cambiados().filter((f) => f.contado != null);
    if (filas.length === 0) {
      this.notificacion.warn('Escribí al menos una cantidad contada.');
      return;
    }

    const usuarioId = this.auth.usuario()?.id;
    const inventarioProductoId = Number(this.producto()?.id);
    this.guardando.set(true);

    let pendientes = filas.length;
    let fallaron = 0;

    for (const fila of filas) {
      const item: InventarioProductoItem = fila.original;
      this.servicio
        .guardarItem({
          id: item.id,
          inventarioProductoId,
          presentacionId: item.presentacion?.id,
          // `cantidad` viaja igual que vino: es lo que dice el sistema y
          // pisarla con lo contado borra el resultado del inventario.
          cantidad: item.cantidad,
          cantidadFisica: fila.contado ?? undefined,
          cantidadAnterior: item.cantidadAnterior,
          vencimiento: fila.vencimiento || undefined,
          estado: fila.estado as InventarioProductoEstado,
          verificado: true,
          usuarioId,
        })
        .subscribe({
          next: () => this.terminar(--pendientes, fallaron),
          error: () => {
            fallaron++;
            this.terminar(--pendientes, fallaron);
          },
        });
    }
  }

  private terminar(pendientes: number, fallaron: number): void {
    if (pendientes > 0) {
      return;
    }
    this.guardando.set(false);
    this.edicion.set(new Map());
    if (fallaron > 0) {
      this.notificacion.warn(
        `Se guardaron algunos ítems, ${fallaron} no. Revisá y volvé a intentar.`,
      );
    } else {
      this.notificacion.ok('Conteo guardado.');
    }
    // Se recarga siempre: aunque algo falle, lo que sí entró tiene que verse.
    this.cargar();
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor, { conHora: false }) ?? '—';
  }

  diferencia(item: InventarioProductoItem): number | null {
    return diferenciaDe(item);
  }
}
