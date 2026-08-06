import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Maletin } from 'src/app/domains/caja/maletin.model';
import { PdvCajaEstado, PdvCajaInput } from 'src/app/domains/caja/caja.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { SelectorComponent } from 'src/app/shared/selector/selector.component';
import { CajaService } from './caja.service';
import { ConteoFormComponent } from './conteo-form.component';
import { MaletinesGQL, MonedasConDenominacionesGQL } from './graphql/moneda-y-maletin';

/**
 * Apertura de caja: elegir maletín y cargar el arqueo inicial.
 *
 * ⚠️ **La caja y su arqueo se guardan en una sola operación.** No se abre la
 * caja primero y se cuenta después: una caja abierta sin arqueo inicial hace
 * que la diferencia al cierre no sea calculable, y esa diferencia es la que
 * define si el cajero responde por dinero faltante.
 */
@Component({
  selector: 'frc-caja-abrir',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    SelectorComponent,
    ConteoFormComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Abrir caja" [conVolver]="true" (atras)="salir()">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else {
        <frc-seccion titulo="Maletín" [panel]="true">
          <frc-selector
            etiqueta="Maletín"
            [opciones]="opcionesMaletin()"
            [valor]="maletinId()"
            (valorChange)="maletinId.set($event)"
          />
          @if (sinMaletines()) {
            <p class="aviso">
              No hay maletines disponibles en {{ sucursalNombre() }}. Los que están en uso por
              otra caja no aparecen acá.
            </p>
          }
        </frc-seccion>

        <frc-conteo-form [monedas]="monedas()" />
      }

      <div acciones>
        <button matButton="filled" [disabled]="guardando()" (click)="abrir()">
          {{ guardando() ? 'Abriendo…' : 'Abrir caja' }}
        </button>
      </div>
    </frc-pagina>
  `,
  styles: `
    .aviso {
      margin: var(--sp-2) 0 0;
      color: var(--warn);
      font-size: var(--fs-label);
    }
  `,
})
export class CajaAbrirPage {
  private readonly datos = inject(DatosService);
  private readonly cajaService = inject(CajaService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);
  private readonly monedasGQL = inject(MonedasConDenominacionesGQL);
  private readonly maletinesGQL = inject(MaletinesGQL);

  private readonly form = viewChild(ConteoFormComponent);

  readonly monedas = signal<Moneda[]>([]);
  readonly maletines = signal<Maletin[]>([]);
  readonly maletinId = signal<unknown>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  sucursalNombre(): string {
    return this.auth.sucursal()?.nombre ?? 'esta sucursal';
  }

  opcionesMaletin(): { valor: unknown; texto: string }[] {
    return this.maletines().map((m) => ({
      valor: m.id,
      texto: m.descripcion ?? `Maletín ${m.id}`,
    }));
  }

  sinMaletines(): boolean {
    return this.maletines().length === 0;
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    const sucId = this.auth.sucursal()?.id;

    Promise.all([
      firstValueFrom(this.datos.consultar<Moneda[]>(this.monedasGQL, {}, { mostrarCarga: false })),
      firstValueFrom(
        this.datos.consultar<Maletin[]>(
          this.maletinesGQL,
          { texto: '', sucId },
          { mostrarCarga: false },
        ),
      ),
    ])
      .then(([monedas, maletines]) => {
        this.monedas.set(monedas ?? []);
        // Un maletín `abierto` ya está en uso por otra caja: ofrecerlo
        // llevaría a dos cajas compartiendo el mismo efectivo físico.
        this.maletines.set((maletines ?? []).filter((m) => m.activo !== false && !m.abierto));
      })
      .catch((err: Error) => this.error.set(err.message))
      .finally(() => this.cargando.set(false));
  }

  async abrir(): Promise<void> {
    const form = this.form();
    const sucursalId = this.auth.sucursal()?.id;
    const usuarioId = this.auth.usuario()?.id;
    const maletinId = Number(this.maletinId());

    if (sucursalId == null || usuarioId == null) {
      this.notificacion.danger('No se pudo identificar tu sucursal. Volvé a iniciar sesión.');
      return;
    }
    if (!Number.isFinite(maletinId) || maletinId <= 0) {
      this.notificacion.warn('Elegí un maletín antes de abrir la caja.');
      return;
    }
    if (!form) {
      return;
    }
    // Se avisa pero no se bloquea: abrir con caja vacía es legítimo —una caja
    // nueva sin fondo inicial— y bloquearlo obligaría a inventar un monto.
    const mensaje = form.vacio()
      ? 'El arqueo inicial está en cero. ¿Abrir la caja sin efectivo?'
      : '¿Abrir la caja con el arqueo cargado?';
    const confirmado = await this.dialogo.confirmar({
      titulo: 'Abrir caja',
      mensaje,
      confirmar: 'Abrir',
    });
    if (!confirmado) {
      return;
    }

    const conteo = form.armar();
    conteo.usuario = this.auth.usuario() ?? undefined;

    const input = new PdvCajaInput();
    input.sucursalId = sucursalId;
    input.usuarioId = usuarioId;
    input.maletinId = maletinId;
    input.activo = true;
    input.estado = PdvCajaEstado['En proceso'];

    this.guardando.set(true);
    this.cajaService
      .abrir(input, { ...conteo.toInput(), usuarioId }, conteo.toInputList())
      .subscribe({
        next: (ok) => {
          this.guardando.set(false);
          if (ok) {
            void this.router.navigate(['/operaciones/caja']);
          }
        },
        error: () => this.guardando.set(false),
      });
  }

  salir(): void {
    void this.router.navigate(['/operaciones/caja']);
  }
}
