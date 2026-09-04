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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { TipoPresentacion } from 'src/app/domains/productos/tipo-presentacion.model';
import { DeletePresentacionGQL } from 'src/app/graphql/productos/deletePresentacion';
import { SavePresentacionGQL } from 'src/app/graphql/productos/savePresentacion';
import { TiposPresentacionGQL } from 'src/app/graphql/productos/tiposPresentacion';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';

import { ProductoEditarService } from './producto-editar.service';

/** `true` si el parámetro de ruta no es ni `nueva` ni un id positivo. */
function esIdDeRutaInvalido(raw: string | undefined): boolean {
  if (raw === undefined || raw === 'nueva') {
    return false;
  }
  const n = Number(raw);
  // `Number('')` es 0, no NaN: sin el guard completo una ruta vacía se
  // leería como "presentación cero" en vez de como una ruta rota.
  return !Number.isFinite(n) || n <= 0;
}

/**
 * Alta y edición de una presentación.
 *
 * Descripción, cantidad, tipo, principal y activo. Al pie, los accesos a sus
 * **códigos** y **precios** —que cuelgan de la presentación, no del
 * producto— y, salvo que sea nueva, el borrado con confirmación.
 *
 * `presentacionId = 'nueva'` es el modo alta: no hay id todavía, así que los
 * accesos a códigos y precios quedan deshabilitados hasta el primer guardado.
 */
