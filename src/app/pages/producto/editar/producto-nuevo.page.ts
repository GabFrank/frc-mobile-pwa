import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { Familia, Subfamilia } from 'src/app/domains/productos/familia.model';
import type { Producto } from 'src/app/domains/productos/producto.model';
import { FamiliaSearchGQL } from 'src/app/graphql/productos/familiaSearch';
import { ProductoDescripcionExistsGQL } from 'src/app/graphql/productos/productoDescripcionExists';
import { SaveProductoGQL } from 'src/app/graphql/productos/saveProducto';
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

import {
  construirProductoInput,
  etiquetaCategoria,
  faltaParaGuardarProducto,
  mismoId,
} from './producto-editar.reglas';

/** Mismos tamaños que la pantalla de categoría de la edición. */
const TAM_PAGINA_FAMILIA = 30;
const TAM_PAGINA_SUBFAMILIA = 200;

/** IVA por defecto de un producto nuevo, igual que en el escritorio. */
const IVA_POR_DEFECTO = 10;

interface PaginaCatalogo<T> {
  getContent?: T[];
  hasNext?: boolean;
}

/**
 * Alta de producto.
 *
 * Pide **solo lo mínimo** —descripción, familia y subfamilia— y después manda
 * al hub de edición, donde las pantallas que ya existen cargan presentaciones,
 * códigos y precios. No hay un formulario largo que junte todo: el central
 * guarda en mutations separadas y sin transacción, así que un «guardar todo»
 * dejaría el producto a medias igual, pero además haciéndole creer al operador
 * que no se guardó nada.
 *
 * ⚠️ **El producto nace inactivo.** Se activa desde el hub cuando ya se puede
 * vender —ver `faltaParaActivar()`—. Si alguien abandona el alta a mitad, lo
 * que queda es un producto invisible, no uno roto que la caja no puede cobrar.
 *
 * ⚠️ **Los tres campos son obligatorios, y no por prolijidad.** Sin descripción
 * el central revienta (`ProductoService.java:312` hace `.toUpperCase()` sin
 * guard). Y de la subfamilia cuelga la notificación de producto creado que el
 * central dispara al dar de alta (`ProductoGraphQL.java:370`): sin ella nadie
 * se entera de que el producto existe.
 */
