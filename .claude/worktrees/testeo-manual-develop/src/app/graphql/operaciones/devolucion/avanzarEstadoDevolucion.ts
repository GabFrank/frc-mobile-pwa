import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Devolucion } from 'src/app/domains/devolucion/devolucion.model';
import { avanzarEstadoDevolucionMutation } from './graphql-query';

export interface Response {
  data?: Devolucion;
}

@Injectable({ providedIn: 'root' })
export class AvanzarEstadoDevolucionGQL extends Mutation<Response> {
  document = avanzarEstadoDevolucionMutation;
}
