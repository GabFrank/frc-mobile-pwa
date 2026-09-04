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
import { MatSelectModule } from '@angular/material/select';
import { from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PrecioPorSucursal } from 'src/app/domains/productos/precio-por-sucursal.model';
import { TipoPrecio } from 'src/app/domains/productos/tipo-precio.model';
import { DeletePrecioPorSucursalGQL } from 'src/app/graphql/productos/deletePrecioPorSucursal';
import { SavePrecioPorSucursalGQL } from 'src/app/graphql/productos/savePrecioPorSucursal';
import { TipoPreciosGQL } from 'src/app/graphql/productos/tipoPrecios';
import { CampoImporteComponent } from 'src/app/shared/campos/campo-importe.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

import { esIdDeRutaInvalido, idDeRutaNum, mismoId, preciosADegradar } from './producto-editar.reglas';
import { ProductoEditarService } from './producto-editar.service';

/**
 * El input de `savePrecioPorSucursal`.
 *
 * ⚠️ **`sucursalId` sale siempre de la sesión.** El escritorio hace lo mismo
 * y no ofrece alternativa (`adicionar-precio-dialog.component.ts:265`).
 * Escribir en todas las sucursales serían ~18 mutations sueltas sin
 * transacción: si la novena falla, quedan nueve locales con el precio nuevo y
 * nueve con el viejo, y nada lo revierte.
 */
export function construirPrecioInput(
  precio: {
    id: number | null;
    precio: number;
    tipoPrecioId: number;
    principal: boolean;
    activo: boolean;
  },
  presentacionId: number,
  sucursalId: number,
) {
  return {
    id: precio.id,
    precio: precio.precio,
    tipoPrecioId: precio.tipoPrecioId,
    principal: precio.principal,
    activo: precio.activo,
    presentacionId,
    sucursalId,
  };
}

/**
 * Si este precio se puede editar desde acá.
 *
 * Un precio sin sucursal identificada **no** es editable: no saber de qué
 * sucursal es no equivale a que sea de la propia.
 */
export function esPrecioEditable(
  precio: { sucursal?: { id?: number | string } },
  sucursalSesionId: number,
): boolean {
  return mismoId(precio.sucursal?.id, sucursalSesionId);
}

/**
 * Precios de una presentación, agrupados por sucursal.
 *
 * ⚠️ **Sin costo ni margen a la vista** — decisión del 2026-09-04, registrada
 * en la spec: esta pantalla solo muestra y edita el precio de venta.
 *
 * Solo el precio de la sucursal de la sesión es editable acá: el resto se
 * muestra de solo lectura, con su sucursal identificada. Ver el aviso de
 * `construirPrecioInput`.
 *
 * Al marcar un precio como principal se degrada primero, con `concatMap`, a
 * los que devuelve `preciosADegradar()` **entre los de la propia sucursal**
 * — nunca en paralelo, y nunca tocando precios de otra sucursal, que es
 * justo lo que esta pantalla no puede hacer. Un fallo en la degradación
 * avisa siempre: silenciarlo es lo que vuelve invisible justo este bug.
 */
