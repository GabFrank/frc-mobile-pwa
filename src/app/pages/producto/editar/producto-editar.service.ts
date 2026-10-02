import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, switchMap, tap, throwError } from 'rxjs';

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
   * El input sale completo siempre. Después de guardar, **se vuelve a pedir
   * el producto entero al central** en vez de mezclar la respuesta a mano con
   * el que ya estaba en memoria: un merge superficial deja claves con forma
   * de input (`subfamiliaId`, `envaseId`) pisando un `Producto`, que se queda
   * con el `subfamilia` viejo y sin la cascada de `aplicarCascadaEnvase()`. Es
   * inofensivo mientras cada pantalla navegue después de guardar —la próxima
   * `cargar()` refresca todo—, pero un segundo guardado sin navegar de por
   * medio hidrataría `subfamiliaId` del objeto viejo y revertiría en
   * silencio un cambio de categoría. El refetch también preserva la
   * mayúscula que pone el central en la descripción
   * (`ProductoService.java:312`), que es lo que el merge a mano perseguía.
   *
   * ⚠️ **A propósito, sí: esto es una mutation y una query por cada Guardar,
   * no una.** No lo "optimices" volviendo al merge a mano — pasa cuando una
   * persona toca el botón, no en un loop, y la corrección vale más que un
   * request de más.
   */
  guardarCabecera(cambios: Partial<ProductoInput>): Observable<Producto> {
    const actual = this._producto();
    if (actual == null || actual.id == null) {
      return throwError(() => new Error('No hay producto cargado.'));
    }
    const productoId = actual.id;

    const input = construirProductoInput(actual, aplicarCascadaEnvase(cambios));

    const falta = faltaParaGuardarProducto(input);
    if (falta != null) {
      return throwError(() => new Error(falta));
    }

    return this.datos
      .guardar<Producto>(this.saveProducto, input as unknown as Record<string, unknown>)
      .pipe(
        switchMap(() => this.datos.porId<Producto>(this.productoPorId, productoId)),
        tap((refrescado) => this._producto.set(refrescado)),
      );
  }

  /** Vuelve a pedir el producto al central. Lo usan las subpantallas al volver. */
  /**
   * Vuelve a pedir el producto al central. Lo usan las subpantallas al volver.
   *
   * ⚠️ **El id se convierte a número a propósito.** `Producto.id` es `ID` en el
   * schema y GraphQL lo serializa como **string**, aunque el modelo TS diga
   * `number`. El guard de `cargar()` usa `Number.isFinite`, que **no** coerce:
   * con el string crudo daba `false`, el servicio creía que la ruta estaba rota
   * y la pantalla pintaba «No se pudieron cargar los datos» justo después de un
   * guardado exitoso. Reintentar arreglaba la vista porque ese camino toma el
   * id del parámetro de ruta, ya convertido.
   */
  recargar(): void {
    const id = Number(this._producto()?.id);
    if (Number.isFinite(id) && id > 0) {
      this.cargar(id);
    }
  }
}
