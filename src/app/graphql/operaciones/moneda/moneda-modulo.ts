import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

import { Query } from 'src/app/core/graphql/gql-base';
import type { Moneda } from 'src/app/domains/moneda/moneda.model';

/**
 * Moneda por módulo: qué moneda usa la empresa y cuál usa cada módulo.
 *
 * ⚠️ **Estas operaciones pueden fallar, y está bien.** Solo las conoce un
 * central con la configuración de moneda por módulo (`ModuloMoneda`,
 * `codigoIso`). Contra uno anterior el schema las rechaza enteras, y quien
 * las usa —`MonedaModuloService`— cae a la lista de `monedas`. Por eso viven
 * aparte: un campo nuevo dentro de `monedasQuery` dejaría sin monedas a
 * recepción y a caja chica en cualquier central viejo.
 */

/** Módulos que pueden tener una moneda propia. Espeja `enum ModuloMoneda` del central. */
export type ModuloMoneda = 'COMPRAS' | 'COSTOS' | 'PRECIOS' | 'PDV';

/** La moneda de la empresa: la principal o, si no hay, el guaraní. Sin rol. */
export const monedaEmpresaQuery = gql`
  query {
    data: monedaEmpresa {
      id
      denominacion
      simbolo
      activo
      principal
      decimales
      codigoIso
      cambio
    }
  }
`;

/**
 * La moneda que un módulo usa ahora, opcionalmente para una sucursal. Sin
 * configuración el central devuelve la de la empresa. Sin rol.
 */
export const monedaDeModuloQuery = gql`
  query ($modulo: ModuloMoneda!, $sucursalId: ID) {
    data: monedaDeModulo(modulo: $modulo, sucursalId: $sucursalId) {
      id
      denominacion
      simbolo
      activo
      principal
      decimales
      codigoIso
      cambio
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class MonedaEmpresaGQL extends Query<{ data?: Moneda | null }> {
  document = monedaEmpresaQuery;
}

@Injectable({ providedIn: 'root' })
export class MonedaDeModuloGQL extends Query<{ data?: Moneda | null }> {
  document = monedaDeModuloQuery;
}

/**
 * El catálogo con lo que hace falta para formatear: `principal` y `decimales`.
 * Va aparte de `monedasQuery` por la misma razón que el resto de este archivo:
 * esos campos no existen en un central anterior a `v4.8.0-beta.5` / `v4.12.0`,
 * y un campo desconocido dejaría sin monedas a recepción y a caja chica. Si
 * falla, `MonedaModuloService` vuelve a la lista básica.
 */
export const monedasFormatoQuery = gql`
  query {
    data: monedas(page: 0, size: 50) {
      id
      denominacion
      simbolo
      activo
      principal
      decimales
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class MonedasFormatoGQL extends Query<{ data?: Moneda[] }> {
  document = monedasFormatoQuery;
}
