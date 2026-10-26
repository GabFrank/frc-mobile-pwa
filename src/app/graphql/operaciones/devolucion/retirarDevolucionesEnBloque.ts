import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { RetiroBloqueResultado } from 'src/app/domains/devolucion/retiro.model';
import { retirarDevolucionesEnBloqueMutation } from './graphql-query';

export interface Response {
  data?: RetiroBloqueResultado;
}

@Injectable({ providedIn: 'root' })
export class RetirarDevolucionesEnBloqueGQL extends Mutation<Response> {
  document = retirarDevolucionesEnBloqueMutation;
}
