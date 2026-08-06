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
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { FormaPago } from 'src/app/domains/forma-pago/forma-pago.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { NotaRecepcion } from 'src/app/domains/pedidos/recepcion.model';
import {
  SolicitudPagoEstado,
  SolicitudPagoInput,
} from 'src/app/domains/pedidos/solicitud-pago.model';
import { Proveedor, nombreProveedor } from 'src/app/domains/personas/proveedor.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { RecepcionService } from '../recepcion/recepcion.service';
import {
  faltaParaGuardar,
  fechaParaBackend,
  hayMonedasMezcladas,
  totalEstimado,
  yaEstaEnLaLista,
} from './solicitud-pago-reglas';
import { SolicitudPagoService } from './solicitud-pago.service';

/**
 * Alta de una solicitud de pago.
 *
 * Se entra por dos lados y el flujo cambia:
 *
 * 1. **Desde el menú**: se elige proveedor y se cargan notas por número.
 * 2. **Desde una recepción finalizada** (`?recepcionId=`): el backend precarga
 *    las notas elegibles, la moneda, la forma de pago y la fecha propuesta.
 *
 * ⚠️ **Lo que se ve como total es una estimación.** El monto real lo calcula
 * el central: descuenta lo rechazado en la recepción y convierte cada nota a
 * la moneda de la solicitud. `frc-mobile` mostraba la suma cruda sin decirlo,
 * de modo que el operador leía una cifra distinta de la que quedaba guardada.
 *
 * ⚠️ **Una nota elegible no es simplemente "una nota".** El backend solo
 * acepta las que están en `RECEPCION_COMPLETA`, no marcadas como pagadas y
 * que no pertenezcan ya a otra solicitud. Ese último dato no viaja en la
 * nota: por eso se pregunta al servidor una por una en vez de filtrar acá.
 */
