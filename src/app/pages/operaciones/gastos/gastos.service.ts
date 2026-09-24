import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { Query } from 'src/app/core/graphql/gql-base';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { tipoEnteDesdeModuloPadre } from 'src/app/domains/gastos/tipo-gasto.reglas';
import { Ente, Equipo, Inmueble, Mueble, Vehiculo } from 'src/app/domains/gastos/ente.model';
import {
  ConfirmarRetiroInput,
  PreGasto,
  PreGastoInput,
  TipoGasto,
} from 'src/app/domains/gastos/pre-gasto.model';
import { FormaPago } from 'src/app/domains/forma-pago/forma-pago.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { Persona } from 'src/app/domains/personas/persona.model';
import { Proveedor } from 'src/app/domains/personas/proveedor.model';
import {
  EquipoSearchPageGQL,
  InmuebleSearchPageGQL,
  MuebleSearchPageGQL,
  VehiculoSearchPageGQL,
} from 'src/app/graphql/operaciones/gastos/activosSearchPage';
import { ConfirmarRetiroGQL } from 'src/app/graphql/operaciones/gastos/confirmarRetiro';
import { EnteByReferenciaIdGQL } from 'src/app/graphql/operaciones/gastos/enteByReferenciaId';
import {
  EnteFinancialSummaryGQL,
  ResumenFinancieroEnte,
} from 'src/app/graphql/operaciones/gastos/enteFinancialSummary';
import { FilterPreGastosGQL } from 'src/app/graphql/operaciones/gastos/filterPreGastos';
import { PreGastoPorIdGQL } from 'src/app/graphql/operaciones/gastos/preGastoPorId';
import { SaveEnteGQL } from 'src/app/graphql/operaciones/gastos/saveEnte';
import {
  GastoRendicion,
  SaveGastoRendicionGQL,
} from 'src/app/graphql/operaciones/gastos/saveGastoRendicion';
import { PreGastoCreado, SavePreGastoGQL } from 'src/app/graphql/operaciones/gastos/savePreGasto';
import { TipoGastosGQL } from 'src/app/graphql/operaciones/gastos/tipoGastos';
import { MonedasGQL } from 'src/app/graphql/operaciones/moneda/monedas';
import { FormasPagoGQL } from 'src/app/graphql/operaciones/solicitud-pago/formasPago';
import { PersonaSearchPageGQL } from 'src/app/graphql/personas/persona/personaSearchPage';
import { ProveedoresPorTextoGQL } from 'src/app/graphql/personas/proveedor/proveedoresPorTexto';

export interface FiltrosPreGasto {
  cajaId?: number;
  estado?: string | null;
  estados?: string[];
  inicio?: string;
  fin?: string;
  page?: number;
  size?: number;
}

/**
 * Caja chica: solicitud → retiro con QR → rendición → devolución de vuelto.
 *
 * ⚠️ **Los estados los presenta el backend.** `estadoEtiqueta`, `estadoColor`
 * y `estadoIcono` vienen calculados; este servicio no los toca. Es el único
 * módulo del repo que hace esto, y es el patrón correcto: un estado nuevo en
 * el central aparece en la UI sin tocar el cliente.
 */
@Injectable({ providedIn: 'root' })
export class GastosService {
  private readonly datos = inject(DatosService);
  private readonly porIdGQL = inject(PreGastoPorIdGQL);
  private readonly filtrarGQL = inject(FilterPreGastosGQL);
  private readonly retiroGQL = inject(ConfirmarRetiroGQL);
  private readonly rendicionGQL = inject(SaveGastoRendicionGQL);
  private readonly tipoGastosGQL = inject(TipoGastosGQL);
  private readonly savePreGastoGQL = inject(SavePreGastoGQL);
  private readonly enteByReferenciaGQL = inject(EnteByReferenciaIdGQL);
  private readonly saveEnteGQL = inject(SaveEnteGQL);
  private readonly resumenEnteGQL = inject(EnteFinancialSummaryGQL);
  private readonly personasGQL = inject(PersonaSearchPageGQL);
  private readonly proveedoresGQL = inject(ProveedoresPorTextoGQL);
  private readonly vehiculosGQL = inject(VehiculoSearchPageGQL);
  private readonly mueblesGQL = inject(MuebleSearchPageGQL);
  private readonly inmueblesGQL = inject(InmuebleSearchPageGQL);
  private readonly equiposGQL = inject(EquipoSearchPageGQL);
  private readonly monedasGQL = inject(MonedasGQL);
  private readonly formasPagoGQL = inject(FormasPagoGQL);

  /** Tamaño de página de todos los buscadores del alta. */
  private static readonly TAM_PAGINA = 25;

  /**
   * ⚠️ **Se resuelve por id y sucursal.** Un `PreGasto` sin `sucId` no se
   * encuentra: el id no es único entre filiales.
   */
  porId(id: number, sucId: number): Observable<PreGasto> {
    return this.datos.consultar<PreGasto>(this.porIdGQL, { id, sucId });
  }

  filtrar(filtros: FiltrosPreGasto = {}): Observable<PageInfo<PreGasto>> {
    return this.datos.consultar<PageInfo<PreGasto>>(this.filtrarGQL, {
      id: null,
      cajaId: filtros.cajaId ?? null,
      estado: filtros.estado ?? null,
      estados: filtros.estados ?? null,
      inicio: filtros.inicio ?? null,
      fin: filtros.fin ?? null,
      page: filtros.page ?? 0,
      size: filtros.size ?? 10,
    });
  }

