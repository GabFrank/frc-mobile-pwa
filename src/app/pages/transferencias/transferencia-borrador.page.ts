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
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Transferencia, TransferenciaItem } from 'src/app/domains/transferencia/transferencia.model';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { BuscadorProductoDialogComponent } from 'src/app/shared/producto/buscador-producto-dialog.component';
import { OpcionesBuscador, SeleccionProducto } from 'src/app/shared/producto/buscador.types';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import {
  esBorrador,
  itemDePreTransferencia,
  puedeFinalizar,
  unidadesDelBorrador,
} from './transferencia-alta';
import {
  TransferenciaItemData,
  TransferenciaItemDialogComponent,
  TransferenciaItemDraft,
} from './transferencia-item-dialog.component';
import { TransferenciaService } from './transferencia.service';

/**
 * Los ítems se traen todos de una: son los que se van a mandar, y el botón de
 * finalizar necesita saber si hay alguno. Un borrador con más de 500 renglones
 * no es un caso que exista en el depósito.
 */
const TODOS = 500;

/**
 * Cargar los productos de una transferencia recién creada.
 *
 * Es el segundo paso del alta, y la única pantalla donde una transferencia se
 * edita: en cuanto se finaliza pasa a `PRE_TRANSFERENCIA_ORIGEN` y sigue por
 * el detalle, con las etapas y su verificación ítem por ítem.
 *
 * ⚠️ **Cada ítem se guarda al agregarlo.** No hay una lista en memoria que se
 * confirme al final: cargar cuarenta renglones escaneando y perderlos porque
 * el service worker se actualizó, o porque alguien tocó atrás, es lo que la
 * persistencia inmediata evita. El costo es que un borrador abandonado queda
 * en la lista como `ABIERTA`, que es lo mismo que hace `frc-mobile`.
 *
 * ⚠️ **Solo escribe el grupo `PreTransferencia`.** Las otras tres etapas son
 * la razón de ser del módulo; ver [`transferencia-alta.ts`](./transferencia-alta.ts).
 */
