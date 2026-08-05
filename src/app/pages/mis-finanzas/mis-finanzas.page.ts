import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from 'src/app/core/auth/auth.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_QR } from 'src/app/core/dispositivo/escaner.types';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Cliente } from 'src/app/domains/cliente/cliente.model';
import { TipoEntidad } from 'src/app/domains/enums/tipo-entidad.enum';
import type { PageInfo } from 'src/app/domains/page-info.model';
import { EstadoVentaCredito, VentaCredito } from 'src/app/domains/venta-credito/venta-credito.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { descodificarQr } from 'src/app/generic/utils/qrUtils';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { PaginacionComponent } from 'src/app/shared/paginacion/paginacion.component';
import { MisFinanzasService } from './mis-finanzas.service';
import { VentaDetalleData, VentaDetalleDialogComponent } from './venta-detalle-dialog.component';

type Filtro = 'abiertos' | 'todos';

const FILTROS: readonly { clave: Filtro; etiqueta: string; estado: EstadoVentaCredito | null }[] = [
  { clave: 'abiertos', etiqueta: 'Abiertos', estado: EstadoVentaCredito.ABIERTO },
  { clave: 'todos', etiqueta: 'Historial', estado: null },
];

/**
 * Compras a crédito por convenio del funcionario.
 *
 * A diferencia de las listas de «Mi trabajo», acá el backend sí devuelve una
 * `Page` de Spring con el total de elementos, así que la navegación es por
 * páginas numeradas y no por «Cargar más»: el usuario puede volver a la
 * página anterior sin recargar toda la lista.
 */
