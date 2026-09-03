import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PreGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { interpretarQrRetiro } from './gasto-retiro-qr';
import { GastosService } from './gastos.service';

const TAMANO = 10;

/**
 * Solicitudes de caja chica.
 *
 * Dos usos en la misma pantalla: consultar las solicitudes y **escanear el QR
 * de una** para ir directo a confirmar su retiro, que es lo que hace el
 * cajero cuando el funcionario se presenta.
 */
@Component({
  selector: 'frc-gastos-lista',
  standalone: true,
  imports: [
    PaginaComponent,
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
    <frc-pagina titulo="Caja chica" [conVolver]="true">
      <div acciones>
        <button matButton (click)="nueva()">Nueva solicitud</button>
        <button matButton="filled" (click)="escanear()">Escanear solicitud</button>
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          titulo="Sin solicitudes"
          detalle="Las solicitudes de gasto aparecen acá. Escaneá el QR de una para confirmar su retiro."
          icono="documento"
        />
      } @else {
        @for (g of filas(); track g.id) {
          <frc-card
            [titulo]="titulo(g)"
            [subtitulo]="subtitulo(g)"
            icono="documento"
            (abrir)="abrir(g)"
          >
            <frc-importe
              aparte
              [valor]="g.montoSolicitado ?? 0"
              [moneda]="g.moneda?.denominacion ?? 'Guaraní'"
              [simbolo]="g.moneda?.simbolo ?? '₲'"
            />
            <!--
              La etiqueta y el tono los calcula el backend: si el central
              agrega un estado, esto lo muestra sin tocar el cliente.
            -->
            <frc-estado-chip
              pie
              [etiqueta]="g.estadoEtiqueta ?? g.estado ?? null"
              [tono]="tono(g)"
            />
          </frc-card>
        }

        @if (hayMas()) {
          <button matButton class="mas" [disabled]="cargandoMas()" (click)="cargarMas()">
            {{ cargandoMas() ? 'Cargando…' : 'Cargar más' }}
          </button>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class GastosListaPage {
  private readonly servicio = inject(GastosService);
  private readonly escaner = inject(EscanerService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  readonly filas = signal<PreGasto[]>([]);
  readonly cargando = signal(true);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);

  private pagina = 0;

  constructor() {
    this.cargar();
  }

  cargar(agregando = false): void {
    if (!agregando) {
      this.pagina = 0;
      this.cargando.set(true);
      this.filas.set([]);
    }
    this.error.set(null);

    this.servicio.filtrar({ page: this.pagina, size: TAMANO }).subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.filas.update((previas) => (agregando ? [...previas, ...contenido] : contenido));
        this.hayMas.set(page?.hasNext === true);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
        this.cargandoMas.set(false);
      },
    });
  }

  cargarMas(): void {
    this.pagina += 1;
    this.cargandoMas.set(true);
    this.cargar(true);
  }

  titulo(g: PreGasto): string {
    return g.descripcion || `Solicitud ${g.id}`;
  }

  subtitulo(g: PreGasto): string {
    const partes = [
      g.funcionario?.nombre,
      g.tipoGasto?.descripcion,
      g.sucursalCaja?.nombre,
      fechaLegible(g.creadoEn),
    ];
    return partes.filter(Boolean).join(' · ');
  }

  /**
   * Traduce el color del backend al vocabulario de tonos del chip.
   *
   * El backend manda nombres de color de Ionic (`success`, `warning`…); el
   * sistema de diseño habla de tonos semánticos. Es la única traducción, y
   * está acá para no repetirla en cada pantalla.
   */
  tono(g: PreGasto): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
    switch ((g.estadoColor ?? '').toLowerCase()) {
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
  }

  nueva(): void {
    void this.router.navigate(['/operaciones/gastos/nueva']);
  }

  abrir(g: PreGasto): void {
    if (g.id == null || g.sucursalId == null) {
      return;
    }
    void this.router.navigate(['/operaciones/gastos', g.id, g.sucursalId]);
  }

  /**
   * Escanea el QR de una solicitud y abre su detalle.
   *
   * El QR lleva el `qrToken`, que es lo que ata el retiro a esa solicitud
   * puntual. Interpretarlo es delicado —sus campos no caen donde el nombre
   * sugiere— y por eso vive en `interpretarQrRetiro`, con sus tests.
   */
  async escanear(): Promise<void> {
    const texto = await this.escaner.escanear({
      titulo: 'Escanear solicitud',
      ayuda: 'Apuntá al QR de la solicitud de gasto',
      formatos: FORMATOS_QR,
      etiquetaManual: 'Código de la solicitud',
    });
    if (!texto) {
      return;
    }

    const resultado = interpretarQrRetiro(texto);
    if (!resultado.ok || !resultado.datos) {
      this.notificacion.warn(resultado.mensaje ?? 'QR no reconocido.');
      return;
    }

    const { preGastoId, sucursalId, qrToken } = resultado.datos;
    void this.router.navigate(['/operaciones/gastos', preGastoId, sucursalId], {
      queryParams: { token: qrToken },
    });
  }
}