@Component({
  selector: 'frc-transferencia-borrador',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Cargar transferencia" [conVolver]="true" [conEscaner]="false">
      <div acciones class="botonera">
        <button matButton [disabled]="guardando()" (click)="agregar()">Agregar producto</button>
        <button
          matButton="filled"
          [disabled]="!puedeFinalizar() || finalizando()"
          (click)="finalizar()"
        >
          {{ finalizando() ? 'Finalizando…' : 'Finalizar' }}
        </button>
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (transferencia(); as t) {
        <frc-seccion titulo="Transferencia" [panel]="true">
          <frc-dato etiqueta="Sale de" [valor]="t.sucursalOrigen?.nombre ?? '—'" />
          <frc-dato etiqueta="Llega a" [valor]="t.sucursalDestino?.nombre ?? '—'" />
          <frc-dato etiqueta="Número" [valor]="'#' + t.id" />
          <frc-dato etiqueta="Productos" [valor]="items().length" />
          <frc-dato etiqueta="Unidades" [valor]="unidades()" />
        </frc-seccion>

        @if (items().length === 0) {
          <frc-estado-vacio
            titulo="Sin productos"
            detalle="Agregá lo que se va a mandar. Se guarda a medida que lo cargás."
            icono="producto"
            accion="Agregar producto"
            (ejecutar)="agregar()"
          />
        } @else {
          <frc-seccion [titulo]="'Productos (' + items().length + ')'">
            @for (item of items(); track item.id) {
              <frc-card
                [titulo]="item.producto?.descripcion ?? 'Producto'"
                [subtitulo]="detalleDe(item)"
                icono="producto"
                (abrir)="editar(item)"
              >
                <span aparte class="cantidad">{{ cantidadDe(item) }}</span>
                @if (item.observacionPreTransferencia) {
                  <span pie class="observacion">{{ item.observacionPreTransferencia }}</span>
                }
                <button pie matButton [disabled]="guardando()" (click)="quitar(item, $event)">
                  Quitar
                </button>
              </frc-card>
            }
          </frc-seccion>
        }

        <!--
          Qué pasa al finalizar. Es el único momento en que la transferencia
          deja de ser editable, y conviene saberlo antes y no después.
        -->
        <frc-seccion titulo="Al finalizar" [panel]="true">
          <p class="aviso">
            Queda pendiente en origen y deja de poder editarse acá: la sigue
            quien la prepara. El stock se descuenta recién al despacharla.
          </p>
        </frc-seccion>
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
    .cantidad {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .observacion { font-size: var(--fs-caption); color: var(--text-mute); }
    .aviso { margin: 0; font-size: var(--fs-label); color: var(--text-soft); }
  `,
})
export class TransferenciaBorradorPage {
  private readonly servicio = inject(TransferenciaService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  readonly id = input<string>();

  readonly transferencia = signal<Transferencia | null>(null);
  readonly items = signal<TransferenciaItem[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly finalizando = signal(false);
  readonly error = signal<string | null>(null);

  readonly unidades = computed(() => formatearCantidad(unidadesDelBorrador(this.items()), 0));

  readonly puedeFinalizar = computed(() => puedeFinalizar(this.transferencia(), this.items()));

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
        // Lo que ya salió de creación no se edita acá: sus ítems son los que
        // otra etapa está verificando, y quitarlos por esta pantalla dejaría
        // a alguien preparando mercadería que ya no figura.
        if (t != null && !esBorrador(t)) {
          void this.router.navigate(['/transferencias', id], { replaceUrl: true });
        }
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
      // ⚠️ «No pude traerlos» no es «no tiene». Sin este aviso, un borrador ya
      // cargado se ve vacío y el operador lo carga entero de nuevo: la
      // mercadería termina saliendo dos veces.
      error: (err: Error) =>
        this.notificacion.warn('No se pudieron traer los productos cargados: ' + err.message),
    });
  }

  detalleDe(item: TransferenciaItem): string {
    const presentacion = item.presentacionPreTransferencia;
    return [
      presentacion ? etiquetaPresentacion(presentacion) : '',
      item.vencimientoPreTransferencia ? 'Vence ' + item.vencimientoPreTransferencia : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  cantidadDe(item: TransferenciaItem): string {
    const cantidad = item.cantidadPreTransferencia ?? 0;
    return formatearCantidad(cantidad, Number.isInteger(cantidad) ? 0 : 3);
  }

  /**
   * Elegir el producto y después cargar sus datos.
   *
   * ⚠️ **El buscador mira las dos sucursales.** Lo que hay en origen para
   * mandar y lo que ya hay en destino: reponer lo que allá sobra es el error
   * que la segunda columna evita. Es el modo que `ProductoCardComponent` ya
   * soportaba y que hasta ahora no usaba ninguna pantalla.
   */
  async agregar(): Promise<void> {
    const t = this.transferencia();
    if (t?.id == null) {
      return;
    }

    const opciones: OpcionesBuscador = {
      devuelve: 'presentacion',
      sucursalId: t.sucursalOrigen?.id,
      sucursalDestinoId: t.sucursalDestino?.id,
      etiquetaStock: 'Origen',
      etiquetaStockDestino: 'Destino',
    };

    const seleccion = await this.dialogo.abrir<
      BuscadorProductoDialogComponent,
      { titulo: string; opciones: OpcionesBuscador },
      SeleccionProducto | undefined
    >(BuscadorProductoDialogComponent, { titulo: 'Producto a transferir', opciones }, '95vw');

    if (!seleccion?.presentacion) {
      return;
    }

    const draft = await this.dialogo.abrir<
      TransferenciaItemDialogComponent,
      TransferenciaItemData,
      TransferenciaItemDraft | undefined
    >(TransferenciaItemDialogComponent, {
      producto: seleccion.producto,
      presentacion: seleccion.presentacion,
      sucursalOrigenId: t.sucursalOrigen?.id,
      // Un pesable ya trae los kilos en el código: no se vuelven a pedir.
      cantidadInicial: seleccion.peso,
    });

    if (!draft) {
      return;
    }

    this.guardar(
      itemDePreTransferencia({
        transferenciaId: t.id,
        presentacionId: seleccion.presentacion.id as number,
        cantidad: draft.cantidad,
        vencimiento: draft.vencimiento,
        observacion: draft.observacion,
      }),
    );
  }

  /** Corregir un renglón ya cargado: es el error más común al escanear. */
  async editar(item: TransferenciaItem): Promise<void> {
    const t = this.transferencia();
    const presentacion = item.presentacionPreTransferencia;
    if (t?.id == null || item.id == null || presentacion?.id == null) {
      return;
    }

    const draft = await this.dialogo.abrir<
      TransferenciaItemDialogComponent,
      TransferenciaItemData,
      TransferenciaItemDraft | undefined
    >(TransferenciaItemDialogComponent, {
      producto: item.producto ?? presentacion.producto ?? {},
      presentacion,
      sucursalOrigenId: t.sucursalOrigen?.id,
      draft: {
        cantidad: item.cantidadPreTransferencia ?? 0,
        vencimiento: item.vencimientoPreTransferencia ?? null,
        observacion: item.observacionPreTransferencia ?? '',
      },
    });

    if (!draft) {
      return;
    }

    this.guardar(
      itemDePreTransferencia({
        id: item.id,
        transferenciaId: t.id,
        presentacionId: presentacion.id,
        cantidad: draft.cantidad,
        vencimiento: draft.vencimiento,
        observacion: draft.observacion,
      }),
    );
  }

  async quitar(item: TransferenciaItem, evento: Event): Promise<void> {
    // La card entera abre la edición: sin esto, quitar también editaría.
    evento.stopPropagation();
    if (item.id == null) {
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Quitar el producto',
      mensaje: 'Se saca de la transferencia. Podés volver a agregarlo.',
      confirmar: 'Quitar',
      destructivo: true,
    });
    if (!ok) {
      return;
    }

    this.guardando.set(true);
    this.servicio.eliminarItem(item.id).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cargarItems();
      },
      error: () => this.guardando.set(false),
    });
  }

  /**
   * Cierra la creación: la transferencia pasa a estar pendiente en origen.
   *
   * ⚠️ **`finalizarTransferencia` devuelve `false` sin error** cuando el
   * estado no es `ABIERTA` —dos toques seguidos, o alguien que la movió desde
   * el escritorio—. Tratar ese `false` como éxito llevaría al detalle
   * anunciando algo que no ocurrió.
   */
  async finalizar(): Promise<void> {
    const t = this.transferencia();
    const usuarioId = this.auth.usuario()?.id;
    if (t?.id == null || usuarioId == null) {
      return;
    }
    if (!this.puedeFinalizar()) {
      this.notificacion.warn('Agregá al menos un producto antes de finalizar.');
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Finalizar la transferencia',
      mensaje:
        'Se manda ' +
        this.items().length +
        ' producto(s) de ' +
        (t.sucursalOrigen?.nombre ?? '—') +
        ' a ' +
        (t.sucursalDestino?.nombre ?? '—') +
        '. Queda pendiente en origen y ya no se edita acá.',
      confirmar: 'Finalizar',
    });
    if (!ok) {
      return;
    }

    this.finalizando.set(true);
    this.servicio.finalizar(t.id, usuarioId).subscribe({
      next: (hecho) => {
        this.finalizando.set(false);
        if (!hecho) {
          this.notificacion.danger('El central no pudo finalizarla. Actualizá y revisá su estado.');
          return;
        }
        this.notificacion.ok('Transferencia pendiente en origen.');
        void this.router.navigate(['/transferencias', t.id], { replaceUrl: true });
      },
      error: () => this.finalizando.set(false),
    });
  }

  private guardar(input: ReturnType<typeof itemDePreTransferencia>): void {
    this.guardando.set(true);
    this.servicio.guardarItem(input).subscribe({
      next: () => {
        this.guardando.set(false);
        this.cargarItems();
      },
      error: () => this.guardando.set(false),
    });
  }
}
