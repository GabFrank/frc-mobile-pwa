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
import { firstValueFrom, from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_PRODUCTO } from 'src/app/core/dispositivo/escaner.types';
import { Codigo } from 'src/app/domains/productos/codigo.model';
import { DeleteCodigoGQL } from 'src/app/graphql/productos/deleteCodigo';
import { GenerarCodigoInternoGQL } from 'src/app/graphql/productos/generarCodigoInterno';
import { SaveCodigoGQL } from 'src/app/graphql/productos/saveCodigo';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

import { codigosADegradar, esIdDeRutaInvalido, idDeRutaNum } from './producto-editar.reglas';
import { ProductoEditarService } from './producto-editar.service';

/** El input de `saveCodigo` para un código de esta presentación. */
export function construirCodigoInput(
  codigo: { id: number | null; codigo: string; principal: boolean; activo: boolean },
  presentacionId: number,
) {
  return {
    id: codigo.id,
    codigo: codigo.codigo,
    principal: codigo.principal,
    activo: codigo.activo,
    presentacionId,
  };
}

/**
 * Códigos de una presentación.
 *
 * ⚠️ **Cuelgan de la presentación, no del producto.** Un mismo producto tiene
 * un código para la unidad y otro para la caja: es el código el que
 * determina qué precio y qué cantidad corresponden.
 *
 * Los inactivos se muestran **tachados, no ocultos** —siguen pegados a cajas
 * viejas en el depósito—. Alta por tres caminos: tipeado, escaneado con
 * `FORMATOS_PRODUCTO` y generado como EAN-13 interno.
 *
 * Al marcar un código como principal se degradan primero los que devuelve
 * `codigosADegradar()`, encadenado con `concatMap` —nunca en paralelo—: si el
 * nuevo se guardara antes de que el viejo se degrade, hay un instante con dos
 * principales y gana el que responda último.
 */
