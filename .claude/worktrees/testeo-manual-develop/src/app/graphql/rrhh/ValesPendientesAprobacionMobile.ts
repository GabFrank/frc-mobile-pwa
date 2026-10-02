import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { valesPendientesAprobacionMobileQuery } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class ValesPendientesAprobacionMobileGQL extends Query<Response> { document = valesPendientesAprobacionMobileQuery; }
