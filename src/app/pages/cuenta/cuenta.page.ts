import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { ServerConfigService } from 'src/app/core/config/server-config.service';
import { TemaService } from 'src/app/core/tema/tema.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

@Component({
  selector: 'frc-cuenta',
  standalone: true,
  imports: [PaginaComponent, SeccionComponent, DatoComponent, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Mi cuenta">
      <frc-seccion titulo="Sesión" [panel]="true">
        <frc-dato etiqueta="Usuario" [valor]="auth.usuario()?.nickname ?? '—'" />
        <frc-dato etiqueta="Persona" [valor]="auth.usuario()?.persona?.nombre ?? '—'" />
        <frc-dato etiqueta="Sucursal" [valor]="auth.sucursal()?.nombre ?? '—'" />
      </frc-seccion>

      <frc-seccion titulo="Aplicación" [panel]="true">
        <frc-dato etiqueta="Servidor" [valor]="servidor.baseUrl()" />
        <frc-dato etiqueta="Tema">
          <button matButton (click)="tema.alternar()">
            {{ tema.esOscuroEfectivo() ? 'Oscuro' : 'Claro' }}
          </button>
        </frc-dato>
      </frc-seccion>

      <button matButton="outlined" class="salir" (click)="salir()">Cerrar sesión</button>
    </frc-pagina>
  `,
  styles: `
    .salir { align-self: stretch; margin-top: var(--sp-4); }
  `,
})
export class CuentaPage {
  readonly auth = inject(AuthService);
  readonly servidor = inject(ServerConfigService);
  readonly tema = inject(TemaService);
  private readonly dialogo = inject(DialogoService);

  async salir(): Promise<void> {
    const ok = await this.dialogo.confirmar({
      titulo: 'Cerrar sesión',
      mensaje: 'Vas a volver a la pantalla de inicio de sesión.',
      confirmar: 'Cerrar sesión',
    });
    if (ok) {
      await this.auth.logout();
    }
  }
}
