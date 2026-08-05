import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { VacacionPeriodo, Vale } from 'src/app/domains/rrhh/rrhh.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { RrhhService } from './rrhh.service';

/**
 * Bandeja de aprobaciones de RRHH.
 *
 * ⚠️ **La aprobación de vales no existe en el backend mobile.** Hay
 * `aprobarVacacionMobile` pero no su equivalente para vales: el segmento
 * lista los pendientes y nada más. El repo anterior tenía el mismo hueco y
 * mostraba las tarjetas como si fueran accionables. Acá se dice en pantalla,
 * porque un supervisor que toca y no pasa nada asume que la app falló.
 *
 * ⚠️ **El control de acceso real está en el backend.** El acceso a esta
 * pantalla se filtra por rol, pero eso es comodidad de UI: quien conozca la
 * operación GraphQL puede llamarla igual. Ver el issue de roles en GraphQL
 * del central (`RrhhSecurityService`).
 */
@Component({
  selector: 'frc-aprobaciones',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    ImporteComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatTabsModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Aprobaciones" [conVolver]="true">
      <mat-tab-group
        [selectedIndex]="indice()"
        (selectedIndexChange)="cambiar($event)"
        animationDuration="120ms"
      >
        <mat-tab label="Vacaciones" />
        <mat-tab label="Vales" />
      </mat-tab-group>

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar(true)" />
      } @else if (esVacaciones()) {
        @if (vacaciones().length) {
          <p class="aviso">
            El servidor no informa de quién es cada pedido. Confirmá en el sistema de escritorio
            antes de aprobar.
          </p>
        }
        @for (p of vacaciones(); track p.id) {
          <frc-card
            [titulo]="nombreDe(p)"
            [subtitulo]="rango(p)"
            icono="persona"
            [redondo]="true"
            (abrir)="aprobar(p)"
          >
            <frc-estado-chip pie enumerado="VacacionPeriodoEstado" [valor]="p.estado ?? null" />
          </frc-card>
        } @empty {
          <frc-estado-vacio
            titulo="Nada pendiente"
            detalle="No hay pedidos de vacaciones esperando aprobación."
            icono="checkCirculo"
          />
        }
      } @else {
        <p class="aviso">
          El servidor todavía no expone la aprobación de vales desde el celular. Acá se ven los
          pendientes; para aprobarlos hay que usar el sistema de escritorio.
        </p>
        @for (v of vales(); track v.id) {
          <frc-card
            [titulo]="nombreDeVale(v)"
            [subtitulo]="(v.esAdelanto ? 'Adelanto' : 'Vale') + ' · ' + (fecha(v.fecha) ?? '')"
            icono="dinero"
            [clickable]="false"
          >
            <frc-importe aparte [valor]="v.monto ?? 0" moneda="Guaraní" simbolo="₲" />
          </frc-card>
        } @empty {
          <frc-estado-vacio
            titulo="Nada pendiente"
            detalle="No hay vales esperando aprobación."
            icono="checkCirculo"
          />
        }
      }
    </frc-pagina>
  `,
  styles: `
    .aviso {
      margin: 0;
      color: var(--warn);
      font-size: var(--fs-label);
    }
  `,
})
export class AprobacionesPage {
  private readonly rrhh = inject(RrhhService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);

  readonly indice = signal(0);
  readonly esVacaciones = computed(() => this.indice() === 0);

  readonly vacaciones = signal<VacacionPeriodo[]>([]);
  readonly vales = signal<Vale[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  private readonly traidos = new Set<number>();

  constructor() {
    this.cargar();
  }

  cambiar(indice: number): void {
    this.indice.set(indice);
    this.cargar();
  }

  fecha(valor: string | undefined): string | null {
    return fechaLegible(valor);
  }

  /**
   * ⚠️ El servidor no dice de quién es el pedido: `VacacionPeriodo` no
   * expone al funcionario. Se muestra el número de período, que es lo único
   * que identifica, en vez de un nombre que no tenemos.
   */
  nombreDe(p: VacacionPeriodo): string {
    return `Período ${p.id}`;
  }

  nombreDeVale(v: Vale): string {
    return v.funcionario?.persona?.nombre ?? `Vale ${v.id}`;
  }

  rango(p: VacacionPeriodo): string {
    const desde = this.fecha(p.fechaDesde) ?? '—';
    const hasta = this.fecha(p.fechaHasta) ?? '—';
    const dias = p.diasUsados ?? 0;
    return `${desde} a ${hasta} · ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }

  /**
   * Aprueba unas vacaciones.
   *
   * ⚠️ Se manda `p.id`, que es el **id del período**, no el de una solicitud
   * individual: la aprobación ocurre a nivel del período vacacional.
   */
  async aprobar(p: VacacionPeriodo): Promise<void> {
    const aprobadorId = this.auth.usuario()?.id;
    if (p.id == null || aprobadorId == null) {
      return;
    }

    const confirmado = await this.dialogo.confirmar({
      titulo: 'Aprobar vacaciones',
      mensaje: `Se van a aprobar las vacaciones de ${this.nombreDe(p)}: ${this.rango(p)}.`,
      confirmar: 'Aprobar',
    });
    if (!confirmado) {
      return;
    }

    this.rrhh.aprobarVacacion(p.id, aprobadorId).subscribe({
      next: () => this.cargar(true),
      error: () => undefined,
    });
  }

  cargar(forzar = false): void {
    const indice = this.indice();
    if (!forzar && this.traidos.has(indice)) {
      this.cargando.set(false);
      this.error.set(null);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    // Las dos ramas se suscriben por separado. Una unión de observables de
    // tipos distintos no es invocable: TypeScript no puede elegir una firma.
    const listo = () => {
      this.traidos.add(indice);
      this.cargando.set(false);
    };
    const fallo = (err: Error) => {
      this.error.set(err.message);
      this.cargando.set(false);
    };

    if (this.esVacaciones()) {
      this.rrhh.vacacionesPendientes().subscribe({
        next: (d) => { this.vacaciones.set(d ?? []); listo(); },
        error: fallo,
      });
    } else {
      this.rrhh.valesPendientes().subscribe({
        next: (d) => { this.vales.set(d ?? []); listo(); },
        error: fallo,
      });
    }
  }
}
