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
 * Maletines de una sucursal.
 *
 * `searchMaletin` acepta `sucId`: un maletín pertenece a la sucursal donde
 * está físicamente, y ofrecer los de otra sucursal al abrir caja no tiene
 * sentido operativo.
 */
export const maletinesQuery = gql`
  query ($texto: String, $sucId: ID) {
    data: searchMaletin(texto: $texto, sucId: $sucId) {
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
