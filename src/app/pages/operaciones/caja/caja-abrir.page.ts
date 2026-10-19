import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
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
import { Maletin } from 'src/app/domains/caja/maletin.model';
import { PdvCajaEstado, PdvCajaInput } from 'src/app/domains/caja/caja.model';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import { CajaService } from './caja.service';
import { ConteoFormComponent } from './conteo-form.component';
import { MaletinesGQL, MonedasConDenominacionesGQL } from './graphql/moneda-y-maletin';

/**
 * Apertura de caja: elegir sucursal y maletín, y cargar el arqueo inicial.
 *
 * ⚠️ **La sucursal la elige el cajero, no sale de la sesión.** La app habla
 * con el central, y la «sucursal de la sesión» ahí es la 0 (`SERVIDOR`): con
 * ella se ofrecían maletines que no son de ninguna sucursal real y la
 * apertura no llegaba a la filial. No se preselecciona ninguna: abrir en la
 * sucursal equivocada es peor que un toque de más.
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
    <frc-pagina titulo="Abrir caja" [conVolver]="true" [conEscaner]="false" (atras)="salir()">
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else {
        <frc-seccion titulo="Sucursal y maletín" [panel]="true">
          <frc-selector
            etiqueta="Sucursal"
            [opciones]="opcionesSucursal()"
            [valor]="sucursalId()"
            (valorChange)="cambiarSucursal($event)"
          />
          <div class="maletin">
            <frc-selector
              etiqueta="Maletín"
              [opciones]="opcionesMaletin()"
              [valor]="maletinId()"
              [deshabilitado]="sucursalId() == null || cargandoMaletines() || sinMaletines()"
              (valorChange)="maletinId.set($event)"
            />
          </div>
          @if (sucursalId() == null) {
            <p class="aviso">Elegí la sucursal para ver sus maletines.</p>
          } @else if (cargandoMaletines()) {
            <p class="aviso">Consultando los maletines de {{ sucursalNombre() }}…</p>
          } @else if (errorMaletines()) {
            <p class="aviso">{{ errorMaletines() }}</p>
            <button matButton (click)="cargarMaletines()">Reintentar</button>
          } @else if (sinMaletines()) {
            <p class="aviso">
              No hay maletines disponibles en {{ sucursalNombre() }}. Los que están en uso por otra
              caja no aparecen acá.
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
    .maletin {
      margin-top: var(--sp-3);
    }
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
  private readonly sucursales = inject(SucursalService);

  private readonly form = viewChild(ConteoFormComponent);

  readonly monedas = signal<Moneda[]>([]);
  readonly maletines = signal<Maletin[]>([]);
  readonly maletinId = signal<unknown>(null);
  readonly sucursalId = signal<unknown>(null);
  readonly cargandoMaletines = signal(false);
  readonly errorMaletines = signal<string | null>(null);
  private readonly listaSucursales = signal<Sucursal[]>([]);

  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() =>
    this.listaSucursales().map((s) => ({ valor: s.id, texto: s.nombre ?? `Sucursal ${s.id}` })),
  );
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  sucursalNombre(): string {
    const id = this.sucursalId();
    const elegida = this.listaSucursales().find((s) => String(s.id) === String(id));
    return elegida?.nombre ?? 'esta sucursal';
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

    Promise.all([
      firstValueFrom(this.datos.consultar<Moneda[]>(this.monedasGQL, {}, { mostrarCarga: false })),
      firstValueFrom(this.sucursales.todas()),
    ])
      .then(([monedas, sucursales]) => {
        this.monedas.set(monedas ?? []);
        // Sin IP el central no tiene a qué filial preguntarle ni dónde abrir.
        this.listaSucursales.set(soloOperables(sucursales ?? []).filter((s) => !!s.ip));
      })
      .catch((err: Error) => this.error.set(err.message))
      .finally(() => this.cargando.set(false));
  }

  cambiarSucursal(id: unknown): void {
    this.sucursalId.set(id);
    this.cargarMaletines();
  }

  cargarMaletines(): void {
    const sucId = this.sucursalId();
    this.maletinId.set(null);
    this.maletines.set([]);
    this.errorMaletines.set(null);
    if (sucId == null) {
      return;
    }

    this.cargandoMaletines.set(true);
    firstValueFrom(
      this.datos.consultar<Maletin[]>(
        this.maletinesGQL,
        { sucId },
        // El error ya se muestra en la sección, con su «Reintentar».
        { mostrarCarga: false, notificarError: false },
      ),
    )
      .then((maletines) => {
        // Si mientras tanto se eligió otra sucursal, esta respuesta ya no vale.
        if (this.sucursalId() === sucId) {
          this.maletines.set(maletines ?? []);
        }
      })
      .catch((err: Error) => {
        if (this.sucursalId() === sucId) {
          this.errorMaletines.set(err.message);
        }
      })
      .finally(() => {
        if (this.sucursalId() === sucId) {
          this.cargandoMaletines.set(false);
        }
      });
  }

  async abrir(): Promise<void> {
    const form = this.form();
    const usuarioId = this.auth.usuario()?.id;
    const maletinId = Number(this.maletinId());

    if (usuarioId == null) {
      this.notificacion.danger('No se pudo identificar tu usuario. Volvé a iniciar sesión.');
      return;
    }
    if (this.sucursalId() == null) {
      this.notificacion.warn('Elegí la sucursal antes de abrir la caja.');
      return;
    }
    const sucursalId = Number(this.sucursalId());
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
      ? `El arqueo inicial está en cero. ¿Abrir la caja en ${this.sucursalNombre()} sin efectivo?`
      : `¿Abrir la caja en ${this.sucursalNombre()} con el arqueo cargado?`;
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
