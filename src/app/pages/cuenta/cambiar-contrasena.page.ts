import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DatosService, ErrorDatos } from 'src/app/core/graphql/datos.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { SaveUsuarioGQL } from 'src/app/graphql/personas/usuario/graphql/saveUsuario';
import {
  UsuarioParaCambioClave,
  UsuarioParaCambioClaveGQL,
} from 'src/app/graphql/personas/usuario/graphql/usuarioParaCambioClave';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { inputCambioClave, validarNuevaContrasena } from './contrasena.util';

/**
 * Cambio de la propia contraseña, desde Mi cuenta.
 *
 * En `frc-mobile` era un diálogo que saltaba al entrar con «123». Acá es una
 * pantalla a la que se llega cuando uno quiere; el login solo avisa.
 *
 * No pide la actual: el central no la verifica, así que pedirla sería un
 * control de adorno.
 */
@Component({
  selector: 'frc-cambiar-contrasena',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    IconoComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Cambiar contraseña" [conVolver]="true" [conEscaner]="false">
      @if (cargando()) {
        <frc-skeleton [cantidad]="2" />
      } @else if (error(); as e) {
        <frc-estado-error [detalle]="e" (reintentar)="cargar()" />
      } @else {
        <frc-seccion titulo="Nueva contraseña" [panel]="true">
          <form class="form" (submit)="$event.preventDefault(); guardar()">
            <!-- Para que el gestor de contraseñas sepa de qué cuenta es. -->
            <input type="text" class="oculto" autocomplete="username" [value]="nickname()" readonly />

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Contraseña nueva</mat-label>
              <input
                matInput
                [type]="ver() ? 'text' : 'password'"
                autocomplete="new-password"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                [value]="nueva()"
                (input)="nueva.set(valorDe($event))"
              />
              <button
                type="button"
                matIconSuffix
                class="ojo"
                (click)="ver.set(!ver())"
                [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              >
                <frc-icono [nombre]="ver() ? 'ocultar' : 'ver'" [tamano]="20" />
              </button>
              <mat-hint>Distinta de 123 y de tu usuario.</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Repetir contraseña</mat-label>
              <input
                matInput
                [type]="ver() ? 'text' : 'password'"
                autocomplete="new-password"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                [value]="repetida()"
                (input)="repetida.set(valorDe($event))"
              />
            </mat-form-field>

            @if (aviso(); as a) {
              <p class="aviso" role="alert">{{ a }}</p>
            }

            <button matButton="filled" type="submit" [disabled]="!!problema() || guardando()">
              {{ guardando() ? 'Guardando…' : 'Cambiar contraseña' }}
            </button>
          </form>
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: var(--sp-3); }
    .ojo { background: none; border: 0; padding: var(--sp-2); color: var(--text-mute); cursor: pointer; }
    .aviso { margin: 0; font-size: var(--fs-label); color: var(--danger); }
    .oculto { display: none; }
  `,
})
export class CambiarContrasenaPage {
  private readonly auth = inject(AuthService);
  private readonly datos = inject(DatosService);
  private readonly usuarioGQL = inject(UsuarioParaCambioClaveGQL);
  private readonly guardarGQL = inject(SaveUsuarioGQL);
  private readonly router = inject(Router);
  private readonly notificacion = inject(NotificacionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly ver = signal(false);
  readonly nueva = signal('');
  readonly repetida = signal('');

  private readonly usuario = signal<UsuarioParaCambioClave | null>(null);
  readonly nickname = computed(() => this.usuario()?.nickname ?? '');

  readonly problema = computed(() =>
    validarNuevaContrasena(this.nueva(), this.repetida(), this.nickname()),
  );

  /** No se reta a quien todavía no terminó de escribir la segunda. */
  readonly aviso = computed(() => {
    const p = this.problema();
    if (!p || !this.nueva()) {
      return null;
    }
    return this.repetida() || !p.includes('coinciden') ? p : null;
  });

  constructor() {
    this.cargar();
  }

  /** Fresco del central: el input tiene que llevar el usuario completo. */
  cargar(): void {
    const id = this.auth.usuario()?.id;
    if (id == null) {
      this.cargando.set(false);
      this.error.set('La sesión no tiene usuario.');
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.datos
      .porId<UsuarioParaCambioClave>(this.usuarioGQL, id, undefined, { notificarError: false })
      .subscribe({
        next: (u) => {
          this.cargando.set(false);
          if (u?.id == null || !u.nickname) {
            this.error.set('No se encontró tu usuario en el servidor.');
            return;
          }
          this.usuario.set(u);
        },
        error: (e: unknown) => {
          this.cargando.set(false);
          this.error.set((e as Error)?.message || 'No se pudo cargar tu usuario.');
        },
      });
  }

  valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  guardar(): void {
    const usuario = this.usuario();
    if (!usuario || this.problema() || this.guardando()) {
      return;
    }
    this.guardando.set(true);
    const clave = this.nueva();
    // Se relee justo antes: con EDITAR USUARIOS el input pisa la fila entera,
    // y lo leído al abrir puede revertir lo que un admin cambió mientras tanto.
    this.datos
      .porId<UsuarioParaCambioClave>(this.usuarioGQL, usuario.id)
      .pipe(
        switchMap((fresco) => {
          if (fresco?.id == null || !fresco.nickname) {
            throw new Error('No se encontró tu usuario en el servidor.');
          }
          return this.datos.mutar<Usuario>(
            this.guardarGQL,
            { entity: inputCambioClave(fresco, clave) },
            { mensajeExito: 'Contraseña cambiada.' },
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          if (res?.id != null) {
            // Sin dejar el formulario en el historial: «atrás» no vuelve a él.
            void this.router.navigate(['/cuenta'], { replaceUrl: true });
          }
        },
        error: (e: unknown) => {
          this.guardando.set(false);
          // Los de `DatosService` ya se avisaron; este, el del usuario faltante, no.
          if (!(e instanceof ErrorDatos)) {
            this.notificacion.danger((e as Error).message);
          }
        },
      });
  }
}
