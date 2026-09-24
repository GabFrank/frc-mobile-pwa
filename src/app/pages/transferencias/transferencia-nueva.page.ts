import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { Usuario } from 'src/app/domains/personas/usuario.model';
import { UsuarioService } from 'src/app/domains/personas/usuario.service';
import { CajaService } from 'src/app/pages/operaciones/caja/caja.service';
import {
  BuscadorComponent,
  ConfigBuscador,
} from 'src/app/shared/buscador/buscador.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { destinosPosibles, nuevaTransferenciaInput } from './transferencia-alta';
import { TransferenciaService } from './transferencia.service';

/**
 * Elegir de dónde sale y a dónde va.
 *
 * Es el primero de los dos pasos del alta: acá se crea el **borrador** —una
 * transferencia `ABIERTA` en etapa de creación— y la carga de productos ocurre
 * en la pantalla siguiente, que ya tiene un id contra el cual guardar.
 *
 * ⚠️ **El borrador se crea en el central, no en memoria.** El input de la
 * cabecera no acepta ítems anidados: sin transferencia guardada no hay dónde
 * poner el primer producto. Acumularlos en el teléfono hasta el final sería
 * perder una carga de cuarenta renglones porque el service worker se
 * actualizó en el medio.
 *
 * ⚠️ **Solo sucursales operables.** Sin depósito no hay stock que mover:
 * `SERVIDOR` y `COMPRAS` no participan de transferencias.
 */
