import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import {
  EtapaTransferencia,
  Transferencia,
  TransferenciaEstado,
} from 'src/app/domains/transferencia/transferencia.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { resolverEstado } from 'src/app/shared/estado/estado-registry';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { FiltrosLista, SIN_FILTROS, aVariables, coincide, filtrosActivos } from './filtros-lista';
import { TransferenciaService } from './transferencia.service';

const TAMANO = 10;

/**
 * El corte de «Mías» lo hace el central, que no pagina esa consulta. Acá solo
 * sirve para saber cuándo avisar que puede haber más.
 */
const TOPE_MIAS = 20;

/**
 * «Sin filtro» en un selector. Una opción no puede valer `null`: `mat-select`
 * lo lee como «nada elegido» y deja el campo en blanco.
 */
const TODOS = 'todos';

const OPCIONES_ESTADO: OpcionSeleccion[] = [
  { valor: TODOS, texto: 'Todos' },
  ...Object.values(TransferenciaEstado).map((estado) => ({
    valor: estado,
    texto: resolverEstado('TransferenciaEstado', estado).etiqueta,
  })),
];

type ClaveVista = 'mias' | 'salen' | 'llegan' | 'todas';

interface Vista {
  clave: ClaveVista;
  etiqueta: string;
  isOrigen: boolean | null;
  isDestino: boolean | null;
}

/**
 * Los puntos de vista que importan.
 *
 * «Mías» es la lista de `frc-mobile`: las transferencias donde el usuario es
 * responsable de alguna etapa. Sale de otra consulta, sin página ni filtros.
 *
 * ⚠️ **Las otras filtran por `isOrigen` / `isDestino`, no comparando ids.** Los
 * booleanos vienen resueltos por el backend, y son lo que decide qué acciones
 * corresponden: en origen se prepara y despacha, en destino se recibe.
 */
const VISTAS: readonly Vista[] = [
  { clave: 'mias', etiqueta: 'Mías', isOrigen: null, isDestino: null },
  { clave: 'salen', etiqueta: 'Salen', isOrigen: true, isDestino: null },
  { clave: 'llegan', etiqueta: 'Llegan', isOrigen: null, isDestino: true },
  { clave: 'todas', etiqueta: 'Todas', isOrigen: null, isDestino: null },
];

