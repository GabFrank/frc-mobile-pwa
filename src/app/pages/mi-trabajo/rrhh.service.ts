import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import {
  Jornada,
  Recibo,
  ResumenRrhh,
  Vacacion,
  VacacionPeriodo,
  Vale,
} from 'src/app/domains/rrhh/rrhh.model';
import { AprobarVacacionMobileGQL } from 'src/app/graphql/rrhh/AprobarVacacionMobile';
import { ImprimirReciboLiquidacionGQL } from 'src/app/graphql/rrhh/ImprimirReciboLiquidacion';
import { MiResumenRrhhMobileGQL } from 'src/app/graphql/rrhh/MiResumenRrhhMobile';
import { MisMarcacionesMobileGQL } from 'src/app/graphql/rrhh/MisMarcacionesMobile';
import { MisRecibosMobileGQL } from 'src/app/graphql/rrhh/MisRecibosMobile';
import { MisVacacionesMobileGQL } from 'src/app/graphql/rrhh/MisVacacionesMobile';
import { MisValesMobileGQL } from 'src/app/graphql/rrhh/MisValesMobile';
import { SolicitarVacacionMobileGQL } from 'src/app/graphql/rrhh/SolicitarVacacionMobile';
import { SolicitarValeMobileGQL } from 'src/app/graphql/rrhh/SolicitarValeMobile';
import { VacacionesPendientesAprobacionMobileGQL } from 'src/app/graphql/rrhh/VacacionesPendientesAprobacionMobile';
import { ValesPendientesAprobacionMobileGQL } from 'src/app/graphql/rrhh/ValesPendientesAprobacionMobile';

/**
 * Autoservicio de RRHH.
 *
 * Todas las operaciones llevan sufijo `Mobile`: son endpoints paralelos a los
 * del desktop, que está en producción en farmacias y bodegas. Ver
 * `docs/REGLAS_DESARROLLO.md`.
 *
 * ⚠️ Devuelve tipos concretos. En `frc-mobile` todos los métodos devolvían
 * `any` y los componentes usaban `any[]`.
 */
/**
 * Filas por página, por lista.
 *
 * No son todas iguales porque la unidad natural de cada una es distinta: un
 * mes de trabajo son ~22 jornadas, un año de sueldos son 12 recibos. Elegir
 * el tamaño así hace que el caso habitual —"lo del mes", "lo del año"— entre
 * en la primera página y nadie tenga que tocar "Cargar más".
 */
export const TAMANO_PAGINA = {
  marcaciones: 30,
  recibos: 12,
  vales: 10,
} as const;

@Injectable({ providedIn: 'root' })
export class RrhhService {
  private readonly datos = inject(DatosService);
  private readonly resumenGQL = inject(MiResumenRrhhMobileGQL);
  private readonly recibosGQL = inject(MisRecibosMobileGQL);
  private readonly valesGQL = inject(MisValesMobileGQL);
  private readonly vacacionesGQL = inject(MisVacacionesMobileGQL);
  private readonly marcacionesGQL = inject(MisMarcacionesMobileGQL);
  private readonly imprimirReciboGQL = inject(ImprimirReciboLiquidacionGQL);
  private readonly solicitarValeGQL = inject(SolicitarValeMobileGQL);
  private readonly solicitarVacacionGQL = inject(SolicitarVacacionMobileGQL);
  private readonly valesPendientesGQL = inject(ValesPendientesAprobacionMobileGQL);
  private readonly vacacionesPendientesGQL = inject(VacacionesPendientesAprobacionMobileGQL);
  private readonly aprobarVacacionGQL = inject(AprobarVacacionMobileGQL);

  // ───────────────────────────────────────────────────────────── Consultas ──

  resumen(usuarioId: number): Observable<ResumenRrhh> {
    return this.datos.consultar<ResumenRrhh>(this.resumenGQL, { usuarioId });
  }

  /** Recibos pagados, del más reciente al más antiguo. Siempre paginado. */
  recibos(usuarioId: number, page = 0, size = TAMANO_PAGINA.recibos): Observable<Recibo[]> {
    return this.datos.consultar<Recibo[]>(this.recibosGQL, { usuarioId, page, size });
  }

  /** Vales, del más reciente al más antiguo. Siempre paginado. */
  vales(usuarioId: number, page = 0, size = TAMANO_PAGINA.vales): Observable<Vale[]> {
    return this.datos.consultar<Vale[]>(this.valesGQL, { usuarioId, page, size });
  }

  vacaciones(usuarioId: number): Observable<Vacacion[]> {
    return this.datos.consultar<Vacacion[]>(this.vacacionesGQL, { usuarioId });
  }

  /**
   * Marcaciones, de la más reciente a la más antigua.
   *
   * ⚠️ **Siempre paginado.** Hay una jornada por día trabajado —unas 250 al
   * año— y sin `page`/`size` el servidor las devuelve todas: el costo de
   * abrir la pestaña crecería con la antigüedad del empleado.
   */
  marcaciones(usuarioId: number, page = 0, size = TAMANO_PAGINA.marcaciones): Observable<Jornada[]> {
    return this.datos.consultar<Jornada[]>(this.marcacionesGQL, { usuarioId, page, size });
  }

  /** El recibo en PDF, en base64. El prefijo lo limpia `PdfService`. */
  reciboEnPdf(id: number): Observable<string> {
    return this.datos.consultar<string>(this.imprimirReciboGQL, { id });
  }

  // ─────────────────────────────────────────────────────────── Solicitudes ──

  /**
   * Pide un vale o un adelanto.
   *
   * ⚠️ `esAdelanto` es obligatorio en la decisión, no opcional en el sentido
   * de "da igual": un adelanto sale del sueldo del mes en curso y un vale se
   * descuenta en cuotas. La liquidación los trata distinto.
   */
  solicitarVale(
    usuarioId: number,
    monto: number,
    esAdelanto: boolean,
    motivoId?: number,
  ): Observable<Vale> {
    return this.datos.mutar<Vale>(
      this.solicitarValeGQL,
      { usuarioId, monto, esAdelanto, motivoId: motivoId ?? null },
      { mensajeExito: esAdelanto ? 'Adelanto solicitado' : 'Vale solicitado' },
    );
  }

  /** `desde` y `hasta` en `yyyy-MM-dd`, que es lo que espera el central. */
  solicitarVacacion(usuarioId: number, desde: string, hasta: string): Observable<VacacionPeriodo> {
    return this.datos.mutar<VacacionPeriodo>(
      this.solicitarVacacionGQL,
      { usuarioId, desde, hasta },
      { mensajeExito: 'Vacaciones solicitadas' },
    );
  }

  // ────────────────────────────────────────────────────────── Aprobaciones ──

  valesPendientes(): Observable<Vale[]> {
    return this.datos.consultar<Vale[]>(this.valesPendientesGQL, {});
  }

  vacacionesPendientes(): Observable<VacacionPeriodo[]> {
    return this.datos.consultar<VacacionPeriodo[]>(this.vacacionesPendientesGQL, {});
  }

  /**
   * Aprueba unas vacaciones.
   *
   * ⚠️ **Se aprueba por `periodoId`, no por id de solicitud.** La aprobación
   * ocurre a nivel del período vacacional.
   */
  aprobarVacacion(periodoId: number, aprobadorUsuarioId: number): Observable<VacacionPeriodo> {
    return this.datos.mutar<VacacionPeriodo>(
      this.aprobarVacacionGQL,
      { periodoId, aprobadorUsuarioId },
      { mensajeExito: 'Vacaciones aprobadas' },
    );
  }
}
