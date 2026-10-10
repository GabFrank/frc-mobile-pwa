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
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { EtapaTransferencia, Transferencia } from 'src/app/domains/transferencia/transferencia.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { TransferenciaService } from './transferencia.service';

const TAMANO = 10;

/**
 * El corte de «Mías» lo hace el central, que no pagina esa consulta. Acá solo
 * sirve para saber cuándo avisar que puede haber más.
 */
const TOPE_MIAS = 20;

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

      @if (filtrada()) {
        <p class="acotada">Lista acotada por el filtro con el que llegaste.</p>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
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
        @for (t of filas(); track t.id) {
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
          <p class="tope">Son tus últimas {{ filas().length }}. Si hay anteriores, están en Todas.</p>
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

  /** `true` si «Mías» llegó al corte del central: puede haber más. */
  readonly topeDeMias = computed(
    () => this.vista().clave === 'mias' && this.filas().length >= TOPE_MIAS,
  );

  constructor() {
    // El router asigna los inputs después de construir (NG0950), así que la
    // carga va en un efecto y no en el constructor.
    effect(() => {
      this.etapa();
      this.sucursal();
      // Sin `untracked`, lo que `cargar()` lee —la pestaña, el usuario— se
      // vuelve dependencia del efecto y cada cambio de pestaña carga dos veces.
      untracked(() => this.cargar());
    });
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
        // La sucursal de la URL acota el destino: el caso que la usa es
        // «qué viene en camino para acá».
        sucursalDestinoId: this.sucursalValida(),
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