@Component({
  selector: 'frc-precios',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    ImporteComponent,
    CampoImporteComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Precios" [conVolver]="true">
      @if (estado.cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (estado.error()) {
        <frc-estado-error [detalle]="estado.error()!" (reintentar)="recargar()" />
      } @else if (rutaInvalida()) {
        <frc-estado-error
          titulo="No se entiende qué presentación abrir"
          detalle="Volvé a la lista de presentaciones e intentá de nuevo."
          (reintentar)="recargar()"
        />
      } @else if (!estado.producto()) {
        <!--
          Primer frame: el effect que llama a cargar() corre después del
          primer change-detection, así que sin esto acá se alcanza a pintar
          "No se encontró esa presentación" durante un instante en cada
          navegación normal.
        -->
        <frc-skeleton [cantidad]="3" />
      } @else if (presentacion() == null) {
        <frc-estado-error
          titulo="No se encontró esa presentación"
          detalle="Puede que ya se haya eliminado."
          (reintentar)="recargar()"
        />
      } @else {
        @if (sucursalSesionId() == null) {
          <frc-estado-error
            titulo="No hay sucursal en la sesión"
            detalle="No se puede identificar qué precio es editable sin una sucursal en la sesión."
            (reintentar)="recargar()"
          />
        } @else {
          <frc-seccion titulo="Agregar precio" [panel]="true">
            @if (cargandoTipos()) {
              <p class="ayuda">Cargando tipos de precio…</p>
            } @else if (errorTipos()) {
              <p class="ayuda error">
                No se pudieron cargar los tipos de precio.
                <button matButton type="button" (click)="cargarTipos()">Reintentar</button>
              </p>
            } @else if (tiposPrecioDisponibles().length === 0) {
              <p class="ayuda">Ya hay un precio cargado para todos los tipos, en esta sucursal.</p>
            } @else {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
                <mat-label>Tipo de precio</mat-label>
                <mat-select
                  [ngModel]="nuevoTipoPrecioId()"
                  (ngModelChange)="nuevoTipoPrecioId.set($event)"
                >
                  @for (t of tiposPrecioDisponibles(); track t.id) {
                    <mat-option [value]="t.id">{{ t.descripcion }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <frc-campo-importe
                etiqueta="Precio"
                moneda="Guaraní"
                simbolo="₲"
                [ngModel]="nuevoMonto()"
                (ngModelChange)="nuevoMonto.set($event)"
              />
              <button
                matButton="tonal"
                type="button"
                [disabled]="!nuevoTipoPrecioId() || nuevoMonto() == null || guardando()"
                (click)="agregarPrecio()"
              >
                Agregar
              </button>
            }
          </frc-seccion>

          <frc-seccion titulo="Precios de esta sucursal" [panel]="true">
            @if (preciosPropios().length === 0) {
              <frc-estado-vacio
                titulo="No hay precios en esta sucursal"
                detalle="Agregá uno con el formulario de arriba."
              />
            } @else {
              @for (p of preciosPropios(); track p.id) {
                <div class="fila-precio" [class.inactivo]="p.activo === false">
                  <div class="info-precio">
                    <span class="tipo-precio">
                      {{ p.tipoPrecio?.descripcion ?? 'Sin tipo' }}
                      @if (p.principal) {
                        <span class="badge">Principal</span>
                      }
                      @if (p.activo === false) {
                        <span class="badge-inactivo">Inactivo</span>
                      }
                    </span>
                    @if (mismoId(edicionId(), p.id)) {
                      <frc-campo-importe
                        etiqueta="Precio"
                        moneda="Guaraní"
                        simbolo="₲"
                        [ngModel]="edicionValor()"
                        (ngModelChange)="edicionValor.set($event)"
                      />
                    } @else {
                      <frc-importe [valor]="p.precio ?? 0" moneda="Guaraní" simbolo="₲" />
                    }
                  </div>
                  <div class="acciones-precio">
                    @if (mismoId(edicionId(), p.id)) {
                      <button
                        matButton="tonal"
                        type="button"
                        [disabled]="edicionValor() == null || guardando()"
                        (click)="guardarEdicion(p)"
                      >
                        Guardar
                      </button>
                      <button matButton type="button" (click)="cancelarEdicion()">Cancelar</button>
                    } @else {
                      <button
                        matButton
                        type="button"
                        [disabled]="guardando()"
                        (click)="iniciarEdicion(p)"
                      >
                        Editar
                      </button>
                      @if (!p.principal && p.activo !== false) {
                        <button
                          matButton
                          type="button"
                          [disabled]="guardando()"
                          (click)="marcarPrincipal(p)"
                        >
                          Marcar principal
                        </button>
                      }
                      <button matButton type="button" [disabled]="guardando()" (click)="toggleActivo(p)">
                        {{ p.activo === false ? 'Activar' : 'Desactivar' }}
                      </button>
                      <button matButton type="button" [disabled]="guardando()" (click)="eliminarPrecio(p)">
                        Eliminar
                      </button>
                    }
                  </div>
                </div>
              }
            }
          </frc-seccion>
        }

        @if (preciosAjenos().length > 0) {
          <frc-seccion titulo="Precios de otras sucursales" [panel]="true">
            @for (p of preciosAjenos(); track p.id) {
              <div class="fila-precio solo-lectura" [class.inactivo]="p.activo === false">
                <div class="info-precio">
                  <span class="tipo-precio">
                    {{ p.tipoPrecio?.descripcion ?? 'Sin tipo' }}
                    <span class="badge-sucursal">{{ p.sucursal?.nombre ?? 'Sucursal desconocida' }}</span>
                    @if (p.principal) {
                      <span class="badge">Principal</span>
                    }
                    @if (p.activo === false) {
                      <span class="badge-inactivo">Inactivo</span>
                    }
                  </span>
                  <frc-importe [valor]="p.precio ?? 0" moneda="Guaraní" simbolo="₲" />
                </div>
              </div>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
    .ayuda {
      margin: 0;
      color: var(--text-mute);
      font-size: var(--fs-label);
    }
    .ayuda.error { color: var(--danger); }
    .fila-precio {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--sp-2);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-light);
    }
    .fila-precio:last-child { border-bottom: none; }
    .info-precio {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
    }
    .tipo-precio {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      flex-wrap: wrap;
      font-variant-numeric: tabular-nums;
    }
    .fila-precio.inactivo .tipo-precio {
      text-decoration: line-through;
      color: var(--text-mute);
    }
    .badge {
      font-size: var(--fs-caption);
      font-weight: var(--fw-medium);
      color: var(--brand-text);
      background: var(--surface-sunken);
      border-radius: var(--radius-sm);
      padding: 2px var(--sp-2);
    }
    .badge-inactivo {
      font-size: var(--fs-caption);
      font-weight: var(--fw-medium);
      color: var(--text-mute);
      background: var(--neutral-bg);
      border-radius: var(--radius-sm);
      padding: 2px var(--sp-2);
    }
    .badge-sucursal {
      font-size: var(--fs-caption);
      font-weight: var(--fw-medium);
      color: var(--text-soft);
      background: var(--surface-sunken);
      border-radius: var(--radius-sm);
      padding: 2px var(--sp-2);
    }
    .acciones-precio {
      display: flex;
      gap: var(--sp-1);
      flex-wrap: wrap;
    }
  `,
})
export class PreciosPage {
  readonly id = input<string>();
  readonly presentacionId = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  /** Expuesta para el template. */
  protected readonly mismoId = mismoId;
  private readonly auth = inject(AuthService);
  private readonly datos = inject(DatosService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly savePrecioPorSucursal = inject(SavePrecioPorSucursalGQL);
  private readonly deletePrecioPorSucursal = inject(DeletePrecioPorSucursalGQL);
  private readonly tipoPreciosGQL = inject(TipoPreciosGQL);

  readonly guardando = signal(false);
  readonly nuevoTipoPrecioId = signal<number | null>(null);
  readonly nuevoMonto = signal<number | null>(null);
  readonly edicionId = signal<number | null>(null);
  readonly edicionValor = signal<number | null>(null);

  private readonly tiposPrecio = signal<TipoPrecio[]>([]);
  readonly cargandoTipos = signal(false);
  readonly errorTipos = signal(false);

  readonly rutaInvalida = computed(() => esIdDeRutaInvalido(this.presentacionId()));

  /** La sucursal de la sesión: la única en la que esta pantalla escribe. */
  readonly sucursalSesionId = computed<number | null>(() => this.auth.sucursal()?.id ?? null);

  private readonly presentacionIdNum = computed<number | null>(() =>
    idDeRutaNum(this.presentacionId()),
  );

  readonly presentacion = computed(() => {
    const n = this.presentacionIdNum();
    if (n == null) return null;
    return this.estado.presentaciones().find((p) => mismoId(p.id, n)) ?? null;
  });

  readonly precios = computed<PrecioPorSucursal[]>(() => this.presentacion()?.precios ?? []);

  /** El único subconjunto editable: los de la sucursal de la sesión. */
  readonly preciosPropios = computed<PrecioPorSucursal[]>(() => {
    const sucId = this.sucursalSesionId();
    if (sucId == null) return [];
    return this.precios().filter((p) => esPrecioEditable(p, sucId));
  });

  /** Todo lo que no sea editable acá, sucursal desconocida incluida. */
  readonly preciosAjenos = computed<PrecioPorSucursal[]>(() => {
    const sucId = this.sucursalSesionId();
    return this.precios().filter((p) => sucId == null || !esPrecioEditable(p, sucId));
  });

  /** Tipos de precio sin cargar todavía en la sucursal propia. */
  readonly tiposPrecioDisponibles = computed<TipoPrecio[]>(() => {
    const usados = new Set(this.preciosPropios().map((p) => p.tipoPrecio?.id));
    return this.tiposPrecio().filter((t) => t.id != null && !usados.has(t.id) && t.activo !== false);
  });

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });

    this.cargarTipos();
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }

  /**
   * Trae los tipos de precio. Con `cargandoTipos` / `errorTipos` y su
   * Reintentar, igual que `presentacion-editar.page.ts` con los tipos de
   * presentación: sin esto, un fallo del central se confundía con «ya hay un
   * precio cargado para todos los tipos», que es una respuesta distinta y
   * falsa.
   */
  cargarTipos(): void {
    this.cargandoTipos.set(true);
    this.errorTipos.set(false);
    this.datos.paginado<TipoPrecio[]>(this.tipoPreciosGQL, 0, 200).subscribe({
      next: (lista) => {
        this.tiposPrecio.set(lista ?? []);
        this.cargandoTipos.set(false);
      },
      error: () => {
        this.errorTipos.set(true);
        this.cargandoTipos.set(false);
      },
    });
  }

  iniciarEdicion(p: PrecioPorSucursal): void {
    this.edicionId.set(p.id ?? null);
    this.edicionValor.set(p.precio ?? 0);
  }

  cancelarEdicion(): void {
    this.edicionId.set(null);
    this.edicionValor.set(null);
  }

  guardarEdicion(p: PrecioPorSucursal): void {
    const presentacionId = this.presentacionIdNum();
    const sucursalId = this.sucursalSesionId();
    const monto = this.edicionValor();
    const tipoPrecioId = p.tipoPrecio?.id;
    if (
      presentacionId == null ||
      sucursalId == null ||
      p.id == null ||
      monto == null ||
      tipoPrecioId == null
    )
      return;

    const input = construirPrecioInput(
      {
        id: p.id,
        precio: monto,
        tipoPrecioId,
        principal: p.principal === true,
        activo: p.activo !== false,
      },
      presentacionId,
      sucursalId,
    );
    this.guardando.set(true);
    this.datos.guardar<PrecioPorSucursal>(this.savePrecioPorSucursal, input).subscribe({
      next: () => {
        this.cancelarEdicion();
        this.estado.recargar();
        this.guardando.set(false);
      },
      error: () => this.guardando.set(false),
    });
  }

  agregarPrecio(): void {
    const presentacionId = this.presentacionIdNum();
    const sucursalId = this.sucursalSesionId();
    const tipoPrecioId = this.nuevoTipoPrecioId();
    const monto = this.nuevoMonto();
    if (presentacionId == null || sucursalId == null || tipoPrecioId == null || monto == null) return;

    const input = construirPrecioInput(
      { id: null, precio: monto, tipoPrecioId, principal: false, activo: true },
      presentacionId,
      sucursalId,
    );
    this.guardando.set(true);
    this.datos.guardar<PrecioPorSucursal>(this.savePrecioPorSucursal, input).subscribe({
      next: () => {
        this.nuevoTipoPrecioId.set(null);
        this.nuevoMonto.set(null);
        this.estado.recargar();
        this.guardando.set(false);
      },
      error: () => this.guardando.set(false),
    });
  }

  toggleActivo(p: PrecioPorSucursal): void {
    const presentacionId = this.presentacionIdNum();
    const sucursalId = this.sucursalSesionId();
    const tipoPrecioId = p.tipoPrecio?.id;
    if (presentacionId == null || sucursalId == null || p.id == null || tipoPrecioId == null) return;

    const estaActivo = p.activo !== false;
    const input = construirPrecioInput(
      {
        id: p.id,
        precio: p.precio ?? 0,
        tipoPrecioId,
        principal: p.principal === true,
        activo: !estaActivo,
      },
      presentacionId,
      sucursalId,
    );
    this.guardando.set(true);
    this.datos.guardar<PrecioPorSucursal>(this.savePrecioPorSucursal, input).subscribe({
      next: () => {
        this.estado.recargar();
        this.guardando.set(false);
      },
      error: () => this.guardando.set(false),
    });
  }

  /**
   * Degrada, en orden y solo entre los de la propia sucursal, a los que
   * devuelve `preciosADegradar()` y recién después guarda el nuevo
   * principal. Ver el aviso de la clase.
   */
  marcarPrincipal(p: PrecioPorSucursal): void {
    const presentacionId = this.presentacionIdNum();
    const sucursalId = this.sucursalSesionId();
    const tipoPrecioId = p.tipoPrecio?.id;
    if (presentacionId == null || sucursalId == null || p.id == null || tipoPrecioId == null) return;

    const aDegradar = preciosADegradar(this.preciosPropios(), p.id);

    // `savePrecioPorSucursal` REEMPLAZA la fila: un `tipoPrecioId` inventado
    // (por ejemplo, un `0` de relleno) no falla, persiste una clave ajena.
    // Antes que eso, se corta la cadena entera y se avisa.
    if (aDegradar.some((viejo) => viejo.tipoPrecio?.id == null)) {
      this.notificacion.danger('No se pudo marcar el precio como principal.');
      return;
    }

    this.guardando.set(true);
    from(aDegradar)
      .pipe(
        concatMap((viejo) =>
          this.datos.guardar<PrecioPorSucursal>(
            this.savePrecioPorSucursal,
            construirPrecioInput(
              {
                id: viejo.id ?? null,
                precio: viejo.precio ?? 0,
                tipoPrecioId: viejo.tipoPrecio!.id!,
                principal: false,
                activo: viejo.activo !== false,
              },
              presentacionId,
              sucursalId,
            ),
            undefined,
            // Sin toast individual por degradación: si hay varias, no
            // queremos uno por cada una. El toast pasa a estar en el
            // `error` del `subscribe()` de abajo, uno solo, para lo que sea
            // que haya fallado en la cadena.
            { mostrarCarga: false, notificarError: false },
          ),
        ),
        toArray(),
        concatMap(() =>
          this.datos.guardar<PrecioPorSucursal>(
            this.savePrecioPorSucursal,
            construirPrecioInput(
              {
                id: p.id ?? null,
                precio: p.precio ?? 0,
                tipoPrecioId,
                principal: true,
                activo: p.activo !== false,
              },
              presentacionId,
              sucursalId,
            ),
          ),
        ),
      )
      .subscribe({
        next: () => {
          this.estado.recargar();
          this.guardando.set(false);
        },
        error: () => {
          // Con `notificarError: false` en las degradaciones, este es el
          // ÚNICO lugar que avisa si la cadena falla. Sin este toast, un
          // guardado que corta a mitad de camino queda mudo: el botón
          // parpadea, nada cambia, y no hay ningún mensaje en ningún lado —
          // justo la falla que `preciosADegradar()` existe para evitar.
          this.notificacion.danger('No se pudo marcar el precio como principal.');
          this.guardando.set(false);
        },
      });
  }

  async eliminarPrecio(p: PrecioPorSucursal): Promise<void> {
    if (p.id == null) return;

    const ok = await this.dialogo.confirmarEliminacion(
      `el precio de ${p.tipoPrecio?.descripcion ?? 'este tipo'}`,
    );
    if (!ok) return;

    this.guardando.set(true);
    this.datos.eliminar(this.deletePrecioPorSucursal, p.id).subscribe({
      next: () => {
        this.estado.recargar();
        this.guardando.set(false);
      },
      error: () => this.guardando.set(false),
    });
  }
}
