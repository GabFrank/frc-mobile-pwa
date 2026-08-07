import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { ActualizacionService } from 'src/app/core/actualizacion/actualizacion.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { ServerConfigService } from 'src/app/core/config/server-config.service';
import { TemaService } from 'src/app/core/tema/tema.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
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
        <!--
          La versión es el número de package.json, que va a manejar
          semantic-release. Mientras no exista, se muestra la fecha como
          sustituto y se aclara, para que nadie lea una fecha creyendo que es
          una versión publicada.
        -->
        <frc-dato etiqueta="Versión" [valor]="version()" />
        <frc-dato etiqueta="Compilación" [valor]="compilacion()" />

        @if (actualizacion.disponible(); as nueva) {
          <frc-dato etiqueta="Actualización">
            <button matButton="filled" [disabled]="aplicando()" (click)="actualizar()">
              {{ aplicando() ? 'Aplicando…' : 'Actualizar a ' + nueva }}
            </button>
          </frc-dato>
        } @else {
          <frc-dato etiqueta="Actualización">
            <button matButton [disabled]="buscando()" (click)="buscar()">
              {{ buscando() ? 'Buscando…' : 'Buscar' }}
            </button>
          </frc-dato>
        }
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
  readonly actualizacion = inject(ActualizacionService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);

  readonly buscando = signal(false);
  readonly aplicando = signal(false);

  /** `v1.2.3-alpha.4`, o la fecha con aclaración mientras no haya versionado. */
  version(): string {
    const sello = this.actualizacion.instalada;
    return sello.provisoria ? sello.etiqueta + ' (sin versionar)' : sello.etiqueta;
  }

  /** El commit, y la fecha cuando no está ya ocupando el lugar de la versión. */
  compilacion(): string {
    const sello = this.actualizacion.instalada;
    return sello.provisoria ? sello.commit : sello.commit + ' · ' + sello.fecha;
  }

  /**
   * Busca a mano.
   *
   * Existe porque el aviso automático se puede postergar, y porque alguien que
   * sabe que salió un arreglo no tiene por qué esperar a que le pregunten.
   */
  async buscar(): Promise<void> {
    this.buscando.set(true);
    const hay = await this.actualizacion.consultar();
    this.buscando.set(false);
    if (!hay && this.actualizacion.disponible() == null) {
      this.notificacion.ok('Ya estás en la última versión.');
    }
  }

  async actualizar(): Promise<void> {
    this.aplicando.set(true);
    await this.actualizacion.aplicar();
    // Si la aplicación salió bien, esto no llega a verse: la app se recarga.
    this.aplicando.set(false);
  }

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
