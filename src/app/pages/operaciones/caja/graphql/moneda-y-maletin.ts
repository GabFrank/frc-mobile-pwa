import { Injectable } from '@angular/core';
import gql from 'graphql-tag';

import { Query } from 'src/app/core/graphql/gql-base';
import { Maletin } from 'src/app/domains/caja/maletin.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';

/**
 * Monedas con TODAS sus denominaciones.
 *
 * ⚠️ Las denominaciones se traen del backend, no se escriben acá.
 *
 * El repo anterior declaraba tres formularios con los valores fijos
 * (`500`…`100000` para el guaraní, `0.05`…`200` para el real, `1`…`100`
 * para el dólar) y después cruzaba cada `MonedaBillete` del servidor contra
 * esa lista buscando por `valor`. Una denominación que existiera en la base
 * y no en la lista —un billete nuevo, una moneda retirada y vuelta a
 * emitir— **no aparecía en el arqueo y su efectivo no se contaba**, sin
 * ningún aviso. Y al revés: un valor de la lista que ya no existiera
 * generaba un campo que nunca se podía guardar.
 *
 * `size: 50` porque `monedas` pagina y el default son 10.
 */
export const monedasConDenominacionesQuery = gql`
  query {
    data: monedas(page: 0, size: 50) {
      id
      denominacion
      simbolo
      activo
      cambio
      monedaBilleteList {
        id
        valor
        activo
        papel
      }
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class MonedasConDenominacionesGQL extends Query<{ data?: Moneda[] }> {
  document = monedasConDenominacionesQuery;
}

/**
 * Maletines que se pueden elegir para abrir caja en una sucursal.
 *
 * ⚠️ **El central los consulta en la filial** (ip + puerto servidor de la
 * sucursal), no en su propia tabla: el maletín y su estado `abierto` viven
 * allá. Ya vienen filtrados —activos y sin uso—; acá no se filtra nada.
 *
 * Antes se usaba `searchMaletin` con la sucursal de la sesión, que en el
 * central es siempre la 0 (`SERVIDOR`): ofrecía maletines viejos que no
 * pertenecen a ninguna sucursal real.
 */
export const maletinesQuery = gql`
  query ($sucId: ID!) {
    data: maletinesDisponiblesPorSucursal(sucId: $sucId) {
      id
      descripcion
      activo
      abierto
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class MaletinesGQL extends Query<{ data?: Maletin[] }> {
  document = maletinesQuery;
}
