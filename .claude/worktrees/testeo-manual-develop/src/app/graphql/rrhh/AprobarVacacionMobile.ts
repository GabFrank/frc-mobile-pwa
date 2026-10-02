import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { aprobarVacacionMobileMutation } from './graphql-query';

export interface Response { data: any; }

@Injectable({ providedIn: 'root' })
export class AprobarVacacionMobileGQL extends Mutation<Response> { document = aprobarVacacionMobileMutation; }
