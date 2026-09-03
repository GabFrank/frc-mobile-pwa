import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Subscription } from 'rxjs';

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_PRODUCTO } from 'src/app/core/dispositivo/escaner.types';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  ProductoBusquedaService,
  ResultadoPesable,
} from 'src/app/domains/productos/producto-busqueda.service';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoErrorComponent } from '../estados-ui/estado-error.component';
import { EstadoVacioComponent } from '../estados-ui/estado-vacio.component';
import { SkeletonComponent } from '../estados-ui/skeleton.component';
import { IconoComponent } from '../icono/icono.component';
import { ImporteComponent } from '../importe/importe.component';
import { SeccionComponent } from '../layout/seccion.component';
import { ACCION_FICHA, ACCION_STOCK, OpcionesBuscador, SeleccionProducto } from './buscador.types';
import { precioDe } from './presentacion.util';
import { AccionProducto, ProductoCardComponent } from './producto-card.component';
import {
  StockSucursalesData,
  StockSucursalesDialogComponent,
} from './stock-sucursales-dialog.component';

/**
 * Tamaño de tanda.
 *
 * ⚠️ **No lo elige el cliente: el central tiene `limit 10` escrito a mano**
 * en la consulta nativa de `productoSearch` (`ProductoRepository.java:53`).
 * Este valor existe solo para detectar «hay más» comparando lo recibido.
 */
const LOTE = 10;

/**
 * Buscador de productos reutilizable.
 *
 * Es la pieza que en `frc-mobile` no era reutilizable y por eso se copió:
 * `TransaferenciaListProductosComponent` reimplementó la pantalla entera
 * —campo, escaneo, acordeón, «Cargar más», servicio— para agregar una
 * segunda columna de stock. Acá lo que varía entra por `opciones`.
 *
 * Ver el relevamiento completo de usos en
 * `docs/analisis/buscador-producto-inventario.md`.
 */
