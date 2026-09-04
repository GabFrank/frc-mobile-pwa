import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';

import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { IconoComponent } from '../icono/icono.component';
import { ImporteComponent } from '../importe/importe.component';
import { etiquetaPresentacion, precioDe } from './presentacion.util';

/** Una entrada del menú `⋮`. El id lo interpreta la pantalla que la declaró. */
export interface AccionProducto {
  id: string;
  etiqueta: string;
  icono?: string;
}

/**
 * Producto en una lista, expandible a sus presentaciones.
 *
 * Reemplaza al `ion-accordion` de `frc-mobile`, y es **genérica por la regla
 * de tres**: la misma card aparece en buscar, devolución, inventario,
 * transferencias y productos vencidos.
 *
 * ⚠️ **En el repo anterior no era genérica y se pagó.**
 * `TransaferenciaListProductosComponent` copió la pantalla entera del
 * buscador —búsqueda, acordeón, «Cargar más», servicio— solo para agregar
 * una segunda columna de stock. Por eso acá lo variable son datos de
 * entrada: qué acciones tiene el menú, qué se muestra al costado de cada
 * presentación, si hay precio.
 *
 * No carga nada por su cuenta: avisa con `(expandir)` y la pantalla decide
 * qué pedir. Así la carga perezosa de presentaciones y stock queda en un
 * solo lugar y la card sirve igual con datos ya cargados.
 */
