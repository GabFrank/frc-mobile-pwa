import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { solicitarVacacionMobileMutation } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class SolicitarVacacionMobileGQL extends Mutation<Response> { document = solicitarVacacionMobileMutation; }
