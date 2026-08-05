import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PdvCaja } from 'src/app/domains/caja/caja.model';
import { VentaTarjeta, VentaTarjetaEstado } from 'src/app/domains/venta-tarjeta/venta-tarjeta.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CajaService } from '../caja/caja.service';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { interpretarQrVenta } from './venta-tarjeta-qr';
import { VentaTarjetaService } from './venta-tarjeta.service';

/**
 * Cupones de la caja abierta del usuario.
 *
 * ⚠️ **Todo el módulo gira alrededor de una caja abierta.** Sin caja no hay
 * nada que conciliar: los cupones pertenecen a la caja que los cobró, y el
 * QR solo se acepta desde esa misma caja.
 */
@Component({
  selector: 'frc-venta-tarjeta-lista',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    ImporteComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Venta con tarjeta" [conVolver]="true">
      @if (caja()) {
        <div acciones>
          <button matButton="filled" (click)="escanear()">Escanear cupón</button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (!caja()) {
        <frc-estado-vacio
          titulo="Sin caja abierta"
          detalle="Los cupones se registran contra la caja que cobró la venta. Abrí una caja para empezar."
          icono="dinero"
        />
      } @else {
        <frc-seccion titulo="Caja" [panel]="true">
          <frc-dato etiqueta="Caja" [valor]="caja()!.descripcion ?? ('Caja ' + caja()!.id)" />
          <frc-dato etiqueta="Sin registrar" [valor]="pendientes()" />
        </frc-seccion>

        @if (cupones().length === 0) {
          <frc-estado-vacio
            titulo="Sin cupones"
            detalle="Escaneá el QR que muestra el punto de venta para registrar el cupón."
            icono="etiqueta"
            accion="Escanear cupón"
            (ejecutar)="escanear()"
          />
        } @else {
          @for (v of cupones(); track v.id) {
            <frc-card
              [titulo]="'Venta ' + (v.venta?.id ?? v.id)"
              [subtitulo]="subtitulo(v)"
              icono="etiqueta"
            >
              <frc-importe
                aparte
                [valor]="v.monto ?? v.venta?.totalGs ?? 0"
                [moneda]="v.terminalPos?.moneda?.denominacion ?? 'Guaraní'"
                [simbolo]="v.terminalPos?.moneda?.simbolo ?? '₲'"
              />
              <frc-estado-chip pie enumerado="VentaTarjetaEstado" [valor]="v.estado ?? null" />
            </frc-card>
          }
        }
      }
    </frc-pagina>
  `,
})
export class VentaTarjetaListaPage {
  private readonly servicio = inject(VentaTarjetaService);
  private readonly cajaService = inject(CajaService);
  private readonly escaner = inject(EscanerService);
  private readonly notificacion = inject(NotificacionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly caja = signal<PdvCaja | null>(null);
  readonly cupones = signal<VentaTarjeta[]>([]);
  readonly pendientes = signal(0);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly sinRegistrar = computed(
    () => this.cupones().filter((v) => v.estado === VentaTarjetaEstado.PENDIENTE).length,
  );

  constructor() {
    this.cargar();
  }

  cargar(): void {
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId == null) {
      this.error.set('La sesión no tiene usuario.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.cajaService.abiertasDelUsuario(usuarioId).subscribe({
      next: (cajas) => {
        const abierta = (cajas ?? [])[0] ?? null;
        this.caja.set(abierta);
        if (!abierta?.id) {
          this.cargando.set(false);
          return;
        }
        this.cargarCupones(abierta);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  private cargarCupones(caja: PdvCaja): void {
    // La sucursal sale de la caja, no de la sesión: el id de caja no es único
    // entre filiales.
    const sucId = Number(caja.sucursal?.id ?? caja.sucursalId);
    if (!Number.isFinite(sucId)) {
      this.error.set('La caja no tiene sucursal.');
      this.cargando.set(false);
      return;
    }

    this.servicio.porCaja(Number(caja.id), sucId).subscribe({
      next: (lista) => {
        this.cupones.set(lista);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
    this.servicio.pendientes(Number(caja.id), sucId).subscribe((n) => this.pendientes.set(n));
  }

  subtitulo(v: VentaTarjeta): string {
    const partes = [
      v.terminalPos?.descripcion ?? v.terminalPos?.codigo,
      v.numeroBoleta ? `Boleta ${v.numeroBoleta}` : '',
      fechaLegible(v.creadoEn) ?? '',
    ];
    return partes.filter(Boolean).join(' · ');
  }

  /**
   * Escanea el QR del punto de venta y va al registro.
   *
   * El QR se valida entero antes de navegar —incluida la caja— para que un
   * cupón de otra caja no llegue nunca al formulario.
   */
  async escanear(): Promise<void> {
    const texto = await this.escaner.escanear({
      titulo: 'Escanear cupón',
      ayuda: 'Apuntá al QR del punto de venta',
      formatos: FORMATOS_QR,
      etiquetaManual: 'Código del cupón',
    });
    if (!texto) {
      return;
    }

    const resultado = interpretarQrVenta(texto, this.caja()?.id);
    if (!resultado.ok || !resultado.datos) {
      this.notificacion.warn(resultado.mensaje ?? 'QR no válido.');
      return;
    }

    void this.router.navigate(['/operaciones/venta-tarjeta/registro'], {
      queryParams: resultado.datos,
    });
  }
}
