import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from 'src/app/core/auth/auth.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PdfService } from 'src/app/core/ui/pdf.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import {
  esSucursalOperable,
  soloOperables,
} from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { Proveedor, nombreProveedor } from 'src/app/domains/personas/proveedor.model';
import { RetiroProducto } from 'src/app/domains/devolucion/retiro.model';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import {
  OpcionSeleccion,
  SelectorComponent,
} from 'src/app/shared/selector/selector.component';
import {
  DevolucionParaRetiro,
  cantidadDelProducto,
  devolucionesDelConsolidado,
  separarResultados,
  verificarEscaneo,
} from './devolucion-retiro.reglas';
import { DevolucionService } from './devolucion.service';

/** Valor del selector de sucursal que significa «todas». */
const TODAS = 'todas';

interface ResultadoRetiro {
  retiradas: number[];
  fallidas: { id: number; identificador: string; mensaje: string }[];
}

/**
 * Retiro de devoluciones por el proveedor.
 *
 * Se elige el proveedor, se escanea **la etiqueta de cada devolución** y se
 * confirma: las verificadas pasan a RETIRADO y queda el comprobante.
 *
 * ⚠️ **La unidad es la devolución, no el producto.** La etiqueta es una sola
 * por devolución, con un QR; escanearla la verifica entera y muestra todos sus
 * productos. Antes se imprimía una por producto con el mismo QR repetido, y el
 * escaneo de `frc-mobile` se trababa en el segundo («ya estaba verificada»).
 *
 * ⚠️ **Marcar sin escanear depende de la configuración del módulo**
 * (`retiroPermitirSeleccionManual`), igual que en el escritorio. Sin ese
 * permiso, lo que no se escaneó no se retira: es el control de que la caja
 * está realmente en el camión.
 *
 * ⚠️ **El retiro es parcialmente exitoso.** El central devuelve un resultado
 * por devolución y no frena las demás si una falla; se muestra cuál y por qué.
 */
