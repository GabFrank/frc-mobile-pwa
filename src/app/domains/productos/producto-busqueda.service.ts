import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, concatMap, defaultIfEmpty, filter, map, switchMap, take } from 'rxjs/operators';
import { from } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Codigo } from 'src/app/domains/productos/codigo.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import {
  codigosParaBuscar,
  esCodigoPesable,
  parseCodigoPesable,
} from 'src/app/generic/utils/barcodeUtils';
import { CodigoPorCodigoGQL } from 'src/app/graphql/productos/codigoPorCodigo';
import { ProductoPorCodigoGQL } from 'src/app/graphql/productos/productoPorCodigo';
import { ProductoPorIdGQL } from 'src/app/graphql/productos/productoPorId';
import { ProductoSearchGQL } from 'src/app/graphql/productos/productoSearch';
import { ProductoStockGQL } from 'src/app/graphql/productos/productoStock';
import {
  StockPorSucursal,
  StockPorSucursalesGQL,
} from 'src/app/graphql/productos/stockPorSucursales';
import { resolverPresentacionPorCodigo, tienePresentaciones } from 'src/app/shared/producto/presentacion.util';

/** Un pesable devuelve producto **y** cantidad: el peso viene en el código. */
export interface ResultadoPesable {
  producto: Producto;
  presentacion: Presentacion;
  /** Kilos, ya convertidos desde los gramos del código. */
  peso: number;
}

/**
 * Resuelve un texto o un escaneo a un producto.
 *
 * Concentra las reglas que en `frc-mobile` vivían en `ProductoBusquedaService`
 * y que son la parte más cargada de negocio de toda la búsqueda.
 *
 * Tres reglas que no se pueden saltear:
 *
 * 1. **Un escaneo produce varios códigos candidatos, no uno.** Se prueban en
 *    orden hasta encontrar producto. Buscar con el texto crudo del escáner
 *    falla con GS1 y con EAN-14.
 * 2. **Los pesables traen la cantidad.** Tratarlos como código normal pierde
 *    el peso y el operador lo tiene que cargar a mano.
 * 3. **El código identifica la presentación, no solo el producto.** Un mismo
 *    producto tiene códigos distintos para la unidad y para la caja, y de eso
 *    depende el precio.
 */
@Injectable({ providedIn: 'root' })
export class ProductoBusquedaService {
  private readonly datos = inject(DatosService);
  private readonly porCodigoGQL = inject(ProductoPorCodigoGQL);
  private readonly buscarGQL = inject(ProductoSearchGQL);
  private readonly porIdGQL = inject(ProductoPorIdGQL);
  private readonly codigoGQL = inject(CodigoPorCodigoGQL);
  private readonly stockGQL = inject(ProductoStockGQL);
  private readonly stockTodasGQL = inject(StockPorSucursalesGQL);

  /**
   * Búsqueda general: primero por código, después por descripción.
   *
   * Con `offset > 0` va directo a la búsqueda por texto: paginar tiene
   * sentido sobre una lista de resultados, no sobre un código, que devuelve
   * uno o ninguno.
   */
  buscarPorCodigoOTexto(texto: string, offset = 0): Observable<Producto[]> {
    const limpio = texto?.trim() ?? '';
    if (!limpio) {
      return of([]);
    }
    if (offset > 0) {
      return this.buscarPorTexto(limpio, offset);
    }

    const codigos = codigosParaBuscar(limpio);
    if (codigos.length === 0) {
      return this.buscarPorTexto(limpio, 0);
    }

    return this.primerProductoDe(codigos).pipe(
      switchMap((producto) => (producto ? of([producto]) : this.buscarPorTexto(limpio, 0))),
    );
  }

  /** Resuelve un escaneo a un producto, con sus presentaciones cargadas. */
  porEscaneo(textoEscaneado: string): Observable<Producto | null> {
    const candidatos = codigosParaBuscar(textoEscaneado);
    const lista = candidatos.length > 0 ? candidatos : [textoEscaneado.trim()].filter(Boolean);

    return this.primerProductoDe(lista).pipe(
      switchMap((producto) => (producto ? this.conPresentaciones(producto) : of(null))),
    );
  }

  esPesable(texto: string): boolean {
    return esCodigoPesable(texto);
  }

