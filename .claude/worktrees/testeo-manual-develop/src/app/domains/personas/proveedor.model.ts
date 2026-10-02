import { Persona } from './persona.model';

/**
 * Proveedor.
 *
 * ⚠️ **El nombre vive en `persona`, no en el proveedor.** Un proveedor es un
 * rol de una persona; buscar por texto busca en la persona
 * (`proveedorSearchByPersona`).
 *
 * Se porta solo lo que usa la recepción de mercadería. Las condiciones de
 * crédito (`credito`, `tipoCredito`, `chequeDias`) y la lista de vendedores
 * existen en el backend y se sumarán cuando alguna pantalla las pida.
 */
export interface Proveedor {
  id?: number;
  persona?: Persona;
}

/** Nombre mostrable de un proveedor, sin romper si falta la persona. */
export function nombreProveedor(proveedor: Proveedor | null | undefined): string {
  return proveedor?.persona?.nombre ?? 'Proveedor';
}
