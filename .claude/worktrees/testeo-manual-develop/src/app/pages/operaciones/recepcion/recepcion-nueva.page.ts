import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import {
  ESTADOS_NOTA_COMPLETA,
  NotaRecepcion,
} from 'src/app/domains/pedidos/recepcion.model';
import { Proveedor, nombreProveedor } from 'src/app/domains/personas/proveedor.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { descodificarQr } from 'src/app/generic/utils/qrUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { RecepcionService } from './recepcion.service';

/** Denominaciones que identifican la moneda local. */
const LOCALES = ['GUARANI', 'GS'];

/**
 * Arranque de una recepción: sucursal, proveedor y las notas que trae.
 *
 * ⚠️ **La sucursal se escanea del cartel del depósito.** Es el control de que
 * quien recibe está parado donde entra la mercadería. `frc-mobile` lo hace
 * igual —y sin alternativa, salvo un atajo de desarrollo que cargaba la
 * sucursal 13—; acá se agrega elegirla de la lista para cuando la cámara no
 * está disponible, porque en iOS y en un navegador de escritorio no siempre
 * la hay.
 *
 * ⚠️ **Solo sucursales con depósito.** Una sucursal virtual no mueve stock:
 * recibir mercadería contra ella no significa nada. Ver `sucursal.util.ts`.
 */