@Component({
  selector: 'frc-presentacion-editar',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    SelectorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true">
      @if (estado.cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (estado.error()) {
        <frc-estado-error [detalle]="estado.error()!" (reintentar)="recargar()" />
      } @else if (rutaInvalida()) {
        <frc-estado-error
          titulo="No se entiende qué presentación abrir"
          detalle="Volvé a la lista de presentaciones e intentá de nuevo."
          (reintentar)="volver()"
        />
      } @else if (!esNueva() && presentacionActual() == null) {
        <frc-estado-error
          titulo="No se encontró esa presentación"
          detalle="Puede que ya se haya eliminado."
          (reintentar)="volver()"
        />
      } @else if (estado.producto()) {
        <frc-seccion titulo="Datos" [panel]="true">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>Descripción</mat-label>
            <input matInput [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>Cantidad</mat-label>
            <input
              matInput
              type="number"
              [ngModel]="cantidad()"
              (ngModelChange)="cantidad.set($event)"
            />
          </mat-form-field>

          @if (cargandoTipos()) {
            <p class="ayuda">Cargando tipos de presentación…</p>
          } @else if (errorTipos()) {
            <p class="ayuda error">
              No se pudieron cargar los tipos.
              <button matButton type="button" (click)="cargarTipos()">Reintentar</button>
            </p>
          } @else {
            <frc-selector
              etiqueta="Tipo de presentación"
              [opciones]="opcionesTipos()"
              [valor]="tipoPresentacionId()"
              (valorChange)="cambiarTipo($event)"
            />
          }

          <div class="fila-toggle">
            <span>Principal</span>
            <mat-slide-toggle [checked]="principal()" (change)="principal.set($event.checked)" />
          </div>
          <div class="fila-toggle">
            <span>Activo</span>
            <mat-slide-toggle [checked]="activo()" (change)="activo.set($event.checked)" />
          </div>
        </frc-seccion>

        <button
          matButton="filled"
          type="button"
          class="boton-guardar"
          [disabled]="guardando() || !puedeGuardar()"
          (click)="guardar()"
        >
          {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>

        <frc-seccion titulo="Códigos y precios" [panel]="true">
          <div class="accesos">
            <button
              matButton="tonal"
              type="button"
              [disabled]="esNueva()"
              (click)="irACodigos()"
            >
              Códigos ({{ codigosCount() }})
            </button>
            <button
              matButton="tonal"
              type="button"
              [disabled]="esNueva() || !puedePrecios()"
              (click)="irAPrecios()"
            >
              Precios ({{ preciosCount() }})
            </button>
          </div>
          @if (esNueva()) {
            <p class="ayuda">Guardá la presentación para poder cargarle códigos y precios.</p>
          } @else if (!puedePrecios()) {
            <p class="ayuda">Necesitás el permiso EDITAR PRECIOS para editar los precios.</p>
          }
        </frc-seccion>

        @if (!esNueva()) {
          <button
            matButton="outlined"
            type="button"
            class="boton-eliminar"
            [disabled]="eliminando()"
            (click)="eliminar()"
          >
            {{ eliminando() ? 'Eliminando…' : 'Eliminar presentación' }}
          </button>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
    .fila-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--sp-2) 0;
    }
    .ayuda {
      margin: 0;
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .ayuda.error { color: var(--danger); }
    .boton-guardar { width: 100%; margin-top: var(--sp-2); }
    .accesos {
      display: flex;
      gap: var(--sp-2);
    }
    .accesos button { flex: 1; }
    .boton-eliminar {
      width: 100%;
      margin-top: var(--sp-2);
      color: var(--danger);
    }
  `,
})
export class PresentacionEditarPage {
  readonly id = input<string>();
  readonly presentacionId = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  private readonly datos = inject(DatosService);
  private readonly dialogo = inject(DialogoService);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);
  private readonly savePresentacion = inject(SavePresentacionGQL);
  private readonly deletePresentacion = inject(DeletePresentacionGQL);
  private readonly tiposPresentacionGQL = inject(TiposPresentacionGQL);

  readonly descripcion = signal('');
  readonly cantidad = signal<number | null>(1);
  readonly tipoPresentacionId = signal<number | null>(null);
  readonly principal = signal(false);
  readonly activo = signal(true);

  readonly guardando = signal(false);
  readonly eliminando = signal(false);

  readonly tipos = signal<TipoPresentacion[]>([]);
  readonly cargandoTipos = signal(false);
  readonly errorTipos = signal(false);

  readonly opcionesTipos = computed<OpcionSeleccion[]>(() =>
    this.tipos().map((t) => ({ valor: t.id, texto: String(t.descripcion ?? '') })),
  );

  readonly esNueva = computed(() => this.presentacionId() === 'nueva');
  readonly rutaInvalida = computed(() => esIdDeRutaInvalido(this.presentacionId()));

  private readonly presentacionIdNum = computed<number | null>(() => {
    const raw = this.presentacionId();
    if (raw === undefined || raw === 'nueva') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  readonly presentacionActual = computed<Presentacion | null>(() => {
    const n = this.presentacionIdNum();
    if (n == null) return null;
    return this.estado.presentaciones().find((p) => p.id === n) ?? null;
  });

  readonly codigosCount = computed(() => this.presentacionActual()?.codigos?.length ?? 0);
  readonly preciosCount = computed(() => this.presentacionActual()?.precios?.length ?? 0);

  readonly puedePrecios = computed(() =>
    this.roles.tieneAlgunRol(this.auth.roles(), PERMISOS.productoPrecios),
  );

  readonly puedeGuardar = computed(() => {
    const cant = this.cantidad();
    return this.descripcion().trim().length > 0 && cant != null && cant > 0;
  });

  readonly titulo = computed(() => (this.esNueva() ? 'Nueva presentación' : 'Presentación'));

  /** El parámetro de ruta para el que ya se pobló el formulario. Evita repoblar en cada recarga. */
  private formInicializadoPara: string | undefined;

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });

    effect(() => {
      const raw = this.presentacionId();
      if (raw === undefined || raw === this.formInicializadoPara) return;

      if (raw === 'nueva') {
        this.formInicializadoPara = raw;
        this.descripcion.set('');
        this.cantidad.set(1);
        this.tipoPresentacionId.set(null);
        this.principal.set(false);
        this.activo.set(true);
        return;
      }

      const actual = this.presentacionActual();
      if (actual == null) return; // todavía no cargó el producto

      this.formInicializadoPara = raw;
      this.descripcion.set(actual.descripcion ?? '');
      this.cantidad.set(actual.cantidad ?? null);
      this.tipoPresentacionId.set(actual.tipoPresentacion?.id ?? null);
      this.principal.set(actual.principal === true);
      this.activo.set(actual.activo !== false);
    });

    this.cargarTipos();
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }

  volver(): void {
    this.router.navigate(['/producto', this.id(), 'editar', 'presentaciones']);
  }

  cargarTipos(): void {
    this.cargandoTipos.set(true);
    this.errorTipos.set(false);
    this.datos.paginado<TipoPresentacion[]>(this.tiposPresentacionGQL, 0, 200).subscribe({
      next: (lista) => {
        this.tipos.set(lista ?? []);
        this.cargandoTipos.set(false);
      },
      error: () => {
        this.errorTipos.set(true);
        this.cargandoTipos.set(false);
      },
    });
  }

  cambiarTipo(valor: unknown): void {
    this.tipoPresentacionId.set(valor == null ? null : Number(valor));
  }

  guardar(): void {
    const productoId = Number(this.id());
    if (!Number.isFinite(productoId) || productoId <= 0) return;

    this.guardando.set(true);
    this.datos
      .guardar<Presentacion>(this.savePresentacion, {
        id: this.presentacionIdNum(),
        descripcion: this.descripcion(),
        cantidad: this.cantidad(),
        tipoPresentacionId: this.tipoPresentacionId(),
        principal: this.principal(),
        activo: this.activo(),
        productoId,
      })
      .subscribe({
        next: () => this.volverYRecargar(),
        error: () => this.guardando.set(false),
      });
  }

  async eliminar(): Promise<void> {
    const n = this.presentacionIdNum();
    if (n == null) return;

    const ok = await this.dialogo.confirmarEliminacion('esta presentación');
    if (!ok) return;

    this.eliminando.set(true);
    this.datos.eliminar(this.deletePresentacion, n).subscribe({
      next: () => this.volverYRecargar(),
      error: () => this.eliminando.set(false),
    });
  }

  irACodigos(): void {
    if (this.esNueva()) return;
    this.router.navigate([
      '/producto',
      this.id(),
      'editar',
      'presentacion',
      this.presentacionId(),
      'codigos',
    ]);
  }

  irAPrecios(): void {
    if (this.esNueva() || !this.puedePrecios()) return;
    this.router.navigate([
      '/producto',
      this.id(),
      'editar',
      'presentacion',
      this.presentacionId(),
      'precios',
    ]);
  }

  private volverYRecargar(): void {
    this.estado.recargar();
    this.volver();
  }
}
