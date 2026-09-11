import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { misVacacionesMobileQuery } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class MisVacacionesMobileGQL extends Query<Response> { document = misVacacionesMobileQuery; }
