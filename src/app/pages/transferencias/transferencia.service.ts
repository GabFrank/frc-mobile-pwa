import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Vehiculo } from 'src/app/domains/gastos/ente.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import type { Persona } from 'src/app/domains/personas/persona.model';
import {
  EtapaTransferencia,
  Transferencia,
  TransferenciaInput,
  TransferenciaItem,
  TransferenciaItemInput,
  VerificarParaTransporteInput,
} from 'src/app/domains/transferencia/transferencia.model';
import { VehiculoSearchPageGQL } from 'src/app/graphql/operaciones/gastos/activosSearchPage';
import { PersonaSearchPageGQL } from 'src/app/graphql/personas/persona/personaSearchPage';
import {
  ConfiguracionTransferencia,
  ConfiguracionTransferenciaGQL,
} from 'src/app/graphql/transferencias/configuracionTransferencia';
import { StockEnOrigenGQL } from 'src/app/graphql/transferencias/stockEnOrigen';
import { AvanzarEtapaGQL } from 'src/app/graphql/transferencias/avanzarEtapa';
import { FinalizarTransferenciaGQL } from 'src/app/graphql/transferencias/finalizarTransferencia';
import { ItemsPorTransferenciaGQL } from 'src/app/graphql/transferencias/itemsPorTransferencia';
import { TransferenciaPorIdGQL } from 'src/app/graphql/transferencias/transferenciaPorId';
import { TransferenciasConFiltrosGQL } from 'src/app/graphql/transferencias/transferenciasConFiltros';
import { SaveTransferenciaGQL } from 'src/app/graphql/transferencias/saveTransferencia';
import { SaveTransferenciaItemGQL } from 'src/app/graphql/transferencias/saveTransferenciaItem';
import { DeleteTransferenciaItemGQL } from 'src/app/graphql/transferencias/deleteTransferenciaItem';
import { DesconfirmarTransferenciaItemGQL } from 'src/app/graphql/transferencias/desconfirmarTransferenciaItem';
import { SolicitarPushGQL } from 'src/app/graphql/notificaciones/solicitarPush';
import { TransferenciaQrEscaneadoGQL } from 'src/app/graphql/transferencias/transferenciaQrEscaneado';
import { VerificarParaTransporteGQL } from 'src/app/graphql/transferencias/verificarParaTransporte';

export interface FiltrosTransferencia {
  sucursalOrigenId?: number;
  sucursalDestinoId?: number;
  estado?: string | null;
  /**
   * Varios estados a la vez.
   *
   * ⚠️ **Estado y etapa son dimensiones distintas**, y para «viene en camino
   * a esta sucursal» hace falta el estado: una transferencia en tránsito
   * puede estar en la etapa `TRANSPORTE_EN_CAMINO` o en
   * `TRANSPORTE_EN_DESTINO`, así que filtrar por una sola etapa deja afuera
   * justo las que ya llegaron y esperan recepción. `frc-mobile` filtra por
   * `TRANSPORTE_EN_CAMINO` y no las ve.
   */
  estados?: string[] | null;
  tipo?: string | null;
  /** ⚠️ **Etapa, no estado.** Son dimensiones distintas. */
  etapa?: EtapaTransferencia | null;
  isOrigen?: boolean | null;
  isDestino?: boolean | null;
  page?: number;
  size?: number;
}

/**
 * Movimiento de mercadería entre sucursales.
 *
 * ⚠️ **La transferencia no crea movimientos de stock.** Son consecuencia del
 * avance de etapa en el backend: salida en origen, entrada en destino.
 */
@Injectable({ providedIn: 'root' })
export class TransferenciaService {
  private readonly datos = inject(DatosService);
  private readonly porIdGQL = inject(TransferenciaPorIdGQL);
  private readonly filtrosGQL = inject(TransferenciasConFiltrosGQL);
  private readonly itemsGQL = inject(ItemsPorTransferenciaGQL);
  private readonly avanzarGQL = inject(AvanzarEtapaGQL);
  private readonly finalizarGQL = inject(FinalizarTransferenciaGQL);
  private readonly guardarGQL = inject(SaveTransferenciaGQL);
  private readonly guardarItemGQL = inject(SaveTransferenciaItemGQL);
  private readonly eliminarItemGQL = inject(DeleteTransferenciaItemGQL);
  private readonly desconfirmarItemGQL = inject(DesconfirmarTransferenciaItemGQL);
  private readonly pushGQL = inject(SolicitarPushGQL);
  private readonly qrEscaneadoGQL = inject(TransferenciaQrEscaneadoGQL);
  private readonly verificarTransporteGQL = inject(VerificarParaTransporteGQL);
  private readonly vehiculosGQL = inject(VehiculoSearchPageGQL);
  private readonly personasGQL = inject(PersonaSearchPageGQL);
  private readonly stockEnOrigenGQL = inject(StockEnOrigenGQL);
  private readonly configuracionGQL = inject(ConfiguracionTransferenciaGQL);