  /**
   * Confirma que el funcionario retiró el efectivo.
   *
   * El `qrToken` **ata el retiro a esa solicitud puntual**: sin él, un retiro
   * podría imputarse a otra. Lo emite el backend con el `PreGasto` y viaja en
   * el QR que el funcionario muestra en la caja.
   */
  confirmarRetiro(input: ConfirmarRetiroInput): Observable<PreGasto> {
    return this.datos.mutar<PreGasto>(this.retiroGQL, { input });
  }

  /**
   * Registra la rendición del gasto.
   *
   * ⚠️ **Las fotos viajan como data URI dentro de la mutation.** No hay
   * endpoint de subida: `frc-mobile` mandaba `image.dataUrl` en el campo
   * llamado `...Urls` y el central lo guarda tal cual. Por eso la pantalla
   * reduce la imagen antes de codificarla — una foto de teléfono sin tocar
   * son varios megabytes de base64 en un solo request.
   */
  rendir(input: Record<string, unknown>): Observable<GastoRendicion> {
    return this.datos.mutar<GastoRendicion>(
      this.rendicionGQL,
      { input },
      { mensajeExito: 'Rendición registrada' },
    );
  }

  // ─────────────────────────────────────────────────────────────── Alta ──

  tiposDeGasto(): Observable<TipoGasto[]> {
    return this.datos
      .paginado<TipoGasto[]>(this.tipoGastosGQL, 0, 200)
      .pipe(map((lista) => lista ?? []));
  }

  monedas(): Observable<Moneda[]> {
    return this.datos.consultar<Moneda[]>(this.monedasGQL).pipe(map((l) => l ?? []));
  }

  /** Igual que `SolicitudPagoService.formasPago()`: catálogo chico, se trae entero. */
  formasPago(): Observable<FormaPago[]> {
    return this.datos
      .consultar<FormaPago[]>(this.formasPagoGQL, { page: 0, size: 200 }, { mostrarCarga: false })
      .pipe(map((l) => l ?? []));
  }

  /**
   * Una página de resultados para `frc-buscador` en modo paginado.
   *
   * ⚠️ `hayMas` sale de `hasNext` del central. Devolver `true` de más hace
   * que «Cargar más» pida páginas vacías indefinidamente.
   */
  private async pagina<T>(
    gql: Query<{ data?: PageInfo<T> }>,
    texto: string,
    pagina: number,
  ): Promise<{ items: T[]; hayMas: boolean }> {
    const page = await firstValueFrom(
      this.datos.consultar<PageInfo<T>>(gql, {
        texto,
        page: pagina,
        size: GastosService.TAM_PAGINA,
      }),
    );
    return { items: page?.getContent ?? [], hayMas: page?.hasNext === true };
  }

  buscarPersonas(texto: string, pagina: number) {
    return this.pagina<Persona>(this.personasGQL, texto, pagina);
  }

  buscarProveedores(texto: string, pagina: number) {
    return this.pagina<Proveedor>(this.proveedoresGQL, texto, pagina);
  }

  buscarVehiculos(texto: string, pagina: number) {
    return this.pagina<Vehiculo>(this.vehiculosGQL, texto, pagina);
  }

  buscarMuebles(texto: string, pagina: number) {
    return this.pagina<Mueble>(this.mueblesGQL, texto, pagina);
  }

  buscarInmuebles(texto: string, pagina: number) {
    return this.pagina<Inmueble>(this.inmueblesGQL, texto, pagina);
  }

  buscarEquipos(texto: string, pagina: number) {
    return this.pagina<Equipo>(this.equiposGQL, texto, pagina);
  }

  /**
   * La ficha financiera del activo elegido, creándola si no existe.
   *
   * ⚠️ **Es una escritura disparada por elegir, no por guardar.** Si el
   * operador abandona el formulario, el `Ente` queda creado igual. Es como
   * funciona `frc-mobile`: el `Ente` es la ficha del activo en el catálogo
   * financiero, no la solicitud.
   */
  async resolverEnte(moduloPadre: string, referenciaId: number): Promise<Ente> {
    const tipoEnte = tipoEnteDesdeModuloPadre(moduloPadre);
    if (!tipoEnte) {
      throw new Error('El tipo de gasto no admite vinculación a un activo');
    }

    const existente = await firstValueFrom(
      this.datos.consultar<Ente>(this.enteByReferenciaGQL, { tipoEnte, referenciaId }),
    );
    if (existente?.id) {
      return existente;
    }

    // ⚠️ `saveEnte` recibe su argumento como `ente:`, no como `entity:` —
    // que es lo que usa `savePreGasto` en el mismo flujo.
    const creado = await firstValueFrom(
      this.datos.mutar<Ente>(this.saveEnteGQL, {
        ente: { tipoEnte, referenciaId, activo: true },
      }),
    );
    if (!creado?.id) {
      throw new Error('No se pudo vincular el activo seleccionado');
    }
    return creado;
  }

  resumenDelEnte(enteId: number, tipoGastoId: number | null) {
    return this.datos.consultar<ResumenFinancieroEnte>(this.resumenEnteGQL, {
      enteId,
      tipoGastoId,
    });
  }

  /** `DatosService.guardar` manda el input bajo `entity`, que es lo que espera `savePreGasto`. */
  crearSolicitud(input: PreGastoInput): Observable<PreGastoCreado> {
    return this.datos.guardar<PreGastoCreado>(
      this.savePreGastoGQL,
      input as unknown as Record<string, unknown>,
      undefined,
      { mensajeExito: 'Solicitud creada' },
    );
  }
}