  /**
   * Producto de balanza: devuelve también el peso.
   *
   * Se intenta primero con el código completo, porque algunas balanzas
   * imprimen un código que sí está cargado como tal. Si no aparece, se cae al
   * **código interno de 5 dígitos** que el código de balanza lleva embebido,
   * que es el caso habitual.
   */
  pesable(codigoCompleto: string): Observable<ResultadoPesable | null> {
    const { codigoInterno, peso } = parseCodigoPesable(codigoCompleto);

    return this.primerProductoDe([codigoCompleto]).pipe(
      switchMap((producto) => {
        if (!producto) {
          return this.pesablePorCodigoInterno(codigoInterno, peso);
        }
        return this.conPresentaciones(producto).pipe(
          switchMap((completo) => {
            if (completo?.balanza) {
              const presentacion = resolverPresentacionPorCodigo(
                completo,
                codigoCompleto,
                codigoInterno,
              );
              if (presentacion) {
                return of({ producto: completo, presentacion, peso });
              }
            }
            return this.pesablePorCodigoInterno(codigoInterno, peso);
          }),
        );
      }),
    );
  }

  /**
   * Existencia en **todas** las sucursales, en una sola consulta.
   *
   * ⚠️ **No pedir esto en un bucle por sucursal.** Es exactamente lo que
   * hacen hoy el desktop y `frc-mobile`: 18 requests para una sola pregunta,
   * y el navegador abre 6 conexiones por origen. En `gestion-compras` del
   * desktop llegó a hacer falta espaciar los pedidos con `setTimeout` para no
   * saturar el servidor.
   *
   * Las sucursales sin movimientos no vuelven en la lista: se muestran en
   * cero.
   */
  stockPorSucursales(productoId: number): Observable<Map<string, number>> {
    return this.datos
      .consultar<StockPorSucursal[]>(this.stockTodasGQL, { proId: productoId })
      .pipe(
        map((filas) => {
          // Clave string: los ids llegan como string desde GraphQL y como
          // número desde los modelos. Comparar por valor evita el mismo bug
          // que ya apareció con la sucursal 0.
          const porSucursal = new Map<string, number>();
          for (const fila of filas ?? []) {
            porSucursal.set(String(fila.sucursalId), fila.cantidad ?? 0);
          }
          return porSucursal;
        }),
      );
  }

  /** Existencia en una sucursal. */
  stock(productoId: number, sucursalId: number): Observable<number> {
    return this.datos
      .consultar<number>(this.stockGQL, { proId: productoId, sucId: sucursalId })
      .pipe(map((valor) => valor ?? 0));
  }

  detalle(id: number): Observable<Producto> {
    return this.datos.porId<Producto>(this.porIdGQL, id);
  }

  // ───────────────────────────────────────────────────────────── Interno ──

  /**
   * Prueba los códigos **en orden** y se queda con el primero que resuelve.
   *
   * `concatMap` y no `mergeMap`: el orden de los candidatos es la prioridad.
   * Lanzarlos en paralelo devolvería el que conteste primero, que no es
   * necesariamente el más específico.
   */
  private primerProductoDe(codigos: string[]): Observable<Producto | null> {
    if (codigos.length === 0) {
      return of(null);
    }
    return from(codigos).pipe(
      concatMap((codigo) =>
        this.datos.consultar<Producto>(this.porCodigoGQL, { texto: codigo }).pipe(
          take(1),
          map((producto) => producto ?? null),
          // Un código que no existe no es un error de la búsqueda: se sigue
          // con el siguiente candidato.
          catchError(() => of(null)),
        ),
      ),
      filter((producto): producto is Producto => producto != null),
      take(1),
      defaultIfEmpty(null),
    );
  }

  private pesablePorCodigoInterno(
    codigoInterno: string,
    peso: number,
  ): Observable<ResultadoPesable | null> {
    return this.datos.consultar<Codigo[]>(this.codigoGQL, { texto: codigoInterno }).pipe(
      map((codigos) => {
        if (!codigos?.length) {
          return null;
        }
        const entrada = codigos.find((c) => c.presentacion) ?? codigos[0];
        const presentacion = entrada?.presentacion;
        const producto = presentacion?.producto;
        if (!presentacion || !producto) {
          return null;
        }
        return { producto, presentacion, peso };
      }),
      catchError(() => of(null)),
    );
  }

  /**
   * La búsqueda por texto devuelve productos sin presentaciones —la query es
   * liviana a propósito—, así que el detalle se pide aparte cuando hace falta.
   */
  private conPresentaciones(producto: Producto): Observable<Producto> {
    if (tienePresentaciones(producto) || producto?.id == null) {
      return of(producto);
    }
    return this.detalle(producto.id).pipe(
      map((completo) => completo ?? producto),
      catchError(() => of(producto)),
    );
  }

  private buscarPorTexto(texto: string, offset: number): Observable<Producto[]> {
    return this.datos.consultar<Producto[]>(this.buscarGQL, { texto, offset }).pipe(
      take(1),
      map((lista) => lista ?? []),
      catchError(() => of([])),
    );
  }
}
