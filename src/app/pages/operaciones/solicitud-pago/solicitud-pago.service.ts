import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { FormaPago } from 'src/app/domains/forma-pago/forma-pago.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { NotaRecepcion } from 'src/app/domains/pedidos/recepcion.model';
import {
  DatosInicialesSolicitudPago,
  SolicitudPago,
  SolicitudPagoEstado,
  SolicitudPagoInput,
} from 'src/app/domains/pedidos/solicitud-pago.model';
import { Proveedor } from 'src/app/domains/personas/proveedor.model';
import { DatosInicialesPorRecepcionGQL } from 'src/app/graphql/operaciones/solicitud-pago/datosInicialesPorRecepcion';
import { FormasPagoGQL } from 'src/app/graphql/operaciones/solicitud-pago/formasPago';
import { GuardarSolicitudPagoGQL } from 'src/app/graphql/operaciones/solicitud-pago/guardarSolicitudPago';
import { NotaDisponibleParaPagoGQL } from 'src/app/graphql/operaciones/solicitud-pago/notaDisponibleParaPago';
import { SolicitudPagoPdfGQL } from 'src/app/graphql/operaciones/solicitud-pago/solicitudPagoPdf';
import { SolicitudPagoPorIdGQL } from 'src/app/graphql/operaciones/solicitud-pago/solicitudPagoPorId';
import { SolicitudesPagoPaginadasGQL } from 'src/app/graphql/operaciones/solicitud-pago/solicitudesPagoPaginadas';
import { ProveedorPorIdGQL } from 'src/app/graphql/personas/proveedor/proveedorPorId';
import { ProveedoresPorTextoGQL } from 'src/app/graphql/personas/proveedor/proveedoresPorTexto';

/** Cuántas formas de pago se traen. Es un catálogo chico y estable. */
const FORMAS_PAGO_MAXIMO = 200;

/**
 * Solicitud de pago a proveedor.
 *
 * ⚠️ **El monto lo calcula el backend.** Se manda el que exige el esquema,
 * pero la cabecera se recalcula allá descontando rechazos y convirtiendo
 * moneda. Lo que devuelve el servidor es lo único que se muestra como monto
 * de la solicitud. Ver la regla 6 del repo.
 *
 * ⚠️ **No hay alta de pagos acá.** `Pago` es del desktop; de él solo se lee
 * el estado dentro de la solicitud.
 */
@Injectable({ providedIn: 'root' })
export class SolicitudPagoService {
  private readonly datos = inject(DatosService);
  private readonly listaGQL = inject(SolicitudesPagoPaginadasGQL);
  private readonly porIdGQL = inject(SolicitudPagoPorIdGQL);
  private readonly notaGQL = inject(NotaDisponibleParaPagoGQL);
  private readonly inicialesGQL = inject(DatosInicialesPorRecepcionGQL);
  private readonly formasPagoGQL = inject(FormasPagoGQL);
  private readonly guardarGQL = inject(GuardarSolicitudPagoGQL);
  private readonly pdfGQL = inject(SolicitudPagoPdfGQL);
  private readonly proveedoresGQL = inject(ProveedoresPorTextoGQL);
  private readonly proveedorGQL = inject(ProveedorPorIdGQL);

  // ────────────────────────────────────────────────────────────── Lecturas ──

  lista(
    page = 0,
    size = 10,
    filtros: { proveedorId?: number | null; estado?: SolicitudPagoEstado | null } = {},
  ): Observable<PageInfo<SolicitudPago>> {
    return this.datos.consultar<PageInfo<SolicitudPago>>(this.listaGQL, {
      page,
      size,
      // `undefined` deja la variable fuera del pedido; `null` la manda vacía.
      // El resolver trata ambos igual, pero mandar solo lo que se filtra hace
      // legible la operación en las herramientas de red.
      proveedorId: filtros.proveedorId ?? undefined,
      estado: filtros.estado ?? undefined,
    });
  }

  porId(id: number): Observable<SolicitudPago> {
    return this.datos.porId<SolicitudPago>(this.porIdGQL, id);
  }

  /**
   * La nota de ese número que todavía admite pago.
   *
   * ⚠️ **Devuelve `null` sin error cuando no hay ninguna elegible**, y eso
   * cubre cuatro casos distintos: no existe, no está en `RECEPCION_COMPLETA`,
   * ya está pagada, o ya pertenece a otra solicitud. La pantalla no puede
   * distinguirlos —el backend no lo dice— así que el aviso los nombra a todos.
   */
  notaDisponible(numero: number, proveedorId: number): Observable<NotaRecepcion | null> {
    return this.datos
      .consultar<NotaRecepcion | null>(
        this.notaGQL,
        { numero, proveedorId },
        { notificarError: false },
      )
      .pipe(map((nota) => nota ?? null));
  }

  /** Notas y sugerencias precargadas desde una recepción finalizada. */
  datosInicialesPorRecepcion(recepcionId: number): Observable<DatosInicialesSolicitudPago> {
    return this.datos.consultar<DatosInicialesSolicitudPago>(this.inicialesGQL, {
      recepcionMercaderiaId: recepcionId,
    });
  }

  formasPago(): Observable<FormaPago[]> {
    return this.datos
      .consultar<FormaPago[]>(
        this.formasPagoGQL,
        { page: 0, size: FORMAS_PAGO_MAXIMO },
        { mostrarCarga: false },
      )
      .pipe(map((lista) => lista ?? []));
  }

  /**
   * Un proveedor por id, para poder nombrarlo cuando llega por la URL.
   *
   * No notifica el error: si falla, la pantalla sigue andando con el id —lo
   * único que necesita para guardar— y no tiene sentido interrumpir al
   * operador por un nombre.
   */
  proveedorPorId(id: number): Observable<Proveedor> {
    return this.datos.porId<Proveedor>(this.proveedorGQL, id, undefined, {
      mostrarCarga: false,
      notificarError: false,
    });
  }

  proveedores(texto: string, page = 0, size = 10): Observable<PageInfo<Proveedor>> {
    return this.datos.consultar<PageInfo<Proveedor>>(this.proveedoresGQL, {
      texto: (texto ?? '').toUpperCase(),
      page,
      size,
    });
  }

  /**
   * El PDF de la constancia, en base64.
   *
   * Es una `mutation` en el esquema aunque no escriba nada — así lo definió
   * el central para todas las impresiones. No lleva mensaje de éxito: el
   * resultado visible es el PDF abriéndose.
   */
  pdf(solicitudPagoId: number): Observable<string> {
    return this.datos.mutar<string>(this.pdfGQL, { solicitudPagoId });
  }

  // ───────────────────────────────────────────────────────────── Escrituras ──

  /**
   * Crea la solicitud.
   *
   * El backend le pone el número (`SP-000001`), la fecha, el estado
   * `PENDIENTE` y el monto real. Todo lo demás sale de acá.
   *
   * ⚠️ **Valida que las notas sean del mismo proveedor** y tira si no. Como la
   * pantalla busca las notas por proveedor, solo puede pasar si el proveedor
   * se cambió después de cargarlas — por eso cambiarlo limpia la lista.
   */
  crear(input: SolicitudPagoInput): Observable<SolicitudPago> {
    return this.datos.mutar<SolicitudPago>(this.guardarGQL, { entity: input });
  }
}