@Component({
  selector: 'frc-buscador-producto',
  standalone: true,
  imports: [
    ProductoCardComponent,
    SeccionComponent,
    ImporteComponent,
    IconoComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="barra">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
        <mat-label>{{ opciones().etiquetaCampo ?? 'Código o descripción' }}</mat-label>
        <input
          matInput
          [value]="texto()"
          (input)="alEscribir($event)"
          (keydown.enter)="buscar()"
          [attr.cdkFocusInitial]="autoFoco() ? '' : null"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          enterkeyhint="search"
        />
      </mat-form-field>

      <button type="button" class="escanear" (click)="escanear()" aria-label="Escanear código">
        <frc-icono nombre="escanear" [tamano]="24" />
      </button>
    </div>

    @if (pesable(); as p) {
      <frc-seccion titulo="Producto pesado" [panel]="true">
        <div class="pesable">
          <div class="nombre">{{ p.producto.descripcion }}</div>
          <div class="linea">
            <span>{{ pesoLegible() }} kg</span>
            @if (precioPorKilo(); as precio) {
              <span class="por">
                × <frc-importe [valor]="precio" moneda="Guaraní" simbolo="₲" /> por kg
              </span>
            }
          </div>
          @if (totalPesable(); as total) {
            <div class="total">
              <span>Total</span>
              <frc-importe [valor]="total" moneda="Guaraní" simbolo="₲" />
            </div>
          }
        </div>
      </frc-seccion>
    }

    @if (cargando()) {
      <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
    } @else if (error()) {
      <frc-estado-error [detalle]="error()!" (reintentar)="buscar()" />
    } @else if (!buscado()) {
      <frc-estado-vacio
        titulo="Buscá un producto"
        detalle="Escribí el código o parte de la descripción, o tocá el ícono para escanear."
        icono="buscar"
      />
    } @else if (resultados().length === 0) {
      <frc-estado-vacio
        titulo="Sin resultados"
        [detalle]="'No se encontró nada para «' + ultimaBusqueda() + '».'"
        icono="buscar"
      />
    } @else {
      @for (producto of resultados(); track producto.id) {
        <frc-producto-card
          [producto]="producto"
          [acciones]="accionesDe()"
          [mostrarPrecio]="opciones().mostrarPrecio ?? false"
          [stock]="stockDe(producto)"
          [stockDestino]="stockDestinoDe(producto)"
          [etiquetaStock]="opciones().etiquetaStock ?? 'Stock'"
          [etiquetaStockDestino]="opciones().etiquetaStockDestino ?? 'Destino'"
          [cargando]="cargandoDetalle() === producto.id"
          [expandible]="opciones().devuelve !== 'producto'"
          (expandir)="alExpandir($event)"
          (seleccionar)="seleccion.emit({ producto: $event })"
          (elegir)="elegirPresentacion(producto, $event)"
          (accion)="ejecutarAccion($event, producto)"
        />
      }

      @if (hayMas()) {
        <button matButton class="mas" [disabled]="cargandoMas()" (click)="cargarMas()">
          {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
        </button>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    .barra {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }
    .campo { flex: 1; min-width: 0; }
    /*
      Mayúsculas, como en frc-mobile: los códigos de barra y las descripciones
      del catálogo están cargados en mayúsculas, y el central compara con
      UPPER() de los dos lados. Es solo presentación — el valor que viaja
      conserva lo que se tipeó, y la búsqueda no distingue mayúsculas.
    */
    .campo input { text-transform: uppercase; }
    .escanear {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--brand-text);
      cursor: pointer;
    }
    .escanear:hover { background: var(--surface-sunken); }
    .pesable { display: flex; flex-direction: column; gap: var(--sp-1); }
    .nombre { font-weight: var(--fw-medium); }
    .linea {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: var(--sp-2);
      color: var(--text-soft);
      font-size: var(--fs-label);
    }
    .por { display: inline-flex; align-items: baseline; gap: var(--sp-1); }
    .total {
      display: flex;
      justify-content: space-between;
      margin-top: var(--sp-2);
      padding-top: var(--sp-2);
      border-top: 1px solid var(--border-light);
      font-weight: var(--fw-medium);
    }
    .mas { align-self: center; }
  `,
})
export class BuscadorProductoComponent {
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly escaner = inject(EscanerService);
  private readonly notificacion = inject(NotificacionService);
  private readonly dialogo = inject(DialogoService);
  private readonly router = inject(Router);

  readonly opciones = input<OpcionesBuscador>({});
  /**
   * Arranca con el foco en el campo.
   *
   * Solo tiene sentido cuando el buscador se abrió **para elegir algo** —un
   * diálogo selector, el modo kiosco—. En una pestaña que se abre navegando,
   * robar el foco levanta el teclado sin que nadie lo haya pedido y tapa
   * media pantalla.
   */
  readonly autoFoco = input(false);
  /**
   * Código con el que arrancar, ya leído por otro.
   *
   * Es lo que permite que el escáner universal del FAB lea un producto desde
   * cualquier pantalla y termine acá con el resultado ya resuelto, sin
   * pedirle al usuario que vuelva a apuntar la cámara.
   */
  readonly codigoInicial = input<string>();

  readonly seleccion = output<SeleccionProducto>();

  readonly texto = signal('');
  readonly ultimaBusqueda = signal('');
  readonly resultados = signal<Producto[]>([]);
  readonly pesable = signal<ResultadoPesable | null>(null);
  readonly cargando = signal(false);
  readonly cargandoMas = signal(false);
  readonly cargandoDetalle = signal<number | null>(null);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);
  /** Distingue «todavía no buscaste» de «buscaste y no hay nada». */
  readonly buscado = signal(false);

  private offset = 0;
  /** Existencia por producto, cargada al expandir. */
  private readonly stocks = signal<Record<number, number>>({});
  /** Ídem en la sucursal de destino, cuando hay dos. */
  private readonly stocksDestino = signal<Record<number, number>>({});

  /**
   * Búsqueda en vuelo.
   *
   * ⚠️ **Se cancela la anterior antes de lanzar otra.** El repo anterior solo
   * limpiaba el `setTimeout` del debounce: si dos búsquedas alcanzaban a
   * salir, ganaba la que contestara última, que no es necesariamente la que
   * el usuario pidió último. Con listas de red lentas eso se ve.
   */
  private enVuelo: Subscription | null = null;
  /** Último `codigoInicial` resuelto, para no relanzar la misma búsqueda. */
  private ultimoCodigoInicial: string | undefined;

  constructor() {
    // El router asigna los inputs después de construir el componente
    // (NG0950), así que esto no puede ir en el cuerpo del constructor. Y se
    // guarda el último valor porque el efecto también corre cuando cambian
    // otras señales que se leen adentro.
    effect(() => {
      const codigo = this.codigoInicial()?.trim();
      if (codigo && codigo !== this.ultimoCodigoInicial) {
        this.ultimoCodigoInicial = codigo;
        this.resolverCodigo(codigo);
      }
    });
  }

  readonly accionesDe = computed<AccionProducto[]>(() => [
    { id: ACCION_FICHA, etiqueta: 'Ver ficha del producto', icono: 'documento' },
    { id: ACCION_STOCK, etiqueta: 'Ver stock por sucursal', icono: 'inventario' },
    ...(this.opciones().acciones ?? []),
  ]);

  readonly precioPorKilo = computed(() => precioDe(this.pesable()?.presentacion));
  readonly pesoLegible = computed(() => formatearCantidad(this.pesable()?.peso, 3));

  /**
   * Peso × precio por kilo.
   *
   * No contradice la regla 6 —el dinero lo calcula el backend—: el precio de
   * un pesable **es** por kilo y la cantidad viene en el código. Es aplicar la
   * unidad del precio que el backend ya mandó.
   */
  readonly totalPesable = computed(() => {
    const precio = this.precioPorKilo();
    const peso = this.pesable()?.peso;
    if (precio == null || peso == null) {
      return null;
    }
    return Math.round(precio * peso);
  });

  /**
   * Existencia del producto, o `null` si no corresponde mostrarla.
   *
   * Sin sucursal no hay stock: la existencia es siempre de un depósito.
   *
   * ⚠️ **Quién decide si la sucursal sirve es el llamador**, no esta
   * pantalla. Una sucursal sin depósito es virtual y no mueve stock, pero
   * eso se sabe mirando el objeto `Sucursal` —`deposito`—, no el id, y el
   * buscador solo recibe un id. Ver `sucursal.util.ts`.
   */
  stockDe(producto: Producto): number | null {
    if (this.opciones().sucursalId == null || producto.id == null) {
      return null;
    }
    return this.stocks()[producto.id] ?? null;
  }

  stockDestinoDe(producto: Producto): number | null {
    if (this.opciones().sucursalDestinoId == null || producto.id == null) {
      return null;
    }
    return this.stocksDestino()[producto.id] ?? null;
  }

  alEscribir(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }

  buscar(): void {
    const consulta = this.texto().trim();
    if (!consulta) {
      return;
    }
    this.offset = 0;
    this.pesable.set(null);
    this.lanzarBusqueda(consulta, false);
  }

  cargarMas(): void {
    this.offset += LOTE;
    this.cargandoMas.set(true);
    this.lanzarBusqueda(this.ultimaBusqueda(), true);
  }

  private lanzarBusqueda(consulta: string, agregando: boolean): void {
    this.enVuelo?.unsubscribe();

    if (!agregando) {
      this.cargando.set(true);
      this.resultados.set([]);
      this.stocks.set({});
      this.stocksDestino.set({});
    }
    this.error.set(null);
    this.ultimaBusqueda.set(consulta);

    this.enVuelo = this.busqueda.buscarPorCodigoOTexto(consulta, this.offset).subscribe({
      next: (lista) => {
        const filas = lista ?? [];
        this.resultados.update((previas) => (agregando ? [...previas, ...filas] : filas));
        this.hayMas.set(filas.length === LOTE);
        this.buscado.set(true);
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

  /**
   * Al expandir se cargan presentaciones y stock, no antes.
   *
   * La búsqueda por texto trae productos sin presentaciones a propósito: la
   * query es liviana porque la lista puede ser larga y casi ninguna fila se
   * abre.
   */
  alExpandir(producto: Producto): void {
    const id = producto.id;
    if (id == null) {
      return;
    }

    if ((producto.presentaciones?.length ?? 0) === 0) {
      this.cargandoDetalle.set(id);
      this.busqueda.detalle(id).subscribe({
        next: (completo) => {
          this.cargandoDetalle.set(null);
          if (completo?.presentaciones) {
            this.resultados.update((filas) =>
              filas.map((p) =>
                p.id === id ? { ...p, presentaciones: completo.presentaciones } : p,
              ),
            );
          }
        },
        error: () => this.cargandoDetalle.set(null),
      });
    }

    const sucursalId = this.opciones().sucursalId;
    if (sucursalId != null && this.stocks()[id] == null) {
      this.busqueda.stock(id, sucursalId).subscribe({
        next: (cantidad) => this.stocks.update((previo) => ({ ...previo, [id]: cantidad })),
        // El stock es información de apoyo: si falla, la card sigue sirviendo
        // para elegir.
        error: () => undefined,
      });
    }

    const destinoId = this.opciones().sucursalDestinoId;
    if (destinoId != null && this.stocksDestino()[id] == null) {
      this.busqueda.stock(id, destinoId).subscribe({
        next: (cantidad) => this.stocksDestino.update((previo) => ({ ...previo, [id]: cantidad })),
        error: () => undefined,
      });
    }
  }

  elegirPresentacion(producto: Producto, presentacion: Presentacion): void {
    this.seleccion.emit({ producto, presentacion });
  }

  async ejecutarAccion(accionId: string, producto: Producto): Promise<void> {
    if (accionId === ACCION_FICHA) {
      await this.router.navigate(['/producto', producto.id]);
      return;
    }
    if (accionId === ACCION_STOCK) {
      await this.dialogo.abrir<StockSucursalesDialogComponent, StockSucursalesData>(
        StockSucursalesDialogComponent,
        { producto, sucursalId: this.opciones().sucursalId },
      );
      return;
    }
    // Las acciones que declaró el llamador las resuelve el llamador.
    this.seleccion.emit({ producto });
  }

  /**
   * Escanea y resuelve.
   *
   * ⚠️ Un código de balanza **no** entra por la búsqueda común: devuelve
   * producto y peso, y el peso se pierde si se lo trata como un código más.
   */
  async escanear(): Promise<void> {
    const codigo = await this.escaner.escanear({
      titulo: 'Escanear producto',
      ayuda: 'Apuntá al código de barras',
      formatos: FORMATOS_PRODUCTO,
      etiquetaManual: 'Código del producto',
    });
    if (!codigo) {
      return;
    }
    this.resolverCodigo(codigo);
  }

  /**
   * Resuelve un código ya leído, venga de donde venga.
   *
   * Lo llaman dos caminos: el botón de escanear de este mismo buscador y el
   * escáner universal del FAB, que lee desde cualquier pantalla y aterriza
   * acá con el código en la URL. La bifurcación por pesable tiene que ser la
   * misma en los dos: es la que evita que un código de balanza pierda el peso
   * al tratarse como un código común.
   */
  resolverCodigo(codigo: string): void {
    this.texto.set(codigo);

    if (this.busqueda.esPesable(codigo)) {
      this.buscarPesable(codigo);
      return;
    }
    this.buscar();
  }

  private buscarPesable(codigo: string): void {
    this.enVuelo?.unsubscribe();
    this.cargando.set(true);
    this.error.set(null);
    this.resultados.set([]);
    this.pesable.set(null);

    this.enVuelo = this.busqueda.pesable(codigo).subscribe({
      next: (resultado) => {
        this.cargando.set(false);
        this.buscado.set(true);
        this.ultimaBusqueda.set(codigo);
        this.hayMas.set(false);
        if (!resultado) {
          this.notificacion.warn('No se encontró el producto de ese código de balanza.');
          return;
        }
        this.pesable.set(resultado);
        this.resultados.set([resultado.producto]);
        // Un pesable ya resolvió presentación y peso: no hay nada que elegir.
        this.seleccion.emit(resultado);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }
}
