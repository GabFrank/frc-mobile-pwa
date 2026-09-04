import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

import { etiquetaCategoria, faltaParaActivar } from './producto-editar.reglas';
import { ProductoEditarService } from './producto-editar.service';

/** Una fila del hub. */
interface Seccion {
  clave: string;
  etiqueta: string;
  detalle: string;
  ruta: string;
  habilitada: boolean;
  motivo?: string;
}

/**
 * Hub de la edición.
 *
 * No es un formulario: es la lista de secciones. Cada una abre su pantalla y
 * guarda al confirmar, que es lo que mapea 1 a 1 con cómo guarda el central
 * —cabecera, presentaciones, códigos y precios son mutations distintas y no
 * hay transacción—. Un único botón «Guardar todo» dispararía N mutations
 * sueltas: si la tercera falla, el producto queda mitad nuevo y mitad viejo.
 */
@Component({
  selector: 'frc-producto-editar',
  standalone: true,
  imports: [PaginaComponent, SeccionComponent, SkeletonComponent, EstadoErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true">
      @if (estado.cargando()) {
        <frc-skeleton [cantidad]="5" />
      } @else if (estado.error()) {
        <frc-estado-error [detalle]="estado.error()!" (reintentar)="recargar()" />
      } @else if (estado.producto(); as p) {
        @if (p.activo === false) {
          <frc-seccion [panel]="true">
            <p class="inactivo-titulo">Este producto está inactivo</p>
            @if (faltaParaActivar().length > 0) {
              <p class="inactivo-detalle">
                No se puede vender todavía. Falta {{ faltaParaActivar().join(' y ') }}.
              </p>
            } @else {
              <p class="inactivo-detalle">
                Ya tiene presentación, código y precio: se puede activar.
              </p>
              <button
                matButton="filled"
                type="button"
                class="boton-activar"
                [disabled]="activando()"
                (click)="activar()"
              >
                {{ activando() ? 'Activando…' : 'Activar producto' }}
              </button>
            }
          </frc-seccion>
        }

        <frc-seccion [panel]="true">
          @for (s of secciones(); track s.clave) {
            <button
              type="button"
              class="fila"
              [disabled]="!s.habilitada"
              (click)="abrir(s)"
            >
              <span class="etiquetas">
                <span class="titulo">{{ s.etiqueta }}</span>
                <span class="detalle">{{ s.habilitada ? s.detalle : s.motivo }}</span>
              </span>
              <span class="chevron" aria-hidden="true">›</span>
            </button>
          }
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: [
    `
      .inactivo-titulo {
        margin: 0 0 var(--sp-1);
        font-weight: var(--fw-medium);
        color: var(--warn);
      }
      .inactivo-detalle {
        margin: 0 0 var(--sp-2);
        color: var(--text-soft);
        font-size: var(--fs-label);
      }
      .boton-activar { width: 100%; }
      .fila {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: var(--sp-4);
        border: none;
        background: transparent;
        color: var(--text);
        text-align: left;
        cursor: pointer;
      }
      .fila:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .etiquetas {
        display: flex;
        flex-direction: column;
        gap: var(--sp-1);
      }
      .titulo {
        font-weight: var(--fw-medium);
      }
      .detalle {
        color: var(--text-soft);
        font-size: var(--fs-label);
      }
      .chevron {
        color: var(--text-soft);
      }
    `,
  ],
})
export class ProductoEditarPage {
  readonly id = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(RoleService);

  readonly titulo = computed(() => this.estado.producto()?.descripcion ?? 'Editar producto');

  private readonly puedePrecios = computed(() =>
    this.roles.tieneAlgunRol(this.auth.roles(), PERMISOS.productoPrecios),
  );

  readonly activando = signal(false);

  /**
   * Lo que le falta al producto para poder activarse.
   *
   * Solo importa mientras está inactivo: un producto dado de alta desde el
   * teléfono nace así y no se puede vender hasta tener presentación, código y
   * precio. Ver `faltaParaActivar()`.
   */
  readonly faltaParaActivar = computed<string[]>(() => {
    const p = this.estado.producto();
    return p == null ? [] : faltaParaActivar(p);
  });

  /**
   * Pone el producto en venta.
   *
   * Va por `guardarCabecera`, que arma el `ProductoInput` completo desde el
   * producto hidratado: mandar solo `{id, activo}` borraría todo lo demás,
   * porque `saveProducto` reemplaza el registro entero.
   */
  activar(): void {
    if (this.faltaParaActivar().length > 0) return;
    this.activando.set(true);
    this.estado.guardarCabecera({ activo: true }).subscribe({
      next: () => this.activando.set(false),
      error: () => this.activando.set(false),
    });
  }

  readonly secciones = computed<Seccion[]>(() => {
    const p = this.estado.producto();
    if (p == null) return [];

    const categoria = p.subfamilia
      ? `${etiquetaCategoria(p.subfamilia.familia ?? {})} / ${etiquetaCategoria(p.subfamilia)}`
      : 'Sin categoría';

    return [
      {
        clave: 'generales',
        etiqueta: 'Datos generales',
        detalle: `${p.descripcion ?? '—'} · IVA ${p.iva ?? '—'}%`,
        ruta: 'generales',
        habilitada: true,
      },
      {
        clave: 'categoria',
        etiqueta: 'Familia y subfamilia',
        detalle: categoria,
        ruta: 'categoria',
        habilitada: true,
      },
      {
        clave: 'presentaciones',
        etiqueta: 'Presentaciones',
        detalle: `${this.estado.presentaciones().length}`,
        ruta: 'presentaciones',
        habilitada: true,
      },
      {
        clave: 'codigos',
        etiqueta: 'Códigos',
        // Se cuentan acá pero se editan dentro de la presentación: un código
        // cuelga de la presentación, y editarlo al nivel del producto mentiría
        // sobre a cuál pertenece.
        detalle: `${this.estado.totalCodigos()} · se editan en cada presentación`,
        ruta: 'presentaciones',
        habilitada: true,
      },
      {
        clave: 'precios',
        etiqueta: 'Precios',
        detalle: `${this.estado.totalPrecios()} · se editan en cada presentación`,
        ruta: 'presentaciones',
        habilitada: this.puedePrecios(),
        motivo: `${this.estado.totalPrecios()} · necesitás el permiso EDITAR PRECIOS`,
      },
    ];
  });

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });
  }

  abrir(s: Seccion): void {
    if (!s.habilitada) return;
    this.router.navigate(['/producto', this.id(), 'editar', s.ruta]);
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }
}
