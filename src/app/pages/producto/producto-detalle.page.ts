import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { AuthService } from 'src/app/core/auth/auth.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { formatearExistencia } from 'src/app/generic/utils/moneda.util';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { etiquetaPresentacion, precioDe } from 'src/app/shared/producto/presentacion.util';

/** Marca que el producto lleva, con su tono. */
interface Marca {
  etiqueta: string;
  tono: 'ok' | 'warn' | 'info' | 'neutral';
}

/**
 * Ficha del producto.
 *
 * Lo que el buscador no muestra porque no entra en una card: todos los
 * códigos de cada presentación, todos los tipos de precio —no solo el
 * principal—, el stock en cada sucursal y las marcas del producto.
 *
 * Es **de solo lectura**. La edición vive en `/producto/:id/editar` y exige
 * el rol `EDITAR PRODUCTOS`; la sección de precios, además, `EDITAR PRECIOS`.
 */
@Component({
  selector: 'frc-producto-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    ImporteComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (producto(); as p) {
        <frc-seccion titulo="Producto" [panel]="true">
          <frc-dato etiqueta="Descripción" [valor]="p.descripcion ?? '—'" />
          <frc-dato etiqueta="Código principal" [valor]="p.codigoPrincipal ?? '—'" />
          @if (p.isEnvase && p.envase?.descripcion) {
            <frc-dato etiqueta="Envase" [valor]="p.envase!.descripcion!" />
          }
        </frc-seccion>

        @if (marcas().length > 0) {
          <frc-seccion titulo="Características">
            <div class="marcas">
              @for (m of marcas(); track m.etiqueta) {
                <frc-estado-chip [etiqueta]="m.etiqueta" [tono]="m.tono" />
              }
            </div>
          </frc-seccion>
        }

        <frc-seccion [titulo]="'Presentaciones (' + presentaciones().length + ')'">
          @for (pr of presentaciones(); track pr.id) {
            <div class="presentacion">
              <div class="cabecera">
                <span class="nombre">{{ etiqueta(pr) }}</span>
                @if (pr.principal) {
                  <frc-estado-chip etiqueta="Principal" tono="info" />
                }
              </div>

              <!--
                Todos los tipos de precio, no solo el principal. Es la
                diferencia con la card del buscador: acá se viene a resolver
                una discusión sobre cuál precio corresponde.
              -->
              @for (precio of preciosDe(pr); track precio.id) {
                <div class="linea">
                  <span class="etiqueta">{{ nombrePrecio(precio) }}</span>
                  <frc-importe [valor]="precio.precio ?? 0" moneda="Guaraní" simbolo="₲" />
                </div>
              }
              @if (preciosDe(pr).length === 0) {
                <div class="linea"><span class="etiqueta vacio">Sin precio cargado</span></div>
              }

              @if (codigosDe(pr).length > 0) {
                <div class="codigos">
                  @for (c of codigosDe(pr); track c.id) {
                    <span class="codigo" [class.inactivo]="c.activo === false">{{ c.codigo }}</span>
                  }
                </div>
              }
            </div>
          }
        </frc-seccion>

        <frc-seccion titulo="Existencia por sucursal" [panel]="true">
          @if (cargandoStock()) {
            <frc-dato etiqueta="Cargando…" valor="" />
          } @else if (stockFallo()) {
            <!--
              «No se pudo consultar» y no una lista de ceros. Un cero afirma
              que no hay mercadería; no haber podido preguntar no afirma
              nada, y quien busca stock necesita saber cuál de las dos es.
            -->
            <frc-dato etiqueta="Existencia" valor="No se pudo consultar" />
          } @else if (stockVisible().length === 0) {
            <frc-dato etiqueta="Sin movimientos" valor="—" />
          } @else {
            @for (s of stockVisible(); track s.nombre) {
              <frc-dato [etiqueta]="s.nombre" [valor]="s.cantidad" />
            }
          }
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: `
    .marcas { display: flex; flex-wrap: wrap; gap: var(--sp-2); }

    .presentacion {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: var(--sp-3);
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .cabecera { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
    .nombre { font-size: var(--fs-body); font-weight: var(--fw-medium); color: var(--text); }
    .linea { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
    .etiqueta { font-size: var(--fs-label); color: var(--text-soft); }
    .etiqueta.vacio { color: var(--text-mute); font-style: italic; }

    .codigos { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
    .codigo {
      font-family: var(--font-num);
      font-size: var(--fs-caption);
      padding: 2px var(--sp-2);
      border-radius: var(--radius-sm);
      background: var(--surface-sunken);
      color: var(--text-soft);
    }
    /* Un código dado de baja sigue estando pegado a cajas viejas. */
    .codigo.inactivo { text-decoration: line-through; color: var(--text-mute); }
  `,
})
export class ProductoDetallePage {
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);

  /** Del router. Opcional: se asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly producto = signal<Producto | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly cargandoStock = signal(true);
  /** Distingue «no hay stock» de «no se pudo preguntar». */
  readonly stockFallo = signal(false);
  private readonly stock = signal<Map<string, number>>(new Map());
  private readonly listaSucursales = signal<Sucursal[]>([]);

  readonly titulo = computed(() => this.producto()?.descripcion ?? 'Producto');

  readonly presentaciones = computed(() => this.producto()?.presentaciones ?? []);

  /**
   * Lo que hay que saber antes de tocar el producto.
   *
   * `balanza` cambia cómo se lo cobra; `vencimiento` obliga a mirar la fecha
   * al recibirlo; `cambiable` decide si se acepta una devolución. Van como
   * chips y no como datos porque lo que importa es verlos de un vistazo.
   */
  readonly marcas = computed<Marca[]>(() => {
    const p = this.producto();
    if (!p) {
      return [];
    }
    const marcas: Marca[] = [];
    if (p.balanza) {
      marcas.push({ etiqueta: 'De balanza', tono: 'info' });
    }
    if (p.vencimiento) {
      const dias = p.diasVencimiento;
      marcas.push({
        etiqueta: dias ? `Controla vencimiento (${dias} días)` : 'Controla vencimiento',
        tono: 'warn',
      });
    }
    if (p.cambiable) {
      marcas.push({ etiqueta: 'Cambiable', tono: 'ok' });
    }
    if (p.isEnvase) {
      marcas.push({ etiqueta: 'Envase', tono: 'neutral' });
    }
    return marcas;
  });

  /**
   * Existencia por sucursal, ya con nombre.
   *
   * ⚠️ **Una sucursal sin movimientos no vuelve en la consulta** —no hay
   * filas que sumar—, así que se muestra en cero en vez de desaparecer:
   * «no sé» y «no hay» son respuestas distintas para quien busca stock.
   */
  readonly stockVisible = computed(() => {
    const mapa = this.stock();
    // Sin decimales salvo que el producto se venda por peso: ver
    // `formatearExistencia`.
    const pesable = this.producto()?.balanza === true;
    return soloOperables(this.listaSucursales()).map((s) => ({
      nombre: s.nombre ?? `Sucursal ${s.id}`,
      cantidad: formatearExistencia(mapa.get(String(s.id)) ?? 0, pesable),
    }));
  });

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
      this.error.set('No se entiende qué producto abrir.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.busqueda.detalle(id).subscribe({
      next: (p) => {
        this.producto.set(p ?? null);
        this.cargando.set(false);
        if (p?.id != null) {
          this.cargarStock(Number(p.id));
        }
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * El stock no bloquea la ficha.
   *
   * Son dos consultas: si la existencia falla, los precios y los códigos
   * —que es a lo que se viene— igual se ven.
   */
  private cargarStock(productoId: number): void {
    this.cargandoStock.set(true);
    this.stockFallo.set(false);

    this.sucursales.todas().subscribe({
      next: (lista) => this.listaSucursales.set(lista ?? []),
      error: () => this.listaSucursales.set([]),
    });

    // Sin toast: la existencia es secundaria en esta pantalla y un aviso
    // rojo tapando la ficha por algo que ya se explica en su propia sección
    // es ruido. Lo mismo vale contra una instancia que todavía no tenga
    // `stockPorSucursales`, que es nueva en el central.
    this.busqueda.stockPorSucursales(productoId, { notificarError: false }).subscribe({
      next: (mapa) => {
        this.stock.set(mapa);
        this.cargandoStock.set(false);
      },
      error: () => {
        this.stock.set(new Map());
        this.stockFallo.set(true);
        this.cargandoStock.set(false);
      },
    });
  }

  etiqueta(p: Presentacion): string {
    return etiquetaPresentacion(p);
  }

  /**
   * Precios de la presentación, el principal primero.
   *
   * Si no hay lista de precios se cae al principal suelto: algunas
   * presentaciones viejas solo lo tienen a él.
   */
  preciosDe(p: Presentacion) {
    const lista = (p.precios ?? []).filter((x) => x.precio != null);
    if (lista.length > 0) {
      return [...lista].sort((a, b) => Number(b.principal ?? false) - Number(a.principal ?? false));
    }
    const suelto = precioDe(p);
    return suelto != null ? [{ id: -1, precio: suelto, principal: true } as never] : [];
  }

  nombrePrecio(precio: { principal?: boolean; tipoPrecio?: { descripcion?: unknown } }): string {
    // `descripcion` está tipada como el wrapper String en los modelos
    // portados; se normaliza acá igual que en `etiquetaPresentacion`.
    const crudo = precio.tipoPrecio?.descripcion;
    const nombre = crudo != null ? String(crudo).trim() : '';
    if (nombre) {
      return precio.principal ? `${nombre} (principal)` : nombre;
    }
    return precio.principal ? 'Precio principal' : 'Precio';
  }

  codigosDe(p: Presentacion) {
    return p.codigos ?? [];
  }
}
