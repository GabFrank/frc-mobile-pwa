import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { of } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';

import { AuthService } from 'src/app/core/auth/auth.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  Inventario,
  InventarioProducto,
  InventarioProductoEstado,
  InventarioProductoItem,
} from 'src/app/domains/inventario/inventario.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { aIso } from 'src/app/shared/campos/fecha-py';
import { OpcionSeleccion } from 'src/app/shared/selector/selector.component';
import { etiquetaPresentacion } from 'src/app/shared/producto/presentacion.util';
import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { BuscadorProductoDialogComponent } from 'src/app/shared/producto/buscador-producto-dialog.component';
import type { OpcionesBuscador, SeleccionProducto } from 'src/app/shared/producto/buscador.types';
import { ProductoService } from 'src/app/pages/producto/producto.service';
import { LoteService } from 'src/app/domains/lote/lote.service';
import { EstadoLote, type LoteDeProducto, type StockLote } from 'src/app/domains/lote/lote.model';
import {
  BuscadorLoteDialogComponent,
  type DatosBuscadorLote,
} from './buscador-lote-dialog.component';
import {
  CrearLoteDialogComponent,
  type DatosCrearLote,
  type ResultadoCrearLote,
} from './crear-lote-dialog.component';
import type { ProductoVencido } from 'src/app/domains/productos/producto-vencido.model';
import { nuevoItemInput } from './inventario-alta';
import { InventarioItemCardComponent, type FilaConteo } from './inventario-item-card.component';
import { vencimientoSugerido } from './vencimiento-sugerido';
import { diferenciaDe } from './inventario-conteo';
import { marcasDeConteo } from './revision-item';
import { InventarioService } from './inventario.service';

/**
 * Cuántos vencimientos traer para una zona. Una presentación puede tener
 * varios lotes, así que no alcanza con uno por producto.
 */
const TAMANO_SUGERENCIAS = 300;

const ESTADOS: OpcionSeleccion[] = [
  { valor: InventarioProductoEstado.BUENO, texto: 'Bueno' },
  { valor: InventarioProductoEstado.AVERIADO, texto: 'Averiado' },
  { valor: InventarioProductoEstado.VENCIDO, texto: 'Vencido' },
];

/**
 * Cargar el conteo de una zona.
 *
 * Es la pantalla que faltaba para que el inventario se pudiera **hacer**
 * desde el teléfono y no solo consultar: se para frente a la góndola, cuenta
 * y escribe.
 *
 * ⚠️ **Un `InventarioProducto` es una zona, no un producto.** El central le
 * sacó `producto_id` a esa tabla; acá se listan todos los ítems de la zona y
 * cada uno dice de qué producto es, leyéndolo de `presentacion.producto`.
 *
 * ⚠️ **El conteo es por presentación, no por producto.** Un producto con
 * «unidad» y «caja x12» tiene un ítem por cada una: sumarlos sin convertir
 * da un número sin sentido.
 *
 * ⚠️ **Los campos están al revés de lo que sugieren sus nombres.** Lo que se
 * cuenta va en `cantidad`; el stock del sistema, en `cantidadFisica`. Lo fija
 * el central: `finalizarInventarioEnSucursal()` suma `cantidad` y le resta el
 * saldo de `movimiento_stock`. Esta pantalla escribe `cantidad` y devuelve
 * `cantidadFisica` tal como vino.
 *
 * Regresión: se escribía al revés, así que nada de lo contado desde el
 * teléfono llegaba al cálculo de finalización.
 *
 * **Agregar producto** suma a la zona una presentación que la toma no
 * incluía, con el buscador que ya existe: busca por descripción, por código,
 * escanea con la cámara y entiende los códigos de balanza.
 */
