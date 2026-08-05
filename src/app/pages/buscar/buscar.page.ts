import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from 'src/app/core/auth/auth.service';
import { EscanerService } from 'src/app/core/dispositivo/escaner.service';
import { FORMATOS_PRODUCTO } from 'src/app/core/dispositivo/escaner.types';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Producto } from 'src/app/domains/productos/producto.model';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { formatearCantidad } from 'src/app/generic/utils/moneda.util';
import { precioDe } from './presentacion.util';
import { ProductoBusquedaService, ResultadoPesable } from './producto-busqueda.service';

/**
 * Cuántos resultados trae cada tanda.
 *
 * ⚠️ **No es una elección del cliente: el central tiene `limit 10` escrito a
 * mano** en la consulta nativa de `productoSearch`
 * (`ProductoRepository.java:53`). Poner otro número acá no cambia lo que
 * llega — solo rompe la detección de «hay más», que compara la cantidad
 * recibida contra este valor. Si algún día el backend lo cambia, hay que
 * cambiarlo acá también.
 */
const LOTE = 10;

/**
 * Búsqueda de productos por texto o por escaneo.
 *
 * Reemplaza al `SearchProductoDialogComponent` de `frc-mobile`, que era un
 * diálogo dentro de otros flujos. Acá es la pestaña **Buscar** de la barra
 * inferior: buscar un producto se hace todo el día, no es un paso dentro de
 * otra cosa.
 */
