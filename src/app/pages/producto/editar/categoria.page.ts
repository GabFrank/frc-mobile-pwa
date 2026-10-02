import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { Familia, Subfamilia } from 'src/app/domains/productos/familia.model';
import { FamiliaSearchGQL } from 'src/app/graphql/productos/familiaSearch';
import { SubfamiliaSearchGQL } from 'src/app/graphql/productos/subfamiliaSearch';
import {
  BuscadorComponent,
  ConfigBuscador,
} from 'src/app/shared/buscador/buscador.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

import { etiquetaCategoria, mismoId } from './producto-editar.reglas';
import { ProductoEditarService } from './producto-editar.service';

/** Tamaño de página para el buscador de familias. */
const TAM_PAGINA_FAMILIA = 30;
/** Las subfamilias de una familia no paginan: se traen todas de una. */
const TAM_PAGINA_SUBFAMILIA = 200;

interface PaginaCatalogo<T> {
  getContent?: T[];
  hasNext?: boolean;
}

/**
 * Familia y subfamilia del producto.
 *
 * Dos pasos: elegir la familia con el buscador genérico (`frc-buscador`, que
 * ya trae sus tres estados) y después la subfamilia de esa familia, en una
 * lista propia dentro de la pantalla.
 *
 * ⚠️ **La lista de subfamilias no reusa `frc-buscador`.** Ese diálogo dice
 * "Sin resultados" ante cualquier lista vacía, sin distinguir "esta familia
 * no tiene subfamilias cargadas" de "no se pudo consultar el catálogo" — y
 * esa es justamente la distinción que hay que hacer acá. Por eso esta
 * pantalla arma su propio trío de estados para ese catálogo.
 *
 * Guarda exclusivamente por `guardarCabecera({ subfamiliaId })`.
 */