@Component({
  selector: 'frc-solicitud-pago-nueva',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    CardComponent,
    SelectorComponent,
    IconoComponent,
    ImporteComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nueva solicitud de pago" [conVolver]="true">
      <frc-seccion titulo="1 · Proveedor" [panel]="true">
        @if (proveedor(); as p) {
          <p class="elegido">
            <frc-icono nombre="camion" [tamano]="18" />
            {{ nombre(p) }}
            @if (!desdeRecepcion()) {
              <button type="button" class="cambiar" (click)="cambiarProveedor()">Cambiar</button>
            }
          </p>
          @if (desdeRecepcion()) {
            <p class="ayuda">Viene de la recepción #{{ recepcionId() }}.</p>
          }
        } @else {
          <mat-form-field appearance="outline" class="campo">
            <mat-label>Buscar proveedor</mat-label>
            <input
              matInput
              [ngModel]="textoProveedor()"
              (ngModelChange)="textoProveedor.set($event)"
              (keyup.enter)="buscarProveedores()"
            />
          </mat-form-field>
          <button matButton="tonal" (click)="buscarProveedores()">Buscar</button>

          @for (p of proveedores(); track p.id) {
            <frc-card [titulo]="nombre(p)" icono="persona" (abrir)="elegirProveedor(p)" />
          }
        }
      </frc-seccion>

      @if (proveedor()) {
        <frc-seccion titulo="2 · Notas a pagar" [panel]="true">
          <mat-form-field appearance="outline" class="campo">
            <mat-label>Número de nota</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              [ngModel]="numeroNota()"
              (ngModelChange)="numeroNota.set($event)"
              (keyup.enter)="agregarNota()"
            />
          </mat-form-field>
          <button matButton="tonal" [disabled]="buscandoNota()" (click)="agregarNota()">
            {{ buscandoNota() ? 'Buscando…' : 'Agregar nota' }}
          </button>

          @if (notas().length === 0) {
            <p class="ayuda">
              Solo entran notas ya recibidas por completo que no estén en otra
              solicitud.
            </p>
          }

          @for (n of notas(); track n.id) {
            <frc-card
              [titulo]="tituloNota(n)"
              [subtitulo]="detalleNota(n)"
              icono="documento"
              [clickable]="false"
            >
              <button type="button" aparte class="quitar" (click)="quitarNota(n)">Quitar</button>
            </frc-card>
          }

          @if (notas().length > 0) {
            <div class="total">
              <span class="rotulo">Total estimado</span>
              <frc-importe
                [valor]="estimado()"
                [moneda]="denominacionMoneda()"
                [simbolo]="simboloMoneda()"
              />
            </div>
            <p class="ayuda">
              El monto definitivo lo calcula el servidor al guardar: le descuenta
              lo que se haya rechazado en la recepción.
              @if (monedasMezcladas()) {
                Además, estas notas no están todas en la misma moneda, así que
                las convierte a la de la solicitud.
              }
            </p>
          }
        </frc-seccion>

        <frc-seccion titulo="3 · Condiciones" [panel]="true">
          <frc-selector
            etiqueta="Moneda"
            [opciones]="opcionesMoneda()"
            [valor]="monedaId()"
            (valorChange)="monedaId.set($event == null ? null : +$event)"
          />
          <frc-selector
            etiqueta="Forma de pago"
            [opciones]="opcionesFormaPago()"
            [valor]="formaPagoId()"
            (valorChange)="formaPagoId.set($event == null ? null : +$event)"
          />
          <mat-form-field appearance="outline" class="campo">
            <mat-label>Fecha de pago propuesta</mat-label>
            <input
              matInput
              type="date"
              [ngModel]="fechaPropuesta()"
              (ngModelChange)="fechaPropuesta.set($event)"
            />
          </mat-form-field>
          <p class="ayuda">Es una propuesta al área de pagos, no un compromiso.</p>

          <mat-form-field appearance="outline" class="campo">
            <mat-label>Observaciones</mat-label>
            <input
              matInput
              [ngModel]="observaciones()"
              (ngModelChange)="observaciones.set($event)"
            />
          </mat-form-field>
        </frc-seccion>

        <button
          matButton="filled"
          class="guardar"
          [disabled]="guardando()"
          (click)="guardar()"
        >
          {{ guardando() ? 'Guardando…' : 'Crear solicitud' }}
        </button>
      }
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
    .elegido {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-weight: var(--fw-medium);
      margin: 0;
    }
    .cambiar, .quitar {
      background: none;
      border: 0;
      color: var(--brand-text);
      font-size: var(--fs-caption);
      cursor: pointer;
      padding: var(--sp-1);
    }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: var(--sp-3);
    }
    .rotulo { color: var(--text-soft); font-size: var(--fs-label); }
    .ayuda { color: var(--text-mute); font-size: var(--fs-caption); margin: 0; }
    .guardar { align-self: stretch; margin-top: var(--sp-3); }
  `,
})
export class SolicitudPagoNuevaPage {
  private readonly servicio = inject(SolicitudPagoService);
  private readonly recepciones = inject(RecepcionService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** `?recepcionId=` — entra precargada desde una recepción finalizada. */
  readonly recepcionId = input<string>();
  /** `?proveedorId=` — el proveedor de esa recepción. */
  readonly proveedorId = input<string>();

  readonly proveedor = signal<Proveedor | null>(null);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly notas = signal<NotaRecepcion[]>([]);
  readonly monedas = signal<Moneda[]>([]);
  readonly formasPago = signal<FormaPago[]>([]);
  readonly monedaId = signal<number | null>(null);
  readonly formaPagoId = signal<number | null>(null);
  readonly fechaPropuesta = signal<string | null>(null);
  readonly observaciones = signal('');

  readonly textoProveedor = signal('');
  readonly numeroNota = signal<number | null>(null);
  readonly buscandoNota = signal(false);
  readonly guardando = signal(false);

  readonly desdeRecepcion = computed(() => this.recepcionId() !== undefined);
  readonly estimado = computed(() => totalEstimado(this.notas()));
  readonly monedasMezcladas = computed(() => hayMonedasMezcladas(this.notas()));

  readonly opcionesMoneda = computed<OpcionSeleccion[]>(() =>
    this.monedas().map((m) => ({
      valor: m.id ?? null,
      texto: m.denominacion ?? 'Moneda',
      detalle: m.simbolo ?? undefined,
    })),
  );

  readonly opcionesFormaPago = computed<OpcionSeleccion[]>(() =>
    this.formasPago().map((f) => ({
      valor: f.id ?? null,
      texto: String(f.descripcion ?? 'Forma de pago'),
    })),
  );

  /**
   * La moneda elegida, para que el importe se muestre igual que en la lista y
   * en el detalle: con símbolo y con la precisión que corresponda.
   */
  private readonly monedaElegida = computed(() =>
    this.monedas().find((m) => String(m.id) === String(this.monedaId())),
  );

  readonly denominacionMoneda = computed(() => this.monedaElegida()?.denominacion ?? null);
  readonly simboloMoneda = computed(() => this.monedaElegida()?.simbolo ?? null);

  constructor() {
    this.recepciones.monedas().subscribe({ next: (lista) => this.monedas.set(lista) });
    this.servicio.formasPago().subscribe({ next: (lista) => this.formasPago.set(lista) });

    // Los parámetros de consulta se enlazan después del constructor, igual que
    // los de ruta. La precarga tiene que esperar a que lleguen.
    effect(() => {
      const recepcion = this.recepcionId();
      if (recepcion !== undefined) {
        this.precargarDesdeRecepcion(Number(recepcion));
      }
    });

    effect(() => {
      const proveedor = this.proveedorId();
      if (proveedor !== undefined && this.proveedor() == null) {
        this.cargarProveedor(Number(proveedor));
      }
    });
  }

  nombre(p: Proveedor): string {
    return nombreProveedor(p);
  }

  // ─────────────────────────────────────────────────────────── Precarga ──

  /**
   * Trae de la recepción lo que el backend ya resolvió.
   *
   * ⚠️ **Puede volver sin notas y no es un fallo.** Si la recepción se
   * finalizó pero sus notas ya están en otra solicitud —o quedaron en un
   * estado que no admite pago—, la lista viene vacía. Decirlo es la única
   * forma de que el operador no crea que la pantalla se colgó.
   */
  private precargarDesdeRecepcion(recepcionId: number): void {
    if (!Number.isFinite(recepcionId)) {
      return;
    }
    this.servicio.datosInicialesPorRecepcion(recepcionId).subscribe({
      next: (datos) => {
        const notas = datos?.notas ?? [];
        this.notas.set(notas);
        if (datos?.monedaId != null) {
          this.monedaId.set(Number(datos.monedaId));
        }
        if (datos?.formaPagoId != null) {
          this.formaPagoId.set(Number(datos.formaPagoId));
        }
        if (datos?.fechaPagoPropuesta) {
          // El backend la manda como `yyyy-MM-dd`, que es justo lo que espera
          // un `input[type=date]`.
          this.fechaPropuesta.set(datos.fechaPagoPropuesta.slice(0, 10));
        }
        if (notas.length === 0) {
          this.notificacion.warn(
            'Esta recepción no tiene notas pendientes de pago: o ya están en otra solicitud, o todavía no quedaron recibidas por completo.',
          );
        }
      },
    });
  }

  /**
   * Resuelve el nombre del proveedor que llegó como id en la URL.
   *
   * Se fija el id **antes** de consultar: es lo que el formulario necesita
   * para guardar y para buscar más notas. Si la consulta del nombre falla, la
   * pantalla sigue siendo usable con «Proveedor» genérico en vez de quedarse
   * trabada esperando un dato decorativo.
   */
  private cargarProveedor(proveedorId: number): void {
    if (!Number.isFinite(proveedorId)) {
      return;
    }
    this.proveedor.set({ id: proveedorId });
    this.servicio.proveedorPorId(proveedorId).subscribe({
      next: (p) => {
        if (p?.persona?.nombre) {
          this.proveedor.set(p);
        }
      },
      error: () => {
        // El id ya quedó puesto: no hay nada que revertir.
      },
    });
  }

  // ────────────────────────────────────────────────────────── Proveedor ──

  buscarProveedores(): void {
    const texto = this.textoProveedor().trim();
    if (texto.length === 0) {
      return;
    }
    this.servicio.proveedores(texto).subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.proveedores.set(contenido);
        if (contenido.length === 0) {
          this.notificacion.warn('Ningún proveedor con ese nombre.');
        }
      },
    });
  }

  elegirProveedor(p: Proveedor): void {
    this.proveedor.set(p);
    this.proveedores.set([]);
    this.textoProveedor.set('');
  }

  /**
   * ⚠️ **Cambiar de proveedor vacía las notas.** El central rechaza la
   * solicitud entera si alguna nota es de otro proveedor
   * (`"Todas las notas deben pertenecer al mismo proveedor"`), así que
   * dejarlas sería preparar un error al guardar.
   */
  async cambiarProveedor(): Promise<void> {
    if (this.notas().length > 0) {
      const ok = await this.dialogo.confirmar({
        titulo: 'Cambiar de proveedor',
        mensaje: 'Las notas cargadas son de este proveedor y se van a quitar.',
        confirmar: 'Cambiar',
      });
      if (!ok) {
        return;
      }
    }
    this.proveedor.set(null);
    this.notas.set([]);
  }

  // ─────────────────────────────────────────────────────────────── Notas ──

  async agregarNota(): Promise<void> {
    const numero = Number(this.numeroNota() ?? 0);
    const proveedorId = this.proveedor()?.id;
    if (!numero || proveedorId == null) {
      return;
    }

    this.buscandoNota.set(true);
    let nota: NotaRecepcion | null = null;
    try {
      nota = await firstValueFrom(this.servicio.notaDisponible(numero, proveedorId));
    } catch {
      this.buscandoNota.set(false);
      this.notificacion.danger('No se pudo consultar la nota.');
      return;
    }
    this.buscandoNota.set(false);

    if (!nota) {
      // El backend devuelve null para cuatro causas distintas y no dice cuál.
      this.notificacion.warn(
        'No hay ninguna nota con ese número disponible para pago: puede no existir, no estar recibida por completo, ya estar pagada o pertenecer a otra solicitud.',
      );
      return;
    }
    if (yaEstaEnLaLista(this.notas(), nota)) {
      this.notificacion.warn('Esa nota ya está en la lista.');
      return;
    }

    this.notas.update((previas) => [...previas, nota as NotaRecepcion]);
    this.numeroNota.set(null);
    this.adoptarMonedaDeNota(nota);
  }

  /** Si todavía no hay moneda elegida, la primera nota la define. */
  private adoptarMonedaDeNota(nota: NotaRecepcion): void {
    if (this.monedaId() == null && nota.moneda?.id != null) {
      this.monedaId.set(nota.moneda.id);
    }
  }

  quitarNota(nota: NotaRecepcion): void {
    this.notas.update((previas) => previas.filter((n) => String(n.id) !== String(nota.id)));
  }

  tituloNota(n: NotaRecepcion): string {
    return 'Nota ' + (n.numero ?? n.id);
  }

  detalleNota(n: NotaRecepcion): string {
    const partes = [
      fechaLegible(n.fecha),
      n.moneda?.denominacion,
      n.valorTotal != null ? 'valor ' + n.valorTotal.toLocaleString('es-PY') : '',
      n.estado,
    ];
    return partes.filter(Boolean).join(' · ');
  }

  // ───────────────────────────────────────────────────────────── Guardar ──

  async guardar(): Promise<void> {
    const falta = faltaParaGuardar({
      proveedorId: this.proveedor()?.id,
      monedaId: this.monedaId(),
      formaPagoId: this.formaPagoId(),
      notas: this.notas(),
    });
    if (falta) {
      this.notificacion.warn(falta);
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Crear solicitud de pago',
      mensaje:
        'Se pide autorización para pagar ' +
        (this.notas().length === 1 ? '1 nota' : this.notas().length + ' notas') +
        ' de ' +
        nombreProveedor(this.proveedor()) +
        '. El monto final lo calcula el servidor.',
      confirmar: 'Crear',
    });
    if (!ok) {
      return;
    }

    const input: SolicitudPagoInput = {
      proveedorId: this.proveedor()?.id as number,
      monedaId: this.monedaId() as number,
      formaPagoId: this.formaPagoId() as number,
      // El esquema lo exige (`Float!`), pero el central lo recalcula.
      montoTotal: this.estimado(),
      // Lo mismo con el estado: el `save` del central lo pisa con PENDIENTE.
      estado: SolicitudPagoEstado.PENDIENTE,
      notaRecepcionIds: this.notas().map((n) => n.id as number),
      fechaPagoPropuesta: fechaParaBackend(this.fechaPropuesta()),
      observaciones: this.observaciones().trim().toUpperCase() || undefined,
      usuarioId: this.auth.usuario()?.id,
    };

    this.guardando.set(true);
    this.servicio.crear(input).subscribe({
      next: (solicitud) => {
        this.guardando.set(false);
        if (solicitud?.id == null) {
          this.notificacion.warn('El servidor no devolvió la solicitud creada.');
          return;
        }
        this.notificacion.ok('Solicitud ' + (solicitud.numeroSolicitud ?? '') + ' creada.');
        void this.router.navigate(['/operaciones/solicitud-pago', solicitud.id]);
      },
      error: () => this.guardando.set(false),
    });
  }
}
