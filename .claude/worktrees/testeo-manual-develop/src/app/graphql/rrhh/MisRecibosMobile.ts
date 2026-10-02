import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { misRecibosMobileQuery } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class MisRecibosMobileGQL extends Query<Response> { document = misRecibosMobileQuery; }