@Component({
  selector: 'frc-inventario-carga',
  standalone: true,
  imports: [
    PaginaComponent,
    InventarioItemCardComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true" [conEscaner]="false">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (items().length === 0) {
        <frc-estado-vacio
          titulo="Sin ítems que contar"
          [detalle]="
            puedeAgregar()
              ? 'Esta zona todavía no tiene productos. Agregá el primero para empezar a contar.'
              : 'Esta zona no tiene presentaciones cargadas en esta toma.'
          "
          icono="inventario"
        />
      } @else {
        <!--
          Con todo colapsado hace falta saber cuánto queda sin abrir treinta
          tarjetas. Se recalcula con lo que se está escribiendo, no con lo que
          respondió el central.
        -->
        <div class="avance">
          <div class="avance-texto">
            <span class="avance-conteo">{{ resumen().contados }} de {{ items().length }} contados</span>
            @if (resumen().conDiferencia > 0) {
              <span class="avance-dif">{{ resumen().conDiferencia }} con diferencia</span>
            }
          </div>
          <div class="barra"><span class="barra-hecho" [style.width.%]="resumen().porcentaje"></span></div>
        </div>

        @if (sugerenciasFallaron()) {
          <!--
            «No hay vencimiento conocido» y «no pude preguntar» son
            respuestas distintas: un campo vacío afirmaría la primera.
          -->
          <p class="sin-sugerencias">
            No se pudieron traer los vencimientos conocidos. Los campos quedan
            vacíos; cargalos a mano si hace falta.
          </p>
        }

        <div class="lista">
          @for (fila of items(); track fila.itemId) {
            <frc-inventario-item-card
              [fila]="fila"
              [abierta]="abiertoId() === fila.itemId"
              [estados]="estados"
              [puedeQuitar]="puedeAgregar()"
              (alternar)="alternar(fila.itemId)"
              (quitar)="quitarItem(fila)"
              (contado)="cambiarContado(fila.itemId, $event)"
              (vencimiento)="cambiarVencimiento(fila.itemId, $event)"
              (estado)="cambiarEstado(fila.itemId, $event)"
              (usarConocido)="cambiarVencimiento(fila.itemId, $event)"
              (fechaRetiro)="cambiarFechaRetiro(fila.itemId, $event)"
              (agregarLote)="agregarLote(fila)"
              (crearLote)="crearLote(fila)"
            />
          }
        </div>
      }

      <!--
        ⚠️ Fuera del @else y con su propio @if: un bloque de control de flujo
        con más de un nodo raíz no proyecta al slot (NG8011), y el botón de
        guardar caía en el cuerpo en vez de la barra fija.
      -->
      @if (!cargando() && !error()) {
        <div acciones>
          @if (puedeAgregar()) {
            <button matButton [disabled]="agregando() || guardando()" (click)="agregarProducto()">
              {{ agregando() ? 'Agregando…' : 'Agregar producto' }}
            </button>
          }
          @if (items().length > 0) {
            <button matButton="filled" [disabled]="!hayCambios() || guardando()" (click)="guardar()">
              {{ guardando() ? 'Guardando…' : 'Guardar conteo (' + cambiados().length + ')' }}
            </button>
          }
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .lista { display: flex; flex-direction: column; gap: var(--sp-2); }
    .avance { display: flex; flex-direction: column; gap: var(--sp-2); }
    .avance-texto {
      display: flex;
      justify-content: space-between;
      gap: var(--sp-3);
      font-size: var(--fs-label);
      color: var(--text-soft);
    }
    .avance-conteo { font-variant-numeric: tabular-nums; }
    .avance-dif { color: var(--warn); font-variant-numeric: tabular-nums; }
    .barra {
      height: var(--sp-1);
      border-radius: var(--radius-full);
      background: var(--surface-sunken);
      overflow: hidden;
    }
    .barra-hecho {
      display: block;
      height: 100%;
      border-radius: var(--radius-full);
      background: var(--ok);
      transition: width 160ms ease;
    }
    .sin-sugerencias { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
  `,
})
export class InventarioCargaPage {
  private readonly servicio = inject(InventarioService);
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly productos = inject(ProductoService);
  private readonly lotes = inject(LoteService);
  private readonly dialogo = inject(DialogoService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);

  readonly id = input<string>();
  readonly productoId = input<string>();

  readonly estados = ESTADOS;

  /**
   * Una sola fecha por visita a la pantalla.
   *
   * Con `new Date()` dentro del `computed`, cada repintado da un instante
   * distinto: nada que se pueda afirmar en un test, y un ítem podría cambiar
   * de «vencido» a «vigente» a mitad de un conteo que cruza la medianoche.
   */
  private readonly hoy = new Date();
  private readonly hoyIso = aIso(this.hoy) ?? '';

  /** Qué ítem está desplegado. Uno a la vez: una zona tiene treinta. */
  readonly abiertoId = signal<number | null>(null);

  readonly inventario = signal<Inventario | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly agregando = signal(false);

  /**
   * Vencimientos conocidos de los productos de esta zona.
   *
   * Es una consulta **secundaria**: la pantalla cuenta igual sin ella. Por
   * eso `sugerenciasFallaron` existe aparte — «no hay vencimiento conocido»
   * y «no pude preguntar» no se pueden mostrar igual.
   */
  private readonly conocidos = signal<ProductoVencido[]>([]);
  readonly sugerenciasFallaron = signal(false);

  /** Lo editado, por id de ítem. Vacío hasta que alguien escribe. */
  private readonly edicion = signal<
    Map<
      number,
      {
        contado?: number | null;
        vencimiento?: string;
        estado?: unknown;
        /** Solo en renglones con lote: va al maestro, no al ítem. */
        fechaRetiro?: string;
      }
    >
  >(new Map());

  readonly producto = computed<InventarioProducto | null>(() => {
    const buscado = Number(this.productoId());
    return (
      (this.inventario()?.inventarioProductoList ?? []).find((p) => Number(p.id) === buscado) ??
      null
    );
  });

  readonly titulo = computed(() => this.producto()?.zona?.descripcion || 'Conteo');

  readonly items = computed<FilaConteo[]>(() => {
    const cambios = this.edicion();
    const filas = this.producto()?.inventarioProductoItemList ?? [];

    /**
     * ⚠️ **Dos renglones de la misma presentación son dos lotes, y dos lotes
     * no comparten fecha.**
     *
     * `vencimientoSugerido()` mira solo el `presentacionId`, así que sin esto
     * todos los renglones de una presentación recibían **la misma** fecha
     * sugerida. Cargarle el vencimiento a uno terminaba escribiendo el mismo
     * en el otro al guardar —el operador lo ve como «le puse la fecha a uno y
     * me la puso en los dos»— y el central lo rechaza como renglón duplicado.
     *
     * Se reservan primero las fechas que cada renglón **ya tiene**, propias o
     * escritas, y recién después se reparten las sugerencias, sacando cada una
     * del reparto para que la siguiente caiga en otro lote.
     */
    const tomadas = new Map<string, Set<string>>();
    /**
     * ⚠️ **Con lote la fecha propia sale del MAESTRO, no del ítem.**
     *
     * El ítem guarda una copia de la fecha para que la clave de duplicado del
     * central siga funcionando, pero la verdad es `lote.fechaVencimiento`: es
     * una sola en toda la red y es la que se corrige. Leerla del ítem haría que
     * una fecha corregida desde otra sucursal —o desde el escritorio— siguiera
     * mostrándose vieja acá.
     */
    const propiaDe = (item: InventarioProductoItem) => {
      const cambio = cambios.get(Number(item.id));
      if (cambio?.vencimiento !== undefined) {
        return cambio.vencimiento;
      }
      const delLote = item.lote?.fechaVencimiento;
      if (item.lote) {
        return delLote ? delLote.slice(0, 10) : '';
      }
      return item.vencimiento ? item.vencimiento.slice(0, 10) : '';
    };
    const reservar = (presentacionId: string, fecha: string) => {
      if (!fecha) {
        return;
      }
      const yaHay = tomadas.get(presentacionId) ?? new Set<string>();
      yaHay.add(fecha);
      tomadas.set(presentacionId, yaHay);
    };

    for (const item of filas) {
      reservar(String(item.presentacion?.id ?? ''), propiaDe(item));
    }

    return filas.map((item) => {
      const itemId = Number(item.id);
      const cambio = cambios.get(itemId);
      // Lo contado es `cantidad` y el stock del sistema `cantidadFisica`:
      // los nombres engañan, pero es el par que usa el central al finalizar.
      const contado = cambio?.contado !== undefined ? cambio.contado : item.cantidad ?? null;
      const sistema = item.cantidadFisica ?? 0;

      const presentacionId = String(item.presentacion?.id ?? '');
      // ⚠️ `undefined` es «nadie lo tocó»; la cadena vacía es «lo borró a
      // propósito». Colapsarlos con `||` hacía que borrar el campo se
      // volviera a prellenar solo con la sugerencia.
      const editado = cambio?.vencimiento;
      const propia = propiaDe(item);
      // Lo que se llevaron los **otros** renglones. La fecha propia no se
      // excluye: es la que este renglón tiene derecho a mostrar como conocida.
      const ajenas = new Set(tomadas.get(presentacionId) ?? []);
      ajenas.delete(propia);

      // Lo que el central sabe de esta presentación. Se calcula SIEMPRE,
      // tenga el ítem su propia fecha o no: es justo cuando la tiene que hace
      // falta poder comparar contra lo que dice el envase.
      //
      // ⚠️ **Con lote no se sugiere nada.** El maestro del lote YA tiene la
      // fecha, y es la única: ofrecer al lado otra sacada de una compra vieja
      // sería contradecir en la misma pantalla el dato que se está editando.
      const conocido = item.lote
        ? null
        : vencimientoSugerido(
            this.conocidos(),
            Number(item.presentacion?.id),
            this.hoy,
            ajenas,
          );

      // ⚠️ **El campo NO se prellena con lo que el central conoce.** Una
      // fecha puesta por el sistema se lee como una fecha cargada por alguien,
      // y si encima ya venció el renglón aparece en rojo sin que nadie haya
      // mirado el envase. Lo conocido se ofrece abajo, con un botón para
      // adoptarlo: la decisión es del operador.
      const vencimiento = editado !== undefined ? editado : propia;
      // Lo que este renglón se lleve —lo propio o lo que adopte— queda tomado,
      // para que el próximo de esta presentación proponga otro lote.
      reservar(presentacionId, vencimiento || conocido?.fecha || '');

      return {
        itemId,
        // El producto cuelga de la presentación: `InventarioProducto` es la
        // zona, y en una zona hay más de un producto.
        etiqueta: String(item.presentacion?.producto?.descripcion ?? 'Producto'),
        presentacion: item.presentacion ? etiquetaPresentacion(item.presentacion) : 'Presentación',
        sistema: formatearCantidad(sistema, 2),
        contado,
        // La diferencia se recalcula en vivo con lo que se está escribiendo,
        // que es lo que el operador necesita para decidir si recuenta.
        diferencia: contado == null ? null : contado - sistema,
        vencimiento,
        conocido,
        vencido: vencimiento !== '' && vencimiento < this.hoyIso,
        // El producto lleva control de lote: sin lote asignado el renglón no se
        // puede contar todavía.
        productoConLote: item.presentacion?.producto?.lote === true,
        lote: item.lote?.id
          ? {
              id: Number(item.lote.id),
              numeroLote: String(item.lote.numeroLote ?? ''),
              estado: item.lote.estado,
              // Se cuenta igual: bloquear un lote lo saca del mostrador, no de
              // la góndola.
              bloqueado: item.lote.estado != null && item.lote.estado !== EstadoLote.LIBERADO,
            }
          : null,
        fechaRetiro:
          cambio?.fechaRetiro !== undefined
            ? cambio.fechaRetiro
            : item.lote?.fechaRetiro
              ? item.lote.fechaRetiro.slice(0, 10)
              : '',
        estado: cambio?.estado ?? item.estado ?? InventarioProductoEstado.BUENO,
        original: item,
      };
    });
  });

  /**
   * Cómo va la zona, con lo que se está escribiendo.
   *
   * No usa `resumirItems()` a propósito: esa función resume lo que respondió
   * el central, y acá lo que importa es lo que hay en pantalla sin guardar —
   * si no, el contador no se mueve mientras se cuenta, que es exactamente
   * cuando se lo mira.
   */
  readonly resumen = computed(() => {
    const filas = this.items();
    const contados = filas.filter((f) => f.contado != null).length;
    return {
      contados,
      conDiferencia: filas.filter((f) => f.contado != null && f.diferencia !== 0).length,
      porcentaje: filas.length === 0 ? 0 : Math.round((contados / filas.length) * 100),
    };
  });

  readonly cambiados = computed(() => this.items().filter((f) => this.edicion().has(f.itemId)));
  readonly hayCambios = computed(() => this.cambiados().length > 0);

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('No se entiende qué inventario abrir.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id).subscribe({
      next: (inv) => {
        this.inventario.set(inv ?? null);
        this.cargando.set(false);
        this.cargarVencimientosConocidos();
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /**
   * Los vencimientos que el central conoce de los productos de esta zona.
   *
   * ⚠️ **Una sola consulta para toda la zona**, con todos los productos a la
   * vez: una por ítem serían treinta viajes para llenar treinta campos.
   *
   * ⚠️ **Es `vencimientosConocidos`, no `productosVencidos`.** Ese reporte
   * ancla sus cinco fuentes al **último inventario** de la sucursal, y la toma
   * que se está contando **es** el último inventario: mientras se cuenta
   * devolvía cero y ningún renglón recibía sugerencia, diera igual la fuente.
   * Verificado contra `bodega3`: COCA COLA 500ML tiene 81 fechas conocidas de
   * su caja x 6 y el reporte no devolvía ninguna.
   *
   * El recorte —vigentes más las últimas vencidas, por presentación— lo hace
   * el central. Acá no se decide nada de eso.
   */
  private cargarVencimientosConocidos(): void {
    const sucursalId = Number(this.inventario()?.sucursal?.id);
    const productoIds = [
      ...new Set(
        (this.producto()?.inventarioProductoItemList ?? [])
          .map((item) => Number(item.presentacion?.producto?.id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];

    this.conocidos.set([]);
    this.sugerenciasFallaron.set(false);
    if (!Number.isFinite(sucursalId) || productoIds.length === 0) {
      return;
    }

    this.productos
      .vencimientosConocidos(
        sucursalId,
        productoIds,
        // Secundaria: la pantalla cuenta igual sin sugerencias, así que no
        // aporta a la barra de carga ni tira un toast si falla.
        { mostrarCarga: false, notificarError: false },
      )
      .subscribe({
        next: (filas) => this.conocidos.set(filas ?? []),
        // Un campo vacío diría «no hay vencimiento conocido», que es una
        // afirmación que nadie hizo.
        error: () => this.sugerenciasFallaron.set(true),
      });
  }

  private editar(itemId: number, parche: Record<string, unknown>): void {
    this.edicion.update((mapa) => {
      const copia = new Map(mapa);
      copia.set(itemId, { ...(copia.get(itemId) ?? {}), ...parche });
      return copia;
    });
  }

  cambiarContado(itemId: number, evento: Event): void {
    const crudo = (evento.target as HTMLInputElement).value;
    const n = Number(crudo);
    this.editar(itemId, {
      contado: crudo.trim() !== '' && Number.isFinite(n) ? n : null,
    });
  }

  /** `yyyy-MM-dd`, o vacío. Llega ya convertido por `<frc-campo-fecha>`. */
  cambiarVencimiento(itemId: number, valor: string): void {
    this.editar(itemId, { vencimiento: valor });
    this.abrir(itemId);
  }

  /**
   * Abre uno y cierra el que estaba.
   *
   * Lo escrito **no se pierde al colapsar**: la edición vive en la señal
   * `edicion`, no en los campos del DOM. Es la razón por la que la card no
   * guarda estado propio.
   */
  alternar(itemId: number): void {
    this.abiertoId.update((actual) => (actual === itemId ? null : itemId));
  }

  private abrir(itemId: number): void {
    this.abiertoId.set(itemId);
  }

  cambiarEstado(itemId: number, valor: unknown): void {
    this.editar(itemId, { estado: valor });
  }

  /**
   * La fecha de retiro del lote. `yyyy-MM-dd`, o vacío.
   *
   * ⚠️ **No es un dato del renglón**: viaja al maestro del lote al guardar, con
   * su propia mutation, porque vale para todas las sucursales.
   */
  cambiarFechaRetiro(itemId: number, valor: string): void {
    this.editar(itemId, { fechaRetiro: valor });
    this.abrir(itemId);
  }

  /**
   * Guarda solo lo que se tocó, un ítem por vez.
   *
   * No hay mutation de lote: `saveInventarioProductoItem` guarda de a uno.
   * Se espera a que terminen todas antes de recargar, porque recargar en el
   * medio traería la lista a mitad de camino.
   */
  /**
   * Solo se agrega a una toma abierta.
   *
   * Cerrada o cancelada, el alcance del conteo ya es un hecho histórico:
   * sumarle un producto cambiaría qué se contó en una toma que ya ajustó el
   * stock.
   */
  readonly puedeAgregar = computed(
    () => String(this.inventario()?.estado ?? '').toUpperCase() === 'ABIERTO',
  );

  /**
   * Sumar a la zona una presentación que la toma no incluía.
   *
   * El ítem se **persiste al elegirlo**, con el stock del sistema y sin
   * conteo, y la lista se recarga: así hay una sola fuente de verdad —lo que
   * dice el central— y no un renglón a medio existir que se pierde si alguien
   * sale de la pantalla antes de guardar.
   *
   * ⚠️ **No hay chequeo de duplicado acá.** Qué es un renglón repetido lo
   * decide el central, y su mensaje ya viene escrito para el operador: la
   * pantalla lo muestra y nada más. Tener la regla en los dos lados es lo que
   * produjo el defecto — la copia local decía `(zona, presentación)` y el
   * central `(inventario, producto, vencimiento)`.
   */
  async agregarProducto(): Promise<void> {
    const inventarioProductoId = Number(this.producto()?.id);
    const sucursalId = Number(this.inventario()?.sucursal?.id);
    const usuarioId = this.auth.usuario()?.id;

    if (!Number.isFinite(inventarioProductoId) || usuarioId == null) {
      this.notificacion.warn('No se pudo identificar la zona o el usuario.');
      return;
    }

    const opciones: OpcionesBuscador = {
      devuelve: 'presentacion',
      // Con la sucursal, el buscador muestra el stock de cada producto: es lo
      // que deja ver contra qué se va a comparar antes de agregarlo.
      sucursalId: Number.isFinite(sucursalId) ? sucursalId : undefined,
      mostrarPrecio: false,
      etiquetaCampo: 'Código, descripción o escaneo',
    };

    const elegido = await this.dialogo.abrir<
      BuscadorProductoDialogComponent,
      { titulo: string; opciones: OpcionesBuscador },
      SeleccionProducto | undefined
    >(BuscadorProductoDialogComponent, { titulo: 'Agregar al conteo', opciones });

    const presentacionId = Number(elegido?.presentacion?.id);
    const productoId = Number(elegido?.producto?.id);
    if (!Number.isFinite(presentacionId) || presentacionId <= 0) {
      return;
    }

    this.agregando.set(true);

    /*
     * ⚠️ **Un producto con lote entra igual que cualquier otro: un renglón, sin
     * lote todavía.**
     *
     * La versión anterior abría un renglón por cada lote con saldo. Se cambió a
     * pedido: el operador no siempre sabe de antemano qué lotes va a encontrar,
     * y abrirle cinco renglones que quizás no están en la góndola le da cinco
     * cosas para borrar. Ahora el renglón nace sin lote y con el conteo
     * BLOQUEADO, y el lote se elige —o se crea— desde el menú ⋮.
     */
    this.stockDe(productoId, sucursalId).subscribe({
      next: (stock) => {
        this.servicio
          .guardarItem(
            nuevoItemInput({
              inventarioProductoId,
              presentacionId,
              stock,
              usuarioId,
              peso: elegido?.peso,
            }),
          )
          .subscribe({
            next: () => {
              this.agregando.set(false);
              this.cargar();
            },
            error: (err: Error) => {
              this.agregando.set(false);
              this.notificacion.danger(err.message);
            },
          });
      },
      error: (err: Error) => {
        this.agregando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * Elegir un lote existente para el renglón.
   *
   * ⚠️ **Hace dos cosas distintas según el renglón**, y es a propósito:
   *
   * - **Sin lote** —el estado en que nace un producto con control de lote— el
   *   lote se asigna a ESE renglón y recién ahí se habilita el conteo.
   * - **Con lote** se abre un renglón NUEVO. Es cómo se cuentan dos lotes del
   *   mismo producto en la misma zona sin volver a *Agregar producto*.
   *
   * Reasignar un renglón que ya tiene lote sería la tercera opción y no está:
   * el renglón equivocado se saca con *Quitar del conteo*, que ya existe y
   * confirma antes de borrar lo contado.
   */
  async agregarLote(fila: FilaConteo): Promise<void> {
    const contexto = this.contextoDeLote(fila);
    if (!contexto) {
      return;
    }

    const elegido = await this.elegirLote(contexto.productoId, fila.etiqueta, contexto.sucursalId);
    if (!elegido?.loteId) {
      return;
    }

    this.aplicarLote(fila, contexto, {
      loteId: Number(elegido.loteId),
      saldo: elegido.saldo ?? 0,
      vencimiento: elegido.fechaVencimiento,
    });
  }

  /**
   * Registrar un lote que el sistema no tenía y usarlo en el renglón.
   *
   * ⚠️ **Crea solo el maestro, con saldo cero.** Cuánto hay es lo que el conteo
   * viene a determinar: poner una cantidad al crearlo sería contarlo dos veces.
   */
  async crearLote(fila: FilaConteo): Promise<void> {
    const contexto = this.contextoDeLote(fila);
    if (!contexto) {
      return;
    }

    const datos = await this.dialogo.abrir<
      CrearLoteDialogComponent,
      DatosCrearLote,
      ResultadoCrearLote | undefined
    >(CrearLoteDialogComponent, {
      productoDescripcion: fila.etiqueta,
      diasVencimiento: fila.original.presentacion?.producto?.diasVencimiento,
    });
    if (!datos?.numeroLote) {
      return;
    }

    this.agregando.set(true);
    this.lotes
      .crear({
        productoId: contexto.productoId,
        numeroLote: datos.numeroLote,
        fechaVencimiento: datos.fechaVencimiento || null,
        fechaRetiro: datos.fechaRetiro || null,
        usuarioId: contexto.usuarioId,
      })
      .subscribe({
        next: (lote) => {
          if (!lote?.id) {
            this.agregando.set(false);
            this.notificacion.danger('El central no devolvió el lote creado.');
            return;
          }
          // Saldo cero: el lote acaba de nacer y no tiene movimientos. Si el
          // central devolvió uno preexistente, el saldo real llega en la
          // recarga.
          this.aplicarLote(fila, contexto, {
            loteId: Number(lote.id),
            saldo: 0,
            vencimiento: lote.fechaVencimiento,
          });
        },
        error: (err: Error) => {
          this.agregando.set(false);
          this.notificacion.danger(err.message);
        },
      });
  }

  /**
   * Lo que hace falta para trabajar con el lote de un renglón. `null` —y avisa—
   * si falta algo.
   */
  private contextoDeLote(
    fila: FilaConteo,
  ): { productoId: number; presentacionId: number; inventarioProductoId: number; sucursalId: number; usuarioId: number } | null {
    if (!this.puedeAgregar()) {
      return null;
    }
    const productoId = Number(fila.original.presentacion?.producto?.id);
    const usuarioId = this.auth.usuario()?.id;
    if (!Number.isFinite(productoId) || usuarioId == null) {
      this.notificacion.warn('No se pudo identificar el producto o el usuario.');
      return null;
    }
    return {
      productoId,
      presentacionId: Number(fila.original.presentacion?.id),
      inventarioProductoId: Number(this.producto()?.id),
      sucursalId: Number(this.inventario()?.sucursal?.id),
      usuarioId,
    };
  }

  /**
   * Asigna el lote al renglón, o abre uno nuevo si el renglón ya tenía uno.
   *
   * ⚠️ **`cantidadFisica` pasa a ser el saldo DEL LOTE.** Mientras el renglón no
   * tiene lote, ahí está la existencia del producto; en cuanto se le asigna
   * uno, la diferencia tiene que medirse contra ese lote y no contra el total,
   * o el renglón muestra un faltante que no existe.
   */
  private aplicarLote(
    fila: FilaConteo,
    contexto: { presentacionId: number; inventarioProductoId: number; usuarioId: number },
    lote: { loteId: number; saldo: number; vencimiento?: string },
  ): void {
    this.agregando.set(true);

    const base = {
      inventarioProductoId: contexto.inventarioProductoId,
      presentacionId: contexto.presentacionId,
      usuarioId: contexto.usuarioId,
      loteId: lote.loteId,
      cantidadFisica: lote.saldo,
      cantidadAnterior: lote.saldo,
      vencimiento: lote.vencimiento?.slice(0, 10),
    };

    // Con lote propio el renglón ya es de otro lote: este va a uno nuevo. Sin
    // lote, se completa el que está —id incluido—, que es el renglón que el
    // operador tiene abierto.
    const input = fila.lote
      ? { ...base, verificado: false, revisado: false }
      : { ...base, id: fila.itemId, cantidad: fila.contado ?? undefined };

    this.servicio.guardarItem(input).subscribe({
      next: () => {
        this.agregando.set(false);
        // Lo editado de ese renglón ya viajó: dejarlo en el mapa haría que
        // «Guardar conteo» lo contara de nuevo contra datos viejos.
        this.edicion.update((mapa) => {
          const copia = new Map(mapa);
          copia.delete(fila.itemId);
          return copia;
        });
        this.cargar();
      },
      error: (err: Error) => {
        this.agregando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /** El buscador de lotes, con los que la zona ya tiene marcados. */
  private elegirLote(
    productoId: number,
    productoDescripcion: string,
    sucursalId: number,
  ): Promise<LoteDeProducto | undefined> {
    const yaEnLaZona = this.items()
      .filter((f) => Number(f.original.presentacion?.producto?.id) === productoId)
      .map((f) => f.lote?.id)
      .filter((id): id is number => id != null);

    return this.dialogo.abrir<
      BuscadorLoteDialogComponent,
      DatosBuscadorLote,
      LoteDeProducto | undefined
    >(BuscadorLoteDialogComponent, {
      productoId,
      productoDescripcion,
      sucursalId: Number.isFinite(sucursalId) ? sucursalId : undefined,
      yaEnLaZona,
    });
  }

  /**
   * Saca un renglón del conteo.
   *
   * ⚠️ **Borra de verdad**, y por eso confirma antes: el central hace
   * `deleteById`, así que lo contado en ese renglón se pierde. El caso de uso
   * es el renglón agregado por error —el producto que no era, o la
   * presentación equivocada—, no deshacer un conteo.
   *
   * Solo con la toma abierta: cerrada, el alcance ya es un hecho histórico y
   * sacarle un renglón cambiaría qué se contó en una toma que ya ajustó
   * stock. Es la misma condición que habilita *Agregar producto*.
   */
  async quitarItem(fila: FilaConteo): Promise<void> {
    if (!this.puedeAgregar()) {
      return;
    }
    const confirmado = await this.dialogo.confirmarEliminacion(
      `«${fila.etiqueta}» (${fila.presentacion}) de esta zona`,
    );
    if (!confirmado) {
      return;
    }

    this.agregando.set(true);
    this.servicio.borrarItem(fila.itemId).subscribe({
      next: () => {
        this.agregando.set(false);
        // Lo editado de ese renglón deja de existir: si quedara en el mapa,
        // «Guardar conteo (n)» seguiría contándolo y el guardado fallaría
        // contra un id que el central ya no tiene.
        this.edicion.update((mapa) => {
          const copia = new Map(mapa);
          copia.delete(fila.itemId);
          return copia;
        });
        if (this.abiertoId() === fila.itemId) {
          this.abiertoId.set(null);
        }
        this.notificacion.ok('Producto quitado del conteo.');
        this.cargar();
      },
      error: (err: Error) => {
        this.agregando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }

  /**
   * El stock del sistema para el ítem nuevo.
   *
   * Sin sucursal no se puede preguntar, y **cero no es la respuesta**: se
   * agrega con el sistema en cero y la diferencia sale de lo que se cuente.
   * Es explícito para que no parezca que el central dijo que no hay nada.
   */
  private stockDe(productoId: number, sucursalId: number) {
    if (!Number.isFinite(productoId) || !Number.isFinite(sucursalId)) {
      return of(0);
    }
    return this.busqueda.stock(productoId, sucursalId);
  }

  /**
   * Los renglones con lote cuya fecha —vencimiento o retiro— cambió respecto
   * del maestro.
   *
   * ⚠️ **Van por una mutation aparte y no por el ítem**, porque no son datos de
   * este conteo: el maestro del lote es uno solo en toda la red y corregirlo
   * reordena el FEFO en todas las sucursales. La tarjeta lo dice antes de que
   * alguien escriba.
   */
  private readonly fechasDeLoteCambiadas = computed(() =>
    this.cambiados().filter((fila) => {
      if (!fila.lote) {
        return false;
      }
      const cambio = this.edicion().get(fila.itemId);
      return cambio?.vencimiento !== undefined || cambio?.fechaRetiro !== undefined;
    }),
  );

  guardar(): void {
    const filas = this.cambiados().filter((f) => f.contado != null);
    const fechas = this.fechasDeLoteCambiadas();
    if (filas.length === 0 && fechas.length === 0) {
      this.notificacion.warn('Escribí al menos una cantidad contada.');
      return;
    }

    const usuarioId = this.auth.usuario()?.id;
    const inventarioProductoId = Number(this.producto()?.id);
    this.guardando.set(true);

    let pendientes = filas.length + fechas.length;
    let fallaron = 0;

    for (const fila of fechas) {
      this.lotes
        .actualizarFechas({
          loteId: fila.lote!.id,
          fechaVencimiento: fila.vencimiento || null,
          fechaRetiro: fila.fechaRetiro || null,
          usuarioId,
        })
        .subscribe({
          next: () => this.terminar(--pendientes, fallaron),
          error: (err: Error) => {
            fallaron++;
            // El central valida que el retiro no sea posterior al vencimiento y
            // manda el texto listo: se muestra tal cual.
            this.notificacion.danger(err.message);
            this.terminar(--pendientes, fallaron);
          },
        });
    }

    for (const fila of filas) {
      const item: InventarioProductoItem = fila.original;
      this.servicio
        .guardarItem({
          id: item.id,
          inventarioProductoId,
          presentacionId: item.presentacion?.id,
          // Lo contado va en `cantidad`, que es el campo que el central
          // suma al finalizar. `cantidadFisica` —el stock del sistema—
          // viaja igual que vino: pisarla borra contra qué se comparó.
          cantidad: fila.contado ?? undefined,
          cantidadFisica: item.cantidadFisica,
          cantidadAnterior: item.cantidadAnterior,
          // Con lote la fecha vive en el maestro; acá va la copia que sostiene
          // la clave de duplicado del central.
          vencimiento: fila.vencimiento || undefined,
          ...(fila.lote ? { loteId: fila.lote.id } : {}),
          estado: fila.estado as InventarioProductoEstado,
          ...marcasDeConteo(fila.contado ?? 0, item.cantidadFisica),
          usuarioId,
        })
        .subscribe({
          next: () => this.terminar(--pendientes, fallaron),
          error: () => {
            fallaron++;
            this.terminar(--pendientes, fallaron);
          },
        });
    }
  }

  private terminar(pendientes: number, fallaron: number): void {
    if (pendientes > 0) {
      return;
    }
    this.guardando.set(false);
    this.edicion.set(new Map());
    if (fallaron > 0) {
      this.notificacion.warn(
        `Se guardaron algunos ítems, ${fallaron} no. Revisá y volvé a intentar.`,
      );
    } else {
      this.notificacion.ok('Conteo guardado.');
    }
    // Se recarga siempre: aunque algo falle, lo que sí entró tiene que verse.
    this.cargar();
  }

  fecha(valor: string | undefined): string {
    return fechaLegible(valor, { conHora: false }) ?? '—';
  }

  diferencia(item: InventarioProductoItem): number | null {
    return diferenciaDe(item);
  }
}