  /**
   * Le avisa al central que se escaneó el QR de esta transferencia.
   *
   * Sirve para que el desktop que lo está mostrando cierre el diálogo solo.
   * Es un aviso, no una operación: va sin spinner ni cartel de error a
   * propósito, porque el operario ya está entrando a la transferencia y un
   * fallo acá no cambia nada de lo que vino a hacer.
   */
  avisarQrEscaneado(id: number, sucursalId: number): Observable<boolean> {
    return this.datos.mutar<boolean>(
      this.qrEscaneadoGQL,
      { id, sucursalId },
      { mostrarCarga: false, notificarError: false },
    );
  }

  porId(id: number): Observable<Transferencia> {
    return this.datos.porId<Transferencia>(this.porIdGQL, id);
  }

  conFiltros(filtros: FiltrosTransferencia = {}): Observable<PageInfo<Transferencia>> {
    return this.datos.consultar<PageInfo<Transferencia>>(this.filtrosGQL, {
      sucursalOrigenId: filtros.sucursalOrigenId ?? null,
      sucursalDestinoId: filtros.sucursalDestinoId ?? null,
      estado: filtros.estado ?? null,
      estados: filtros.estados?.length ? filtros.estados : null,
      tipo: filtros.tipo ?? null,
      etapa: filtros.etapa ?? null,
      isOrigen: filtros.isOrigen ?? null,
      isDestino: filtros.isDestino ?? null,
      creadoDesde: null,
      creadoHasta: null,
      page: filtros.page ?? 0,
      size: filtros.size ?? 10,
    });
  }

  /**
   * ⚠️ **El central devuelve una página, no una lista.** Los ítems vienen en
   * `getContent`; se desenvuelve acá para que las páginas sigan recibiendo un
   * `TransferenciaItem[]` plano.
   *
   * ⚠️ **`producto` no existe en `TransferenciaItem` del central**: cuelga de
   * la presentación. Se copia al ítem para no tocar la vista.
   */
  items(id: number, page = 0, size = 50): Observable<TransferenciaItem[]> {
    return this.datos
      .consultar<{ getContent?: TransferenciaItem[] }>(this.itemsGQL, { id, page, size })
      .pipe(
        map((pagina) =>
          (pagina?.getContent ?? []).map((item) => ({
            // clonar: Apollo congela los resultados y la vista lee `item.producto`
            ...item,
            producto: item.producto ?? item.presentacionPreTransferencia?.producto,
          })),
        ),
      );
  }

  /**
   * Crea la transferencia en borrador.
   *
   * ⚠️ **Solo para el alta y para editar la cabecera.** No sirve para mover
   * el workflow: la etapa se cambia con {@link avanzarEtapa}, que es donde el
   * central valida y genera los movimientos de stock. Un `save` con la etapa
   * cambiada los saltea.
   *
   * ⚠️ **El responsable va en `usuarioPreTransferenciaId`.** El `usuarioId`
   * que completa `DatosService.guardar()` no lo asigna: el central solo mira
   * ese campo. Lo arma `nuevaTransferenciaInput()`.
   */
  crear(input: TransferenciaInput): Observable<Transferencia> {
    return this.datos.guardar<Transferencia>(
      this.guardarGQL,
      input as unknown as Record<string, unknown>,
    );
  }

  /**
   * Quita un ítem del borrador.
   *
   * Borrado real: mientras la transferencia está en creación el renglón
   * todavía no generó ningún movimiento de stock.
   */
  eliminarItem(itemId: number): Observable<boolean> {
    return this.datos.mutar<boolean>(
      this.eliminarItemGQL,
      { id: itemId },
      { mensajeExito: 'Ítem quitado' },
    );
  }

