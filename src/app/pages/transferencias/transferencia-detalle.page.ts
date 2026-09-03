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
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_PRODUCTO, FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { TipoEntidad } from 'src/app/domains/enums/tipo-entidad.enum';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import {
  EtapaTransferencia,
  MotivoRechazo,
  Transferencia,
  TransferenciaItem,
} from 'src/app/domains/transferencia/transferencia.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { codificarQr, descodificarQr } from 'src/app/generic/utils/qrUtils';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { DatosQr, QrDialogComponent } from 'src/app/shared/qr/qr-dialog.component';
import {
  AVISO_ETAPA,
  AccionEtapa,
  ETAPA_ETIQUETAS,
  EtapaVerificacion,
  MOTIVO_RECHAZO_ETIQUETAS,
  VerificacionItem,
  accionDeEtapa,
  esEtapaDeVerificacion,
  inputDeVerificacion,
  itemModificado,
  itemRechazado,
  itemVerificado,
  itemsSinVerificar,
  puedeEditarEtapa,
  requiereDesconfirmarAntes,
  responsableDeEtapa,
} from './etapas';
import {
  ModificarItemData,
  ModificarItemDialogComponent,
} from './modificar-item-dialog.component';
import {
  RechazarItemData,
  RechazarItemDialogComponent,
} from './rechazar-item-dialog.component';
import { TransferenciaService } from './transferencia.service';

/**
 * Los ítems se traen todos de una.
 *
 * No es una lista para navegar: para habilitar «Concluir» hay que saber si
 * **todos** están verificados, y con paginación esa cuenta se haría sobre la
 * página visible. `frc-mobile` la hace así y por eso el botón se habilita con
 * ítems sin tocar en las páginas que nadie abrió.
 */
const TODOS = 500;

/** Lo que registró una etapa sobre un ítem. */
interface Paso {
  etiqueta: string;
  cantidad?: number;
  porBulto?: number;
  observacion?: string;
  rechazo?: string;
}

/** Cómo se llama cada etapa de verificación cuando se habla de un ítem. */
const ETIQUETA_DE_ETAPA: Record<EtapaVerificacion, string> = {
  [EtapaTransferencia.PREPARACION_MERCADERIA]: 'Preparado',
  [EtapaTransferencia.TRANSPORTE_VERIFICACION]: 'Despachado',
  [EtapaTransferencia.RECEPCION_EN_VERIFICACION]: 'Recibido',
};

/**
 * Detalle con **las cuatro etapas de cada ítem**, y el avance del workflow.
 *
 * Es la razón de ser del módulo: si se piden 10, se preparan 8, se despachan
 * 8 y llegan 7, las cuatro cifras quedan a la vista. La diferencia 10→8 es
 * falta de stock en origen; la 8→7, un faltante en tránsito. Mostrar solo la
 * última haría indistinguibles los dos casos.
 *
 * ⚠️ **Se muestra también la presentación de cada etapa.** Se pide en cajas y
 * se despacha en unidades: comparar cantidades sin mirar la presentación da
 * diferencias falsas.
 *
 * ⚠️ **Avanzar de etapa mueve stock.** El central da de baja en origen al
 * despachar y da de alta en destino al concluir la recepción. Por eso cada
 * avance pasa por un diálogo que dice qué va a pasar, y las etapas que
 * cierran una verificación no se habilitan con ítems sin revisar.
 */