@Component({
  selector: 'frc-producto-nuevo',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nuevo producto" [conVolver]="true">
      <frc-seccion titulo="Identificación" [panel]="true">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
          <mat-label>Descripción</mat-label>
          <input
            matInput
            [ngModel]="descripcion()"
            (ngModelChange)="descripcion.set($event)"
            (blur)="verificarDuplicado()"
          />
        </mat-form-field>
        @if (duplicado()) {
          <p class="aviso">
            Ya existe un producto con esa descripción. Podés continuar igual si es
            otro artículo, pero conviene revisarlo antes.
          </p>
        }
      </frc-seccion>

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

      @if (falta(); as f) {
        <p class="falta">Falta {{ f }}.</p>
      }

      <button
        matButton="filled"
        type="button"
        class="boton-guardar"
        [disabled]="guardando() || falta() !== null"
        (click)="crear()"
      >
        {{ guardando() ? 'Creando…' : 'Crear producto' }}
      </button>
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
    .dato { margin: 0 0 var(--sp-2); font-weight: var(--fw-medium); }
    .aviso {
      margin: var(--sp-2) 0 0;
      color: var(--warn);
      font-size: var(--fs-label);
    }
    .falta {
      margin: var(--sp-3) 0 0;
      color: var(--text-soft);
      font-size: var(--fs-label);
      text-align: center;
    }
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
export class ProductoNuevoPage {
  private readonly datos = inject(DatosService);
  private readonly dialogo = inject(DialogoService);
  private readonly familiaSearchGQL = inject(FamiliaSearchGQL);
  private readonly subfamiliaSearchGQL = inject(SubfamiliaSearchGQL);
  private readonly descripcionExistsGQL = inject(ProductoDescripcionExistsGQL);
  private readonly saveProductoGQL = inject(SaveProductoGQL);
  private readonly router = inject(Router);

  /** Expuestas para el template. */
  protected readonly etiquetaCategoria = etiquetaCategoria;
  protected readonly mismoId = mismoId;

  readonly descripcion = signal('');
  readonly familia = signal<Familia | null>(null);
  readonly subfamiliaId = signal<number | null>(null);

  readonly subfamilias = signal<Subfamilia[]>([]);
  readonly cargandoSubfamilias = signal(false);
  readonly errorSubfamilias = signal(false);

  readonly duplicado = signal(false);
  readonly guardando = signal(false);

  /** Lo que falta para poder crear, o `null` si está todo. */
  readonly falta = computed<string | null>(() => {
    if (this.descripcion().trim() === '') return 'la descripción';
    if (this.familia() == null) return 'la familia';
    if (this.subfamiliaId() == null) return 'la subfamilia';
    return null;
  });

  /**
   * Avisa si ya hay un producto con esa descripción. **No bloquea**: hay
   * homónimos legítimos, y un bloqueo duro empuja a inventar variantes del
   * nombre para esquivarlo.
   *
   * ⚠️ Se consulta en MAYÚSCULAS porque así lo guarda el central; con el texto
   * tal como se tipeó, la comparación exacta no encontraría nada.
   */
  verificarDuplicado(): void {
    const texto = this.descripcion().trim().toUpperCase();
    if (texto === '') {
      this.duplicado.set(false);
      return;
    }

    this.datos
      .consultar<boolean>(
        this.descripcionExistsGQL,
        { descripcion: texto },
        // Un fallo acá no puede frenar el alta ni gritarle al operador: es un
        // aviso de cortesía, no una validación.
        { mostrarCarga: false, notificarError: false },
      )
      .subscribe({
        next: (existe) => this.duplicado.set(existe === true),
        error: () => this.duplicado.set(false),
      });
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
      this.familia.set(elegida);
      // Cambiar de familia invalida la subfamilia: no puede quedar colgando
      // una de la familia anterior.
      this.subfamiliaId.set(null);
      this.subfamilias.set([]);
      this.errorSubfamilias.set(false);
      this.cargarSubfamilias();
    }
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

  /** Sin `familiaId` la consulta devuelve todas las subfamilias de la base. */
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
          // Vacío y error no se muestran igual: un cero afirma algo que nadie
          // dijo.
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

  /**
   * Crea el producto y lleva al hub para completarlo.
   *
   * ⚠️ **El input se arma con `construirProductoInput` sobre un producto
   * vacío**, no a mano. `saveProducto` reemplaza el registro entero, así que
   * el input tiene que traer los 25 campos aunque acá casi todos vayan nulos;
   * armarlo a mano es exactamente el error que ese helper existe para evitar,
   * y en el alta ni siquiera fallaría hoy —no hay nada que pisar—, con lo cual
   * pasaría inadvertido hasta que alguien lo copie a una pantalla de edición.
   */
  crear(): void {
    if (this.falta() !== null) return;

    const input = construirProductoInput({} as Producto, {
      descripcion: this.descripcion().trim(),
      subfamiliaId: this.subfamiliaId(),
      iva: IVA_POR_DEFECTO,
      // Nace inactivo: se activa desde el hub cuando ya se puede vender.
      activo: false,
    });

    const falta = faltaParaGuardarProducto(input);
    if (falta != null) return;

    this.guardando.set(true);
    this.datos
      .guardar<Producto>(this.saveProductoGQL, input as unknown as Record<string, unknown>)
      .subscribe({
        next: (creado) => {
          const id = creado?.id;
          if (id == null) {
            this.guardando.set(false);
            return;
          }
          this.router.navigate(['/producto', id, 'editar']);
        },
        error: () => this.guardando.set(false),
      });
  }
}
