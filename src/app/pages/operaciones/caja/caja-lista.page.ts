import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { CajaService } from './caja.service';

/**
 * Cajas abiertas del usuario.
 *
 * Implementa los tres estados obligatorios: carga, vacío y error.
 */
@Component({
  selector: 'frc-caja-lista',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Caja" [conVolver]="true">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (cajas().length === 0) {
        <frc-estado-vacio
          titulo="No tenés cajas abiertas"
          detalle="Cuando abras una caja en el punto de venta aparece acá para consultar su balance."
          icono="dinero"
        />
      } @else {
        @for (caja of cajas(); track caja.id) {
          <frc-card
            [titulo]="caja.descripcion ?? ('Caja ' + caja.id)"
            [subtitulo]="caja.sucursal?.nombre ?? ''"
            icono="dinero"
            (abrir)="abrir(caja)"
          >
            <!--
              El chip solo aparece si hay estado. En la tabla replicada del
              central, el estado viene null en las cajas viejas que quedaron
              con activo = true; un chip vacío mostraba un guión en cada fila,
              ocupando lugar sin decir nada. La fecha de apertura sí está y
              es lo que permite reconocer una caja olvidada abierta.
            -->
            @if (caja.estado) {
              <frc-estado-chip pie enumerado="PdvCajaEstado" [valor]="caja.estado" />
            } @else if (desde(caja); as fecha) {
              <span pie class="desde">Abierta el {{ fecha }}</span>
            }
          </frc-card>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .desde {
      font-size: var(--fs-caption);
      color: var(--text-soft);
    }
  `,
})
export class CajaListaPage {
  private readonly cajaService = inject(CajaService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cajas = signal<PdvCaja[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  cargar(): void {
    const usuarioId = this.auth.usuario()?.id ?? this.auth.usuarioIdGuardado;
    if (usuarioId == null) {
      this.error.set('No se pudo identificar al usuario en sesión.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.cajaService.abiertasDelUsuario(usuarioId).subscribe({
      next: (cajas) => {
        this.cajas.set(cajas ?? []);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  desde(caja: PdvCaja): string | null {
    return fechaLegible(caja.fechaApertura);
  }

  abrir(caja: PdvCaja): void {
    void this.router.navigate(['/operaciones/caja', caja.id]);
  }
}
