import { Usuario } from '../personas/usuario.model';

/**
 * En `frc-mobile` este archivo existía en `domains/` pero estaba VACÍO
 * (0 bytes), y el modelo real vivía en `pages/general/pais/`
 * (TODO_TECNICO #38). Acá queda en su lugar.
 */
export class Pais {
  id?: number;
  descripcion?: string;
  creadoEn?: Date;
  usuario?: Usuario;
}
