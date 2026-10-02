import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { Inventario } from 'src/app/domains/inventario/inventario.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { antiguedadEnDias, avisoDeTomasAbiertas, nuevoInventarioInput } from './inventario-alta';
import { InventarioService } from './inventario.service';

/**
 * Abrir una toma de inventario.
 *
 * ⚠️ **Avisa que ya hay tomas abiertas, pero no bloquea.** La regla «una sola
 * por sucursal» es real y el central no la aplica; el problema es que
 * **tampoco se aplicó nunca en los datos**: en la base de bodega, `SUC.
 * CENTRAL` tiene 24 inventarios en estado `ABIERTO`, el más viejo de mayo de
 * 2023, casi todos de otra gente y sin ítems. Bloquear hasta cerrarlas dejaba
 * el alta inutilizable —cerrás una y aparece la siguiente— y empujaba a la
 * peor salida: **finalizar** una toma de 2023 aplica sus diferencias contra
 * el stock de hoy.
 *
 * Por eso la pantalla las **lista todas**, dice cuántas son y qué antigüedad
 * tienen, ofrece **cancelarlas** —que es el remedio correcto para una toma
 * abandonada— y deja seguir con una confirmación que nombra el problema.
 *
 * `frc-mobile` tiene el chequeo escrito pero **nunca corre**: vive en
 * `cargarDatos()`, que solo se llama desde `onScanQr()`, dentro de un bloque
 * oculto por una bandera que siempre vale lo contrario. Y su confirmación es
 * un `if (res.role = 'aceptar')` —una asignación, no una comparación—, así
 * que cancelar crea el inventario igual.
 *
 * ⚠️ **Solo sucursales operables.** Sin depósito no hay stock que contar:
 * `SERVIDOR` y `COMPRAS` no participan de inventarios.
 */
