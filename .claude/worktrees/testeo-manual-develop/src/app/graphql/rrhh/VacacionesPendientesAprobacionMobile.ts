import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { vacacionesPendientesAprobacionMobileQuery } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class VacacionesPendientesAprobacionMobileGQL extends Query<Response> { document = vacacionesPendientesAprobacionMobileQuery; }
