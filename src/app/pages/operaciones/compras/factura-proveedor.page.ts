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
import type {
  AvisoFactura,
  FacturaProveedor,
  RenglonFactura,
  SugerenciaProducto,
} from 'src/app/domains/compras/compras.model';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import {
  aId,
  cantidadPorPrecio,
  contarFiltros,
  filtrarRenglones,
  FiltroRenglones,
  textoFactor,
  tonoAviso,
  tonoRenglon,
} from './compras-reglas';
import { ComprasService } from './compras.service';
import {
  VincularRenglonData,
  VincularRenglonDialogComponent,
  VincularRenglonResultado,
} from './vincular-renglon-dialog.component';

const FILTROS: { valor: FiltroRenglones; etiqueta: string }[] = [
  { valor: 'revisar', etiqueta: 'Para revisar' },
  { valor: 'sin-producto', etiqueta: 'Sin producto' },
  { valor: 'ok', etiqueta: 'Coinciden' },
  { valor: 'todos', etiqueta: 'Todos' },
];

/**
 * La factura del proveedor, con todos sus datos, cruzada contra el pedido.
 *
 * Cada renglón dice si coincide con el pedido (verde), si tiene una
 * diferencia o no estaba en el pedido (amarillo, pide observación, como el
 * desktop) o si el producto no se reconoció (rojo: hay que vincularlo con uno
 * nuestro o darlo de alta).
 *
 * ⚠️ **Nada de esto se calcula acá.** Las diferencias, los avisos de IVA, el
 * total que va a la nota y si se puede confirmar vienen del central, que
 * devuelve la factura entera después de cada cambio. La pantalla solo pinta.
 *
 * ⚠️ **Los precios van con IVA incluido**, como los cargan hoy los compradores
 * en el desktop y como los trae la factura. El central avisa cuando el precio
 * del pedido parece estar sin IVA.
 */
