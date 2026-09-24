import { Injectable } from "@angular/core";
import { Mutation } from "src/app/core/graphql/gql-base";
import { saveInicioSesionGQL } from "./graphql-query";
import { InicioSesion } from "src/app/domains/configuracion/inicio-sesion.model";

export interface Response {
  data?: InicioSesion;
}

@Injectable({
  providedIn: "root"
})
export class SaveInicioSesionGQL extends Mutation<Response> {
  document = saveInicioSesionGQL;
}