@Component({
  selector: 'frc-devolucion-retiro',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    SelectorComponent,
    IconoComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Retiro a proveedor" [conVolver]="true" [conEscaner]="false">
      @if (puedeEscanear()) {
        <div acciones>
          <button matButton="filled" (click)="escanear()">
            <frc-icono nombre="escanear" [tamano]="18" /> Escanear devolución
          </button>
        </div>
      }

      @if (resultado(); as r) {
        <frc-seccion titulo="Resultado" [panel]="true">
          <frc-dato etiqueta="Retiradas" [valor]="r.retiradas.length" />
          @if (r.fallidas.length > 0) {
            <frc-dato etiqueta="Sin retirar" [valor]="r.fallidas.length" />
          }
          @if (r.retiradas.length > 0) {
            <button
              matButton="filled"
              [disabled]="comprobante() == null"
              (click)="verComprobante()"
            >
              {{ comprobante() == null ? 'Preparando comprobante…' : 'Ver comprobante' }}
            </button>
          }
          <button matButton (click)="nuevoRetiro()">Nuevo retiro</button>
        </frc-seccion>

        @for (f of r.fallidas; track f.id) {
          <frc-card [titulo]="f.identificador" [subtitulo]="f.mensaje" icono="error" />
        }
      } @else {
        <frc-seccion titulo="Proveedor" [panel]="true">
          <frc-selector
            etiqueta="Sucursal donde están"
            [opciones]="opcionesSucursal()"
            [valor]="sucursalId()"
            (valorChange)="elegirSucursal($event)"
          />
          @if (proveedor(); as p) {
            <p class="elegido">
              <frc-icono nombre="camion" [tamano]="18" />
              {{ nombre(p) }}
              <button type="button" class="cambiar" (click)="cambiarProveedor()">Cambiar</button>
            </p>
          } @else {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
              <mat-label>Buscar proveedor</mat-label>
              <input
                matInput
                [ngModel]="textoProveedor()"
                (ngModelChange)="textoProveedor.set($event)"
                (keyup.enter)="buscarProveedores()"
              />
            </mat-form-field>
            <button
              matButton="tonal"
              [disabled]="buscandoProveedor()"
              (click)="buscarProveedores()"
            >
              {{ buscandoProveedor() ? 'Buscando…' : 'Buscar' }}
            </button>
            @for (p of proveedores(); track p.id) {
              <frc-card [titulo]="nombre(p)" icono="persona" (abrir)="elegirProveedor(p)" />
            }
          }
          @if (lista().length > 0) {
            <frc-dato etiqueta="Verificadas" [valor]="verificadasTexto()" />
          }
        </frc-seccion>

        @if (proveedor()) {
          @if (cargando()) {
            <frc-skeleton [cantidad]="3" />
          } @else if (error()) {
            <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
          } @else if (lista().length === 0) {
            <frc-estado-vacio
              titulo="Nada para retirar"
              detalle="Este proveedor no tiene devoluciones separadas en esta sucursal."
              icono="camion"
            />
          } @else {
            <p class="ayuda">
              Escaneá el QR de la etiqueta de cada devolución. Un QR trae todos sus productos.
            </p>
            @for (d of lista(); track d.devolucionId) {
              <frc-card
                [titulo]="d.identificador"
                [subtitulo]="subtitulo(d)"
                [icono]="esVerificada(d) ? 'checkCirculo' : 'etiqueta'"
                (abrir)="alternar(d)"
              >
                <span aparte [class.ok]="esVerificada(d)">
                  {{ esVerificada(d) ? 'Verificada' : 'Falta escanear' }}
                </span>
                @if (estaAbierta(d)) {
                  <ul pie class="productos">
                    @for (p of d.productos; track $index) {
                      <li>
                        <span class="descripcion">{{ p.descripcion }}</span>
                        <span class="cantidad">{{ cantidad(p) }}</span>
                      </li>
                    }
                  </ul>
                }
                @if (seleccionManual()) {
                  <div botonera>
                    <button matButton (click)="marcarAMano(d)">
                      {{ esVerificada(d) ? 'Desmarcar' : 'Marcar sin escanear' }}
                    </button>
                  </div>
                }
              </frc-card>
            }

            <button
              matButton="filled"
              class="retirar"
              [disabled]="verificadas().size === 0 || retirando()"
              (click)="retirar()"
            >
              {{ retirando() ? 'Retirando…' : textoRetirar() }}
            </button>
          }
        }
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
    .cambiar {
      background: none;
      border: 0;
      color: var(--brand-text);
      font-size: var(--fs-caption);
      cursor: pointer;
      padding: var(--sp-1);
    }
    .ayuda { color: var(--text-mute); font-size: var(--fs-caption); margin: 0; }
    .ok { color: var(--ok); font-weight: var(--fw-medium); }
    .productos {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      width: 100%;
    }
    .productos li {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-2);
      font-size: var(--fs-caption);
    }
    .cantidad {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
      white-space: nowrap;
    }
    .retirar { align-self: stretch; margin-top: var(--sp-3); }
  `,
})
export class DevolucionRetiroPage {
  private readonly servicio = inject(DevolucionService);
  private readonly auth = inject(AuthService);
  private readonly escaner = inject(EscanerService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly pdf = inject(PdfService);
  private readonly router = inject(Router);
  private readonly sucursalesService = inject(SucursalService);

  readonly sucursales = signal<Sucursal[]>([]);
  readonly sucursalId = signal<unknown>(TODAS);
  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() => [
    { valor: TODAS, texto: 'Todas las sucursales' },
    ...this.sucursales().map((s) => ({
      valor: s.id,
      texto: String(s.nombre ?? `Sucursal ${s.id}`),
    })),
  ]);

  readonly proveedor = signal<Proveedor | null>(null);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly textoProveedor = signal('');
  readonly buscandoProveedor = signal(false);

  readonly lista = signal<DevolucionParaRetiro[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly seleccionManual = signal(false);

  /** Ids de las devoluciones verificadas (escaneadas o marcadas a mano). */
  readonly verificadas = signal<ReadonlySet<number>>(new Set());
  /** Ids de las que muestran sus productos. */
  private readonly abiertas = signal<ReadonlySet<number>>(new Set());

  readonly retirando = signal(false);
  readonly resultado = signal<ResultadoRetiro | null>(null);
  /** Base64 del comprobante, pedido apenas termina el retiro. Ver `verComprobante`. */
  readonly comprobante = signal<string | null>(null);

  readonly puedeEscanear = computed(
    () => this.resultado() == null && this.lista().length > 0 && !this.retirando(),
  );
  readonly verificadasTexto = computed(
    () => `${this.verificadas().size} de ${this.lista().length}`,
  );
  readonly textoRetirar = computed(() => {
    const n = this.verificadas().size;
    return n === 1 ? 'Retirar 1 devolución' : `Retirar ${n} devoluciones`;
  });

  constructor() {
    this.sucursalesService.todas().subscribe({
      next: (todas) => {
        const locales = soloOperables(todas ?? []);
        this.sucursales.set(locales);
        // La de la sesión, si es un local: el retiro se hace donde está la
        // mercadería. Desde una sucursal virtual (SERVIDOR), todas.
        const deLaSesion = this.auth.sucursal();
        if (esSucursalOperable(deLaSesion)) {
          const preferida = locales.find((s) => String(s.id) === String(deLaSesion?.id));
          if (preferida) {
            this.sucursalId.set(preferida.id);
          }
        }
      },
      error: () => this.notificacion.warn('No se pudieron cargar las sucursales.'),
    });

    this.servicio.configuracionRetiro().subscribe({
      next: (c) => this.seleccionManual.set(c?.retiroPermitirSeleccionManual === true),
      // Sin configuración, lo seguro: solo lo escaneado se retira.
      error: () => this.seleccionManual.set(false),
    });
  }

  nombre(p: Proveedor): string {
    return nombreProveedor(p);
  }

  buscarProveedores(): void {
    const texto = this.textoProveedor().trim();
    if (texto.length === 0 || this.buscandoProveedor()) {
      return;
    }
    this.buscandoProveedor.set(true);
    this.servicio.proveedores(texto).subscribe({
      next: (page) => {
        this.buscandoProveedor.set(false);
        const contenido = page?.getContent ?? [];
        this.proveedores.set(contenido);
        if (contenido.length === 0) {
          this.notificacion.warn('Ningún proveedor con ese nombre.');
        }
      },
      error: () => this.buscandoProveedor.set(false),
    });
  }

  elegirProveedor(p: Proveedor): void {
    this.proveedor.set(p);
    this.proveedores.set([]);
    this.textoProveedor.set('');
    this.cargar();
  }

  cambiarProveedor(): void {
    this.proveedor.set(null);
    this.limpiarLista();
  }

  elegirSucursal(valor: unknown): void {
    this.sucursalId.set(valor);
    if (this.proveedor()) {
      this.cargar();
    }
  }

  /**
   * Trae lo que hay para retirar. Volver a cargar descarta lo verificado: la
   * lista puede haber cambiado y una marca vieja quedaría colgada de otra.
   */
  cargar(): void {
    const proveedorId = Number(this.proveedor()?.id);
    if (!Number.isFinite(proveedorId)) {
      return;
    }
    const sucursal = this.sucursalId();
    const sucursalId = sucursal === TODAS || sucursal == null ? null : Number(sucursal);

    this.limpiarLista();
    this.cargando.set(true);
    this.servicio.consolidadoRetiro(proveedorId, sucursalId).subscribe({
      next: (consolidado) => {
        this.lista.set(devolucionesDelConsolidado(consolidado));
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  subtitulo(d: DevolucionParaRetiro): string {
    const n = d.productos.length;
    const productos = n === 1 ? '1 producto' : `${n} productos`;
    return [d.sucursal, productos].filter(Boolean).join(' · ');
  }

  cantidad(p: RetiroProducto): string {
    return cantidadDelProducto(p);
  }

  esVerificada(d: DevolucionParaRetiro): boolean {
    return this.verificadas().has(d.devolucionId);
  }

  estaAbierta(d: DevolucionParaRetiro): boolean {
    return this.abiertas().has(d.devolucionId);
  }

  /** Tocar la devolución muestra u oculta sus productos; no la verifica. */
  alternar(d: DevolucionParaRetiro): void {
    this.abiertas.update((s) => alternarEn(s, d.devolucionId));
  }

  async escanear(): Promise<void> {
    const texto = await this.escaner.escanear({
      titulo: 'Escanear devolución',
      ayuda: 'Apuntá al QR de la etiqueta de la devolución',
      formatos: FORMATOS_QR,
      etiquetaManual: 'Identificador (DEV-1-24)',
    });
    if (!texto) {
      return;
    }

    const r = verificarEscaneo(this.lista(), this.verificadas(), texto);
    switch (r.clase) {
      case 'verificada': {
        const id = r.devolucion.devolucionId;
        this.verificadas.update((s) => new Set(s).add(id));
        // Se abre sola: es lo que se quiere ver al escanear, qué trae la caja.
        this.abiertas.update((s) => new Set(s).add(id));
        const n = r.devolucion.productos.length;
        this.notificacion.ok(
          `${r.devolucion.identificador} verificada: ${n} ${n === 1 ? 'producto' : 'productos'}.`,
        );
        break;
      }
      case 'repetida':
        this.notificacion.warn(`${r.devolucion.identificador} ya estaba verificada.`);
        break;
      case 'ajena':
        this.notificacion.warn(r.mensaje);
        break;
    }
  }

  /** Solo con `retiroPermitirSeleccionManual`: la pantalla no muestra el botón sin él. */
  marcarAMano(d: DevolucionParaRetiro): void {
    if (!this.seleccionManual()) {
      return;
    }
    this.verificadas.update((s) => alternarEn(s, d.devolucionId));
  }

  async retirar(): Promise<void> {
    const ids = [...this.verificadas()];
    const usuarioId = this.auth.usuario()?.id;
    if (ids.length === 0 || usuarioId == null || this.retirando()) {
      return;
    }
    const faltan = this.lista().length - ids.length;
    const ok = await this.dialogo.confirmar({
      titulo: 'Retirar devoluciones',
      mensaje:
        `Se entregan ${ids.length} ${ids.length === 1 ? 'devolución' : 'devoluciones'} ` +
        `a ${nombreProveedor(this.proveedor()!)} y pasan a Retirado.` +
        (faltan > 0 ? ` ${faltan} sin verificar quedan para otro retiro.` : ''),
      confirmar: 'Retirar',
    });
    if (!ok) {
      return;
    }

    this.retirando.set(true);
    this.servicio.retirar(ids, Number(usuarioId)).subscribe({
      next: (respuesta) => {
        this.retirando.set(false);
        const { retiradas, fallidas } = separarResultados(respuesta);
        const porId = new Map(this.lista().map((d) => [d.devolucionId, d.identificador]));
        this.resultado.set({
          retiradas,
          fallidas: fallidas.map((f) => ({
            ...f,
            identificador: porId.get(f.id) ?? `#${f.id}`,
          })),
        });
        if (retiradas.length > 0) {
          this.notificacion.ok(
            retiradas.length === 1
              ? 'Se retiró 1 devolución.'
              : `Se retiraron ${retiradas.length} devoluciones.`,
          );
          this.pedirComprobante(retiradas);
        }
        if (fallidas.length > 0) {
          this.notificacion.warn(
            fallidas.length === 1
              ? '1 devolución no se pudo retirar.'
              : `${fallidas.length} devoluciones no se pudieron retirar.`,
          );
        }
      },
      error: (err: Error) => {
        this.retirando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * ⚠️ **Se pide antes de que lo toquen.** `PdfService` tiene que abrir el
   * PDF dentro del gesto del usuario: si el botón esperara la red, el
   * bloqueador de ventanas lo cortaría.
   */
  private pedirComprobante(ids: number[]): void {
    this.servicio.comprobanteRetiro(ids).subscribe({
      next: (base64) => this.comprobante.set(base64 ?? null),
      error: () => this.notificacion.warn('No se pudo generar el comprobante.'),
    });
  }

  verComprobante(): void {
    const base64 = this.comprobante();
    if (base64) {
      this.pdf.abrirBase64(base64, 'comprobante-retiro.pdf');
    }
  }

  nuevoRetiro(): void {
    this.resultado.set(null);
    this.comprobante.set(null);
    this.cargar();
  }

  private limpiarLista(): void {
    this.lista.set([]);
    this.verificadas.set(new Set());
    this.abiertas.set(new Set());
    this.error.set(null);
  }
}

function alternarEn(conjunto: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const nuevo = new Set(conjunto);
  if (nuevo.has(id)) {
    nuevo.delete(id);
  } else {
    nuevo.add(id);
  }
  return nuevo;
}
