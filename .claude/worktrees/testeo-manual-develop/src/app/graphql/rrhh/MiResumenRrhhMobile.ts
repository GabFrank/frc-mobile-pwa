import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { miResumenRrhhMobileQuery } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class MiResumenRrhhMobileGQL extends Query<Response> { document = miResumenRrhhMobileQuery; }
