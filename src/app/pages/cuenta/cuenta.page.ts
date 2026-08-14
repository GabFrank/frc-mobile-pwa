import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { ActualizacionService } from 'src/app/core/actualizacion/actualizacion.service';
import { AuthService } from 'src/app/core/auth/auth.service';
import { ServerConfigService } from 'src/app/core/config/server-config.service';
import { Tema, TemaService } from 'src/app/core/tema/tema.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';

@Component({
  selector: 'frc-cuenta',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    SelectorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Mi cuenta">
      <frc-seccion titulo="Sesión" [panel]="true">
        <frc-dato etiqueta="Usuario" [valor]="auth.usuario()?.nickname ?? '—'" />
        <frc-dato etiqueta="Persona" [valor]="auth.usuario()?.persona?.nombre ?? '—'" />
        <frc-dato etiqueta="Sucursal" [valor]="auth.sucursal()?.nombre ?? '—'" />
      </frc-seccion>

      <!--
        Los datos de la persona son de solo lectura, y es una decisión: en
        frc-mobile esta pantalla mostraba campos editables cuyo botón
        «Actualizar» solo cambiaba la foto de perfil. Editarlos de verdad es
        del legajo de RRHH, no del autoservicio.
      -->
      @if (persona(); as p) {
        <frc-seccion titulo="Mis datos" [panel]="true">
          <frc-dato etiqueta="Documento" [valor]="p.documento || '—'" />
          <frc-dato etiqueta="Apodo" [valor]="p.apodo || '—'" />
          <frc-dato etiqueta="Teléfono" [valor]="p.telefono || '—'" />
          <frc-dato etiqueta="Email" [valor]="p.email || auth.usuario()?.email || '—'" />
          <frc-dato etiqueta="Nacimiento" [valor]="nacimiento()" />
          <!-- Ciudad lleva descripcion, no nombre, a diferencia de Sucursal. -->
          <frc-dato etiqueta="Ciudad" [valor]="p.ciudad?.descripcion || '—'" />
        </frc-seccion>
      }

      <frc-seccion titulo="Preferencias" [panel]="true">
        <frc-dato etiqueta="Tema">
          <frc-selector
            etiqueta="Tema"
            [opciones]="temas"
            [valor]="tema.tema()"
            (valorChange)="cambiarTema($event)"
          />
        </frc-dato>
        <frc-dato etiqueta="Notificaciones">
          <button matButton (click)="irAPreferencias()">Configurar</button>
        </frc-dato>
        <!--
          El rostro se registra una vez y sirve para marcar entrada. Vive en
          Preferencias y no en Sesión porque es del dispositivo y de la
          persona, no de la sesión abierta.
        -->
        <frc-dato etiqueta="Mi rostro">
          <button matButton (click)="irARostro()">Registrar</button>
        </frc-dato>
      </frc-seccion>

      <frc-seccion titulo="Aplicación" [panel]="true">
        <!--
          El cambio de servidor vivía solo en el login. Con la sesión abierta
          no había forma de llegar: para apuntar el teléfono a otra instancia
          había que cerrar sesión primero, y quien no lo sabía creía que la
          app estaba clavada en un servidor.
        -->
        <frc-dato etiqueta="Servidor">
          <button matButton (click)="cambiarServidor()">{{ servidor.baseUrl() }}</button>
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
  private readonly router = inject(Router);

  readonly buscando = signal(false);
  readonly aplicando = signal(false);

  /** Los tres estados reales de `TemaService`. La UI solo ofrecía dos. */
  readonly temas: OpcionSeleccion[] = [
    { valor: 'sistema', texto: 'Del sistema' },
    { valor: 'claro', texto: 'Claro' },
    { valor: 'oscuro', texto: 'Oscuro' },
  ];

  readonly persona = computed(() => this.auth.usuario()?.persona ?? null);

  /** Sin hora: una fecha de nacimiento es un día, no un instante. */
  readonly nacimiento = computed(
    () => fechaLegible(this.persona()?.nacimiento, { conHora: false }) ?? '—',
  );

  cambiarTema(valor: unknown): void {
    this.tema.establecer(valor as Tema);
  }

  irAPreferencias(): void {
    void this.router.navigate(['/notificaciones/preferencias']);
  }

  irARostro(): void {
    void this.router.navigate(['/cuenta/rostro']);
  }

  /**
   * Apunta la app a otra instancia del central.
   *
   * ⚠️ **Cierra la sesión, y hay que decirlo antes.** El token de la
   * instancia vieja no vale en la nueva, y `ServerConfigService` lo borra
   * junto con el usuario. Sin el aviso, quien cambia de servidor ve la
   * pantalla de login y cree que la app lo expulsó.
   */
  async cambiarServidor(): Promise<void> {
    const actual = this.servidor.baseUrl();
    const nuevo = await this.dialogo.pedirTexto({
      titulo: 'Servidor',
      etiqueta: 'URL del servidor',
      valor: actual,
      ayuda: 'Ejemplo: http://172.25.1.200:8081',
      tipo: 'url',
    });
    if (!nuevo || nuevo === actual) {
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Cambiar de servidor',
      mensaje:
        'Vas a salir de la sesión: la credencial de este servidor no sirve en el otro. ' +
        'Después vas a tener que volver a entrar.',
      confirmar: 'Cambiar y salir',
    });
    if (!ok) {
      return;
    }

    this.servidor.cambiarServidor(nuevo);
    // El servicio ya borró las claves de sesión; queda vaciar el estado en
    // memoria y sacar al usuario de las pantallas protegidas.
    await this.auth.logout();
  }

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