@Component({
  selector: 'frc-categoria',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Familia y subfamilia" [conVolver]="true">
      @if (estado.cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (estado.error()) {
        <frc-estado-error [detalle]="estado.error()!" (reintentar)="recargar()" />
      } @else if (estado.producto()) {
        <frc-seccion titulo="Familia" [panel]="true">
          <p class="dato">{{ familia() ? etiquetaCategoria(familia()!) : 'Sin elegir' }}</p>
          <button matButton="tonal" type="button" (click)="abrirBuscadorFamilia()">
            Elegir familia
          </button>
        </frc-seccion>

        @if (familia(); as f) {
          <frc-seccion [titulo]="'Subfamilia de ' + etiquetaCategoria(f)" [panel]="true">
            @if (cargandoSubfamilias()) {
              <frc-skeleton [cantidad]="3" />
            } @else if (errorSubfamilias()) {
              <frc-estado-error
                titulo="No se pudo consultar el catálogo"
                (reintentar)="cargarSubfamilias()"
              />
            } @else if (subfamilias().length === 0) {
              <frc-estado-vacio
                titulo="Esa familia no tiene subfamilias cargadas"
                detalle="Elegí otra familia o cargá la subfamilia desde el escritorio."
              />
            } @else {
              <ul class="lista">
                @for (s of subfamilias(); track s.id) {
                  <li>
                    <button
                      type="button"
                      class="fila"
                      [class.elegida]="mismoId(s.id, subfamiliaId())"
                      (click)="elegirSubfamilia(s)"
                    >
                      {{ etiquetaCategoria(s) }}
                    </button>
                  </li>
                }
              </ul>
            }
          </frc-seccion>
        }

        <button
          matButton="filled"
          type="button"
          class="boton-guardar"
          [disabled]="guardando() || subfamiliaId() == null"
          (click)="guardar()"
        >
          {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
      }
    </frc-pagina>
  `,
  styles: `
    .dato { margin: 0 0 var(--sp-2); font-weight: var(--fw-medium); }
    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
    }
    .fila {
      width: 100%;
      text-align: left;
      background: none;
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      padding: var(--sp-3);
      cursor: pointer;
      font: inherit;
      color: var(--text);
    }
    .fila:hover { background: var(--surface-sunken); }
    .fila.elegida {
      border-color: var(--brand-text);
      background: var(--surface-sunken);
      font-weight: var(--fw-medium);
    }
    .boton-guardar { width: 100%; margin-top: var(--sp-2); }
  `,
})
export class CategoriaPage {
  readonly id = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  private readonly datos = inject(DatosService);
  private readonly dialogo = inject(DialogoService);
  private readonly familiaSearchGQL = inject(FamiliaSearchGQL);
  private readonly subfamiliaSearchGQL = inject(SubfamiliaSearchGQL);
  private readonly router = inject(Router);

  /** Expuestas para el template. */
  protected readonly etiquetaCategoria = etiquetaCategoria;
  protected readonly mismoId = mismoId;

  readonly familia = signal<Familia | null>(null);
  readonly subfamiliaId = signal<number | null>(null);

  readonly subfamilias = signal<Subfamilia[]>([]);
  readonly cargandoSubfamilias = signal(false);
  readonly errorSubfamilias = signal(false);

  readonly guardando = signal(false);

  /** Evita repoblar cuando `producto()` se vuelve a emitir tras guardar. */
  private formInicializado = false;

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });

    effect(() => {
      const p = this.estado.producto();
      if (p == null || this.formInicializado) return;
      this.formInicializado = true;

      const sub = p.subfamilia;
      if (sub == null) return;

      this.subfamiliaId.set(sub.id ?? null);
      if (sub.familia) {
        this.familia.set({ id: sub.familia.id, nombre: sub.familia.nombre });
        this.cargarSubfamilias();
      }
    });
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }

  async abrirBuscadorFamilia(): Promise<void> {
    const elegida = await this.dialogo.abrir<
      BuscadorComponent<Familia>,
      ConfigBuscador<Familia>,
      Familia
    >(BuscadorComponent, {
      modo: 'paginado',
      titulo: 'Elegir familia',
      placeholder: 'Buscar familia',
      cargarPagina: (texto, pagina) => this.buscarFamilias(texto, pagina),
      texto: (f) => etiquetaCategoria(f),
      id: (f) => f.id,
    });
    if (elegida) {
      this.elegirFamilia(elegida);
    }
  }

  private elegirFamilia(f: Familia): void {
    this.familia.set(f);
    // Cambiar de familia invalida la subfamilia elegida: no puede quedar
    // colgando una subfamilia de la familia anterior.
    this.subfamiliaId.set(null);
    this.subfamilias.set([]);
    this.errorSubfamilias.set(false);
    this.cargarSubfamilias();
  }

  private async buscarFamilias(
    texto: string,
    pagina: number,
  ): Promise<{ items: Familia[]; hayMas: boolean }> {
    const page = await firstValueFrom(
      this.datos.consultar<PaginaCatalogo<Familia>>(this.familiaSearchGQL, {
        texto,
        page: pagina,
        size: TAM_PAGINA_FAMILIA,
      }),
    );
    return { items: page?.getContent ?? [], hayMas: page?.hasNext === true };
  }

  /**
   * Sin `familiaId` esta consulta devuelve todas las subfamilias de la base
   * —cientos, de cualquier familia—, así que siempre se manda.
   */
  cargarSubfamilias(): void {
    const familiaId = this.familia()?.id;
    if (familiaId == null) return;

    this.cargandoSubfamilias.set(true);
    this.errorSubfamilias.set(false);

    this.datos
      .consultar<PaginaCatalogo<Subfamilia>>(this.subfamiliaSearchGQL, {
        familiaId,
        page: 0,
        size: TAM_PAGINA_SUBFAMILIA,
      })
      .subscribe({
        next: (page) => {
          this.subfamilias.set(page?.getContent ?? []);
          this.cargandoSubfamilias.set(false);
        },
        error: () => {
          // ⚠️ Un fallo de red no es "sin subfamilias": el vacío y el error
          // se muestran distinto a propósito.
          this.errorSubfamilias.set(true);
          this.cargandoSubfamilias.set(false);
        },
      });
  }

  elegirSubfamilia(s: Subfamilia): void {
    if (s.id != null) {
      this.subfamiliaId.set(s.id);
    }
  }

  guardar(): void {
    this.guardando.set(true);
    this.estado.guardarCabecera({ subfamiliaId: this.subfamiliaId() }).subscribe({
      next: () => this.router.navigate(['/producto', this.id(), 'editar']),
      error: () => this.guardando.set(false),
    });
  }
}
