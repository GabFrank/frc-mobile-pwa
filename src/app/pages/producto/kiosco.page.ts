import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_PRODUCTO } from 'src/app/core/dispositivo/escaner.types';
import { ProductoBusquedaService, sinImagenes } from 'src/app/domains/productos/producto-busqueda.service';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { codigosParaBuscar, normalizarCodigo } from 'src/app/generic/utils/barcodeUtils';
import { esGuarani, formatearCantidad, formatearImporte } from 'src/app/generic/utils/moneda.util';
import { ConversionPrecioService } from 'src/app/domains/moneda/conversion-precio.service';
import type { PreciosEnMoneda } from 'src/app/graphql/operaciones/moneda/convertirPrecios';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { etiquetaPresentacion, precioDe, resolverPresentacionPorCodigo } from 'src/app/shared/producto/presentacion.util';
import { KioscoConfigDialogComponent } from './kiosco-config-dialog.component';
import { KioscoMonedasComponent } from './kiosco-monedas.component';
import { KioscoTiraComponent } from './kiosco-tira.component';
import { KioscoConfigService } from './kiosco-config.service';

/** Cuánto queda el precio en pantalla antes de volver a esperar. Ver abajo. */
const MS_ANTES_DE_LIMPIAR = 20_000;

/**
 * Cuánto espera el modo cámara antes de volver a abrir el escáner.
 *
 * Suficiente para leer el precio que quedó en pantalla, y para que quien
 * quiera tocar la configuración alcance a hacerlo antes de que la cámara
 * vuelva a taparla.
 */
const MS_ANTES_DE_REARMAR = 2_500;

/**
 * Consulta de precios para el salón.
 *
 * Una tablet o un teléfono fijado a la góndola, con un lector de códigos
 * conectado. El cliente pasa el producto y ve el precio; nadie toca la
 * pantalla. Es el `mostrar-precio` de `frc-mobile`.
 *
 * ⚠️ **Vive fuera del shell, no dentro.** Sin barra inferior ni FAB: es una
 * pantalla que mira un cliente, no un empleado navegando. `frc-mobile`
 * lograba lo mismo listando esta ruta en una condición que escondía el
 * footer (`app.component.ts:392`), que había que acordarse de actualizar
 * cada vez que se agregaba una pantalla de kiosco.
 *
 * ⚠️ **El foco vuelve al campo pase lo que pase.** Es el requisito real del
 * modo: un lector HID escribe donde esté el foco, así que un toque perdido
 * en la pantalla lo deja mudo hasta que alguien se dé cuenta. `frc-mobile`
 * lo resolvía con cuatro `setTimeout` repartidos; acá es un listener de
 * click en el documento más un refoco después de cada búsqueda.
 *
 * **El selector de moneda sí se porta, pero la cuenta no.** `frc-mobile`
 * multiplicaba el precio por `1 / cambio` en el cliente; acá el dinero lo
 * calcula el backend (regla 6): `convertirPreciosMobile` devuelve cada
 * precio ya convertido y redondeado con los decimales de la moneda. Contra
 * un central sin esa query el selector no aparece y todo queda en guaraníes.
 */
