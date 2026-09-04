export class Familia {
  id?: number;
  descripcion?: string;
  activo?: boolean;
}

export class Subfamilia {
  id?: number;
  descripcion?: string;
  familia?: Familia;
  activo?: boolean;
}