@Component({
  selector: 'frc-factura-proveedor',
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
    <frc-pagina titulo="Factura del proveedor" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="5" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (factura(); as f) {
        @if (f.notaRecepcionId) {
          <p class="aviso t-ok">Esta factura ya está cargada en el pedido.</p>
        }

        <frc-seccion [titulo]="f.tipoDocumentoDescripcion ?? 'Factura'" [panel]="true">
          <frc-dato etiqueta="Proveedor" [valor]="f.emisorNombre ?? '—'" />
          <frc-dato etiqueta="RUC" [valor]="f.emisorRuc ?? '—'" />
          <frc-dato etiqueta="Número" [valor]="f.numeroCompleto ?? '—'" />
          <frc-dato etiqueta="Timbrado" [valor]="f.timbrado ?? '—'" />
          <frc-dato etiqueta="Emitida" [valor]="fecha(f.fechaEmision)" />
          <frc-dato etiqueta="Condición" [valor]="f.condicion ?? '—'" />
          <frc-dato etiqueta="Moneda" [valor]="moneda(f)" />
          <frc-dato etiqueta="A nombre de" [valor]="(f.receptorNombre ?? '—') + ' · ' + (f.receptorRuc ?? '')" />
          <frc-dato etiqueta="Pedido" [valor]="'Pedido ' + f.pedidoId + ' · ' + (f.proveedorNombre ?? '')" />
          <p class="cdc">CDC {{ f.cdc }}</p>
        </frc-seccion>

        <frc-seccion titulo="Totales" [panel]="true">
          @if ((f.subtotalExenta ?? 0) > 0) {
            <frc-dato etiqueta="Exentas"><frc-importe [valor]="f.subtotalExenta ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
          }
          @if ((f.subtotalIva5 ?? 0) > 0) {
            <frc-dato etiqueta="Gravadas 5 %"><frc-importe [valor]="f.subtotalIva5 ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
          }
          @if ((f.subtotalIva10 ?? 0) > 0) {
            <frc-dato etiqueta="Gravadas 10 %"><frc-importe [valor]="f.subtotalIva10 ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
          }
          @if ((f.totalIva5 ?? 0) > 0) {
            <frc-dato etiqueta="IVA 5 %"><frc-importe [valor]="f.totalIva5 ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
          }
          @if ((f.totalIva10 ?? 0) > 0) {
            <frc-dato etiqueta="IVA 10 %"><frc-importe [valor]="f.totalIva10 ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
          }
          @if ((f.totalDescuento ?? 0) > 0) {
            <frc-dato etiqueta="Descuentos y bonificaciones"><frc-importe [valor]="f.totalDescuento ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
          }
          <frc-dato etiqueta="Total de la factura"><frc-importe [valor]="f.totalGeneral ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
          <frc-dato etiqueta="Valor de la nota"><frc-importe [valor]="f.totalNota ?? null" [simbolo]="f.monedaSimbolo ?? null" /></frc-dato>
        </frc-seccion>

        @for (a of f.avisos; track $index) {
          <p [class]="'aviso t-' + tono(a)">{{ a.mensaje }}</p>
        }

        <div class="resumen">
          @if ((f.renglonesOk ?? 0) > 0) {
            <frc-estado-chip [etiqueta]="f.renglonesOk + ' coinciden'" [tono]="'ok'" />
          }
          @if ((f.renglonesConDiferencia ?? 0) > 0) {
            <frc-estado-chip [etiqueta]="f.renglonesConDiferencia + ' con diferencia'" [tono]="'warn'" />
          }
          @if ((f.renglonesFueraDePedido ?? 0) > 0) {
            <frc-estado-chip [etiqueta]="f.renglonesFueraDePedido + ' fuera del pedido'" [tono]="'warn'" />
          }
          @if ((f.renglonesSinProducto ?? 0) > 0) {
            <frc-estado-chip [etiqueta]="f.renglonesSinProducto + ' sin producto'" [tono]="'danger'" />
          }
        </div>

        <div class="filtros">
          @for (op of filtros; track op.valor) {
            <button
              type="button"
              class="filtro"
              [class.activo]="filtro() === op.valor"
              (click)="filtro.set(op.valor)"
            >
              {{ op.etiqueta }} ({{ conteos()[op.valor] }})
            </button>
          }
        </div>

        @for (r of visibles(); track r.id) {
          <article class="renglon" [class]="'renglon t-' + tonoRenglon(r.estado)">
            <header>
              <frc-estado-chip [etiqueta]="r.estadoEtiqueta ?? r.estado" [tono]="tonoRenglon(r.estado)" />
              <span class="orden">#{{ r.orden }}</span>
            </header>
            <strong class="desc">{{ r.descripcion }}</strong>
            <span class="codigos">{{ codigos(r) }}</span>
            <span class="linea">
              {{ cantidadPorPrecio(r) }} × {{ numero(r.precioUnitario) }}
              @if ((r.porcentajeDescuento ?? 0) > 0) {
                − {{ numero(r.porcentajeDescuento) }} %
              }
              = {{ numero(r.total) }} · {{ r.ivaTexto }}
            </span>
            @if (r.lote || r.vencimiento) {
              <span class="codigos">
                @if (r.lote) { Lote {{ r.lote }} }
                @if (r.vencimiento) { · Vence {{ fecha(r.vencimiento, false) }} }
              </span>
            }

            @if (r.productoId) {
              <div class="producto">
                <span>→ {{ r.productoDescripcion }} · {{ r.presentacionDescripcion }}</span>
                <span class="codigos">
                  {{ textoFactor(r.factor, r.unidadMedida) }} · {{ r.tipoMatchEtiqueta }}
                </span>
                <span class="codigos">
                  A la nota: {{ numero(r.cantidadBase) }} u. ×
                  {{ r.esBonificacion ? 'sin cargo' : numero(r.precioUnitarioBase) }}
                </span>
              </div>
            } @else {
              <p class="falta">
                No está en el sistema con este código. Vinculalo con un producto nuestro o dalo de alta.
              </p>
            }

            @for (d of r.diferencias; track $index) {
              <p class="nota t-warn">{{ d }}</p>
            }
            @for (a of r.avisosIva; track $index) {
              <p class="nota t-warn">IVA: {{ a }}</p>
            }
            @for (a of r.avisos; track $index) {
              <p class="nota t-info">{{ a }}</p>
            }
            @if (r.observacion) {
              <p class="nota">Observación: {{ r.observacion }}</p>
            } @else if (r.observacionFaltante) {
              <p class="nota t-danger">Falta la observación que justifique la diferencia.</p>
            }

            @if (r.sugerencias.length > 0) {
              <div class="sugerencias">
                <span class="codigos">¿Es alguno de estos?</span>
                @for (s of r.sugerencias; track s.presentacionId) {
                  <div class="sugerencia">
                    <div>
                      <span>{{ s.descripcion }} · {{ s.presentacionDescripcion }}</span>
                      <span class="codigos">{{ s.motivo }}</span>
                    </div>
                    @if (editable()) {
                      <button matButton (click)="vincular(r, s)">Usar</button>
                    }
                  </div>
                }
              </div>
            }

            @if (editable()) {
              <div class="acciones-renglon">
                <button matButton (click)="vincular(r)">
                  {{ r.productoId ? 'Cambiar producto' : 'Buscar producto' }}
                </button>
                @if (r.requiereObservacion) {
                  <button matButton (click)="observar(r)">
                    {{ r.observacion ? 'Editar observación' : 'Observación' }}
                  </button>
                }
                @if (!r.productoId && puedeCrearProducto()) {
                  <button matButton (click)="darDeAlta(r)">Dar de alta</button>
                }
              </div>
            }
          </article>
        } @empty {
          <p class="vacio">Ningún renglón en este filtro.</p>
        }

        @if (f.itemsNoFacturados.length > 0) {
          <frc-seccion [titulo]="'Del pedido, esta factura no trae (' + f.itemsNoFacturados.length + ')'">
            @for (i of f.itemsNoFacturados; track i.pedidoItemId) {
              <frc-card
                [titulo]="i.descripcion ?? 'Producto ' + i.productoId"
                [subtitulo]="(i.presentacionDescripcion ?? '') + ' · ' + (i.pendienteTexto ?? '')"
                icono="producto"
                [clickable]="false"
              />
            }
            <p class="aclaracion">Quedan pendientes para otra factura del mismo pedido.</p>
          </frc-seccion>
        }
      }

      @if (editable()) {
        <div acciones class="botonera">
          @if (factura()?.motivoNoConfirma; as motivo) {
            <span class="motivo">{{ motivo }}</span>
          }
          <button
            matButton="filled"
            [disabled]="!factura()?.puedeConfirmar || trabajando()"
            (click)="confirmar()"
          >
            {{ trabajando() ? 'Guardando…' : 'Confirmar factura' }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .cdc { margin: var(--sp-2) 0 0; font-family: var(--font-num); font-size: var(--fs-caption); color: var(--text-soft); word-break: break-all; }
    .aviso { margin: 0 0 var(--sp-2); padding: var(--sp-2) var(--sp-3); border-radius: var(--radius-sm); font-size: var(--fs-label); }
    .t-ok.aviso { background: var(--ok-bg); color: var(--ok); }
    .t-info.aviso { background: var(--info-bg); color: var(--info); }
    .t-warn.aviso { background: var(--warn-bg); color: var(--warn); }
    .t-danger.aviso { background: var(--danger-bg); color: var(--danger); }
    .resumen, .filtros { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin: var(--sp-2) 0; }
    .filtro {
      border: 1px solid var(--border);
      background: none;
      color: var(--text);
      border-radius: var(--radius-full);
      padding: var(--sp-1) var(--sp-3);
      font-size: var(--fs-caption);
      cursor: pointer;
    }
    .filtro.activo { background: var(--brand-fill); border-color: var(--brand-fill); color: var(--on-tono); }
    .renglon {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      padding: var(--sp-3);
      margin-bottom: var(--sp-3);
      border-radius: var(--radius-md);
      background: var(--surface);
      border: 1px solid var(--border);
      border-left-width: var(--sp-1);
    }
    .renglon.t-ok { border-left-color: var(--ok); }
    .renglon.t-warn { border-left-color: var(--warn); }
    .renglon.t-danger { border-left-color: var(--danger); }
    .renglon header { display: flex; justify-content: space-between; align-items: center; }
    .orden { color: var(--text-mute); font-size: var(--fs-caption); }
    .desc { font-size: var(--fs-body); }
    .codigos { color: var(--text-soft); font-size: var(--fs-caption); }
    .linea { font-family: var(--font-num); font-size: var(--fs-label); }
    .producto { display: flex; flex-direction: column; gap: var(--sp-1); padding-top: var(--sp-1); font-size: var(--fs-label); }
    .falta { margin: 0; color: var(--danger); font-size: var(--fs-label); }
    .nota { margin: 0; font-size: var(--fs-label); }
    .nota.t-warn { color: var(--warn); }
    .nota.t-info { color: var(--info); }
    .nota.t-danger { color: var(--danger); }
    .sugerencias { display: flex; flex-direction: column; gap: var(--sp-1); padding-top: var(--sp-2); }
    .sugerencia { display: flex; justify-content: space-between; align-items: center; gap: var(--sp-2); font-size: var(--fs-label); }
    .sugerencia > div { display: flex; flex-direction: column; }
    .acciones-renglon { display: flex; flex-wrap: wrap; gap: var(--sp-1); justify-content: flex-end; }
    .vacio { color: var(--text-mute); font-size: var(--fs-label); }
    .aclaracion { color: var(--text-mute); font-size: var(--fs-caption); margin: var(--sp-2) 0 0; }
    .botonera { display: flex; flex-direction: column; align-items: stretch; gap: var(--sp-1); }
    .motivo { color: var(--text-mute); font-size: var(--fs-caption); text-align: center; }
  `,
})
export class FacturaProveedorPage {
  private readonly servicio = inject(ComprasService);
  private readonly dialogo = inject(DialogoService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(RoleService);

  /** Llegan de la ruta `:pedidoId/factura/:documentoId`. */
  readonly pedidoId = input<string>();
  readonly documentoId = input<string>();

  readonly factura = signal<FacturaProveedor | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly trabajando = signal(false);
  readonly filtro = signal<FiltroRenglones>('revisar');

  readonly filtros = FILTROS;
  readonly conteos = computed(() => contarFiltros(this.factura()?.renglones ?? []));
  readonly visibles = computed(() => filtrarRenglones(this.factura()?.renglones ?? [], this.filtro()));
  readonly editable = computed(() => {
    const f = this.factura();
    return f != null && f.notaRecepcionId == null && !this.cargando() && !this.error();
  });

  readonly tonoRenglon = tonoRenglon;
  readonly cantidadPorPrecio = cantidadPorPrecio;
  readonly textoFactor = textoFactor;

  constructor() {
    effect(() => {
      if (this.pedidoId() !== undefined && this.documentoId() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const pedido = aId(this.pedidoId());
    const documento = aId(this.documentoId());
    if (pedido == null || documento == null) {
      this.error.set('La factura no tiene un identificador válido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.factura(documento, pedido).subscribe({
      next: (f) => this.mostrar(f),
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  private mostrar(f: FacturaProveedor | null | undefined): void {
    this.factura.set(f ?? null);
    if (!f) {
      this.error.set('La factura ya no está. Escaneala de nuevo.');
    } else if (this.filtro() === 'revisar' && contarFiltros(f.renglones).revisar === 0) {
      // Si no queda nada para revisar, se muestra todo: una lista vacía
      // haría creer que la factura no tiene renglones.
      this.filtro.set('todos');
    }
    this.cargando.set(false);
    this.trabajando.set(false);
  }

  async vincular(r: RenglonFactura, sugerencia?: SugerenciaProducto): Promise<void> {
    const resultado = await this.dialogo.abrir<
      VincularRenglonDialogComponent,
      VincularRenglonData,
      VincularRenglonResultado
    >(VincularRenglonDialogComponent, { renglon: r, sugerencia }, '460px');
    if (!resultado) return;
    this.trabajando.set(true);
    this.servicio
      .vincularRenglon(r.id, resultado.presentacionId, resultado.factor, resultado.recordar)
      .subscribe({ next: (f) => this.mostrar(f), error: () => this.trabajando.set(false) });
  }

  async observar(r: RenglonFactura): Promise<void> {
    const texto = await this.dialogo.pedirTexto({
      titulo: 'Observación',
      etiqueta: 'Por qué la factura no coincide con el pedido',
      valor: r.observacion ?? '',
      ayuda: [...r.diferencias, r.estado === 'FUERA_DE_PEDIDO' ? 'El producto no estaba en el pedido.' : '']
        .filter(Boolean)
        .join(' · '),
      confirmar: 'Guardar',
    });
    if (texto === undefined) return;
    this.trabajando.set(true);
    this.servicio
      .observarRenglon(r.id, texto.trim() || null)
      .subscribe({ next: (f) => this.mostrar(f), error: () => this.trabajando.set(false) });
  }

  /**
   * Abre el alta de producto con la descripción del proveedor. Al volver, la
   * factura se recarga y el central vuelve a buscar el código: si el producto
   * se creó con ese código de barras, el renglón queda reconocido solo.
   */
  darDeAlta(r: RenglonFactura): void {
    void this.router.navigate(['/producto/nuevo'], {
      queryParams: { descripcion: (r.descripcion ?? '').toUpperCase() },
    });
  }

  async confirmar(): Promise<void> {
    const f = this.factura();
    const pedido = aId(this.pedidoId());
    if (!f || pedido == null || !f.puedeConfirmar) return;
    const ok = await this.dialogo.confirmar({
      titulo: 'Cargar la factura al pedido',
      mensaje:
        'Se crea la nota ' + (f.numeroCompleto ?? '') + ' con ' + f.renglones.length +
        ' renglones por ' + this.numero(f.totalNota) + ' ' + (f.monedaSimbolo ?? '') +
        ' (con IVA), y se reparte entre las sucursales como dice el pedido.',
      confirmar: 'Cargar',
    });
    if (!ok) return;
    this.trabajando.set(true);
    this.servicio.confirmarFactura(f.id, pedido).subscribe({
      next: () => {
        this.trabajando.set(false);
        void this.router.navigate(['/operaciones/compras', pedido], { replaceUrl: true });
      },
      error: () => this.trabajando.set(false),
    });
  }

  puedeCrearProducto(): boolean {
    return this.roles.tieneAlgunRol(this.auth.roles(), PERMISOS.productoEdicion);
  }

  tono(a: AvisoFactura): string {
    return tonoAviso(a);
  }

  fecha(valor: string | null | undefined, conHora = true): string {
    return fechaLegible(valor, { conHora }) ?? '—';
  }

  moneda(f: FacturaProveedor): string {
    const base = f.moneda ?? '—';
    return f.cotizacion && f.cotizacion > 1 ? base + ' · cotización ' + this.numero(f.cotizacion) : base;
  }

  codigos(r: RenglonFactura): string {
    return [
      r.codigoProveedor ? 'Cód. ' + r.codigoProveedor : null,
      r.gtin ? 'Barras ' + r.gtin : null,
      r.gtinPaquete ? 'Paquete ' + r.gtinPaquete : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /** Solo formatea un número que ya mandó el central. */
  numero(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('es-PY', { maximumFractionDigits: 2 });
  }
}
