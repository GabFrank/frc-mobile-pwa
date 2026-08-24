import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  ConfiguracionNotificacion,
  descripcionDeTipo,
} from 'src/app/domains/notificacion/notificacion.model';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { NotificacionesService } from './notificacion.service';

/**
 * Qué notificaciones quiere recibir el usuario.
 *
 * ⚠️ **Las obligatorias se muestran deshabilitadas, no ocultas.** Son las de
 * control, que llegan sí o sí. Esconderlas haría creer que no existen y que
 * el aviso no va a llegar; mostrarlas apagadas dice la verdad: llega, y no se
 * puede evitar.
 */
@Component({
  selector: 'frc-preferencias-notificacion',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatSlideToggleModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Preferencias" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="5" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (configuraciones().length === 0) {
        <frc-estado-vacio
          titulo="Sin preferencias"
          detalle="No hay tipos de notificación configurables para tu usuario."
          icono="bandeja"
        />
      } @else {
        <frc-seccion titulo="Qué querés recibir" [panel]="true">
          @for (c of configuraciones(); track c.tipo) {
            <div class="fila">
              <div class="datos">
                <span class="titulo">{{ etiqueta(c) }}</span>
                @if (c.esObligatorio) {
                  <span class="obligatoria">Siempre se envía</span>
                }
              </div>
              <mat-slide-toggle
                [checked]="c.habilitado ?? true"
                [disabled]="c.esObligatorio === true"
                (change)="cambiar(c, $event.checked)"
              />
            </div>
          }
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: `
    .fila {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sp-3);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-light);
    }
    .fila:last-child { border-bottom: none; }
    .datos {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .titulo { font-size: var(--fs-label); }
    .obligatoria {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
  `,
})
export class PreferenciasPage {
  private readonly servicio = inject(NotificacionesService);
  private readonly notificacion = inject(NotificacionService);

  readonly configuraciones = signal<ConfiguracionNotificacion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.configuraciones().subscribe({
      next: (lista) => {
        this.configuraciones.set(this.ordenar(lista));
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * Cambia el interruptor en el acto y lo revierte si el backend rechaza.
   *
   * Esperar la respuesta para mover un toggle se siente roto; revertir ante
   * el fallo es honesto y no deja la pantalla mintiendo.
   */
  cambiar(config: ConfiguracionNotificacion, habilitado: boolean): void {
    if (!config.tipo || config.esObligatorio) {
      return;
    }
    this.aplicar(config.tipo, habilitado);

    this.servicio.cambiarPreferencia(config.tipo, habilitado).subscribe({
      error: () => {
        this.aplicar(config.tipo!, !habilitado);
        this.notificacion.danger('No se pudo cambiar la preferencia.');
      },
    });
  }

  /**
   * Qué dice la fila.
   *
   * El central manda `descripcion`, pero no para todos los tipos y no siempre
   * en la redacción que usa la lista de notificaciones. `DESCRIPCION_POR_TIPO`
   * es el respaldo local, y `tipo` el último recurso: una fila sin texto es
   * un interruptor que nadie sabe qué apaga.
   */
  etiqueta(config: ConfiguracionNotificacion): string {
    return config.descripcion || descripcionDeTipo(config.tipo);
  }

  /**
   * ⚠️ **El central devuelve esta lista sin orden.** La arma recorriendo un
   * `HashMap`, así que el orden cambia entre llamadas y los interruptores
   * saltan de lugar entre una entrada y la siguiente. Ordenar acá cuesta una
   * línea; en el central hay que tocar el servicio de preferencias.
   */
  private ordenar(lista: ConfiguracionNotificacion[]): ConfiguracionNotificacion[] {
    return [...lista].sort((a, b) => this.etiqueta(a).localeCompare(this.etiqueta(b), 'es'));
  }

  private aplicar(tipo: string, habilitado: boolean): void {
    this.configuraciones.update((lista) =>
      lista.map((c) => (c.tipo === tipo ? { ...c, habilitado } : c)),
    );
  }
}
