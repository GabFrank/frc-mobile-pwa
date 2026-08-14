import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PreGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { etiquetaModuloPadre } from 'src/app/domains/gastos/tipo-gasto.reglas';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { GastosService } from './gastos.service';

/**
 * Detalle de una solicitud de caja chica, y el punto donde se confirma el
 * retiro del efectivo.
 *
 * ⚠️ **El retiro necesita el `qrToken`.** Es lo que ata el retiro a **esa**
 * solicitud: sin él, un retiro podría imputarse a otra. Llega escaneando el
 * QR que muestra el funcionario, o del propio `PreGasto` si ya se cargó.
 *
 * ⚠️ **`estado` y `estadoRendicion` son dos máquinas separadas.** Se muestran
 * las dos: una solicitud puede estar retirada y con la rendición pendiente, y
 * mirar solo una da una lectura incompleta.
 */
@Component({
  selector: 'frc-gastos-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    ImporteComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Solicitud de gasto" [conVolver]="true">
      @if (puedeRetirar()) {
        <div acciones>
          <button matButton="filled" [disabled]="operando()" (click)="confirmarRetiro()">
            {{ operando() ? 'Confirmando…' : 'Confirmar retiro' }}
          </button>
        </div>
      } @else if (puedeRendir()) {
        <div acciones>
          <button matButton="filled" (click)="rendir()">Rendir gasto</button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (gasto(); as g) {
        <frc-seccion titulo="Solicitud" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip [etiqueta]="g.estadoEtiqueta ?? g.estado ?? '—'" [tono]="tono()" />
          </frc-dato>
          @if (g.estadoRendicion) {
            <frc-dato etiqueta="Rendición" [valor]="g.estadoRendicion" />
          }
          <frc-dato etiqueta="Descripción" [valor]="g.descripcion ?? '—'" />
          <frc-dato etiqueta="Funcionario" [valor]="g.funcionario?.nombre ?? '—'" />
          <frc-dato etiqueta="Tipo" [valor]="tipo()" />
          <frc-dato etiqueta="Caja" [valor]="g.sucursalCaja?.nombre ?? '—'" />
          <frc-dato etiqueta="Solicitada" [valor]="fecha(g.creadoEn)" />
          @if (g.retiroConfirmadoEn) {
            <frc-dato etiqueta="Retirada" [valor]="fecha(g.retiroConfirmadoEn)" />
          }
        </frc-seccion>

        <frc-seccion titulo="Montos" [panel]="true">
          <frc-dato etiqueta="Solicitado">
            <frc-importe [valor]="g.montoSolicitado ?? 0" [moneda]="moneda()" [simbolo]="simbolo()" />
          </frc-dato>
          <frc-dato etiqueta="Retirado">
            <frc-importe [valor]="g.montoRetirado ?? 0" [moneda]="moneda()" [simbolo]="simbolo()" />
          </frc-dato>
          <frc-dato etiqueta="Rendido">
            <frc-importe [valor]="g.montoGastado ?? 0" [moneda]="moneda()" [simbolo]="simbolo()" />
          </frc-dato>
          <!--
            El vuelto pendiente es lo que el funcionario todavía debe: se
            muestra siempre, incluso en cero, porque su ausencia se leería
            como «no hay nada que devolver» sin decirlo.
          -->
          <frc-dato etiqueta="A devolver">
            <frc-importe [valor]="g.saldoDevolver ?? 0" [moneda]="moneda()" [simbolo]="simbolo()" />
          </frc-dato>
        </frc-seccion>

        @if ((g.rendiciones?.length ?? 0) > 0) {
          <frc-seccion [titulo]="'Rendiciones (' + g.rendiciones!.length + ')'">
            @for (r of g.rendiciones ?? []; track r.id) {
              <frc-card
                [titulo]="r.tipoGasto?.descripcion ?? 'Rendición'"
                [subtitulo]="fecha(r.creadoEn)"
                icono="documento"
              >
                <frc-importe
                  aparte
                  [valor]="r.montoTotal ?? 0"
                  [moneda]="moneda()"
                  [simbolo]="simbolo()"
                />
              </frc-card>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
})
export class GastosDetallePage {
  private readonly servicio = inject(GastosService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  // Inputs opcionales: el router los asigna después de construir (NG0950).
  readonly id = input<string>();
  readonly sucursalId = input<string>();
  /** Del QR escaneado. Si no viene, se usa el del propio `PreGasto`. */
  readonly token = input<string>();

  readonly gasto = signal<PreGasto | null>(null);
  readonly cargando = signal(true);
  readonly operando = signal(false);
  readonly error = signal<string | null>(null);

  readonly moneda = computed(() => this.gasto()?.moneda?.denominacion ?? 'Guaraní');
  readonly simbolo = computed(() => this.gasto()?.moneda?.simbolo ?? '₲');
  readonly tipo = computed(() => {
    const t = this.gasto()?.tipoGasto;
    if (!t) {
      return '—';
    }
    const activo = etiquetaModuloPadre(t.moduloPadre);
    return t.descripcion ? `${t.descripcion} · ${activo}` : activo;
  });

  /** Sin retiro confirmado y con token, se puede confirmar. */
  readonly puedeRetirar = computed(() => {
    const g = this.gasto();
    return g != null && !g.retiroConfirmadoEn && !!(this.token() || g.qrToken);
  });

  /**
   * Retirado y todavía sin rendir.
   *
   * ⚠️ Se mira `estadoRendicion`, **no** `estado`: son dos máquinas
   * separadas y una solicitud puede estar retirada con la rendición
   * pendiente. Chequear solo `estado` daba una lectura incompleta.
   */
  readonly puedeRendir = computed(() => {
    const g = this.gasto();
    if (g == null || !g.retiroConfirmadoEn) {
      return false;
    }
    const rendicion = String(g.estadoRendicion ?? '').toUpperCase();
    return rendicion !== 'RENDIDO' && rendicion !== 'APROBADO';
  });

  readonly tono = computed<'ok' | 'warn' | 'danger' | 'info' | 'neutral'>(() => {
    switch ((this.gasto()?.estadoColor ?? '').toLowerCase()) {
      case 'success':
        return 'ok';
      case 'warning':
        return 'warn';
      case 'danger':
      case 'error':
        return 'danger';
      case 'primary':
      case 'secondary':
        return 'info';
      default:
        return 'neutral';
    }
  });

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    const sucId = Number(this.sucursalId());
    if (!Number.isFinite(id) || !Number.isFinite(sucId)) {
      // Sin sucursal no se encuentra: el id de PreGasto no es único entre
      // filiales.
      this.error.set('Faltan la solicitud o la sucursal.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id, sucId).subscribe({
      next: (g) => {
        this.gasto.set(g ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor) ?? '—';
  }

  rendir(): void {
    const g = this.gasto();
    if (g?.id == null) {
      return;
    }
    void this.router.navigate([
      '/operaciones/gastos',
      g.id,
      g.sucursalId ?? this.sucursalId(),
      'rendir',
    ]);
  }

  async confirmarRetiro(): Promise<void> {
    const g = this.gasto();
    const personaId = this.auth.usuario()?.persona?.id;
    const qrToken = this.token() || g?.qrToken;

    if (g?.id == null || g.sucursalId == null || !qrToken) {
      this.notificacion.warn('Falta el código de la solicitud.');
      return;
    }
    if (personaId == null) {
      // El retiro se imputa a la persona, no al usuario: un usuario sin
      // persona asociada es un problema de datos, no de pantalla.
      this.notificacion.danger('Tu usuario no tiene una persona asociada.');
      return;
    }

    const ok = await this.dialogo.confirmar({
      titulo: 'Confirmar retiro',
      mensaje: 'Confirmá que el funcionario retiró el efectivo de la caja.',
      confirmar: 'Confirmar',
    });
    if (!ok) {
      return;
    }

    this.operando.set(true);
    this.servicio
      .confirmarRetiro({
        preGastoId: Number(g.id),
        sucursalId: Number(g.sucursalId),
        qrToken,
        funcionarioPersonaId: Number(personaId),
      })
      .subscribe({
        next: () => {
          this.operando.set(false);
          this.notificacion.ok('Retiro confirmado.');
          this.cargar();
        },
        error: (err: Error) => {
          this.operando.set(false);
          this.notificacion.danger(err.message);
        },
      });
  }
}
