import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  DestroyRef,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, interval } from 'rxjs';
import { catchError, exhaustMap, filter } from 'rxjs/operators';
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
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { interpretarQrRetiro } from './gasto-retiro-qr';
import { GastosService } from './gastos.service';

/**
 * Detalle de una solicitud de caja chica, y el punto donde se confirma el
 * retiro del efectivo.
 *
 * ⚠️ **Hay dos formas de retirar, y solo una usa QR.**
 * - **Caja de una sucursal**: el cajero muestra el QR y el funcionario lo
 *   escanea. El código (`qrToken`) llega **solo** del QR: el central no lo
 *   devuelve con la solicitud y lo cambia cada vez que la caja lo muestra, así
 *   que hay que estar frente a la caja para confirmar.
 * - **Tesorería (caja mayor)**: SERVIDOR, o cualquier solicitud enviada a
 *   tesorería. Sin QR: el retiro queda hecho cuando tesorería la paga
 *   (`PAGADO`).
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
            {{ operando() ? 'Confirmando…' : tokenRetiro() ? 'Confirmar retiro' : 'Escanear QR de la caja' }}
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
          @if (avisoRetiro(); as aviso) {
            <frc-dato etiqueta="Retiro" [valor]="aviso" />
          }
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
          <!-- El vuelto que recibió la caja: desde ahí, el rendido es retirado − vuelto. -->
          @if (g.montoVuelto != null) {
            <frc-dato etiqueta="Devuelto en caja">
              <frc-importe [valor]="g.montoVuelto ?? 0" [moneda]="moneda()" [simbolo]="simbolo()" />
            </frc-dato>
          }
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
  private readonly escaner = inject(EscanerService);
  private readonly destroyRef = inject(DestroyRef);

  // Inputs opcionales: el router los asigna después de construir (NG0950).
  readonly id = input<string>();
  readonly sucursalId = input<string>();
  /** Del QR escaneado. Si no viene, se usa el del propio `PreGasto`. */
  readonly token = input<string>();
  /** El que se escaneó desde esta pantalla, si se entró sin QR. */
  private readonly tokenEscaneado = signal<string | null>(null);
  readonly tokenRetiro = computed(() => this.tokenEscaneado() || this.token() || null);

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

  /**
   * Se retira en tesorería: SERVIDOR (sucursal 0, sin caja) o enviada a
   * tesorería. Ahí no hay QR.
   */
  readonly porTesoreria = computed(() => {
    const g = this.gasto();
    if (g == null) {
      return false;
    }
    const estado = String(g.estado ?? '');
    return Number(g.sucursalId) === 0 || estado === 'ENVIADO_A_TESORERIA' || estado === 'PAGADO';
  });

  /**
   * Autorizada, de una sucursal y sin confirmar. Si no se entró por el QR, el
   * botón abre el escáner: el código no viene con la solicitud.
   */
  readonly puedeRetirar = computed(() => {
    const g = this.gasto();
    return g != null && g.estado === 'AUTORIZADO' && !this.porTesoreria() && !g.retiroConfirmadoEn;
  });

  /** Dónde y cómo se retira, para que no quede la duda de qué falta. */
  readonly avisoRetiro = computed<string | null>(() => {
    const g = this.gasto();
    if (g == null) {
      return null;
    }
    switch (g.estado) {
      case 'AUTORIZADO':
        if (this.porTesoreria()) {
          return 'En tesorería (caja mayor), cuando la envíen a tesorería';
        }
        return g.retiroConfirmadoEn
          ? 'Confirmado: el cajero tiene que registrar la entrega'
          : 'En la caja de la sucursal, escaneando su QR';
      case 'ENVIADO_A_TESORERIA':
        return 'En tesorería (caja mayor), sin QR: pendiente de pago';
      case 'PAGADO':
        return 'Entregado por tesorería';
      default:
        return null;
    }
  });

  /**
   * Con la plata ya entregada y todavía sin rendir del todo.
   *
   * ⚠️ **Entregada no es `retiroConfirmadoEn`.** En la sucursal esa fecha
   * se marca al escanear, **antes** de que el cajero entregue nada; la entrega
   * es `TRAMITE` con monto retirado. En tesorería es `PAGADO`. (`TRAMITE`
   * solo no alcanza: también es un estado previo a la autorización.)
   *
   * ⚠️ El central marca la rendición `NO_RENDIDO`, `RENDIDO_PARCIAL` o
   * `RENDIDO_COMPLETO`.
   */
  readonly puedeRendir = computed(() => {
    const g = this.gasto();
    if (g == null) {
      return false;
    }
    const entregada =
      g.estado === 'PAGADO' || (g.estado === 'TRAMITE' && Number(g.montoRetirado ?? 0) > 0);
    const rendicion = String(g.estadoRendicion ?? '').toUpperCase();
    return entregada && rendicion !== 'RENDIDO_COMPLETO';
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

  /**
   * Esperando que entreguen la plata: autorizada (la caja puede entregar con o
   * sin QR) o enviada a tesorería (falta el pago).
   */
  private readonly esperandoEntrega = computed(() => {
    const estado = this.gasto()?.estado;
    return estado === 'AUTORIZADO' || estado === 'ENVIADO_A_TESORERIA';
  });

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
    this.sondearEntrega();
  }

  /**
   * Mientras espera la entrega, relee la solicitud cada 5 s en silencio: así,
   * si el cajero entrega sin QR o tesorería paga, la pantalla cambia sola sin
   * tener que volver a entrar.
   */
  private sondearEntrega(): void {
    interval(5000)
      .pipe(
        filter(() => this.esperandoEntrega() && !this.operando()),
        exhaustMap(() => {
          const g = this.gasto();
          return this.servicio
            .porId(Number(g?.id), Number(g?.sucursalId), {
              mostrarCarga: false,
              notificarError: false,
              gql: { fetchPolicy: 'no-cache' },
            })
            .pipe(catchError(() => EMPTY));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((nuevo) => {
        const antes = this.gasto();
        if (nuevo == null || antes == null) {
          return;
        }
        if (nuevo.estado !== antes.estado || nuevo.retiroConfirmadoEn !== antes.retiroConfirmadoEn) {
          this.gasto.set(nuevo);
          if (nuevo.estado === 'TRAMITE' || nuevo.estado === 'PAGADO') {
            this.notificacion.ok('Te entregaron el efectivo.');
          }
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

    if (g?.id == null || g.sucursalId == null) {
      return;
    }
    const qrToken = this.tokenRetiro() ?? (await this.escanearQrDeLaCaja(g));
    if (!qrToken) {
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
          // El código cambia cada vez que la caja muestra el QR: si falló,
          // el que se escaneó ya no sirve y hay que volver a escanear.
          this.tokenEscaneado.set(null);
          this.notificacion.danger(err.message);
        },
      });
  }

  /**
   * Escanea el QR que muestra la caja y devuelve su código, solo si es de
   * **esta** solicitud.
   */
  private async escanearQrDeLaCaja(g: PreGasto): Promise<string | null> {
    const texto = await this.escaner.escanear({
      titulo: 'Escanear QR de la caja',
      ayuda: 'Apuntá al QR que muestra el cajero',
      formatos: FORMATOS_QR,
      etiquetaManual: 'Código de la solicitud',
    });
    if (!texto) {
      return null;
    }
    const resultado = interpretarQrRetiro(texto);
    if (!resultado.ok || !resultado.datos) {
      this.notificacion.warn(resultado.mensaje ?? 'QR no reconocido.');
      return null;
    }
    const { preGastoId, sucursalId, qrToken } = resultado.datos;
    if (preGastoId !== Number(g.id) || sucursalId !== Number(g.sucursalId)) {
      this.notificacion.warn('Ese QR es de otra solicitud.');
      return null;
    }
    this.tokenEscaneado.set(qrToken);
    return qrToken;
  }
}
