import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CampoImporteComponent } from 'src/app/shared/campos/campo-importe.component';

export type TipoSolicitud = 'vale' | 'vacacion';

export interface SolicitudRrhhData {
  tipo: TipoSolicitud;
  /** Días disponibles, para avisar si el pedido los excede. */
  diasDisponibles?: number;
}

export interface SolicitudRrhhResultado {
  monto?: number;
  esAdelanto?: boolean;
  desde?: string;
  hasta?: string;
}

/** Hoy en `yyyy-MM-dd`, que es el formato que espera el central. */
function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Días entre dos fechas ISO, ambos extremos incluidos. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(desde);
  const b = Date.parse(hasta);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return 0;
  }
  return Math.floor((b - a) / 86_400_000) + 1;
}

/**
 * Pide un vale/adelanto o unas vacaciones.
 *
 * Un solo diálogo para las dos cosas: comparten forma —un pedido corto que se
 * manda a aprobación— y separarlos duplicaría la validación y el manejo del
 * resultado.
 */
@Component({
  selector: 'frc-solicitud-rrhh',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    CampoImporteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ esVale() ? 'Pedir vale o adelanto' : 'Pedir vacaciones' }}</h2>

    <mat-dialog-content>
      @if (esVale()) {
        <frc-campo-importe
          etiqueta="Monto"
          moneda="Guaraní"
          simbolo="₲"
          [valor]="monto()"
          (valorChange)="monto.set($event)"
          ayuda="El guaraní no lleva decimales: se redondea al salir del campo."
        />

        <mat-checkbox [checked]="esAdelanto()" (change)="esAdelanto.set($event.checked)">
          Es un adelanto de sueldo
        </mat-checkbox>
        <!--
          No es una casilla más: un adelanto sale del sueldo del mes en curso
          y un vale común se descuenta en cuotas. La liquidación los trata
          distinto, así que la diferencia se explica en vez de darse por
          sabida.
        -->
        <p class="ayuda">
          {{
            esAdelanto()
              ? 'Se descuenta completo de tu próximo sueldo.'
              : 'Se descuenta en cuotas, según lo que defina administración.'
          }}
        </p>
      } @else {
        <mat-form-field appearance="outline" class="campo">
          <mat-label>Desde</mat-label>
          <input matInput type="date" [value]="desde()" (input)="fijarDesde($event)" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="campo">
          <mat-label>Hasta</mat-label>
          <input matInput type="date" [min]="desde()" [value]="hasta()" (input)="fijarHasta($event)" />
        </mat-form-field>

        @if (dias() > 0) {
          <p class="ayuda">{{ dias() }} {{ dias() === 1 ? 'día' : 'días' }} de vacaciones.</p>
        }
        @if (excedeSaldo()) {
          <p class="aviso">
            Estás pidiendo más días de los que tenés disponibles
            ({{ data.diasDisponibles }}). Administración puede rechazarlo.
          </p>
        }
        @if (rangoInvalido()) {
          <p class="aviso">La fecha de fin no puede ser anterior a la de inicio.</p>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton (click)="cerrar()">Cancelar</button>
      <button matButton="filled" [disabled]="!valido()" (click)="aceptar()">Solicitar</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      padding-top: var(--sp-4);
      overflow: visible;
    }
    .campo { width: 100%; }
    .ayuda {
      margin: 0;
      color: var(--text-soft);
      font-size: var(--fs-caption);
    }
    .aviso {
      margin: 0;
      color: var(--warn);
      font-size: var(--fs-label);
    }
  `,
})
export class SolicitudRrhhDialogComponent {
  readonly data = inject<SolicitudRrhhData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<SolicitudRrhhDialogComponent, SolicitudRrhhResultado | undefined>>(
      MatDialogRef,
    );

  readonly esVale = computed(() => this.data.tipo === 'vale');

  readonly monto = signal<number | null>(null);
  readonly esAdelanto = signal(false);
  readonly desde = signal(hoyIso());
  readonly hasta = signal(hoyIso());

  readonly dias = computed(() => diasEntre(this.desde(), this.hasta()));
  readonly rangoInvalido = computed(() => this.dias() <= 0);
  readonly excedeSaldo = computed(() => {
    const saldo = this.data.diasDisponibles;
    return saldo != null && this.dias() > saldo;
  });

  /**
   * Exceder el saldo **no** invalida el pedido: el saldo se puede negociar y
   * quien decide es administración. Se avisa y se deja mandar.
   */
  readonly valido = computed(() =>
    this.esVale() ? (this.monto() ?? 0) > 0 : !this.rangoInvalido(),
  );

  fijarDesde(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.desde.set(valor);
    // Mantener un rango imposible obliga a corregir dos campos en vez de uno.
    if (this.hasta() < valor) {
      this.hasta.set(valor);
    }
  }

  fijarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value);
  }

  aceptar(): void {
    if (!this.valido()) {
      return;
    }
    this.ref.close(
      this.esVale()
        ? { monto: this.monto() ?? 0, esAdelanto: this.esAdelanto() }
        : { desde: this.desde(), hasta: this.hasta() },
    );
  }

  cerrar(): void {
    this.ref.close(undefined);
  }
}
