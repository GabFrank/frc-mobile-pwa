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

import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';

import { ProductoEditarService } from './producto-editar.service';

/**
 * Las banderas que un envase no puede tener.
 *
 * Es la contracara en pantalla de `aplicarCascadaEnvase()`: un control que se
 * puede tocar pero cuyo valor el guardado descarta es peor que un control
 * deshabilitado. Un test verifica que las dos listas coincidan.
 */
export function camposDeshabilitadosPorEnvase(esEnvase: boolean): string[] {
  return esEnvase
    ? ['balanza', 'garantia', 'ingrediente', 'promocion', 'vencimiento', 'lote']
    : [];
}

/**
 * `TipoConservacion` del central (`productos.graphqls`). No hay endpoint que
 * lo liste: son cuatro valores fijos del enum.
 */
const OPCIONES_TIPO_CONSERVACION: OpcionSeleccion[] = [
  { valor: 'NO_ENFRIABLE', texto: 'No enfriable' },
  { valor: 'ENFRIABLE', texto: 'Enfriable' },
  { valor: 'REFRIGERABLE', texto: 'Refrigerable' },
  { valor: 'CONGELABLE', texto: 'Congelable' },
];

/**
 * Datos generales del producto.
 *
 * Formulario con signals, no `FormGroup` — mismo patrón que
 * `gastos-solicitud-nueva.page.ts`. Guarda exclusivamente por
 * `ProductoEditarService.guardarCabecera()`, que arma el `ProductoInput`
 * completo a partir del producto hidratado: acá solo viajan los campos que
 * esta pantalla realmente edita.
 *
 * ⚠️ **`vencimiento`, `diasVencimiento` y `lote` no tienen control acá.**
 * Esta entrega no los edita — se preservan solos porque el servicio los
 * hidrata del producto cargado.
 */
