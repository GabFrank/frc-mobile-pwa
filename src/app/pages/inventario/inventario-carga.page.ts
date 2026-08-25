import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { of } from 'rxjs';

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
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { BuscadorProductoDialogComponent } from 'src/app/shared/producto/buscador-producto-dialog.component';
import type { OpcionesBuscador, SeleccionProducto } from 'src/app/shared/producto/buscador.types';
import { ProductoService } from 'src/app/pages/producto/producto.service';
import type { ProductoVencido } from 'src/app/domains/productos/producto-vencido.model';
import { nuevoItemInput, presentacionYaEnLaZona } from './inventario-alta';
import {
  textoDeSugerencia,
  vencimientoSugerido,
  type SugerenciaVencimiento,
} from './vencimiento-sugerido';
import { diferenciaDe } from './inventario-conteo';
import { marcasDeConteo } from './revision-item';
import { InventarioService } from './inventario.service';

/**
 * Cuántos vencimientos traer para una zona. Una presentación puede tener
 * varios lotes, así que no alcanza con uno por producto.
 */
const TAMANO_SUGERENCIAS = 300;

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
 * ⚠️ **Los campos están al revés de lo que sugieren sus nombres.** Lo que se
 * cuenta va en `cantidad`; el stock del sistema, en `cantidadFisica`. Lo fija
 * el central: `finalizarInventarioEnSucursal()` suma `cantidad` y le resta el
 * saldo de `movimiento_stock`. Esta pantalla escribe `cantidad` y devuelve
 * `cantidadFisica` tal como vino.
 *
 * Regresión: se escribía al revés, así que nada de lo contado desde el
 * teléfono llegaba al cálculo de finalización.
 *
 * **Agregar producto** suma a la zona una presentación que la toma no
 * incluía, con el buscador que ya existe: busca por descripción, por código,
 * escanea con la cámara y entiende los códigos de balanza.
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
          [detalle]="
            puedeAgregar()
              ? 'Esta zona todavía no tiene productos. Agregá el primero para empezar a contar.'
              : 'Esta zona no tiene presentaciones cargadas en esta toma.'
          "
          icono="inventario"
        />
      } @else {
        @if (sugerenciasFallaron()) {
          <!--
            «No hay vencimiento conocido» y «no pude preguntar» son
            respuestas distintas: un campo vacío afirmaría la primera.
          -->
          <p class="sin-sugerencias">
            No se pudieron traer los vencimientos conocidos. Los campos quedan
            vacíos; cargalos a mano si hace falta.
          </p>
        }
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
            @if (fila.sugerencia; as s) {
              <!--
                De dónde salió la fecha. Sin el origen, «sugerido» a secas no
                deja decidir si creerle.
              -->
              <p class="pista" [class.vencido]="s.vencido">{{ pista(s) }}</p>
            }

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
      @if (!cargando() && !error()) {
        <div acciones>
          @if (puedeAgregar()) {
            <button matButton [disabled]="agregando() || guardando()" (click)="agregarProducto()">
              {{ agregando() ? 'Agregando…' : 'Agregar producto' }}
            </button>
          }
          @if (items().length > 0) {
            <button matButton="filled" [disabled]="!hayCambios() || guardando()" (click)="guardar()">
              {{ guardando() ? 'Guardando…' : 'Guardar conteo (' + cambiados().length + ')' }}
            </button>
          }
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
    .pista { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .pista.vencido { color: var(--danger); }
    .sin-sugerencias { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
  `,
})
export class InventarioCargaPage {
  private readonly servicio = inject(InventarioService);
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly productos = inject(ProductoService);
  private readonly dialogo = inject(DialogoService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);

  readonly id = input<string>();
  readonly productoId = input<string>();

  readonly estados = ESTADOS;

  readonly inventario = signal<Inventario | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly agregando = signal(false);

  /**
   * Vencimientos conocidos de los productos de esta zona.
   *
   * Es una consulta **secundaria**: la pantalla cuenta igual sin ella. Por
   * eso `sugerenciasFallaron` existe aparte — «no hay vencimiento conocido»
   * y «no pude preguntar» no se pueden mostrar igual.
   */
  private readonly conocidos = signal<ProductoVencido[]>([]);
  readonly sugerenciasFallaron = signal(false);

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
      // Lo contado es `cantidad` y el stock del sistema `cantidadFisica`:
      // los nombres engañan, pero es el par que usa el central al finalizar.
      const contado = cambio?.contado !== undefined ? cambio.contado : item.cantidad ?? null;
      const sistema = item.cantidadFisica ?? 0;
      const sugerido = vencimientoSugerido(
        this.conocidos(),
        Number(item.presentacion?.id),
        new Date(),
      );
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
          cambio?.vencimiento ?? (item.vencimiento ? item.vencimiento.slice(0, 10) : sugerido?.fecha ?? ''),
        // ⚠️ Solo se rotula como sugerido lo que **no** tenía fecha propia:
        // un vencimiento ya cargado nunca se pisa ni se pone en duda.
        sugerencia: item.vencimiento || cambio?.vencimiento ? null : sugerido,
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
        this.cargarVencimientosConocidos();
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * Los vencimientos que el central conoce de los productos de esta zona.
   *
   * ⚠️ **Una sola consulta para toda la zona**, con todos los productos a la
   * vez: una por ítem serían treinta viajes para llenar treinta campos.
   *
   * El central ya unifica las tres fuentes —inventario, compra y
   * transferencia— y elige cuál manda. Acá solo se le pide sin filtro de
   * fechas y con `soloVencidos` en falso, que es lo que hace que devuelva
   * **todos** los vencimientos y no solo los caducos.
   */
  private cargarVencimientosConocidos(): void {
    const sucursalId = Number(this.inventario()?.sucursal?.id);
    const productoIds = [
      ...new Set(
        (this.producto()?.inventarioProductoItemList ?? [])
          .map((item) => Number(item.presentacion?.producto?.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];

    this.conocidos.set([]);
    this.sugerenciasFallaron.set(false);
    if (!Number.isFinite(sucursalId) || productoIds.length === 0) {
      return;
    }

    this.productos
      .vencidos(
        {
          sucursalIds: [sucursalId],
          productoIds,
          soloVencidos: false,
          size: TAMANO_SUGERENCIAS,
        },
        // Secundaria: la pantalla cuenta igual sin sugerencias, así que no
        // aporta a la barra de carga ni tira un toast si falla.
        { mostrarCarga: false, notificarError: false },
      )
      .subscribe({
        next: (pagina) => this.conocidos.set(pagina?.getContent ?? []),
        // Un campo vacío diría «no hay vencimiento conocido», que es una
        // afirmación que nadie hizo.
        error: () => this.sugerenciasFallaron.set(true),
      });
  }

  private editar(itemId: number, parche: Record<string, unknown>): void {
    this.edicion.update((mapa) => {
      const copia = new Map(mapa);
      copia.set(itemId, { ...(copia.get(itemId) ?? {}), ...parche });
      return copia;
    });
  }

  pista(sugerencia: SugerenciaVencimiento): string {
    return textoDeSugerencia(sugerencia);
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
  /**
   * Solo se agrega a una toma abierta.
   *
   * Cerrada o cancelada, el alcance del conteo ya es un hecho histórico:
   * sumarle un producto cambiaría qué se contó en una toma que ya ajustó el
   * stock.
   */
  readonly puedeAgregar = computed(
    () => String(this.inventario()?.estado ?? '').toUpperCase() === 'ABIERTO',
  );

  /**
   * Sumar a la zona una presentación que la toma no incluía.
   *
   * El ítem se **persiste al elegirlo**, con el stock del sistema y sin
   * conteo, y la lista se recarga: así hay una sola fuente de verdad —lo que
   * dice el central— y no un renglón a medio existir que se pierde si alguien
   * sale de la pantalla antes de guardar.
   */
  async agregarProducto(): Promise<void> {
    const inventarioProductoId = Number(this.producto()?.id);
    const sucursalId = Number(this.inventario()?.sucursal?.id);
    const usuarioId = this.auth.usuario()?.id;

    if (!Number.isFinite(inventarioProductoId) || usuarioId == null) {
      this.notificacion.warn('No se pudo identificar la zona o el usuario.');
      return;
    }

    const opciones: OpcionesBuscador = {
      devuelve: 'presentacion',
      // Con la sucursal, el buscador muestra el stock de cada producto: es lo
      // que deja ver contra qué se va a comparar antes de agregarlo.
      sucursalId: Number.isFinite(sucursalId) ? sucursalId : undefined,
      mostrarPrecio: false,
      etiquetaCampo: 'Código, descripción o escaneo',
    };

    const elegido = await this.dialogo.abrir<
      BuscadorProductoDialogComponent,
      { titulo: string; opciones: OpcionesBuscador },
      SeleccionProducto | undefined
    >(BuscadorProductoDialogComponent, { titulo: 'Agregar al conteo', opciones });

    const presentacionId = Number(elegido?.presentacion?.id);
    const productoId = Number(elegido?.producto?.id);
    if (!Number.isFinite(presentacionId) || presentacionId <= 0) {
      return;
    }

    if (presentacionYaEnLaZona(this.producto()?.inventarioProductoItemList, presentacionId)) {
      // Dos renglones de la misma presentación se suman los dos al finalizar.
      this.notificacion.warn('Esa presentación ya está en esta zona.');
      return;
    }

    this.agregando.set(true);
    this.stockDe(productoId, sucursalId).subscribe({
      next: (stock) => {
        this.servicio
          .guardarItem(
            nuevoItemInput({
              inventarioProductoId,
              presentacionId,
              stock,
              usuarioId,
              peso: elegido?.peso,
            }),
          )
          .subscribe({
            next: () => {
              this.agregando.set(false);
              this.cargar();
            },
            error: (err: Error) => {
              this.agregando.set(false);
              this.notificacion.danger(err.message);
            },
          });
      },
      error: (err: Error) => {
        this.agregando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * El stock del sistema para el ítem nuevo.
   *
   * Sin sucursal no se puede preguntar, y **cero no es la respuesta**: se
   * agrega con el sistema en cero y la diferencia sale de lo que se cuente.
   * Es explícito para que no parezca que el central dijo que no hay nada.
   */
  private stockDe(productoId: number, sucursalId: number) {
    if (!Number.isFinite(productoId) || !Number.isFinite(sucursalId)) {
      return of(0);
    }
    return this.busqueda.stock(productoId, sucursalId);
  }

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
          // Lo contado va en `cantidad`, que es el campo que el central
          // suma al finalizar. `cantidadFisica` —el stock del sistema—
          // viaja igual que vino: pisarla borra contra qué se comparó.
          cantidad: fila.contado ?? undefined,
          cantidadFisica: item.cantidadFisica,
          cantidadAnterior: item.cantidadAnterior,
          vencimiento: fila.vencimiento || undefined,
          estado: fila.estado as InventarioProductoEstado,
          ...marcasDeConteo(fila.contado ?? 0, item.cantidadFisica),
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
