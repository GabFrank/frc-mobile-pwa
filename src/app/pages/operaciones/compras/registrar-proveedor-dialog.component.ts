import { ChangeDetectionStrategy, Component, computed, inject, signal, type WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import type { CampoPersona, ProveedorDeFactura } from 'src/app/domains/compras/compras.model';
import { aId } from './compras-reglas';
import { ComprasService } from './compras.service';

/** De dónde salen los datos: el QR / CDC del KuDE, o la factura ya guardada (papel). */
export interface RegistrarProveedorData {
  qr?: string;
  documentoId?: number | string;
}

export interface RegistrarProveedorResultado {
  proveedorId: number;
  proveedorNombre: string;
}

/** Lo mismo que propone el alta del desktop. */
const CHEQUE_DIAS = 8;

/**
 * «Registrar proveedor» con los datos de su factura, cuando el RUC no es de
 * ningún proveedor cargado.
 *
 * El central arma la sugerencia —de la factura de SIFEN o de lo que leyó la IA
 * en el papel— y el comprador solo corrige textos: **el RUC no se edita**, sale
 * siempre de la factura guardada. Si ya existe una persona con ese documento
 * (por ejemplo, un cliente), el alta la reutiliza y no pisa sus datos.
 *
 * Cierra con el proveedor (nuevo o el que ya existía) o sin nada si se cancela.
 */
@Component({
  selector: 'frc-registrar-proveedor-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatCheckboxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Registrar proveedor</h2>
    <mat-dialog-content>
      @if (cargando()) {
        <p class="ayuda" role="status">Leyendo los datos de la factura…</p>
      } @else if (error()) {
        <p class="error">{{ error() }}</p>
        <button matButton (click)="cargar()">Reintentar</button>
      } @else if (datos(); as d) {
        <p class="ruc">
          <span class="etiqueta">RUC</span>
          <strong>{{ ruc(d) }}</strong>
          <span class="ayuda">{{ d.origen === 'FOTO' ? 'Leído de la foto' : 'De la factura electrónica' }}</span>
        </p>

        @if (d.proveedorId) {
          <p class="aviso">Ya es el proveedor <strong>{{ d.proveedorNombre }}</strong>.</p>
        } @else if (!d.puedeRegistrar) {
          <p class="error">{{ d.motivo }}</p>
        } @else {
          @if (d.personaId) {
            <p class="aviso">
              Ya hay una persona con ese documento ({{ d.personaNombre }}): se la usa como proveedor. Sus datos
              cargados no cambian salvo que marques «Actualizar con el de la factura»; los que le faltan se completan.
            </p>
          }

          @for (c of campos; track c.campo) {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ c.etiqueta }}</mat-label>
              <input
                matInput
                [type]="c.tipo"
                [attr.inputmode]="c.tipo === 'text' ? null : c.tipo"
                [value]="c.valor()"
                (input)="c.valor.set(valor($event))"
                [disabled]="bloqueado(c.campo)"
              />
              @if (bloqueado(c.campo)) {
                <mat-hint>Dato actual de la persona</mat-hint>
              } @else if (c.campo === 'direccion' && d.ciudad) {
                <mat-hint>{{ d.ciudad }}</mat-hint>
              }
            </mat-form-field>
            @if (deLaFactura(c.campo); as nuevo) {
              <mat-checkbox class="actualizar" [checked]="actualizando(c.campo)" (change)="actualizar(c.campo, $event.checked)">
                Actualizar con el de la factura: <strong>{{ nuevo }}</strong>
              </mat-checkbox>
            }
          }

          <mat-checkbox [checked]="credito()" (change)="credito.set($event.checked)">Compra a crédito</mat-checkbox>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Días de cheque</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              min="1"
              max="365"
              [value]="chequeDias()"
              (input)="chequeDias.set(entero($event))"
            />
          </mat-form-field>

          @if (errorGuardar()) {
            <p class="error">{{ errorGuardar() }}</p>
          }
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton (click)="ref.close()">Cancelar</button>
      @if (datos()?.proveedorId) {
        <button matButton="filled" (click)="usarExistente()">Usar este proveedor</button>
      } @else if (datos()?.puedeRegistrar) {
        <button matButton="filled" [disabled]="!valido()" (click)="guardar()">
          {{ guardando() ? 'Registrando…' : 'Registrar' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content { display: flex; flex-direction: column; gap: var(--sp-3); }
    .ruc { display: flex; flex-direction: column; margin: 0; }
    .etiqueta { font-size: var(--fs-caption); color: var(--text-mute); }
    .ayuda { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .aviso { margin: 0; font-size: var(--fs-label); }
    .error { margin: 0; font-size: var(--fs-label); color: var(--danger); }
    .actualizar { margin-top: calc(-1 * var(--sp-2)); font-size: var(--fs-label); }
  `,
})
export class RegistrarProveedorDialogComponent {
  readonly data = inject<RegistrarProveedorData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<RegistrarProveedorDialogComponent, RegistrarProveedorResultado>>(MatDialogRef);
  private readonly servicio = inject(ComprasService);

  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly datos = signal<ProveedorDeFactura | null>(null);
  readonly guardando = signal(false);
  readonly errorGuardar = signal<string | null>(null);

  readonly nombre = signal('');
  readonly fantasia = signal('');
  readonly direccion = signal('');
  readonly telefono = signal('');
  readonly email = signal('');
  readonly credito = signal(false);
  readonly chequeDias = signal<number | null>(CHEQUE_DIAS);
  /** Datos de la persona existente que se pisan con los de la factura (los marcó el comprador). */
  readonly aActualizar = signal<ReadonlySet<CampoPersona>>(new Set());

  readonly campos: { campo: CampoPersona; etiqueta: string; tipo: 'text' | 'tel' | 'email'; valor: WritableSignal<string> }[] = [
    { campo: 'nombre', etiqueta: 'Razón social', tipo: 'text', valor: this.nombre },
    { campo: 'nombreFantasia', etiqueta: 'Nombre de fantasía', tipo: 'text', valor: this.fantasia },
    { campo: 'direccion', etiqueta: 'Dirección', tipo: 'text', valor: this.direccion },
    { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'tel', valor: this.telefono },
    { campo: 'email', etiqueta: 'Email', tipo: 'email', valor: this.email },
  ];

  readonly valido = computed(() => {
    const dias = this.chequeDias();
    return (
      !this.guardando() &&
      (this.nombre().trim().length >= 2 || (!!this.datos()?.personaId && !this.actualizando('nombre'))) &&
      dias != null &&
      dias >= 1 &&
      dias <= 365
    );
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.proveedorDeFactura({ qr: this.data.qr, documentoId: this.data.documentoId }).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.nombre.set(d.personaNombre ?? d.nombre ?? '');
        this.fantasia.set(d.nombreFantasia ?? '');
        this.direccion.set(d.direccion ?? '');
        this.telefono.set(d.telefono ?? '');
        this.email.set(d.email ?? '');
        this.credito.set(d.credito === true);
        this.aActualizar.set(new Set());
        this.cargando.set(false);
      },
      error: (e: Error) => {
        this.error.set(e.message || 'No se pudieron leer los datos de la factura.');
        this.cargando.set(false);
      },
    });
  }

  guardar(): void {
    const d = this.datos();
    if (!d?.documentoId || !this.valido()) return;
    this.guardando.set(true);
    this.errorGuardar.set(null);
    this.servicio
      .registrarProveedorDeFactura({
        documentoId: d.documentoId,
        nombre: texto(this.nombre()),
        nombreFantasia: texto(this.fantasia()),
        direccion: texto(this.direccion()),
        telefono: texto(this.telefono()),
        email: texto(this.email()),
        credito: this.credito(),
        chequeDias: this.chequeDias(),
        actualizarPersona: d.personaId ? [...this.aActualizar()] : null,
      })
      .subscribe({
        next: (r) => this.cerrarCon(r),
        error: (e: Error) => {
          this.errorGuardar.set(e.message || 'No se pudo registrar el proveedor.');
          this.guardando.set(false);
        },
      });
  }

  usarExistente(): void {
    const d = this.datos();
    if (d) this.cerrarCon(d);
  }

  /** El dato que la persona existente ya tiene y no se va a actualizar: se muestra y no se edita. */
  bloqueado(campo: CampoPersona): boolean {
    return !!this.dato(campo) && !this.actualizando(campo);
  }

  /** El dato distinto que trae la factura, para ofrecer actualizar el de la persona. */
  deLaFactura(campo: CampoPersona): string | null {
    return this.dato(campo)?.factura ?? null;
  }

  actualizando(campo: CampoPersona): boolean {
    return this.aActualizar().has(campo);
  }

  /** Marcar pone el dato de la factura (editable); desmarcar vuelve al que tenía la persona. */
  actualizar(campo: CampoPersona, si: boolean): void {
    const dato = this.dato(campo);
    const c = this.campos.find((x) => x.campo === campo);
    if (!dato || !c) return;
    const set = new Set(this.aActualizar());
    if (si) set.add(campo);
    else set.delete(campo);
    this.aActualizar.set(set);
    c.valor.set((si ? dato.factura : dato.actual) ?? '');
  }

  private dato(campo: CampoPersona) {
    return this.datos()?.datosDePersona?.find((x) => x.campo === campo) ?? null;
  }

  ruc(d: ProveedorDeFactura): string {
    return (d.ruc ?? 'sin RUC') + (d.dv ? '-' + d.dv : '');
  }

  valor(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  entero(evento: Event): number | null {
    const n = Number(this.valor(evento));
    return Number.isInteger(n) ? n : null;
  }

  private cerrarCon(d: ProveedorDeFactura): void {
    const id = aId(d.proveedorId);
    if (id == null) {
      this.errorGuardar.set('El central no devolvió el proveedor.');
      this.guardando.set(false);
      return;
    }
    this.ref.close({ proveedorId: id, proveedorNombre: d.proveedorNombre ?? d.nombre ?? '' });
  }
}

function texto(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}
