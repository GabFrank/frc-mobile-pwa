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

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  Inventario,
  InventarioEstado,
  InventarioProducto,
} from 'src/app/domains/inventario/inventario.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { TipoEntidad } from 'src/app/domains/enums/tipo-entidad.enum';
import { codificarQr } from 'src/app/generic/utils/qrUtils';
import { DatosQr, QrDialogComponent } from 'src/app/shared/qr/qr-dialog.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { antiguedadEnDias, hayZonaSinConcluir, zonasDisponibles } from './inventario-alta';
import { productosConcluidos, resumirInventario, resumirItems } from './inventario-conteo';
import { DatosZona, ResultadoZona, ZonaDialogComponent } from './zona-dialog.component';
import { SectorService } from 'src/app/domains/sector/sector.service';
import { InventarioService } from './inventario.service';

/**
 * Cómo va la toma y qué diferencias arroja.
 *
 * ⚠️ **La diferencia es el resultado del inventario**, no un error a
 * corregir: es lo contado menos lo que dice el sistema. Por eso se muestra
 * por zona y en total.
 *
 * ⚠️ **Cada renglón de `inventarioProductoList` es una zona, no un
 * producto.** El central le sacó `producto_id` a esa tabla; el producto vive
 * en cada ítem, colgando de `presentacion`.
 */