@Component({
  selector: 'frc-datos-generales',
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
    <frc-pagina titulo="Datos generales" [conVolver]="true">
      @if (estado.cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (estado.error()) {
        <frc-estado-error [detalle]="estado.error()!" (reintentar)="recargar()" />
      } @else if (estado.producto()) {
        <frc-seccion titulo="Identificación" [panel]="true">
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>Descripción</mat-label>
            <input matInput [ngModel]="descripcion()" (ngModelChange)="descripcion.set($event)" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>Descripción de factura</mat-label>
            <input
              matInput
              [ngModel]="descripcionFactura()"
              (ngModelChange)="descripcionFactura.set($event)"
            />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
            <mat-label>IVA (%)</mat-label>
            <input
              matInput
              type="number"
              [ngModel]="iva()"
              (ngModelChange)="iva.set($event)"
            />
          </mat-form-field>
          <frc-selector
            etiqueta="Tipo de conservación"
            [opciones]="opcionesTipoConservacion"
            [valor]="tipoConservacion()"
            (valorChange)="cambiarTipoConservacion($event)"
          />
          <div class="fila-toggle">
            <span>Activo</span>
            <mat-slide-toggle
              [checked]="activo()"
              (change)="activo.set($event.checked)"
            />
          </div>
          <div class="fila-toggle">
            <span>Es envase</span>
            <mat-slide-toggle
              [checked]="isEnvase()"
              (change)="isEnvase.set($event.checked)"
            />
          </div>
          @if (isEnvase()) {
            <p class="ayuda">
              Un envase no lleva balanza, garantía, ingrediente, promoción,
              vencimiento ni lote: esos controles se apagan solos al guardar.
            </p>
          }
        </frc-seccion>

        <frc-seccion titulo="Banderas" [panel]="true">
          <div class="fila-toggle">
            <span>Balanza</span>
            <mat-slide-toggle
              [checked]="balanza()"
              [disabled]="deshabilitados().has('balanza')"
              (change)="balanza.set($event.checked)"
            />
          </div>
          <div class="fila-toggle">
            <span>Garantía</span>
            <mat-slide-toggle
              [checked]="garantia()"
              [disabled]="deshabilitados().has('garantia')"
              (change)="garantia.set($event.checked)"
            />
          </div>
          @if (garantia() && !deshabilitados().has('garantia')) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
              <mat-label>Tiempo de garantía (días)</mat-label>
              <input
                matInput
                type="number"
                [ngModel]="tiempoGarantia()"
                (ngModelChange)="tiempoGarantia.set($event)"
              />
            </mat-form-field>
          }
          <div class="fila-toggle">
            <span>Ingrediente</span>
            <mat-slide-toggle
              [checked]="ingrediente()"
              [disabled]="deshabilitados().has('ingrediente')"
              (change)="ingrediente.set($event.checked)"
            />
          </div>
          <div class="fila-toggle">
            <span>Combo</span>
            <mat-slide-toggle [checked]="combo()" (change)="combo.set($event.checked)" />
          </div>
          <div class="fila-toggle">
            <span>Controla stock</span>
            <mat-slide-toggle [checked]="stock()" (change)="stock.set($event.checked)" />
          </div>
          <div class="fila-toggle">
            <span>Promoción</span>
            <mat-slide-toggle
              [checked]="promocion()"
              [disabled]="deshabilitados().has('promocion')"
              (change)="promocion.set($event.checked)"
            />
          </div>
          <div class="fila-toggle">
            <span>Cambiable</span>
            <mat-slide-toggle [checked]="cambiable()" (change)="cambiable.set($event.checked)" />
          </div>
        </frc-seccion>

        <button
          matButton="filled"
          type="button"
          class="boton-guardar"
          [disabled]="guardando() || !descripcion().trim()"
          (click)="guardar()"
        >
          {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
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
    .boton-guardar { width: 100%; margin-top: var(--sp-2); }
  `,
})
export class DatosGeneralesPage {
  readonly id = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  private readonly router = inject(Router);

  readonly opcionesTipoConservacion = OPCIONES_TIPO_CONSERVACION;

  readonly descripcion = signal('');
  readonly descripcionFactura = signal('');
  readonly iva = signal<number | null>(null);
  readonly activo = signal(true);
  readonly isEnvase = signal(false);
  readonly tipoConservacion = signal<string | null>(null);
  readonly balanza = signal(false);
  readonly garantia = signal(false);
  readonly tiempoGarantia = signal<number | null>(null);
  readonly ingrediente = signal(false);
  readonly combo = signal(false);
  readonly stock = signal(false);
  readonly promocion = signal(false);
  readonly cambiable = signal(false);

  readonly guardando = signal(false);

  /** Qué controles apaga la cascada de envase — mismo cálculo que el guardado. */
  readonly deshabilitados = computed(() => new Set(camposDeshabilitadosPorEnvase(this.isEnvase())));

  /** Evita que un `producto()` que se vuelve a emitir pise lo que se está tipeando. */
  private formInicializado = false;

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });

    effect(() => {
      const p = this.estado.producto();
      if (p == null || this.formInicializado) return;
      this.formInicializado = true;

      this.descripcion.set(p.descripcion ?? '');
      this.descripcionFactura.set(p.descripcionFactura ?? '');
      this.iva.set(p.iva ?? null);
      this.activo.set(p.activo ?? true);
      this.isEnvase.set(p.isEnvase ?? false);
      this.tipoConservacion.set(p.tipoConservacion ?? null);
      this.balanza.set(p.balanza ?? false);
      this.garantia.set(p.garantia ?? false);
      this.tiempoGarantia.set(p.tiempoGarantia ?? null);
      this.ingrediente.set(p.ingrediente ?? false);
      this.combo.set(p.combo ?? false);
      this.stock.set(p.stock ?? false);
      this.promocion.set(p.promocion ?? false);
      this.cambiable.set(p.cambiable ?? false);
    });
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }

  cambiarTipoConservacion(valor: unknown): void {
    this.tipoConservacion.set(valor == null ? null : String(valor));
  }

  guardar(): void {
    this.guardando.set(true);
    this.estado
      .guardarCabecera({
        descripcion: this.descripcion(),
        descripcionFactura: this.descripcionFactura(),
        iva: this.iva(),
        activo: this.activo(),
        isEnvase: this.isEnvase(),
        tipoConservacion: this.tipoConservacion(),
        balanza: this.balanza(),
        garantia: this.garantia(),
        tiempoGarantia: this.tiempoGarantia(),
        ingrediente: this.ingrediente(),
        combo: this.combo(),
        stock: this.stock(),
        promocion: this.promocion(),
        cambiable: this.cambiable(),
      })
      .subscribe({
        // El central devuelve la descripción en mayúsculas; el servicio ya
        // reemplazó el estado con lo que volvió, así que basta con volver.
        next: () => this.router.navigate(['/producto', this.id(), 'editar']),
        // El toast ya lo mostró `DatosService`; solo hace falta destrabar
        // el botón para que se pueda reintentar.
        error: () => this.guardando.set(false),
      });
  }
}
