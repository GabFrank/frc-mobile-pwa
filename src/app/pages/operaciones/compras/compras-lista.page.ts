import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import type { CompraPedidoResumen } from 'src/app/domains/compras/compras.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { ComprasService } from './compras.service';
import { EscanearFacturaService } from './escanear-factura.service';

const TAMANO = 20;

/**
 * Pedidos que esperan la factura del proveedor: los que tienen la etapa de
 * notas («Recepción documental» en el desktop) pendiente o en proceso.
 *
 * Es la misma lista que la pestaña 3 de Gestión de compras, pero acá se entra
 * para escanear el KuDE. El botón «Escanear factura» no necesita elegir el
 * pedido antes: el CDC dice de qué proveedor es, y si ese proveedor tiene un
 * solo pedido esperando, va directo.
 */
@Component({
  selector: 'frc-compras-lista',
  standalone: true,
  imports: [
    PaginaComponent,
    CardComponent,
    EstadoChipComponent,
    ImporteComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Compras" [conVolver]="true">
      <div acciones>
        <button matButton="filled" (click)="escanear()">Escanear factura</button>
      </div>

      <mat-form-field appearance="outline" class="buscar">
        <mat-label>Proveedor, RUC o número de pedido</mat-label>
        <input
          matInput
          type="search"
          [ngModel]="texto()"
          (ngModelChange)="texto.set($event ?? '')"
          (keydown.enter)="cargar()"
        />
      </mat-form-field>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (filas().length === 0) {
        <frc-estado-vacio
          [titulo]="buscado() ? 'Sin resultados' : 'Ningún pedido espera factura'"
          [detalle]="
            buscado()
              ? 'Ningún pedido esperando factura coincide con «' + buscado() + '».'
              : 'Los pedidos aparecen acá cuando terminan la planificación en el sistema de escritorio.'
          "
          icono="documento"
        />
      } @else {
        @for (p of filas(); track p.pedidoId) {
          <frc-card
            [titulo]="p.proveedorNombre ?? 'Sin proveedor'"
            [subtitulo]="subtitulo(p)"
            icono="documento"
            (abrir)="abrir(p)"
          >
            <frc-estado-chip
              pie
              [etiqueta]="p.estadoEtapa === 'EN_PROCESO' ? 'Con facturas cargadas' : 'Esperando factura'"
              [tono]="p.estadoEtapa === 'EN_PROCESO' ? 'info' : 'warn'"
            />
            <frc-importe
              aparte
              [valor]="p.totalPedido ?? null"
              [simbolo]="p.monedaSimbolo ?? null"
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
    .buscar { width: 100%; }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class ComprasListaPage {
  private readonly servicio = inject(ComprasService);
  private readonly escaneo = inject(EscanearFacturaService);
  private readonly router = inject(Router);

  readonly texto = signal('');
  /** El texto con el que se hizo la última búsqueda: decide qué dice el vacío. */
  readonly buscado = signal('');
  readonly filas = signal<CompraPedidoResumen[]>([]);
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
    const texto = this.texto().trim();

    this.servicio.pedidos(texto, this.pagina, TAMANO).subscribe({
      next: (page) => {
        const contenido = page?.getContent ?? [];
        this.filas.update((previas) => (agregando ? [...previas, ...contenido] : contenido));
        this.hayMas.set(page?.hasNext === true);
        this.buscado.set(texto);
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

  subtitulo(p: CompraPedidoResumen): string {
    const pendientes = p.itemsPendientes ?? 0;
    const notas = p.cantidadNotas ?? 0;
    return [
      'Pedido ' + p.pedidoId,
      fechaLegible(p.fecha, { conHora: false }),
      pendientes === 0
        ? 'todo facturado'
        : pendientes === 1
          ? '1 ítem sin facturar'
          : pendientes + ' ítems sin facturar',
      notas === 0 ? null : notas === 1 ? '1 factura' : notas + ' facturas',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  abrir(p: CompraPedidoResumen): void {
    void this.router.navigate(['/operaciones/compras', p.pedidoId]);
  }

  async escanear(): Promise<void> {
    await this.escaneo.escanearSinPedido();
  }
}