@Component({
  selector: 'frc-recepcion-nueva',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    CardComponent,
    SelectorComponent,
    IconoComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nueva recepción" [conVolver]="true">
      <frc-seccion titulo="1 · Sucursal que recibe" [panel]="true">
        @if (sucursal(); as s) {
          <p class="elegido">
            <frc-icono nombre="sucursal" [tamano]="18" />
            {{ s.nombre }}
            <button type="button" class="cambiar" (click)="limpiarSucursal()">Cambiar</button>
          </p>
        } @else {
          <button matButton="filled" (click)="escanearSucursal()">Escanear el cartel</button>
          <frc-selector
            etiqueta="O elegila de la lista"
            [opciones]="opcionesSucursal()"
            [valor]="null"
            (valorChange)="elegirSucursal($event)"
          />
        }
      </frc-seccion>

      <frc-seccion titulo="2 · Proveedor" [panel]="true">
        @if (proveedor(); as p) {
          <p class="elegido">
            <frc-icono nombre="camion" [tamano]="18" />
            {{ nombre(p) }}
            <button type="button" class="cambiar" (click)="cambiarProveedor()">Cambiar</button>
          </p>
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

      @if (sucursal() && proveedor()) {
        <frc-seccion titulo="3 · Notas que trae" [panel]="true">
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

          @for (n of notas(); track n.id) {
            <frc-card [titulo]="tituloNota(n)" [subtitulo]="detalleNota(n)" icono="documento">
              <button type="button" aparte class="quitar" (click)="quitarNota(n)">Quitar</button>
            </frc-card>
          }
        </frc-seccion>

        <frc-seccion titulo="4 · Moneda" [panel]="true">
          <frc-selector
            etiqueta="Moneda de las notas"
            [opciones]="opcionesMoneda()"
            [valor]="monedaId()"
            (valorChange)="cambiarMoneda($event)"
          />
          @if (necesitaCotizacion()) {
            <mat-form-field appearance="outline" class="campo">
              <mat-label>Cotización</mat-label>
              <input
                matInput
                type="number"
                inputmode="decimal"
                min="0"
                [ngModel]="cotizacion()"
                (ngModelChange)="cotizacion.set($event)"
              />
            </mat-form-field>
            <p class="ayuda">
              Cuánto vale una unidad de esa moneda en guaraníes. Sin esto los
              importes de la recepción quedan mal.
            </p>
          }
        </frc-seccion>

        <button
          matButton="filled"
          class="iniciar"
          [disabled]="!puedeIniciar() || iniciando()"
          (click)="iniciar()"
        >
          {{ iniciando() ? 'Iniciando…' : 'Iniciar recepción' }}
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
    .ayuda { color: var(--text-mute); font-size: var(--fs-caption); margin: 0; }
    .iniciar { align-self: stretch; margin-top: var(--sp-3); }
  `,
})
export class RecepcionNuevaPage {
  private readonly servicio = inject(RecepcionService);
  private readonly sucursales = inject(SucursalService);
  private readonly escaner = inject(EscanerService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly sucursal = signal<Sucursal | null>(null);
  readonly proveedor = signal<Proveedor | null>(null);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly notas = signal<NotaRecepcion[]>([]);
  readonly monedas = signal<Moneda[]>([]);
  readonly monedaId = signal<number | null>(null);
  readonly cotizacion = signal<number | null>(null);

  readonly textoProveedor = signal('');
  readonly numeroNota = signal<number | null>(null);
  readonly buscandoNota = signal(false);
  readonly iniciando = signal(false);

  private todasLasSucursales: Sucursal[] = [];

  readonly opcionesSucursal = signal<OpcionSeleccion[]>([]);

  readonly opcionesMoneda = computed<OpcionSeleccion[]>(() =>
    this.monedas().map((m) => ({
      valor: m.id ?? null,
      texto: m.denominacion ?? 'Moneda',
      detalle: m.simbolo ?? undefined,
    })),
  );

  /** La moneda elegida no es la local: hay que informar la cotización. */
  readonly necesitaCotizacion = computed(() => {
    const moneda = this.monedas().find((m) => String(m.id) === String(this.monedaId()));
    return moneda != null && !esMonedaLocal(moneda);
  });

  readonly puedeIniciar = computed(
    () =>
      this.sucursal() != null &&
      this.proveedor() != null &&
      this.notas().length > 0 &&
      this.monedaId() != null &&
      (!this.necesitaCotizacion() || (this.cotizacion() ?? 0) > 0),
  );

  constructor() {
    this.sucursales.todas().subscribe({
      next: (lista) => {
        this.todasLasSucursales = lista ?? [];
        this.opcionesSucursal.set(
          soloOperables(this.todasLasSucursales).map((s) => ({
            valor: s.id ?? null,
            texto: s.nombre ?? 'Sucursal',
          })),
        );
      },
    });

    this.servicio.monedas().subscribe({
      next: (lista) => {
        this.monedas.set(lista);
        const local = lista.find(esMonedaLocal) ?? lista[0];
        this.monedaId.set(local?.id ?? null);
      },
    });
  }

  nombre(p: Proveedor): string {
    return nombreProveedor(p);
  }

  // ─────────────────────────────────────────────────────────── Sucursal ──

  async escanearSucursal(): Promise<void> {
    const codigo = await this.escaner.escanear({
      titulo: 'Escaneá el cartel de la sucursal',
      ayuda: 'El QR está en el cartel del depósito.',
      formatos: ['qr_code'],
    });
    if (!codigo) {
      return;
    }

    const qr = descodificarQr(codigo);
    const id = Number(qr?.sucursalId);
    if (!qr || !Number.isFinite(id)) {
      this.notificacion.warn('Ese QR no es de una sucursal del sistema.');
      return;
    }
    this.aplicarSucursal(id);
  }

  elegirSucursal(valor: unknown): void {
    if (valor == null) {
      return;
    }
    this.aplicarSucursal(Number(valor));
  }

  limpiarSucursal(): void {
    this.sucursal.set(null);
    // Las notas cuelgan de la sucursal: la recepción activa se chequea por
    // nota **y** sucursal, así que lo verificado deja de valer.
    this.notas.set([]);
  }

  private aplicarSucursal(id: number): void {
    const encontrada = this.todasLasSucursales.find((s) => String(s.id) === String(id));
    if (!encontrada) {
      this.notificacion.warn('No se encontró esa sucursal.');
      return;
    }
    if (soloOperables([encontrada]).length === 0) {
      this.notificacion.warn(
        (encontrada.nombre ?? 'Esa sucursal') + ' no tiene depósito: no puede recibir mercadería.',
      );
      return;
    }
    this.sucursal.set(encontrada);
    this.notas.set([]);
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

  // ──────────────────────────────────────────────────────────────── Notas ──

  /**
   * Busca la nota y la suma a la lista.
   *
   * Tres controles antes de agregarla, y ninguno es decorativo: una nota
   * duplicada, una ya recibida o una con recepción abierta terminan en
   * movimientos de stock y costos duplicados.
   */
  async agregarNota(): Promise<void> {
    const numero = Number(this.numeroNota() ?? 0);
    const proveedorId = this.proveedor()?.id;
    const sucursalId = this.sucursal()?.id;
    if (!numero || proveedorId == null || sucursalId == null) {
      return;
    }

    this.buscandoNota.set(true);
    let encontradas: NotaRecepcion[] = [];
    try {
      encontradas = await firstValueFrom(
        this.servicio.notasPorNumero(proveedorId, numero, sucursalId),
      );
    } catch {
      this.buscandoNota.set(false);
      return;
    }
    this.buscandoNota.set(false);

    if (encontradas.length === 0) {
      this.notificacion.warn('No hay ninguna nota con ese número para este proveedor.');
      return;
    }

    const pendientes = encontradas.filter(
      (n) => !ESTADOS_NOTA_COMPLETA.includes(n.estado ?? ''),
    );
    if (pendientes.length === 0) {
      this.notificacion.warn('Esa nota ya fue recibida por completo.');
      return;
    }
    if (pendientes.length > 1) {
      // Puede haber varias con el mismo número: distinto timbrado, distinto
      // pedido. Elegir por el sistema sería elegir mal la mitad de las veces.
      this.notificacion.warn(
        'Hay ' +
          pendientes.length +
          ' notas con ese número. Cargala desde el desktop o verificá el timbrado.',
      );
      return;
    }

    await this.procesarNota(pendientes[0], sucursalId);
  }

  private async procesarNota(nota: NotaRecepcion, sucursalId: number): Promise<void> {
    if (this.notas().some((n) => String(n.id) === String(nota.id))) {
      this.notificacion.warn('Esa nota ya está en la lista.');
      return;
    }

    const activa = await this.recepcionActiva(nota.id as number, sucursalId);
    if (activa) {
      const nombreSucursal = this.sucursal()?.nombre ?? 'esta sucursal';
      const mensaje =
        activa.estado === 'FINALIZADA'
          ? 'Esta nota ya se recibió y finalizó en ' +
            nombreSucursal +
            ' (recepción #' +
            activa.id +
            '). Para corregirla hay que reabrir esa recepción: crear otra duplicaría stock y costos.'
          : 'Esta nota ya tiene una recepción abierta en ' +
            nombreSucursal +
            ' (#' +
            activa.id +
            '). Terminala o cancelala antes de volver a cargarla.';
      this.notificacion.warn(mensaje);
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Nota ' + (nota.numero ?? nota.id),
      mensaje: this.detalleNota(nota),
      confirmar: 'Agregar',
    });
    if (!ok) {
      return;
    }

    this.notas.update((previas) => [...previas, nota]);
    this.numeroNota.set(null);
    this.adoptarMonedaDeNota(nota);
  }

  /**
   * Si la nota trae moneda, se toma como la de la recepción.
   *
   * ⚠️ Es el dato que `frc-mobile` ignoraba: iniciaba siempre con la primera
   * moneda de la lista y cotización `1.0`, así que una nota en dólares se
   * cargaba como si fueran guaraníes.
   */
  private adoptarMonedaDeNota(nota: NotaRecepcion): void {
    if (nota.moneda?.id != null) {
      this.monedaId.set(nota.moneda.id);
    }
    if (nota.cotizacion != null && nota.cotizacion > 0) {
      this.cotizacion.set(nota.cotizacion);
    }
  }

  private async recepcionActiva(notaId: number, sucursalId: number) {
    try {
      return await firstValueFrom(this.servicio.recepcionActiva(notaId, sucursalId));
    } catch {
      // Si el chequeo falla no se bloquea la carga: el backend vuelve a
      // validar al iniciar. Se avisa para que no pase inadvertido.
      this.notificacion.warn('No se pudo verificar si la nota ya está en recepción.');
      return null;
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
      n.timbrado ? 'timbrado ' + n.timbrado : '',
      n.valorTotal != null ? formatearCantidad(n.valorTotal, 0) : '',
      n.estado,
    ];
    return partes.filter(Boolean).join(' · ');
  }

  cambiarMoneda(valor: unknown): void {
    this.monedaId.set(valor == null ? null : Number(valor));
    if (!this.necesitaCotizacion()) {
      this.cotizacion.set(null);
    }
  }

  // ──────────────────────────────────────────────────────────────── Inicio ──

  async iniciar(): Promise<void> {
    const sucursalId = this.sucursal()?.id;
    const proveedorId = this.proveedor()?.id;
    const monedaId = this.monedaId();
    const usuarioId = this.auth.usuario()?.id;
    if (sucursalId == null || proveedorId == null || monedaId == null || usuarioId == null) {
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Iniciar recepción',
      mensaje:
        'Se abre la recepción de ' +
        this.notas().length +
        (this.notas().length === 1 ? ' nota en ' : ' notas en ') +
        (this.sucursal()?.nombre ?? '') +
        '.',
      confirmar: 'Iniciar',
    });
    if (!ok) {
      return;
    }

    this.iniciando.set(true);
    this.servicio
      .iniciar({
        sucursalId,
        proveedorId,
        monedaId,
        usuarioId,
        notaRecepcionIds: this.notas().map((n) => n.id as number),
        // Guaraníes contra guaraníes es 1: no es un default silencioso, es la
        // cotización real de la moneda local.
        cotizacion: this.necesitaCotizacion() ? (this.cotizacion() as number) : 1,
      })
      .subscribe({
        next: (recepcion) => {
          this.iniciando.set(false);
          if (recepcion?.id != null) {
            this.notificacion.ok('Recepción iniciada.');
            void this.router.navigate(['/operaciones/recepcion', recepcion.id]);
          }
        },
        error: () => this.iniciando.set(false),
      });
  }
}

function esMonedaLocal(moneda: Moneda): boolean {
  const denominacion = (moneda?.denominacion ?? '').toUpperCase();
  return LOCALES.some((l) => denominacion.includes(l));
}
