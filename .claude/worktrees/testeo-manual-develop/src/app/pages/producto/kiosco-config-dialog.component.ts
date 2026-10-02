import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef } from '@angular/material/dialog';

import { ServerConfigService } from 'src/app/core/config/server-config.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { KioscoConfigService, ModoLectura } from './kiosco-config.service';

/**
 * Configuración del kiosco: cómo lee, y contra qué servidor.
 *
 * ⚠️ **El servidor se muestra, no se edita.** `frc-mobile` repite acá el
 * formulario de IP y puerto —con `159.203.86.103` escrito a mano en el
 * componente— y eso deja dos lugares que hay que mantener sincronizados.
 * Cambiar de servidor cierra la sesión, así que no es algo que se haga con
 * un kiosco abierto: se hace desde *Mi cuenta → Servidor*, que es donde
 * vive. Acá se dice cuál está activo, que es la pregunta real de quien
 * instala la tablet.
 */
@Component({
  selector: 'frc-kiosco-config',
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caja">
      <h2>Configuración del kiosco</h2>

      <section>
        <h3>Cómo lee los códigos</h3>
        <div class="opciones">
          <button
            type="button"
            class="opcion"
            [class.activa]="config.modo() === 'lector'"
            (click)="elegir('lector')"
          >
            <span class="nombre">Lector</span>
            <span class="detalle">Hay un lector conectado. El campo queda enfocado y no sale el teclado.</span>
          </button>

          <button
            type="button"
            class="opcion"
            [class.activa]="config.modo() === 'camara'"
            [disabled]="!hayCamara"
            (click)="elegir('camara')"
          >
            <span class="nombre">Cámara</span>
            <span class="detalle">
              {{
                hayCamara
                  ? 'No hay lector. La cámara se vuelve a abrir sola después de cada consulta.'
                  : 'Este dispositivo no tiene cámara disponible.'
              }}
            </span>
          </button>
        </div>
      </section>

      <section>
        <h3>Servidor</h3>
        <p class="servidor">{{ servidor.baseUrl() }}</p>
        <p class="nota">
          Se cambia desde Mi cuenta → Servidor. Cambiarlo cierra la sesión, así que
          conviene hacerlo antes de dejar la tablet en la góndola.
        </p>
      </section>

      <div class="acciones">
        <button matButton="filled" (click)="ref.close()">Listo</button>
      </div>
    </div>
  `,
  styles: `
    .caja { display: flex; flex-direction: column; gap: var(--sp-4); }
    h2 { margin: 0; font-size: var(--fs-title); font-weight: var(--fw-medium); color: var(--text); }
    h3 {
      margin: 0 0 var(--sp-2);
      font-size: var(--fs-label);
      font-weight: var(--fw-medium);
      color: var(--text-soft);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .opciones { display: flex; flex-direction: column; gap: var(--sp-2); }
    .opcion {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      text-align: left;
      padding: var(--sp-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
    }
    .opcion:disabled { opacity: 0.5; cursor: default; }
    .opcion.activa { border-color: var(--brand-text); background: var(--surface-sunken); }
    .nombre { font-size: var(--fs-body); font-weight: var(--fw-medium); }
    .detalle { font-size: var(--fs-caption); color: var(--text-mute); }
    .servidor {
      margin: 0;
      font-family: var(--font-num);
      font-size: var(--fs-body);
      color: var(--text);
      word-break: break-all;
    }
    .nota { margin: var(--sp-1) 0 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .acciones { display: flex; justify-content: flex-end; }
  `,
})
export class KioscoConfigDialogComponent {
  readonly config = inject(KioscoConfigService);
  readonly servidor = inject(ServerConfigService);
  readonly ref = inject<MatDialogRef<KioscoConfigDialogComponent>>(MatDialogRef);

  /**
   * Sin cámara, el modo cámara deja el kiosco mudo: el campo no recibe nada
   * y no hay de dónde leer. Se deshabilita en vez de dejar elegirlo.
   */
  readonly hayCamara = inject(EscanerService).disponible;

  elegir(modo: ModoLectura): void {
    this.config.cambiarModo(modo);
  }
}
