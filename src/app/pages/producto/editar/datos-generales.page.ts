import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

/**
 * Placeholder. El formulario real llega en la Task 7.
 */
@Component({
  selector: 'frc-datos-generales',
  standalone: true,
  imports: [PaginaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<frc-pagina titulo="Datos generales" [conVolver]="true"></frc-pagina>`,
})
export class DatosGeneralesPage {}
