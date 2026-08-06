import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import {
  ConstanciaRecepcionPdf,
  MetodoVerificacion,
  NotaRecepcion,
  NotaRecepcionItem,
  PedidoRecepcionProductoDto,
  PedidoRecepcionProductoEstado,
  RecepcionMercaderia,
} from 'src/app/domains/pedidos/recepcion.model';
import { Proveedor } from 'src/app/domains/personas/proveedor.model';
import { MonedasGQL } from 'src/app/graphql/operaciones/moneda/monedas';
import { ConstanciaRecepcionPdfGQL } from 'src/app/graphql/operaciones/recepcion/constanciaRecepcionPdf';
import { DeshacerVerificacionGQL } from 'src/app/graphql/operaciones/recepcion/deshacerVerificacion';
import { FinalizarRecepcionGQL } from 'src/app/graphql/operaciones/recepcion/finalizarRecepcion';
import { IniciarRecepcionGQL } from 'src/app/graphql/operaciones/recepcion/iniciarRecepcion';
import { NotaItemsPorNotaGQL } from 'src/app/graphql/operaciones/recepcion/notaItemsPorNota';
import { NotasPorProveedorYNumeroGQL } from 'src/app/graphql/operaciones/recepcion/notasPorProveedorYNumero';
import { ProductoPorRecepcionYProductoGQL } from 'src/app/graphql/operaciones/recepcion/productoPorRecepcionYProducto';
import { ProductosPorRecepcionGQL } from 'src/app/graphql/operaciones/recepcion/productosPorRecepcion';
import { ReabrirRecepcionGQL } from 'src/app/graphql/operaciones/recepcion/reabrirRecepcion';
import { RecepcionActivaPorNotaYSucursalGQL } from 'src/app/graphql/operaciones/recepcion/recepcionActivaPorNotaYSucursal';
import { RecepcionPorIdGQL } from 'src/app/graphql/operaciones/recepcion/recepcionPorId';
import { RecepcionesConFiltrosGQL } from 'src/app/graphql/operaciones/recepcion/recepcionesConFiltros';
import { VerificarProductoGQL } from 'src/app/graphql/operaciones/recepcion/verificarProducto';
import { ProveedoresPorTextoGQL } from 'src/app/graphql/personas/proveedor/proveedoresPorTexto';

/** Lo que se manda al verificar un producto. */
export interface VerificacionProducto {
  recepcionId: number;
  productoId: number;
  cantidadRecibida: number;
  cantidadRechazada: number;
  /** A qué línea de nota se imputa el rechazo. Obligatorio si hay rechazo. */
  notaRecepcionItemIdParaRechazo?: number | null;
  motivoRechazo?: string | null;
  metodoVerificacion: MetodoVerificacion;
  usuarioId: number;
}

/**
 * Recepción de mercadería.
 *
 * ⚠️ **El backend distribuye las cantidades entre las notas.** Se manda el
 * total verificado del producto y él lo reparte. Por eso el rechazo lleva
 * `notaRecepcionItemIdParaRechazo`: a quién se le reclama la falta no se
 * puede inferir del total.
 */
