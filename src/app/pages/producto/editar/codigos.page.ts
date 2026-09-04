import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

/**
 * Placeholder. La pantalla real llega en la Task 9.
 */
@Component({
  selector: 'frc-codigos',
  standalone: true,
  imports: [PaginaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<frc-pagina titulo="Códigos" [conVolver]="true"></frc-pagina>`,
})
export class CodigosPage {}
