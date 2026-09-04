import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { ProductoPorIdGQL } from 'src/app/graphql/productos/productoPorId';
import { SaveProductoGQL } from 'src/app/graphql/productos/saveProducto';
import type { Producto, ProductoInput } from 'src/app/domains/productos/producto.model';

import {
  aplicarCascadaEnvase,
  construirProductoInput,
  faltaParaGuardarProducto,
} from './producto-editar.reglas';

/**
 * Dueño del producto que se está editando.
 *
 * Lo carga una vez y las seis pantallas de la edición leen de acá. Existe por
 * una razón concreta: `saveProducto` reemplaza la fila, así que el input tiene
 * que salir **completo** en cada guardado. Con cada pantalla armando el suyo,
 * alcanzaba con que una olvidara un campo para que corregir una descripción
 * apagara el control de vencimiento. Acá se arma en un solo lugar.
 */
@Injectable({ providedIn: 'root' })
export class ProductoEditarService {
  private readonly datos = inject(DatosService);
  private readonly productoPorId = inject(ProductoPorIdGQL);
  private readonly saveProducto = inject(SaveProductoGQL);

  private readonly _producto = signal<Producto | null>(null);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly producto = this._producto.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();

  readonly presentaciones = computed(() => this._producto()?.presentaciones ?? []);

  readonly totalCodigos = computed(() =>
    this.presentaciones().reduce((n, p) => n + (p.codigos?.length ?? 0), 0),
  );

  readonly totalPrecios = computed(() =>
    this.presentaciones().reduce((n, p) => n + (p.precios?.length ?? 0), 0),
  );

  cargar(id: number): void {
    // `Number('')` es 0, no NaN: sin el guard completo la app pediría el
    // producto cero y mostraría una ficha vacía como si existiera.
    if (!Number.isFinite(id) || id <= 0) {
      this._error.set('No se entiende qué producto abrir.');
      this._cargando.set(false);
      return;
    }

    this._cargando.set(true);
    this._error.set(null);

    this.datos.porId<Producto>(this.productoPorId, id).subscribe({
      next: (p) => {
        this._producto.set(p);
        this._cargando.set(false);
      },
      error: (e: Error) => {
        this._error.set(e.message);
        this._cargando.set(false);
      },
    });
  }

  /**
   * Guarda la cabecera con `cambios` aplicado encima del producto hidratado.
   *
   * El input sale completo siempre. La respuesta se vuelve a poner en el
   * estado porque el central **devuelve la descripción en mayúsculas**
   * (`ProductoService.java:312`): mostrar lo que se tipeó dejaría al operador
   * viendo una cosa distinta de la que quedó guardada.
   */
  guardarCabecera(cambios: Partial<ProductoInput>): Observable<Producto> {
    const actual = this._producto();
    if (actual == null) {
      return throwError(() => new Error('No hay producto cargado.'));
    }

    const input = construirProductoInput(actual, aplicarCascadaEnvase(cambios));

    const falta = faltaParaGuardarProducto(input);
    if (falta != null) {
      return throwError(() => new Error(falta));
    }

    return this.datos
      .guardar<Producto>(this.saveProducto, input as unknown as Record<string, unknown>)
      .pipe(
        tap((guardado) => {
          // El cast es necesario: `cambios` tipa sus campos opcionales con
          // `| null`, y eso ensancha el tipo del spread aunque en runtime
          // `guardado` (la respuesta del central) siempre gana.
          this._producto.set({ ...actual, ...cambios, ...guardado } as Producto);
        }),
      );
  }

  /** Vuelve a pedir el producto al central. Lo usan las subpantallas al volver. */
  recargar(): void {
    const id = this._producto()?.id;
    if (id != null) {
      this.cargar(id);
    }
  }
}
