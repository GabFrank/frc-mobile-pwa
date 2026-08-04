import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DatosService } from 'src/app/core/graphql/datos.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PdvCaja, PdvCajaInput } from 'src/app/domains/caja/caja.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { CajaService } from './caja.service';
import { ConteoFormComponent, EsperadoPorMoneda } from './conteo-form.component';
import { MonedasConDenominacionesGQL } from './graphql/moneda-y-maletin';

/**
 * Cierre de caja: arqueo final contra lo que el balance dice que debería haber.
 *
 * ⚠️ **La diferencia que se muestra acá es informativa.** La que cuenta —la
 * que define si el cajero responde por dinero faltante— la calcula el
 * backend al cerrar. Acá se muestra mientras cuenta para que el cajero
 * pueda recontar antes de confirmar, no para reemplazar ese cálculo.
 *
 * ⚠️ **El cierre exige `sucursalId` explícito**, a diferencia de la
 * apertura: puede ejecutarse sobre una caja de otra sucursal.
 */
@Component({
  selector: 'frc-caja-cerrar',
  standalone: true,
  imports: [
    PaginaComponent,
    ConteoFormComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Cerrar caja" [conVolver]="true" (atras)="salir()">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else {
        <p class="intro">
          Contá el efectivo del maletín. Vas a ver la diferencia contra lo esperado mientras
          cargás, para poder recontar antes de confirmar.
        </p>
        <frc-conteo-form [monedas]="monedas()" [esperado]="esperado()" />
      }

      <div acciones>
        <button matButton="filled" class="ancho" [disabled]="guardando()" (click)="cerrar()">
          {{ guardando() ? 'Cerrando…' : 'Cerrar caja' }}
        </button>
      </div>
    </frc-pagina>
  `,
  styles: `
    .ancho { width: 100%; }
    .intro {
      margin: 0;
      color: var(--text-soft);
      font-size: var(--fs-label);
    }
  `,
})
export class CajaCerrarPage {
  private readonly datos = inject(DatosService);
  private readonly cajaService = inject(CajaService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);
  private readonly monedasGQL = inject(MonedasConDenominacionesGQL);

  private readonly form = viewChild(ConteoFormComponent);

  /** Id de la caja, de la ruta. */
  readonly id = input<string>();
  /** Sucursal de la caja, por query param. El id de caja no es único. */
  readonly suc = input<string>();

  readonly monedas = signal<Moneda[]>([]);
  readonly caja = signal<PdvCaja | null>(null);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Igual que en el detalle: con `withComponentInputBinding` los inputs de
    // ruta se asignan DESPUÉS del constructor.
    effect(() => {
      const id = this.id();
      this.suc();
      if (id !== undefined) {
        this.cargar();
      }
    });
  }

  /**
   * Lo que debería haber en el maletín al cerrar.
   *
   * Sale del balance que calculó el backend, no de una suma nuestra. En
   * guaraníes el backend ya expone `totalCierreGs`; para real y dólar no hay
   * equivalente en el balance de cierre, así que esas filas quedan sin
   * esperado en vez de mostrar un cero que se leería como "no hay nada".
   */
  esperado(): EsperadoPorMoneda | null {
    const balance = this.caja()?.balance;
    if (!balance) {
      return null;
    }
    return {
      gs: balance.totalCierreGs ?? undefined,
      rs: balance.totalCierreRs ?? undefined,
      ds: balance.totalCierreDs ?? undefined,
    };
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id)) {
      this.error.set('La caja indicada no es válida.');
      this.cargando.set(false);
      return;
    }
    const suc = Number(this.suc());
    const sucId = Number.isFinite(suc) && suc > 0 ? suc : undefined;

    this.cargando.set(true);
    this.error.set(null);

    Promise.all([
      firstValueFrom(this.datos.consultar<Moneda[]>(this.monedasGQL, {}, { mostrarCarga: false })),
      firstValueFrom(this.cajaService.porId(id, sucId)),
    ])
      .then(([monedas, caja]) => {
        this.monedas.set(monedas ?? []);
        this.caja.set(caja ?? null);
      })
      .catch((err: Error) => this.error.set(err.message))
      .finally(() => this.cargando.set(false));
  }

  async cerrar(): Promise<void> {
    const form = this.form();
    const caja = this.caja();
    const usuarioId = this.auth.usuario()?.id;
    // La sucursal sale de la caja, NO de la sesión: se puede cerrar una caja
    // de otra sucursal, y usar la de la sesión mandaría el cierre a la
    // filial equivocada.
    const sucursalId = caja?.sucursal?.id ?? caja?.sucursalId ?? Number(this.suc());

    if (!form || caja?.id == null) {
      return;
    }
    if (!Number.isFinite(sucursalId) || usuarioId == null) {
      this.notificacion.danger('No se pudo determinar la sucursal de la caja.');
      return;
    }
    if (form.vacio()) {
      this.notificacion.warn('Cargá el arqueo antes de cerrar la caja.');
      return;
    }

    const confirmado = await this.dialogo.confirmar({
      titulo: 'Cerrar caja',
      mensaje:
        'Se va a cerrar la caja con el arqueo cargado. La diferencia la calcula el servidor y ' +
        'queda registrada a tu nombre.',
      confirmar: 'Cerrar caja',
    });
    if (!confirmado) {
      return;
    }

    const conteo = form.armar();
    const input = new PdvCajaInput();
    input.id = caja.id;
    input.sucursalId = Number(sucursalId);
    input.usuarioId = usuarioId;

    this.guardando.set(true);
    this.cajaService
      .cerrar(caja.id, input, { ...conteo.toInput(), usuarioId }, conteo.toInputList())
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
