import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { DatosService, OpcionesOperacion } from 'src/app/core/graphql/datos.service';
import { Cliente } from 'src/app/domains/cliente/cliente.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { EstadoVentaCredito, VentaCredito } from 'src/app/domains/venta-credito/venta-credito.model';
import { Venta } from 'src/app/domains/venta/venta.model';
import { VentaCreditoPorClienteGQL } from 'src/app/graphql/financiero/venta-credito/venta-credito-por-cliente-id';
import { VentaCreditoPorClientePageGQL } from 'src/app/graphql/financiero/venta-credito/venta-credito-por-cliente-id-page';
import { VentaCreditoQrAuthGQL } from 'src/app/graphql/financiero/venta-credito/venta-credito-qr-auth';
import { VentaPorIdGQL } from 'src/app/graphql/operaciones/venta/graphql/ventaPorId';
import { ClientesSearchByPersonaIdGQL } from 'src/app/graphql/personas/cliente/graphql/clienteSearchByPersonaId';

/** Convenios por página. Un mes de compras entra de sobra en la primera. */
export const TAMANO_PAGINA_CONVENIOS = 10;

/** Estado del crédito por convenio, listo para mostrar. */
export interface ResumenCredito {
  /** Tope que le asignó la empresa. */
  limite: number;
  /** Suma de los convenios abiertos. */
  utilizado: number;
  /** Lo que le queda. Puede ser negativo si se pasó del tope. */
  disponible: number;
  /** Del 0 al 100, para la barra. Topado arriba: una barra no pasa del 100 %. */
  porcentaje: number;
}

/**
 * Arma el resumen a partir de los dos números que **emite el backend**: el
 * tope del cliente y sus convenios abiertos.
 *
 * Vive acá y no en cada pantalla porque lo consumen dos —el resumen de
 * Inicio y la pantalla de Mis finanzas— y tienen que coincidir: dos restas
 * escritas por separado se desincronizan en cuanto una de las dos aprende
 * algo que la otra no.
 *
 * No contradice la regla 6 del proyecto: no calcula dinero, suma totales ya
 * emitidos para poder mostrarlos juntos.
 */
export function resumirCredito(
  limite: number,
  abiertos: readonly VentaCredito[] | null,
): ResumenCredito {
  const utilizado = (abiertos ?? []).reduce((suma, c) => suma + (c.valorTotal ?? 0), 0);
  // Sin límite no hay porcentaje que mostrar: dividir por cero daría
  // Infinity y la barra saldría llena, que es justo lo contrario de lo que
  // pasa —un cliente sin tope asignado no gastó de más—.
  const porcentaje = limite > 0 ? Math.min(100, (utilizado / limite) * 100) : 0;
  return { limite, utilizado, disponible: limite - utilizado, porcentaje };
}

/**
 * Compras a crédito por convenio del propio funcionario.
 *
 * El circuito: el empleado compra en la empresa firmando un convenio, y el
 * monto se le descuenta en la liquidación mensual o en el finiquito. Esta
 * pantalla es la vista del empleado sobre esa deuda; el cobro vive en el
 * módulo RRHH del central.
 *
 * ⚠️ **El funcionario se resuelve por `persona`, no por usuario.** El
 * convenio cuelga de un `Cliente`, y el vínculo con la cuenta de login es
 * `usuario.persona_id == cliente.persona_id`. Un usuario sin cliente
 * asociado simplemente no tiene convenios: es un caso normal, no un error.
 */
@Injectable({ providedIn: 'root' })
export class MisFinanzasService {
  private readonly datos = inject(DatosService);
  private readonly clienteGQL = inject(ClientesSearchByPersonaIdGQL);
  private readonly paginaGQL = inject(VentaCreditoPorClientePageGQL);
  private readonly todosGQL = inject(VentaCreditoPorClienteGQL);
  private readonly ventaGQL = inject(VentaPorIdGQL);
  private readonly qrAuthGQL = inject(VentaCreditoQrAuthGQL);

  /**
   * Cliente del funcionario.
   *
   * Emite `undefined` si la persona no está registrada como cliente. Es un
   * caso legítimo —no todo empleado compra por convenio—, así que el
   * llamador lo trata como «sin convenios», no como error.
   */
  clientePorPersona(personaId: number): Observable<Cliente> {
    return this.datos.porId<Cliente>(this.clienteGQL, personaId);
  }

  conveniosPagina(
    clienteId: number,
    estado: EstadoVentaCredito | null,
    page: number,
    size = TAMANO_PAGINA_CONVENIOS,
  ): Observable<PageInfo<VentaCredito>> {
    return this.datos.consultar<PageInfo<VentaCredito>>(this.paginaGQL, {
      id: clienteId,
      estado,
      page,
      size,
    });
  }

  /**
   * Todos los convenios abiertos, sin paginar, para totalizar lo utilizado.
   *
   * ⚠️ **No se puede sacar el total de la página.** `VentaCreditoPage` trae
   * la cantidad de elementos pero no la suma de `valorTotal`, así que sumar
   * lo que muestra la página daría el total de esa página y no la deuda.
   * Se acepta traer la lista completa porque los convenios abiertos de un
   * funcionario se saldan cada mes: son decenas, no miles. Si algún día deja
   * de ser cierto, esto va al backend como un `sum()`.
   */
  conveniosAbiertos(clienteId: number): Observable<VentaCredito[]> {
    return this.datos.consultar<VentaCredito[]>(this.todosGQL, {
      id: clienteId,
      estado: EstadoVentaCredito.ABIERTO,
    });
  }

  /**
   * Resumen del crédito de la persona en sesión, en una sola llamada.
   *
   * Emite `null` cuando la persona no está registrada como cliente: no tiene
   * convenio, así que no hay resumen que mostrar. Es un caso normal —no todo
   * empleado compra por convenio— y el llamador lo trata como «sin crédito»,
   * no como error.
   *
   * Encadena las dos consultas en vez de exponerlas sueltas porque la
   * segunda necesita el `id` de cliente que devuelve la primera, y esa
   * dependencia se escribía igual en cada pantalla que la quería.
   */
  resumenCredito(
    personaId: number,
    opciones?: OpcionesOperacion,
  ): Observable<ResumenCredito | null> {
    return this.datos.porId<Cliente>(this.clienteGQL, personaId, undefined, opciones).pipe(
      switchMap((cliente) => {
        if (cliente?.id == null) {
          return of(null);
        }
        return this.datos
          .consultar<VentaCredito[]>(
            this.todosGQL,
            { id: cliente.id, estado: EstadoVentaCredito.ABIERTO },
            opciones,
          )
          .pipe(map((abiertos) => resumirCredito(cliente.credito ?? 0, abiertos)));
      }),
    );
  }

  /** Venta completa, con sus ítems, para el detalle. */
  venta(id: number, sucId: number): Observable<Venta> {
    return this.datos.consultar<Venta>(this.ventaGQL, { id, sucId });
  }

  /**
   * Autoriza una compra a crédito leyendo el QR que muestra la caja.
   *
   * `id` es el **id de la persona**, no el del usuario ni el del cliente:
   * así lo espera `ventaCreditoQrAuth` en el central.
   */
  autorizarPorQr(
    personaId: number,
    timestamp: string,
    sucursalId: number,
    secretKey: string,
  ): Observable<boolean> {
    return this.datos.consultar<boolean>(this.qrAuthGQL, {
      id: personaId,
      timestamp,
      sucursalId,
      secretKey,
    });
  }
}
