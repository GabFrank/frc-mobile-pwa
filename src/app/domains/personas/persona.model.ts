import { Ciudad } from "../general/ciudad.model";
import { Usuario } from "./usuario.model";

export interface Persona  {
    id: number;
    nombre: string;
    nombreCompleto?: string;
    apodo: string;
    nacimiento: Date;
    documento: string;
    email: string;
    sexo: string;
    direccion: string;
    ciudad: Ciudad;
    telefono: string;
    socialMedia: string;
    imagenes: string;
    embeddingFacial?: string;
    creadoEn: Date;
    usuario: Usuario;
    isFuncionario: boolean
    isCliente: boolean
    isProveedor: boolean
  }