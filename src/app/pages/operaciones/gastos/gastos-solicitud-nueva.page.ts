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
import {
  construirVistaResumen,
  aplicarAutocompletado,
  VistaResumenEnte,
} from 'src/app/domains/gastos/ente-financiero.reglas';
import {
  ActivoBusqueda,
  Equipo,
  Inmueble,
  Mueble,
  Vehiculo,
} from 'src/app/domains/gastos/ente.model';
import {
  BeneficiarioTipo,
  DetalleFinanciero,
  MonedaResumen,
  TipoGasto,
} from 'src/app/domains/gastos/pre-gasto.model';
import {
  etiquetaModuloPadre,
  requiereEnteActivo,
  tipoEnteDesdeModuloPadre,
} from 'src/app/domains/gastos/tipo-gasto.reglas';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { Persona } from 'src/app/domains/personas/persona.model';
import { nombreProveedor, Proveedor } from 'src/app/domains/personas/proveedor.model';
import type { ResumenFinancieroEnte } from 'src/app/graphql/operaciones/gastos/enteFinancialSummary';
import {
  BuscadorComponent,
  ConfigBuscador,
  ConfigBuscadorPaginado,
} from 'src/app/shared/buscador/buscador.component';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImportePipe } from 'src/app/shared/importe/importe.pipe';
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
    ImportePipe,
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

        @if (requiereActivo()) {
          <frc-seccion [titulo]="etiquetaActivo()" [panel]="true">
            <p class="dato">{{ textoActivo() || 'Sin elegir' }}</p>
            <button matButton="tonal" type="button" (click)="abrirBuscadorActivo()">
              Elegir {{ etiquetaActivo() }}
            </button>
            @if (errorResumen()) {
              <p class="error-resumen">No se pudo consultar el activo</p>
            } @else if (vistaResumen(); as resumen) {
              <div class="resumen">
                <p class="dato">{{ resumen.titulo }}</p>
                <p>
                  Pendiente:
                  {{ resumen.montoPendiente | importe: resumen.denominacion : resumen.simbolo }}
                </p>
                @if (resumen.mostrarCuotas) {
                  <p class="ayuda">{{ resumen.cuotaTexto }} · {{ resumen.cuotasFaltantesTexto }}</p>
                }
                @if (resumen.notificacion) {
                  <p class="ayuda">{{ resumen.notificacion }}</p>
                }
              </div>
            }
          </frc-seccion>
        }

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
    .resumen {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      margin-top: var(--sp-2);
      padding-top: var(--sp-2);
      border-top: 1px solid var(--border);
    }
    .error-resumen {
      margin: var(--sp-2) 0 0;
      font-size: var(--fs-caption);
      color: var(--danger);
    }
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

  // ──────────────────────────────────────────────────────────── Activo ──

  readonly moduloPadre = computed(() => this.tipoGasto()?.moduloPadre ?? null);
  /** Los siete servicios continuos también piden activo: se imputan a un `INMUEBLE`. */
  readonly requiereActivo = computed(() => requiereEnteActivo(this.moduloPadre()));
  readonly etiquetaActivo = computed(() => etiquetaModuloPadre(this.moduloPadre()));

  readonly enteId = signal<number | null>(null);
  readonly activoReferenciaId = signal<number | null>(null);
  readonly textoActivo = signal('');
  readonly vistaResumen = signal<VistaResumenEnte | null>(null);
  /** ⚠️ Nunca se muestra un monto en cero cuando esto es `true`: la tarjeta dice que no se pudo consultar. */
  readonly errorResumen = signal(false);

  // ────────────────────────────────────────────────────── Detalle financiero ──

  /**
   * Forma mínima del detalle: un único renglón `{monto, monedaId, formaPago}`.
   * Agregar/quitar filas y los totales por moneda son de la Task 9 — acá
   * alcanza con tener dónde autocompletar y dónde no pisar lo ya cargado.
   */
  readonly detalles = signal<DetalleFinanciero[]>([
    { monto: null, monedaId: null, formaPago: null },
  ]);

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

    // ⚠️ Cambiar de tipo de gasto tiene que limpiar el activo: si no, un
    // vehículo queda imputado a un gasto de inmueble y nadie lo nota.
    this.enteId.set(null);
    this.activoReferenciaId.set(null);
    this.textoActivo.set('');
    this.vistaResumen.set(null);
    this.errorResumen.set(false);
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

  // ─────────────────────────────────────────────────────────────── Activo ──

  /**
   * Qué buscador corresponde al módulo padre del tipo de gasto elegido.
   *
   * Extraído de `abrirBuscadorActivo()` para poder probarse sin pasar por
   * un diálogo real: los siete servicios continuos resuelven al mismo
   * buscador de inmuebles que `INMUEBLE`, vía `tipoEnteDesdeModuloPadre`.
   */
  configBuscadorActivo(): ConfigBuscadorPaginado<ActivoBusqueda> | null {
    const tipoEnte = tipoEnteDesdeModuloPadre(this.moduloPadre());
    switch (tipoEnte) {
      case 'VEHICULO':
        return {
          modo: 'paginado',
          titulo: 'Elegir vehículo',
          placeholder: 'Buscar vehículo',
          cargarPagina: (texto, pagina) => this.servicio.buscarVehiculos(texto, pagina),
          texto: (item) => (item as Vehiculo).chapa || `Vehículo ${item.id}`,
          id: (item) => item.id,
        };
      case 'MUEBLE':
        return {
          modo: 'paginado',
          titulo: 'Elegir mueble',
          placeholder: 'Buscar mueble',
          cargarPagina: (texto, pagina) => this.servicio.buscarMuebles(texto, pagina),
          texto: (item) => (item as Mueble).descripcion || `Mueble ${item.id}`,
          id: (item) => item.id,
        };
      case 'INMUEBLE':
        return {
          modo: 'paginado',
          titulo: 'Elegir inmueble',
          placeholder: 'Buscar inmueble',
          cargarPagina: (texto, pagina) => this.servicio.buscarInmuebles(texto, pagina),
          texto: (item) => (item as Inmueble).nombreAsignado || `Inmueble ${item.id}`,
          id: (item) => item.id,
        };
      case 'EQUIPO':
        return {
          modo: 'paginado',
          titulo: 'Elegir equipo',
          placeholder: 'Buscar equipo',
          cargarPagina: (texto, pagina) => this.servicio.buscarEquipos(texto, pagina),
          texto: (item) => {
            const equipo = item as Equipo;
            return equipo.identificador || equipo.descripcion || `Equipo ${item.id}`;
          },
          id: (item) => item.id,
        };
      default:
        return null;
    }
  }

  async abrirBuscadorActivo(): Promise<void> {
    const config = this.configBuscadorActivo();
    if (!config) {
      return;
    }
    const elegido = await this.dialogo.abrir<
      BuscadorComponent<ActivoBusqueda>,
      ConfigBuscador<ActivoBusqueda>,
      ActivoBusqueda
    >(BuscadorComponent, config);
    if (elegido) {
      await this.elegirActivo(elegido);
    }
  }

  /**
   * Vincula el activo elegido: resuelve su `Ente`, lee el resumen financiero
   * y aplica lo que se pueda autocompletar.
   *
   * ⚠️ Si el resumen falla, la tarjeta dice que no se pudo consultar y no
   * muestra ningún monto — un cero afirmaría una deuda que nadie confirmó.
   */
  async elegirActivo(item: ActivoBusqueda): Promise<void> {
    const config = this.configBuscadorActivo();
    this.activoReferenciaId.set(item.id);
    this.textoActivo.set(config ? config.texto(item) : '');
    this.vistaResumen.set(null);
    this.errorResumen.set(false);

    const modulo = this.moduloPadre();
    if (modulo == null) {
      return;
    }

    try {
      const ente = await this.servicio.resolverEnte(modulo, item.id);
      this.enteId.set(ente.id ?? null);
    } catch {
      this.errorResumen.set(true);
      return;
    }

    const enteId = this.enteId();
    if (enteId == null) {
      this.errorResumen.set(true);
      return;
    }

    this.servicio.resumenDelEnte(enteId, this.tipoGastoId()).subscribe({
      next: (resumen) => this.aplicarResumen(resumen),
      // Cualquier fallo del `Observable` —de red, de GraphQL— cae acá.
      error: () => this.errorResumen.set(true),
    });
  }

  /**
   * Único punto por el que un resumen recibido se convierte en tarjeta o en
   * error. Es a propósito el único lugar que hace `errorResumen.set(true)`
   * fuera de los otros dos guardas tempranos de `elegirActivo` (módulo sin
   * activo, `Ente` sin id) — así un fallo nuevo, sea cual sea su forma, no
   * tiene otro camino que ese mismo `catch`.
   *
   * ⚠️ **`resumen` puede llegar `null` con una respuesta GraphQL válida**
   * (`DatosService.consultar` no envuelve `data: null` en un error — Task 6
   * ya lo prueba para `resolverEnte`). Sin este guardia, `construirVistaResumen`
   * revienta dentro del `next` del `subscribe`: RxJS no reencamina una
   * excepción lanzada ahí hacia `error`, así que quedaba sin manejar y la
   * tarjeta no decía nada — se rompía en silencio en vez de avisar.
   */
  private aplicarResumen(resumen: ResumenFinancieroEnte | null | undefined): void {
    if (resumen == null) {
      this.errorResumen.set(true);
      return;
    }

    try {
      this.vistaResumen.set(construirVistaResumen(resumen, this.monedasParaResumen()));

      const resultado = aplicarAutocompletado(resumen, {
        fechaVencimiento: this.fechaVencimiento() ?? '',
        detalles: this.detalles(),
        beneficiarioTipo: this.beneficiarioTipo(),
        beneficiarioProveedorId: this.beneficiarioProveedorId(),
        textoProveedor: '',
      });
      this.fechaVencimiento.set(resultado.fechaVencimiento || null);
      this.detalles.set(resultado.detalles);
      if (resultado.beneficiarioProveedorId != null) {
        // ⚠️ Pisa el beneficiario ya elegido a mano, a propósito: es el
        // apartamiento deliberado del spec (portado de `frc-mobile`) para
        // los gastos recurrentes con proveedor conocido —cuando el central
        // sabe a quién se le paga ese gasto, ese proveedor manda sobre lo
        // que el operador haya tocado antes en el buscador de beneficiario.
        // No lo "arregles" sacando este pisado sin revisar el spec primero.
        this.beneficiarioTipo.set('PROVEEDOR');
        this.proveedor.set({
          id: resultado.beneficiarioProveedorId,
          persona: { nombre: resultado.textoProveedor },
        } as Proveedor);
      }
    } catch {
      // Un resumen con forma inesperada no es distinto de un resumen que no
      // llegó: la tarjeta tiene que decir lo mismo en los dos casos.
      this.vistaResumen.set(null);
      this.errorResumen.set(true);
    }
  }

  /** `MonedaResumen` exige `id` numérico; `Moneda.id` llega opcional del catálogo. */
  private monedasParaResumen(): MonedaResumen[] {
    return this.monedas()
      .filter((m): m is Moneda & { id: number } => m.id != null)
      .map((m) => ({ id: m.id, denominacion: m.denominacion, simbolo: m.simbolo }));
  }

  cambiarDetalle(indice: number, cambios: Partial<DetalleFinanciero>): void {
    this.detalles.update((lista) =>
      lista.map((detalle, i) => (i === indice ? { ...detalle, ...cambios } : detalle)),
    );
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
