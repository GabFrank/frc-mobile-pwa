import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { forkJoin } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { FormaPago } from 'src/app/domains/forma-pago/forma-pago.model';
import { BeneficiarioTipo, TipoGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { Persona } from 'src/app/domains/personas/persona.model';
import { nombreProveedor, Proveedor } from 'src/app/domains/personas/proveedor.model';
import {
  BuscadorComponent,
  ConfigBuscador,
} from 'src/app/shared/buscador/buscador.component';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { GastosService } from './gastos.service';

/** `NORMAL` por defecto, verbatim de `frc-mobile`. */
const OPCIONES_URGENCIA: OpcionSeleccion[] = [
  { valor: 'BAJA', texto: 'Baja' },
  { valor: 'NORMAL', texto: 'Normal' },
  { valor: 'ALTA', texto: 'Alta' },
  { valor: 'URGENTE', texto: 'Urgente' },
];

/**
 * Alta de una solicitud de caja chica.
 *
 * Es el formulario más grande del módulo: tipo de gasto, activo imputado
 * (Task 8), beneficiario, detalle financiero (Task 9) y los datos del
 * retiro. Esta pantalla nace con la estructura, la carga de catálogos y sus
 * tres estados; el activo y los montos llegan en las tareas siguientes.
 *
 * ⚠️ **La carga inicial no puede fallar en silencio.** `frc-mobile` la envuelve
 * en un `catch {}` pelado y deja los selectores vacíos: un tipo de gasto sin
 * opciones se lee como «no hay tipos de gasto», no como «el central no
 * respondió». Acá un fallo de cualquiera de los cuatro catálogos muestra el
 * estado de error real, con reintentar.
 *
 * ⚠️ **No existe «entrar a una sucursal».** La sucursal de la sesión
 * (`AuthService.sucursal()`) es solo el valor por defecto del retiro; se deja
 * cambiar. Y **no se filtra por `soloOperables()`**: ese filtro es para lo
 * que mueve stock, y una caja chica se retira igual en una sucursal sin
 * depósito — `COMPRAS`, por ejemplo.
 *
 * ⚠️ **El responsable sale de la sesión y no se elige.** El retiro se imputa
 * a la persona del usuario logueado, no al usuario en sí.
 */
@Component({
  selector: 'frc-gastos-solicitud-nueva',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SelectorComponent,
    CampoFechaComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nueva solicitud" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else {
        <frc-seccion titulo="Responsable" [panel]="true">
          <p class="dato">{{ nombreResponsable() }}</p>
          <p class="ayuda">El retiro se imputa a la persona de la sesión, no se elige acá.</p>
        </frc-seccion>

        <frc-seccion titulo="Beneficiario" [panel]="true">
          <frc-selector
            etiqueta="Tipo de beneficiario"
            [opciones]="opcionesBeneficiarioTipo"
            [valor]="beneficiarioTipo()"
            (valorChange)="cambiarBeneficiarioTipo($event)"
          />
          @if (beneficiarioTipo() === 'PROVEEDOR') {
            <p class="dato">{{ nombreProveedorElegido() }}</p>
          } @else {
            <p class="dato">{{ nombrePersonaElegida() }}</p>
          }
          <button matButton="tonal" type="button" (click)="abrirBuscadorBeneficiario()">
            Elegir beneficiario
          </button>
        </frc-seccion>

        <frc-seccion titulo="Tipo de gasto" [panel]="true">
          <p class="dato">{{ nombreTipoGasto() }}</p>
          <button matButton="tonal" type="button" (click)="abrirBuscadorTipoGasto()">
            Elegir tipo de gasto
          </button>
        </frc-seccion>

        <frc-seccion titulo="Retiro" [panel]="true">
          <frc-selector
            etiqueta="Sucursal de retiro"
            [opciones]="opcionesSucursal()"
            [valor]="sucursalId()"
            (valorChange)="sucursalId.set($event == null ? null : +$event)"
          />
          <frc-campo-fecha
            etiqueta="Vencimiento"
            ayuda="Cuándo hace falta la plata"
            [(valor)]="fechaVencimiento"
          />
          <frc-selector
            etiqueta="Urgencia"
            [opciones]="opcionesUrgencia"
            [valor]="nivelUrgencia()"
            (valorChange)="cambiarUrgencia($event)"
          />
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>Descripción</mat-label>
            <input
              matInput
              [ngModel]="descripcion()"
              (ngModelChange)="descripcion.set($event)"
            />
          </mat-form-field>
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
    .dato { margin: 0; font-weight: var(--fw-medium); }
    .ayuda { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
  `,
})
export class GastosSolicitudNuevaPage {
  private readonly servicio = inject(GastosService);
  private readonly sucursalServicio = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);

  readonly opcionesUrgencia = OPCIONES_URGENCIA;
  readonly opcionesBeneficiarioTipo: OpcionSeleccion[] = [
    { valor: 'PROVEEDOR', texto: 'Proveedor' },
    { valor: 'PERSONA', texto: 'Persona' },
  ];

  // ─────────────────────────────────────────────────────────── Catálogos ──

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly tiposDeGasto = signal<TipoGasto[]>([]);
  readonly monedas = signal<Moneda[]>([]);
  readonly formasPago = signal<FormaPago[]>([]);
  readonly sucursales = signal<Sucursal[]>([]);

  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() =>
    this.sucursales().map((s) => ({ valor: s.id, texto: s.nombre ?? `Sucursal ${s.id}` })),
  );

  // ────────────────────────────────────────────────────────── Formulario ──

  /** ⚠️ No se elige: sale de `AuthService.usuario()`. El retiro va a la persona, no al usuario. */
  readonly responsableId = computed(() => this.auth.usuario()?.persona?.id ?? null);
  readonly nombreResponsable = computed(
    () => this.auth.usuario()?.persona?.nombre ?? 'Sin persona asociada',
  );

  readonly sucursalId = signal<number | null>(null);

  readonly tipoGasto = signal<TipoGasto | null>(null);
  readonly tipoGastoId = computed(() => this.tipoGasto()?.id ?? null);
  readonly nombreTipoGasto = computed(() => this.tipoGasto()?.descripcion ?? 'Sin elegir');

  readonly beneficiarioTipo = signal<BeneficiarioTipo>('PROVEEDOR');
  readonly proveedor = signal<Proveedor | null>(null);
  readonly personaBeneficiaria = signal<Persona | null>(null);
  readonly beneficiarioProveedorId = computed(() => this.proveedor()?.id ?? null);
  readonly beneficiarioPersonaId = computed(() => this.personaBeneficiaria()?.id ?? null);
  readonly nombreProveedorElegido = computed(() => nombreProveedor(this.proveedor()));
  readonly nombrePersonaElegida = computed(
    () => this.personaBeneficiaria()?.nombre ?? 'Sin elegir',
  );

  readonly fechaVencimiento = signal<string | null>(null);
  readonly nivelUrgencia = signal('NORMAL');
  readonly descripcion = signal('');

  readonly guardando = signal(false);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      tipos: this.servicio.tiposDeGasto(),
      monedas: this.servicio.monedas(),
      formasPago: this.servicio.formasPago(),
      sucursales: this.sucursalServicio.todas(),
    }).subscribe({
      next: ({ tipos, monedas, formasPago, sucursales }) => {
        this.tiposDeGasto.set(tipos ?? []);
        this.monedas.set(monedas ?? []);
        this.formasPago.set(formasPago ?? []);

        const lista = sucursales ?? [];
        this.sucursales.set(lista);

        // Valor por defecto: la sucursal de la sesión, si sigue en la lista.
        const propia = this.auth.sucursal()?.id;
        const elegida =
          propia != null && lista.some((s) => Number(s.id) === Number(propia))
            ? propia
            : (lista[0]?.id ?? null);
        this.sucursalId.set(elegida != null ? Number(elegida) : null);

        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  // ──────────────────────────────────────────────────────── Tipo de gasto ──

  elegirTipoGasto(tipo: TipoGasto): void {
    this.tipoGasto.set(tipo);
  }

  async abrirBuscadorTipoGasto(): Promise<void> {
    const elegido = await this.dialogo.abrir<
      BuscadorComponent<TipoGasto>,
      ConfigBuscador<TipoGasto>,
      TipoGasto
    >(BuscadorComponent, {
      modo: 'local',
      titulo: 'Elegir tipo de gasto',
      placeholder: 'Buscar tipo de gasto',
      items: this.tiposDeGasto(),
      texto: (t) => t.descripcion ?? 'Tipo de gasto',
      id: (t) => t.id,
    });
    if (elegido) {
      this.elegirTipoGasto(elegido);
    }
  }

  // ─────────────────────────────────────────────────────────── Beneficiario ──

  cambiarUrgencia(valor: unknown): void {
    this.nivelUrgencia.set(valor == null ? 'NORMAL' : String(valor));
  }

  cambiarBeneficiarioTipo(valor: unknown): void {
    this.beneficiarioTipo.set(valor === 'PERSONA' ? 'PERSONA' : 'PROVEEDOR');
  }

  elegirProveedor(proveedor: Proveedor): void {
    this.proveedor.set(proveedor);
  }

  elegirPersona(persona: Persona): void {
    this.personaBeneficiaria.set(persona);
  }

  async abrirBuscadorBeneficiario(): Promise<void> {
    if (this.beneficiarioTipo() === 'PROVEEDOR') {
      const elegido = await this.dialogo.abrir<
        BuscadorComponent<Proveedor>,
        ConfigBuscador<Proveedor>,
        Proveedor
      >(BuscadorComponent, {
        modo: 'paginado',
        titulo: 'Elegir proveedor',
        placeholder: 'Buscar proveedor',
        cargarPagina: (texto, pagina) => this.servicio.buscarProveedores(texto, pagina),
        texto: (p) => nombreProveedor(p),
        id: (p) => p.id,
      });
      if (elegido) {
        this.elegirProveedor(elegido);
      }
      return;
    }

    const elegido = await this.dialogo.abrir<
      BuscadorComponent<Persona>,
      ConfigBuscador<Persona>,
      Persona
    >(BuscadorComponent, {
      modo: 'paginado',
      titulo: 'Elegir persona',
      placeholder: 'Buscar persona',
      cargarPagina: (texto, pagina) => this.servicio.buscarPersonas(texto, pagina),
      texto: (p) => p.nombre,
      id: (p) => p.id,
    });
    if (elegido) {
      this.elegirPersona(elegido);
    }
  }
}
