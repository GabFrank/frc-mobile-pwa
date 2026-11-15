import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';

import { Router } from '@angular/router';

import { esFalloDeTransporte, DatosService } from 'src/app/core/graphql/datos.service';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';
import {
  monedaGuardadaDePrecio,
  monedasDePreciosDeProducto,
  referenciaDePrecio,
} from 'src/app/domains/moneda/precio-moneda';
import { PrecioMonedaService } from 'src/app/domains/moneda/precio-moneda.service';
import {
  MonedaDePreciosDeProductoGQL,
  type ProductoConMonedaDePrecios,
} from 'src/app/graphql/operaciones/moneda/convertirPrecios';

import { AuthService } from 'src/app/core/auth/auth.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { esEntero, formatearCantidad, formatearExistencia } from 'src/app/generic/utils/moneda.util';
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
          @if (puedeEditar()) {
            <button type="button" class="editar" (click)="editar()">Editar producto</button>
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
              @for (precio of preciosPorPresentacion().get(pr.id) ?? []; track precio.id) {
                <div class="linea">
                  <span class="etiqueta">{{ nombrePrecio(precio) }}</span>
                  @if (precio.referencia; as ref) {
                    <frc-importe [valor]="precio.precio ?? 0" [moneda]="ref.moneda" [simbolo]="ref.simbolo" />
                  } @else {
                    <!-- Sin saber la moneda, el número solo: nunca ₲ por descarte (#148). -->
                    <span class="sin-moneda">
                      {{ precio.sinMoneda }}
                      <frc-estado-chip etiqueta="Moneda sin confirmar" tono="warn" />
                    </span>
                  }
                </div>
              } @empty {
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
    .sin-moneda { display: inline-flex; align-items: center; gap: var(--sp-2); font-variant-numeric: tabular-nums; }

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

    .editar {
      align-self: flex-start;
      margin-top: var(--sp-2);
      padding: var(--sp-2) var(--sp-4);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      background: transparent;
      color: var(--text);
      font-weight: var(--fw-medium);
      cursor: pointer;
    }
  `,
})
export class ProductoDetallePage {
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);
  private readonly datos = inject(DatosService);
  private readonly monedasSesion = inject(MonedasSesion);
  private readonly precioMoneda = inject(PrecioMonedaService);
  private readonly monedaDePreciosGQL = inject(MonedaDePreciosDeProductoGQL);

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

  /**
   * Condiciona el botón, no reemplaza al guard de `/producto/:id/editar`:
   * esconder el botón no es control de acceso.
   */
  readonly puedeEditar = computed(() =>
    this.roles.tieneAlgunRol(this.auth.roles(), PERMISOS.productoEdicion),
  );

  readonly presentaciones = computed(() => this.producto()?.presentaciones ?? []);

  /** La moneda de cada precio del producto (activos e inactivos), o `null` si no llegó. */
  private readonly monedasDelProducto = signal<ReadonlyMap<string, Moneda | null> | null>(null);
  /** La lectura por producto respondió con error de GraphQL: el central no la tiene. */
  private readonly productoSinConsulta = signal(false);
  private lecturaMonedas = 0;

  /**
   * Precios de cada presentación, filtrados y ordenados una sola vez por carga,
   * con la moneda en que se muestran: `referencia` `null` = no se sabe (#148).
   */
  readonly preciosPorPresentacion = computed(
    () =>
      new Map(
        this.presentaciones().map((p) => [
          p.id,
          this.preciosDe(p).map((precio) => {
            const moneda = this.monedaDe(precio);
            const v = precio.precio ?? 0;
            return {
              ...precio,
              referencia: moneda === undefined ? null : referenciaDePrecio(moneda, this.monedasSesion.empresa()),
              sinMoneda: formatearCantidad(v, esEntero(v) ? 0 : 2),
            };
          }),
        ]),
      ),
  );

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
        // `untracked`: `cargar()` lee signals de la sesión (vía `listo()`) y no
        // tienen que volver a disparar la carga entera.
        untracked(() => this.cargar());
      }
    });

    // La moneda por producto, cuando el central maneja monedas (se sabe al
    // terminar la lista de la sesión). Igual que Precios.
    effect(() => {
      const id = this.id();
      const puede = this.monedasSesion.preciosMonedaSoportado() || this.monedasSesion.preciosMonedaSinRespuesta();
      if (id !== undefined && puede) untracked(() => this.cargarMonedas(id));
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
    // Lo del producto anterior no vale para este.
    this.lecturaMonedas++;
    this.monedasDelProducto.set(null);
    this.productoSinConsulta.set(false);
    // Si la lista de la sesión no se pidió o no respondió, otra vez.
    void this.precioMoneda.listo();

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

  /** Sin caché ni toast: la ficha no se bloquea por la moneda. */
  private cargarMonedas(idRuta: string): void {
    const id = Number(idRuta);
    if (!Number.isFinite(id) || id <= 0) return;
    const lectura = ++this.lecturaMonedas;
    this.datos
      .consultar<ProductoConMonedaDePrecios>(this.monedaDePreciosGQL, { id }, {
        mostrarCarga: false,
        notificarError: false,
        gql: { fetchPolicy: 'network-only' },
      })
      .subscribe({
        next: (p) => {
          if (lectura !== this.lecturaMonedas || idRuta !== this.id()) return;
          this.monedasDelProducto.set(monedasDePreciosDeProducto(p));
        },
        error: (err: unknown) => {
          if (lectura !== this.lecturaMonedas || idRuta !== this.id()) return;
          // GraphQL: un central sin la moneda de los precios. Transporte: no se sabe.
          if (!esFalloDeTransporte(err)) this.productoSinConsulta.set(true);
        },
      });
  }

  private monedaDe(precio: { id?: number | string; activo?: boolean }): Moneda | null | undefined {
    // El precio suelto (`id: -1`) no tiene id de precio: la moneda de la empresa.
    if (precio.id === -1) return null;
    return monedaGuardadaDePrecio({
      precioId: precio.id,
      activo: precio.activo,
      delProducto: this.monedasDelProducto(),
      productoSinConsulta: this.productoSinConsulta(),
      sesion: this.monedasSesion.preciosOtraMoneda(),
      soportado: this.monedasSesion.preciosMonedaSoportado(),
      sinRespuesta: this.monedasSesion.preciosMonedaSinRespuesta(),
      listos: this.monedasSesion.preciosMonedaListos(),
    });
  }

  editar(): void {
    this.router.navigate(['/producto', this.id(), 'editar']);
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
