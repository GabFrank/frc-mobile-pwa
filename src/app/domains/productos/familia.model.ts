export class Familia {
  id?: number;
  /**
   * La única etiqueta a mostrar. `descripcion` no se trae: en la base es
   * una reseña libre ("Cervezas, gaseosas, lacteos, jugos, ..." para la
   * familia BEBIDAS), no un nombre — confirmado por el dueño del producto,
   * no una convención de este repo.
   */
  nombre?: string;
  activo?: boolean;
}

export class Subfamilia {
  id?: number;
  /**
   * La única etiqueta a mostrar. Las 73 subfamilias de la base tienen
   * `nombre` cargado; `descripcion` no se trae por la misma razón que en
   * `Familia`.
   */
  nombre?: string;
  familia?: Familia;
  activo?: boolean;
}
