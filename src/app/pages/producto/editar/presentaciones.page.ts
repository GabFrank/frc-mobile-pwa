import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

/**
 * Placeholder. La lista real llega en la Task 8.
 */
@Component({
  selector: 'frc-presentaciones',
  standalone: true,
  imports: [PaginaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<frc-pagina titulo="Presentaciones" [conVolver]="true"></frc-pagina>`,
})
export class PresentacionesPage {}