@Component({
  selector: 'frc-producto-card',
  standalone: true,
  imports: [MatMenuModule, IconoComponent, ImporteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.abierta]="abierta()">
      <div class="cabecera">
        <button
          type="button"
          class="principal"
          [attr.aria-expanded]="abierta()"
          (click)="alternar()"
        >
          <!--
            La foto, como en frc-mobile: imagenPrincipal no es una URL sino un
            data:image/jpg;base64,… que arma el central
            (ImageService.fileToBase64). Va derecho al src —no hay pedido de
            red que hacer— y por eso tampoco sirve loading="lazy": los bytes
            ya llegaron con la consulta.

            El ícono no es un placeholder mientras carga: es el estado real de
            un producto sin foto cargada, que son la mayoría. El central
            devuelve null en ese caso, no una imagen gris.
          -->
          <span class="thumb">
            @if (imagen(); as foto) {
              <img [src]="foto" alt="" decoding="async" (error)="fotoFallo.set(true)" />
            } @else {
              <frc-icono nombre="producto" [tamano]="22" />
            }
          </span>

          <span class="datos">
            <span class="titulo">{{ producto().descripcion ?? 'Producto' }}</span>
            <span class="sub">
              {{ producto().codigoPrincipal ?? '—' }}
              @if (producto().balanza) {
                <span class="marca">· Balanza</span>
              }
              @if (producto().isEnvase) {
                <span class="marca">· Envase</span>
              }
            </span>
            @if (stock() != null) {
              <span class="stock">
                {{ etiquetaStock() }} {{ stockLegible() }}
                @if (stockDestino() != null) {
                  · {{ etiquetaStockDestino() }} {{ stockDestinoLegible() }}
                }
              </span>
            }
          </span>

          @if (expandible()) {
            <span class="chevron" [class.girado]="abierta()">
              <frc-icono nombre="chevronAbajo" [tamano]="20" />
            </span>
          }
        </button>

        @if (acciones().length > 0) {
          <button
            type="button"
            class="menu-btn"
            [matMenuTriggerFor]="menu"
            aria-label="Más opciones"
          >
            <frc-icono nombre="masOpciones" [tamano]="20" />
          </button>

          <mat-menu #menu="matMenu">
            @for (a of acciones(); track a.id) {
              <button mat-menu-item (click)="accion.emit(a.id)">
                @if (a.icono) {
                  <frc-icono [nombre]="a.icono" [tamano]="18" />
                }
                <span class="etiqueta-menu">{{ a.etiqueta }}</span>
              </button>
            }
          </mat-menu>
        }
      </div>

      @if (abierta() && expandible()) {
        <div class="presentaciones">
          @if (cargando()) {
            <p class="aviso">Cargando presentaciones…</p>
          } @else if (presentaciones().length === 0) {
            <p class="aviso">Este producto no tiene presentaciones cargadas.</p>
          } @else {
            @for (p of presentaciones(); track p.id) {
              <button type="button" class="presentacion" (click)="elegir.emit(p)">
                <span class="p-datos">
                  <span class="p-titulo">{{ etiqueta(p) }}</span>
                  <span class="p-codigo">{{ codigoDe(p) }}</span>
                </span>
                <span class="p-cifras">
                  @if (mostrarPrecio() && precio(p) != null) {
                    <frc-importe [valor]="precio(p)" moneda="Guaraní" simbolo="₲" />
                  }
                  @if (stock() != null) {
                    <span class="p-stock">
                      {{ etiquetaStock() }} {{ stockDe(p) }}
                      @if (stockDestino() != null) {
                        · {{ etiquetaStockDestino() }} {{ stockDestinoDe(p) }}
                      }
                    </span>
                  }
                </span>
              </button>
            }
          }
        </div>
      }
    </article>
  `,
  styles: `
    .card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      box-shadow: var(--elev-1);
      overflow: hidden;
    }
    .cabecera {
      display: flex;
      align-items: stretch;
    }
    /*
      El cuerpo es un botón y el menú es otro, hermanos: anidar un botón
      dentro de otro es HTML inválido y el clic del menú burbujearía al
      cuerpo, expandiendo la card cada vez que se abre el menú.
    */
    .principal {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3);
      background: none;
      border: none;
      font: inherit;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .principal:hover { background: var(--surface-sunken); }
    .thumb {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-sm);
      background: var(--surface-sunken);
      display: grid;
      place-items: center;
      color: var(--text-mute);
      flex-shrink: 0;
      overflow: hidden;
    }
    /*
      cover y no contain: las fotos vienen del celular, en cualquier relación
      de aspecto, y contain deja franjas del fondo hundido que hacen ver la
      fila desalineada. Recortar centrado es lo que hacía el ion-avatar del
      repo anterior.
    */
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .datos {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .titulo {
      font-weight: var(--fw-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub, .stock {
      font-size: var(--fs-label);
      color: var(--text-soft);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .marca { color: var(--text-mute); }
    .stock { font-variant-numeric: tabular-nums; }
    .chevron {
      flex-shrink: 0;
      color: var(--text-mute);
      line-height: 0;
      transition: transform 120ms ease;
    }
    .chevron.girado { transform: rotate(180deg); }
    .menu-btn {
      flex-shrink: 0;
      padding: 0 var(--sp-3);
      background: none;
      border: none;
      border-left: 1px solid var(--border-light);
      color: var(--text-mute);
      cursor: pointer;
      line-height: 0;
    }
    .menu-btn:hover { background: var(--surface-sunken); color: var(--brand-text); }

    .presentaciones {
      border-top: 1px solid var(--border-light);
      background: var(--surface-sunken);
      display: flex;
      flex-direction: column;
    }
    .presentacion {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-3);
      padding: var(--sp-3);
      background: none;
      border: none;
      border-bottom: 1px solid var(--border-light);
      font: inherit;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .presentacion:last-child { border-bottom: none; }
    .presentacion:hover { background: var(--surface); }
    .p-datos {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .p-titulo { font-size: var(--fs-label); }
    .p-codigo {
      font-size: var(--fs-caption);
      color: var(--text-mute);
      font-variant-numeric: tabular-nums;
    }
    .p-cifras {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
    }
    .p-stock {
      font-size: var(--fs-caption);
      color: var(--text-soft);
      font-variant-numeric: tabular-nums;
    }
    .aviso {
      margin: 0;
      padding: var(--sp-3);
      font-size: var(--fs-label);
      color: var(--text-mute);
    }
    .etiqueta-menu { margin-left: var(--sp-2); }
  `,
})
export class ProductoCardComponent {
  readonly producto = input.required<Producto>();
  readonly acciones = input<AccionProducto[]>([]);
  readonly mostrarPrecio = input(false);
  /**
   * Existencia del **producto**, no de la presentación.
   *
   * `null` significa «no se consultó» y esconde toda mención al stock. Cero
   * es un dato: hay que poder distinguirlos.
   */
  readonly stock = input<number | null>(null);
  /**
   * Segunda existencia, para cuando el producto se mira **entre dos
   * sucursales** — una transferencia mira origen y destino a la vez.
   *
   * Es el motivo por el que `TransaferenciaListProductosComponent` copió la
   * pantalla entera del buscador en `frc-mobile`: hacía falta una columna
   * más y el componente no la aceptaba.
   */
  readonly stockDestino = input<number | null>(null);
  /** Cómo se llama cada existencia cuando hay dos. */
  readonly etiquetaStock = input('Stock');
  readonly etiquetaStockDestino = input('Destino');
  readonly cargando = input(false);
  /**
   * `false` convierte la card en un botón: tocarla elige el producto en vez
   * de abrirla.
   *
   * Es el modo que en `frc-mobile` no existía. El filtro de control de
   * inventario y el de productos vencidos solo querían el producto, pero
   * igual obligaban a expandir y tocar una presentación, que después
   * descartaban.
   */
  readonly expandible = input(true);

  /** Se emite al abrir, para que la pantalla cargue presentaciones y stock. */
  readonly expandir = output<Producto>();
  /** Solo cuando `expandible` es `false`. */
  readonly seleccionar = output<Producto>();
  readonly elegir = output<Presentacion>();
  readonly accion = output<string>();

  readonly abierta = signal(false);

  /**
   * Una foto que el navegador no pudo decodificar deja de intentarse.
   *
   * Es `linkedSignal` y no `signal` porque `@for` reusa la instancia de la
   * card cuando cambia la lista: sin reponer el valor al cambiar de producto,
   * el primero con la foto rota apagaba la foto de todos los que ocuparan esa
   * fila después.
   */
  readonly fotoFallo = linkedSignal<number | undefined, boolean>({
    source: () => this.producto().id,
    computation: () => false,
  });

  /**
   * La foto del producto, o `null` para que se muestre el ícono.
   *
   * El central manda `null` cuando no hay archivo, pero se descarta también
   * la cadena vacía: un `src=""` hace que el navegador vuelva a pedir la
   * página actual como si fuera una imagen.
   */
  readonly imagen = computed(() => {
    if (this.fotoFallo()) {
      return null;
    }
    const foto = this.producto().imagenPrincipal?.trim();
    return foto ? foto : null;
  });

  readonly presentaciones = computed(() => this.producto().presentaciones ?? []);
  readonly stockLegible = computed(() => formatearCantidad(this.stock(), 0));
  readonly stockDestinoLegible = computed(() => formatearCantidad(this.stockDestino(), 0));

  alternar(): void {
    if (!this.expandible()) {
      this.seleccionar.emit(this.producto());
      return;
    }
    const proxima = !this.abierta();
    this.abierta.set(proxima);
    if (proxima) {
      this.expandir.emit(this.producto());
    }
  }

  etiqueta(p: Presentacion): string {
    return etiquetaPresentacion(p);
  }

  precio(p: Presentacion): number | null {
    return precioDe(p);
  }

  codigoDe(p: Presentacion): string {
    const principal = p.codigoPrincipal?.codigo;
    if (principal) {
      return String(principal);
    }
    const primero = p.codigos?.find((c) => c.principal) ?? p.codigos?.[0];
    return String(primero?.codigo ?? '—');
  }

  /**
   * Stock de la presentación.
   *
   * El backend manda la existencia en unidades del producto; una caja de 12
   * son 12 unidades. Dividir es la conversión de unidad que el repo anterior
   * ya hacía (`stockPorProducto / presentacion.cantidad`), no un cálculo
   * nuevo. Se muestra con decimales porque una caja incompleta es normal.
   */
  stockDe(p: Presentacion): string {
    return this.convertir(this.stock(), p);
  }

  stockDestinoDe(p: Presentacion): string {
    return this.convertir(this.stockDestino(), p);
  }

  private convertir(total: number | null, p: Presentacion): string {
    if (total == null) {
      return '—';
    }
    const porUnidad = p.cantidad ?? 1;
    if (!porUnidad) {
      return formatearCantidad(total, 0);
    }
    const valor = total / porUnidad;
    return formatearCantidad(valor, Number.isInteger(valor) ? 0 : 2);
  }
}