@Component({
  selector: 'frc-buscar-page',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    CardComponent,
    ImporteComponent,
    IconoComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Buscar">
      <div class="barra-busqueda">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
          <mat-label>Código o descripción</mat-label>
          <input
            matInput
            [value]="texto()"
            (input)="alEscribir($event)"
            (keydown.enter)="buscar()"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
          />
        </mat-form-field>

        <button
          type="button"
          class="escanear"
          (click)="escanearCodigo()"
          aria-label="Escanear código"
        >
          <frc-icono nombre="escanear" [tamano]="24" />
        </button>
      </div>

      @if (pesable(); as p) {
        <frc-seccion titulo="Producto pesado" [panel]="true">
          <div class="pesable">
            <div class="nombre">{{ p.producto.descripcion }}</div>
            <div class="linea">
              <span>{{ pesoLegible() }} kg</span>
              @if (precioPorKilo(); as precio) {
                <span class="por">
                  × <frc-importe [valor]="precio" moneda="Guaraní" simbolo="₲" /> por kg
                </span>
              }
            </div>
            @if (totalPesable(); as total) {
              <div class="total">
                <span>Total</span>
                <frc-importe [valor]="total" moneda="Guaraní" simbolo="₲" />
              </div>
            }
          </div>
        </frc-seccion>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" [conMiniatura]="true" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="buscar()" />
      } @else if (!buscado()) {
        <frc-estado-vacio
          titulo="Buscá un producto"
          detalle="Escribí el código o parte de la descripción, o tocá el ícono para escanear."
          icono="buscar"
        />
      } @else if (resultados().length === 0) {
        <frc-estado-vacio
          titulo="Sin resultados"
          [detalle]="'No se encontró nada para «' + ultimaBusqueda() + '».'"
          icono="buscar"
        />
      } @else {
        @for (producto of resultados(); track producto.id) {
          <frc-card
            [titulo]="producto.descripcion ?? 'Producto'"
            [subtitulo]="producto.codigoPrincipal ?? ''"
            icono="producto"
            (abrir)="abrir(producto)"
          >
            @if (producto.balanza) {
              <span pie class="marca">Balanza</span>
            }
            @if (producto.isEnvase) {
              <span pie class="marca">Envase</span>
            }
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
    .barra-busqueda {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
    }
    .campo { flex: 1; min-width: 0; }
    /*
      El botón de escanear tiene el alto del campo para que la fila no se
      vea desalineada, y ancho fijo: es un ícono, no debe repartirse espacio.
    */
    .escanear {
      flex-shrink: 0;
      width: 48px;
      height: 48px;
      display: grid;
      place-items: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--brand-text);
      cursor: pointer;
    }
    .escanear:hover { background: var(--surface-sunken); }
    .pesable { display: flex; flex-direction: column; gap: var(--sp-1); }
    .nombre { font-weight: var(--fw-medium); }
    .linea {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: var(--sp-2);
      color: var(--text-soft);
      font-size: var(--fs-label);
    }
    .por { display: inline-flex; align-items: baseline; gap: var(--sp-1); }
    .total {
      display: flex;
      justify-content: space-between;
      margin-top: var(--sp-2);
      padding-top: var(--sp-2);
      border-top: 1px solid var(--border-light);
      font-weight: var(--fw-medium);
    }
    .marca {
      font-size: var(--fs-caption);
      color: var(--text-mute);
    }
    .mas { align-self: center; margin-top: var(--sp-3); }
  `,
})
export class BuscarPage {
  private readonly busqueda = inject(ProductoBusquedaService);
  private readonly escaner = inject(EscanerService);
  private readonly notificacion = inject(NotificacionService);
  private readonly auth = inject(AuthService);

  readonly texto = signal('');
  readonly ultimaBusqueda = signal('');
  readonly resultados = signal<Producto[]>([]);
  readonly pesable = signal<ResultadoPesable | null>(null);
  readonly cargando = signal(false);
  readonly cargandoMas = signal(false);
  readonly hayMas = signal(false);
  readonly error = signal<string | null>(null);
  /** Distingue «todavía no buscaste» de «buscaste y no hay nada». */
  readonly buscado = signal(false);

  private offset = 0;

  readonly precioPorKilo = computed(() => precioDe(this.pesable()?.presentacion));

  /*
    El peso NO se formatea con el pipe `number`: la app no registra
    LOCALE_ID, así que el pipe usa en-US y 1,5 kg saldría como "1.500 kg"
    — que acá se lee como mil quinientos.
  */
  readonly pesoLegible = computed(() => formatearCantidad(this.pesable()?.peso, 3));

  /**
   * Peso × precio por kilo.
   *
   * No contradice la regla 6 —el dinero lo calcula el backend—: el precio de
   * un pesable **es** por kilo, y la cantidad viene en el código. Multiplicar
   * los dos es aplicar la unidad del precio que el backend ya mandó, no
   * decidir cuánto vale algo. Se redondea a guaraníes enteros, que es como se
   * cobra.
   */
  readonly totalPesable = computed(() => {
    const precio = this.precioPorKilo();
    const peso = this.pesable()?.peso;
    if (precio == null || peso == null) {
      return null;
    }
    return Math.round(precio * peso);
  });

  alEscribir(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }

  buscar(): void {
    const consulta = this.texto().trim();
    if (!consulta) {
      return;
    }
    this.offset = 0;
    this.pesable.set(null);
    this.ejecutar(consulta, false);
  }

  cargarMas(): void {
    this.offset += LOTE;
    this.cargandoMas.set(true);
    this.ejecutar(this.ultimaBusqueda(), true);
  }

  private ejecutar(consulta: string, agregando: boolean): void {
    if (!agregando) {
      this.cargando.set(true);
      this.resultados.set([]);
    }
    this.error.set(null);
    this.ultimaBusqueda.set(consulta);

    this.busqueda.buscarPorCodigoOTexto(consulta, this.offset).subscribe({
      next: (lista) => {
        const filas = lista ?? [];
        this.resultados.update((previas) => (agregando ? [...previas, ...filas] : filas));
        // El backend no manda total: una tanda completa es la única señal de
        // que puede haber más. Mismo criterio que en «Mi trabajo».
        this.hayMas.set(filas.length === LOTE);
        this.buscado.set(true);
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

  /**
   * Escanea y resuelve.
   *
   * ⚠️ Un código de balanza **no** entra por la búsqueda común: devuelve
   * producto y peso, y el peso se pierde si se lo trata como un código más.
   */
  async escanearCodigo(): Promise<void> {
    const codigo = await this.escaner.escanear({
      titulo: 'Escanear producto',
      ayuda: 'Apuntá al código de barras',
      formatos: FORMATOS_PRODUCTO,
      etiquetaManual: 'Código del producto',
    });
    if (!codigo) {
      return;
    }

    this.texto.set(codigo);

    if (this.busqueda.esPesable(codigo)) {
      this.buscarPesable(codigo);
      return;
    }
    this.buscar();
  }

  private buscarPesable(codigo: string): void {
    this.cargando.set(true);
    this.error.set(null);
    this.resultados.set([]);
    this.pesable.set(null);

    this.busqueda.pesable(codigo).subscribe({
      next: (resultado) => {
        this.cargando.set(false);
        this.buscado.set(true);
        this.ultimaBusqueda.set(codigo);
        this.hayMas.set(false);
        if (!resultado) {
          this.notificacion.warn('No se encontró el producto de ese código de balanza.');
          return;
        }
        this.pesable.set(resultado);
        this.resultados.set([resultado.producto]);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  /** Muestra la existencia en la sucursal de la sesión, que es lo que se pregunta. */
  abrir(producto: Producto): void {
    const sucursalId = this.auth.sucursal()?.id;
    if (producto.id == null) {
      return;
    }
    if (sucursalId == null) {
      this.notificacion.warn('La sesión no tiene sucursal: no se puede consultar el stock.');
      return;
    }
    this.busqueda.stock(producto.id, sucursalId).subscribe({
      next: (stock) => this.notificacion.ok(`${producto.descripcion}: ${stock} en stock`),
      error: () => this.notificacion.warn('No se pudo consultar el stock.'),
    });
  }
}
