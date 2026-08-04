import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from 'src/app/core/auth/auth.service';
import { SesionService } from 'src/app/core/auth/sesion.service';
import { ServerConfigService } from 'src/app/core/config/server-config.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { IconoComponent } from 'src/app/shared/icono/icono.component';

@Component({
  selector: 'frc-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pantalla">
      <div class="marca">
        <div class="logo"><frc-icono nombre="sucursal" [tamano]="34" /></div>
        <h1>Bodega Franco</h1>
        <p class="servidor">{{ servidor.baseUrl() }}</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="entrar()" class="form">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Usuario</mat-label>
          <input
            matInput
            formControlName="nickname"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Contraseña</mat-label>
          <input
            matInput
            formControlName="password"
            [type]="verClave() ? 'text' : 'password'"
            autocomplete="current-password"
          />
          <button
            type="button"
            matIconSuffix
            class="ojo"
            (click)="verClave.set(!verClave())"
            [attr.aria-label]="verClave() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          >
            <frc-icono [nombre]="verClave() ? 'ocultar' : 'ver'" [tamano]="20" />
          </button>
        </mat-form-field>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button
          matButton="filled"
          type="submit"
          class="entrar"
          [disabled]="form.invalid || enviando()"
        >
          {{ enviando() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>

      <button matButton class="config" type="button" (click)="cambiarServidor()">
        Configuración del servidor
      </button>
    </div>
  `,
  styles: `
    .pantalla {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--sp-8);
      padding: var(--sp-6) var(--sp-4);
      max-width: 420px;
      margin: 0 auto;
    }
    .marca {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
    }
    .logo {
      width: 64px;
      height: 64px;
      border-radius: var(--radius-full);
      background: var(--brand);
      color: var(--on-brand);
      display: grid;
      place-items: center;
    }
    h1 { margin: 0; font-size: var(--fs-display); font-weight: var(--fw-bold); }
    .servidor {
      margin: 0;
      font-family: var(--font-num);
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .form { display: flex; flex-direction: column; gap: var(--sp-4); }
    .entrar { width: 100%; }
    .error {
      margin: 0;
      color: var(--danger);
      font-size: var(--fs-label);
    }
    .ojo {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-mute);
      line-height: 0;
      padding: var(--sp-1);
    }
    .config { align-self: center; color: var(--text-soft); }
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly notificacion = inject(NotificacionService);
  readonly servidor = inject(ServerConfigService);
  private readonly dialogo = inject(DialogoService);

  readonly form = this.fb.nonNullable.group({
    nickname: ['', Validators.required],
    password: ['', Validators.required],
  });

  readonly enviando = signal(false);
  readonly verClave = signal(false);
  readonly error = signal<string | null>(null);

  async entrar(): Promise<void> {
    if (this.form.invalid || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.error.set(null);

    const { nickname, password } = this.form.getRawValue();
    const resultado = await this.auth.login(nickname, password);

    if (!resultado.ok) {
      this.enviando.set(false);
      this.error.set(resultado.mensaje ?? 'No se pudo iniciar sesión.');
      return;
    }

    // El login REST solo devuelve token, usuarioId y sucursal. Los roles —de
    // los que depende todo el control de acceso de la UI— vienen de GraphQL,
    // así que hay que cargar el usuario antes de entrar.
    const usuarioId = this.auth.usuarioIdGuardado;
    if (usuarioId == null || !(await this.sesion.cargarUsuario(usuarioId))) {
      this.enviando.set(false);
      await this.auth.logout(false);
      // Se muestra el motivo real: "intentá de nuevo" no ayuda si el problema
      // es del servidor o de la query, que es lo habitual acá.
      const motivo = this.sesion.ultimoError();
      this.error.set(
        motivo
          ? `Entraste, pero no se pudieron cargar tus datos: ${motivo}`
          : 'Entraste, pero no se pudieron cargar tus datos. Intentá de nuevo.',
      );
      return;
    }

    this.enviando.set(false);

    if (resultado.requiereCambioContrasena) {
      this.notificacion.warn('Estás usando la contraseña por defecto. Cambiala desde tu cuenta.');
    }

    await this.router.navigate(['/inicio']);
  }

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
    this.servidor.cambiarServidor(nuevo);
    this.notificacion.ok('Servidor actualizado.');
  }
}
