import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from 'src/app/core/auth/auth.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import {
  esSucursalOperableId,
  soloOperables,
} from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { EstadoDevolucion, TipoDevolucion } from 'src/app/domains/devolucion/devolucion.enums';
import {
  DevolucionInput,
  DevolucionItemDraft,
  MotivoAveria,
} from 'src/app/domains/devolucion/devolucion.model';
import { Proveedor, nombreProveedor } from 'src/app/domains/personas/proveedor.model';
import { CardComponent } from 'src/app/shared/card/card.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import {
  OpcionSeleccion,
  SelectorComponent,
} from 'src/app/shared/selector/selector.component';
import { BuscadorProductoDialogComponent } from 'src/app/shared/producto/buscador-producto-dialog.component';
import { SeleccionProducto } from 'src/app/shared/producto/buscador.types';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import {
  DevolucionItemData,
  DevolucionItemDialogComponent,
} from './devolucion-item-dialog.component';
import { destinoParaInput, faltaParaGuardar, itemParaInput } from './devolucion-nueva.reglas';
import { DevolucionService } from './devolucion.service';

/**
 * Carga de una devolución: se agregan productos y se guarda.
 *
 * ⚠️ **Nace en `PENDIENTE`.** Es el primer estado de la máquina: cargada pero
 * todavía en góndola. Separarla —imprimir la etiqueta y apartarla
 * físicamente— es un paso aparte que se hace desde el detalle.
 *
 * ⚠️ **La sucursal de origen se elige.** La app está **siempre conectada al
 * central**: no existe «entrar a una sucursal». La que trae la sesión sale de
 * `inicioSesion.sucursal` del usuario y sirve como valor por defecto, pero
 * quien carga puede estar cubriendo otra. Es el diseño de `frc-mobile`
 * (`devolucion.component.ts:74`) y se conserva.
 *
 * ⚠️ **Solo se ofrecen sucursales con depósito.** Una sin depósito es
 * virtual: no mueve stock, así que no puede ser el origen de una devolución.
 * Ver `sucursal.util.ts`.
 *
 * ⚠️ **A quién va se elige, y no tiene valor por defecto.** Con proveedor
 * puede terminar canjeada o acreditada; sin proveedor solo descartada, que es
 * pérdida de la empresa. El central no exige el proveedor al guardar —recién
 * falla al retirar—, así que lo exige esta pantalla. Ver
 * `devolucion-nueva.reglas.ts`.
 */