@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private readonly datos = inject(DatosService);
  private readonly listaGQL = inject(RecepcionesConFiltrosGQL);
  private readonly porIdGQL = inject(RecepcionPorIdGQL);
  private readonly productosGQL = inject(ProductosPorRecepcionGQL);
  private readonly productoGQL = inject(ProductoPorRecepcionYProductoGQL);
  private readonly notaItemsGQL = inject(NotaItemsPorNotaGQL);
  private readonly notasGQL = inject(NotasPorProveedorYNumeroGQL);
  private readonly activaGQL = inject(RecepcionActivaPorNotaYSucursalGQL);
  private readonly iniciarGQL = inject(IniciarRecepcionGQL);
  private readonly verificarGQL = inject(VerificarProductoGQL);
  private readonly deshacerGQL = inject(DeshacerVerificacionGQL);
  private readonly finalizarGQL = inject(FinalizarRecepcionGQL);
  private readonly reabrirGQL = inject(ReabrirRecepcionGQL);
  private readonly constanciaGQL = inject(ConstanciaRecepcionPdfGQL);
  private readonly proveedoresGQL = inject(ProveedoresPorTextoGQL);
  private readonly monedasGQL = inject(MonedasGQL);

  // ────────────────────────────────────────────────────────────── Lecturas ──

  delUsuario(usuarioId: number, page = 0, size = 10): Observable<PageInfo<RecepcionMercaderia>> {
    return this.datos.consultar<PageInfo<RecepcionMercaderia>>(this.listaGQL, {
      usuarioId,
      page,
      size,
    });
  }

  porId(id: number): Observable<RecepcionMercaderia> {
    return this.datos.porId<RecepcionMercaderia>(this.porIdGQL, id);
  }

  productos(
    recepcionId: number,
    estado: PedidoRecepcionProductoEstado | null,
    page = 0,
    size = 10,
  ): Observable<PageInfo<PedidoRecepcionProductoDto>> {
    return this.datos.consultar<PageInfo<PedidoRecepcionProductoDto>>(this.productosGQL, {
      recepcionMercaderiaId: recepcionId,
      estado,
      page,
      size,
    });
  }

  producto(
    recepcionId: number,
    productoId: number,
    estado: PedidoRecepcionProductoEstado | null = null,
  ): Observable<PedidoRecepcionProductoDto> {
    return this.datos.consultar<PedidoRecepcionProductoDto>(this.productoGQL, {
      recepcionMercaderiaId: recepcionId,
      productoId,
      estado,
    });
  }

  /**
   * Las líneas de nota de un producto dentro de una recepción.
   *
   * Es la lista que se le muestra al operador para elegir a qué nota imputar
   * un rechazo.
   *
   * ⚠️ **Requiere una consulta por nota**: no hay operación que las traiga
   * de una. `frc-mobile` las pedía en serie dentro de un `for` —16 requests
   * secuenciales con 15 notas—; acá salen en paralelo con `forkJoin`.
   */
  itemsDeProducto(recepcionId: number, productoId: number): Observable<NotaRecepcionItem[]> {
    return this.porId(recepcionId).pipe(
      switchMap((recepcion) => {
        const notas = (recepcion?.notas ?? []).filter((n) => n?.id != null);
        if (notas.length === 0) {
          return of([] as NotaRecepcionItem[]);
        }
        const consultas = notas.map((nota) =>
          this.datos
            .porId<NotaRecepcionItem[]>(this.notaItemsGQL, nota.id as number, undefined, {
              mostrarCarga: false,
              notificarError: false,
            })
            .pipe(map((items) => items ?? [])),
        );
        return forkJoin(consultas).pipe(
          map((porNota) =>
            porNota
              .flat()
              .filter((item) => String(item?.producto?.id) === String(productoId)),
          ),
        );
      }),
    );
  }

  /**
   * Notas de un proveedor con ese número.
   *
   * Puede devolver varias: el número de nota no es único entre sucursales ni
   * entre timbrados.
   */
  notasPorNumero(
    proveedorId: number,
    numero: number,
    sucursalId: number,
  ): Observable<NotaRecepcion[]> {
    return this.datos
      .consultar<NotaRecepcion[]>(this.notasGQL, { id: proveedorId, numero, sucursalId })
      .pipe(map((notas) => notas ?? []));
  }

  /**
   * La recepción activa —o ya finalizada— de una nota en una sucursal.
   *
   * ⚠️ **Se pregunta por nota + sucursal.** La misma nota puede estar en
   * recepción en dos sucursales a la vez y el backend no lo impide.
   */
  recepcionActiva(notaId: number, sucursalId: number): Observable<RecepcionMercaderia | null> {
    return this.datos.consultar<RecepcionMercaderia>(this.activaGQL, {
      notaRecepcionId: notaId,
      sucursalRecepcionId: sucursalId,
    });
  }

  proveedores(texto: string, page = 0, size = 10): Observable<PageInfo<Proveedor>> {
    return this.datos.consultar<PageInfo<Proveedor>>(this.proveedoresGQL, {
      texto: (texto ?? '').toUpperCase(),
      page,
      size,
    });
  }

  monedas(): Observable<Moneda[]> {
    return this.datos
      .consultar<Moneda[]>(this.monedasGQL, undefined, { mostrarCarga: false })
      .pipe(map((lista) => lista ?? []));
  }

  constancia(recepcionId: number): Observable<ConstanciaRecepcionPdf> {
    return this.datos.consultar<ConstanciaRecepcionPdf>(this.constanciaGQL, { recepcionId });
  }

  // ───────────────────────────────────────────────────────────── Escrituras ──

  /**
   * Crea la recepción, le asocia las notas y pre-crea los ítems a verificar.
   *
   * ⚠️ **La cotización no tiene default acá.** En `frc-mobile` caía a `1.0`
   * en silencio, de modo que una nota en dólares se cargaba como si fuera en
   * guaraníes. La pantalla la pide cuando la moneda no es la local.
   */
  iniciar(datos: {
    sucursalId: number;
    notaRecepcionIds: number[];
    proveedorId: number;
    monedaId: number;
    usuarioId: number;
    cotizacion: number;
  }): Observable<RecepcionMercaderia> {
    return this.datos.mutar<RecepcionMercaderia>(this.iniciarGQL, { ...datos });
  }

  verificar(v: VerificacionProducto): Observable<boolean> {
    return this.datos.mutar<boolean>(this.verificarGQL, {
      recepcionMercaderiaId: v.recepcionId,
      productoId: v.productoId,
      cantidadRecibida: v.cantidadRecibida,
      cantidadRechazada: v.cantidadRechazada ?? 0,
      notaRecepcionItemIdParaRechazo: v.notaRecepcionItemIdParaRechazo ?? null,
      motivoRechazo: v.motivoRechazo ?? null,
      metodoVerificacion: v.metodoVerificacion,
      usuarioId: v.usuarioId,
    });
  }

  /**
   * Revierte la verificación de un producto entero.
   *
   * ⚠️ **Por producto, no por línea.** Como el reparto entre notas lo hizo el
   * backend, revertir una sola línea dejaría la distribución inconsistente.
   */
  deshacer(recepcionId: number, productoId: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.deshacerGQL, {
      recepcionMercaderiaId: recepcionId,
      productoId,
    });
  }

  /**
   * Cierra la recepción.
   *
   * `motivoRechazo` se aplica a **todo lo que quedó sin verificar**: al
   * finalizar, lo pendiente pasa a rechazado con ese motivo.
   */
  finalizar(recepcionId: number, motivoRechazo?: string | null): Observable<RecepcionMercaderia> {
    return this.datos.mutar<RecepcionMercaderia>(this.finalizarGQL, {
      recepcionId,
      rechazoPendientes: motivoRechazo ? { motivoRechazo } : null,
    });
  }

  /** `FINALIZADA` → `EN_PROCESO`. El backend rechaza cualquier otro estado. */
  reabrir(recepcionId: number): Observable<RecepcionMercaderia> {
    return this.datos.mutar<RecepcionMercaderia>(this.reabrirGQL, { recepcionId });
  }
}
