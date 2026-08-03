import { Injectable } from "@angular/core";
import { Mutation, Query } from "apollo-angular";
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
