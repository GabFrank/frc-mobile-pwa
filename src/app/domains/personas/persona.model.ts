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
    // Opcional porque casi ninguna query la pide: declararla obligatoria hace
    // que el compilador de plantillas marque como innecesario el `?.` que sí
    // hace falta en tiempo de ejecución.
    ciudad?: Ciudad;
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