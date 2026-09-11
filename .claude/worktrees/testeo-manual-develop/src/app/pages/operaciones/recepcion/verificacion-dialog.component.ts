import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  MOTIVO_RECHAZO_ETIQUETAS,
  MetodoVerificacion,
  MotivoRechazoFisico,
  PedidoRecepcionProductoDto,
  RecepcionMercaderia,
} from 'src/app/domains/pedidos/recepcion.model';
import { Lote, loteRequiereAtencion, normalizarNumeroLote } from 'src/app/domains/operaciones/lote.model';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import {
  PRESENTACION_UNIDAD_BASE,
  aUnidadBase,
  escalaDe,
  pendienteDe,
  restanteDeCarga,
  resumirVerificacion,
  validarCarga,
  validarLinea,
} from './recepcion-cantidades';
import {
  detalleDeLote,
  fechaDeLote,
  indexarLotes,
  sugerenciasDeLote,
  textoDeSugerencias,
  validarLoteDeVerificacion,
} from './recepcion-lote';
import { RecepcionService } from './recepcion.service';
import {
  SeleccionarNotaRechazoData,
  SeleccionarNotaRechazoDialogComponent,
} from './seleccionar-nota-rechazo-dialog.component';

export interface VerificacionData {
  recepcion: RecepcionMercaderia;
  item: PedidoRecepcionProductoDto;
  /** Presentación con la que abrir. Si vino de un escaneo, la del código. */
  presentacion?: Presentacion | null;
  /** `ESCANER` si se llegó leyendo el código del producto. */
  metodo?: MetodoVerificacion;
}

/** Una carga parcial: «3 cajas», «2 unidades rechazadas por vencidas». */
interface Linea {
  cantidad: number;
  escala: number;
  etiqueta: string;
  motivo?: MotivoRechazoFisico;
}

/**
 * Cuánto llegó de este producto.
 *
 * Se carga por líneas porque la mercadería no baja del camión en una sola
 * forma: pueden venir dos cajas cerradas y cinco unidades sueltas del mismo
 * producto, y cada línea tiene su presentación. Al guardar se manda **un
 * total** y el backend lo reparte entre las notas.
 *
 * ⚠️ **Un rechazo siempre viaja con la línea de nota a la que se imputa.** Si
 * llegara sin ella, el backend devuelve éxito y no registra el rechazo. Ver
 * `seleccionar-nota-rechazo-dialog.component.ts`.
 */
