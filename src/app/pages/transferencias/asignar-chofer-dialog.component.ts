import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import type { Vehiculo } from 'src/app/domains/gastos/ente.model';
import type { Persona } from 'src/app/domains/personas/persona.model';
import { UsuarioService } from 'src/app/domains/personas/usuario.service';
import type { Usuario } from 'src/app/domains/personas/usuario.model';
import { EtapaTransferencia } from 'src/app/domains/transferencia/transferencia.model';
import { BuscadorComponent, ConfigBuscador } from 'src/app/shared/buscador/buscador.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { AVISO_ETAPA } from './etapas';
import { TransferenciaService } from './transferencia.service';

export interface AsignarChoferData {
  transferenciaId: number;
}

type Acompanante = Pick<Persona, 'id' | 'nombre'>;

/**
 * Chofer, vehículo y acompañantes antes de verificar para transporte.
 *
 * ⚠️ **El chofer elegido queda como responsable de la etapa**, no el que
 * tiene la sesión abierta, aunque revisar y despachar lo puede hacer cualquiera. Por eso
 * se elige un `Usuario` —el responsable lo es— y el central toma su persona
 * para la hoja de ruta.
 *
 * El diálogo hace la mutation él mismo y se cierra con `true` solo si el
 * central la aceptó: si la rechaza, queda abierto con lo cargado.
 */
