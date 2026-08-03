import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

@Component({
  selector: 'frc-buscar-page',
  standalone: true,
  imports: [PaginaComponent, EstadoVacioComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Buscar">
      <frc-estado-vacio
        titulo="Búsqueda de productos"
        detalle="Se habilita con la ola de módulos de producto. Por ahora, entrá desde Operaciones."
        icono="buscar"
      />
    </frc-pagina>
  `,
})
export class BuscarPage {}
