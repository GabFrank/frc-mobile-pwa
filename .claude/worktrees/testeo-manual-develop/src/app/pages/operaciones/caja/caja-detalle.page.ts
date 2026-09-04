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

import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { CajaService } from './caja.service';

/**
 * Detalle y balance de una caja.
 *
 * ⚠️ Todos los importes vienen calculados del backend. Acá no se suma ni se
 * resta nada.
 */
@Component({
  selector: 'frc-caja-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    ImporteComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (caja(); as c) {
        <frc-seccion titulo="Estado" [panel]="true">
          @if (c.estado) {
            <frc-dato etiqueta="Estado">
              <frc-estado-chip enumerado="PdvCajaEstado" [valor]="c.estado" />
            </frc-dato>
          } @else {
            <!-- Las cajas replicadas viejas no tienen estado cargado. -->
            <frc-dato etiqueta="Estado" valor="Sin registrar" />
          }
          <frc-dato etiqueta="Sucursal" [valor]="c.sucursal?.nombre ?? '—'" />
          <frc-dato etiqueta="Maletín" [valor]="c.maletin?.descripcion ?? '—'" />
        </frc-seccion>

        @if (c.balance; as b) {
          <frc-seccion titulo="Balance en guaraníes" [panel]="true">
            <frc-dato etiqueta="Apertura">
              <frc-importe [valor]="b.totalAperGs ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
            <frc-dato etiqueta="Ventas">
              <frc-importe [valor]="b.totalVentaGs ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
            <frc-dato etiqueta="Tarjeta">
              <frc-importe [valor]="b.totalTarjeta ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
            <frc-dato etiqueta="Retiros">
              <frc-importe [valor]="b.totalRetiroGs ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
            <frc-dato etiqueta="Gastos">
              <frc-importe [valor]="b.totalGastoGs ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
            <frc-dato etiqueta="Cierre">
              <frc-importe [valor]="b.totalCierreGs ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
          </frc-seccion>

          <frc-seccion titulo="Diferencia" [panel]="true">
            <frc-dato etiqueta="Guaraníes">
              <frc-importe [valor]="b.diferenciaGs ?? 0" moneda="Guaraní" simbolo="₲" />
            </frc-dato>
            <frc-dato etiqueta="Reales">
              <frc-importe [valor]="b.diferenciaRs ?? 0" moneda="Real" simbolo="R$" />
            </frc-dato>
            <frc-dato etiqueta="Dólares">
              <frc-importe [valor]="b.diferenciaDs ?? 0" moneda="Dólar" simbolo="US$" />
            </frc-dato>
            @if (hayDiferencia()) {
              <p class="aviso">
                La caja cierra con diferencia. La verificación la resuelve un supervisor.
              </p>
            }
          </frc-seccion>
        }
      }

      @if (caja(); as c) {
        <div acciones>
          <button matButton="filled" (click)="irACerrar(c)">Cerrar caja</button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .aviso {
      margin: var(--sp-2) 0 0;
      font-size: var(--fs-label);
      color: var(--danger);
    }
  `,
})
export class CajaDetallePage {
  private readonly cajaService = inject(CajaService);
  private readonly router = inject(Router);

  /** Viene de la ruta `:id` con `withComponentInputBinding`. */
  readonly id = input<string>();

  /**
   * Sucursal de la caja, por query param `?suc=`.
   *
   * ⚠️ **El id de caja NO es único en el sistema.** Cada filial numera sus
   * cajas desde 1, y el central las guarda con una clave compuesta
   * (`EmbebedPrimaryKey(id, sucursalId)`). En la lista de cajas abiertas de
   * un usuario aparecen varias "Caja 1" de sucursales distintas: navegar
   * solo con el id traía la caja de otra sucursal.
   */
  readonly suc = input<string>();

  readonly caja = signal<PdvCaja | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly titulo = computed(() => {
    const c = this.caja();
    return c ? (c.descripcion ?? `Caja ${c.id}`) : 'Caja';
  });

  readonly hayDiferencia = computed(() => {
    const b = this.caja()?.balance;
    if (!b) {
      return false;
    }
    return (b.diferenciaGs ?? 0) !== 0 || (b.diferenciaRs ?? 0) !== 0 || (b.diferenciaDs ?? 0) !== 0;
  });

  constructor() {
    // ⚠️ NO llamar `cargar()` desde el constructor.
    //
    // Con `withComponentInputBinding`, el router crea el componente y recién
    // después asigna los inputs de ruta: en el constructor `id()` todavía es
    // undefined, y la pantalla mostraba siempre "caja inválida".
    effect(() => {
      const id = this.id();
      // `suc` se lee acá para que el efecto también reaccione si cambia.
      this.suc();
      if (id !== undefined) {
        this.cargar();
      }
    });
  }

  /** La sucursal viaja con el id: el id de caja no es único entre filiales. */
  irACerrar(caja: PdvCaja): void {
    const suc = caja.sucursal?.id ?? caja.sucursalId ?? Number(this.suc());
    void this.router.navigate(['/operaciones/caja', caja.id, 'cerrar'], {
      queryParams: Number.isFinite(suc) ? { suc } : undefined,
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id)) {
      this.error.set('La caja indicada no es válida.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    const suc = Number(this.suc());
    this.cajaService.porId(id, Number.isFinite(suc) && suc > 0 ? suc : undefined).subscribe({
      next: (caja) => {
        this.caja.set(caja);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }
}