@Component({
  selector: 'frc-asignar-chofer-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, IconoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Verificar para transporte</h2>

    <mat-dialog-content class="cuerpo">
      <p class="aviso">
        El chofer queda como responsable de la verificación para transporte.
      </p>

      <section class="campo">
        <span class="etiqueta">Chofer</span>
        <p class="valor" [class.vacio]="!chofer()">{{ nombreChofer() }}</p>
        <button matButton="tonal" type="button" [disabled]="enviando()" (click)="elegirChofer()">
          {{ chofer() ? 'Cambiar chofer' : 'Elegir chofer' }}
        </button>
      </section>

      <section class="campo">
        <span class="etiqueta">Vehículo</span>
        <p class="valor" [class.vacio]="!vehiculo()">{{ nombreVehiculo() }}</p>
        <button matButton="tonal" type="button" [disabled]="enviando()" (click)="elegirVehiculo()">
          {{ vehiculo() ? 'Cambiar vehículo' : 'Elegir vehículo' }}
        </button>
      </section>

      <section class="campo">
        <span class="etiqueta">Acompañantes</span>
        @for (p of acompanantes(); track p.id) {
          <div class="acompanante">
            <span>{{ p.nombre }}</span>
            <button
              matIconButton
              type="button"
              [attr.aria-label]="'Quitar a ' + p.nombre"
              [disabled]="enviando()"
              (click)="quitarAcompanante(p)"
            >
              <frc-icono nombre="cerrar" [tamano]="18" />
            </button>
          </div>
        } @empty {
          <p class="valor vacio">Sin acompañantes</p>
        }
        <button matButton type="button" [disabled]="enviando()" (click)="agregarAcompanante()">
          Agregar acompañante
        </button>
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button matButton type="button" [disabled]="enviando()" (click)="cerrar()">Cancelar</button>
      <button
        matButton="filled"
        type="button"
        [disabled]="!puedeConfirmar() || enviando()"
        (click)="confirmar()"
      >
        {{ enviando() ? 'Enviando…' : 'Confirmar y verificar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .cuerpo { display: flex; flex-direction: column; gap: var(--sp-4); }
    .aviso { margin: 0; font-size: var(--fs-label); color: var(--text-soft); }
    .campo { display: flex; flex-direction: column; align-items: flex-start; gap: var(--sp-1); }
    .etiqueta { font-size: var(--fs-caption); color: var(--text-mute); }
    .valor { margin: 0; font-weight: var(--fw-medium); }
    .vacio { font-weight: var(--fw-regular); color: var(--text-mute); }
    .acompanante {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
  `,
})
export class AsignarChoferDialogComponent {
  readonly data = inject<AsignarChoferData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<AsignarChoferDialogComponent, boolean | undefined>>(MatDialogRef);
  private readonly servicio = inject(TransferenciaService);
  private readonly usuarios = inject(UsuarioService);
  private readonly dialogo = inject(DialogoService);

  readonly chofer = signal<Usuario | null>(null);
  readonly vehiculo = signal<Vehiculo | null>(null);
  readonly acompanantes = signal<Acompanante[]>([]);
  readonly enviando = signal(false);

  readonly nombreChofer = computed(() => {
    const u = this.chofer();
    return u ? nombreDeUsuario(u) : 'Sin elegir';
  });

  readonly nombreVehiculo = computed(() => {
    const v = this.vehiculo();
    return v ? descripcionVehiculo(v) : 'Sin elegir';
  });

  readonly puedeConfirmar = computed(() => this.chofer() != null && this.vehiculo() != null);

  async elegirChofer(): Promise<void> {
    const elegido = await this.dialogo.abrir<BuscadorComponent<Usuario>, ConfigBuscador<Usuario>, Usuario>(
      BuscadorComponent,
      {
        modo: 'paginado',
        titulo: 'Elegir chofer',
        placeholder: 'Buscar usuario',
        // `usuarioSearch` no pagina: devuelve la lista entera para el texto.
        cargarPagina: async (texto) => ({
          items: (await firstValueFrom(this.usuarios.buscar(texto))) ?? [],
          hayMas: false,
        }),
        texto: nombreDeUsuario,
        id: (u) => u.id,
      },
    );
    if (!elegido) {
      return;
    }
    this.chofer.set(elegido);
    // Si ya figuraba como acompañante, deja de serlo: no puede ir dos veces.
    const personaId = elegido.persona?.id;
    this.acompanantes.update((lista) => lista.filter((p) => p.id !== personaId));
  }

  async elegirVehiculo(): Promise<void> {
    const elegido = await this.dialogo.abrir<BuscadorComponent<Vehiculo>, ConfigBuscador<Vehiculo>, Vehiculo>(
      BuscadorComponent,
      {
        modo: 'paginado',
        titulo: 'Elegir vehículo',
        placeholder: 'Chapa, marca o modelo',
        cargarPagina: (texto, pagina) => this.servicio.buscarVehiculos(texto, pagina),
        texto: descripcionVehiculo,
        id: (v) => v.id,
      },
    );
    if (elegido) {
      this.vehiculo.set(elegido);
    }
  }

  async agregarAcompanante(): Promise<void> {
    const elegido = await this.dialogo.abrir<BuscadorComponent<Persona>, ConfigBuscador<Persona>, Persona>(
      BuscadorComponent,
      {
        modo: 'paginado',
        titulo: 'Agregar acompañante',
        placeholder: 'Nombre o documento',
        cargarPagina: (texto, pagina) => this.servicio.buscarPersonas(texto, pagina),
        texto: (p) => p.nombre,
        id: (p) => p.id,
        detalle: (p) => p.documento ?? '',
      },
    );
    if (!elegido) {
      return;
    }
    if (elegido.id === this.chofer()?.persona?.id) {
      return;
    }
    if (this.acompanantes().some((p) => p.id === elegido.id)) {
      return;
    }
    this.acompanantes.update((lista) => [...lista, { id: elegido.id, nombre: elegido.nombre }]);
  }

  quitarAcompanante(persona: Acompanante): void {
    this.acompanantes.update((lista) => lista.filter((p) => p.id !== persona.id));
  }

  async confirmar(): Promise<void> {
    const chofer = this.chofer();
    const vehiculo = this.vehiculo();
    if (chofer?.id == null || vehiculo?.id == null || this.enviando()) {
      return;
    }

    const confirmado = await this.dialogo.confirmar({
      titulo: 'Revisá los datos antes de continuar',
      mensaje:
        nombreDeUsuario(chofer) +
        ' queda como chofer y responsable de la verificación para transporte. ' +
        AVISO_ETAPA[EtapaTransferencia.TRANSPORTE_VERIFICACION],
      confirmar: 'Verificar para transporte',
    });
    if (!confirmado) {
      return;
    }

    this.enviando.set(true);
    try {
      await firstValueFrom(
        this.servicio.verificarParaTransporte({
          transferenciaId: this.data.transferenciaId,
          choferUsuarioId: chofer.id,
          vehiculoId: vehiculo.id,
          acompanantesIds: this.acompanantes().map((p) => p.id),
        }),
      );
      this.ref.close(true);
    } catch {
      // `DatosService` ya mostró el motivo; se queda abierto con lo cargado.
    } finally {
      this.enviando.set(false);
    }
  }

  cerrar(): void {
    this.ref.close(undefined);
  }
}

function nombreDeUsuario(usuario: Usuario): string {
  return usuario.persona?.nombre ?? usuario.nickname ?? `Usuario ${usuario.id}`;
}

function descripcionVehiculo(v: Vehiculo): string {
  const modelo = [v.modelo?.marca?.descripcion, v.modelo?.descripcion].filter(Boolean).join(' ');
  return [v.chapa, modelo].filter(Boolean).join(' · ') || `Vehículo ${v.id}`;
}
