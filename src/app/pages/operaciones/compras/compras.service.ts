import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import type {
  CompraNota,
  CompraPedido,
  CompraPedidoResumen,
  FacturaProveedor,
  PedidosParaFactura,
  ResumenFinalizarNotas,
} from 'src/app/domains/compras/compras.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { ConfirmarFacturaGQL } from 'src/app/graphql/operaciones/compras/confirmarFactura';
import { EliminarNotaComprasGQL } from 'src/app/graphql/operaciones/compras/eliminarNotaCompras';
import { FacturaProveedorGQL } from 'src/app/graphql/operaciones/compras/facturaProveedor';
import { FinalizarRecepcionNotasGQL } from 'src/app/graphql/operaciones/compras/finalizarRecepcionNotas';
import { LeerFacturaProveedorGQL } from 'src/app/graphql/operaciones/compras/leerFacturaProveedor';
import { ObservarRenglonFacturaGQL } from 'src/app/graphql/operaciones/compras/observarRenglonFactura';
import { PedidoComprasGQL } from 'src/app/graphql/operaciones/compras/pedidoCompras';
import { PedidosEsperandoFacturaGQL } from 'src/app/graphql/operaciones/compras/pedidosEsperandoFactura';
import { PedidosParaFacturaGQL } from 'src/app/graphql/operaciones/compras/pedidosParaFactura';
import { ResumenFinalizarNotasGQL } from 'src/app/graphql/operaciones/compras/resumenFinalizarNotas';
import { VincularRenglonFacturaGQL } from 'src/app/graphql/operaciones/compras/vincularRenglonFactura';

/**
 * Compras: la factura del proveedor cargada al pedido desde el celular.
 *
 * ⚠️ **Solo transporta.** El cruce con el pedido, las diferencias, los avisos
 * de IVA, qué exige observación y si se puede confirmar lo decide el central;
 * la pantalla muestra lo que vuelve. Por eso cada escritura sobre la factura
 * devuelve la factura entera recalculada.
 */
@Injectable({ providedIn: 'root' })
export class ComprasService {
  private readonly datos = inject(DatosService);
  private readonly pedidosGQL = inject(PedidosEsperandoFacturaGQL);
  private readonly pedidoGQL = inject(PedidoComprasGQL);
  private readonly paraFacturaGQL = inject(PedidosParaFacturaGQL);
  private readonly facturaGQL = inject(FacturaProveedorGQL);
  private readonly resumenGQL = inject(ResumenFinalizarNotasGQL);
  private readonly leerGQL = inject(LeerFacturaProveedorGQL);
  private readonly vincularGQL = inject(VincularRenglonFacturaGQL);
  private readonly observarGQL = inject(ObservarRenglonFacturaGQL);
  private readonly confirmarGQL = inject(ConfirmarFacturaGQL);
  private readonly eliminarGQL = inject(EliminarNotaComprasGQL);
  private readonly finalizarGQL = inject(FinalizarRecepcionNotasGQL);

  // ────────────────────────────────────────────────────────────── Lecturas ──

  pedidos(texto: string, page = 0, size = 20): Observable<PageInfo<CompraPedidoResumen>> {
    return this.datos.consultar<PageInfo<CompraPedidoResumen>>(
      this.pedidosGQL,
      { texto: texto.trim() || null, proveedorId: null, page, size },
    );
  }

  pedido(pedidoId: number): Observable<CompraPedido> {
    return this.datos.consultar<CompraPedido>(
      this.pedidoGQL,
      { pedidoId },
    );
  }

  /** De qué proveedor es la factura escaneada y qué pedidos suyos la esperan. */
  pedidosParaFactura(qr: string): Observable<PedidosParaFactura> {
    return this.datos.consultar<PedidosParaFactura>(
      this.paraFacturaGQL,
      { qr },
    );
  }

  factura(documentoId: number, pedidoId: number): Observable<FacturaProveedor> {
    return this.datos.consultar<FacturaProveedor>(
      this.facturaGQL,
      { id: documentoId, pedidoId },
    );
  }

  resumenFinalizar(pedidoId: number): Observable<ResumenFinalizarNotas> {
    return this.datos.consultar<ResumenFinalizarNotas>(
      this.resumenGQL,
      { pedidoId },
    );
  }

  // ───────────────────────────────────────────────────────────── Escrituras ──

  /**
   * Trae la factura de SIFEN (o de la caché del central) y la cruza con el
   * pedido. Es una mutation porque guarda la factura y el cruce.
   */
  leerFactura(pedidoId: number, qr: string): Observable<FacturaProveedor> {
    return this.datos.mutar<FacturaProveedor>(this.leerGQL, { pedidoId, qr });
  }

  vincularRenglon(
    renglonId: number,
    presentacionId: number,
    factor: number | null,
    recordar: boolean,
  ): Observable<FacturaProveedor> {
    return this.datos.mutar<FacturaProveedor>(
      this.vincularGQL,
      { renglonId, presentacionId, factor, recordar },
      { mensajeExito: 'Producto vinculado' },
    );
  }

  observarRenglon(renglonId: number, observacion: string | null): Observable<FacturaProveedor> {
    return this.datos.mutar<FacturaProveedor>(this.observarGQL, { renglonId, observacion });
  }

  confirmarFactura(documentoId: number, pedidoId: number): Observable<CompraNota> {
    return this.datos.mutar<CompraNota>(
      this.confirmarGQL,
      { documentoId, pedidoId },
      { mensajeExito: 'Factura cargada al pedido' },
    );
  }

  eliminarNota(notaId: number): Observable<CompraPedido> {
    return this.datos.mutar<CompraPedido>(
      this.eliminarGQL,
      { notaId },
      { mensajeExito: 'Nota eliminada' },
    );
  }

  finalizar(pedidoId: number): Observable<CompraPedido> {
    return this.datos.mutar<CompraPedido>(
      this.finalizarGQL,
      { pedidoId },
      { mensajeExito: 'Conciliación finalizada: el pedido pasa a recepción de mercadería' },
    );
  }
}
