import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import type { CabeceraFacturaFoto } from 'src/app/domains/compras/compras.model';
import { formatearImporte } from 'src/app/generic/utils/moneda.util';
import { nombreProveedor, type Proveedor } from 'src/app/domains/personas/proveedor.model';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { RecepcionService } from '../recepcion/recepcion.service';
import { CardComponent } from 'src/app/shared/card/card.component';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { aId, partirNumeroFactura, textoNumeroFactura } from './compras-reglas';
import { ComprasService } from './compras.service';
import { FacturaFotoEstado } from './factura-foto.estado';

const CONDICIONES = ['CONTADO', 'CREDITO'] as const;

/**
 * Revisión de la cabecera que la IA leyó de la foto de una factura en papel.
 *
 * El comprador corrige lo que haga falta —los campos que la IA marcó con duda salen con borde
 * amarillo— y «Continuar» la confirma: el central recalcula la factura entera y se abre la
 * misma pantalla de conciliación que usa la factura electrónica.
 *
 * Con pedido (`:pedidoId/foto`) el proveedor es el del pedido y no se cambia. Sin pedido se
 * busca a mano si la IA no lo ubicó (por ejemplo, un RUC con un dígito mal leído).
 */
@Component({
  selector: 'frc-factura-foto',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    CardComponent,
    EstadoVacioComponent,
    CampoFechaComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Factura en papel" [conVolver]="true">
      @if (cabecera(); as c) {
        @if (!c.totalesCuadran) {
          <p class="aviso">{{ avisoTotales(c) }}</p>
        }
        @for (a of c.avisos; track a) {
          <p class="aviso">{{ a }}</p>
        }

        @if (fotos().length > 0) {
          <div class="fotos">
            @for (f of fotos(); track $index) {
              <button type="button" class="miniatura" aria-label="Ampliar foto" (click)="zoom.set(f)">
                <img [src]="f" alt="Foto de la factura" />
              </button>
            }
          </div>
        }

        <frc-seccion titulo="Proveedor" [panel]="true">
          @if (enPedido()) {
            <p class="proveedor">{{ proveedorNombre() ?? 'Proveedor del pedido' }}</p>
            <p class="ayuda">El proveedor es el del pedido.</p>
          } @else {
            @if (proveedorId() != null && !buscando()) {
              <p class="proveedor">{{ proveedorNombre() }}</p>
              <button matButton="tonal" (click)="buscando.set(true)">Cambiar proveedor</button>
            } @else {
              @if (!c.rucValido) {
                <p class="aviso">
                  El RUC leído ({{ c.emisorRuc ?? 'sin RUC' }}) no es válido: puede tener un dígito
                  mal. Elegí el proveedor a mano.
                </p>
              } @else if (proveedorId() == null) {
                <p class="aviso">No se encontró un proveedor con el RUC {{ c.emisorRuc }}. Elegilo a mano.</p>
              }
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Buscar proveedor</mat-label>
                <input
                  matInput
                  [value]="textoProveedor()"
                  (input)="textoProveedor.set(valor($event))"
                  (keyup.enter)="buscarProveedores()"
                />
              </mat-form-field>
              <button matButton="tonal" (click)="buscarProveedores()">Buscar</button>
              @for (p of proveedores(); track p.id) {
                <frc-card [titulo]="nombre(p)" icono="persona" (abrir)="elegirProveedor(p)" />
              }
            }
          }
          <p class="ayuda">RUC leído: {{ c.emisorRuc ?? '—' }} {{ c.emisorNombre ? '· ' + c.emisorNombre : '' }}</p>
          @if (esDudoso('emisorRuc') || esDudoso('emisorNombre')) {
            <p class="revisar">Revisá este dato</p>
          }
        </frc-seccion>

        <frc-seccion titulo="Datos de la factura" [panel]="true">
          <div class="campo" [class.dudoso]="esDudoso('timbrado')">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Timbrado</mat-label>
              <input matInput inputmode="numeric" [value]="timbrado()" (input)="timbrado.set(valor($event))" />
            </mat-form-field>
            @if (esDudoso('timbrado')) {
              <p class="revisar">Revisá este dato</p>
            }
          </div>

          <div class="campo" [class.dudoso]="numeroDudoso()">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Número de factura</mat-label>
              <input matInput inputmode="numeric" placeholder="001-001-0001234" [value]="numeroFactura()"
                (input)="numeroFactura.set(valor($event))" (blur)="normalizarNumero()" />
            </mat-form-field>
            @if (numeroFactura().trim() !== '' && !tramosNumero()) {
              <p class="revisar">Escribilo como está impreso: 001-001-0001234</p>
            } @else if (numeroDudoso()) {
              <p class="revisar">Revisá este dato</p>
            }
          </div>

          <div class="campo" [class.dudoso]="esDudoso('fechaEmision')">
            <frc-campo-fecha etiqueta="Fecha de emisión" [valor]="fecha()" (valorChange)="fecha.set($event)" />
            @if (esDudoso('fechaEmision')) {
              <p class="revisar">Revisá este dato</p>
            }
          </div>

          <div class="campo" [class.dudoso]="esDudoso('condicion')">
            <div class="condiciones">
              @for (op of condiciones; track op) {
                <button type="button" class="filtro" [class.activo]="condicion() === op" (click)="condicion.set(op)">
                  {{ op === 'CONTADO' ? 'Contado' : 'Crédito' }}
                </button>
              }
            </div>
            @if (esDudoso('condicion')) {
              <p class="revisar">Revisá este dato</p>
            }
          </div>

          <div class="campo" [class.dudoso]="esDudoso('totalGeneral')">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Total de la factura</mat-label>
              <input matInput inputmode="decimal" [value]="total() ?? ''" (input)="total.set(aNumero($event))" />
            </mat-form-field>
            @if (esDudoso('totalGeneral')) {
              <p class="revisar">Revisá este dato</p>
            }
          </div>
        </frc-seccion>
      } @else {
        <frc-estado-vacio
          titulo="No hay una lectura abierta"
          detalle="La lectura de la factura se pierde al recargar la página. Volvé y sacá la foto de nuevo."
          icono="documento"
        />
      }

      @if (zoom(); as z) {
        <button type="button" class="zoom" aria-label="Cerrar foto" (click)="zoom.set(null)">
          <img [src]="z" alt="Foto de la factura ampliada" />
        </button>
      }

      <div acciones>
        @if (cabecera()) {
          <button matButton="filled" [disabled]="!puedeContinuar()" (click)="continuar()">
            {{ enviando() ? 'Confirmando…' : 'Continuar' }}
          </button>
        }
      </div>
    </frc-pagina>
  `,
  styles: `
    .aviso { margin: 0 0 var(--sp-3); font-size: var(--fs-label); color: var(--warn); }
    .ayuda { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .proveedor { margin: 0; font-weight: var(--fw-medium); }
    .fotos { display: flex; gap: var(--sp-2); overflow-x: auto; margin-bottom: var(--sp-3); }
    .miniatura { border: 1px solid var(--border); background: none; padding: 0; width: 120px; height: 120px; flex: none; cursor: zoom-in; border-radius: var(--radius-sm); overflow: hidden; }
    .miniatura img { width: 100%; height: 100%; object-fit: cover; }
    .zoom { position: fixed; inset: 0; z-index: 1000; background: rgba(0, 0, 0, 0.9); border: none; padding: var(--sp-3); cursor: zoom-out; }
    .zoom img { width: 100%; height: 100%; object-fit: contain; }
    .campo { display: flex; flex-direction: column; gap: var(--sp-1); }
    .campo.dudoso { border: 2px solid var(--warn); border-radius: var(--radius-md); padding: var(--sp-1); }
    .revisar { margin: 0; font-size: var(--fs-caption); color: var(--warn); }
    .condiciones { display: flex; gap: var(--sp-2); }
    .filtro { border: 1px solid var(--border); background: none; color: var(--text); border-radius: var(--radius-full); padding: var(--sp-1) var(--sp-3); font-size: var(--fs-caption); cursor: pointer; }
    .filtro.activo { background: var(--brand-fill); border-color: var(--brand-fill); color: var(--on-tono); }
  `,
})
export class FacturaFotoPage {
  private readonly estado = inject(FacturaFotoEstado);
  private readonly servicio = inject(ComprasService);
  private readonly recepcion = inject(RecepcionService);
  private readonly router = inject(Router);
  private readonly notificacion = inject(NotificacionService);

  /** Llega de la ruta `:pedidoId/foto`; ausente en `foto` (compra nueva). */
  readonly pedidoId = input<string>();
  /** Llega por `?documentoId=`. */
  readonly documentoId = input<string>();

  readonly condiciones = CONDICIONES;

  readonly cabecera = computed<CabeceraFacturaFoto | null>(() => {
    const c = this.estado.cabecera();
    const id = this.documentoId();
    return c && (id === undefined || String(c.documentoId) === id) ? c : null;
  });
  readonly enPedido = computed(() => aId(this.pedidoId()) != null);

  readonly proveedorId = signal<number | string | null>(null);
  readonly proveedorNombre = signal<string | null>(null);
  readonly buscando = signal(false);
  readonly textoProveedor = signal('');
  readonly proveedores = signal<Proveedor[]>([]);

  readonly timbrado = signal('');
  /** Número de factura como está impreso (001-001-0001234); se guarda partido en tres tramos. */
  readonly numeroFactura = signal('');
  readonly tramosNumero = computed(() => partirNumeroFactura(this.numeroFactura()));
  readonly numeroDudoso = computed(() => {
    const dudosos = this.cabecera()?.dudosos ?? [];
    return ['establecimiento', 'puntoExpedicion', 'numero'].some((c) => dudosos.includes(c));
  });
  readonly fecha = signal<string | null>(null);
  readonly condicion = signal<string | null>(null);
  readonly total = signal<number | null>(null);

  readonly fotos = signal<string[]>([]);
  readonly zoom = signal<string | null>(null);
  readonly enviando = signal(false);

  readonly puedeContinuar = computed(
    () =>
      this.cabecera() != null &&
      this.proveedorId() != null &&
      /^\d+$/.test(this.timbrado().trim()) &&
      this.tramosNumero() != null &&
      !!this.fecha() &&
      (this.total() ?? 0) > 0 &&
      !this.enviando(),
  );

  private cargada: unknown = null;
  private fotosPorOrden: (string | undefined)[] = [];

  constructor() {
    effect(() => {
      const c = this.cabecera();
      if (c && c !== this.cargada) {
        this.cargada = c;
        this.cargar(c);
      }
    });
  }

  private cargar(c: CabeceraFacturaFoto): void {
    this.proveedorId.set(c.proveedorId ?? null);
    this.proveedorNombre.set(c.proveedorNombre ?? null);
    this.timbrado.set(c.timbrado != null ? String(c.timbrado) : '');
    this.numeroFactura.set(textoNumeroFactura(c.establecimiento, c.puntoExpedicion, c.numero));
    this.fecha.set(c.fechaEmision ?? null);
    this.condicion.set(c.condicion ?? null);
    this.total.set(c.totalGeneral ?? null);

    const docId = aId(c.documentoId);
    this.fotos.set([]);
    this.fotosPorOrden = [];
    if (docId != null) {
      // El central numera las fotos 1..n; se guardan por posición para que no queden desordenadas.
      for (let orden = 1; orden <= c.cantidadFotos; orden++) {
        this.servicio.fotoFactura(docId, orden).subscribe({
          next: (uri) => {
            if (!uri) return;
            this.fotosPorOrden[orden - 1] = uri;
            this.fotos.set(this.fotosPorOrden.filter((f): f is string => !!f));
          },
          // La foto es una ayuda para revisar: si no baja, el formulario sigue.
          error: () => undefined,
        });
      }
    }
  }

  avisoTotales(c: CabeceraFacturaFoto): string {
    const moneda = c.moneda ?? null;
    return (
      'La suma de los renglones (' + formatearImporte(c.sumaRenglones ?? null, moneda) +
      ') no da el total de la factura (' + formatearImporte(c.totalGeneral ?? null, moneda) +
      '): revisá cantidades y precios con el papel'
    );
  }

  /** Al salir del campo, deja el número con el formato completo (1-3-1234 -> 001-003-0001234). */
  normalizarNumero(): void {
    const t = this.tramosNumero();
    if (t) this.numeroFactura.set(`${t.establecimiento}-${t.puntoExpedicion}-${t.numero}`);
  }

  esDudoso(campo: string): boolean {
    return this.cabecera()?.dudosos.includes(campo) === true;
  }

  nombre(p: Proveedor): string {
    return nombreProveedor(p);
  }

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  aNumero(evento: Event): number | null {
    const texto = this.valor(evento).trim().replace(',', '.');
    const n = Number(texto);
    return texto && Number.isFinite(n) ? n : null;
  }

  buscarProveedores(): void {
    const texto = this.textoProveedor().trim();
    if (!texto) return;
    this.recepcion.proveedores(texto).subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.proveedores.set(contenido);
        if (contenido.length === 0) this.notificacion.warn('Ningún proveedor con ese nombre.');
      },
    });
  }

  elegirProveedor(p: Proveedor): void {
    this.proveedorId.set(p.id ?? null);
    this.proveedorNombre.set(nombreProveedor(p));
    this.proveedores.set([]);
    this.textoProveedor.set('');
    this.buscando.set(false);
  }

  continuar(): void {
    const c = this.cabecera();
    const proveedorId = this.proveedorId();
    const tramos = this.tramosNumero();
    if (!c || proveedorId == null || !tramos || !this.puedeContinuar()) return;
    this.enviando.set(true);
    this.servicio
      .confirmarCabeceraFoto({
        documentoId: c.documentoId,
        proveedorId,
        timbrado: Number(this.timbrado().trim()),
        establecimiento: tramos.establecimiento,
        puntoExpedicion: tramos.puntoExpedicion,
        numero: tramos.numero,
        fechaEmision: this.fecha()!,
        condicion: this.condicion(),
        totalGeneral: this.total()!,
      })
      .subscribe({
        next: (factura) => {
          const pedidoId = aId(this.pedidoId());
          const ruta =
            pedidoId == null
              ? ['/operaciones/compras/nueva', factura.id]
              : ['/operaciones/compras', pedidoId, 'factura', factura.id];
          void this.router.navigate(ruta, { replaceUrl: true });
        },
        // El rechazo (duplicada, otro proveedor…) ya lo mostró DatosService.
        error: () => this.enviando.set(false),
      });
  }
}