@Component({
  selector: 'frc-transferencia-nueva',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SelectorComponent,
    DatoComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
    TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nueva transferencia" [conVolver]="true" [conEscaner]="false">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargarSucursales()" />
      } @else {
        <frc-selector
          etiqueta="Sucursal de origen"
          [opciones]="opcionesOrigen()"
          [valor]="origenId()"
          (valorChange)="cambiarOrigen($event)"
        />
        <frc-selector
          etiqueta="Sucursal de destino"
          [opciones]="opcionesDestino()"
          [valor]="destinoId()"
          (valorChange)="cambiarDestino($event)"
        />

        <frc-seccion titulo="Solicitante" [panel]="true">
          <p class="dato">{{ nombreSolicitante() }}</p>
          <button
            matButton="tonal"
            type="button"
            [disabled]="destinoId() == null || buscandoCajeros()"
            (click)="elegirSolicitante()"
          >
            {{ buscandoCajeros() ? 'Buscando…' : 'Elegir solicitante' }}
          </button>
          @if (destinoId() == null) {
            <p class="ayuda">Elegí primero la sucursal de destino.</p>
          } @else if (sinCajasAbiertas()) {
            <p class="ayuda">
              No hay cajas abiertas en {{ nombreDestino() | titlecase }}: se busca entre
              todos los usuarios.
            </p>
          } @else {
            <p class="ayuda">Quién pidió los productos en la sucursal de destino.</p>
          }
        </frc-seccion>

        <frc-seccion titulo="Se va a crear" [panel]="true">
          <frc-dato etiqueta="Sale de" [valor]="nombreOrigen() | titlecase" />
          <frc-dato etiqueta="Llega a" [valor]="nombreDestino() | titlecase" />
          <frc-dato etiqueta="Solicitante" [valor]="nombreSolicitante() | titlecase" />
          <frc-dato etiqueta="Responsable" [valor]="responsable() | titlecase" />
          <frc-dato etiqueta="Tipo" valor="Manual" />
        </frc-seccion>

        <frc-seccion titulo="Después de crear" [panel]="true">
          <p class="aviso">
            Queda como borrador: se le cargan los productos y recién al
            finalizarla sale de la sucursal de origen. Nada se descuenta del
            stock hasta que se despacha.
          </p>
        </frc-seccion>
      }

      @if (!cargando() && !error()) {
        <div acciones>
          <button matButton="filled" [disabled]="!puedeCrear() || creando()" (click)="crear()">
            {{ creando() ? 'Creando…' : 'Crear y cargar productos' }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .aviso { margin: 0; font-size: var(--fs-label); color: var(--text-soft); }
    .dato { margin: 0; font-weight: var(--fw-medium); }
    .ayuda { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
  `,
})
export class TransferenciaNuevaPage {
  private readonly servicio = inject(TransferenciaService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);
  private readonly caja = inject(CajaService);
  private readonly dialogo = inject(DialogoService);
  private readonly usuarios = inject(UsuarioService);

  readonly origenId = signal<unknown>(null);
  readonly destinoId = signal<unknown>(null);
  readonly cargando = signal(true);
  readonly creando = signal(false);
  readonly error = signal<string | null>(null);
  readonly solicitante = signal<Usuario | null>(null);
  readonly buscandoCajeros = signal(false);
  /** Se supo que el destino no tiene cajas abiertas y se cayó a todos los usuarios. */
  readonly sinCajasAbiertas = signal(false);

  private readonly lista = signal<Sucursal[]>([]);

  readonly opcionesOrigen = computed<OpcionSeleccion[]>(() => this.opciones(this.lista()));

  readonly opcionesDestino = computed<OpcionSeleccion[]>(() =>
    this.opciones(destinosPosibles(this.lista(), this.origenId() as number | null)),
  );

  readonly nombreOrigen = computed(() => this.nombreDe(this.origenId()));
  readonly nombreDestino = computed(() => this.nombreDe(this.destinoId()));

  readonly responsable = computed(
    () => this.auth.usuario()?.persona?.nombre ?? this.auth.usuario()?.nickname ?? '—',
  );

  readonly nombreSolicitante = computed(
    () => this.solicitante()?.persona?.nombre ?? this.solicitante()?.nickname ?? 'Sin elegir',
  );

  /**
   * ⚠️ **El solicitante es obligatorio para crear.** El central lo exige para
   * salir de la etapa de creación, así que sin él se puede cargar el borrador
   * entero y descubrir recién al finalizar que no sale. Pedirlo acá, donde el
   * destino ya está elegido, evita ese callejón.
   */
  readonly puedeCrear = computed(
    () => this.origenId() != null && this.destinoId() != null && this.solicitante() != null,
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

        // La de la sesión como origen por defecto: es de donde sale la
        // mercadería en el caso normal. El destino se elige siempre.
        const propia = this.auth.sucursal()?.id;
        const elegida = operables.some((s) => String(s.id) === String(propia))
          ? propia
          : operables[0]?.id;
        if (elegida != null) {
          this.origenId.set(elegida);
        }
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * ⚠️ **Cambiar el origen puede invalidar el destino.** Si el que estaba
   * elegido pasa a ser el origen, se limpia: dejarlo ahí armaría una
   * transferencia de una sucursal a sí misma.
   */
  cambiarOrigen(valor: unknown): void {
    this.origenId.set(valor);
    if (String(this.destinoId()) === String(valor)) {
      this.destinoId.set(null);
    }
  }

  /**
   * ⚠️ **Cambiar el destino descarta el solicitante.** Los candidatos salen de
   * las cajas abiertas de esa sucursal: dejar al elegido antes atribuiría el
   * pedido a alguien de otra sucursal, y la pantalla lo seguiría mostrando
   * como válido.
   */
  cambiarDestino(valor: unknown): void {
    this.destinoId.set(valor);
    this.solicitante.set(null);
    this.sinCajasAbiertas.set(false);
  }

  /**
   * Elegir quién pidió los productos.
   *
   * Arranca por los cajeros que hoy están en caja en el destino, que son los
   * candidatos naturales. Es una ayuda de búsqueda, no una restricción: sin
   * cajas abiertas —o si la consulta falla— se busca entre todos los usuarios,
   * porque sin solicitante la transferencia no se puede crear.
   */
  async elegirSolicitante(): Promise<void> {
    const sucursalDestinoId = this.destinoId() == null ? NaN : Number(this.destinoId());
    if (!Number.isFinite(sucursalDestinoId)) {
      this.notificacion.warn('Elegí primero la sucursal de destino.');
      return;
    }

    const cajeros = await this.cajerosDelDestino(sucursalDestinoId);
    this.sinCajasAbiertas.set(cajeros.length === 0);

    const elegido = await this.dialogo.abrir<
      BuscadorComponent<Usuario>,
      ConfigBuscador<Usuario>,
      Usuario
    >(
      BuscadorComponent,
      cajeros.length > 0
        ? {
            modo: 'local',
            titulo: 'Elegir solicitante',
            placeholder: 'Buscar entre los que están en caja',
            items: cajeros,
            texto: (u) => this.nombreDe_(u),
            id: (u) => u.id,
          }
        : {
            modo: 'paginado',
            titulo: 'Elegir solicitante',
            placeholder: 'Buscar usuario',
            cargarPagina: (texto) => this.buscarUsuarios(texto),
            texto: (u) => this.nombreDe_(u),
            id: (u) => u.id,
          },
    );

    if (elegido) {
      this.solicitante.set(elegido);
    }
  }

  private async cajerosDelDestino(sucursalDestinoId: number): Promise<Usuario[]> {
    this.buscandoCajeros.set(true);
    try {
      return (await firstValueFrom(this.caja.cajerosConCajaAbierta(sucursalDestinoId))) ?? [];
    } catch {
      // Un fallo acá no puede dejar sin crear la transferencia: se cae a la
      // búsqueda entre todos los usuarios, que es el camino de siempre.
      return [];
    } finally {
      this.buscandoCajeros.set(false);
    }
  }

  /**
   * ⚠️ **`hayMas` siempre en `false`.** `usuarioSearch` no pagina: devuelve la
   * lista entera para el texto. Decir que hay más deja el scroll pidiendo
   * páginas que nunca llegan.
   */
  private async buscarUsuarios(texto: string): Promise<{ items: Usuario[]; hayMas: boolean }> {
    const items = (await firstValueFrom(this.usuarios.buscar(texto))) ?? [];
    return { items, hayMas: false };
  }

  private nombreDe_(usuario: Usuario): string {
    return usuario.persona?.nombre ?? usuario.nickname ?? `Usuario ${usuario.id}`;
  }

  async crear(): Promise<void> {
    // ⚠️ El id se compara contra `null` **antes** de convertirlo: `Number(null)`
    // es 0, que es finito, y con eso un destino sin elegir pasaba el chequeo y
    // creaba una transferencia hacia la sucursal 0.
    const sucursalOrigenId = this.origenId() == null ? NaN : Number(this.origenId());
    const sucursalDestinoId = this.destinoId() == null ? NaN : Number(this.destinoId());
    const usuarioId = this.auth.usuario()?.id;

    if (!Number.isFinite(sucursalOrigenId) || !Number.isFinite(sucursalDestinoId)) {
      this.notificacion.warn('Elegí la sucursal de origen y la de destino.');
      return;
    }
    if (sucursalOrigenId === sucursalDestinoId) {
      this.notificacion.warn('El destino no puede ser la misma sucursal que el origen.');
      return;
    }
    if (usuarioId == null) {
      this.notificacion.danger('La sesión no tiene usuario.');
      return;
    }
    if (this.solicitante() == null) {
      this.notificacion.warn('Elegí quién pidió los productos.');
      return;
    }

    this.creando.set(true);
    this.servicio
      .crear(
        nuevaTransferenciaInput({
          sucursalOrigenId,
          sucursalDestinoId,
          usuarioId,
          solicitanteId: this.solicitante()?.id ?? null,
        }),
      )
      .subscribe({
        next: (transferencia) => {
          this.creando.set(false);
          if (transferencia?.id == null) {
            this.notificacion.danger('El central no devolvió la transferencia creada.');
            return;
          }
          // `replaceUrl`: volver atrás desde la carga de productos no puede
          // crear una segunda transferencia vacía.
          void this.router.navigate(['/transferencias', transferencia.id, 'borrador'], {
            replaceUrl: true,
          });
        },
        error: () => this.creando.set(false),
      });
  }

  private opciones(sucursales: Sucursal[]): OpcionSeleccion[] {
    return sucursales.map((s) => ({ valor: s.id, texto: String(s.nombre ?? `Sucursal ${s.id}`) }));
  }

  private nombreDe(id: unknown): string {
    if (id == null) {
      return '—';
    }
    return this.lista().find((s) => String(s.id) === String(id))?.nombre ?? '—';
  }
}
