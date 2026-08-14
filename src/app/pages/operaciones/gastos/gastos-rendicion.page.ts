import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { fotoADataUri } from 'src/app/core/dispositivo/imagen';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { PreGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { CampoImporteComponent } from 'src/app/shared/campos/campo-importe.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { GastosService } from './gastos.service';

/** Una foto ya reducida y lista para viajar. */
interface Foto {
  /** Data URI. El campo del backend se llama `...Url` pero recibe esto. */
  url: string;
  /** Para poder sacarla de la lista sin depender del índice. */
  clave: number;
}

/**
 * Rendir el gasto: en qué se gastó la plata que se retiró.
 *
 * Cierra el circuito que la PWA ya tenía a medias —solicitud, retiro con
 * QR— y que terminaba sin forma de rendir desde el teléfono, justo donde
 * más se necesita: con la factura en la mano, saliendo del comercio.
 *
 * ⚠️ **La factura es obligatoria y es la regla del negocio, no una
 * validación de formulario.** Sin comprobante no hay rendición: es lo que
 * separa un gasto rendido de plata que desapareció.
 *
 * ⚠️ **Un solo importe, y es a propósito.** `frc-mobile` ofrecía varias
 * filas con su moneda cada una, pero `GastoRendicionInput.montoTotal` es un
 * único `Float` **sin moneda**: al guardar mandaba solo la fila en
 * guaraníes y descartaba el resto sin avisar. Pedir un campo es lo único
 * que no miente sobre lo que el backend puede guardar. Que acepte más de
 * una moneda exige cambiar el central.
 */
@Component({
  selector: 'frc-gastos-rendicion',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    CampoImporteComponent,
    IconoComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Rendir gasto" [conVolver]="true" [conEscaner]="false">
      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (gasto(); as g) {
        <frc-seccion [titulo]="'Solicitud #' + g.id" [panel]="true">
          <frc-campo-importe
            etiqueta="Monto gastado"
            moneda="Guaraní"
            simbolo="₲"
            [valor]="monto()"
            (valorChange)="monto.set($event)"
          />
        </frc-seccion>

        @if (esCombustible()) {
          <frc-seccion titulo="Carga de combustible" [panel]="true">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Kilómetros del tablero</mat-label>
              <input matInput type="number" inputmode="numeric"
                [value]="km() ?? ''" (input)="km.set(aNumero($event))" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Litros cargados</mat-label>
              <input matInput type="number" inputmode="decimal"
                [value]="litros() ?? ''" (input)="litros.set(aNumero($event))" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Precio por litro</mat-label>
              <input matInput type="number" inputmode="decimal"
                [value]="precioLitro() ?? ''" (input)="precioLitro.set(aNumero($event))" />
            </mat-form-field>
          </frc-seccion>
        }

        @if (esAlimentacion()) {
          <frc-seccion titulo="Alimentación" [panel]="true">
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>Establecimiento</mat-label>
              <input matInput [value]="establecimiento()"
                (input)="establecimiento.set(aTexto($event))" />
            </mat-form-field>
          </frc-seccion>
        }

        <frc-seccion titulo="Dónde se hizo el gasto" [panel]="true">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Ubicación (opcional)</mat-label>
            <input matInput [value]="ubicacion()" (input)="ubicacion.set(aTexto($event))" />
          </mat-form-field>
        </frc-seccion>

        <frc-seccion titulo="Factura o comprobante">
          <p class="ayuda">Al menos una. Sin comprobante no se puede rendir.</p>
          <div class="fotos">
            @for (f of facturas(); track f.clave) {
              <div class="foto">
                <img [src]="f.url" alt="Factura" />
                <button type="button" class="quitar" aria-label="Quitar foto"
                  (click)="quitar('factura', f.clave)">
                  <frc-icono nombre="cerrar" [tamano]="16" />
                </button>
              </div>
            }
            <label class="agregar">
              <frc-icono nombre="camara" [tamano]="24" />
              <span>Agregar</span>
              <input type="file" accept="image/*" capture="environment"
                (change)="agregar('factura', $event)" />
            </label>
          </div>
        </frc-seccion>

        <frc-seccion titulo="Producto o servicio (opcional)">
          <div class="fotos">
            @for (f of productos(); track f.clave) {
              <div class="foto">
                <img [src]="f.url" alt="Producto" />
                <button type="button" class="quitar" aria-label="Quitar foto"
                  (click)="quitar('producto', f.clave)">
                  <frc-icono nombre="cerrar" [tamano]="16" />
                </button>
              </div>
            }
            <label class="agregar">
              <frc-icono nombre="camara" [tamano]="24" />
              <span>Agregar</span>
              <input type="file" accept="image/*" capture="environment"
                (change)="agregar('producto', $event)" />
            </label>
          </div>
        </frc-seccion>

        <div acciones>
          <button matButton="filled" [disabled]="!puedeGuardar()" (click)="guardar()">
            {{ guardando() ? 'Guardando…' : 'Registrar rendición' }}
          </button>
        </div>
      }
    </frc-pagina>
  `,
  styles: `
    .ayuda { margin: 0; font-size: var(--fs-label); color: var(--text-soft); }
    .fotos { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
    .foto { position: relative; width: 96px; height: 96px; }
    .foto img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }
    .quitar {
      position: absolute;
      top: calc(-1 * var(--sp-1));
      right: calc(-1 * var(--sp-1));
      width: var(--sp-6);
      height: var(--sp-6);
      border: none;
      border-radius: var(--radius-full);
      background: var(--danger-fill);
      color: var(--on-tono);
      cursor: pointer;
      display: grid;
      place-items: center;
      line-height: 0;
    }
    .agregar {
      width: 96px;
      height: 96px;
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--sp-1);
      font-size: var(--fs-caption);
      color: var(--text-soft);
      cursor: pointer;
    }
    .agregar frc-icono { color: var(--brand-text); }
    .agregar input { display: none; }
  `,
})
export class GastosRendicionPage {
  private readonly servicio = inject(GastosService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  readonly id = input<string>();
  readonly sucursalId = input<string>();

  readonly gasto = signal<PreGasto | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly monto = signal<number | null>(null);
  readonly km = signal<number | null>(null);
  readonly litros = signal<number | null>(null);
  readonly precioLitro = signal<number | null>(null);
  readonly establecimiento = signal('');
  readonly ubicacion = signal('');

  readonly facturas = signal<Foto[]>([]);
  readonly productos = signal<Foto[]>([]);
  private siguienteClave = 1;

  /**
   * Qué campos extra pide el tipo de gasto.
   *
   * ⚠️ **Se decide por el texto de la descripción**, igual que en
   * `frc-mobile`. No es elegante y no se cambia sin verificar: el
   * `moduloPadre` no distingue «combustible» de otro gasto de vehículo, y
   * los tipos cargados en el central no tienen una marca para esto.
   */
  readonly esCombustible = computed(() => {
    const t = this.gasto()?.tipoGasto;
    const desc = String(t?.descripcion ?? '').toUpperCase();
    return desc.includes('COMBUST') || desc.includes('GASOL') || t?.moduloPadre === 'VEHICULO';
  });

  readonly esAlimentacion = computed(() => {
    const desc = String(this.gasto()?.tipoGasto?.descripcion ?? '').toUpperCase();
    return desc.includes('ALIMENT') || desc.includes('COMIDA') || desc.includes('RESTAUR');
  });

  readonly puedeGuardar = computed(
    () => !this.guardando() && (this.monto() ?? 0) > 0 && this.facturas().length > 0,
  );

  constructor() {
    effect(() => {
      if (this.id() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.id());
    const sucId = Number(this.sucursalId());
    if (!Number.isFinite(id) || !Number.isFinite(sucId)) {
      this.error.set('Faltan la solicitud o la sucursal.');
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.servicio.porId(id, sucId).subscribe({
      next: (g) => {
        this.gasto.set(g ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  async agregar(cual: 'factura' | 'producto', evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    // El campo se limpia siempre: sin esto, elegir dos veces la misma foto
    // no dispara `change` la segunda vez.
    entrada.value = '';
    if (!archivo) {
      return;
    }

    try {
      const url = await fotoADataUri(archivo);
      const foto: Foto = { url, clave: this.siguienteClave++ };
      const destino = cual === 'factura' ? this.facturas : this.productos;
      destino.update((lista) => [...lista, foto]);
    } catch {
      this.notificacion.danger('No se pudo procesar la foto. Probá con otra.');
    }
  }

  quitar(cual: 'factura' | 'producto', clave: number): void {
    const destino = cual === 'factura' ? this.facturas : this.productos;
    destino.update((lista) => lista.filter((f) => f.clave !== clave));
  }

  guardar(): void {
    const g = this.gasto();
    if (!this.puedeGuardar() || g?.id == null) {
      return;
    }

    this.guardando.set(true);
    this.servicio
      .rendir({
        preGastoId: Number(g.id),
        sucursalId: Number(g.sucursalId ?? this.sucursalId()),
        montoTotal: this.monto(),
        fotosFacturaUrls: this.facturas().map((f) => f.url),
        // Ausente y no lista vacía: el backend distingue «no adjuntó» de
        // «adjuntó nada».
        fotosProductoUrls: this.productos().length
          ? this.productos().map((f) => f.url)
          : undefined,
        kmActual: this.esCombustible() ? this.km() ?? undefined : undefined,
        litros: this.esCombustible() ? this.litros() ?? undefined : undefined,
        precioPorLitro: this.esCombustible() ? this.precioLitro() ?? undefined : undefined,
        establecimientoAlimentacion: this.esAlimentacion()
          ? this.establecimiento().trim() || undefined
          : undefined,
        ubicacionProvisoria: this.ubicacion().trim() || undefined,
        usuarioId: this.auth.usuario()?.id,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          void this.router.navigate(['/operaciones/gastos', g.id, g.sucursalId ?? this.sucursalId()]);
        },
        error: () => this.guardando.set(false),
      });
  }

  aNumero(evento: Event): number | null {
    const crudo = (evento.target as HTMLInputElement).value;
    const n = Number(crudo);
    return crudo.trim() !== '' && Number.isFinite(n) ? n : null;
  }

  aTexto(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }
}
