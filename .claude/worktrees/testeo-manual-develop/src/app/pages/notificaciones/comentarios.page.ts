import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { NotificacionComentario } from 'src/app/domains/notificacion/notificacion.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { NotificacionesService } from './notificacion.service';

/** Un comentario con los que le responden. */
interface Hilo {
  comentario: NotificacionComentario;
  respuestas: NotificacionComentario[];
}

/**
 * Hilo de comentarios de una notificación.
 *
 * ⚠️ **Los comentarios son un árbol, no una lista.** `comentarioPadre`
 * permite responder a uno puntual; el backend los devuelve planos y el
 * agrupado se hace acá.
 *
 * Se soporta **un nivel de respuesta**, no anidamiento infinito: responder a
 * una respuesta engancha al mismo padre. En una pantalla de teléfono, tres
 * niveles de sangría dejan el texto en una columna de cinco caracteres.
 */
@Component({
  selector: 'frc-comentarios',
  standalone: true,
  imports: [
    PaginaComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Comentarios" [conVolver]="true">
      <div acciones>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
          <mat-label>{{ respondiendoA() ? 'Respuesta' : 'Comentario' }}</mat-label>
          <input
            matInput
            [ngModel]="texto()"
            (ngModelChange)="texto.set($event)"
            (keydown.enter)="enviar()"
          />
        </mat-form-field>
        <button matButton="filled" [disabled]="!puedeEnviar()" (click)="enviar()">Enviar</button>
      </div>

      @if (respondiendoA(); as padre) {
        <div class="respondiendo">
          Respondiendo a {{ autor(padre) }}
          <button matButton (click)="cancelarRespuesta()">Cancelar</button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (hilos().length === 0) {
        <frc-estado-vacio
          titulo="Sin comentarios"
          detalle="Escribí el primero para dejar constancia de qué se hizo con este aviso."
          icono="bandeja"
        />
      } @else {
        @for (hilo of hilos(); track hilo.comentario.id) {
          <article class="comentario">
            <div class="cabecera">
              <span class="autor">{{ autor(hilo.comentario) }}</span>
              <span class="fecha">{{ cuando(hilo.comentario) }}</span>
            </div>
            <p class="texto">{{ hilo.comentario.comentario }}</p>
            <button matButton class="responder" (click)="responder(hilo.comentario)">
              Responder
            </button>

            @for (r of hilo.respuestas; track r.id) {
              <article class="respuesta">
                <div class="cabecera">
                  <span class="autor">{{ autor(r) }}</span>
                  <span class="fecha">{{ cuando(r) }}</span>
                </div>
                <p class="texto">{{ r.comentario }}</p>
              </article>
            }
          </article>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
    .respondiendo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-2);
      padding: var(--sp-2) var(--sp-3);
      background: var(--surface-sunken);
      border-radius: var(--radius-sm);
      font-size: var(--fs-label);
      color: var(--text-soft);
    }
    .comentario {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: var(--sp-3);
    }
    .cabecera {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-2);
      font-size: var(--fs-caption);
    }
    .autor { font-weight: var(--fw-medium); }
    .fecha { color: var(--text-mute); }
    .texto {
      margin: var(--sp-1) 0 0;
      overflow-wrap: anywhere;
    }
    .responder {
      margin-top: var(--sp-1);
      margin-left: calc(var(--sp-2) * -1);
    }
    .respuesta {
      margin-top: var(--sp-2);
      margin-left: var(--sp-4);
      padding-left: var(--sp-3);
      border-left: 2px solid var(--border);
    }
  `,
})
export class ComentariosPage {
  private readonly servicio = inject(NotificacionesService);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly comentarios = signal<NotificacionComentario[]>([]);
  readonly texto = signal('');
  readonly respondiendoA = signal<NotificacionComentario | null>(null);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  readonly puedeEnviar = computed(() => this.texto().trim().length > 0 && !this.enviando());

  /** Agrupa los comentarios planos del backend en padre → respuestas. */
  readonly hilos = computed<Hilo[]>(() => {
    const todos = this.comentarios();
    const raices = todos.filter((c) => c.comentarioPadre?.id == null);
    return raices.map((comentario) => ({
      comentario,
      respuestas: todos.filter((c) => String(c.comentarioPadre?.id) === String(comentario.id)),
    }));
  });

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id)) {
      this.error.set('Identificador de notificación inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.comentarios(id).subscribe({
      next: (lista) => {
        this.comentarios.set(lista);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  autor(c: NotificacionComentario): string {
    return String(c.usuario?.persona?.nombre ?? c.usuario?.nickname ?? 'Alguien');
  }

  cuando(c: NotificacionComentario): string {
    return fechaLegible(c.creadoEn) ?? '';
  }

  responder(c: NotificacionComentario): void {
    this.respondiendoA.set(c);
  }

  cancelarRespuesta(): void {
    this.respondiendoA.set(null);
  }

  enviar(): void {
    const id = Number(this.id());
    const comentario = this.texto().trim();
    if (!Number.isFinite(id) || !comentario) {
      return;
    }

    this.enviando.set(true);
    // Responder a una respuesta engancha al mismo padre: un solo nivel.
    const padre = this.respondiendoA();
    const padreId = padre?.comentarioPadre?.id ?? padre?.id;

    this.servicio.comentar(id, comentario, padreId ? Number(padreId) : undefined).subscribe({
      next: () => {
        this.enviando.set(false);
        this.texto.set('');
        this.respondiendoA.set(null);
        this.cargar();
      },
      error: () => this.enviando.set(false),
    });
  }
}
