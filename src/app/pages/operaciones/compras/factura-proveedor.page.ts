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
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import type {
  AvisoFactura,
  FacturaProveedor,
  OpcionesNuevaCompra,
  ConversionMoneda,
  RenglonFactura,
  RepartoRenglon,
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
  avisosVisibles,
  cantidadPorPrecio,
  contarFiltros,
  filtrarRenglones,
  FiltroRenglones,
  repartoCompleto,
  repartoIgual,
  sumaReparto,
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
 * **Dos modos**, la misma pantalla. Con un pedido (`:pedidoId/factura/:id`) la
 * factura se carga a ese pedido. En `nueva/:id` la factura **crea la compra**:
 * de la factura sale todo lo que trae (proveedor, moneda, ítems, precios, forma
 * de pago y plazo si vienen); el comprador elige lo que no trae y las
 * sucursales. Con varias, carga en cada renglón cuánto va a cada una (en la
 * unidad de la factura, lo que dice el papel); se prellena en partes iguales.
 * La compra queda en «Ítems del pedido» y la factura se carga sola como nota
 * al finalizar la planificación en el desktop.
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
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="esNueva() ? 'Nueva compra' : 'Factura del proveedor'" [conVolver]="true">
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
          @if (f.tipoPagoFactura) {
            <frc-dato etiqueta="Pago" [valor]="f.tipoPagoFactura" />
          }
          @if (f.plazoCredito != null) {
            <frc-dato etiqueta="Plazo" [valor]="f.plazoCredito + ' días'" />
          }
          @if (!esNueva()) {
            <frc-dato etiqueta="Pedido" [valor]="'Pedido ' + f.pedidoId + ' · ' + (f.proveedorNombre ?? '')" />
          }
          <p class="cdc">CDC {{ f.cdc }}</p>
        </frc-seccion>

        @if (esNueva() && !f.notaRecepcionId) {
          <frc-seccion titulo="Datos de la compra" [panel]="true">
            <p class="ayuda">
              Proveedor, moneda, ítems y precios salen de la factura. Lo que la factura no trae, elegilo acá.
            </p>
            <frc-dato etiqueta="Proveedor" [valor]="f.proveedorNombre ?? '—'" />
            @if (opcionesFallaron()) {
              <p class="nota t-danger">No se pudieron traer las formas de pago y las sucursales.</p>
              <button matButton (click)="cargarOpciones()">Reintentar</button>
            } @else {
              <mat-form-field appearance="outline" class="campo">
                <mat-label>Moneda</mat-label>
                <mat-select [ngModel]="monedaId()" (ngModelChange)="elegirMoneda($event)">
                  @for (o of opciones()?.monedas ?? []; track o.id) {
                    <mat-option [value]="o.id">{{ o.descripcion }}</mat-option>
                  }
                </mat-select>
                <mat-hint>{{ otraMoneda() ? 'Distinta de la factura (' + (f.moneda ?? '') + ')' : 'De la factura' }}</mat-hint>
              </mat-form-field>
              @if (otraMoneda()) {
                @if (conversionCargando()) {
                  <p class="nota">Calculando la conversión…</p>
                } @else if (conversionError()) {
                  <p class="nota t-danger">{{ conversionError() }}</p>
                } @else if (conversion()?.texto) {
                  <p class="nota t-info">{{ conversion()!.texto }}</p>
                }
              }
              <mat-form-field appearance="outline" class="campo">
                <mat-label>Forma de pago</mat-label>
                <mat-select [ngModel]="formaPagoId()" (ngModelChange)="formaPagoId.set($event)">
                  @for (o of opciones()?.formasPago ?? []; track o.id) {
                    <mat-option [value]="o.id">{{ o.descripcion }}</mat-option>
                  }
                </mat-select>
                <mat-hint>{{ f.formaPagoId ? 'De la factura' : formaPagoId() != null ? 'Elegida a mano: la factura no la trae' : 'La factura no la trae: elegila' }}</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="campo">
                <mat-label>Plazo de crédito (días)</mat-label>
                <input
                  matInput
                  type="number"
                  inputmode="numeric"
                  min="0"
                  [ngModel]="plazo()"
                  (ngModelChange)="plazo.set($event === '' || $event == null ? null : +$event)"
                />
                <mat-hint>{{ f.plazoCredito != null ? 'De la factura' : 'Opcional: la factura no lo trae' }}</mat-hint>
              </mat-form-field>
              <mat-form-field appearance="outline" class="campo">
                <mat-label>Sucursales que reciben</mat-label>
                <mat-select multiple [ngModel]="sucursalIds()" (ngModelChange)="elegirSucursales($event)">
                  @for (o of opciones()?.sucursales ?? []; track o.id) {
                    <mat-option [value]="o.id">{{ o.descripcion }}</mat-option>
                  }
                </mat-select>
                <mat-hint>
                  {{ sucursalIds().length > 1
                    ? 'Repartí cada renglón entre las ' + sucursalIds().length + ' sucursales'
                    : 'Una sola recibe todo lo de la factura' }}
                </mat-hint>
              </mat-form-field>
            }
          </frc-seccion>
        }

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

        @for (a of avisos(); track $index) {
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
            @for (a of r.alertas ?? []; track $index) {
              <p class="nota t-warn">Revisá: {{ a }}</p>
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

            @if (conReparto()) {
              <div class="reparto" [class.incompleto]="!repartoOk(r)">
                <span class="codigos">Reparto, en {{ r.unidadMedida || 'unidades de la factura' }}</span>
                <div class="reparto-filas">
                  @for (suc of sucursalesElegidas(); track suc.id) {
                    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="reparto-campo">
                      <mat-label>{{ suc.descripcion }}</mat-label>
                      <input
                        matInput
                        type="number"
                        inputmode="decimal"
                        min="0"
                        [ngModel]="valorReparto(r, suc.id)"
                        (ngModelChange)="editarReparto(r, suc.id, $event)"
                      />
                    </mat-form-field>
                  }
                </div>
                <span class="reparto-suma">
                  Suma {{ numero(sumaDe(r)) }} de {{ numero(r.cantidad) }}
                  @if (!repartoOk(r)) { · tiene que sumar lo de la factura }
                </span>
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
          @if (esNueva()) {
            @if (faltaParaCrear(); as falta) {
              <span class="motivo">{{ falta }}</span>
            }
            <button matButton="filled" [disabled]="!puedeCrear() || trabajando()" (click)="crearCompra()">
              {{ trabajando() ? 'Creando la compra…' : 'Crear compra' }}
            </button>
          } @else {
            <button
              matButton="filled"
              [disabled]="!factura()?.puedeConfirmar || trabajando()"
              (click)="confirmar()"
            >
              {{ trabajando() ? 'Guardando…' : 'Confirmar factura' }}
            </button>
          }
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
    .campo { width: 100%; margin-top: var(--sp-2); }
    .ayuda { margin: 0 0 var(--sp-2); color: var(--text-mute); font-size: var(--fs-caption); }
    .reparto { display: flex; flex-direction: column; gap: var(--sp-1); padding-top: var(--sp-2); }
    .reparto-filas { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: var(--sp-2); }
    .reparto-campo { width: 100%; }
    .reparto-suma { font-size: var(--fs-caption); color: var(--text-mute); }
    .reparto.incompleto .reparto-suma { color: var(--danger); }
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
  /** `nueva` por el `data` de la ruta: la factura crea la compra en vez de cargarse a un pedido. */
  readonly modo = input<string>();
  readonly esNueva = computed(() => this.modo() === 'nueva');

  readonly opciones = signal<OpcionesNuevaCompra | null>(null);
  readonly opcionesFallaron = signal(false);
  readonly formaPagoId = signal<number | null>(null);
  readonly avisos = computed(() => avisosVisibles(this.factura()?.avisos ?? [], this.formaPagoId() != null));
  readonly plazo = signal<number | null>(null);
  readonly sucursalIds = signal<number[]>([]);
  /** La moneda del pedido: arranca en la de la factura. */
  readonly monedaId = signal<number | null>(null);
  readonly conversion = signal<ConversionMoneda | null>(null);
  readonly conversionCargando = signal(false);
  readonly conversionError = signal<string | null>(null);
  readonly otraMoneda = computed(() => {
    const deFactura = aId(this.factura()?.monedaId);
    return this.monedaId() != null && deFactura != null && this.monedaId() !== deFactura;
  });
  /** Lo que el comprador cambió del reparto propuesto, por «renglón:sucursal». Elegir otras sucursales lo borra. */
  readonly edicionesReparto = signal<Record<string, number | null>>({});
  readonly sucursalesElegidas = computed(() => {
    const todas = this.opciones()?.sucursales ?? [];
    return this.sucursalIds()
      .map((id) => todas.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => s != null);
  });
  readonly conReparto = computed(() => this.esNueva() && this.editable() && this.sucursalIds().length > 1);
  readonly renglonesSinRepartir = computed(() =>
    this.sucursalIds().length > 1
      ? (this.factura()?.renglones ?? []).filter((r) => !this.repartoOk(r)).length
      : 0,
  );
  /** Lo que falta para crear la compra, o null. Los datos de la factura los valida el central. */
  readonly faltaParaCrear = computed<string | null>(() => {
    const f = this.factura();
    if (!f) return null;
    if (!f.puedeConfirmar) return f.motivoNoConfirma ?? 'La factura todavía no se puede cargar.';
    if (this.formaPagoId() == null) return 'Elegí la forma de pago.';
    if (this.monedaId() == null) return 'Elegí la moneda.';
    if (this.otraMoneda() && this.conversionCargando()) return 'Calculando la conversión de moneda…';
    if (this.otraMoneda() && this.conversionError()) return this.conversionError();
    if (this.sucursalIds().length === 0) return 'Elegí la sucursal que recibe.';
    const sinRepartir = this.renglonesSinRepartir();
    if (sinRepartir > 0) {
      return sinRepartir === 1
        ? 'Un renglón tiene el reparto incompleto.'
        : sinRepartir + ' renglones tienen el reparto incompleto.';
    }
    if (this.plazo() != null && this.plazo()! < 0) return 'El plazo no puede ser negativo.';
    return null;
  });
  readonly puedeCrear = computed(() => this.factura() != null && this.faltaParaCrear() == null);
  private prellenado = false;

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
      const listo = this.esNueva() ? this.documentoId() !== undefined
        : this.pedidoId() !== undefined && this.documentoId() !== undefined;
      if (listo) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    if (this.esNueva()) {
      this.cargarNueva();
      return;
    }
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

  private cargarNueva(): void {
    const documento = aId(this.documentoId());
    if (documento == null) {
      this.error.set('La factura no tiene un identificador válido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    if (!this.opciones()) this.cargarOpciones();
    this.servicio.facturaNuevaCompra(documento).subscribe({
      next: (f) => this.mostrar(f),
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  cargarOpciones(): void {
    this.opcionesFallaron.set(false);
    this.servicio.opcionesNuevaCompra().subscribe({
      next: (crudas) => {
        // ⚠️ GraphQL manda los ID como texto: sin pasarlos a número, el select no
        // reconoce la forma de pago que trae la factura y se ve vacío.
        const o: OpcionesNuevaCompra = {
          formasPago: (crudas?.formasPago ?? []).map((x) => ({ ...x, id: Number(x.id) })),
          sucursales: (crudas?.sucursales ?? []).map((x) => ({ ...x, id: Number(x.id) })),
          monedas: (crudas?.monedas ?? []).map((x) => ({ ...x, id: Number(x.id) })),
        };
        this.opciones.set(o);
        // Con una sola sucursal posible no hay nada que elegir
        if (this.sucursalIds().length === 0 && o?.sucursales?.length === 1) {
          this.sucursalIds.set([o.sucursales[0].id]);
        }
      },
      error: () => this.opcionesFallaron.set(true),
    });
  }

  private mostrar(f: FacturaProveedor | null | undefined): void {
    this.factura.set(f ?? null);
    // Solo lo que trae la factura, y una sola vez: después manda lo que eligió el comprador
    if (f && this.esNueva() && !this.prellenado) {
      this.prellenado = true;
      if (f.formaPagoId != null) this.formaPagoId.set(Number(f.formaPagoId));
      if (f.plazoCredito != null) this.plazo.set(f.plazoCredito);
      this.monedaId.set(aId(f.monedaId));
    }
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

  async crearCompra(): Promise<void> {
    const f = this.factura();
    const formaPago = this.formaPagoId();
    const sucursales = this.sucursalIds();
    if (!f || !this.puedeCrear() || formaPago == null || sucursales.length === 0) return;
    const nombres = this.sucursalesElegidas().map((s) => s.descripcion ?? '').join(', ');
    const ok = await this.dialogo.confirmar({
      titulo: 'Crear la compra',
      mensaje:
        'Se crea el pedido de ' + (f.proveedorNombre ?? '') + ' con ' + f.renglones.length +
        ' renglones para ' + nombres + (sucursales.length > 1 ? ', repartidos como cargaste' : '') +
        '. La compra queda en «Ítems del pedido» para que la revises en el sistema de escritorio con la' +
        ' factura en la mano; al finalizar la planificación, la factura ' + (f.numeroCompleto ?? '') + ' por ' +
        this.numero(f.totalNota) + ' ' + (f.monedaSimbolo ?? '') + ' (con IVA) se carga sola.' +
        (this.otraMoneda() && this.conversion()
          ? ' El pedido va en ' + (this.conversion()!.monedaSimbolo ?? '') + ' por ' +
            this.numero(this.conversion()!.totalPedido) + ', convertido a la cotización.'
          : ''),
      confirmar: 'Crear compra',
    });
    if (!ok) return;
    this.trabajando.set(true);
    this.servicio
      .crearCompraDesdeFactura({
        documentoId: f.id,
        formaPagoId: formaPago,
        plazoCredito: this.plazo(),
        sucursalIds: sucursales,
        monedaId: this.monedaId(),
        repartos: sucursales.length > 1 ? this.repartosParaEnviar(f) : [],
      })
      .subscribe({
        next: (p) => {
          this.trabajando.set(false);
          void this.router.navigate(['/operaciones/compras', p.pedidoId], { replaceUrl: true });
        },
        error: () => this.trabajando.set(false),
      });
  }

  /** Otra moneda que la factura: el central dice a qué cotización se convierten los precios. */
  elegirMoneda(id: number | null): void {
    this.monedaId.set(id);
    this.conversion.set(null);
    this.conversionError.set(null);
    const f = this.factura();
    if (!f || id == null || !this.otraMoneda()) return;
    this.conversionCargando.set(true);
    this.servicio.conversionMoneda(Number(f.id), id).subscribe({
      next: (c) => {
        if (this.monedaId() !== id) return;
        this.conversion.set(c ?? null);
        this.conversionCargando.set(false);
      },
      error: (err: Error) => {
        if (this.monedaId() !== id) return;
        this.conversionError.set(err.message);
        this.conversionCargando.set(false);
      },
    });
  }

  elegirSucursales(ids: number[] | null): void {
    this.sucursalIds.set(ids ?? []);
    // Con otras sucursales el reparto cargado ya no aplica: vuelve a partes iguales
    this.edicionesReparto.set({});
    // El reparto se carga en cada renglón: hay que verlos todos, no solo los que piden revisión
    if ((ids?.length ?? 0) > 1) this.filtro.set('todos');
  }

  /** Lo cargado por el comprador o, si no tocó esa casilla, la parte igual. */
  valorReparto(r: RenglonFactura, sucursalId: number): number | null {
    const clave = r.id + ':' + sucursalId;
    const ediciones = this.edicionesReparto();
    if (clave in ediciones) return ediciones[clave];
    const ids = this.sucursalIds();
    return repartoIgual(r.cantidad, ids.length)[ids.indexOf(sucursalId)] ?? 0;
  }

  editarReparto(r: RenglonFactura, sucursalId: number, valor: unknown): void {
    const texto = String(valor ?? '').trim();
    const numero = texto === '' ? null : Number(texto);
    this.edicionesReparto.update((e) => ({
      ...e,
      [r.id + ':' + sucursalId]: numero != null && Number.isFinite(numero) ? numero : null,
    }));
  }

  private valoresReparto(r: RenglonFactura): (number | null)[] {
    return this.sucursalIds().map((id) => this.valorReparto(r, id));
  }

  sumaDe(r: RenglonFactura): number {
    return sumaReparto(this.valoresReparto(r));
  }

  repartoOk(r: RenglonFactura): boolean {
    return repartoCompleto(r.cantidad, this.valoresReparto(r));
  }

  private repartosParaEnviar(f: FacturaProveedor): RepartoRenglon[] {
    return f.renglones.flatMap((r) =>
      this.sucursalIds().map((sucursalId) => ({
        renglonId: Number(r.id),
        sucursalId,
        cantidad: this.valorReparto(r, sucursalId) ?? 0,
      })),
    );
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
