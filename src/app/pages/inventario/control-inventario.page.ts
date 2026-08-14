import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import type { ProductoSaldo } from 'src/app/domains/inventario/producto-saldo.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import {
  ProductosCantidadNegativaGQL,
  ProductosCantidadPositivaGQL,
  ProductosFaltantesGQL,
} from 'src/app/graphql/inventario/controlInventario';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';

type Reporte = 'positiva' | 'negativa' | 'faltantes';

const REPORTES: readonly { clave: Reporte; texto: string; vacio: string }[] = [
  { clave: 'negativa', texto: 'Saldo negativo', vacio: 'Ningún producto quedó en negativo.' },
  { clave: 'positiva', texto: 'Saldo positivo', vacio: 'Ningún producto tiene sobrante.' },
  { clave: 'faltantes', texto: 'Sin movimiento', vacio: 'Todos tuvieron movimiento en el período.' },
];

const TAMANO = 15;

/** Días hacia atrás que cubre «sin movimiento». Un mes es el ciclo de reposición. */
const DIAS_PERIODO = 30;

/**
 * Control de inventario: dónde el stock no cierra.
 *
 * Tres preguntas distintas sobre el saldo que lleva el central en
 * `movimiento_stock`:
 *
 * | Reporte | Qué muestra |
 * |---|---|
 * | **Saldo negativo** | se vendió o se sacó más de lo que había: casi siempre falta cargar una entrada |
 * | **Saldo positivo** | sobra contra el sistema |
 * | **Sin movimiento** | no se movió en el período — mercadería dormida o mal imputada |
 *
 * ⚠️ **El saldo lo calcula el central.** Es una diferencia acumulada sobre
 * los movimientos, no algo que el cliente pueda derivar de lo que ve.
 *
 * ⚠️ **«Sin movimiento» exige sucursal y rango; los otros dos no.** No es un
 * capricho del schema: un faltante solo significa algo dentro de un período,
 * mientras que un saldo positivo o negativo es un estado actual. Por eso el
 * selector de sucursal pasa a ser obligatorio al elegir ese reporte.
 *
 * `frc-mobile` mete los tres detrás de un menú de acciones. Acá son un
 * selector: cuál está activo es la pregunta principal de la pantalla y
 * esconderlo obliga a abrir un menú para saber qué se está mirando.
 */