@Component({
  selector: 'frc-inventario-detalle',
  standalone: true,
  imports: [
    IconoComponent,
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Inventario" [conVolver]="true">
      <button accionBarra type="button" class="icono-compartir" aria-label="Compartir por QR" (click)="compartir()">
        <frc-icono nombre="codigo" [tamano]="22" />
      </button>
      @if (inventario()) {
        <div acciones>
          <!--
            Revisar sigue disponible con el inventario cerrado: es la lectura
            de lo que quedó, y esa pregunta no caduca al finalizarlo.
          -->
          <button matButton (click)="revisar()">Revisar</button>
          @if (abierto()) {
            <button matButton [disabled]="operando()" (click)="agregarZona()">Agregar zona</button>
          }
          @if (puedeFinalizar()) {
            <button matButton [disabled]="operando()" (click)="cancelar()">Cancelar toma</button>
          }
          @if (puedeFinalizar()) {
            <button matButton="filled" [disabled]="operando()" (click)="finalizar()">
              {{ operando() ? 'Finalizando…' : 'Finalizar inventario' }}
            </button>
          }
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (inventario(); as inv) {
        <frc-seccion titulo="Inventario" [panel]="true">
          <frc-dato etiqueta="Estado">
            <frc-estado-chip enumerado="InventarioEstado" [valor]="inv.estado ?? null" />
          </frc-dato>
          <frc-dato etiqueta="Sucursal" [valor]="inv.sucursal?.nombre ?? '—'" />
          <frc-dato etiqueta="Tipo" [valor]="inv.tipo ?? '—'" />
          <frc-dato etiqueta="Inicio" [valor]="fecha(inv.fechaInicio)" />
          @if (inv.fechaFin) {
            <frc-dato etiqueta="Fin" [valor]="fecha(inv.fechaFin)" />
          }
          @if (inv.observacion) {
            <frc-dato etiqueta="Observación" [valor]="inv.observacion" />
          }
        </frc-seccion>

        <frc-seccion titulo="Conteo" [panel]="true">
          <frc-dato etiqueta="Zonas" [valor]="productos().length" />
          <frc-dato etiqueta="Concluidas" [valor]="concluidos()" />
          <frc-dato etiqueta="Ítems contados" [valor]="resumen().contados" />
          <frc-dato etiqueta="Revisados" [valor]="resumen().revisados" />
          <frc-dato etiqueta="Con diferencia" [valor]="resumen().conDiferencia" />
          <frc-dato etiqueta="Diferencia total" [valor]="diferenciaTotal()" />
        </frc-seccion>

        @if (productos().length === 0) {
          <frc-estado-vacio
            titulo="Sin zonas"
            [detalle]="
              abierto()
                ? 'Una toma se cuenta zona por zona. Agregá la primera para empezar.'
                : 'Esta toma se cerró sin ninguna zona cargada.'
            "
            icono="inventario"
          />
        } @else {
          <frc-seccion [titulo]="'Zonas (' + productos().length + ')'">
            @for (p of productos(); track p.id) {
              <frc-card
                [titulo]="zonaDe(p)"
                [subtitulo]="sectorDe(p)"
                icono="inventario"
              >
                <span aparte class="dif" [class.negativa]="diferenciaDe(p) < 0">
                  {{ diferenciaLegible(p) }}
                </span>
                <span pie class="conteo">{{ conteoDe(p) }}</span>
                @if (p.concluido) {
                  <span pie class="concluido">Concluido</span>
                }
                <!--
                  Un bloque por botón, y no uno solo con los dos adentro: un
                  control de flujo con más de un nodo raíz no proyecta al
                  slot (NG8011) y los botones caen fuera del pie de la card.
                  Sale como aviso, no como error, así que el build pasa igual.
                -->
                @if (abierto()) {
                  <button pie matButton (click)="contar(p)">Contar</button>
                }
                @if (abierto() && p.concluido) {
                  <button pie matButton [disabled]="operando()" (click)="marcarZona(p, false)">
                    Reabrir
                  </button>
                }
                @if (abierto() && !p.concluido) {
                  <button pie matButton [disabled]="operando()" (click)="marcarZona(p, true)">
                    Concluir
                  </button>
                }
              </frc-card>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .dif {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .dif.negativa { color: var(--danger); }
    .conteo, .concluido {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .concluido { color: var(--ok); }
  `,
})
export class InventarioDetallePage {
  private readonly router = inject(Router);
  private readonly servicio = inject(InventarioService);
  private readonly sectores = inject(SectorService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly id = input<string>();

  readonly inventario = signal<Inventario | null>(null);
  readonly cargando = signal(true);
  readonly operando = signal(false);
  readonly error = signal<string | null>(null);

  readonly productos = computed(() => this.inventario()?.inventarioProductoList ?? []);
  readonly resumen = computed(() => resumirInventario(this.productos()));
  readonly concluidos = computed(() => productosConcluidos(this.productos()));
  // `estado` y no `abierto`: son redundantes y nada garantiza que coincidan.
  readonly puedeFinalizar = computed(
    () => this.inventario()?.estado === InventarioEstado.ABIERTO,
  );
  readonly diferenciaTotal = computed(() => this.conSigno(this.resumen().diferencia));

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id)) {
      this.error.set('Identificador de inventario inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (inv) => {
        this.inventario.set(inv ?? null);
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

  // Zona y sector se llaman `descripcion`, no `nombre`.
  zonaDe(p: InventarioProducto): string {
    return p.zona?.descripcion || 'Sin zona';
  }

  sectorDe(p: InventarioProducto): string {
    return p.zona?.sector?.descripcion || 'Sin sector';
  }

  diferenciaDe(p: InventarioProducto): number {
    return resumirItems(p.inventarioProductoItemList ?? []).diferencia;
  }

  diferenciaLegible(p: InventarioProducto): string {
    return this.conSigno(this.diferenciaDe(p));
  }

  conteoDe(p: InventarioProducto): string {
    const items = p.inventarioProductoItemList ?? [];
    const r = resumirItems(items);
    return `${r.contados} de ${items.length} contados`;
  }

  /** El signo importa: `+` es sobrante y `−` faltante. */
  private conSigno(valor: number): string {
    if (valor === 0) {
      return '0';
    }
    const texto = formatearCantidad(Math.abs(valor), Number.isInteger(valor) ? 0 : 2);
    return valor > 0 ? `+${texto}` : `−${texto}`;
  }

  async finalizar(): Promise<void> {
    const inv = this.inventario();
    if (inv?.id == null) {
      return;
    }
    const r = this.resumen();
    // Finalizar no es cerrar: el central crea movimientos de ajuste que
    // llevan el stock **de hoy** al conteo de esta toma. En una toma vieja
    // eso es un descuadre, no un cierre, así que la confirmación lo dice y
    // pasa a ser destructiva.
    const dias = antiguedadEnDias(this.inventario()?.fechaInicio, new Date());
    const vieja = dias != null && dias >= 180;
    const ok = await this.dialogo.confirmar({
      titulo: 'Finalizar inventario',
      mensaje: vieja
        ? `Esta toma lleva ${dias} días abierta. Finalizarla ajusta el stock de HOY con lo que se contó entonces. Si nadie la va a terminar, lo correcto es cancelarla.`
        : `Se aplican las diferencias al stock. Hay ${r.conDiferencia} ítems con diferencia y ${this.diferenciaTotal()} de diferencia total.`,
      confirmar: 'Finalizar',
      destructivo: vieja,
    });
    if (!ok) {
      return;
    }

    this.operando.set(true);
    this.servicio.finalizar(inv.id).subscribe({
      next: () => {
        this.operando.set(false);
        this.notificacion.ok('Inventario finalizado.');
        this.cargar();
      },
      error: (err: Error) => {
        this.operando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * Solo un inventario abierto se puede contar.
   *
   * Concluido o cancelado, el conteo ya es un hecho histórico: escribir
   * encima cambiaría el resultado de una toma cerrada.
   */
  readonly abierto = computed(
    () => String(this.inventario()?.estado ?? '').toUpperCase() === 'ABIERTO',
  );

  /**
   * Cancelar la toma.
   *
   * ⚠️ **No es finalizar.** Cancelar pone `CANCELADO` y **desactiva** los
   * ajustes que la toma hubiera generado; finalizar **crea** ajustes contra
   * el stock de hoy. Para una toma que nadie va a terminar, cancelar es la
   * salida correcta — y hasta ahora la pantalla no la ofrecía, aunque el
   * servicio la tuviera.
   */
  async cancelar(): Promise<void> {
    const inv = this.inventario();
    if (inv?.id == null) {
      return;
    }
    const ok = await this.dialogo.confirmar({
      titulo: 'Cancelar inventario',
      mensaje: 'La toma queda cancelada y deja de bloquear la sucursal. El stock no se toca: lo contado acá no se aplica.',
      confirmar: 'Cancelar la toma',
      destructivo: true,
    });
    if (!ok) {
      return;
    }

    this.operando.set(true);
    this.servicio.cancelar(inv.id).subscribe({
      next: () => {
        this.operando.set(false);
        this.notificacion.ok('Inventario cancelado.');
        this.cargar();
      },
      error: (err: Error) => {
        this.operando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * Sumar una zona a la toma.
   *
   * Los sectores se piden en el momento y no al cargar la pantalla: es una
   * consulta que solo necesita quien va a agregar, y la mayoría entra acá a
   * mirar cómo va el conteo.
   */
  async agregarZona(): Promise<void> {
    const inv = this.inventario();
    const sucursalId = Number(inv?.sucursal?.id);
    if (inv?.id == null || !Number.isFinite(sucursalId) || sucursalId <= 0) {
      this.notificacion.warn('La toma no tiene sucursal: no se puede saber qué zonas ofrecer.');
      return;
    }

    this.operando.set(true);
    this.sectores.deSucursal(sucursalId).subscribe({
      next: async (sectores) => {
        this.operando.set(false);
        const disponibles = zonasDisponibles(sectores ?? [], this.productos());

        const res = await this.dialogo.abrir<ZonaDialogComponent, DatosZona, ResultadoZona>(
          ZonaDialogComponent,
          { disponibles, contexto: inv.sucursal?.nombre },
        );
        if (res?.zonaId == null) {
          return;
        }

        this.operando.set(true);
        this.servicio.guardarZona({ inventarioId: inv.id, zonaId: res.zonaId, concluido: false }).subscribe({
          next: () => {
            this.operando.set(false);
            this.cargar();
          },
          error: (err: Error) => {
            this.operando.set(false);
            this.notificacion.danger(err.message);
          },
        });
      },
      error: (err: Error) => {
        this.operando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * Concluir una zona, o volver a abrirla.
   *
   * ⚠️ **Una sola zona abierta a la vez.** Es la regla de `frc-mobile`
   * (`verificarAbiertos`): con dos zonas en curso, quien cuenta pierde de
   * vista en cuál está y los conteos se mezclan. Por eso reabrir exige que
   * las demás estén concluidas.
   */
  async marcarZona(p: InventarioProducto, concluido: boolean): Promise<void> {
    const inv = this.inventario();
    if (inv?.id == null || p.id == null) {
      return;
    }

    const otras = this.productos().filter((z) => z.id !== p.id);
    if (!concluido && hayZonaSinConcluir(otras)) {
      this.notificacion.warn(
        'Ya tenés otra zona abierta. Concluila antes de reabrir esta.',
      );
      return;
    }

    const zona = this.zonaDe(p);
    const ok = await this.dialogo.confirmar({
      titulo: concluido ? 'Concluir zona' : 'Reabrir zona',
      mensaje: concluido
        ? `Se marca ${zona} como contada. Vas a poder reabrirla si hace falta.`
        : `Se vuelve a abrir ${zona} para seguir contándola.`,
      confirmar: concluido ? 'Concluir' : 'Reabrir',
    });
    if (!ok) {
      return;
    }

    this.operando.set(true);
    // Va el `id` del renglón: la misma mutation da de alta sin él y
    // actualiza con él.
    this.servicio
      .guardarZona({ id: p.id, inventarioId: inv.id, zonaId: p.zona?.id, concluido })
      .subscribe({
        next: () => {
          this.operando.set(false);
          this.cargar();
        },
        error: (err: Error) => {
          this.operando.set(false);
          this.notificacion.danger(err.message);
        },
      });
  }

  revisar(): void {
    const id = this.inventario()?.id;
    if (id != null) {
      void this.router.navigate(['/inventario', id, 'revisar']);
    }
  }

  contar(p: { id?: number }): void {
    const invId = this.inventario()?.id;
    if (invId == null || p.id == null) {
      return;
    }
    void this.router.navigate(['/inventario', invId, 'producto', p.id]);
  }

  /**
   * Muestra un QR para que otro lo abra escaneándolo.
   *
   * ⚠️ **El id no va en el mismo campo para todos los tipos.** Acá se
   * escriben los que `rutearEscaneo` lee para `INVENTARIO`; la tabla
   * completa está en `docs/arquitectura/qr-del-sistema.md`. Poner el id en
   * el campo equivocado da un QR que se escanea sin error y abre otra cosa.
   */
  async compartir(): Promise<void> {
    const id = this.inventario()?.id;
    if (id == null) {
      return;
    }
    const sucursalId = (this.inventario() as { sucursal?: { id?: number } })?.sucursal?.id;
    await this.dialogo.abrir<QrDialogComponent, DatosQr>(QrDialogComponent, {
      titulo: 'Compartir inventario',
      subtitulo: 'Inventario #' + id,
      codigo: codificarQr({ tipoEntidad: TipoEntidad.INVENTARIO, idCentral: String(id), sucursalId: String(sucursalId ?? '') }),
    });
  }
}
