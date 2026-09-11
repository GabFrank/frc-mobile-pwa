import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from 'src/app/core/auth/auth.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import {
  VentaTarjeta,
  VentaTarjetaEstado,
  VentaTarjetaInput,
} from 'src/app/domains/venta-tarjeta/venta-tarjeta.model';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { VentaTarjetaService } from './venta-tarjeta.service';

/**
 * Registro del cupón: código de autorización y número de boleta.
 *
 * ⚠️ **El monto no se edita.** Es el de la venta, que ya está cobrada; lo que
 * falta es el respaldo del cupón. Dejarlo editable permitiría registrar un
 * importe que no cuadra con la caja.
 *
 * ⚠️ **La sucursal viene del QR**, no de la sesión ni de la caja. El QR lo
 * genera la filial y su `sucursalId` es el que enruta el guardado al backend
 * correcto: el central puede tener otro id para la misma sucursal.
 *
 * ⚠️ **Sin OCR.** En `frc-mobile` había que fotografiar el cupón y un plugin
 * de ML Kit extraía el monto a `montoEscaneado` para contrastarlo con el de
 * la venta. Eso no tiene equivalente web hoy, así que **no se pide la foto**:
 * en el repo anterior la imagen tampoco se guardaba —`imagenUrl` nunca viaja
 * en el input—, existía solo para alimentar el OCR. El campo se conserva en
 * el modelo para no perder el dato que sí carga el desktop.
 */
@Component({
  selector: 'frc-venta-tarjeta-registro',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    ImporteComponent,
    SkeletonComponent,
    EstadoErrorComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Registrar cupón" [conVolver]="true">
      <div acciones>
        <button matButton="filled" [disabled]="!valido()" (click)="guardar()">
          {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>

      @if (cargando()) {
        <frc-skeleton [cantidad]="3" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else {
        <frc-seccion titulo="Venta" [panel]="true">
          <frc-dato etiqueta="Venta" [valor]="ventaId() ?? '—'" />
          <frc-dato etiqueta="Monto">
            <frc-importe [valor]="montoNumero()" [moneda]="moneda()" [simbolo]="simbolo()" />
          </frc-dato>
          @if (registro()?.terminalPos; as t) {
            <frc-dato etiqueta="Terminal" [valor]="t.descripcion ?? t.codigo ?? '—'" />
          }
        </frc-seccion>

        <mat-form-field appearance="outline" class="campo">
          <mat-label>Código de autorización</mat-label>
          <input
            matInput
            cdkFocusInitial
            [ngModel]="codigo()"
            (ngModelChange)="codigo.set($event)"
            autocapitalize="characters"
            autocomplete="off"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="campo">
          <mat-label>Número de boleta</mat-label>
          <input
            matInput
            [ngModel]="boleta()"
            (ngModelChange)="boleta.set($event)"
            autocomplete="off"
          />
        </mat-form-field>
      }
    </frc-pagina>
  `,
  styles: `
    .campo { width: 100%; }
  `,
})
export class VentaTarjetaRegistroPage {
  private readonly servicio = inject(VentaTarjetaService);
  private readonly auth = inject(AuthService);
  private readonly notificacion = inject(NotificacionService);
  private readonly router = inject(Router);

  // Llegan por queryParams. Inputs opcionales: el router los asigna después
  // de construir el componente (ver `caja-detalle`, NG0950).
  readonly ventaId = input<string>();
  readonly cajaId = input<string>();
  readonly monto = input<string>();
  readonly sucursalId = input<string>();
  readonly ventaTarjetaId = input<string>();

  readonly registro = signal<VentaTarjeta | null>(null);
  readonly codigo = signal('');
  readonly boleta = signal('');
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly montoNumero = computed(() => {
    const delRegistro = this.registro()?.monto;
    return delRegistro ?? Number(this.monto() ?? 0);
  });
  readonly moneda = computed(
    () => this.registro()?.terminalPos?.moneda?.denominacion ?? 'Guaraní',
  );
  readonly simbolo = computed(() => this.registro()?.terminalPos?.moneda?.simbolo ?? '₲');

  /** Los dos campos son obligatorios: el cupón sin ellos no concilia nada. */
  readonly valido = computed(
    () => this.codigo().trim().length > 0 && this.boleta().trim().length > 0 && !this.guardando(),
  );

  constructor() {
    effect(() => {
      if (this.ventaId() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const sucId = Number(this.sucursalId());
    const ventaTarjetaId = Number(this.ventaTarjetaId());
    const ventaId = Number(this.ventaId());

    if (!Number.isFinite(sucId)) {
      this.error.set('El QR no trae la sucursal.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    // El desktop suele haber creado ya el registro como PENDIENTE; en ese
    // caso el QR trae su id y se completa ese, no se crea otro.
    const consulta = Number.isFinite(ventaTarjetaId)
      ? this.servicio.porId(ventaTarjetaId, sucId)
      : this.servicio.porVenta(ventaId, sucId);

    consulta.subscribe({
      next: (registro) => {
        this.registro.set(registro ?? null);
        if (registro?.codigoAutorizacion) {
          this.codigo.set(registro.codigoAutorizacion);
        }
        if (registro?.numeroBoleta) {
          this.boleta.set(registro.numeroBoleta);
        }
        this.cargando.set(false);
      },
      // Que no exista un registro previo no es un error: se crea uno nuevo.
      error: () => this.cargando.set(false),
    });
  }

  guardar(): void {
    const usuarioId = this.auth.usuario()?.id;
    const sucId = Number(this.sucursalId());
    if (usuarioId == null || !Number.isFinite(sucId)) {
      this.notificacion.danger('Faltan datos de la sesión o del QR.');
      return;
    }

    const existente = this.registro();
    const input: VentaTarjetaInput = {
      id: existente?.id,
      sucursalId: sucId,
      ventaId: Number(this.ventaId()),
      cajaId: Number(this.cajaId()),
      codigoAutorizacion: this.codigo().trim(),
      numeroBoleta: this.boleta().trim(),
      monto: this.montoNumero(),
      estado: VentaTarjetaEstado.COMPLETADO,
      usuarioId,
    };

    this.guardando.set(true);
    const peticion = existente?.id
      ? this.servicio.actualizar(input)
      : this.servicio.guardar(input);

    peticion.subscribe({
      next: (res) => {
        this.guardando.set(false);
        if (res?.id) {
          this.notificacion.ok('Cupón registrado.');
          void this.router.navigate(['/operaciones/venta-tarjeta'], { replaceUrl: true });
        } else {
          this.notificacion.danger('No se pudo guardar el cupón.');
        }
      },
      error: (err: Error) => {
        this.guardando.set(false);
        this.notificacion.danger(err.message);
      },
    });
  }
}