@Component({
  selector: 'frc-control-inventario',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    SelectorComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Control de inventario" [conVolver]="true">
      <div class="filtros">
        <frc-selector
          etiqueta="Qué mirar"
          [opciones]="opcionesReporte"
          [valor]="reporte()"
          (valorChange)="cambiarReporte($event)"
        />
        <frc-selector
          [etiqueta]="exigeSucursal() ? 'Sucursal (obligatoria)' : 'Sucursal'"
          [opciones]="opcionesSucursal()"
          [valor]="sucursalId()"
          (valorChange)="cambiarSucursal($event)"
        />
      </div>

      @if (exigeSucursal() && !sucursalId()) {
        <frc-estado-vacio
          titulo="Elegí una sucursal"
          [detalle]="'«Sin movimiento» se calcula sobre los últimos ' + dias + ' días de una sucursal.'"
          icono="inventario"
        />
      } @else if (cargando()) {
        <frc-skeleton [cantidad]="5" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio titulo="Nada para revisar" [detalle]="textoVacio()" icono="inventario" />
      } @else {
        <p class="total">{{ total() }} producto{{ total() === 1 ? '' : 's' }}</p>

        @for (p of filas(); track p.productoId) {
          <frc-card
            [titulo]="p.productoDescripcion ?? 'Producto'"
            [subtitulo]="'Código ' + p.productoId"
            icono="inventario"
            (abrir)="verFicha(p)"
          >
            <span aparte class="saldo" [class.negativo]="(p.saldoTotal ?? 0) < 0">
              {{ saldo(p) }}
            </span>
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
    .filtros { display: flex; flex-direction: column; gap: var(--sp-2); }
    .total { margin: 0; font-size: var(--fs-label); color: var(--text-mute); }
    .saldo {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-bold);
      color: var(--warn);
    }
    .saldo.negativo { color: var(--danger); }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class ControlInventarioPage {
  private readonly datos = inject(DatosService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly positivaGQL = inject(ProductosCantidadPositivaGQL);
  private readonly negativaGQL = inject(ProductosCantidadNegativaGQL);
  private readonly faltantesGQL = inject(ProductosFaltantesGQL);
  private readonly router = inject(Router);

  readonly dias = DIAS_PERIODO;
  readonly opcionesReporte: OpcionSeleccion[] = REPORTES.map((r) => ({
    valor: r.clave,
    texto: r.texto,
  }));

  readonly reporte = signal<Reporte>('negativa');
  readonly sucursalId = signal<unknown>(null);
  readonly filas = signal<ProductoSaldo[]>([]);
  readonly total = signal(0);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private readonly listaSucursales = signal<Sucursal[]>([]);
  private pagina = 0;

  /** Solo «sin movimiento» necesita sucursal sí o sí. */
  readonly exigeSucursal = computed(() => this.reporte() === 'faltantes');

  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() => [
    ...(this.exigeSucursal() ? [] : [{ valor: null, texto: 'Todas las sucursales' }]),
    ...this.listaSucursales().map((s) => ({ valor: s.id, texto: s.nombre ?? `Sucursal ${s.id}` })),
  ]);

  readonly textoVacio = computed(
    () => REPORTES.find((r) => r.clave === this.reporte())?.vacio ?? '',
  );

  constructor() {
    this.cargarSucursales();
    this.cargar();
  }

  /** Solo operables: una sucursal sin depósito no tiene saldo que controlar. */
  private cargarSucursales(): void {
    this.sucursales.todas().subscribe({
      next: (lista) => {
        const operables = soloOperables(lista ?? []);
        this.listaSucursales.set(operables);
        const propia = this.auth.sucursal()?.id;
        if (propia != null && operables.some((s) => Number(s.id) === Number(propia))) {
          this.sucursalId.set(propia);
        }
      },
      error: () => this.listaSucursales.set([]),
    });
  }

  cargar(agregando = false): void {
    if (this.exigeSucursal() && !this.sucursalId()) {
      this.cargando.set(false);
      return;
    }

    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.filas.set([]);
    }
    this.error.set(null);

    const sucursalId = this.sucursalId() != null ? Number(this.sucursalId()) : null;
    const comun = { sucursalId, productoId: null, page: this.pagina, size: TAMANO };

    const consulta =
      this.reporte() === 'faltantes'
        ? this.datos.consultar<PageInfo<ProductoSaldo>>(this.faltantesGQL, {
            ...comun,
            fechaInicio: this.desde(),
            fechaFin: this.hasta(),
          })
        : this.datos.consultar<PageInfo<ProductoSaldo>>(
            this.reporte() === 'positiva' ? this.positivaGQL : this.negativaGQL,
            comun,
          );

    consulta.subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.filas.update((previas) => (agregando ? [...previas, ...contenido] : contenido));
        this.total.set(page?.getTotalElements ?? this.filas().length);
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

  cambiarReporte(valor: unknown): void {
    this.reporte.set(valor as Reporte);
    // Al pasar a «sin movimiento», «Todas» deja de ser una opción válida: se
    // limpia para que el selector no quede mostrando algo que no se puede usar.
    if (this.exigeSucursal() && this.sucursalId() == null) {
      const propia = this.auth.sucursal()?.id;
      this.sucursalId.set(propia ?? this.listaSucursales()[0]?.id ?? null);
    }
    this.cargar();
  }

  cambiarSucursal(valor: unknown): void {
    this.sucursalId.set(valor);
    this.cargar();
  }

  saldo(p: ProductoSaldo): string {
    const valor = p.saldoTotal ?? 0;
    return `${valor > 0 ? '+' : ''}${formatearCantidad(valor, 2)}`;
  }

  /** `yyyy-MM-dd`, que es como el central espera las fechas. */
  private desde(): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - DIAS_PERIODO);
    return fecha.toISOString().slice(0, 10);
  }

  private hasta(): string {
    return new Date().toISOString().slice(0, 10);
  }

  verFicha(p: ProductoSaldo): void {
    if (p.productoId != null) {
      // La ficha responde la pregunta que sigue: qué códigos y qué precios
      // tiene el producto cuyo saldo no cierra.
      void this.router.navigate(['/producto', p.productoId]);
    }
  }
}
