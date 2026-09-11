import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import type { PageInfo } from 'src/app/domains/page-info.model';
import {
  ProductoVencido,
  toneDeVencimiento,
} from 'src/app/domains/productos/producto-vencido.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearExistencia } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { PaginacionComponent } from 'src/app/shared/paginacion/paginacion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { ProductoService } from './producto.service';

/** Valor del selector cuando no se acota por sucursal. */
const TODAS = 'todas';

/** Horizonte de «por vencer». Un mes es el ciclo de reposición. */
const DIAS_PROXIMOS = 30;

type Ventana = 'vencidos' | 'proximos';

/** `yyyy-MM-dd` a N días de hoy, que es como el central espera las fechas. */
function enDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Qué hay que sacar de la góndola.
 *
 * Es el reporte de la mañana: lo vencido primero, lo que vence esta semana
 * después. Se abre desde Inicio, como en `frc-mobile`.
 *
 * ⚠️ **Arranca en la sucursal de la sesión, no en todas.** Quien abre esto
 * está parado en un local y pregunta por su góndola; el listado de la red
 * entera es cientos de filas que no puede tocar. Se cambia con el selector.
 *
 * Del reporte de escritorio quedaron fuera los filtros por sector, zona y
 * usuario: son de la pantalla grande, donde se audita. Acá el caso es
 * caminar el pasillo con el teléfono.
 */
