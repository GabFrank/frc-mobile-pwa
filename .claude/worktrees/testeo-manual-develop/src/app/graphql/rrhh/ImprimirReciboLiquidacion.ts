import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { imprimirReciboLiquidacionQuery } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class ImprimirReciboLiquidacionGQL extends Query<Response> { document = imprimirReciboLiquidacionQuery; }
