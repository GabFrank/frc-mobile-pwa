import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { CardComponent } from 'src/app/shared/card/card.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

@Component({
  selector: 'frc-operaciones',
  standalone: true,
  imports: [PaginaComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Operaciones">
      @if (puedeCaja()) {
        <frc-card
          titulo="Caja"
          subtitulo="Apertura, cierre y arqueo"
          icono="dinero"
          (abrir)="ir('/operaciones/caja')"
        />
      }
    </frc-pagina>
  `,
})
export class OperacionesPage {
  private readonly auth = inject(AuthService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);

  puedeCaja(): boolean {
    return this.roleService.puedeAccederCaja(this.auth.roles());
  }

  ir(ruta: string): void {
    void this.router.navigate([ruta]);
  }
}
