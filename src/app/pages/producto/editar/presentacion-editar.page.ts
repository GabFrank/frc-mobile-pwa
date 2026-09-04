import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

/**
 * Placeholder. El formulario real llega en la Task 8.
 */
@Component({
  selector: 'frc-presentacion-editar',
  standalone: true,
  imports: [PaginaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<frc-pagina titulo="Presentación" [conVolver]="true"></frc-pagina>`,
})
export class PresentacionEditarPage {}
