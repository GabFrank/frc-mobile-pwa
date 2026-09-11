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

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_PRODUCTO } from 'src/app/core/dispositivo/escaner.types';
import { ProductoBusquedaService } from 'src/app/domains/productos/producto-busqueda.service';
import { Presentacion } from 'src/app/domains/productos/presentacion.model';
import { Producto } from 'src/app/domains/productos/producto.model';
import { codigosParaBuscar, normalizarCodigo } from 'src/app/generic/utils/barcodeUtils';
import { formatearImporte } from 'src/app/generic/utils/moneda.util';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { etiquetaPresentacion, precioDe, resolverPresentacionPorCodigo } from 'src/app/shared/producto/presentacion.util';
import { KioscoConfigDialogComponent } from './kiosco-config-dialog.component';
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
 * **El selector de moneda no se porta, y es una decisión.** `frc-mobile`
 * multiplicaba el precio por un tipo de cambio en el cliente; acá el dinero
 * lo calcula el backend (regla 6). Cuando las sucursales de frontera lo
 * necesiten, el precio convertido tiene que venir del central.
 */
@Component({
  selector: 'frc-kiosco',
  standalone: true,
  imports: [IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kiosco">
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
          <h1 class="descripcion">{{ p.descripcion }}</h1>

          <div class="grilla" [class.pocas]="presentaciones().length <= 2">
            @for (pr of presentaciones(); track pr.id) {
              <div class="presentacion" [class.escaneada]="pr.id === escaneadaId()">
                <span class="cantidad">{{ etiqueta(pr) }}</span>
                <span class="precio">{{ precio(pr) }}</span>
              </div>
            }
          </div>
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
    .kiosco { display: flex; flex-direction: column; height: 100%; min-height: 0; }

    .barra {
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
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--sp-6) var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-6);
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .descripcion {
      margin: 0;
      font-size: var(--fs-display);
      font-weight: var(--fw-bold);
      color: var(--text);
    }

    .grilla {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--sp-4);
      width: 100%;
    }
    .grilla.pocas { grid-template-columns: minmax(0, 1fr); }

    .presentacion {
      background: var(--surface);
      border: 2px solid var(--border-light);
      border-radius: var(--radius-md);
      box-shadow: var(--elev-1);
      padding: var(--sp-6) var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-2);
    }
    /*
      La presentación cuyo código se escaneó se resalta. Un producto con
      unidad y caja tiene dos precios y los dos son correctos: sin la marca,
      el cliente no sabe cuál corresponde a lo que tiene en la mano.
    */
    .presentacion.escaneada { border-color: var(--brand-fill); }
    .cantidad { font-size: var(--fs-body); color: var(--text-soft); }
    .precio {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-size: var(--fs-display);
      font-weight: var(--fw-bold);
      color: var(--text);
    }
    .presentacion.escaneada .precio { color: var(--brand-text); }

    .espera { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
    .espera frc-icono { color: var(--text-mute); }
    .mensaje { margin: 0; font-size: var(--fs-title); color: var(--text-soft); }
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
      this.saliendo = true;
      this.cancelarRearme();
      if (this.limpiezaId) {
        clearTimeout(this.limpiezaId);
      }
    });
  }

  ngAfterViewInit(): void {
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
          this.error.set('Producto no encontrado');
          this.programarLimpieza();
          return;
        }

        this.producto.set(producto);
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
      this.error.set(null);
    }, MS_ANTES_DE_LIMPIAR);
  }

  etiqueta(p: Presentacion): string {
    return etiquetaPresentacion(p);
  }

  precio(p: Presentacion): string {
    return formatearImporte(precioDe(p), 'Guaraní', '₲');
  }

  salir(): void {
    this.saliendo = true;
    this.cancelarRearme();
    void this.router.navigate(['/inicio']);
  }
}
