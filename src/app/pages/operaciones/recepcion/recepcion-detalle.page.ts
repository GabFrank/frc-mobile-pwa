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

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_PRODUCTO } from 'src/app/core/dispositivo/escaner.types';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PdfService } from 'src/app/core/ui/pdf.service';
import {
  MetodoVerificacion,
  MotivoRechazoFisico,
  PedidoRecepcionProductoDto,
  PedidoRecepcionProductoEstado,
  RecepcionMercaderia,
  RecepcionMercaderiaEstado,
} from 'src/app/domains/pedidos/recepcion.model';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import {
  MotivoRechazoData,
  MotivoRechazoDialogComponent,
} from './motivo-rechazo-dialog.component';
import { itemsPendientes, pendienteDe, puedeDeshacer } from './recepcion-cantidades';
import { RecepcionService } from './recepcion.service';
import {
  VerificacionData,
  VerificacionDialogComponent,
} from './verificacion-dialog.component';

const TAMANO = 10;
/** Para contar pendientes se pide todo de una: es un chequeo, no una lista. */
const TODOS = 500;

interface OpcionFiltro {
  etiqueta: string;
  valor: PedidoRecepcionProductoEstado | null;
}

const FILTROS: OpcionFiltro[] = [
  { etiqueta: 'Todos', valor: null },
  { etiqueta: 'Pendientes', valor: PedidoRecepcionProductoEstado.PENDIENTE },
  { etiqueta: 'Recibidos', valor: PedidoRecepcionProductoEstado.RECIBIDO },
  { etiqueta: 'Parciales', valor: PedidoRecepcionProductoEstado.RECIBIDO_PARCIALMENTE },
];

/**
 * Verificación producto por producto de una recepción.
 *
 * ⚠️ **La lista es por producto, no por nota.** Si el mismo producto viene en
 * tres notas, acá hay una fila con la suma; el reparto lo hace el backend.
 *
 * ⚠️ **Escanear es el camino normal.** Con el código en la mano el operador
 * no busca en la lista: lee, y se abre el diálogo del producto ya cargado.
 */
