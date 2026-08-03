import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { comparatorLike } from 'src/app/generic/utils/string-utils';
import { EstadoVacioComponent } from '../estados-ui/estado-vacio.component';
import { SkeletonComponent } from '../estados-ui/skeleton.component';

/** Catálogo chico y estable, ya en memoria. */
export interface ConfigBuscadorLocal<T> {
  modo: 'local';
  titulo: string;
  placeholder?: string;
  items: T[];
  texto: (item: T) => string;
  id: (item: T) => unknown;
  detalle?: (item: T) => string;
}

/** Colección que crece: se pagina contra el backend. */
export interface ConfigBuscadorPaginado<T> {
  modo: 'paginado';
  titulo: string;
  placeholder?: string;
  cargarPagina: (texto: string, pagina: number) => Promise<{ items: T[]; hayMas: boolean }>;
  texto: (item: T) => string;
  id: (item: T) => unknown;
  detalle?: (item: T) => string;
  debounceMs?: number;
}

export type ConfigBuscador<T> = ConfigBuscadorLocal<T> | ConfigBuscadorPaginado<T>;

/**
 * Buscador de entidad. El componente estándar para "elegir uno de una lista".
 *
 * Elegí `local` para catálogos chicos y estables (sucursales, formas de pago)
 * y `paginado` para lo que crece (productos, clientes).
 *
 * ⚠️ En modo paginado, `cargarPagina` debe devolver `hayMas: false` cuando se
 * acaba; si no, el scroll sigue pidiendo páginas vacías indefinidamente.
 */
@Component({
  selector: 'frc-buscador',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    SkeletonComponent,
    EstadoVacioComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ config.titulo }}</h2>

    <mat-dialog-content class="cuerpo">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="campo">
        <mat-label>{{ config.placeholder ?? 'Buscar' }}</mat-label>
        <input matInput [value]="consulta()" (input)="alEscribir($event)" autocomplete="off" />
      </mat-form-field>

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (resultados().length === 0) {
        <frc-estado-vacio
          titulo="Sin resultados"
          detalle="Probá con otro texto o revisá que el dato exista."
          icono="buscar"
        />
      } @else {
        <ul class="lista">
          @for (item of resultados(); track config.id(item)) {
            <li>
              <button type="button" class="fila" (click)="elegir(item)">
                <span class="texto">{{ config.texto(item) }}</span>
                @if (config.detalle) {
                  <span class="detalle">{{ config.detalle(item) }}</span>
                }
              </button>
            </li>
          }
        </ul>
        @if (hayMas()) {
          <button matButton (click)="cargarMas()" class="mas">Cargar más</button>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Cancelar</button>
    </mat-dialog-actions>
  `,
  styles: `
    .cuerpo {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      min-height: 220px;
    }
    .campo { width: 100%; }
    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
    }
    .fila {
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      border-radius: var(--radius-sm);
      padding: var(--sp-3);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font: inherit;
      color: var(--text);
    }
    .fila:hover { background: var(--surface-sunken); }
    .fila:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
    .detalle { font-size: var(--fs-caption); color: var(--text-soft); }
    .mas { align-self: center; }
  `,
})
export class BuscadorComponent<T> {
  readonly config = inject<ConfigBuscador<T>>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<BuscadorComponent<T>, T | undefined>);

  readonly consulta = signal('');
  readonly resultados = signal<T[]>([]);
  readonly cargando = signal(false);
  readonly hayMas = signal(false);

  private pagina = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // El debounce puede quedar pendiente cuando el usuario cierra el diálogo:
    // sin esto disparaba una consulta y mutaba signals de una instancia ya
    // destruida.
    inject(DestroyRef).onDestroy(() => this.limpiarTimer());
    this.buscar();
  }

  private limpiarTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  alEscribir(evento: Event): void {
    this.consulta.set((evento.target as HTMLInputElement).value);
    if (this.config.modo === 'local') {
      this.buscar();
      return;
    }
    // En modo paginado se espera a que el usuario deje de tipear, para no
    // disparar una consulta por tecla.
    this.limpiarTimer();
    this.timer = setTimeout(() => this.buscar(), this.config.debounceMs ?? 300);
  }

  private buscar(): void {
    this.pagina = 0;
    if (this.config.modo === 'local') {
      const q = this.consulta();
      this.resultados.set(
        this.config.items.filter((i) => comparatorLike(q, this.config.texto(i))),
      );
      this.hayMas.set(false);
      return;
    }
    this.cargarPagina(0, true);
  }

  cargarMas(): void {
    this.cargarPagina(this.pagina + 1, false);
  }

  private cargarPagina(pagina: number, reemplazar: boolean): void {
    if (this.config.modo !== 'paginado') {
      return;
    }
    this.cargando.set(reemplazar);
    this.config
      .cargarPagina(this.consulta(), pagina)
      .then(({ items, hayMas }) => {
        this.pagina = pagina;
        this.resultados.update((previos) => (reemplazar ? items : [...previos, ...items]));
        this.hayMas.set(hayMas);
      })
      .catch(() => {
        this.resultados.set([]);
        this.hayMas.set(false);
      })
      .finally(() => this.cargando.set(false));
  }

  elegir(item: T): void {
    this.limpiarTimer();
    this.ref.close(item);
  }
}
