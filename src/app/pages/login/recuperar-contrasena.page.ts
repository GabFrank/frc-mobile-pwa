import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import {
  ErrorRecuperacion,
  EstadoRecuperacion,
  RecuperacionContrasenaService,
} from 'src/app/core/auth/recuperacion-contrasena.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { validarNuevaContrasena } from '../cuenta/contrasena.util';
import {
  borrarSolicitudGuardada,
  EMAIL_VALIDO,
  guardarSolicitud,
  leerSolicitudGuardada,
  TELEFONO_VALIDO,
} from './recuperar-contrasena.util';

type Paso = 'identidad' | 'codigo' | 'sin-correo' | 'solicitud-creada' | 'consultar' | 'nueva' | 'listo';

const TITULOS: Record<Paso, string> = {
  identidad: 'Recuperar contraseña',
  codigo: 'Ingresá el código',
  'sin-correo': 'Solicitud a RRHH',
  'solicitud-creada': 'Solicitud registrada',
  consultar: 'Consultar solicitud',
  nueva: 'Nueva contraseña',
  listo: 'Contraseña restablecida',
};

/**
 * «¿Olvidaste tu contraseña?», fuera de la sesión.
 *
 * Porta el diálogo del desktop (`recuperar-contrasena-dialog`), con el mismo
 * contrato del central:
 * · con correo registrado llega un código de 6 dígitos;
 * · sin correo se arma una solicitud que aprueba RRHH, y se termina con un
 *   código secreto que se muestra una sola vez.
 *
 * Diferencia con el desktop: el usuario ya está en el teléfono, así que la
 * solicitud se manda abriendo WhatsApp, no escaneando un QR.
 */
