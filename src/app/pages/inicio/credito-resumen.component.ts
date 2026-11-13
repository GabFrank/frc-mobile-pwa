import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { CREDITO_VISIBLE_KEY } from 'src/app/core/auth/auth.tokens';
import {
  CreditoOtraEmpresa,
  MisFinanzasService,
  ResumenCredito,
} from 'src/app/pages/mis-finanzas/mis-finanzas.service';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';

/** A partir de acá la barra deja de ser informativa y empieza a avisar. */
const UMBRAL_WARN = 75;

/**
 * Estado del crédito por convenio, arriba de todo en Inicio.
 *
 * Es lo primero que mira el empleado que compra en la empresa: cuánto le
 * queda antes de que le descuenten en la liquidación. Toca la card y cae en
 * [Mis finanzas](../mis-finanzas/mis-finanzas.page.ts), donde está el
 * detalle compra por compra.
 *
 * ⚠️ **Los valores arrancan ocultos y la preferencia se guarda.** No es
 * pudor: esta pantalla se abre en el salón, delante de clientes y de otros
 * empleados, y el saldo de una persona no tiene por qué leerse por encima
 * del hombro. `frc-mobile` ya lo resolvía así y se conserva. A diferencia de
 * `frc-mobile`, la preferencia se borra con la sesión (`limpiarSesion`): si no,
 * el próximo que entra en el mismo teléfono ve el saldo del anterior.
 *
 * ⚠️ **Si la persona no es cliente, la card no existe.** No todo empleado
 * compra por convenio; mostrar un bloque en cero le diría que tiene un
 * crédito agotado, que es exactamente lo contrario. Lo mismo si la consulta
 * falla: se ofrece reintentar, no se inventa un cero.
 *
 * **La otra empresa (bodega ↔ farmacia).** Si la persona tiene convenio en la
 * otra empresa, el botón de intercambio alterna entre las dos. Si acá no es
 * cliente pero allá sí, la card muestra la otra directamente. Un fallo de la
 * otra empresa no se muestra acá —Inicio es la primera pantalla y Mis finanzas
 * ya lo dice—: simplemente no aparece el botón.
 */
