import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Sector } from 'src/app/domains/sector/sector.model';
import { SectorService } from 'src/app/domains/sector/sector.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { DatosLugar, LugarDialogComponent, ResultadoLugar } from './lugar-dialog.component';

/**
 * Sectores de una sucursal: la geografía sobre la que se cuenta.
 *
 * ⚠️ **Esto no cuelga de un inventario, aunque `frc-mobile` lo anide
 * adentro.** Allá se llega por
 * `inventario/list/info/:id/gestion-zona-sector/:sucursalId`, y el id del
 * inventario viaja por seis rutas anidadas sin que ninguna pantalla lo use
 * para nada más que volver. Sectores y zonas son de la **sucursal**: los
 * mismos estantes sirven para todas las tomas que vengan.
 *
 * ⚠️ **Solo sucursales operables.** Una sucursal sin depósito no tiene dónde
 * poner un sector.
 */
@Component({
  selector: 'frc-lugares',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    SelectorComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
    TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Lugares del depósito" [conVolver]="true">
      <div acciones>
        <button matButton="filled" [disabled]="sucursalId() == null" (click)="nuevoSector()">
          Nuevo sector
        </button>
      </div>

      <frc-selector
        etiqueta="Sucursal"
        [opciones]="opcionesSucursal()"
        [valor]="sucursalId()"
        (valorChange)="cambiarSucursal($event)"
      />

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (sectores().length === 0) {
        <frc-estado-vacio
          titulo="Sin sectores"
          detalle="Esta sucursal todavía no tiene sectores. Creá el primero para poder armar zonas."
          icono="inventario"
        />
      } @else {
        @for (s of sectores(); track s.id) {
          <frc-card
            [titulo]="(s.descripcion ?? 'Sector') | titlecase"
            [subtitulo]="zonasDe(s)"
            icono="inventario"
            (abrir)="abrir(s)"
          >
            @if (s.activo === false) {
              <frc-estado-chip aparte etiqueta="Inactivo" tono="neutral" />
            }
          </frc-card>
        }
      }
    </frc-pagina>
  `,
})
export class LugaresPage {
  private readonly sectores_ = inject(SectorService);
  private readonly sucursales = inject(SucursalService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  readonly sucursalId = signal<unknown>(null);
  readonly sectores = signal<Sector[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  private readonly listaSucursales = signal<Sucursal[]>([]);

  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() =>
    this.listaSucursales().map((s) => ({ valor: s.id, texto: s.nombre ?? `Sucursal ${s.id}` })),
  );

  constructor() {
    this.cargarSucursales();
  }

  private cargarSucursales(): void {
    this.sucursales.todas().subscribe({
      next: (lista) => {
        const operables = soloOperables(lista ?? []);
        this.listaSucursales.set(operables);

        const propia = this.auth.sucursal()?.id;
        const elegida =
          propia != null && operables.some((s) => Number(s.id) === Number(propia))
            ? propia
            : operables[0]?.id;

        if (elegida != null) {
          this.sucursalId.set(elegida);
          this.cargar();
        } else {
          this.cargando.set(false);
        }
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  cargar(): void {
    const id = Number(this.sucursalId());
    if (!Number.isFinite(id) || id <= 0) {
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.sectores_.deSucursal(id).subscribe({
      next: (lista) => {
        this.sectores.set(lista ?? []);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  cambiarSucursal(valor: unknown): void {
    this.sucursalId.set(valor);
    this.cargar();
  }

  zonasDe(s: Sector): string {
    const cantidad = s.zonaList?.length ?? 0;
    return cantidad === 1 ? '1 zona' : `${cantidad} zonas`;
  }

  abrir(s: Sector): void {
    if (s.id != null) {
      void this.router.navigate(['/inventario/lugares', s.id]);
    }
  }

  async nuevoSector(): Promise<void> {
    const sucursalId = Number(this.sucursalId());
    if (!Number.isFinite(sucursalId)) {
      return;
    }
    const sucursal = this.listaSucursales().find((s) => Number(s.id) === sucursalId);

    const res = await this.dialogo.abrir<LugarDialogComponent, DatosLugar, ResultadoLugar>(
      LugarDialogComponent,
      { tipo: 'sector', contexto: sucursal?.nombre },
    );
    if (res?.accion !== 'guardar') {
      return;
    }

    this.sectores_
      .guardar({ sucursalId, descripcion: res.descripcion, activo: res.activo })
      .subscribe({
        next: () => this.cargar(),
        error: (err: Error) => this.notificacion.danger(err.message),
      });
  }
}