@Component({
  selector: 'frc-recuperar-contrasena',
  standalone: true,
  imports: [PaginaComponent, IconoComponent, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true" [conEscaner]="false">
      <div class="paso">
        @switch (paso()) {
          @case ('identidad') {
            @if (guardada(); as g) {
              <div class="info">
                Tenés la solicitud N° {{ g.solicitudId }} en curso.
                <button matButton type="button" (click)="retomarGuardada()">Consultar su estado</button>
              </div>
            }
            <p class="explicacion">Para confirmar que sos vos, completá tus datos tal como figuran en tu legajo.</p>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Usuario</mat-label>
              <input matInput autocomplete="username" autocapitalize="characters" spellcheck="false"
                [value]="nickname()" (input)="nickname.set(valorDe($event))" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Número de cédula</mat-label>
              <input matInput inputmode="numeric" autocomplete="off"
                [value]="documento()" (input)="documento.set(valorDe($event))" />
            </mat-form-field>
            <div class="captcha">
              @if (captchaSrc(); as src) {
                <img [src]="src" alt="Código de verificación" />
              } @else {
                <span class="nota">Cargando imagen…</span>
              }
              <button matButton type="button" [disabled]="cargando()" (click)="nuevoCaptcha()">Otra imagen</button>
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Caracteres de la imagen</mat-label>
              <input matInput maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false"
                [value]="captcha()" (input)="captcha.set(valorDe($event))" />
            </mat-form-field>
            <button matButton class="enlace" type="button" (click)="irAConsultar()">Ya hice una solicitud a RRHH</button>
          }

          @case ('codigo') {
            <div class="info">
              Enviamos un código de 6 dígitos a <b>{{ emailEnmascarado() }}</b>. Vence en
              {{ minutosVigencia() }} minutos. Revisá también la carpeta de spam.
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Código</mat-label>
              <input matInput maxlength="6" inputmode="numeric" autocomplete="one-time-code"
                [value]="codigo()" (input)="codigo.set(valorDe($event))" />
            </mat-form-field>
            @if (estado(); as e) {
              <p class="estado">{{ e.mensaje }}</p>
            }
            <button matButton class="enlace" type="button" (click)="volverAlInicio()">No me llegó, enviar otro código</button>
          }

          @case ('sin-correo') {
            <div class="info">
              Tu usuario no tiene un correo registrado, así que <b>RRHH tiene que aprobar</b> el cambio.
              Completá la solicitud y después mandala por WhatsApp.
            </div>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Teléfono (el de tu WhatsApp)</mat-label>
              <input matInput inputmode="tel" autocomplete="tel"
                [value]="telefono()" (input)="telefono.set(valorDe($event))" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Correo</mat-label>
              <input matInput type="email" autocomplete="email" autocapitalize="none" spellcheck="false"
                [value]="email()" (input)="email.set(valorDe($event))" />
            </mat-form-field>
            <p class="nota">
              Revisalo bien: queda guardado en tu usuario y la próxima vez el código te llega ahí, sin pasar por RRHH.
            </p>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Observación (opcional)</mat-label>
              <textarea matInput rows="2" maxlength="500"
                [value]="observacion()" (input)="observacion.set(valorDe($event))"></textarea>
            </mat-form-field>
          }

          @case ('solicitud-creada') {
            <div class="secreto">
              <span class="secreto-titulo">Solicitud N° {{ solicitudId() }} · tu código secreto</span>
              <span class="secreto-codigo">{{ codigoSecreto() }}</span>
              <button matButton="outlined" type="button" (click)="copiarSecreto()">Copiar</button>
              <p class="advertencia">
                Anotalo: lo vas a necesitar cuando RRHH apruebe la solicitud. No se lo pases a nadie,
                <b>tampoco a RRHH</b>.
              </p>
            </div>
            <ol class="pasos">
              <li>Tocá <b>Enviar por WhatsApp</b>: se abre con el mensaje ya escrito.</li>
              <li>Elegí el contacto de RRHH y mandalo <b>desde el teléfono que cargaste</b>.</li>
              <li>Cuando lo aprueben, volvé acá y tocá <b>Consultar estado</b>. Tienen {{ horasParaAprobar() }} horas.</li>
            </ol>
            <a matButton="outlined" [href]="whatsappUrl()" target="_blank" rel="noopener">Enviar por WhatsApp</a>
          }

          @case ('consultar') {
            <p class="explicacion">Ingresá los datos de la solicitud que mandaste a RRHH.</p>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>N° de solicitud</mat-label>
              <input matInput inputmode="numeric" autocomplete="off"
                [value]="solicitudTexto()" (input)="solicitudTexto.set(valorDe($event))" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Código secreto</mat-label>
              <input matInput placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"
                [value]="codigo()" (input)="codigo.set(valorDe($event))" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Número de cédula</mat-label>
              <input matInput inputmode="numeric" autocomplete="off"
                [value]="documento()" (input)="documento.set(valorDe($event))" />
            </mat-form-field>
            @if (estado(); as e) {
              <p class="estado" [class.rechazada]="e.estado === 'RECHAZADA'">{{ e.mensaje }}</p>
            }
            <button matButton class="enlace" type="button" (click)="volverAlInicio()">Iniciar una solicitud nueva</button>
          }

          @case ('nueva') {
            @if (aviso(); as a) {
              <div class="info ok">{{ a }}</div>
            }
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Contraseña nueva</mat-label>
              <input matInput [type]="ver() ? 'text' : 'password'" autocomplete="new-password"
                autocapitalize="none" autocorrect="off" spellcheck="false"
                [value]="nueva()" (input)="nueva.set(valorDe($event))" />
              <button type="button" matIconSuffix class="ojo" (click)="ver.set(!ver())"
                [attr.aria-label]="ver() ? 'Ocultar contraseña' : 'Mostrar contraseña'">
                <frc-icono [nombre]="ver() ? 'ocultar' : 'ver'" [tamano]="20" />
              </button>
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Repetir contraseña</mat-label>
              <input matInput [type]="ver() ? 'text' : 'password'" autocomplete="new-password"
                autocapitalize="none" autocorrect="off" spellcheck="false"
                [value]="repetida()" (input)="repetida.set(valorDe($event))" />
            </mat-form-field>
            <p class="nota">No puede ser tu usuario ni tu número de cédula.</p>
            @if (avisoClave(); as p) {
              <p class="error" role="alert">{{ p }}</p>
            }
          }

          @case ('listo') {
            <div class="listo">
              <frc-icono nombre="check" [tamano]="40" />
              <p>{{ estado()?.mensaje }}</p>
              <p class="nota">Te mandamos un aviso del cambio a tu correo, si tenés uno registrado.</p>
            </div>
          }
        }

        @if (error(); as e) {
          <p class="error" role="alert">{{ e }}</p>
        }
        @if (aviso() && paso() !== 'nueva') {
          <p class="nota">{{ aviso() }}</p>
        }
      </div>

      <div acciones class="acciones">
        @switch (paso()) {
          @case ('identidad') {
            <button matButton="filled" type="button" [disabled]="cargando()" (click)="verificar()">Continuar</button>
          }
          @case ('codigo') {
            <button matButton="filled" type="button" [disabled]="cargando()" (click)="verificarCodigo()">Verificar</button>
          }
          @case ('sin-correo') {
            <button matButton="filled" type="button" [disabled]="cargando()" (click)="enviarSolicitud()">Registrar solicitud</button>
          }
          @case ('solicitud-creada') {
            <button matButton="filled" type="button" (click)="consultarCreada()">Consultar estado</button>
          }
          @case ('consultar') {
            <button matButton="filled" type="button" [disabled]="cargando()" (click)="consultar()">Consultar</button>
          }
          @case ('nueva') {
            <button matButton="filled" type="button" [disabled]="cargando() || !!problemaClave()" (click)="restablecer()">
              {{ cargando() ? 'Guardando…' : 'Guardar contraseña' }}
            </button>
          }
          @case ('listo') {
            <button matButton="filled" type="button" (click)="irAlLogin()">Ir al inicio de sesión</button>
          }
        }
      </div>
    </frc-pagina>
  `,
  styles: `
    .paso { display: flex; flex-direction: column; gap: var(--sp-3); }
    .explicacion, .nota, .estado, .advertencia { margin: 0; font-size: var(--fs-label); }
    .nota { color: var(--text-mute); }
    .error { margin: 0; font-size: var(--fs-label); color: var(--danger); }
    .estado.rechazada { color: var(--danger); }
    .info {
      padding: var(--sp-3);
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      font-size: var(--fs-label);
    }
    .info.ok { background: var(--ok-bg); }
    .captcha { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
    .captcha img { border-radius: var(--radius-sm); background: var(--surface); max-width: 60%; }
    .enlace { align-self: flex-start; }
    .secreto {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-4);
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      text-align: center;
    }
    .secreto-titulo { font-size: var(--fs-label); color: var(--text-mute); }
    .secreto-codigo { font-family: var(--font-num); font-size: var(--fs-display); font-weight: var(--fw-bold); }
    .advertencia { color: var(--warn); }
    .pasos { margin: 0; padding-left: var(--sp-6); font-size: var(--fs-label); }
    .listo { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; color: var(--ok); }
    .listo p { color: var(--text); margin: 0; }
    .ojo { background: none; border: 0; padding: var(--sp-2); color: var(--text-mute); cursor: pointer; }
    .acciones { display: flex; flex-direction: column; }
  `,
})
export class RecuperarContrasenaPage {
  private readonly servicio = inject(RecuperacionContrasenaService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  /** El usuario que ya se escribió en el login, por query param. */
  readonly usuario = input<string>();

  readonly paso = signal<Paso>('identidad');
  readonly titulo = computed(() => TITULOS[this.paso()]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  readonly captchaId = signal<string | null>(null);
  readonly captchaSrc = signal<string | null>(null);

  readonly nickname = signal('');
  readonly documento = signal('');
  readonly captcha = signal('');
  readonly codigo = signal('');
  readonly telefono = signal('');
  readonly email = signal('');
  readonly observacion = signal('');
  readonly solicitudTexto = signal('');
  readonly nueva = signal('');
  readonly repetida = signal('');
  readonly ver = signal(false);

  readonly emailEnmascarado = signal<string | null>(null);
  readonly minutosVigencia = signal<number | null>(null);
  readonly solicitudId = signal<number | null>(null);
  readonly codigoSecreto = signal<string | null>(null);
  readonly whatsappUrl = signal<string>('');
  readonly horasParaAprobar = signal<number | null>(null);
  readonly estado = signal<EstadoRecuperacion | null>(null);
  readonly guardada = signal(leerSolicitudGuardada());

  private verificacionToken: string | null = null;
  /** Con qué se restablece: el código del correo o el secreto de RRHH. */
  private codigoVigente: string | null = null;
  private documentoVigente: string | null = null;
  /** El último restablecer falló sin respuesta del central: no se sabe si se aplicó. */
  private restablecerIncierto = false;
  private ultimoError: unknown = null;

  /** Lo que impide guardar. */
  readonly problemaClave = computed(() =>
    validarNuevaContrasena(this.nueva(), this.repetida(), this.nickname()),
  );

  /** Lo que se muestra: no se reta a quien todavía no escribió o no repitió. */
  readonly avisoClave = computed(() => {
    const p = this.problemaClave();
    if (!p || !this.nueva()) {
      return null;
    }
    return p.includes('coinciden') && !this.repetida() ? null : p;
  });

  constructor() {
    // input() + effect y no input.required: el router asigna después de construir (NG0950).
    effect(() => {
      const u = this.usuario()?.trim();
      if (u && !untracked(this.nickname)) {
        this.nickname.set(u);
      }
    });
    void this.nuevoCaptcha();
  }

  valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  // ─────────────────────────────────────────────────────────── Identidad ──

  async nuevoCaptcha(): Promise<void> {
    this.captcha.set('');
    this.captchaSrc.set(null);
    try {
      const c = await this.servicio.captcha();
      this.captchaId.set(c.id);
      this.captchaSrc.set('data:image/png;base64,' + c.imagen);
    } catch (e) {
      this.error.set((e as Error).message);
    }
  }

  async verificar(): Promise<void> {
    const nick = this.nickname().trim();
    const doc = this.documento().trim();
    const cap = this.captcha().trim();
    if (!nick || !doc || cap.length < 5 || !this.captchaId()) {
      this.error.set(
        !nick ? 'Ingresá tu usuario.' : !doc ? 'Ingresá tu número de cédula.' : 'Escribí los 5 caracteres de la imagen.',
      );
      return;
    }
    this.documentoVigente = doc;
    const r = await this.ejecutar(() => this.servicio.verificar(nick, doc, this.captchaId()!, cap));
    if (!r) {
      // Un captcha sirve una vez: el central lo descarta aunque falle.
      void this.nuevoCaptcha();
      return;
    }
    if (r.tipo === 'CORREO') {
      this.solicitudId.set(r.solicitudId ?? null);
      this.emailEnmascarado.set(r.emailEnmascarado ?? null);
      this.minutosVigencia.set(r.minutosVigencia ?? null);
      this.codigo.set('');
      this.irA('codigo');
    } else {
      this.verificacionToken = r.verificacionToken ?? null;
      this.irA('sin-correo');
    }
  }

  // ─────────────────────────────────────────────────────────── Con correo ──

  async verificarCodigo(): Promise<void> {
    const codigo = this.codigo().replace(/\D/g, '');
    if (codigo.length !== 6) {
      this.error.set('El código tiene 6 dígitos.');
      return;
    }
    const estado = await this.ejecutar(() => this.servicio.consultar(this.solicitudId()!, codigo, null));
    if (estado) {
      this.codigoVigente = codigo;
      this.mostrarEstado(estado);
    }
  }

  // ──────────────────────────────────────────────── Sin correo: a RRHH ──

  async enviarSolicitud(): Promise<void> {
    const tel = this.telefono().trim();
    const mail = this.email().trim();
    if (!TELEFONO_VALIDO.test(tel)) {
      this.error.set('Ingresá un teléfono válido.');
      return;
    }
    if (!EMAIL_VALIDO.test(mail)) {
      this.error.set(mail ? 'El correo no es válido.' : 'Ingresá tu correo.');
      return;
    }
    const s = await this.ejecutar(() =>
      this.servicio.solicitudRrhh(this.verificacionToken!, tel, mail, this.observacion().trim() || null),
    );
    if (!s) {
      return;
    }
    this.verificacionToken = null;
    this.solicitudId.set(s.solicitudId);
    this.codigoSecreto.set(s.codigoSecreto);
    this.horasParaAprobar.set(s.horasParaAprobar);
    this.whatsappUrl.set('https://wa.me/?text=' + encodeURIComponent(s.mensajeWhatsapp));
    // El secreto se muestra una sola vez y abrir WhatsApp puede hacer que el
    // teléfono descarte la pestaña: sin esto, se perdía con la solicitud viva.
    guardarSolicitud({ solicitudId: s.solicitudId, codigoSecreto: s.codigoSecreto });
    this.guardada.set(leerSolicitudGuardada());
    this.irA('solicitud-creada');
  }

  async copiarSecreto(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codigoSecreto() ?? '');
      this.notificacion.ok('Código copiado.');
    } catch {
      this.notificacion.warn('No se pudo copiar. Anotalo a mano.');
    }
  }

  consultarCreada(): void {
    this.solicitudTexto.set(String(this.solicitudId() ?? ''));
    this.codigo.set(this.codigoSecreto() ?? '');
    this.documento.set(this.documentoVigente ?? this.documento());
    this.estado.set(null);
    this.irA('consultar');
  }

  retomarGuardada(): void {
    const g = this.guardada();
    if (!g) {
      return;
    }
    this.solicitudTexto.set(String(g.solicitudId));
    this.codigo.set(g.codigoSecreto);
    this.estado.set(null);
    this.irA('consultar');
  }

  irAConsultar(): void {
    this.solicitudTexto.set('');
    this.codigo.set('');
    this.estado.set(null);
    this.irA('consultar');
  }

  async consultar(): Promise<void> {
    const id = Number(this.solicitudTexto().trim());
    const codigo = this.codigo().trim();
    const doc = this.documento().trim();
    // Number('') es 0: sin este guard se consultaba la solicitud cero.
    if (!this.solicitudTexto().trim() || !Number.isInteger(id) || id <= 0 || !codigo || !doc) {
      this.error.set('Completá el N° de solicitud, el código secreto y tu cédula.');
      return;
    }
    const estado = await this.ejecutar(() => this.servicio.consultar(id, codigo, doc));
    if (!estado) {
      // Completada, anulada (por intentos o por otra recuperación) o
      // inexistente: el central lo dice así, y la guardada ya no sirve.
      if (this.error()?.includes('ya no está vigente')) {
        this.descartarGuardada(id);
      }
      return;
    }
    this.solicitudId.set(id);
    this.codigoVigente = codigo;
    this.documentoVigente = doc;
    if (['RECHAZADA', 'VENCIDA', 'COMPLETADA', 'ANULADA'].includes(estado.estado)) {
      this.descartarGuardada(id);
    }
    this.mostrarEstado(estado);
  }

  // ─────────────────────────────────────────────────── Contraseña nueva ──

  async restablecer(): Promise<void> {
    if (this.problemaClave()) {
      return;
    }
    const estado = await this.ejecutar(() =>
      this.servicio.restablecer(this.solicitudId()!, this.codigoVigente!, this.documentoVigente, this.nueva()),
    );
    if (!estado) {
      // Si el intento anterior quedó sin respuesta, pudo haberse aplicado: el
      // central ahora dice «código no válido» con la clave ya cambiada.
      if (this.restablecerIncierto) {
        this.aviso.set('Puede que la contraseña ya haya cambiado en el intento anterior: probá entrar con la nueva.');
      }
      this.restablecerIncierto = !(this.ultimoError instanceof ErrorRecuperacion && this.ultimoError.rechazado);
      return;
    }
    this.codigoVigente = null;
    this.descartarGuardada(this.solicitudId());
    this.irA('listo');
    this.estado.set(estado);
  }

  // ──────────────────────────────────────────────────────────── Navegación ──

  volverAlInicio(): void {
    this.irA('identidad');
    void this.nuevoCaptcha();
  }

  irAlLogin(): void {
    void this.router.navigate(['/login'], { replaceUrl: true });
  }

  private mostrarEstado(estado: EstadoRecuperacion): void {
    if (estado.puedeRestablecer) {
      this.nueva.set('');
      this.repetida.set('');
      this.restablecerIncierto = false;
      this.irA('nueva');
      this.aviso.set(estado.mensaje);
    } else {
      // Pendiente, rechazada o vencida: se dice en el mismo paso.
      this.estado.set(estado);
    }
  }

  private descartarGuardada(id: number | null): void {
    if (id != null && this.guardada()?.solicitudId === id) {
      borrarSolicitudGuardada();
      this.guardada.set(null);
    }
  }

  private irA(paso: Paso): void {
    this.paso.set(paso);
    this.error.set(null);
    this.aviso.set(null);
    // Como el desktop: el estado de una consulta no sobrevive al cambio de paso.
    if (paso !== 'consultar') {
      this.estado.set(null);
    }
  }

  /** Una sola llamada a la vez: el doble toque no manda dos. */
  private async ejecutar<T>(llamada: () => Promise<T>): Promise<T | null> {
    if (this.cargando()) {
      return null;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.ultimoError = null;
    try {
      return await llamada();
    } catch (e) {
      this.ultimoError = e;
      this.error.set((e as Error).message);
      return null;
    } finally {
      this.cargando.set(false);
    }
  }
}