@Component({
  selector: 'frc-verificacion-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    FormsModule,
    SelectorComponent,
    IconoComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.item.producto?.descripcion ?? 'Producto' }}</h2>

    <mat-dialog-content>
      <div class="resumen">
        <div class="celda">
          <span class="rotulo">A recibir</span>
          <span class="valor">{{ num(resumen().aRecibir) }}</span>
        </div>
        <div class="celda">
          <span class="rotulo">Recibido</span>
          <span class="valor ok">{{ num(resumen().recibido) }}</span>
        </div>
        <div class="celda">
          <span class="rotulo">Rechazado</span>
          <span class="valor danger">{{ num(resumen().rechazado) }}</span>
        </div>
        <div class="celda">
          <span class="rotulo">Falta</span>
          <span class="valor" [class.warn]="resumen().falta > 0">{{ num(resumen().falta) }}</span>
        </div>
      </div>
      <p class="escala">Cantidades en {{ unidad() }}.</p>

      @if (!enUnidadBase) {
        <frc-selector
          etiqueta="Presentación"
          [opciones]="opcionesPresentacion()"
          [valor]="presentacionId()"
          (valorChange)="cambiarPresentacion($event)"
        />
      }

      <mat-form-field appearance="outline" class="campo">
        <mat-label>Cantidad</mat-label>
        <input
          matInput
          cdkFocusInitial
          type="number"
          inputmode="decimal"
          min="0"
          [ngModel]="cantidad()"
          (ngModelChange)="cantidad.set($event)"
          (keyup.enter)="agregar()"
        />
      </mat-form-field>

      <mat-slide-toggle
        class="toggle"
        [ngModel]="esRechazo()"
        (ngModelChange)="esRechazo.set($event)"
      >
        Esta cantidad se rechaza
      </mat-slide-toggle>

      @if (esRechazo()) {
        <frc-selector
          etiqueta="Motivo del rechazo"
          [opciones]="opcionesMotivo"
          [valor]="motivo()"
          (valorChange)="motivo.set($any($event))"
        />
      }

      <button matButton="tonal" class="agregar" (click)="agregar()">Agregar</button>

      @if (lineas().length > 0) {
        <ul class="lineas">
          @for (linea of lineas(); track $index) {
            <li class="linea" [class.rechazo]="linea.motivo">
              <frc-icono [nombre]="linea.motivo ? 'alerta' : 'check'" [tamano]="18" />
              <span class="texto">
                {{ num(linea.cantidad) }} × {{ linea.etiqueta }}
                @if (linea.motivo) {
                  <span class="motivo">{{ etiquetaMotivo(linea.motivo) }}</span>
                }
              </span>
              <button type="button" class="quitar" aria-label="Quitar" (click)="quitar($index)">
                <frc-icono nombre="cerrar" [tamano]="18" />
              </button>
            </li>
          }
        </ul>
      }
      @if (muestraTrazabilidad) {
        <section class="trazabilidad">
          <h3 class="titulo">Trazabilidad</h3>

          @if (requiereLote) {
            <!--
              subscriptSizing dinámico: la ayuda ocupa dos renglones en un
              teléfono angosto y con la altura fija de Material se montaba
              encima de la etiqueta del campo siguiente.
            -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
              <mat-label>Número de lote</mat-label>
              <input
                matInput
                autocapitalize="characters"
                autocomplete="off"
                [ngModel]="lote()"
                (ngModelChange)="escribirLote($event)"
              />
              <mat-hint>Obligatorio: al escribir aparecen los lotes registrados.</mat-hint>
            </mat-form-field>

            @if (avisoLote(); as aviso) {
              <p class="aviso" [class.atencion]="aviso.requiereAtencion">{{ aviso.texto }}</p>
            }

            @if (sugerencias().opciones.length > 0) {
              <ul class="sugerencias">
                @for (s of sugerencias().opciones; track s.numeroLote) {
                  <li>
                    <button
                      type="button"
                      class="sugerencia"
                      [class.atencion]="s.requiereAtencion"
                      (click)="elegirLote(s.numeroLote)"
                    >
                      <span class="numero">{{ s.numeroLote }}</span>
                      <span class="detalle">{{ s.detalle }}</span>
                    </button>
                  </li>
                }
              </ul>
            }

            @if (ayudaSugerencias(); as ayuda) {
              <p class="aviso">{{ ayuda }}</p>
            }
          }

          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>Vencimiento</mat-label>
            <input
              matInput
              type="date"
              [disabled]="vencimientoBloqueado()"
              [ngModel]="vencimiento()"
              (ngModelChange)="vencimiento.set($event)"
            />
          </mat-form-field>

          @if (requiereLote) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
              <mat-label>Fecha de retiro</mat-label>
              <input
                matInput
                type="date"
                [disabled]="retiroBloqueado()"
                [ngModel]="fechaRetiro()"
                (ngModelChange)="fechaRetiro.set($event)"
              />
              <mat-hint>{{ ayudaRetiro() }}</mat-hint>
            </mat-form-field>
          }
        </section>
      }

    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton [disabled]="guardando()" (click)="cerrar()">Cancelar</button>
      <button matButton="filled" [disabled]="guardando()" (click)="guardar()">
        {{ guardando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content { display: flex; flex-direction: column; gap: var(--sp-3); }
    .resumen {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: var(--sp-2);
      padding: var(--sp-3);
      background: var(--surface-alt);
      border-radius: var(--radius-md);
    }
    .celda { display: flex; flex-direction: column; gap: var(--sp-1); text-align: center; }
    .rotulo { font-size: var(--fs-caption); color: var(--text-mute); }
    .valor {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .valor.ok { color: var(--ok); }
    .valor.danger { color: var(--danger); }
    .valor.warn { color: var(--warn); }
    .escala { font-size: var(--fs-caption); color: var(--text-mute); margin: 0; }
    .campo { width: 100%; }
    .toggle { align-self: flex-start; }
    .agregar { align-self: flex-start; }
    .trazabilidad {
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
      padding: var(--sp-3);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .titulo {
      margin: 0;
      font-size: var(--fs-label);
      font-weight: var(--fw-medium);
      color: var(--text-soft);
    }
    .aviso { margin: 0; font-size: var(--fs-caption); color: var(--text-soft); }
    .aviso.atencion { color: var(--danger); }
    .sugerencias {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      /* Tope duro: con seis opciones el vencimiento seguiría a la vista. */
      max-height: 40vh;
      overflow-y: auto;
    }
    .sugerencia {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-1);
      padding: var(--sp-2);
      background: var(--surface-alt);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .sugerencia.atencion { border-color: var(--danger); }
    .numero { font-weight: var(--fw-medium); }
    .detalle { font-size: var(--fs-caption); color: var(--text-mute); }
    .lineas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-1); }
    .linea {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .linea.rechazo { border-color: var(--danger); }
    .texto { flex: 1; }
    .motivo { display: block; font-size: var(--fs-caption); color: var(--text-mute); }
    .quitar {
      background: none;
      border: 0;
      padding: var(--sp-1);
      color: var(--text-mute);
      cursor: pointer;
      display: inline-flex;
    }
  `,
})
export class VerificacionDialogComponent {
  readonly data = inject<VerificacionData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<VerificacionDialogComponent, boolean>>(MatDialogRef);
  private readonly servicio = inject(RecepcionService);
  private readonly notificacion = inject(NotificacionService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly cantidad = signal<number | null>(null);
  readonly esRechazo = signal(false);
  readonly motivo = signal<MotivoRechazoFisico | null>(null);
  readonly lineas = signal<Linea[]>([]);
  readonly guardando = signal(false);

  readonly enUnidadBase = this.data.item.mostrarEnUnidadBase === true;

  readonly opcionesMotivo: OpcionSeleccion[] = Object.values(MotivoRechazoFisico).map((m) => ({
    valor: m,
    texto: MOTIVO_RECHAZO_ETIQUETAS[m],
  }));

  private readonly presentaciones = this.data.item.producto?.presentaciones ?? [];
  readonly presentacionId = signal<number | null>(null);

  readonly opcionesPresentacion = computed<OpcionSeleccion[]>(() =>
    this.presentaciones.map((p) => ({
      valor: p.id ?? null,
      texto: p.descripcion ?? 'Presentación',
      detalle: formatearCantidad(p.cantidad ?? 1, 0) + ' u.',
    })),
  );

  /** Cuánto multiplica la presentación elegida. */
  readonly escala = computed(() => escalaDe(this.presentacionActual(), this.enUnidadBase));

  readonly carga = computed(() => {
    let recibida = 0;
    let rechazada = 0;
    for (const linea of this.lineas()) {
      const unidades = aUnidadBase(linea.cantidad, linea.escala);
      if (linea.motivo) {
        rechazada += unidades;
      } else {
        recibida += unidades;
      }
    }
    return { recibida, rechazada };
  });

  readonly resumen = computed(() =>
    resumirVerificacion(this.data.item, this.escala(), this.carga()),
  );

  // ────────────────────────────────────────────────────── Trazabilidad ──

  /**
   * El producto se mueve por lote. Lo decide el producto, no la pantalla: el
   * central rechaza la verificación si falta el número.
   */
  readonly requiereLote = this.data.item.producto?.lote === true;
  /** El producto maneja vencimiento. Independiente del lote. */
  readonly requiereVencimiento = this.data.item.producto?.vencimiento === true;
  /**
   * El vencimiento también se pide para un producto con lote aunque no esté
   * marcado con vencimiento: es la fecha con la que se crea el lote en el
   * maestro y sin ella FEFO no puede ordenar nada.
   */
  readonly muestraTrazabilidad = this.requiereLote || this.requiereVencimiento;

  readonly lote = signal('');
  /** `yyyy-MM-dd`, el formato que espera y devuelve `input type=date`. */
  readonly vencimiento = signal('');
  readonly fechaRetiro = signal('');

  private readonly lotesDelProducto = signal<Lote[]>([]);

  private readonly lotesPorNumero = computed(() => indexarLotes(this.lotesDelProducto()));

  /** El lote registrado que coincide con lo tipeado, si lo hay. */
  readonly loteExistente = computed<Lote | null>(() => {
    const clave = normalizarNumeroLote(this.lote());
    return clave ? (this.lotesPorNumero().get(clave) ?? null) : null;
  });

  /**
   * Las fechas de un lote ya registrado no se editan desde acá.
   *
   * No es una restricción de la pantalla: `LoteService.obtenerOCrear` **nunca
   * pisa** una fecha ya cargada. Dejar el campo editable mostraría una fecha
   * distinta a la que se va a guardar. Las que el lote no tiene sí se cargan:
   * ésas el central las completa.
   */
  readonly vencimientoBloqueado = computed(() => !!fechaDeLote(this.loteExistente()?.fechaVencimiento));
  readonly retiroBloqueado = computed(() => !!fechaDeLote(this.loteExistente()?.fechaRetiro));

  readonly avisoLote = computed(() => {
    const lote = this.loteExistente();
    if (!lote) {
      return null;
    }
    return {
      texto: 'Lote ya registrado — ' + detalleDeLote(lote) + '.',
      requiereAtencion: loteRequiereAtencion(lote),
    };
  });

  readonly ayudaRetiro = computed(() =>
    this.retiroBloqueado()
      ? 'La define el lote ya registrado.'
      : 'Opcional: sin ella la calcula el central.',
  );

  /**
   * Filtra sobre la lista ya cargada: no hay una consulta por tecla.
   *
   * Solo aparecen **mientras se tipea**. Un producto de rotación alta junta
   * cientos de lotes y volcarlos todos al abrir el diálogo tapaba el
   * vencimiento y el retiro, que es lo que hay que cargar.
   */
  readonly sugerencias = computed(() => sugerenciasDeLote(this.lotesDelProducto(), this.lote()));

  /** Por qué no hay sugerencias, o qué queda fuera del corte. */
  readonly ayudaSugerencias = computed(() =>
    textoDeSugerencias(this.sugerencias(), this.lote(), !!this.loteExistente()),
  );

  /** Fechas que escribió el reconocimiento de lote, para poder deshacerlas. */
  private autocompletado = { vencimiento: '', fechaRetiro: '' };

  constructor() {
    if (!this.enUnidadBase) {
      const sugerida =
        this.data.presentacion ??
        this.data.item.presentacionInicialSugerida ??
        this.presentaciones[0];
      this.presentacionId.set(sugerida?.id ?? null);
    }
    // La cantidad esperada viene precargada: el caso normal es que llegue
    // todo, y así el operador solo confirma.
    const inicial = this.enUnidadBase
      ? this.data.item.cantidadPendientePorUnidad
      : this.data.item.cantidadInicialPorPresentacion;
    if (inicial != null && inicial > 0) {
      this.cantidad.set(inicial);
    }

    if (this.requiereLote) {
      this.cargarLotes();
      // Depende SOLO del lote reconocido: mientras el número siga apuntando al
      // mismo lote no se reescribe nada, y editar una fecha a mano no vuelve a
      // disparar el autocompletado —que la pisaría de nuevo—.
      effect(() => {
        const lote = this.loteExistente();
        untracked(() => this.aplicarFechasDelLote(lote));
      });
    }
  }

  private cargarLotes(): void {
    const productoId = this.data.item.producto?.id;
    if (productoId == null) {
      return;
    }
    this.servicio.lotesDeProducto(productoId).subscribe({
      next: (lotes) => this.lotesDelProducto.set(lotes),
      // Un fallo acá no puede frenar la recepción: se sigue pudiendo tipear el
      // número a mano, que es lo que el central necesita.
      error: () => this.lotesDelProducto.set([]),
    });
  }

  /**
   * Trae las fechas del lote reconocido, o deshace las que había traído el
   * anterior. Una fecha que el operador editó a mano después gana: solo se
   * borra lo que sigue siendo idéntico a lo autocompletado.
   */
  private aplicarFechasDelLote(lote: Lote | null): void {
    const vencimiento = fechaDeLote(lote?.fechaVencimiento);
    const retiro = fechaDeLote(lote?.fechaRetiro);

    // La fecha del lote registrado gana siempre: es la que el central va a
    // guardar, y mostrar otra sería mentirle al operador. Cuando el lote no la
    // tiene, se conserva lo que el operador haya escrito y solo se deshace lo
    // que había traído el lote anterior.
    if (vencimiento || this.vencimiento() === this.autocompletado.vencimiento) {
      this.vencimiento.set(vencimiento);
    }
    if (retiro || this.fechaRetiro() === this.autocompletado.fechaRetiro) {
      this.fechaRetiro.set(retiro);
    }
    this.autocompletado = { vencimiento, fechaRetiro: retiro };
  }

  /** El número se guarda y se manda en mayúsculas, igual que lo normaliza el central. */
  escribirLote(valor: string): void {
    this.lote.set((valor ?? '').toUpperCase());
  }

  elegirLote(numero: string): void {
    this.lote.set(numero);
  }

  unidad(): string {
    return this.enUnidadBase ? 'unidades' : 'presentaciones';
  }

  num(valor: number): string {
    return formatearCantidad(valor, Number.isInteger(valor) ? 0 : 2);
  }

  etiquetaMotivo(motivo: MotivoRechazoFisico): string {
    return MOTIVO_RECHAZO_ETIQUETAS[motivo];
  }

  cambiarPresentacion(valor: unknown): void {
    this.presentacionId.set(valor == null ? null : Number(valor));
  }

  agregar(): void {
    const cantidad = Number(this.cantidad() ?? 0);
    const escala = this.escala();
    const error = validarLinea(cantidad, escala, restanteDeCarga(this.data.item, this.carga()));
    if (error) {
      this.notificacion.warn(error);
      return;
    }
    if (this.esRechazo() && !this.motivo()) {
      this.notificacion.warn('Elegí el motivo del rechazo.');
      return;
    }

    this.lineas.update((previas) => [
      ...previas,
      {
        cantidad,
        escala,
        etiqueta: this.etiquetaPresentacion(),
        motivo: this.esRechazo() ? (this.motivo() as MotivoRechazoFisico) : undefined,
      },
    ]);

    this.cantidad.set(null);
    this.esRechazo.set(false);
    this.motivo.set(null);
  }

  quitar(indice: number): void {
    this.lineas.update((previas) => previas.filter((_, i) => i !== indice));
  }

  async guardar(): Promise<void> {
    const carga = this.carga();
    const pendiente = pendienteDe(this.data.item);
    const error = validarCarga(carga, pendiente);
    if (error) {
      this.notificacion.warn(error);
      return;
    }

    const productoId = this.data.item.producto?.id;
    const recepcionId = this.data.recepcion.id;
    const usuarioId = this.auth.usuario()?.id;
    if (productoId == null || recepcionId == null || usuarioId == null) {
      this.notificacion.danger('Faltan datos de la recepción.');
      return;
    }

    const numeroLote = normalizarNumeroLote(this.lote());
    const faltaLote = validarLoteDeVerificacion(this.requiereLote, carga.recibida, numeroLote);
    if (faltaLote) {
      this.notificacion.warn(faltaLote);
      return;
    }

    let notaItemId: number | null = null;
    let motivo: string | null = null;

    if (carga.rechazada > 0) {
      motivo = this.lineas().find((l) => l.motivo)?.motivo ?? null;
      notaItemId = await this.elegirNotaParaRechazo(recepcionId, productoId, carga.rechazada);
      if (notaItemId == null) {
        // Sin línea de nota el rechazo se perdería en silencio: se corta acá.
        return;
      }
    }

    this.guardando.set(true);
    this.servicio
      .verificar({
        recepcionId,
        productoId,
        cantidadRecibida: carga.recibida,
        cantidadRechazada: carga.rechazada,
        notaRecepcionItemIdParaRechazo: notaItemId,
        motivoRechazo: motivo,
        metodoVerificacion: this.data.metodo ?? MetodoVerificacion.MANUAL,
        // Trazabilidad de lo que entra. El central crea o reutiliza el lote del
        // maestro al finalizar la recepción, y de ahí sale el desglose de stock
        // por lote: sin esto la mercadería entra sin trazabilidad.
        lote: numeroLote || null,
        vencimientoRecibido: this.vencimiento() || null,
        fechaRetiro: this.fechaRetiro() || null,
        // Quien verifica es el que está operando ahora, no el que inició la
        // recepción: pueden ser personas distintas en el mismo camión.
        usuarioId,
      })
      .subscribe({
        next: (ok) => {
          this.guardando.set(false);
          if (ok) {
            this.notificacion.ok('Producto verificado.');
            this.ref.close(true);
          } else {
            this.notificacion.warn('El servidor no aceptó la verificación.');
          }
        },
        error: () => this.guardando.set(false),
      });
  }

  cerrar(): void {
    this.ref.close(false);
  }

  private presentacionActual(): Presentacion | null {
    if (this.enUnidadBase) {
      return PRESENTACION_UNIDAD_BASE;
    }
    const id = this.presentacionId();
    return this.presentaciones.find((p) => String(p.id) === String(id)) ?? null;
  }

  private etiquetaPresentacion(): string {
    if (this.enUnidadBase) {
      return 'unidad';
    }
    const p = this.presentacionActual();
    const nombre = p?.descripcion ?? 'presentación';
    return nombre + ' (' + formatearCantidad(p?.cantidad ?? 1, 0) + ' u.)';
  }

  /**
   * Resuelve a qué línea de nota se imputa el rechazo.
   *
   * Con una sola línea no se pregunta. Con varias, decide el operador: es la
   * nota contra la que se le reclama al proveedor.
   */
  private async elegirNotaParaRechazo(
    recepcionId: number,
    productoId: number,
    cantidadRechazada: number,
  ): Promise<number | null> {
    let items;
    try {
      items = await firstValueFrom(this.servicio.itemsDeProducto(recepcionId, productoId));
    } catch {
      this.notificacion.danger('No se pudieron leer las notas del producto.');
      return null;
    }

    if (!items || items.length === 0) {
      this.notificacion.warn('El producto no figura en ninguna nota de esta recepción.');
      return null;
    }
    if (items.length === 1) {
      return items[0].id ?? null;
    }

    const data: SeleccionarNotaRechazoData = {
      producto: this.data.item.producto?.descripcion ?? 'Producto',
      cantidadRechazada,
      items,
    };
    const ref = this.dialog.open<
      SeleccionarNotaRechazoDialogComponent,
      SeleccionarNotaRechazoData,
      number | undefined
    >(SeleccionarNotaRechazoDialogComponent, { data, width: '420px', maxWidth: '92vw' });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}