@Component({
  selector: 'frc-kiosco',
  standalone: true,
  imports: [IconoComponent, KioscoMonedasComponent, KioscoTiraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kiosco" [class.con-monedas]="monedas().length > 1">
      <header class="barra">
        <input
          #campo
          class="campo"
          type="text"
          inputmode="none"
          autocomplete="off"
          [placeholder]="modoCamara() ? 'Consulta por cámara' : 'Pasá el producto por el lector'"
          aria-label="Código del producto"
          [value]="texto()"
          (input)="texto.set($any($event.target).value)"
          (keydown.enter)="buscar()"
        />
        @if (monedas().length > 1) {
          <frc-kiosco-monedas [monedas]="monedas()" [actual]="monedaActual()" (elegir)="elegirMoneda($event)" />
        }
        <button type="button" class="icono-btn" aria-label="Escanear con la cámara" (click)="escanear()">
          <frc-icono nombre="escanear" [tamano]="26" />
        </button>
        <button type="button" class="icono-btn" aria-label="Configurar el kiosco" (click)="configurar()">
          <frc-icono nombre="ajustes" [tamano]="26" />
        </button>
        <button type="button" class="icono-btn" aria-label="Salir del modo kiosco" (click)="salir()">
          <frc-icono nombre="cerrar" [tamano]="26" />
        </button>
      </header>

      <main class="panel">
        @if (buscando()) {
          <p class="mensaje">Buscando…</p>
        } @else if (error(); as e) {
          <p class="mensaje error">{{ e }}</p>
        } @else if (producto(); as p) {
          @if (seleccionada(); as sel) {
            @let v = vitrina();
            <section class="ficha" [class.unica]="presentaciones().length === 1">
              <h1 class="nombre">{{ p.descripcion }}</h1>

              @if (presentaciones().length > 1) {
                <frc-kiosco-tira
                  class="tira"
                  [presentaciones]="presentaciones()"
                  [seleccionadaId]="sel.id ?? null"
                  [imagenes]="imagenesPorId()"
                  (elegir)="elegir($event)"
                />
              }

              <!--
                Un @for de un solo elemento, con track por id: al cambiar de
                presentación el nodo se vuelve a crear y la animación de
                entrada corre otra vez. Es lo que le muestra al cliente que
                el precio de abajo cambió por su toque.
              -->
              <div class="vitrina">
                @for (actual of [sel]; track actual.id) {
                  @if (v?.imagen; as src) {
                    <img class="foto" [src]="src" [alt]="p.descripcion + ', ' + v?.etiqueta" />
                  } @else {
                    <frc-icono class="sin-foto" nombre="producto" [tamano]="96" />
                  }
                }
              </div>

              <div class="importe" aria-live="polite">
                @for (actual of [sel]; track actual.id) {
                  <span class="cantidad">{{ v?.etiqueta }}</span>
                  <span class="precio" [style.--largo]="v?.precio?.length">{{ v?.precio }}</span>
                  @if (v?.referencia; as ref) {
                    <span class="referencia">{{ ref }}</span>
                  }
                }
              </div>
            </section>
          } @else {
            <h1 class="nombre">{{ p.descripcion }}</h1>
            <p class="mensaje">Este producto no tiene precio cargado. Consultá en caja.</p>
          }
        } @else {
          <div class="espera">
            <frc-icono nombre="escanear" [tamano]="64" />
            <p class="mensaje">
              {{
                modoCamara()
                  ? 'Apuntá el código con la cámara para ver el precio'
                  : 'Pasá el producto por el lector para ver su precio'
              }}
            </p>
          </div>
        }
      </main>

    </div>
  `,
  styles: `
    :host { display: block; height: 100dvh; background: var(--bg); }
    .kiosco { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; }

    .barra {
      /* Ancla del selector de moneda: ver KioscoMonedasComponent. */
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-3) var(--sp-4);
      background: var(--brand-fill);
      color: var(--on-brand);
      flex-shrink: 0;
    }
    /*
      inputmode="none" en el HTML: con un lector HID no hace falta teclado en
      pantalla, y si aparece se come media pantalla del kiosco. El campo
      sigue recibiendo texto porque el lector escribe como teclado físico.
    */
    .campo {
      flex: 1;
      min-width: 0;
      font: inherit;
      font-size: var(--fs-title);
      padding: var(--sp-2) var(--sp-3);
      border: none;
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
    }
    .campo:focus { outline: 2px solid var(--brand-accent); }
    .icono-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: var(--sp-2);
      border-radius: var(--radius-sm);
      line-height: 0;
    }
    .icono-btn:hover { background: rgb(255 255 255 / 0.16); }

    .panel {
      /*
        El lado máximo de la foto: el alto que queda después de la barra, los
        márgenes, dos renglones de nombre, la etiqueta y el precio. Es lo que
        hace que en una tablet la foto llene la pantalla y en un teléfono no
        empuje el precio fuera de la vista.
      */
      --vitrina-max: max(
        240px,
        calc(
          100dvh - var(--kiosco-alto-barra) - var(--kiosco-moneda) - 4 * var(--sp-8)
            - 2.4 * var(--fs-kiosco-nombre) - var(--fs-kiosco-precio)
            - 2.6 * var(--fs-kiosco-etiqueta)
        )
      );
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--sp-6) var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      align-items: center;
      /* «safe»: si la ficha no entra, se corta abajo y no arriba. */
      justify-content: safe center;
      text-align: center;
    }

    /*
      Teléfono en vertical: el nombre arriba, la tira de presentaciones al
      costado de la foto y el precio abajo, a todo el ancho. Con una sola
      presentación no hay tira y la foto ocupa la fila.
    */
    .ficha {
      width: 100%;
      max-width: calc(var(--vitrina-max) + var(--kiosco-miniatura) + var(--sp-3));
      display: grid;
      grid-template-columns: var(--kiosco-miniatura) minmax(0, 1fr);
      grid-template-areas:
        'nombre nombre'
        'tira   vitrina'
        'importe importe';
      gap: var(--sp-6) var(--sp-3);
    }
    .ficha.unica {
      max-width: var(--vitrina-max);
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: 'nombre' 'vitrina' 'importe';
    }

    .nombre {
      grid-area: nombre;
      margin: 0;
      font-size: var(--fs-kiosco-nombre);
      font-weight: var(--fw-bold);
      line-height: 1.2;
      text-wrap: balance;
      color: var(--text);
    }

    /*
      Con el selector de moneda debajo de la barra, el panel deja su alto
      libre arriba: si la ficha no entra y arranca desde arriba, el botón
      no le tapa el nombre.
    */
    .con-monedas .panel { padding-top: calc(var(--kiosco-moneda) + var(--sp-6)); }

    /* La tira toma la altura de la foto, no la suya: ver KioscoTiraComponent. */
    .tira { grid-area: tira; position: relative; }

    .vitrina {
      grid-area: vitrina;
      aspect-ratio: 1;
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: var(--sp-4);
      background: var(--vitrina-fondo);
      color: var(--vitrina-icono);
      border-radius: var(--radius-md);
      box-shadow: var(--vitrina-sombra);
    }
    .foto { width: 100%; height: 100%; object-fit: contain; }
    .foto, .sin-foto { animation: aparecer var(--kiosco-transicion) both; }

    .importe {
      grid-area: importe;
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      /* El precio se mide contra este ancho: ver --largo más abajo. */
      container-type: inline-size;
    }
    .cantidad {
      font-size: var(--fs-kiosco-etiqueta);
      color: var(--text-soft);
      animation: subir var(--kiosco-transicion) both;
    }
    .precio {
      /*
        Un precio largo en otra moneda («AR$ 45.000,00») no entra al tamaño
        del guaraní: se achica hasta caber en una línea. --largo es la
        cantidad de caracteres, que pone el template.
      */
      font-size: min(
        var(--fs-kiosco-precio),
        calc(100cqi / (var(--largo, 8) * var(--kiosco-ancho-cifra)))
      );
      font-weight: var(--fw-bold);
      line-height: 1;
      /* «₲» y la cifra van juntos: partidos, el número parece otro precio. */
      white-space: nowrap;
      color: var(--brand-text);
    }

    .referencia { font-size: var(--fs-kiosco-etiqueta); color: var(--text-soft); }
    .precio, .referencia {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      animation: subir var(--kiosco-transicion) both;
    }

    /* Tablet: más aire a los costados; la letra ya creció con los tokens. */
    @media (min-width: 720px) {
      .panel { padding-inline: var(--sp-8); }
      .ficha { column-gap: var(--sp-4); row-gap: var(--sp-8); }
    }

    /*
      Tablet o teléfono acostado: la disposición de una ficha de tienda.
      Tira, foto y, a la derecha, nombre y precio alineados a la izquierda.

      ⚠️ **La foto se mide por el alto, no por la columna.** Acostada, la
      pantalla sobra a lo ancho y falta a lo alto: con columnas proporcionales
      la foto quedaba chica y con aire arriba y abajo. Acá ocupa todo el alto
      libre (sin pasar del 45% del ancho) y el resto es para nombre y precio.
    */
    @media (min-width: 720px) and (orientation: landscape) {
      .panel {
        --vitrina-max: max(
          240px,
          calc(100dvh - var(--kiosco-alto-barra) - var(--kiosco-moneda) - 2 * var(--sp-8))
        );
      }
      .ficha,
      .ficha.unica {
        max-width: none;
        grid-template-columns:
          var(--kiosco-miniatura)
          min(var(--vitrina-max), 45vw)
          minmax(0, 1fr);
        grid-template-rows: 1fr auto;
        grid-template-areas:
          'tira vitrina nombre'
          'tira vitrina importe';
        column-gap: var(--sp-8);
        row-gap: var(--sp-6);
        text-align: start;
      }
      .ficha.unica {
        grid-template-columns: min(var(--vitrina-max), 45vw) minmax(0, 1fr);
        grid-template-areas: 'vitrina nombre' 'vitrina importe';
      }
      .nombre { align-self: end; }
      .importe { align-self: start; }
    }

    @keyframes aparecer {
      from { opacity: 0; transform: scale(0.96); }
    }
    @keyframes subir {
      from { opacity: 0; transform: translateY(var(--sp-1)); }
    }
    @media (prefers-reduced-motion: reduce) {
      .foto, .sin-foto, .cantidad, .precio, .referencia { animation: none; }
    }

    .espera { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
    .espera frc-icono { color: var(--text-mute); }
    .mensaje { margin: 0; font-size: var(--fs-kiosco-etiqueta); color: var(--text-soft); }
    .mensaje.error { color: var(--danger); }
  `,
})
export class KioscoPage implements AfterViewInit {
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly escaner = inject(EscanerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  readonly texto = signal('');
  readonly producto = signal<Producto | null>(null);
  readonly escaneadaId = signal<number | null>(null);
  readonly buscando = signal(false);
  readonly error = signal<string | null>(null);

  /** Solo las que tienen precio: una sin precio no responde la pregunta. */
  readonly presentaciones = computed(() =>
    (this.producto()?.presentaciones ?? []).filter((p) => precioDe(p) != null),
  );

  /** La que el cliente tocó en la tira. `null` hasta que toque alguna. */
  private readonly elegidaId = signal<number | null>(null);

  /**
   * La presentación en la vitrina: la que se tocó, si no la escaneada, si no
   * la primera.
   *
   * ⚠️ **Arranca en la escaneada, no en la principal.** Un producto con
   * unidad y caja tiene dos precios correctos a la vez; el que importa es el
   * de lo que el cliente tiene en la mano, y eso lo dice el código.
   */
  readonly seleccionada = computed(() => {
    const lista = this.presentaciones();
    return (
      lista.find((p) => p.id === this.elegidaId()) ??
      lista.find((p) => p.id === this.escaneadaId()) ??
      lista[0] ??
      null
    );
  });

  private readonly conversion = inject(ConversionPrecioService);

  /** Las monedas que el central sabe convertir. Vacía = sin selector. */
  readonly monedas = signal<PreciosEnMoneda[]>([]);
  /**
   * La moneda elegida. `null` es guaraní.
   *
   * **Queda elegida entre escaneos**, como en `frc-mobile`: un cliente que
   * pidió reales quiere ver reales en el producto siguiente.
   */
  private readonly monedaId = signal<number | null>(null);

  /** Precios del producto en pantalla: moneda → presentación → importe. */
  private readonly convertidos = signal<Map<number, Map<number, number>>>(new Map());

  /** La moneda en uso, o la fila del guaraní si no se eligió otra. */
  readonly monedaActual = computed(() => {
    const lista = this.monedas();
    const id = this.monedaId();
    return (
      lista.find((m) => id != null && Number(m.moneda.id) === id) ??
      lista.find((m) => this.esMonedaBase(m)) ??
      null
    );
  });

  /**
   * Lo que se muestra de la presentación en la vitrina, armado una vez por
   * cambio de selección, moneda, conversión o foto en vez de en cada render.
   */
  readonly vitrina = computed(() => {
    const p = this.seleccionada();
    if (!p) {
      return null;
    }
    const c = this.convertido(p);
    return {
      imagen: this.imagen(p),
      etiqueta: etiquetaPresentacion(p),
      precio: c
        ? `${c.fila.moneda.simbolo ?? ''} ${formatearCantidad(c.monto, c.fila.decimales)}`.trim()
        : this.precioGs(p),
      // En otra moneda, el guaraní queda abajo como referencia.
      referencia: c ? this.precioGs(p) : null,
    };
  });

  /**
   * Fotos por id de presentación. Llegan después del precio. La tira usa las
   * miniaturas; la foto grande, la mediana: estirar la miniatura de 250 px
   * hasta el alto de la ficha la deja borrosa.
   */
  private readonly imagenes = signal(sinImagenes());
  readonly imagenesPorId = computed(() => this.imagenes().miniaturas);
  private imagenesSub: Subscription | null = null;
  private conversionSub: Subscription | null = null;

  private limpiezaId: ReturnType<typeof setTimeout> | null = null;
  private rearmeId: ReturnType<typeof setTimeout> | null = null;
  /** Corta el rearme al salir: sin esto, la cámara se reabre sobre Inicio. */
  private saliendo = false;

  readonly config = inject(KioscoConfigService);
  private readonly dialogo = inject(DialogoService);

  readonly modoCamara = computed(() => this.config.modo() === 'camara');

  constructor() {
    // Cualquier toque en la pantalla devuelve el foco al campo. Sin esto, un
    // cliente que apoya el dedo deja el lector escribiendo en la nada.
    //
    // ⚠️ **Salvo dentro de un overlay.** Los diálogos de Material —el del
    // escáner, sin ir más lejos— se montan en `.cdk-overlay-container`, que
    // está fuera de este componente pero recibe los mismos clicks. Sin esta
    // excepción, tocar «Ingresar a mano» devolvía el foco al campo del
    // kiosco que quedó detrás y el código se escribía ahí, invisible.
    const alTocar = (evento: MouseEvent) => {
      const destino = evento.target as Element | null;
      if (destino?.closest?.('.cdk-overlay-container')) {
        return;
      }
      this.enfocar();
    };
    document.addEventListener('click', alTocar);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('click', alTocar);
      this.imagenesSub?.unsubscribe();
      this.conversionSub?.unsubscribe();
      this.saliendo = true;
      this.cancelarRearme();
      if (this.limpiezaId) {
        clearTimeout(this.limpiezaId);
      }
    });
  }

  ngAfterViewInit(): void {
    // Sin importes: solo para saber qué monedas ofrecer antes del primer
    // escaneo. Si el central no tiene la query, la lista queda vacía.
    this.conversion.convertir([]).subscribe((filas) => {
      this.monedas.set(filas);
      // Si el primer escaneo le ganó a esta consulta, convertirlo ahora.
      if (this.producto() && this.convertidos().size === 0) {
        this.cargarConversion();
      }
    });

    this.enfocar();
    if (this.modoCamara()) {
      void this.escanear();
    }
  }

  private enfocar(): void {
    // En modo cámara no hay nada que enfocar: el campo no recibe nada y el
    // foco solo sirve para que el panel salte al tocarlo.
    if (this.modoCamara()) {
      return;
    }
    // Sin `preventScroll` el foco arrastra el panel hacia arriba en cada
    // toque, y el precio se va de la vista.
    this.campo()?.nativeElement.focus({ preventScroll: true });
  }

  /**
   * Abre el escáner y busca lo que se haya leído.
   *
   * ⚠️ **En modo cámara se vuelve a abrir solo.** Un kiosco sin lector es
   * una pantalla que mira un cliente: si hubiera que tocar el ícono de la
   * cámara antes de cada consulta, no es un kiosco, es un teléfono
   * prestado. `frc-mobile` abre el escáner **una sola vez**, al entrar en
   * modo `cam`, y después queda mudo hasta que alguien vuelva a tocar.
   *
   * ⚠️ **El rearme es en cadena, no en bucle.** Se encadena al cierre del
   * diálogo anterior; un `setInterval` abriría escáneres encima del que ya
   * está abierto.
   */
  async escanear(): Promise<void> {
    const codigo = await this.escaner.escanear({
      titulo: 'Consultar precio',
      ayuda: 'Apuntá al código de barras',
      formatos: FORMATOS_PRODUCTO,
      etiquetaManual: 'Código del producto',
    });
    this.enfocar();
    if (codigo) {
      this.texto.set(codigo);
      this.buscar();
    }

    // Si la persona canceló, tampoco se insiste al instante: se le da tiempo
    // de leer el precio que quedó en pantalla o de tocar la configuración.
    if (this.modoCamara() && !this.saliendo) {
      this.rearmeId = setTimeout(() => void this.escanear(), MS_ANTES_DE_REARMAR);
    }
  }

  async configurar(): Promise<void> {
    // El rearme se corta mientras la configuración está abierta: si no, la
    // cámara vuelve a taparla a los pocos segundos.
    this.cancelarRearme();
    await this.dialogo.abrir(KioscoConfigDialogComponent);
    this.enfocar();
    if (this.modoCamara()) {
      void this.escanear();
    }
  }

  private cancelarRearme(): void {
    if (this.rearmeId) {
      clearTimeout(this.rearmeId);
      this.rearmeId = null;
    }
  }

  buscar(): void {
    const codigo = this.texto().trim();
    if (!codigo) {
      return;
    }

    this.buscando.set(true);
    this.error.set(null);

    this.busqueda.porEscaneo(codigo).subscribe({
      next: (producto) => {
        this.buscando.set(false);
        // El campo se vacía siempre: el próximo producto llega solo, sin que
        // nadie borre lo anterior.
        this.texto.set('');
        this.enfocar();

        if (!producto) {
          this.producto.set(null);
          this.escaneadaId.set(null);
          this.olvidarImagenes();
          this.error.set('Producto no encontrado');
          this.programarLimpieza();
          return;
        }

        this.producto.set(producto);
        this.elegidaId.set(null);
        this.cargarImagenes(producto);
        this.cargarConversion();
        // Cuál de las presentaciones corresponde al código que se pasó: un
        // producto con unidad y caja tiene dos precios correctos a la vez.
        const referencias = codigosParaBuscar(codigo);
        const normalizado = normalizarCodigo(codigo);
        if (!referencias.includes(normalizado)) {
          referencias.push(normalizado);
        }
        const escaneada = resolverPresentacionPorCodigo(producto, ...referencias);
        this.escaneadaId.set(escaneada?.id ?? null);
        this.programarLimpieza();
      },
      error: (err: Error) => {
        this.buscando.set(false);
        this.texto.set('');
        this.enfocar();
        this.error.set(err.message);
        this.programarLimpieza();
      },
    });
  }

  /**
   * El precio no se queda para siempre.
   *
   * Sin esto, el kiosco muestra el último producto consultado hasta que
   * llegue otro, y el próximo cliente lee un precio que no es el suyo. Vuelve
   * a la pantalla de espera, que no afirma nada.
   */
  private programarLimpieza(): void {
    if (this.limpiezaId) {
      clearTimeout(this.limpiezaId);
    }
    this.limpiezaId = setTimeout(() => {
      this.producto.set(null);
      this.escaneadaId.set(null);
      this.elegidaId.set(null);
      this.error.set(null);
      this.olvidarImagenes();
    }, MS_ANTES_DE_LIMPIAR);
  }

  /**
   * Pide las fotos aparte: el precio no espera por ellas.
   *
   * La suscripción anterior se corta antes de pedir otra. Si no, las fotos
   * de un producto lento llegan cuando ya se escaneó el siguiente y se
   * muestran con el precio equivocado.
   */
  private cargarImagenes(producto: Producto): void {
    this.olvidarImagenes();
    if (producto.id == null) {
      return;
    }
    this.imagenesSub = this.busqueda
      .imagenesDePresentaciones(Number(producto.id))
      .subscribe((imagenes) => this.imagenes.set(imagenes));
  }

  private olvidarImagenes(): void {
    this.imagenesSub?.unsubscribe();
    this.imagenesSub = null;
    this.imagenes.set(sinImagenes());
    this.conversionSub?.unsubscribe();
    this.conversionSub = null;
    this.convertidos.set(new Map());
  }

  /**
   * Pide al central los precios del producto en todas las monedas.
   *
   * Una sola consulta para todas: cambiar de bandera después es instantáneo
   * y no vuelve a la red. Se descarta igual que las fotos si llega tarde.
   */
  private cargarConversion(): void {
    const lista = this.presentaciones();
    if (lista.length === 0 || this.monedas().length <= 1) {
      return;
    }
    this.conversionSub = this.conversion
      .convertir(lista.map((p) => precioDe(p)))
      .subscribe((filas) => {
        const porMoneda = new Map<number, Map<number, number>>();
        for (const fila of filas) {
          const porPresentacion = new Map<number, number>();
          fila.montos.forEach((monto, i) => {
            const id = lista[i]?.id;
            if (monto != null && id != null) {
              porPresentacion.set(Number(id), monto);
            }
          });
          porMoneda.set(Number(fila.moneda.id), porPresentacion);
        }
        this.convertidos.set(porMoneda);
      });
  }

  elegirMoneda(m: PreciosEnMoneda): void {
    this.monedaId.set(this.esMonedaBase(m) ? null : Number(m.moneda.id));
    // Igual que tocar una presentación: quien está mirando no pierde la ficha.
    if (this.producto()) {
      this.programarLimpieza();
    }
  }

  private esMonedaBase(m: PreciosEnMoneda): boolean {
    return esGuarani(m.moneda.denominacion) || esGuarani(m.moneda.simbolo);
  }

  /**
   * El importe en la moneda elegida, si el central lo convirtió. `null`
   * cuando se está en guaraníes o la conversión todavía no llegó.
   */
  private convertido(p: Presentacion): { monto: number; fila: PreciosEnMoneda } | null {
    const fila = this.monedaActual();
    if (!fila || this.esMonedaBase(fila) || p.id == null) {
      return null;
    }
    const monto = this.convertidos().get(Number(fila.moneda.id))?.get(Number(p.id));
    return monto != null ? { monto, fila } : null;
  }

  /**
   * El cliente toca otra presentación en la tira.
   *
   * Reinicia la cuenta de limpieza: alguien que está comparando la unidad
   * con el pack no puede quedarse sin ficha a mitad de camino.
   */
  elegir(p: Presentacion): void {
    this.elegidaId.set(p.id ?? null);
    this.programarLimpieza();
  }

  private imagen(p: Presentacion): string | null {
    if (p.id == null) {
      return null;
    }
    const { medianas, miniaturas } = this.imagenes();
    return medianas.get(Number(p.id)) ?? miniaturas.get(Number(p.id)) ?? null;
  }

  private precioGs(p: Presentacion): string {
    return formatearImporte(precioDe(p), 'Guaraní', '₲');
  }

  salir(): void {
    this.saliendo = true;
    this.cancelarRearme();
    void this.router.navigate(['/inicio']);
  }
}
