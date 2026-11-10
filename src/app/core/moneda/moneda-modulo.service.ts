import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { esGuarani } from 'src/app/generic/utils/moneda.util';
import {
  MonedaDeModuloGQL,
  MonedaEmpresaGQL,
  MonedasFormatoGQL,
  type ModuloMoneda,
} from 'src/app/graphql/operaciones/moneda/moneda-modulo';
import { MonedasGQL } from 'src/app/graphql/operaciones/moneda/monedas';
import { DatosService, esFalloDeTransporte } from '../graphql/datos.service';
import { MonedasSesion } from './monedas-sesion';

/** Ninguna de estas consultas es de la persona: ni spinner global ni toast. */
const SILENCIOSA = { mostrarCarga: false, notificarError: false } as const;

/**
 * Qué moneda usa la empresa y cuál usa cada módulo.
 *
 * Sin configuración en el central todo resuelve a la moneda de la empresa,
 * que hoy es el guaraní en las dos empresas: **la app se ve y se comporta
 * igual que antes**.
 *
 * ⚠️ **Tiene que funcionar contra un central viejo.** `monedaEmpresa` y
 * `monedaDeModulo` solo existen en un central con la configuración de moneda
 * por módulo; contra uno anterior fallan y se cae, en orden, a:
 *
 *   1. la moneda `principal` de la lista de `monedas`;
 *   2. la que se reconoce como guaraní por su nombre o símbolo;
 *   3. `null` — los importes se formatean como antes.
 *
 * Nunca rompe el login ni una pantalla: todo error termina en el respaldo.
 */
@Injectable({ providedIn: 'root' })
export class MonedaModuloService {
  private readonly datos = inject(DatosService);
  private readonly sesion = inject(MonedasSesion);
  private readonly empresaGQL = inject(MonedaEmpresaGQL);
  private readonly moduloGQL = inject(MonedaDeModuloGQL);
  private readonly monedasGQL = inject(MonedasGQL);
  private readonly monedasFormatoGQL = inject(MonedasFormatoGQL);

  /** La moneda de la empresa, ya resuelta. */
  readonly empresa = this.sesion.empresa;

  /** Monedas por módulo ya preguntadas al central en esta sesión. */
  private readonly porModulo = new Map<string, Moneda | null>();
  /**
   * `false` cuando el central rechazó `monedaDeModulo` —no lo conoce—. Se
   * deja de preguntar hasta la próxima carga: no cambia de opinión en la
   * misma sesión, y cada pregunta sería un error más en su log.
   */
  private soportaModulo = true;
  private carga: Promise<void> | null = null;
  /** Descarta el resultado de una carga que otra más nueva dejó vieja. */
  private generacion = 0;

  /**
   * Carga la moneda de la empresa y el catálogo. No lanza nunca.
   *
   * Se llama al cargar la sesión, sin `await`: no puede demorar la entrada.
   */
  cargar(): Promise<void> {
    const generacion = ++this.generacion;
    this.porModulo.clear();
    this.soportaModulo = true;
    const carga = this.cargarEnGeneracion(generacion);
    this.carga = carga;
    return carga;
  }

  private async cargarEnGeneracion(generacion: number): Promise<void> {
    const [remota, lista] = await Promise.all([
      this.preguntar(this.empresaGQL),
      this.preguntarLista(),
    ]);
    if (generacion !== this.generacion) {
      return;
    }
    this.sesion.catalogo.set(lista);
    this.sesion.empresa.set(remota ?? monedaEmpresaDeLista(lista));
  }

  /**
   * La moneda que usa un módulo, opcionalmente para una sucursal.
   *
   * Si el central no sabe contestar —viejo, caído, o devolvió nada— es la de
   * la empresa, que puede ser `null` si tampoco se pudo resolver.
   */
  async monedaDe(modulo: ModuloMoneda, sucursalId?: number | null): Promise<Moneda | null> {
    const clave = modulo + ':' + (sucursalId ?? '');
    if (this.porModulo.has(clave)) {
      return this.porModulo.get(clave) ?? null;
    }
    if (this.soportaModulo) {
      try {
        const moneda = await firstValueFrom(
          this.datos.consultar<Moneda | null>(
            this.moduloGQL,
            sucursalId != null ? { modulo, sucursalId } : { modulo },
            SILENCIOSA,
          ),
        );
        if (moneda) {
          const normalizada = normalizar(moneda);
          this.porModulo.set(clave, normalizada);
          return normalizada;
        }
      } catch (error) {
        // Un fallo de red es pasajero: se vuelve a preguntar la próxima vez.
        // Un rechazo del schema no.
        if (!esFalloDeTransporte(error)) {
          this.soportaModulo = false;
        }
        console.warn('[moneda] No se pudo consultar la moneda de ' + modulo + ':', error);
      }
    }
    await this.carga;
    return this.empresa();
  }

  private async preguntar(gql: MonedaEmpresaGQL): Promise<Moneda | null> {
    try {
      const moneda = await firstValueFrom(this.datos.consultar<Moneda | null>(gql, undefined, SILENCIOSA));
      return moneda ? normalizar(moneda) : null;
    } catch (error) {
      console.warn('[moneda] El central no resolvió la moneda de la empresa; se usa la lista:', error);
      return null;
    }
  }

  /**
   * El catálogo con `principal` y `decimales` y, si el central no los conoce,
   * la lista básica de siempre (sin ellos queda el respaldo por nombre).
   */
  private async preguntarLista(): Promise<Moneda[]> {
    for (const gql of [this.monedasFormatoGQL, this.monedasGQL]) {
      try {
        const lista = await firstValueFrom(this.datos.consultar<Moneda[]>(gql, undefined, SILENCIOSA));
        return (lista ?? []).filter((m): m is Moneda => m != null).map(normalizar);
      } catch (error) {
        console.warn('[moneda] No se pudo consultar la lista de monedas:', error);
      }
    }
    return [];
  }

}

/**
 * La moneda de la empresa según la lista, para un central sin
 * `monedaEmpresa`: la principal y, si ninguna lo es, el guaraní.
 */
export function monedaEmpresaDeLista(lista: readonly Moneda[]): Moneda | null {
  const principales = lista.filter((m) => m.principal === true);
  const principal = principales.find((m) => m.activo !== false) ?? principales[0];
  if (principal) {
    return principal;
  }
  return lista.find((m) => esGuarani(m.denominacion) || esGuarani(m.simbolo)) ?? null;
}

/**
 * El `ID` de GraphQL llega como texto. Ojo con `Number('')`, que es `0`: un
 * id vacío no es la moneda cero.
 */
function normalizar(moneda: Moneda): Moneda {
  const crudo = moneda.id as unknown;
  const id = crudo == null || crudo === '' ? NaN : Number(crudo);
  return Object.assign(new Moneda(), moneda, { id: Number.isFinite(id) ? id : undefined });
}