@Component({
  selector: 'frc-transferencia-detalle',
  standalone: true,
  imports: [
    IconoComponent,
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
    MatMenuModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Transferencia" [conVolver]="true">
      <button accionBarra type="button" class="icono-compartir" aria-label="Compartir por QR" (click)="compartir()">
        <frc-icono nombre="codigo" [tamano]="22" />
      </button>

      <!--
        ⚠️ El atributo de proyección va en un hijo directo, fuera de todo
        bloque de control: lo que está dentro de un @if no llega al slot con
        nombre y termina arriba del contenido.

        Una sola acción: la que corresponde a la etapa en la que está. Un menú
        de etapas sería una invitación a saltear pasos que mueven stock.
      -->
      <div acciones class="botonera">
        @if (accion(); as a) {
          <button
            matButton="filled"
            [disabled]="!accionHabilitada()"
            (click)="avanzar(a)"
          >
            {{ a.texto }}
          </button>
        }
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (transferencia(); as t) {
        <frc-seccion titulo="Transferencia" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip enumerado="TransferenciaEstado" [valor]="t.estado ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Etapa" [valor]="etapaLegible()" />
          <frc-dato etiqueta="Origen" [valor]="t.sucursalOrigen?.nombre ?? '—'" />
          <frc-dato etiqueta="Destino" [valor]="t.sucursalDestino?.nombre ?? '—'" />
          <!--
            De qué lado está el usuario decide qué puede hacer. Lo resuelve el
            backend: no se infiere comparando ids de sucursal.
          -->
          <frc-dato etiqueta="Tu rol" [valor]="rol()" />
          <frc-dato etiqueta="Responsable" [valor]="quien(responsable())" />
          <frc-dato etiqueta="Creada" [valor]="fecha(t.creadoEn)" />
          @if (t.observacion) {
            <frc-dato etiqueta="Observación" [valor]="t.observacion" />
          }
        </frc-seccion>

        <!--
          Por qué el botón está apagado. Sin esto el operador ve «Concluir»
          gris y no tiene forma de saber que le falta revisar tres ítems que
          están más abajo en la lista.
        -->
        @if (motivoDeBloqueo(); as motivo) {
          <p class="bloqueo">{{ motivo }}</p>
        }

        <frc-seccion titulo="Quién intervino" [panel]="true">
          <frc-dato etiqueta="Pidió" [valor]="quien(t.usuarioPreTransferencia)" />
          <frc-dato etiqueta="Preparó" [valor]="quien(t.usuarioPreparacion)" />
          <frc-dato etiqueta="Transportó" [valor]="quien(t.usuarioTransporte)" />
          <frc-dato etiqueta="Recibió" [valor]="quien(t.usuarioRecepcion)" />
        </frc-seccion>

        @if (items().length === 0) {
          <frc-estado-vacio
            titulo="Sin productos"
            detalle="La transferencia todavía no tiene ítems cargados."
            icono="producto"
          />
        } @else {
          <frc-seccion [titulo]="'Productos (' + items().length + ')'">
            @if (verificando()) {
              <button matButton="tonal" class="escanear" (click)="escanearParaVerificar()">
                Escanear producto
              </button>
            }
            @for (item of items(); track item.id) {
              <article class="item">
                <div class="cabecera">
                  <div class="nombre">{{ item.producto?.descripcion ?? 'Producto' }}</div>
                  @if (verificando()) {
                    <span class="marca" [class]="'marca-' + marcaDe(item)">
                      {{ textoDeMarca(item) }}
                    </span>
                    @if (editable()) {
                      <button
                        type="button"
                        class="menu-btn"
                        [matMenuTriggerFor]="menu"
                        aria-label="Acciones del ítem"
                      >
                        <frc-icono nombre="masOpciones" [tamano]="20" />
                      </button>
                      <mat-menu #menu="matMenu">
                        <button mat-menu-item (click)="verificarProducto(item)">
                          <frc-icono nombre="escanear" [tamano]="18" />
                          <span class="etiqueta-menu">Verificar con el código</span>
                        </button>
                        <button mat-menu-item (click)="confirmar(item)">
                          <frc-icono nombre="check" [tamano]="18" />
                          <span class="etiqueta-menu">Confirmar como viene</span>
                        </button>
                        <button mat-menu-item (click)="modificar(item)">
                          <frc-icono nombre="editar" [tamano]="18" />
                          <span class="etiqueta-menu">Modificar</span>
                        </button>
                        <button mat-menu-item (click)="rechazar(item)">
                          <frc-icono nombre="cancelar" [tamano]="18" />
                          <span class="etiqueta-menu">Rechazar</span>
                        </button>
                        <button
                          mat-menu-item
                          [disabled]="!estaVerificado(item)"
                          (click)="desconfirmar(item)"
                        >
                          <frc-icono nombre="atras" [tamano]="18" />
                          <span class="etiqueta-menu">Deshacer</span>
                        </button>
                      </mat-menu>
                    }
                  }
                </div>
                <ul class="pasos">
                  @for (p of pasosDe(item); track p.etiqueta) {
                    <li class="paso">
                      <span class="etapa">{{ p.etiqueta }}</span>
                      <span class="cifra">
                        {{ cantidad(p) }}
                        @if (p.porBulto && p.porBulto > 1) {
                          <span class="bulto">× {{ p.porBulto }}</span>
                        }
                      </span>
                      @if (p.rechazo) {
                        <span class="rechazo">{{ legible(p.rechazo) }}</span>
                      }
                    </li>
                  }
                </ul>
              </article>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .botonera {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: var(--sp-2);
    }
    /* Sin acción para esta etapa el envoltorio queda vacío y la barra se oculta. */
    .botonera:empty { display: none; }
    .bloqueo {
      margin: 0;
      color: var(--warn);
      font-size: var(--fs-caption);
    }
    .escanear { align-self: stretch; }
    .item {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      padding: var(--sp-3);
    }
    .cabecera {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }
    .nombre {
      flex: 1;
      min-width: 0;
      font-weight: var(--fw-medium);
    }
    .marca {
      font-size: var(--fs-caption);
      border-radius: var(--radius-full);
      padding: 2px var(--sp-2);
      white-space: nowrap;
    }
    .marca-pendiente { background: var(--neutral-bg); color: var(--neutral); }
    .marca-verificado { background: var(--ok-bg); color: var(--ok); }
    .marca-modificado { background: var(--warn-bg); color: var(--warn); }
    .marca-rechazado { background: var(--danger-bg); color: var(--danger); }
    .menu-btn {
      background: none;
      border: 0;
      color: var(--text-mute);
      cursor: pointer;
      padding: var(--sp-1);
      line-height: 0;
    }
    .etiqueta-menu { margin-left: var(--sp-2); }
    .pasos {
      list-style: none;
      margin: var(--sp-2) 0 0;
      padding: 0;
    }
    .paso {
      display: flex;
      align-items: baseline;
      gap: var(--sp-2);
      padding: 2px 0;
      font-size: var(--fs-label);
    }
    .etapa {
      flex: 1;
      color: var(--text-soft);
    }
    .cifra {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .bulto {
      font-weight: var(--fw-regular);
      color: var(--text-mute);
    }
    .rechazo {
      font-size: var(--fs-caption);
      color: var(--danger);
    }
  `,
})
export class TransferenciaDetallePage {
  private readonly dialogo = inject(DialogoService);
  private readonly dialog = inject(MatDialog);
  private readonly servicio = inject(TransferenciaService);
  private readonly auth = inject(AuthService);
  private readonly escaner = inject(EscanerService);
  private readonly productos = inject(ProductoBusquedaService);
  private readonly notificacion = inject(NotificacionService);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly transferencia = signal<Transferencia | null>(null);
  readonly items = signal<TransferenciaItem[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly etapaLegible = computed(() => {
    const etapa = this.transferencia()?.etapa;
    return etapa ? ETAPA_ETIQUETAS[etapa] : '—';
  });
  readonly rol = computed(() => {
    const t = this.transferencia();
    if (t?.isOrigen && t?.isDestino) {
      return 'Origen y destino';
    }
    if (t?.isOrigen) {
      return 'Origen — preparás y despachás';
    }
    if (t?.isDestino) {
      return 'Destino — recibís y verificás';
    }
    return 'Solo consulta';
  });

  /** El responsable de la etapa en curso: el que puede tocar los ítems. */
  readonly responsable = computed(() => responsableDeEtapa(this.transferencia()));

  /** `true` si en esta etapa los ítems se verifican uno por uno. */
  readonly verificando = computed(() => esEtapaDeVerificacion(this.transferencia()?.etapa));

  /** `true` si este usuario es quien tomó la etapa —o si nadie la tomó—. */
  readonly puedeEditar = computed(() =>
    puedeEditarEtapa(this.transferencia(), this.auth.usuario()?.id),
  );

  /** `true` si se pueden tocar los ítems ahora mismo. */
  readonly editable = computed(() => this.verificando() && this.puedeEditar());

  /** El avance que corresponde desde la etapa actual. */
  readonly accion = computed<AccionEtapa | null>(() => accionDeEtapa(this.transferencia()));

  /** Los ítems que faltan revisar en la etapa en curso. */
  readonly pendientes = computed(() =>
    itemsSinVerificar(this.items(), this.transferencia()?.etapa),
  );

  /**
   * `true` si el botón de avance se puede apretar.
   *
   * Las etapas que **cierran** una verificación son las que exigen las dos
   * cosas: ser el responsable, y no dejar ítems sin revisar. Las otras —tomar
   * la preparación, pasar a transporte, iniciar la recepción— son justamente
   * el acto de hacerse cargo de la etapa siguiente, y ahí todavía no hay
   * responsable a quien pedirle permiso.
   */
  readonly accionHabilitada = computed(() => {
    const accion = this.accion();
    if (!accion) {
      return false;
    }
    if (!accion.exigeItemsVerificados) {
      return true;
    }
    return this.puedeEditar() && this.pendientes().length === 0;
  });

  /** Por qué el botón está apagado, en palabras. */
  readonly motivoDeBloqueo = computed<string | null>(() => {
    const accion = this.accion();
    if (!accion || this.accionHabilitada()) {
      return null;
    }
    if (!this.puedeEditar()) {
      const nombre = this.responsable()?.persona?.nombre;
      return nombre
        ? 'Esta etapa la está trabajando ' + nombre + '.'
        : 'Esta etapa la está trabajando otra persona.';
    }
    const faltan = this.pendientes().length;
    return faltan === 1
      ? 'Falta revisar 1 producto para poder continuar.'
      : 'Faltan revisar ' + faltan + ' productos para poder continuar.';
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
      this.error.set('Identificador de transferencia inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (t) => {
        this.transferencia.set(t ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });

    this.cargarItems();
  }

  cargarItems(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id)) {
      return;
    }
    this.servicio.items(id, 0, TODOS).subscribe({
      next: (lista) => this.items.set(lista),
      // Los ítems son secundarios respecto de la cabecera: si fallan, el
      // detalle sigue mostrando en qué estado está la transferencia.
      error: () => undefined,
    });
  }

  // ────────────────────────────────────────────────────── Avance de etapa ──

  /**
   * Avanza el workflow.
   *
   * ⚠️ **`avanzarEtapaTransferencia` es el único camino.** Guardar la
   * transferencia con la etapa cambiada saltea las validaciones y los
   * movimientos de stock que el central aplica en el avance.
   */
  async avanzar(accion: AccionEtapa): Promise<void> {
    const transferencia = this.transferencia();
    const usuarioId = this.auth.usuario()?.id;
    if (transferencia?.id == null || usuarioId == null) {
      return;
    }

    if (accion.exigeQrDeDestino && !(await this.confirmarSucursalDestino())) {
      return;
    }

    const confirmado = await this.dialogo.confirmar({
      titulo: 'Revisá los datos antes de continuar',
      mensaje: AVISO_ETAPA[accion.destino],
      confirmar: accion.texto,
    });
    if (!confirmado) {
      return;
    }

    this.servicio.avanzarEtapa(transferencia.id, accion.destino, usuarioId).subscribe({
      next: (ok) => {
        if (ok) {
          this.notificacion.ok(ETAPA_ETIQUETAS[accion.destino]);
          // Se recarga en vez de parchear: el avance escribe estado, etapa,
          // responsable y las cantidades de todos los ítems. Adivinar acá qué
          // quedó guardado es exactamente lo que hace que la pantalla muestre
          // algo distinto de lo que tiene el central.
          this.cargar();
        }
      },
      error: () => undefined,
    });
  }

  /**
   * Pide el QR de la sucursal de destino antes de abrir la recepción.
   *
   * ⚠️ **No bloquea si el escaneo se cancela.** Es lo que hace `frc-mobile`, y
   * a propósito: en varios teléfonos la cámara no abre, y la recepción no
   * puede quedar clavada por eso. Lo que sí frena es un QR que apunta a otra
   * sucursal — ahí la mercadería se está abriendo donde no debía llegar.
   */
  private async confirmarSucursalDestino(): Promise<boolean> {
    const destinoId = this.transferencia()?.sucursalDestino?.id;
    const codigo = await this.escaner.escanear({
      titulo: 'Escaneá el QR de la sucursal',
      ayuda: 'Confirmá que estás recibiendo en la sucursal de destino.',
      formatos: FORMATOS_QR,
    });
    if (!codigo) {
      return true;
    }

    const qr = descodificarQr(codigo);
    const tipo = (qr?.tipoEntidad ?? '').trim().toUpperCase();
    const sucursalId = Number(qr?.sucursalId);
    if (tipo !== TipoEntidad.SUCURSAL || !Number.isFinite(sucursalId)) {
      this.notificacion.warn('Ese código no es el QR de una sucursal.');
      return true;
    }
    if (destinoId != null && Number(destinoId) !== sucursalId) {
      this.notificacion.danger('El QR no es de la sucursal de destino de esta transferencia.');
      return false;
    }
    this.notificacion.ok('Sucursal confirmada.');
    return true;
  }

  // ─────────────────────────────────────────────────── Acciones por ítem ──

  /** Toma tal cual lo que declaró la etapa anterior. */
  confirmar(item: TransferenciaItem): void {
    void this.guardarVerificacion(item, {});
  }

  async modificar(item: TransferenciaItem): Promise<void> {
    const etapa = this.etapaDeVerificacion();
    if (!etapa) {
      return;
    }
    const data: ModificarItemData = {
      item,
      etapa,
      etiquetaEtapa: ETIQUETA_DE_ETAPA[etapa],
    };
    const ref = this.dialog.open<
      ModificarItemDialogComponent,
      ModificarItemData,
      VerificacionItem | undefined
    >(ModificarItemDialogComponent, { data, width: '420px', maxWidth: '94vw' });

    const cambios = await firstValueFrom(ref.afterClosed());
    if (cambios) {
      await this.guardarVerificacion(item, cambios);
    }
  }

  async rechazar(item: TransferenciaItem): Promise<void> {
    const etapa = this.etapaDeVerificacion();
    if (!etapa) {
      return;
    }
    const data: RechazarItemData = {
      producto: item.producto?.descripcion ?? 'Producto',
      etiquetaEtapa: ETIQUETA_DE_ETAPA[etapa],
    };
    const ref = this.dialog.open<
      RechazarItemDialogComponent,
      RechazarItemData,
      MotivoRechazo | undefined
    >(RechazarItemDialogComponent, { data, width: '380px', maxWidth: '94vw' });

    const motivo = await firstValueFrom(ref.afterClosed());
    if (!motivo) {
      return;
    }
    const guardado = await this.guardarVerificacion(item, { motivoRechazo: motivo });
    if (guardado) {
      this.avisarDelRechazo(item, motivo);
    }
  }

  /**
   * Deshace la verificación del ítem en esta etapa.
   *
   * ⚠️ **Va por `desconfirmarTransferenciaItem`, no por el save.** El save del
   * central es un PATCH y mandar `null` no borra: `frc-mobile` desconfirma
   * poniendo nulos y guardando, y contra este central eso deja el ítem tal
   * como estaba mientras la pantalla muestra lo contrario.
   */
  desconfirmar(item: TransferenciaItem): void {
    const etapa = this.etapaDeVerificacion();
    if (etapa == null || item.id == null) {
      return;
    }
    this.servicio
      .desconfirmarItem(item.id, etapa, { mensajeExito: 'Verificación deshecha' })
      .subscribe({
        next: () => this.cargarItems(),
        error: () => undefined,
      });
  }

  /**
   * Lee un código y avisa si corresponde —o no— al producto del ítem.
   *
   * Solo verifica: no confirma nada. Es el control de que se está mirando el
   * producto correcto antes de confirmarlo a mano.
   */
  async verificarProducto(item: TransferenciaItem): Promise<void> {
    const productoId = item.producto?.id;
    if (productoId == null) {
      this.notificacion.warn('El ítem no tiene producto asociado.');
      return;
    }
    const codigo = await this.escaner.escanear({
      titulo: 'Escaneá el producto',
      ayuda: item.producto?.descripcion ?? undefined,
      formatos: FORMATOS_PRODUCTO,
    });
    if (!codigo) {
      return;
    }

    let leido;
    try {
      leido = await firstValueFrom(this.productos.porEscaneo(codigo));
    } catch {
      leido = null;
    }
    if (!leido?.id) {
      this.notificacion.danger('Ningún producto tiene ese código.');
      return;
    }
    if (Number(leido.id) === Number(productoId)) {
      this.notificacion.ok('Producto correcto.');
    } else {
      this.notificacion.danger('No corresponde: ese código es de ' + leido.descripcion + '.');
    }
  }

  /** Busca el ítem del producto escaneado y abre su verificación. */
  async escanearParaVerificar(): Promise<void> {
    const codigo = await this.escaner.escanear({
      titulo: 'Escaneá el producto',
      ayuda: 'Se abre el ítem que corresponde a ese código.',
      formatos: FORMATOS_PRODUCTO,
    });
    if (!codigo) {
      return;
    }

    let leido;
    try {
      leido = await firstValueFrom(this.productos.porEscaneo(codigo));
    } catch {
      leido = null;
    }
    if (!leido?.id) {
      this.notificacion.danger('Ningún producto tiene ese código.');
      return;
    }
    const item = this.items().find((i) => Number(i.producto?.id) === Number(leido.id));
    if (!item) {
      this.notificacion.warn('Ese producto no está en esta transferencia.');
      return;
    }
    await this.modificar(item);
  }

  // ────────────────────────────────────────────────────────────── Interno ──

  /**
   * Guarda lo verificado y recarga los ítems.
   *
   * ⚠️ **Si el ítem traía un motivo y deja de tenerlo, primero se
   * desconfirma.** El save es un PATCH: mandar el motivo en `null` no lo
   * borra, así que confirmar un ítem antes rechazado lo dejaría rechazado
   * mientras la pantalla lo muestra en verde.
   */
  private async guardarVerificacion(
    item: TransferenciaItem,
    cambios: VerificacionItem,
  ): Promise<boolean> {
    const etapa = this.etapaDeVerificacion();
    const transferenciaId = this.transferencia()?.id;
    if (etapa == null || transferenciaId == null || item.id == null) {
      return false;
    }

    try {
      if (requiereDesconfirmarAntes(item, etapa, cambios)) {
        await firstValueFrom(this.servicio.desconfirmarItem(item.id, etapa));
      }
      const input = inputDeVerificacion(item, transferenciaId, etapa, cambios);
      await firstValueFrom(this.servicio.guardarItem(input));
      // Se recarga en vez de parchear la fila: el central recalcula el
      // movimiento de stock al guardar, y adivinar acá qué quedó sería
      // mostrar un número que no es el que se guardó.
      this.cargarItems();
      return true;
    } catch {
      // `DatosService` ya mostró el error.
      return false;
    }
  }

  /**
   * Avisa por push del rechazo a quien trabajó la etapa anterior.
   *
   * ⚠️ **En `frc-mobile` el aviso va al responsable de la etapa en curso**,
   * que es quien acaba de rechazar: se manda un push a sí mismo. El que
   * necesita enterarse es el de la etapa anterior — el que preparó lo que
   * ahora se rechaza—, y es a quien se avisa acá.
   *
   * Es best-effort: el rechazo ya está guardado y un push que falla no puede
   * voltearlo.
   */
  private avisarDelRechazo(item: TransferenciaItem, motivo: MotivoRechazo): void {
    const t = this.transferencia();
    const personaId = this.responsableAnterior()?.persona?.id;
    if (personaId == null || t?.id == null) {
      return;
    }
    this.servicio
      .avisarPorPush(
        Number(personaId),
        'Ítem rechazado en la transferencia ' + t.id,
        (item.producto?.descripcion ?? 'Un ítem') +
          ' fue rechazado por: ' +
          MOTIVO_RECHAZO_ETIQUETAS[motivo],
      )
      .subscribe({ next: () => undefined, error: () => undefined });
  }

  /** Quién trabajó la etapa anterior a la que está verificando. */
  private responsableAnterior(): Transferencia['usuarioPreparacion'] {
    const t = this.transferencia();
    switch (t?.etapa) {
      case EtapaTransferencia.PREPARACION_MERCADERIA:
        return t?.usuarioPreTransferencia;
      case EtapaTransferencia.TRANSPORTE_VERIFICACION:
        return t?.usuarioPreparacion;
      case EtapaTransferencia.RECEPCION_EN_VERIFICACION:
        return t?.usuarioTransporte;
      default:
        return undefined;
    }
  }

  private etapaDeVerificacion(): EtapaVerificacion | null {
    const etapa = this.transferencia()?.etapa;
    return esEtapaDeVerificacion(etapa) ? etapa : null;
  }

  // ───────────────────────────────────────────────────────────── Plantilla ──

  estaVerificado(item: TransferenciaItem): boolean {
    const etapa = this.etapaDeVerificacion();
    return etapa != null && itemVerificado(item, etapa);
  }

  /** `pendiente` · `verificado` · `modificado` · `rechazado`. */
  marcaDe(item: TransferenciaItem): string {
    const etapa = this.transferencia()?.etapa;
    if (itemRechazado(item, etapa)) {
      return 'rechazado';
    }
    if (itemModificado(item, etapa)) {
      return 'modificado';
    }
    return this.estaVerificado(item) ? 'verificado' : 'pendiente';
  }

  textoDeMarca(item: TransferenciaItem): string {
    switch (this.marcaDe(item)) {
      case 'rechazado':
        return 'Rechazado';
      case 'modificado':
        return 'Modificado';
      case 'verificado':
        return 'Verificado';
      default:
        return 'Sin revisar';
    }
  }

  /**
   * Las cuatro etapas de un ítem, **omitiendo las que todavía no pasaron**.
   *
   * Una etapa sin cantidad no es «cero unidades»: es «no llegó ahí».
   * Mostrarla en cero diría algo falso.
   */
  pasosDe(item: TransferenciaItem): Paso[] {
    const todos: Paso[] = [
      {
        etiqueta: 'Pedido',
        cantidad: item.cantidadPreTransferencia,
        porBulto: item.presentacionPreTransferencia?.cantidad,
        rechazo: item.motivoRechazoPreTransferencia,
      },
      {
        etiqueta: 'Preparado',
        cantidad: item.cantidadPreparacion,
        porBulto: item.presentacionPreparacion?.cantidad,
        rechazo: item.motivoRechazoPreparacion,
      },
      {
        etiqueta: 'Despachado',
        cantidad: item.cantidadTransporte,
        porBulto: item.presentacionTransporte?.cantidad,
        rechazo: item.motivoRechazoTransporte,
      },
      {
        etiqueta: 'Recibido',
        cantidad: item.cantidadRecepcion,
        porBulto: item.presentacionRecepcion?.cantidad,
        rechazo: item.motivoRechazoRecepcion,
      },
    ];
    return todos.filter((p) => p.cantidad != null);
  }

  cantidad(p: Paso): string {
    return formatearCantidad(p.cantidad ?? 0, Number.isInteger(p.cantidad ?? 0) ? 0 : 2);
  }

  quien(usuario: { persona?: { nombre?: string } } | undefined): string {
    return usuario?.persona?.nombre ?? '—';
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  legible(valor: string): string {
    const limpio = String(valor ?? '').replace(/_/g, ' ').toLowerCase();
    return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : '—';
  }

  /**
   * Muestra un QR para que otro lo abra escaneándolo.
   *
   * ⚠️ **El id no va en el mismo campo para todos los tipos.** Acá se
   * escriben los que `rutearEscaneo` lee para `TRANSFERENCIA`; la tabla
   * completa está en `docs/arquitectura/qr-del-sistema.md`. Poner el id en
   * el campo equivocado da un QR que se escanea sin error y abre otra cosa.
   */
  async compartir(): Promise<void> {
    const id = this.transferencia()?.id;
    if (id == null) {
      return;
    }
    await this.dialogo.abrir<QrDialogComponent, DatosQr>(QrDialogComponent, {
      titulo: 'Compartir transferencia',
      subtitulo: 'Transferencia #' + id,
      codigo: codificarQr({ tipoEntidad: TipoEntidad.TRANSFERENCIA, idOrigen: String(id), idCentral: String(id) }),
    });
  }
}