@Component({
  selector: 'frc-inventario-nuevo',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SelectorComponent,
    DatoComponent,
    CardComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
    TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nuevo inventario" [conVolver]="true" [conEscaner]="false">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargarSucursales()" />
      } @else {
        <frc-selector
          etiqueta="Sucursal"
          [opciones]="opcionesSucursal()"
          [valor]="sucursalId()"
          (valorChange)="cambiarSucursal($event)"
        />

        <frc-seccion titulo="Se va a abrir" [panel]="true">
          <frc-dato etiqueta="Sucursal" [valor]="nombreSucursal() | titlecase" />
          <frc-dato etiqueta="Responsable" [valor]="responsable() | titlecase" />
          <frc-dato etiqueta="Tipo" valor="Por zona" />
        </frc-seccion>

        @if (verificando()) {
          <frc-skeleton [cantidad]="1" />
        } @else if (abiertas().length > 0) {
          <frc-seccion [titulo]="'Tomas abiertas en esta sucursal (' + abiertas().length + ')'">
            <p class="aviso">{{ aviso() }}</p>
            <p class="aviso">
              Cancelar una toma vieja la saca de la lista sin tocar el stock.
              Finalizarla, en cambio, aplica su conteo contra el stock de hoy.
            </p>
            @for (inv of abiertas(); track inv.id) {
              <frc-card
                [titulo]="'#' + inv.id + ' · ' + responsableDe(inv)"
                [subtitulo]="descripcionDe(inv)"
                icono="inventario"
                (abrir)="abrirExistente(inv)"
              >
                <button pie matButton [disabled]="operando()" (click)="cancelar(inv, $event)">
                  Cancelar
                </button>
              </frc-card>
            }
          </frc-seccion>
        } @else {
          <frc-seccion titulo="Antes de empezar" [panel]="true">
            <p class="aviso">
              Verificá que los sectores y las zonas del depósito estén
              identificados: la toma se cuenta zona por zona, y las que
              falten hay que crearlas en Lugares del depósito.
            </p>
          </frc-seccion>
        }
      }

      @if (!cargando() && !error() && !verificando()) {
        <div acciones>
          <button
            matButton="filled"
            [disabled]="sucursalId() == null || creando() || operando()"
            (click)="crear()"
          >
            {{ creando() ? 'Abriendo…' : 'Iniciar inventario' }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .aviso { margin: 0; font-size: var(--fs-label); color: var(--text-soft); }
  `,
})
export class InventarioNuevoPage {
  private readonly servicio = inject(InventarioService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  readonly sucursalId = signal<unknown>(null);
  readonly cargando = signal(true);
  readonly verificando = signal(false);
  readonly creando = signal(false);
  readonly operando = signal(false);
  readonly error = signal<string | null>(null);

  /**
   * Las tomas que ya están abiertas en la sucursal elegida.
   *
   * ⚠️ **Son varias, no una.** Mostrar solo la primera hacía pensar «la
   * cierro y sigo»; con 24 en la sucursal, cerrarlas de a una no es el camino
   * y hay que poder verlo.
   */
  readonly abiertas = signal<Inventario[]>([]);

  readonly aviso = computed(() => avisoDeTomasAbiertas(this.abiertas(), new Date()));

  private readonly lista = signal<Sucursal[]>([]);

  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() =>
    this.lista().map((s) => ({ valor: s.id, texto: s.nombre ?? `Sucursal ${s.id}` })),
  );

  readonly nombreSucursal = computed(() => {
    const id = Number(this.sucursalId());
    return this.lista().find((s) => Number(s.id) === id)?.nombre ?? '—';
  });

  readonly responsable = computed(
    () => this.auth.usuario()?.persona?.nombre ?? this.auth.usuario()?.nickname ?? '—',
  );

  constructor() {
    this.cargarSucursales();
  }

  cargarSucursales(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.sucursales.todas().subscribe({
      next: (todas) => {
        const operables = soloOperables(todas ?? []);
        this.lista.set(operables);
        this.cargando.set(false);

        const propia = this.auth.sucursal()?.id;
        const elegida =
          propia != null && operables.some((s) => Number(s.id) === Number(propia))
            ? propia
            : operables[0]?.id;

        if (elegida != null) {
          this.cambiarSucursal(elegida);
        }
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  cambiarSucursal(valor: unknown): void {
    this.sucursalId.set(valor);
    this.abiertas.set([]);
    this.error.set(null);

    const id = Number(valor);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    this.verificarAbiertas(id);
  }

  private verificarAbiertas(sucursalId: number): void {
    this.verificando.set(true);
    this.servicio.abiertosDe(sucursalId).subscribe({
      next: (lista) => {
        // Las más viejas primero: son las que hay que cancelar.
        this.abiertas.set(
          [...(lista ?? [])].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0)),
        );
        this.verificando.set(false);
      },
      error: (err: Error) => {
        // «No hay ninguna» y «no pude preguntar» son respuestas distintas: se
        // avisa, pero no se afirma que la sucursal está limpia.
        this.notificacion.warn(`No se pudo verificar si hay tomas abiertas: ${err.message}`);
        this.abiertas.set([]);
        this.verificando.set(false);
      },
    });
  }

  async crear(): Promise<void> {
    const sucursalId = Number(this.sucursalId());
    const usuarioId = this.auth.usuario()?.id;

    if (!Number.isFinite(sucursalId) || sucursalId <= 0 || usuarioId == null) {
      this.notificacion.warn('Falta la sucursal o el usuario de la sesión.');
      return;
    }

    // El aviso va **dentro** de la confirmación y no solo en la pantalla: es
    // el último momento en que alguien puede parar, y la lista de arriba se
    // lee como información de contexto, no como una advertencia.
    const pendiente = this.aviso();
    const ok = await this.dialogo.confirmar({
      titulo: 'Iniciar inventario',
      mensaje: pendiente
        ? `${pendiente} Se va a abrir otra en ${this.nombreSucursal()}, a tu nombre.`
        : `Se va a abrir una toma en ${this.nombreSucursal()}, a tu nombre. Vas a poder agregarle zonas y contarlas.`,
      confirmar: 'Iniciar',
    });
    if (!ok) {
      return;
    }

    this.creando.set(true);
    this.servicio.crear(nuevoInventarioInput({ sucursalId, usuarioId })).subscribe({
      next: (inventario) => {
        this.creando.set(false);
        if (inventario?.id == null) {
          this.notificacion.danger('El central no devolvió el inventario creado.');
          return;
        }
        void this.router.navigate(['/inventario', inventario.id], { replaceUrl: true });
      },
      error: () => this.creando.set(false),
    });
  }

  /**
   * Cancelar una toma abandonada.
   *
   * ⚠️ **Cancelar no es finalizar, y es la diferencia que importa acá.**
   * `cancelarInventario` pone el estado en `CANCELADO` y **desactiva** los
   * movimientos de ajuste que hubiera generado; `finalizarInventario`
   * **crea** ajustes que llevan el stock de hoy al conteo de aquella toma.
   * Para una toma de 2023 que nadie va a terminar, finalizarla es el peor
   * botón de la pantalla — y era el único que ofrecíamos.
   */
  async cancelar(inv: Inventario, evento: Event): Promise<void> {
    // La card entera navega al detalle: sin esto, cancelar también abría.
    evento.stopPropagation();
    if (inv.id == null) {
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: `Cancelar la toma #${inv.id}`,
      mensaje: `Queda como cancelada y deja de bloquear la sucursal. El stock no se toca: lo que se haya contado ahí no se aplica.`,
      confirmar: 'Cancelar la toma',
      destructivo: true,
    });
    if (!ok) {
      return;
    }

    this.operando.set(true);
    this.servicio.cancelar(inv.id).subscribe({
      next: () => {
        this.operando.set(false);
        this.notificacion.ok(`Toma #${inv.id} cancelada.`);
        this.verificarAbiertas(Number(this.sucursalId()));
      },
      error: (err: Error) => {
        this.operando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  abrirExistente(inv: Inventario): void {
    if (inv.id != null) {
      void this.router.navigate(['/inventario', inv.id], { replaceUrl: true });
    }
  }

  /** Desde cuándo está abierta, que es lo que dice si es chatarra o no. */
  descripcionDe(inv: Inventario): string {
    const dias = antiguedadEnDias(inv.fechaInicio, new Date());
    const desde = this.fecha(inv.fechaInicio);
    return dias != null && dias >= 1 ? `${desde} · ${dias} días abierta` : desde;
  }

  responsableDe(inv: Inventario): string {
    return inv.usuario?.persona?.nombre ?? inv.usuario?.nickname ?? '—';
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor) ?? '—';
  }
}
