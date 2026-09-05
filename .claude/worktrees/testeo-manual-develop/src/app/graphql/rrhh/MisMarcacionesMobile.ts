import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { misMarcacionesMobileQuery } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class MisMarcacionesMobileGQL extends Query<Response> { document = misMarcacionesMobileQuery; }
