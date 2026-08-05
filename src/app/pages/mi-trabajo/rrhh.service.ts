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
 * Filas por página en marcaciones.
 *
 * Un mes de trabajo son ~22 jornadas: 30 cubre el mes en curso sin que la
 * mayoría necesite tocar "Cargar más".
 */
export const TAMANO_PAGINA = 30;

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

  recibos(usuarioId: number): Observable<Recibo[]> {
    return this.datos.consultar<Recibo[]>(this.recibosGQL, { usuarioId });
  }

  vales(usuarioId: number): Observable<Vale[]> {
    return this.datos.consultar<Vale[]>(this.valesGQL, { usuarioId });
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
  marcaciones(usuarioId: number, page = 0, size = TAMANO_PAGINA): Observable<Jornada[]> {
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