  /**
   * Avanza el workflow.
   *
   * ⚠️ **Es el único camino correcto.** Guardar la transferencia con la etapa
   * cambiada saltea las validaciones y los movimientos de stock que el
   * backend aplica en el avance.
   */
  avanzarEtapa(id: number, etapa: EtapaTransferencia, usuarioId: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.avanzarGQL, { id, etapa, usuarioId });
  }

  /**
   * Pasa a la verificación para transporte con el chofer elegido.
   *
   * ⚠️ **Reemplaza a `avanzarEtapa` solo en este paso.** El responsable que
   * queda es `choferUsuarioId`, no el usuario logueado, y el central crea una
   * hoja de ruta nueva con el vehículo y los acompañantes.
   */
  verificarParaTransporte(input: VerificarParaTransporteInput): Observable<Transferencia> {
    return this.datos.mutar<Transferencia>(this.verificarTransporteGQL, { input }, {
      mensajeExito: 'Chofer asignado, verificando para transporte',
    });
  }

  /** Una página de vehículos para `frc-buscador`. */
  buscarVehiculos(texto: string, pagina: number) {
    return this.pagina<Vehiculo>(this.vehiculosGQL, texto, pagina);
  }

  /** Una página de personas para `frc-buscador`: los acompañantes del chofer. */
  buscarPersonas(texto: string, pagina: number) {
    return this.pagina<Persona>(this.personasGQL, texto, pagina);
  }

  /** ⚠️ `hayMas` sale de `hasNext`: de más, «Cargar más» pide páginas vacías sin fin. */
  private async pagina<T>(
    gql: Query<{ data?: PageInfo<T> }>,
    texto: string,
    pagina: number,
  ): Promise<{ items: T[]; hayMas: boolean }> {
    const page = await firstValueFrom(
      this.datos.consultar<PageInfo<T>>(gql, { texto, page: pagina, size: 20 }, { mostrarCarga: false }),
    );
    return { items: page?.getContent ?? [], hayMas: page?.hasNext === true };
  }

  finalizar(id: number, usuarioId: number): Observable<boolean> {
    return this.datos.mutar<boolean>(this.finalizarGQL, { id, usuarioId });
  }

  /**
   * Guarda lo verificado de un ítem en la etapa en curso.
   *
   * ⚠️ **Es un PATCH: lo que el input no trae, el central lo conserva.**
   * Mandar `null` no borra nada — para vaciar una etapa está
   * {@link desconfirmarItem}. `DatosService.guardar()` completa el
   * `usuarioId`, que el central exige.
   */
  guardarItem(input: TransferenciaItemInput): Observable<TransferenciaItem> {
    return this.datos.guardar<TransferenciaItem>(
      this.guardarItemGQL,
      input as unknown as Record<string, unknown>,
      undefined,
      { mensajeExito: 'Ítem guardado' },
    );
  }

  /**
   * Deshace la verificación de un ítem en una etapa.
   *
   * Vacía las cuatro columnas de esa etapa y desactiva el movimiento de
   * stock que había generado. Solo aplica a las tres etapas de verificación;
   * con cualquier otra el central responde error.
   */
  desconfirmarItem(
    itemId: number,
    etapa: EtapaTransferencia,
    opciones?: { mensajeExito?: string },
  ): Observable<TransferenciaItem> {
    return this.datos.mutar<TransferenciaItem>(
      this.desconfirmarItemGQL,
      { id: itemId, etapa },
      { mensajeExito: opciones?.mensajeExito },
    );
  }

  /**
   * Avisa por push a una persona.
   *
   * ⚠️ **Es `personaId`, no `usuarioId`**: los dispositivos cuelgan de la
   * persona. Y el central lo expone como **query**, no como mutation.
   *
   * Se usa para avisar de un rechazo. Que falle no puede voltear la
   * operación: el rechazo ya quedó guardado, y el aviso es secundario.
   */
  avisarPorPush(personaId: number, titulo: string, mensaje: string): Observable<boolean> {
    return this.datos.consultar<boolean>(
      this.pushGQL,
      { entity: { personaId, titulo, mensaje } },
      { mostrarCarga: false, notificarError: false },
    );
  }

  /**
   * Stock del producto en la sucursal, según el central.
   *
   * ⚠️ **Un error viaja por el canal de error, no como 0.** Un 0 acá dispara
   * el aviso de «stock 0»: devolverlo cuando la consulta falló afirmaría algo
   * que nadie dijo. El llamador no agrega el ítem si esto falla. Un `null` o
   * un valor que no es número también es error, no 0.
   *
   * Sin toast propio (`notificarError: false`): el llamador muestra el único
   * aviso, el específico de «no se agregó».
   */
  stockEnOrigen(productoId: number, sucursalId: number): Observable<number> {
    return this.datos
      .consultar<number>(
        this.stockEnOrigenGQL,
        { id: productoId, sucId: sucursalId },
        { mostrarCarga: true, notificarError: false },
      )
      .pipe(
        map((stock) => {
          if (typeof stock !== 'number' || !Number.isFinite(stock)) {
            throw new Error('El central no devolvió el stock.');
          }
          return stock;
        }),
      );
  }

  /**
   * `true` si la configuración de transferencias permite cargar con stock
   * negativo. Si el central no devuelve la configuración es error: no se
   * asume que «no lo permite».
   */
  permiteStockNegativo(): Observable<boolean> {
    return this.datos
      .consultar<ConfiguracionTransferencia>(this.configuracionGQL, undefined, {
        mostrarCarga: true,
        notificarError: false,
      })
      .pipe(
        map((config) => {
          if (config == null) {
            throw new Error('El central no devolvió la configuración de transferencias.');
          }
          return config.permitirStockNegativo === true;
        }),
      );
  }
}