@Component({
  selector: 'frc-devolucion-nueva',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoVacioComponent,
    SelectorComponent,
    IconoComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Nueva devolución" [conVolver]="true" [conEscaner]="false" (atras)="salir()">
      <div acciones>
        <button matButton (click)="agregar()">Agregar producto</button>
        <button matButton="filled" [disabled]="!puedeGuardar()" (click)="guardar()">
          {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>

      <frc-seccion titulo="Devolución" [panel]="true">
        <frc-selector
          etiqueta="Sucursal de origen"
          [opciones]="opcionesSucursal()"
          [valor]="sucursalId()"
          (valorChange)="sucursalId.set($event)"
        />
        <frc-selector
          etiqueta="A quién va"
          [opciones]="opcionesTipo"
          [valor]="tipo()"
          (valorChange)="elegirTipo($event)"
        />
        @if (tipo() === conProveedor) {
          @if (proveedor(); as p) {
            <p class="elegido">
              <frc-icono nombre="camion" [tamano]="18" />
              {{ nombre(p) }}
              <button type="button" class="cambiar" (click)="cambiarProveedor()">Cambiar</button>
            </p>
          } @else {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
              <mat-label>Buscar proveedor</mat-label>
              <input
                matInput
                [ngModel]="textoProveedor()"
                (ngModelChange)="textoProveedor.set($event)"
                (keyup.enter)="buscarProveedores()"
              />
            </mat-form-field>
            <button matButton="tonal" [disabled]="buscandoProveedor()" (click)="buscarProveedores()">
              {{ buscandoProveedor() ? 'Buscando…' : 'Buscar' }}
            </button>

            @for (p of proveedores(); track p.id) {
              <frc-card [titulo]="nombre(p)" icono="persona" (abrir)="elegirProveedor(p)" />
            }
          }
        }
        @if (falta(); as mensaje) {
          <p class="ayuda">{{ mensaje }}</p>
        }
        <frc-dato etiqueta="Productos" [valor]="items().length" />
        <frc-dato etiqueta="Unidades" [valor]="totalUnidades()" />
      </frc-seccion>

      @if (items().length === 0) {
        <frc-estado-vacio
          titulo="Sin productos"
          detalle="Agregá los productos averiados o vencidos que vas a devolver."
          icono="tirar"
          accion="Agregar producto"
          (ejecutar)="agregar()"
        />
      } @else {
        @for (item of items(); track $index) {
          <frc-card
            [titulo]="item.producto.descripcion ?? 'Producto'"
            [subtitulo]="detalleDe(item)"
            icono="producto"
            (abrir)="editar($index)"
          >
            <span aparte class="cantidad">{{ cantidadDe(item) }}</span>
            <span pie class="motivo">{{ item.motivoAveria?.descripcion }}</span>
            <button pie matButton (click)="quitar($index, $event)">Quitar</button>
          </frc-card>
        }
      }
    </frc-pagina>
  `,
  styles: `
    .cantidad {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-medium);
    }
    .motivo {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .campo { width: 100%; }
    .elegido {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      font-weight: var(--fw-medium);
      margin: 0;
    }
    .cambiar {
      background: none;
      border: 0;
      color: var(--brand-text);
      font-size: var(--fs-caption);
      cursor: pointer;
      padding: var(--sp-1);
    }
    .ayuda { color: var(--text-mute); font-size: var(--fs-caption); margin: 0; }
  `,
})
export class DevolucionNuevaPage {
  private readonly servicio = inject(DevolucionService);
  private readonly auth = inject(AuthService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);
  private readonly sucursalesService = inject(SucursalService);

  readonly items = signal<DevolucionItemDraft[]>([]);
  readonly guardando = signal(false);
  private readonly motivos = signal<MotivoAveria[]>([]);

  /** Locales disponibles, sin SERVIDOR ni COMPRAS. */
  readonly sucursales = signal<Sucursal[]>([]);
  readonly sucursalId = signal<unknown>(null);
  readonly opcionesSucursal = computed<OpcionSeleccion[]>(() =>
    this.sucursales().map((s) => ({ valor: s.id, texto: String(s.nombre ?? `Sucursal ${s.id}`) })),
  );
  readonly totalUnidades = computed(() =>
    formatearCantidad(
      this.items().reduce((suma, i) => suma + (i.cantidad ?? 0), 0),
      0,
    ),
  );
  /** `null` hasta que alguien lo elige: no se asume «sin proveedor». */
  readonly tipo = signal<TipoDevolucion | null>(null);
  readonly conProveedor = TipoDevolucion.CON_PROVEEDOR;
  readonly opcionesTipo: OpcionSeleccion[] = [
    { valor: TipoDevolucion.CON_PROVEEDOR, texto: 'Con proveedor', detalle: 'canje o crédito' },
    { valor: TipoDevolucion.SIN_PROVEEDOR, texto: 'Sin proveedor', detalle: 'se descarta' },
  ];
  readonly proveedor = signal<Proveedor | null>(null);
  readonly proveedores = signal<Proveedor[]>([]);
  readonly textoProveedor = signal('');
  readonly buscandoProveedor = signal(false);

  /** Lo que falta para guardar, dicho al operador; `null` si está todo. */
  readonly falta = computed(() =>
    faltaParaGuardar({
      sucursalOperable: esSucursalOperableId(this.sucursalId(), this.sucursales()),
      tipo: this.tipo(),
      proveedorId: this.proveedor()?.id ?? null,
      cantidadItems: this.items().length,
    }),
  );
  readonly puedeGuardar = computed(() => this.falta() == null && !this.guardando());

  constructor() {
    this.sucursalesService.todas().subscribe({
      next: (todas) => {
        const locales = soloOperables(todas ?? []);
        this.sucursales.set(locales);
        // La de la sesión como valor por defecto, si es un local. Si no
        // —caso SERVIDOR—, la primera, igual que `frc-mobile`.
        const deLaSesion = this.auth.sucursal()?.id;
        const preferida = locales.find((s: Sucursal) => String(s.id) === String(deLaSesion));
        this.sucursalId.set(preferida?.id ?? locales[0]?.id ?? null);
      },
      error: () => this.notificacion.warn('No se pudieron cargar las sucursales.'),
    });

    this.servicio.motivos().subscribe({
      next: (lista) => this.motivos.set(lista),
      error: () => this.notificacion.warn('No se pudieron cargar los motivos de avería.'),
    });
  }

  nombre(p: Proveedor): string {
    return nombreProveedor(p);
  }

  /**
   * ⚠️ **Pasar a «Sin proveedor» descarta el proveedor elegido** y lo que
   * quedó de la búsqueda: si después se vuelve a «Con proveedor», se elige de
   * nuevo en vez de heredar uno que ya no se ve.
   */
  elegirTipo(valor: unknown): void {
    const tipo =
      valor === TipoDevolucion.CON_PROVEEDOR || valor === TipoDevolucion.SIN_PROVEEDOR
        ? valor
        : null;
    this.tipo.set(tipo);
    if (tipo !== TipoDevolucion.CON_PROVEEDOR) {
      this.cambiarProveedor();
    }
  }

  buscarProveedores(): void {
    const texto = this.textoProveedor().trim();
    if (texto.length === 0 || this.buscandoProveedor()) {
      return;
    }
    this.buscandoProveedor.set(true);
    this.servicio.proveedores(texto).subscribe({
      next: (page) => {
        this.buscandoProveedor.set(false);
        const contenido = page?.getContent ?? [];
        this.proveedores.set(contenido);
        if (contenido.length === 0) {
          this.notificacion.warn('Ningún proveedor con ese nombre.');
        }
      },
      // El aviso del error ya lo da `DatosService`. «No pude preguntar» no es
      // «no hay»: la lista no se vacía como si no existieran.
      error: () => this.buscandoProveedor.set(false),
    });
  }

  elegirProveedor(p: Proveedor): void {
    this.proveedor.set(p);
    this.proveedores.set([]);
    this.textoProveedor.set('');
  }

  cambiarProveedor(): void {
    this.proveedor.set(null);
    this.proveedores.set([]);
    this.textoProveedor.set('');
  }

  /** La sucursal de origen como número, o `undefined` si todavía no hay una. */
  private sucursalElegida(): number | undefined {
    const id = this.sucursalId();
    // `Number('')` y `Number(null)` dan 0: sin este guard se consultaría la sucursal cero.
    if (id == null || id === '') {
      return undefined;
    }
    const numero = Number(id);
    return Number.isFinite(numero) ? numero : undefined;
  }

  detalleDe(item: DevolucionItemDraft): string {
    const partes = [etiquetaPresentacion(item.presentacion), item.lote ? `Lote ${item.lote}` : ''];
    return partes.filter(Boolean).join(' · ');
  }

  cantidadDe(item: DevolucionItemDraft): string {
    return formatearCantidad(item.cantidad, Number.isInteger(item.cantidad) ? 0 : 3);
  }

  /**
   * Elegir producto y después cargar sus datos.
   *
   * ⚠️ **La sucursal va al buscador** para que muestre el stock de donde se
   * está devolviendo: ver que quedan 2 unidades mientras se cargan 3 es la
   * señal de que algo está mal antes de guardar.
   */
  async agregar(): Promise<void> {
    if (this.motivos().length === 0) {
      this.notificacion.warn('No hay motivos de avería configurados.');
      return;
    }

    const seleccion = await this.dialogo.abrir<
      BuscadorProductoDialogComponent,
      { titulo: string; opciones: Record<string, unknown> },
      SeleccionProducto | undefined
    >(
      BuscadorProductoDialogComponent,
      {
        titulo: 'Producto a devolver',
        opciones: {
          devuelve: 'presentacion',
          // El stock que importa es el de la sucursal que se está cargando.
          sucursalId: this.sucursalId(),
        },
      },
      '95vw',
    );

    if (!seleccion?.presentacion) {
      return;
    }

    const draft = await this.dialogo.abrir<
      DevolucionItemDialogComponent,
      DevolucionItemData,
      DevolucionItemDraft | undefined
    >(DevolucionItemDialogComponent, {
      producto: seleccion.producto,
      presentacion: seleccion.presentacion,
      motivos: this.motivos(),
      // Un pesable ya trae los kilos en el código: no se vuelven a pedir.
      cantidadInicial: seleccion.peso,
      sucursalId: this.sucursalElegida(),
    });

    if (draft) {
      this.items.update((previos) => [...previos, draft]);
    }
  }

  async editar(indice: number): Promise<void> {
    const actual = this.items()[indice];
    if (!actual) {
      return;
    }
    const draft = await this.dialogo.abrir<
      DevolucionItemDialogComponent,
      DevolucionItemData,
      DevolucionItemDraft | undefined
    >(DevolucionItemDialogComponent, {
      producto: actual.producto,
      presentacion: actual.presentacion,
      motivos: this.motivos(),
      draft: actual,
      sucursalId: this.sucursalElegida(),
    });
    if (draft) {
      this.items.update((previos) => previos.map((i, n) => (n === indice ? draft : i)));
    }
  }

  quitar(indice: number, evento: Event): void {
    // La card entera abre la edición: sin esto, quitar también editaría.
    evento.stopPropagation();
    this.items.update((previos) => previos.filter((_, n) => n !== indice));
  }

  guardar(): void {
    const usuarioId = this.auth.usuario()?.id;
    const sucursalId = this.sucursalId();
    if (usuarioId == null) {
      this.notificacion.danger('La sesión no tiene usuario.');
      return;
    }
    const falta = this.falta();
    const tipo = this.tipo();
    if (falta != null || tipo == null) {
      this.notificacion.warn(falta ?? 'Elegí si la devolución va a un proveedor o sin proveedor.');
      return;
    }

    const input: DevolucionInput = {
      ...destinoParaInput(tipo, this.proveedor()?.id ?? null),
      sucursalOrigenId: Number(sucursalId),
      fecha: new Date().toISOString().slice(0, 10),
      estado: EstadoDevolucion.PENDIENTE,
      usuarioId,
      items: this.items().map(itemParaInput),
    };

    this.guardando.set(true);
    this.servicio.guardar(input).subscribe({
      next: (devolucion) => {
        this.guardando.set(false);
        this.notificacion.ok('Devolución guardada.');
        if (devolucion?.id != null) {
          void this.router.navigate(['/operaciones/devolucion/detalle', devolucion.id], {
            replaceUrl: true,
          });
        } else {
          void this.router.navigate(['/operaciones/devolucion']);
        }
      },
      error: (err: Error) => {
        this.guardando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /** Volver con productos cargados pide confirmación: no están guardados. */
  async salir(): Promise<void> {
    if (this.items().length === 0) {
      history.back();
      return;
    }
    const ok = await this.dialogo.confirmar({
      titulo: 'Salir sin guardar',
      mensaje: 'Los productos cargados se pierden.',
      confirmar: 'Salir',
    });
    if (ok) {
      history.back();
    }
  }
}