@Component({
  selector: 'frc-credito-resumen',
  standalone: true,
  imports: [IconoComponent, ImporteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cargando() || (resumen() === null && !error() && cargandoOtra())) {
      <div class="card cargando" aria-hidden="true">
        <div class="sk linea corta"></div>
        <div class="sk linea larga"></div>
        <div class="sk barra"></div>
      </div>
    } @else if (error()) {
      <div class="card fallo">
        <span class="fallo-texto">No se pudo cargar tu crédito.</span>
        <button type="button" class="reintentar" (click)="cargar()">Reintentar</button>
      </div>
    } @else if (mostrado(); as r) {
      <!--
        La card entera navega, pero el ojo NO: es un botón anidado con su
        propio stopPropagation. Sin eso, ocultar los valores te sacaba de la
        pantalla, que es el gesto contrario al que pediste.
      -->
      <div
        class="card"
        role="link"
        tabindex="0"
        (click)="verDetalle()"
        (keydown.enter)="teclaEnCard($event)"
        (keydown.space)="teclaEnCard($event)"
      >
        <div class="cabecera">
          <span class="etiqueta" aria-live="polite">
            {{ viendoOtra() ? 'Crédito disponible en ' + otra()!.empresa : 'Crédito disponible' }}
          </span>
          <button
            type="button"
            class="accion"
            [attr.aria-label]="visible() ? 'Ocultar valores' : 'Mostrar valores'"
            [attr.aria-pressed]="visible()"
            (click)="alternarVisibilidad($event)"
          >
            <frc-icono [nombre]="visible() ? 'ocultar' : 'ver'" [tamano]="20" />
          </button>
        </div>

        <div class="monto">
          @if (visible()) {
            <frc-importe destacado [valor]="r.disponible" moneda="Guaraní" simbolo="₲" />
          } @else {
            <span class="oculto">₲ ••••••</span>
          }
        </div>

        <!--
          Con los valores ocultos la barra se vacía. Dejarla en su posición
          real filtraría de un vistazo lo mismo que el ojo acaba de tapar.
        -->
        <div
          class="pista"
          role="progressbar"
          aria-label="Crédito utilizado"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="visible() ? redondear(r.porcentaje) : null"
        >
          <div
            class="indicador"
            [class.warn]="visible() && tono(r) === 'warn'"
            [class.danger]="visible() && tono(r) === 'danger'"
            [style.width.%]="visible() ? r.porcentaje : 0"
          ></div>
        </div>

        <div class="detalles">
          <div class="detalle">
            <span class="detalle-etiqueta">Gastado</span>
            @if (visible()) {
              <frc-importe [valor]="r.utilizado" moneda="Guaraní" simbolo="₲" />
            } @else {
              <span class="oculto chico">₲ ••••••</span>
            }
          </div>
          <div class="detalle">
            <span class="detalle-etiqueta">Límite</span>
            @if (visible()) {
              <frc-importe [valor]="r.limite" moneda="Guaraní" simbolo="₲" />
            } @else {
              <span class="oculto chico">₲ ••••••</span>
            }
          </div>
          <!--
            Abajo a la derecha, en la línea de los montos y en la columna del
            ojo: lejos del ojo para no tocar uno por el otro, y a mano del
            pulgar. Va al final de la fila, así que llegar tarde no corre nada.
          -->
          @if (puedeAlternar()) {
            <button
              type="button"
              class="accion intercambio"
              [attr.aria-label]="viendoOtra() ? 'Ver mi crédito' : 'Ver crédito en ' + otra()!.empresa"
              (click)="alternarEmpresa($event)"
            >
              <frc-icono nombre="intercambio" [tamano]="20" />
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    :host:empty { display: none; }

    .card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      box-shadow: var(--elev-1);
      padding: var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      cursor: pointer;
    }
    .card:focus-visible { outline: 2px solid var(--brand-text); outline-offset: 2px; }

    .cabecera {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-2);
    }
    .etiqueta {
      font-size: var(--fs-caption);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-mute);
      font-weight: var(--fw-medium);
    }
    .accion {
      background: none;
      border: none;
      color: var(--text-soft);
      cursor: pointer;
      padding: var(--sp-1);
      border-radius: var(--radius-sm);
      line-height: 0;
    }
    .accion:hover { background: var(--surface-sunken); }
    .accion:focus-visible { outline: 2px solid var(--brand-text); outline-offset: 2px; }

    .monto { font-size: var(--fs-display); font-weight: var(--fw-bold); color: var(--text); }
    .oculto {
      font-family: var(--font-num);
      font-size: var(--fs-display);
      font-weight: var(--fw-bold);
      letter-spacing: 0.06em;
      color: var(--text-soft);
    }
    .oculto.chico { font-size: var(--fs-body); font-weight: var(--fw-medium); }

    .pista {
      height: var(--sp-2);
      background: var(--surface-sunken);
      border-radius: var(--radius-full);
      overflow: hidden;
    }
    .indicador {
      height: 100%;
      background: var(--ok-fill);
      border-radius: var(--radius-full);
      transition: width 240ms ease-out;
    }
    .indicador.warn { background: var(--warn-fill); }
    .indicador.danger { background: var(--danger-fill); }

    .detalles { display: flex; gap: var(--sp-6); }
    .intercambio { margin-left: auto; align-self: flex-end; }
    .detalle { display: flex; flex-direction: column; gap: var(--sp-1); }
    .detalle-etiqueta { font-size: var(--fs-caption); color: var(--text-mute); }

    .fallo {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      cursor: default;
    }
    .fallo-texto { font-size: var(--fs-label); color: var(--text-soft); }
    .reintentar {
      background: none;
      border: none;
      color: var(--brand-text);
      font: inherit;
      font-size: var(--fs-label);
      font-weight: var(--fw-medium);
      cursor: pointer;
      padding: var(--sp-1) var(--sp-2);
      border-radius: var(--radius-sm);
    }
    .reintentar:hover { background: var(--surface-sunken); }

    .cargando { cursor: default; }
    .sk {
      background: var(--surface-sunken);
      border-radius: var(--radius-sm);
      animation: latido 1.4s ease-in-out infinite;
    }
    .sk.linea { height: var(--sp-3); }
    .sk.linea.corta { width: 40%; }
    .sk.linea.larga { width: 62%; height: var(--sp-6); }
    .sk.barra { height: var(--sp-2); border-radius: var(--radius-full); }
    @keyframes latido {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,
})
export class CreditoResumenComponent {
  private readonly finanzas = inject(MisFinanzasService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly resumen = signal<ResumenCredito | null>(null);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly visible = signal(localStorage.getItem(CREDITO_VISIBLE_KEY) === 'true');

  /** Crédito en la otra empresa; `null` si no hay o no se pudo preguntar. */
  readonly otra = signal<CreditoOtraEmpresa | null>(null);
  readonly cargandoOtra = signal(true);
  /** Elección del usuario. No se guarda: Inicio arranca siempre en la propia. */
  private readonly eligioOtra = signal(false);

  /** Solo se alterna si hay las dos; si acá no es cliente, la otra se muestra sola. */
  readonly puedeAlternar = computed(() => this.resumen() !== null && this.otra() !== null);
  readonly viendoOtra = computed(
    () => this.otra() !== null && (this.resumen() === null || this.eligioOtra()),
  );
  readonly mostrado = computed<ResumenCredito | null>(() =>
    this.viendoOtra() ? this.otra()!.resumen : this.resumen(),
  );

  constructor() {
    this.cargar();
    this.cargarOtra();
  }

  /** Una sola vez: Reintentar es de la propia, y repetirla le pegaría de nuevo al otro central. */
  private cargarOtra(): void {
    if (this.auth.usuario()?.persona?.id == null) {
      this.cargandoOtra.set(false);
      return;
    }
    this.finanzas
      .creditoOtraEmpresa()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (credito) => {
          this.otra.set(credito);
          this.cargandoOtra.set(false);
        },
        // Silencioso a propósito: también es lo que pasa contra un central que
        // todavía no tiene la query.
        error: () => this.cargandoOtra.set(false),
      });
  }

  cargar(): void {
    const personaId = this.auth.usuario()?.persona?.id;
    if (personaId == null) {
      // Sin persona en sesión no hay convenio posible. No es un fallo: la
      // card simplemente no aplica.
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(false);

    this.finanzas
      .resumenCredito(personaId, {
        // Inicio es la primera pantalla después del login. Sumar esta
        // consulta al contador global dejaba la barra de progreso corriendo
        // arriba de un Inicio que ya se ve entero, y un toast rojo de
        // "no se pudo conectar" tapando la pantalla de bienvenida. El fallo
        // se cuenta acá adentro, que es donde significa algo.
        mostrarCarga: false,
        notificarError: false,
      })
      .subscribe({
        next: (resumen) => {
          this.resumen.set(resumen);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set(true);
          this.cargando.set(false);
        },
      });
  }

  alternarVisibilidad(evento: Event): void {
    evento.stopPropagation();
    const nuevo = !this.visible();
    this.visible.set(nuevo);
    localStorage.setItem(CREDITO_VISIBLE_KEY, String(nuevo));
  }

  alternarEmpresa(evento: Event): void {
    evento.stopPropagation();
    this.eligioOtra.set(!this.eligioOtra());
  }

  /**
   * Enter y Espacio sobre la card navegan; sobre sus botones, no. El keydown de
   * un botón enfocado sube hasta acá, y sin este filtro activar el ojo con el
   * teclado también abría Mis finanzas.
   */
  teclaEnCard(evento: Event): void {
    if (evento.target !== evento.currentTarget) {
      return;
    }
    evento.preventDefault();
    this.verDetalle();
  }

  verDetalle(): void {
    void this.router.navigate(['/mis-finanzas']);
  }

  /** Verde mientras sobra, naranja cerca del tope, rojo si se pasó. */
  tono(r: ResumenCredito): 'ok' | 'warn' | 'danger' {
    if (r.disponible < 0) {
      return 'danger';
    }
    return r.porcentaje >= UMBRAL_WARN ? 'warn' : 'ok';
  }

  redondear(valor: number): number {
    return Math.round(valor);
  }
}
