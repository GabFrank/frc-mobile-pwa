import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { PdfService } from 'src/app/core/ui/pdf.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { NotaRecepcion } from 'src/app/domains/pedidos/recepcion.model';
import {
  SolicitudPago,
  SolicitudPagoNotaRecepcion,
} from 'src/app/domains/pedidos/solicitud-pago.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { puedeSolicitar, resumenDelPago } from './solicitud-pago-reglas';
import { SolicitudPagoService } from './solicitud-pago.service';

/**
 * Detalle de una solicitud de pago.
 *
 * ⚠️ **Es de solo lectura, a propósito.** Editar una solicitud
 * (`actualizarSolicitudPago`) y registrar el pago viven en el desktop: lo
 * primero solo vale en estado `PENDIENTE` y lo segundo exige un segundo
 * usuario que autorice. Acá se muestra lo que pasó y se saca la constancia.
 *
 * ⚠️ **El monto que se ve es el del backend**, no la suma de las notas de
 * pantalla: viene con los rechazos descontados y convertido a la moneda de la
 * solicitud. Por eso la nota puede figurar en 500.000 y su monto incluido en
 * 480.000 — no es un error de la pantalla.
 */
@Component({
  selector: 'frc-solicitud-pago-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    ImporteComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Solicitud de pago" [conVolver]="true">
      <div acciones class="botonera">
        @if (solicitud()) {
          @if (esBorrador()) {
            <button matButton="filled" [disabled]="solicitando()" (click)="solicitar()">
              {{ solicitando() ? 'Enviando…' : 'Solicitar' }}
            </button>
            <button matButton [disabled]="generando()" (click)="constancia()">
              {{ generando() ? 'Generando…' : 'Constancia' }}
            </button>
          } @else {
            <button matButton="filled" [disabled]="generando()" (click)="constancia()">
              {{ generando() ? 'Generando…' : 'Constancia' }}
            </button>
          }
        }
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (solicitud(); as s) {
        <frc-seccion titulo="Solicitud" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip enumerado="SolicitudPagoEstado" [valor]="s.estado ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Número" [valor]="s.numeroSolicitud ?? '—'" />
          <frc-dato etiqueta="Proveedor" [valor]="s.proveedor?.persona?.nombre ?? '—'" />
          <frc-dato etiqueta="Solicitada" [valor]="fecha(s.fechaSolicitud)" />
          <frc-dato etiqueta="Pago propuesto" [valor]="fecha(s.fechaPagoPropuesta)" />
          <!-- FormaPago.descripcion está tipado String, no string. -->
          <frc-dato etiqueta="Forma de pago" [valor]="texto(s.formaPago?.descripcion)" />
          <frc-dato etiqueta="Monto">
            <frc-importe
              [valor]="s.montoTotal ?? null"
              [moneda]="s.moneda?.denominacion ?? null"
              [simbolo]="s.moneda?.simbolo ?? null"
            />
          </frc-dato>
          @if (s.montoPagado != null) {
            <frc-dato etiqueta="Pagado">
              <frc-importe
                [valor]="s.montoPagado"
                [moneda]="s.moneda?.denominacion ?? null"
                [simbolo]="s.moneda?.simbolo ?? null"
              />
            </frc-dato>
          }
          <frc-dato etiqueta="Cargada por" [valor]="s.usuario?.persona?.nombre ?? '—'" />
          @if (s.observaciones) {
            <frc-dato etiqueta="Observaciones" [valor]="s.observaciones" />
          }
        </frc-seccion>

        @if (esBorrador()) {
          <frc-seccion titulo="Todavía es un borrador" [panel]="true">
            <p class="aviso">
              Esta solicitud <strong>no la ve quien paga</strong> hasta que se
              envíe. Tocá <strong>Solicitar</strong> para mandarla a la cola de
              pagos; hasta entonces se puede corregir desde el sistema de
              escritorio.
            </p>
          </frc-seccion>
        }

        <frc-seccion titulo="Pago" [panel]="true">
          <!-- El alias no se llama "texto" para no tapar al método texto(). -->
          @if (resumenPago(); as resumen) {
            <p class="pago">{{ resumen }}</p>
          } @else if (esBorrador()) {
            <p class="pago sin">
              Sin pago asociado, y no puede haberlo mientras sea un borrador.
            </p>
          } @else {
            <p class="pago sin">
              Todavía sin pago asociado. El pago se registra desde el sistema de
              escritorio, y lo autoriza un usuario distinto del que lo carga.
            </p>
          }
        </frc-seccion>

        <frc-seccion [titulo]="'Notas incluidas (' + notas().length + ')'">
          @for (n of notas(); track n.id) {
            <frc-card
              [titulo]="tituloNota(n.notaRecepcion)"
              [subtitulo]="subtituloNota(n.notaRecepcion)"
              icono="documento"
              [clickable]="false"
            >
              <frc-importe
                aparte
                [valor]="n.montoIncluido ?? null"
                [moneda]="s.moneda?.denominacion ?? null"
                [simbolo]="s.moneda?.simbolo ?? null"
              />
            </frc-card>
          }

          <p class="aclaracion">
            El monto de cada nota es el que calculó el servidor: valor de la nota
            menos lo rechazado en la recepción, convertido a
            {{ s.moneda?.denominacion ?? 'la moneda de la solicitud' }}.
          </p>
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: `
    .botonera:empty { display: none; }
    .pago { margin: 0; font-size: var(--fs-label); }
    .pago.sin { color: var(--text-mute); }
    .aviso { margin: 0; font-size: var(--fs-label); }
    .aclaracion {
      color: var(--text-mute);
      font-size: var(--fs-caption);
      margin: var(--sp-3) 0 0;
    }
  `,
})
export class SolicitudPagoDetallePage {
  private readonly servicio = inject(SolicitudPagoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly pdf = inject(PdfService);
  private readonly dialogo = inject(DialogoService);

  /** Llega de la ruta `:id` por `withComponentInputBinding`. */
  readonly id = input<string>();

  readonly solicitud = signal<SolicitudPago | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly generando = signal(false);
  readonly solicitando = signal(false);

  readonly notas = computed<SolicitudPagoNotaRecepcion[]>(
    () => this.solicitud()?.notasRecepcion ?? [],
  );
  readonly resumenPago = computed(() => resumenDelPago(this.solicitud()));
  readonly esBorrador = computed(() => puedeSolicitar(this.solicitud()?.estado));

  constructor() {
    // El valor del `input()` de ruta no está en el constructor: se enlaza
    // después. Sin el efecto, la primera carga saldría con `id` undefined.
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('La solicitud no tiene un identificador válido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (s) => {
        this.solicitud.set(s ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  fecha(valor: string | null | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  texto(valor: String | string | null | undefined): string {
    return valor != null && String(valor).length > 0 ? String(valor) : '—';
  }

  tituloNota(nota: NotaRecepcion | undefined): string {
    return 'Nota ' + (nota?.numero ?? nota?.id ?? '—');
  }

  subtituloNota(nota: NotaRecepcion | undefined): string {
    const partes = [fechaLegible(nota?.fecha), nota?.estado];
    return partes.filter(Boolean).join(' · ');
  }

  /**
   * Manda el borrador a la cola de pagos.
   *
   * Se pregunta antes porque es el gesto que hace visible la solicitud para
   * quien paga: a partir de acá deja de ser corregible.
   */
  async solicitar(): Promise<void> {
    const s = this.solicitud();
    if (s?.id == null) {
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Solicitar el pago',
      mensaje:
        'La solicitud ' +
        (s.numeroSolicitud ?? '') +
        ' pasa a la cola de pagos y deja de ser un borrador. Corregirla después hay que hacerlo desde el sistema de escritorio.',
      confirmar: 'Solicitar',
    });
    if (!ok) {
      return;
    }

    this.solicitando.set(true);
    this.servicio.solicitar(s.id).subscribe({
      next: () => {
        this.solicitando.set(false);
        this.notificacion.ok('Enviada a pagos.');
        // Se recarga entera: cambia el estado, el chip y la barra de acciones.
        this.cargar();
      },
      error: () => this.solicitando.set(false),
    });
  }

  /**
   * ⚠️ El PDF se abre **dentro del `next`**, sin `await` intermedio, porque
   * abrir una ventana solo se permite mientras dura el gesto del usuario.
   * Ver `PdfService`.
   */
  constancia(): void {
    const id = this.solicitud()?.id;
    if (id == null) {
      return;
    }
    this.generando.set(true);
    this.servicio.pdf(id).subscribe({
      next: (base64) => {
        this.generando.set(false);
        if (!base64) {
          this.notificacion.warn('El servidor no devolvió la constancia.');
          return;
        }
        const numero = this.solicitud()?.numeroSolicitud ?? id;
        this.pdf.abrirBase64(base64, 'solicitud-pago-' + numero + '.pdf');
      },
      error: () => this.generando.set(false),
    });
  }
}