@Component({
  selector: 'frc-codigos',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    EstadoVacioComponent,
    IconoComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Códigos" [conVolver]="true">
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
          navegación normal —un error que parpadea en el camino feliz enseña
          a ignorar los errores—.
        -->
        <frc-skeleton [cantidad]="3" />
      } @else if (presentacion() == null) {
        <frc-estado-error
          titulo="No se encontró esa presentación"
          detalle="Puede que ya se haya eliminado."
          (reintentar)="recargar()"
        />
      } @else {
        <frc-seccion titulo="Agregar código" [panel]="true">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>Código</mat-label>
            <input matInput [ngModel]="nuevoCodigo()" (ngModelChange)="nuevoCodigo.set($event)" />
          </mat-form-field>
          <div class="botones-alta">
            <button
              matButton="tonal"
              type="button"
              [disabled]="!nuevoCodigo().trim() || guardando()"
              (click)="agregarTipeado()"
            >
              Agregar
            </button>
            <button matButton="tonal" type="button" [disabled]="guardando()" (click)="escanear()">
              <frc-icono nombre="escanear" [tamano]="18" />
              Escanear
            </button>
            <button
              matButton="tonal"
              type="button"
              [disabled]="generando() || guardando()"
              (click)="generarInterno()"
            >
              {{ generando() ? 'Generando…' : 'Generar interno' }}
            </button>
          </div>
        </frc-seccion>

        <frc-seccion titulo="Códigos de esta presentación" [panel]="true">
          @if (codigos().length === 0) {
            <frc-estado-vacio
              titulo="No hay códigos"
              detalle="Agregá uno tipeando, escaneando o generando un interno."
            />
          } @else {
            @for (c of codigos(); track c.id ?? c.codigo) {
              <div class="fila-codigo" [class.inactivo]="c.activo === false">
                <span class="codigo-texto">
                  {{ c.codigo }}
                  @if (c.principal) {
                    <span class="badge">Principal</span>
                  }
                  @if (c.activo === false) {
                    <span class="badge-inactivo">Inactivo</span>
                  }
                </span>
                <span class="acciones-codigo">
                  @if (!c.principal && c.activo !== false) {
                    <button matButton type="button" [disabled]="guardando()" (click)="marcarPrincipal(c)">
                      Marcar principal
                    </button>
                  }
                  <button matButton type="button" [disabled]="guardando()" (click)="toggleActivo(c)">
                    {{ c.activo === false ? 'Activar' : 'Desactivar' }}
                  </button>
                  <button matButton type="button" [disabled]="guardando()" (click)="eliminarCodigo(c)">
                    Eliminar
                  </button>
                </span>
              </div>
            }
          }
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
    .botones-alta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
    }
    .fila-codigo {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--sp-2);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-light);
    }
    .fila-codigo:last-child { border-bottom: none; }
    .codigo-texto {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-variant-numeric: tabular-nums;
    }
    .fila-codigo.inactivo .codigo-texto {
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
    .acciones-codigo {
      display: flex;
      gap: var(--sp-1);
      flex-wrap: wrap;
    }
  `,
})
export class CodigosPage {
  readonly id = input<string>();
  readonly presentacionId = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  private readonly datos = inject(DatosService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly escaner = inject(EscanerService);
  private readonly saveCodigo = inject(SaveCodigoGQL);
  private readonly deleteCodigo = inject(DeleteCodigoGQL);
  private readonly generarCodigoInternoGQL = inject(GenerarCodigoInternoGQL);

  readonly nuevoCodigo = signal('');
  readonly guardando = signal(false);
  readonly generando = signal(false);

  readonly rutaInvalida = computed(() => esIdDeRutaInvalido(this.presentacionId()));

  private readonly presentacionIdNum = computed<number | null>(() =>
    idDeRutaNum(this.presentacionId()),
  );

  readonly presentacion = computed(() => {
    const n = this.presentacionIdNum();
    if (n == null) return null;
    return this.estado.presentaciones().find((p) => p.id === n) ?? null;
  });

  readonly codigos = computed<Codigo[]>(() => this.presentacion()?.codigos ?? []);

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }

  agregarTipeado(): void {
    const texto = this.nuevoCodigo().trim();
    if (!texto) return;
    this.guardarCodigo(texto);
  }

  async escanear(): Promise<void> {
    const codigo = await this.escaner.escanear({
      titulo: 'Escanear código',
      ayuda: 'Apuntá al código de barras del producto.',
      formatos: FORMATOS_PRODUCTO,
      etiquetaManual: 'Código',
    });
    if (!codigo) return;
    this.guardarCodigo(codigo);
  }

  async generarInterno(): Promise<void> {
    this.generando.set(true);
    try {
      const codigo = await firstValueFrom(this.datos.consultar<string>(this.generarCodigoInternoGQL));
      if (codigo) {
        this.guardarCodigo(codigo);
      }
    } catch {
      // El toast de error ya lo mostró `DatosService`.
    } finally {
      this.generando.set(false);
    }
  }

  toggleActivo(c: Codigo): void {
    const presentacionId = this.presentacionIdNum();
    if (presentacionId == null) return;

    const estaActivo = c.activo !== false;
    const input = construirCodigoInput(
      { id: c.id ?? null, codigo: c.codigo ?? '', principal: c.principal === true, activo: !estaActivo },
      presentacionId,
    );
    this.guardando.set(true);
    this.datos.guardar<Codigo>(this.saveCodigo, input).subscribe({
      next: () => {
        this.estado.recargar();
        this.guardando.set(false);
      },
      error: () => this.guardando.set(false),
    });
  }

  /**
   * Degrada, en orden, a los que devuelve `codigosADegradar()` y recién
   * después guarda el nuevo principal. Ver el aviso de la clase.
   */
  marcarPrincipal(c: Codigo): void {
    const presentacionId = this.presentacionIdNum();
    if (presentacionId == null || c.id == null) return;

    const aDegradar = codigosADegradar(this.codigos(), c.id);

    this.guardando.set(true);
    from(aDegradar)
      .pipe(
        concatMap((viejo) =>
          this.datos.guardar<Codigo>(
            this.saveCodigo,
            construirCodigoInput(
              { id: viejo.id ?? null, codigo: viejo.codigo ?? '', principal: false, activo: viejo.activo !== false },
              presentacionId,
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
          this.datos.guardar<Codigo>(
            this.saveCodigo,
            construirCodigoInput(
              { id: c.id ?? null, codigo: c.codigo ?? '', principal: true, activo: c.activo !== false },
              presentacionId,
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
          // justo la falla que `codigosADegradar()` existe para evitar.
          this.notificacion.danger('No se pudo marcar el código como principal.');
          this.guardando.set(false);
        },
      });
  }

  async eliminarCodigo(c: Codigo): Promise<void> {
    if (c.id == null) return;

    const ok = await this.dialogo.confirmarEliminacion(`el código ${c.codigo ?? ''}`);
    if (!ok) return;

    this.guardando.set(true);
    this.datos.eliminar(this.deleteCodigo, c.id).subscribe({
      next: () => {
        this.estado.recargar();
        this.guardando.set(false);
      },
      error: () => this.guardando.set(false),
    });
  }

  private guardarCodigo(codigo: string): void {
    const presentacionId = this.presentacionIdNum();
    if (presentacionId == null) return;

    const input = construirCodigoInput({ id: null, codigo, principal: false, activo: true }, presentacionId);
    this.guardando.set(true);
    this.datos.guardar<Codigo>(this.saveCodigo, input).subscribe({
      next: () => {
        this.nuevoCodigo.set('');
        this.estado.recargar();
        this.guardando.set(false);
      },
      error: () => this.guardando.set(false),
    });
  }
}
