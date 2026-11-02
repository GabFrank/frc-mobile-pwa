import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { fotoADataUri } from 'src/app/core/dispositivo/imagen';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { MAX_FOTOS_FACTURA, OPCIONES_FOTO_FACTURA } from './compras-reglas';
import { ComprasService } from './compras.service';
import { FacturaFotoEstado } from './factura-foto.estado';

export interface ElegirTipoFacturaData {
  /** Con pedido, la factura en papel va a ese pedido; sin él, crea una compra nueva. */
  pedidoId: number | null;
}

/** `'qr'` si eligió la factura electrónica; `'papel'` si ya leyó las fotos y navegó. */
export type TipoFacturaElegido = 'qr' | 'papel';

interface Hoja {
  url: string;
  clave: number;
}

/**
 * Hoja para elegir cómo cargar la factura: electrónica (QR) o en papel (foto).
 *
 * Con «papel», el mismo diálogo junta las fotos (hasta {@link MAX_FOTOS_FACTURA}), llama a la
 * IA y navega a la revisión. La electrónica se resuelve afuera: el que abrió la hoja escanea.
 */
@Component({
  selector: 'frc-elegir-tipo-factura',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!enPapel()) {
      <h2 mat-dialog-title>Cargar factura</h2>
      <mat-dialog-content>
        <div class="opciones">
          <button type="button" class="opcion" (click)="cerrar('qr')">
            <frc-icono nombre="escanear" [tamano]="24" />
            <span>Factura electrónica (QR)</span>
          </button>
          <button type="button" class="opcion" (click)="enPapel.set(true)">
            <frc-icono nombre="camara" [tamano]="24" />
            <span>Factura en papel (foto)</span>
          </button>
        </div>
      </mat-dialog-content>
    } @else {
      <h2 mat-dialog-title>Factura en papel</h2>
      <mat-dialog-content>
        <p class="ayuda">
          Sacá una foto por hoja, con buena luz y la factura entera. Hasta {{ maximo }} fotos.
        </p>
        <div class="fotos">
          @for (f of fotos(); track f.clave) {
            <div class="foto">
              <img [src]="f.url" alt="Hoja de la factura" />
              <button type="button" class="quitar" aria-label="Quitar foto" [disabled]="leyendo()"
                (click)="quitar(f.clave)">
                <frc-icono nombre="cerrar" [tamano]="16" />
              </button>
            </div>
          }
          @if (fotos().length < maximo) {
            <button type="button" class="agregar" [disabled]="leyendo()" (click)="entrada.click()">
              <frc-icono nombre="camara" [tamano]="24" />
              <span>Agregar</span>
            </button>
          }
        </div>
        <input
          #entrada
          class="oculto"
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          (change)="agregar($event)"
        />
        @if (leyendo()) {
          <p class="leyendo" role="status">Leyendo factura… (puede tardar hasta un minuto)</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button matButton [disabled]="leyendo()" (click)="enPapel.set(false)">Volver</button>
        <button matButton="filled" [disabled]="fotos().length === 0 || leyendo()" (click)="leer()">
          {{ leyendo() ? 'Leyendo…' : 'Leer factura' }}
        </button>
      </mat-dialog-actions>
    }
  `,
  styles: `
    .opciones { display: flex; flex-direction: column; gap: var(--sp-2); }
    .opcion {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
      color: var(--text);
      font-size: var(--fs-body);
      cursor: pointer;
      text-align: left;
    }
    .opcion frc-icono { color: var(--brand-text); }
    .ayuda { margin: 0 0 var(--sp-3); font-size: var(--fs-label); color: var(--text-soft); }
    .leyendo { margin: var(--sp-3) 0 0; font-size: var(--fs-label); color: var(--text-soft); }
    .oculto { display: none; }
    .fotos { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .foto { position: relative; width: 88px; height: 88px; }
    .foto img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }
    .quitar {
      position: absolute;
      top: calc(-1 * var(--sp-1));
      right: calc(-1 * var(--sp-1));
      width: var(--sp-6);
      height: var(--sp-6);
      border: none;
      border-radius: var(--radius-full);
      background: var(--danger-fill);
      color: var(--on-tono);
      cursor: pointer;
      display: grid;
      place-items: center;
      line-height: 0;
    }
    .agregar {
      width: 88px;
      height: 88px;
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      background: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-1);
      font-size: var(--fs-caption);
      color: var(--text-soft);
      cursor: pointer;
    }
    .agregar frc-icono { color: var(--brand-text); }
  `,
})
export class ElegirTipoFacturaComponent {
  private readonly data = inject<ElegirTipoFacturaData>(MAT_DIALOG_DATA, { optional: true });
  private readonly ref = inject<MatDialogRef<ElegirTipoFacturaComponent, TipoFacturaElegido>>(
    MatDialogRef,
  );
  private readonly servicio = inject(ComprasService);
  private readonly router = inject(Router);
  private readonly estado = inject(FacturaFotoEstado);
  private readonly notificacion = inject(NotificacionService);

  readonly maximo = MAX_FOTOS_FACTURA;
  readonly enPapel = signal(false);
  readonly fotos = signal<Hoja[]>([]);
  readonly leyendo = signal(false);

  private siguienteClave = 0;

  cerrar(tipo: TipoFacturaElegido): void {
    this.ref.close(tipo);
  }

  /** Suma una hoja ya reducida; ignora las que sobran sobre el tope. */
  anadir(url: string): void {
    this.fotos.update((lista) =>
      lista.length >= this.maximo ? lista : [...lista, { url, clave: this.siguienteClave++ }],
    );
  }

  quitar(clave: number): void {
    this.fotos.update((lista) => lista.filter((f) => f.clave !== clave));
  }

  async agregar(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivos = Array.from(entrada.files ?? []);
    // Se limpia siempre: sin esto, elegir la misma foto dos veces no dispara `change`.
    entrada.value = '';
    const lugar = this.maximo - this.fotos().length;
    if (archivos.length > lugar) {
      this.notificacion.warn('Una factura admite hasta ' + this.maximo + ' fotos.');
    }
    for (const archivo of archivos.slice(0, Math.max(lugar, 0))) {
      try {
        this.anadir(await fotoADataUri(archivo, OPCIONES_FOTO_FACTURA));
      } catch {
        this.notificacion.danger('No se pudo procesar la foto. Probá con otra.');
      }
    }
  }

  leer(): void {
    if (this.fotos().length === 0 || this.leyendo()) return;
    const pedidoId = this.data?.pedidoId ?? null;
    this.leyendo.set(true);
    // Cerrar la hoja en plena lectura dejaría la llamada viva y la app saltaría sola a la revisión.
    this.ref.disableClose = true;
    this.servicio.leerFacturaFoto(this.fotos().map((f) => f.url), pedidoId).subscribe({
      next: (cabecera) => {
        this.estado.cabecera.set(cabecera);
        const ruta =
          pedidoId == null
            ? ['/operaciones/compras', 'foto']
            : ['/operaciones/compras', pedidoId, 'foto'];
        void this.router
          .navigate(ruta, { queryParams: { documentoId: cabecera.documentoId } })
          .then(() => this.ref.close('papel'));
      },
      // El motivo (sin clave de OpenAI, no es una factura…) ya lo mostró DatosService.
      error: () => {
        this.leyendo.set(false);
        this.ref.disableClose = false;
      },
    });
  }
}