@Component({
  selector: 'frc-productos-vencidos',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    PaginacionComponent,
    SelectorComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Productos vencidos" [conVolver]="true">
      <div class="filtros">
        <frc-selector
          etiqueta="Sucursal"
          [opciones]="opcionesSucursal()"
          [valor]="sucursalElegida()"
          (valorChange)="cambiarSucursal($event)"
        />
        <frc-selector
          etiqueta="Qué mostrar"
          [opciones]="opcionesVentana"
          [valor]="ventana()"
          (valorChange)="cambiarVentana($event)"
        />
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          [titulo]="ventana() === 'vencidos' ? 'Nada vencido' : 'Nada por vencer'"
          [detalle]="
            ventana() === 'vencidos'
              ? 'No hay productos pasados de fecha con este filtro.'
              : 'No hay vencimientos en los próximos ' + DIAS_PROXIMOS + ' días.'
          "
          icono="vencido"
        />
      } @else {
        @for (v of filas(); track v.id) {
          <frc-card [titulo]="v.productoDescripcion ?? 'Producto'" [subtitulo]="lugar(v)" icono="vencido">
            <frc-estado-chip
              aparte
              [etiqueta]="v.diasVencimientoTexto ?? '—'"
              [tono]="tono(v)"
            />

            <span pie class="linea">{{ cantidad(v) }} · vence {{ fecha(v) }}</span>

            @if (v.detalleFuente) {
              <span pie class="fuente">{{ v.detalleFuente }}</span>
            }

            <!--
              Solo aparece cuando el inventario contradice a la fuente elegida.
              Es la razón por la que alguien discute una fila: el papel dice
              una cosa y el conteo dijo otra.
            -->
            @if (v.referenciaInventario) {
              <span pie class="contradice">{{ v.referenciaInventario }}</span>
            }
          </frc-card>
        }

        <frc-paginacion [pagina]="pagina()" [page]="page()" (cambiar)="irAPagina($event)" />
      }
    </frc-pagina>
  `,
  styles: `
    .filtros {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    .linea { font-size: var(--fs-label); color: var(--text-soft); }
    .fuente { font-size: var(--fs-caption); color: var(--text-mute); }
    .contradice { font-size: var(--fs-caption); color: var(--warn); }
  `,
})
export class ProductosVencidosPage {
  private readonly servicio = inject(ProductoService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);

  readonly filas = signal<ProductoVencido[]>([]);
  readonly page = signal<PageInfo<ProductoVencido> | null>(null);
  readonly pagina = signal(0);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly DIAS_PROXIMOS = DIAS_PROXIMOS;
  /** Arranca en lo ya vencido: es lo que hay que sacar hoy. */
  readonly ventana = signal<Ventana>('vencidos');
  readonly opcionesVentana: OpcionSeleccion[] = [
    { valor: 'vencidos', texto: 'Ya vencidos' },
    { valor: 'proximos', texto: `Vencen en ${DIAS_PROXIMOS} días` },
  ];

  readonly listaSucursales = signal<Sucursal[]>([]);
  readonly sucursalElegida = signal<unknown>(TODAS);

  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() => [
    { valor: TODAS, texto: 'Todas las sucursales' },
    ...this.listaSucursales().map((s) => ({ valor: s.id, texto: s.nombre ?? `Sucursal ${s.id}` })),
  ]);

  constructor() {
    this.cargarSucursales();
    this.cargar();
  }

  /**
   * ⚠️ Solo las operables. Una sucursal sin depósito —SERVIDOR, COMPRAS— no
   * tiene góndola, así que filtrar por ella devuelve vacío siempre y solo
   * sirve para que alguien crea que no hay vencimientos.
   */
  private cargarSucursales(): void {
    this.sucursales.todas().subscribe({
      next: (lista) => {
        const operables = soloOperables(lista ?? []);
        this.listaSucursales.set(operables);

        // La de la sesión como valor inicial, si es una de las operables.
        const propia = this.auth.sucursal()?.id;
        if (propia != null && operables.some((s) => Number(s.id) === Number(propia))) {
          this.sucursalElegida.set(propia);
          this.cargar();
        }
      },
      // Sin la lista queda «Todas», que es un reporte válido: no es motivo
      // para dejar la pantalla en error.
      error: () => this.listaSucursales.set([]),
    });
  }

  cargar(): void {
    this.cargarPagina(0);
  }

  private cargarPagina(destino: number): void {
    this.cargando.set(true);
    this.error.set(null);

    const elegida = this.sucursalElegida();
    const sucursalIds = elegida === TODAS ? null : [Number(elegida)];
    const proximos = this.ventana() === 'proximos';

    this.servicio
      .vencidos({
        sucursalIds,
        soloVencidos: !proximos,
        // ⚠️ Sin techo, el reporte trae lotes que vencen en 2030 y los pone
        // ARRIBA: el central pagina con `ORDER BY vencimiento DESC` y no
        // acepta parámetro de orden. Acotar la ventana es lo único que se
        // puede hacer desde acá para que la primera página sea accionable.
        // El orden en sí necesita un cambio en el central.
        hasta: proximos ? enDias(DIAS_PROXIMOS) : null,
        page: destino,
      })
      .subscribe({
        next: (page) => {
          this.page.set(page ?? null);
          this.filas.set(page?.getContent ?? []);
          this.pagina.set(destino);
          this.cargando.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.cargando.set(false);
        },
      });
  }

  cambiarSucursal(valor: unknown): void {
    this.sucursalElegida.set(valor);
    // Vuelve a la primera: la página 3 de una sucursal puede no existir en otra.
    this.cargarPagina(0);
  }

  cambiarVentana(valor: unknown): void {
    this.ventana.set(valor as Ventana);
    this.cargarPagina(0);
  }

  irAPagina(destino: number): void {
    this.cargarPagina(destino);
  }

  tono(v: ProductoVencido): 'danger' | 'warn' | 'ok' {
    return toneDeVencimiento(v.diasVencimientoClase);
  }

  /** Sin hora: un vencimiento es un día. */
  fecha(v: ProductoVencido): string {
    return fechaLegible(v.vencimiento, { conHora: false }) ?? '—';
  }

  cantidad(v: ProductoVencido): string {
    // Sin decimales fijos: son unidades por vencer, y `3,00` se lee como si
    // hubiera una fracción de envase. Ver `formatearExistencia`.
    const unidades = formatearExistencia(v.cantidad);
    const presentacion = v.presentacionCantidad;
    // La cantidad manda y la presentación es contexto, igual que en el
    // buscador: es lo que se compara entre filas.
    return presentacion && presentacion > 1 ? `${unidades} (x${presentacion})` : unidades;
  }

  lugar(v: ProductoVencido): string {
    return [v.sucursalNombre, v.zonaDescripcion, v.sectorDescripcion].filter(Boolean).join(' · ');
  }
}