@Component({
  selector: 'frc-transferencias-lista',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    SelectorComponent,
    CampoFechaComponent,
    IconoComponent,
    MatTabsModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Transferencias" [conVolver]="true">
      <!--
        ⚠️ El atributo de proyección va en un hijo directo, fuera de todo
        bloque de control: dentro de un @if no llega al slot con nombre.
      -->
      <div acciones class="botonera">
        @if (puedeCrear()) {
          <button matButton="filled" (click)="nueva()">Nueva transferencia</button>
        }
      </div>

      <mat-tab-group
        [selectedIndex]="indice()"
        (selectedIndexChange)="cambiarVista($event)"
        animationDuration="120ms"
      >
        @for (v of vistas(); track v.clave) {
          <mat-tab [label]="v.etiqueta" />
        }
      </mat-tab-group>

      @if (acotadaPorUrl()) {
        <p class="acotada">Lista acotada por el filtro con el que llegaste.</p>
      }

      <div class="barra-filtros">
        <button
          matButton="tonal"
          type="button"
          aria-controls="filtros-transferencias"
          [attr.aria-expanded]="panelAbierto()"
          (click)="alternarPanel()"
        >
          <frc-icono nombre="filtrar" [tamano]="20" />
          {{ activos() > 0 ? 'Filtros (' + activos() + ')' : 'Filtros' }}
        </button>
        @if (activos() > 0) {
          <button matButton type="button" (click)="limpiarFiltros()">Limpiar</button>
        }
      </div>

      @if (panelAbierto()) {
        <div id="filtros-transferencias" class="filtros">
          <frc-selector
            etiqueta="Estado"
            [opciones]="opcionesEstado"
            [valor]="filtros().estado ?? sinFiltro"
            (valorChange)="cambiarEstado($event)"
          />
          <div class="par">
            <frc-campo-fecha
              etiqueta="Desde"
              [valor]="filtros().desde"
              (valorChange)="cambiarDesde($event)"
            />
            <frc-campo-fecha
              etiqueta="Hasta"
              [valor]="filtros().hasta"
              (valorChange)="cambiarHasta($event)"
            />
          </div>
          <div class="par">
            <frc-selector
              etiqueta="Origen"
              [opciones]="opcionesOrigen()"
              [deshabilitado]="sinSucursales()"
              [valor]="filtros().origenId ?? sinFiltro"
              (valorChange)="cambiarOrigen($event)"
            />
            <frc-selector
              etiqueta="Destino"
              [opciones]="opcionesDestino()"
              [deshabilitado]="sinSucursales()"
              [valor]="filtros().destinoId ?? sinFiltro"
              (valorChange)="cambiarDestino($event)"
            />
          </div>
          @if (sinSucursales()) {
            <p class="nota">No se pudieron cargar las sucursales. Estado y fecha siguen funcionando.</p>
          }
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length > 0 && visibles().length === 0) {
        <!-- Solo pasa en Mías: llegaron filas y los filtros las dejaron afuera. -->
        <frc-estado-vacio
          titulo="Ninguna coincide"
          [detalle]="detalleSinCoincidencias()"
          icono="camion"
        />
      } @else if (filas().length === 0 && activos() > 0 && vista().clave !== 'mias') {
        <!--
          Con filtros puestos, vacío es «nada coincide», no «no hay». En Mías
          además se buscó solo en lo que el central devolvió.
        -->
        <frc-estado-vacio
          titulo="Ninguna coincide"
          [detalle]="detalleSinCoincidencias()"
          icono="camion"
        />
      } @else if (filas().length === 0 && vista().clave === 'mias') {
        <frc-estado-vacio
          titulo="No participás en ninguna"
          detalle="Acá aparecen las que creaste, preparaste, transportaste o recibiste. Las demás están en Salen, Llegan y Todas."
          icono="camion"
        />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          titulo="Sin transferencias"
          detalle="Acá aparecen los movimientos de mercadería entre sucursales."
          icono="camion"
        />
      } @else {
        @for (t of visibles(); track t.id) {
          <frc-card
            [titulo]="ruta(t)"
            [subtitulo]="subtitulo(t)"
            icono="camion"
            (abrir)="abrir(t)"
          >
            <frc-estado-chip
              pie
              enumerado="TransferenciaEstado"
              [valor]="t.estado ?? null"
            />
            @if (t.etapa) {
              <span pie class="etapa">{{ etapaLegible(t) }}</span>
            }
          </frc-card>
        }

        @if (hayMas()) {
          <button matButton class="mas" [disabled]="cargandoMas()" (click)="cargarMas()">
            {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
          </button>
        }

        @if (topeDeMias()) {
          <p class="tope">{{ notaDeTope() }}</p>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .acotada {
      margin: 0;
      font-size: var(--fs-label);
      color: var(--text-soft);
      background: var(--info-bg);
      padding: var(--sp-2) var(--sp-3);
      border-radius: var(--radius-sm);
    }
    /*
      Cuatro pestañas con el ancho mínimo de Material no entran en 360 px: el
      grupo pasa a paginar con flechas y la última queda escondida.
    */
    :host ::ng-deep .mat-mdc-tab {
      min-width: 0;
      padding-inline: var(--sp-2);
    }
    .barra-filtros {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }
    .filtros { display: flex; flex-direction: column; gap: var(--sp-2); }
    /* minmax(0, …): con 1fr a secas el campo de fecha desborda en 360 px. */
    .par {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sp-2);
    }
    .nota {
      margin: 0;
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .etapa {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .mas { align-self: center; margin-top: var(--sp-3); }
    .tope {
      margin: var(--sp-3) 0 0;
      text-align: center;
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .botonera {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: var(--sp-2);
    }
    /* Sin el rol de alta el envoltorio queda vacío y la barra se oculta. */
    .botonera:empty { display: none; }
  `,
})
export class TransferenciasListaPage {
  private readonly servicio = inject(TransferenciaService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(RoleService);
  private readonly sucursales = inject(SucursalService);

  /**
   * ⚠️ **Ver no es crear.** `VER TRANSFERENCIA` lo tienen 257 usuarios y es lo
   * que abre esta lista; originar un movimiento de mercadería pide `CREAR
   * TRANSFERENCIA`. La ruta lo vuelve a chequear con `rolGuard`: esconder sin
   * guardar no protege nada.
   */
  readonly puedeCrear = computed(() =>
    this.roles.tieneAlgunRol(this.auth.roles(), PERMISOS.transferenciasAlta),
  );

  /** La pestaña que eligió el usuario; `null` mientras no tocó ninguna. */
  private readonly elegida = signal<ClaveVista | null>(null);
  readonly filas = signal<Transferencia[]>([]);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  readonly opcionesEstado = OPCIONES_ESTADO;
  readonly sinFiltro = TODOS;

  /**
   * Los filtros del panel. Se conservan al cambiar de pestaña: son una
   * pregunta sobre la lista, no sobre el punto de vista.
   */
  readonly filtros = signal<FiltrosLista>(SIN_FILTROS);
  readonly activos = computed(() => filtrosActivos(this.filtros()));
  readonly panelAbierto = signal(false);

  private readonly listaSucursales = signal<Sucursal[]>([]);
  /** No cargaron: los selectores se apagan, que «sin opciones» no es «no hay». */
  readonly sinSucursales = signal(false);

  readonly opcionesOrigen = computed(() => this.opcionesSucursal(this.filtros().origenId));
  readonly opcionesDestino = computed(() => this.opcionesSucursal(this.filtros().destinoId));

  /**
   * Lo que se muestra. En Salen / Llegan / Todas filtró el central y es lo
   * que llegó; «Mías» no acepta filtros, así que se aplican acá, sobre sus
   * filas.
   */
  readonly visibles = computed(() => {
    const filas = this.filas();
    if (this.vista().clave !== 'mias') {
      return filas;
    }
    const filtros = this.filtros();
    return filas.filter((t) => coincide(t, filtros));
  });

  private pagina = 0;
  /** La consulta en vuelo: se corta al pedir otra, o la tardía pisa la lista. */
  private consulta?: Subscription;

  /**
   * Filtros que llegan por la URL.
   *
   * `frc-mobile` tiene una ruta aparte —`list/filtradas/:sucursalId/:etapa`—
   * para esto. Acá son parámetros de la misma lista: es la misma pantalla con
   * menos filas, y duplicarla obligaría a mantener dos.
   *
   * El caso real: desde un inventario se salta a «las transferencias en
   * camino hacia esta sucursal».
   */
  readonly etapa = input<string>();
  readonly sucursal = input<string>();

  /** La etapa de la URL, solo si es una del enum. */
  private etapaValida(): EtapaTransferencia | undefined {
    const crudo = this.etapa();
    const etapas = Object.values(EtapaTransferencia) as string[];
    return crudo && etapas.includes(crudo) ? (crudo as EtapaTransferencia) : undefined;
  }

  /** La sucursal de la URL, solo si es un id. `Number('')` es `0`, no `NaN`. */
  private sucursalValida(): number | undefined {
    const id = Number(this.sucursal());
    return Number.isFinite(id) && id > 0 ? id : undefined;
  }

  /**
   * `true` si la URL acotó la lista. Se avisa, o parece que faltan datos.
   *
   * Cuenta solo lo que de verdad se manda: un valor inventado no acota nada,
   * y avisar que sí —o esconder «Mías» por eso— sería mentir.
   */
  readonly filtrada = computed(() => !!this.etapaValida() || !!this.sucursalValida());

  /**
   * El aviso de lista acotada. La sucursal de la URL se precarga en «Destino»
   * y el usuario la puede sacar: el aviso vale mientras siga puesta.
   *
   * ⚠️ **No es `filtrada`.** Esa mira solo la URL y decide las pestañas; si
   * siguiera al panel, sacar «Destino» cambiaría de pestaña sin que nadie lo
   * pidiera.
   */
  readonly acotadaPorUrl = computed(() => {
    const sucursal = this.sucursalValida();
    return !!this.etapaValida() || (sucursal != null && this.filtros().destinoId === sucursal);
  });

  /**
   * ⚠️ **Con filtro de URL, «Mías» no se ofrece.** Esa consulta no acepta
   * etapa ni sucursal, y acotar sus 20 filas acá respondería «no hay» cuando
   * lo cierto es «no pregunté».
   */
  readonly vistas = computed(() =>
    this.filtrada() ? VISTAS.filter((v) => v.clave !== 'mias') : VISTAS,
  );

  /**
   * Sin elección, se entra por «Mías». Con filtro de URL, por «Todas»: el
   * caso es «qué viene en camino para acá», y `isOrigen` / `isDestino` lo
   * partirían en dos pestañas.
   */
  readonly vista = computed<Vista>(() => {
    const vistas = this.vistas();
    const porDefecto: ClaveVista = this.filtrada() ? 'todas' : 'mias';
    return (
      vistas.find((v) => v.clave === this.elegida()) ??
      vistas.find((v) => v.clave === porDefecto) ??
      vistas[0]
    );
  });

  readonly indice = computed(() => this.vistas().indexOf(this.vista()));

  /**
   * `true` si «Mías» llegó al corte del central: puede haber más.
   *
   * Cuenta las filas que llegaron, no las que pasan los filtros: el corte es
   * del central.
   */
  readonly topeDeMias = computed(
    () => this.vista().clave === 'mias' && this.filas().length >= TOPE_MIAS,
  );

  constructor() {
    // El router asigna los inputs después de construir (NG0950), así que la
    // carga va en un efecto y no en el constructor.
    effect(() => {
      this.etapa();
      const sucursal = this.sucursalValida();
      // Sin `untracked`, lo que `cargar()` lee —la pestaña, el usuario, los
      // filtros— se vuelve dependencia del efecto y cada cambio carga dos veces.
      untracked(() => {
        // La sucursal de la URL acota el destino: el caso que la usa es «qué
        // viene en camino para acá». Va al panel para que se vea y se pueda sacar.
        if (sucursal != null) {
          this.filtros.update((f) => ({ ...f, destinoId: sucursal }));
        }
        this.cargar();
      });
    });
    this.cargarSucursales();
    inject(DestroyRef).onDestroy(() => this.consulta?.unsubscribe());
  }

  cargar(agregando = false): void {
    this.consulta?.unsubscribe();
    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.filas.set([]);
      // Una carga cortada a medias no llega a bajarlos.
      this.cargandoMas.set(false);
      this.hayMas.set(false);
    }
    this.error.set(null);

    const vista = this.vista();
    if (vista.clave === 'mias') {
      this.cargarMias();
      return;
    }

    this.consulta = this.servicio
      .conFiltros({
        isOrigen: vista.isOrigen,
        isDestino: vista.isDestino,
        // La etapa llega como texto de la URL: solo se pasa si es un valor
        // real del enum. Una cadena inventada la rechazaría el central con un
        // error de validación en vez de devolver lista vacía.
        etapa: this.etapaValida(),
        ...aVariables(this.filtros()),
        page: this.pagina,
        size: TAMANO,
      })
      .subscribe({
        next: (page) => {
          const contenido = page?.getContent ?? [];
          this.filas.update((previas) => (agregando ? [...previas, ...contenido] : contenido));
          this.hayMas.set(page?.hasNext === true);
          this.cargando.set(false);
          this.cargandoMas.set(false);
        },
        error: (err: Error) => {
          this.error.set(err.message);
          this.cargando.set(false);
          this.cargandoMas.set(false);
        },
      });
  }

  cargarMas(): void {
    this.pagina += 1;
    this.cargandoMas.set(true);
    this.cargar(true);
  }

  private cargarMias(): void {
    // `Number(undefined)` es `NaN` y `Number(null)` es `0`: ninguno es un id.
    const usuarioId = Number(this.auth.usuario()?.id);
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      // Sin usuario no se preguntó nada: una lista vacía diría que no participa.
      this.error.set('No se pudo identificar tu usuario. Cerrá sesión y volvé a entrar.');
      this.cargando.set(false);
      return;
    }

    this.consulta = this.servicio.porUsuario(usuarioId).subscribe({
      next: (lista) => {
        this.filas.set(lista ?? []);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * ⚠️ **Todas, no solo las operables.** Para crear una transferencia una
   * sucursal sin depósito no sirve, pero acá se filtra lo que ya existe: hay
   * transferencias con origen `COMPRAS`, y dejarla afuera las haría
   * imposibles de encontrar por origen.
   */
  private cargarSucursales(): void {
    this.sucursales.todas().subscribe({
      next: (lista) => this.listaSucursales.set(lista ?? []),
      error: () => this.sinSucursales.set(true),
    });
  }

  /**
   * ⚠️ **La elegida va siempre entre las opciones.** La de la URL puede no
   * estar en la lista —una sucursal cerrada, o la lista sin cargar—, y un
   * selector con un valor que no tiene opción se ve en blanco: parece que no
   * hay filtro cuando sí lo hay.
   */
  private opcionesSucursal(elegida: number | null): OpcionSeleccion[] {
    const lista = this.listaSucursales();
    const falta = elegida != null && !lista.some((s) => Number(s.id) === elegida);
    return [
      { valor: TODOS, texto: 'Todas' },
      ...(falta ? [{ valor: elegida, texto: 'Sucursal ' + elegida }] : []),
      ...lista.map((s) => ({ valor: s.id, texto: s.nombre ?? 'Sucursal ' + s.id })),
    ];
  }

  alternarPanel(): void {
    this.panelAbierto.update((abierto) => !abierto);
  }

  cambiarEstado(valor: unknown): void {
    this.aplicar({ estado: valor === TODOS || valor == null ? null : String(valor) });
  }

  /**
   * ⚠️ **Un rango invertido no se manda.** «Desde» posterior a «hasta»
   * devolvería vacío y se leería como «no hay». Gana la que se acaba de
   * tocar, y la otra se vacía. No se limita el calendario con `minimo` /
   * `maximo`: una fecha tipeada los saltea igual.
   */
  cambiarDesde(valor: string | null): void {
    const desde = valor || null;
    const hasta = this.filtros().hasta;
    this.aplicar({ desde, hasta: desde != null && hasta != null && hasta < desde ? null : hasta });
  }

  cambiarHasta(valor: string | null): void {
    const hasta = valor || null;
    const desde = this.filtros().desde;
    this.aplicar({ hasta, desde: hasta != null && desde != null && desde > hasta ? null : desde });
  }

  cambiarOrigen(valor: unknown): void {
    this.aplicar({ origenId: this.idDe(valor) });
  }

  cambiarDestino(valor: unknown): void {
    this.aplicar({ destinoId: this.idDe(valor) });
  }

  limpiarFiltros(): void {
    this.aplicar(SIN_FILTROS);
  }

  /** `Number('todos')` es `NaN` y `Number('')` es `0`: ninguno es un id. */
  private idDe(valor: unknown): number | null {
    const id = Number(valor);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  private aplicar(cambio: Partial<FiltrosLista>): void {
    const previos = this.filtros();
    const nuevos = { ...previos, ...cambio };
    // El selector y el campo de fecha avisan también cuando no cambió nada.
    if ((Object.keys(nuevos) as (keyof FiltrosLista)[]).every((k) => nuevos[k] === previos[k])) {
      return;
    }
    this.filtros.set(nuevos);
    // «Mías» no vuelve al central: sus filas ya están y se filtran acá.
    if (this.vista().clave !== 'mias') {
      this.cargar();
    }
  }

  /**
   * Al pie de «Mías», cuando llegó al corte. Con filtros puestos lo que se ve
   * es un recorte de un recorte: hay que decir sobre cuántas se filtró.
   */
  notaDeTope(): string {
    const cargadas = this.filas().length;
    return this.activos() > 0
      ? 'Se filtró sobre tus últimas ' + cargadas + '. Las anteriores están en Todas.'
      : 'Son tus últimas ' + cargadas + '. Si hay anteriores, están en Todas.';
  }

  /** Por qué no hay nada, con filtros puestos. */
  detalleSinCoincidencias(): string {
    return this.topeDeMias()
      ? 'Se buscó en tus últimas ' + this.filas().length + '. Las anteriores están en Todas.'
      : 'Probá con otros filtros, o tocá Limpiar.';
  }

  cambiarVista(indice: number): void {
    const vista = this.vistas()[indice];
    if (!vista || vista.clave === this.vista().clave) {
      return;
    }
    this.elegida.set(vista.clave);
    this.cargar();
  }

  ruta(t: Transferencia): string {
    const origen = t.sucursalOrigen?.nombre ?? '—';
    const destino = t.sucursalDestino?.nombre ?? '—';
    return `${origen} → ${destino}`;
  }

  subtitulo(t: Transferencia): string {
    return [`#${t.id}`, fechaLegible(t.creadoEn)].filter(Boolean).join(' · ');
  }

  /** `TRANSPORTE_EN_CAMINO` → `Transporte en camino`. */
  etapaLegible(t: Transferencia): string {
    const crudo = String(t.etapa ?? '').replace(/_/g, ' ').toLowerCase();
    return crudo.charAt(0).toUpperCase() + crudo.slice(1);
  }

  abrir(t: Transferencia): void {
    void this.router.navigate(['/transferencias', t.id]);
  }

  nueva(): void {
    void this.router.navigate(['/transferencias', 'nueva']);
  }
}