@Component({
  selector: 'frc-mis-finanzas',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    ImporteComponent,
    EstadoChipComponent,
    PaginacionComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatTabsModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Mis finanzas" [conVolver]="true">
      @if (!sinCliente()) {
        <div acciones>
          <button matButton="filled" class="ancho" [disabled]="autorizando()" (click)="confirmarPorQr()">
            Confirmar compra por QR
          </button>
        </div>
      }

      @if (cliente(); as c) {
        <frc-seccion titulo="Crédito" [panel]="true">
          <frc-dato etiqueta="Límite">
            <frc-importe [valor]="c.credito ?? 0" moneda="Guaraní" simbolo="₲" />
          </frc-dato>
          <frc-dato etiqueta="Utilizado">
            <frc-importe [valor]="utilizado()" moneda="Guaraní" simbolo="₲" />
          </frc-dato>
          <!--
            El disponible negativo ya sale en rojo: frc-importe colorea los
            negativos por su cuenta. No hace falta una clase acá.
          -->
          <frc-dato etiqueta="Disponible">
            <frc-importe [valor]="disponible()" moneda="Guaraní" simbolo="₲" />
          </frc-dato>
        </frc-seccion>
      }

      <mat-tab-group
        [selectedIndex]="indiceFiltro()"
        (selectedIndexChange)="cambiarFiltro($event)"
        animationDuration="120ms"
      >
        @for (f of filtros; track f.clave) {
          <mat-tab [label]="f.etiqueta" />
        }
      </mat-tab-group>

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (sinCliente()) {
        <frc-estado-vacio
          titulo="No tenés convenio"
          detalle="Tu persona no está registrada como cliente, así que no hay compras a crédito para mostrar."
          icono="dinero"
        />
      } @else if (convenios().length === 0) {
        <frc-estado-vacio
          [titulo]="filtroActivo() === 'abiertos' ? 'Sin convenios abiertos' : 'Sin convenios'"
          detalle="Las compras que hagas a crédito en la empresa aparecen acá."
          icono="dinero"
        />
      } @else {
        @for (convenio of convenios(); track convenio.id) {
          <frc-card
            [titulo]="'Venta ' + (convenio.venta?.id ?? convenio.id)"
            [subtitulo]="subtitulo(convenio)"
            icono="dinero"
          >
            <frc-importe
              aparte
              [valor]="convenio.valorTotal ?? 0"
              moneda="Guaraní"
              simbolo="₲"
            />

            <frc-estado-chip
              pie
              enumerado="EstadoVentaCredito"
              [valor]="convenio.estado ?? null"
            />

            @if (convenio.venta?.id) {
              <button pie matButton (click)="verDetalle(convenio)">Ver detalle</button>
            }
          </frc-card>
        }

        <frc-paginacion [pagina]="pagina()" [page]="page()" (cambiar)="irAPagina($event)" />
      }
    </frc-pagina>
  `,
  styles: `
    .ancho { width: 100%; }
  `,
})
export class MisFinanzasPage {
  private readonly finanzas = inject(MisFinanzasService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly escaner = inject(EscanerService);
  private readonly notificacion = inject(NotificacionService);

  readonly filtros = FILTROS;

  readonly cliente = signal<Cliente | null>(null);
  readonly convenios = signal<VentaCredito[]>([]);
  readonly page = signal<PageInfo<VentaCredito> | null>(null);
  readonly pagina = signal(0);
  readonly utilizado = signal(0);
  readonly filtroActivo = signal<Filtro>('abiertos');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  /** Distingue «no es cliente» de «es cliente sin convenios». */
  readonly sinCliente = signal(false);
  readonly autorizando = signal(false);

  readonly indiceFiltro = computed(() =>
    FILTROS.findIndex((f) => f.clave === this.filtroActivo()),
  );

  /**
   * Lo que le queda de crédito.
   *
   * Es una resta de dos números que **manda el backend** —el límite del
   * cliente y la suma de sus convenios abiertos—, no un cálculo de negocio:
   * la regla 6 del proyecto prohíbe recalcular montos, no restar dos totales
   * ya emitidos para mostrarlos juntos.
   */
  readonly disponible = computed(() => (this.cliente()?.credito ?? 0) - this.utilizado());

  constructor() {
    this.cargar();
  }

  cargar(): void {
    const personaId = this.auth.usuario()?.persona?.id;
    if (personaId == null) {
      this.error.set('No se pudo identificar a la persona en sesión.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.sinCliente.set(false);

    this.finanzas.clientePorPersona(personaId).subscribe({
      next: (cliente) => {
        this.cliente.set(cliente ?? null);
        if (cliente?.id == null) {
          this.sinCliente.set(true);
          this.cargando.set(false);
          return;
        }
        this.cargarUtilizado(cliente.id);
        this.cargarPagina(0);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * El total utilizado no bloquea la lista.
   *
   * Son dos consultas independientes: si la suma falla, la lista de
   * convenios igual se muestra. Al revés sería peor — dejar la pantalla en
   * error por no poder pintar una línea del resumen.
   */
  private cargarUtilizado(clienteId: number): void {
    this.finanzas.conveniosAbiertos(clienteId).subscribe({
      next: (abiertos) => {
        this.utilizado.set((abiertos ?? []).reduce((suma, c) => suma + (c.valorTotal ?? 0), 0));
      },
      error: () => this.utilizado.set(0),
    });
  }

  private cargarPagina(pagina: number): void {
    const clienteId = this.cliente()?.id;
    if (clienteId == null) {
      return;
    }

    const estado = FILTROS[this.indiceFiltro()].estado;
    this.cargando.set(true);
    this.error.set(null);

    this.finanzas.conveniosPagina(clienteId, estado, pagina).subscribe({
      next: (page) => {
        this.page.set(page ?? null);
        this.convenios.set(page?.getContent ?? []);
        this.pagina.set(pagina);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  cambiarFiltro(indice: number): void {
    const filtro = FILTROS[indice];
    if (!filtro || filtro.clave === this.filtroActivo()) {
      return;
    }
    this.filtroActivo.set(filtro.clave);
    // Vuelve a la primera página: la 3 del filtro anterior puede no existir
    // en el nuevo.
    this.cargarPagina(0);
  }

  irAPagina(destino: number): void {
    this.cargarPagina(destino);
  }

  subtitulo(convenio: VentaCredito): string {
    const partes = [convenio.sucursal?.nombre, fechaLegible(convenio.creadoEn)].filter(Boolean);
    return partes.join(' · ');
  }

  /**
   * Autoriza una compra a crédito escaneando el QR que muestra la caja.
   *
   * El QR lo genera el desktop al armar el convenio y lleva la persona del
   * cliente, la sucursal, una clave de un solo uso y el momento en que se
   * creó. El central publica la autorización por suscripción y el desktop,
   * que está esperando, cierra la venta.
   *
   * ⚠️ En `frc-mobile` el resultado terminaba en un `console.log`: el
   * empleado escaneaba y la pantalla no decía nada, ni al salir bien ni al
   * salir mal. Y no se validaba nada del contenido, así que escanear el QR
   * de otra persona —o el código de barras de un producto— disparaba igual
   * una llamada al servidor que no podía prosperar.
   */
  async confirmarPorQr(): Promise<void> {
    const personaId = this.auth.usuario()?.persona?.id;
    if (personaId == null) {
      this.notificacion.danger('No se pudo identificar a la persona en sesión.');
      return;
    }

    const texto = await this.escaner.escanear({
      titulo: 'Confirmar compra',
      ayuda: 'Apuntá al QR que muestra la caja',
      // Solo QR: con los formatos de producto habilitados, la cámara podría
      // leer el código de barras de lo que está sobre el mostrador.
      formatos: FORMATOS_QR,
      etiquetaManual: 'Código del convenio',
    });
    if (!texto) {
      return;
    }

    const datos = descodificarQr(texto);
    if (!datos) {
      this.notificacion.warn('Ese código no es de esta aplicación.');
      return;
    }
    if (datos.tipoEntidad !== TipoEntidad.VENTA_CREDITO) {
      this.notificacion.warn('Ese QR no corresponde a una compra a crédito.');
      return;
    }
    if (String(datos.idOrigen) !== String(personaId)) {
      this.notificacion.warn('Ese QR fue generado para otra persona.');
      return;
    }

    const sucursalId = Number(datos.sucursalId);
    if (!Number.isFinite(sucursalId)) {
      this.notificacion.warn('El QR no trae la sucursal.');
      return;
    }

    this.autorizando.set(true);
    this.finanzas
      .autorizarPorQr(personaId, datos.timestamp ?? '', sucursalId, datos.data ?? '')
      .subscribe({
        next: (ok) => {
          this.autorizando.set(false);
          if (ok) {
            this.notificacion.ok('Compra confirmada. Ya podés retirar en la caja.');
            this.cargar();
          } else {
            // El central devuelve false con un QR vencido o ya usado.
            this.notificacion.warn('El código no es válido o ya venció. Pedí uno nuevo en la caja.');
          }
        },
        error: (err: Error) => {
          this.autorizando.set(false);
          this.notificacion.danger(err.message);
        },
      });
  }

  async verDetalle(convenio: VentaCredito): Promise<void> {
    const ventaId = convenio.venta?.id;
    // La sucursal sale de la venta y, si no vino, del convenio: sin ella el
    // central busca en su propia base y no encuentra la venta.
    const sucursalId = convenio.venta?.sucursalId ?? convenio.sucursal?.id;
    if (ventaId == null || sucursalId == null) {
      return;
    }
    await this.dialogo.abrir<VentaDetalleDialogComponent, VentaDetalleData>(
      VentaDetalleDialogComponent,
      { ventaId, sucursalId },
    );
  }
}