@Component({
  selector: 'frc-recepcion-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    IconoComponent,
    MatButtonModule,
    MatMenuModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Recepción" [conVolver]="true">
      <div acciones>
        @if (enProceso()) {
          <button matButton="filled" (click)="escanear()">Escanear</button>
        }
        <button matButton [matMenuTriggerFor]="menu" aria-label="Más opciones">
          <frc-icono nombre="masOpciones" />
        </button>
        <mat-menu #menu="matMenu">
          @if (enProceso()) {
            <button mat-menu-item (click)="finalizar()">Finalizar recepción</button>
          }
          @if (finalizada()) {
            <button mat-menu-item (click)="reabrir()">Reabrir recepción</button>
          }
          <button mat-menu-item (click)="constancia()">Ver constancia (PDF)</button>
        </mat-menu>
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (recepcion(); as r) {
        <frc-seccion titulo="Recepción" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip enumerado="RecepcionMercaderiaEstado" [valor]="r.estado ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Proveedor" [valor]="r.proveedor?.persona?.nombre ?? '—'" />
          <frc-dato etiqueta="Sucursal" [valor]="r.sucursalRecepcion?.nombre ?? '—'" />
          <frc-dato etiqueta="Fecha" [valor]="fecha(r.fecha)" />
          <frc-dato etiqueta="Notas" [valor]="r.notas?.length ?? 0" />
        </frc-seccion>

        <div class="filtros">
          @for (f of filtros; track f.etiqueta) {
            <button
              type="button"
              class="filtro"
              [class.activo]="filtro() === f.valor"
              (click)="cambiarFiltro(f.valor)"
            >
              {{ f.etiqueta }}
            </button>
          }
        </div>

        @if (productos().length === 0) {
          <frc-estado-vacio
            titulo="Sin productos"
            detalle="No hay productos con este filtro."
            icono="producto"
          />
        } @else {
          <frc-seccion [titulo]="'Productos (' + productos().length + ')'">
            @for (p of productos(); track p.producto?.id) {
              <frc-card
                [titulo]="p.producto?.descripcion ?? 'Producto'"
                [subtitulo]="cantidades(p)"
                icono="producto"
                (abrir)="verificar(p)"
              >
                <frc-estado-chip
                  pie
                  enumerado="PedidoRecepcionProductoEstado"
                  [valor]="p.estado ?? null"
                />
                @if (deshacible(p)) {
                  <button type="button" aparte class="deshacer" (click)="deshacer(p, $event)">
                    Deshacer
                  </button>
                }
              </frc-card>
            }
          </frc-seccion>

          @if (hayMas()) {
            <button matButton class="mas" [disabled]="cargandoMas()" (click)="cargarMas()">
              {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
            </button>
          }
        }
      }
    </frc-pagina>
  `,
  styles: `
    .filtros { display: flex; gap: var(--sp-2); flex-wrap: wrap; }
    .filtro {
      border: 1px solid var(--border);
      background: none;
      color: var(--text);
      border-radius: var(--radius-pill);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--fs-caption);
      cursor: pointer;
    }
    .filtro.activo {
      background: var(--brand-fill);
      color: var(--on-tono);
      border-color: var(--brand-fill);
    }
    .deshacer {
      background: none;
      border: 0;
      color: var(--brand-text);
      font-size: var(--fs-caption);
      cursor: pointer;
      padding: var(--sp-1);
    }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class RecepcionDetallePage {
  private readonly servicio = inject(RecepcionService);
  private readonly productosService = inject(ProductoBusquedaService);
  private readonly escaner = inject(EscanerService);
  private readonly dialogo = inject(DialogoService);
  private readonly dialog = inject(MatDialog);
  private readonly notificacion = inject(NotificacionService);
  private readonly pdf = inject(PdfService);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly filtros = FILTROS;

  readonly recepcion = signal<RecepcionMercaderia | null>(null);
  readonly productos = signal<PedidoRecepcionProductoDto[]>([]);
  readonly filtro = signal<PedidoRecepcionProductoEstado | null>(null);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private pagina = 0;

  readonly enProceso = computed(() => {
    const estado = this.recepcion()?.estado;
    return (
      estado === RecepcionMercaderiaEstado.EN_PROCESO ||
      estado === RecepcionMercaderiaEstado.PENDIENTE
    );
  });
  readonly finalizada = computed(
    () => this.recepcion()?.estado === RecepcionMercaderiaEstado.FINALIZADA,
  );

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
      this.error.set('Identificador de recepción inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (r) => {
        this.recepcion.set(r ?? null);
        this.cargando.set(false);
        this.cargarProductos();
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  cargarProductos(agregando = false): void {
    const id = this.recepcion()?.id;
    if (id == null) {
      return;
    }
    if (!agregando) {
      this.pagina = 0;
      this.productos.set([]);
    }

    this.servicio.productos(id, this.filtro(), this.pagina, TAMANO).subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.productos.update((previos) =>
          agregando ? [...previos, ...contenido] : contenido,
        );
        this.hayMas.set(page?.hasNext === true);
        this.cargandoMas.set(false);
      },
      error: () => this.cargandoMas.set(false),
    });
  }

  cargarMas(): void {
    this.pagina += 1;
    this.cargandoMas.set(true);
    this.cargarProductos(true);
  }

  cambiarFiltro(valor: PedidoRecepcionProductoEstado | null): void {
    this.filtro.set(valor);
    this.cargarProductos();
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  /** «Faltan 12 de 48» — lo pendiente adelante, que es lo accionable. */
  cantidades(p: PedidoRecepcionProductoDto): string {
    const falta = pendienteDe(p);
    const total = p.totalCantidadARecibirPorUnidad ?? 0;
    if (falta <= 0) {
      return 'Completo · ' + formatearCantidad(total, 0) + ' u.';
    }
    return (
      'Faltan ' + formatearCantidad(falta, 0) + ' de ' + formatearCantidad(total, 0) + ' u.'
    );
  }

  deshacible(p: PedidoRecepcionProductoDto): boolean {
    return puedeDeshacer(p, this.recepcion()?.estado);
  }

  // ──────────────────────────────────────────────────────────── Acciones ──

  verificar(item: PedidoRecepcionProductoDto, metodo?: MetodoVerificacion): void {
    const recepcion = this.recepcion();
    if (!recepcion) {
      return;
    }
    if (!this.enProceso()) {
      this.notificacion.warn('La recepción no está en proceso. Reabrila para modificarla.');
      return;
    }

    const data: VerificacionData = { recepcion, item, metodo };
    const ref = this.dialog.open<VerificacionDialogComponent, VerificacionData, boolean>(
      VerificacionDialogComponent,
      { data, width: '520px', maxWidth: '94vw' },
    );
    ref.afterClosed().subscribe((guardado) => {
      if (guardado) {
        // Se recarga en vez de parchear la fila: el backend recalcula estado
        // y cantidades al repartir entre las notas, y adivinarlo acá sería
        // mostrar un número que no es el que quedó guardado.
        this.cargarProductos();
      }
    });
  }

  async escanear(): Promise<void> {
    const codigo = await this.escaner.escanear({
      titulo: 'Escaneá el producto',
      ayuda: 'Apuntá al código de barras del producto que estás recibiendo.',
      formatos: FORMATOS_PRODUCTO,
    });
    if (!codigo) {
      return;
    }
    const recepcionId = this.recepcion()?.id;
    if (recepcionId == null) {
      return;
    }

    let producto;
    try {
      producto = await firstValueFrom(this.productosService.porEscaneo(codigo));
    } catch {
      producto = null;
    }
    if (!producto?.id) {
      this.notificacion.warn('Ningún producto tiene ese código.');
      return;
    }

    try {
      const item = await firstValueFrom(this.servicio.producto(recepcionId, producto.id));
      if (!item?.producto) {
        this.notificacion.warn('Ese producto no figura en esta recepción.');
        return;
      }
      this.verificar(item, MetodoVerificacion.ESCANER);
    } catch {
      // El error ya se notificó en la capa de datos.
    }
  }

  async deshacer(item: PedidoRecepcionProductoDto, evento: Event): Promise<void> {
    // Sin esto se abriría también el diálogo de verificación de la card.
    evento.stopPropagation();

    const recepcionId = this.recepcion()?.id;
    const productoId = item.producto?.id;
    if (recepcionId == null || productoId == null) {
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Deshacer verificación',
      mensaje:
        'Se borran todas las cantidades cargadas de este producto, en todas las notas de la recepción.',
      confirmar: 'Deshacer',
    });
    if (!ok) {
      return;
    }

    this.servicio.deshacer(recepcionId, productoId).subscribe({
      next: (hecho) => {
        if (hecho) {
          this.notificacion.ok('Verificación deshecha.');
          this.cargarProductos();
        } else {
          this.notificacion.warn('El servidor no deshizo la verificación.');
        }
      },
    });
  }

  async finalizar(): Promise<void> {
    const recepcionId = this.recepcion()?.id;
    if (recepcionId == null) {
      return;
    }

    const pendientes = await this.pendientes(recepcionId);
    if (pendientes === null) {
      return;
    }

    let motivo: MotivoRechazoFisico | null = null;

    if (pendientes.length > 0) {
      const data: MotivoRechazoData = {
        cantidadProductos: pendientes.length,
        ejemplos: pendientes
          .slice(0, 5)
          .map((p) => p.producto?.descripcion ?? 'Producto'),
      };
      const ref = this.dialog.open<
        MotivoRechazoDialogComponent,
        MotivoRechazoData,
        MotivoRechazoFisico | undefined
      >(MotivoRechazoDialogComponent, { data, width: '460px', maxWidth: '92vw' });
      motivo = (await firstValueFrom(ref.afterClosed())) ?? null;
      if (!motivo) {
        return;
      }
    } else {
      const ok = await this.dialogo.confirmar({
        titulo: 'Finalizar recepción',
        mensaje: 'Se cierra la recepción y las cantidades verificadas entran al stock.',
        confirmar: 'Finalizar',
      });
      if (!ok) {
        return;
      }
    }

    this.servicio.finalizar(recepcionId, motivo).subscribe({
      next: (r) => {
        if (r) {
          this.recepcion.set(r);
          this.notificacion.ok('Recepción finalizada.');
          this.cargar();
        }
      },
    });
  }

  async reabrir(): Promise<void> {
    const recepcionId = this.recepcion()?.id;
    if (recepcionId == null) {
      return;
    }
    const ok = await this.dialogo.confirmar({
      titulo: 'Reabrir recepción',
      mensaje: 'Vuelve a quedar en proceso y se pueden corregir las cantidades.',
      confirmar: 'Reabrir',
    });
    if (!ok) {
      return;
    }

    this.servicio.reabrir(recepcionId).subscribe({
      next: (r) => {
        if (r) {
          this.notificacion.ok('Recepción reabierta.');
          this.cargar();
        }
      },
    });
  }

  constancia(): void {
    const recepcionId = this.recepcion()?.id;
    if (recepcionId == null) {
      return;
    }
    this.servicio.constancia(recepcionId).subscribe({
      next: (res) => {
        const base64 = res?.pdfBase64;
        if (!base64) {
          this.notificacion.warn('El servidor no devolvió la constancia.');
          return;
        }
        this.pdf.abrirBase64(base64, res.nombreArchivo ?? 'constancia-' + recepcionId + '.pdf');
      },
    });
  }

  /**
   * Los productos que quedarían sin verificar.
   *
   * Se consulta sin filtro y con la página entera: lo que muestra la pantalla
   * puede estar filtrado, y finalizar afecta a todos.
   */
  private async pendientes(recepcionId: number): Promise<PedidoRecepcionProductoDto[] | null> {
    try {
      const page = await firstValueFrom(this.servicio.productos(recepcionId, null, 0, TODOS));
      return itemsPendientes(page?.getContent ?? []);
    } catch {
      return null;
    }
  }
}
