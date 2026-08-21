import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import { TemaService } from '../core/tema/tema.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import {
  BuscadorComponent,
  CampoImporteComponent,
  CardComponent,
  DatoComponent,
  EstadoChipComponent,
  EstadoErrorComponent,
  EstadoVacioComponent,
  IconoComponent,
  ImporteComponent,
  PaginaComponent,
  PaginacionComponent,
  SeccionComponent,
  SelectorComponent,
  SkeletonComponent,
  estadosRegistrados,
  iconosDisponibles,
} from '../shared';
import type { ConfigBuscadorLocal } from '../shared/buscador/buscador.component';

/**
 * Galería viva del sistema de diseño.
 *
 * Ruta `/design-system`, **solo en desarrollo** (ver `app.routes.ts`).
 *
 * Es la referencia de trabajo: antes de escribir una pantalla nueva, mirá acá
 * qué existe. Y si algo no se puede resolver con lo que hay, eso es lo que
 * falta definir — no una licencia para inventar un componente suelto.
 */
@Component({
  selector: 'frc-galeria',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    ImporteComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    SelectorComponent,
    CampoImporteComponent,
    PaginacionComponent,
    IconoComponent,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Sistema de diseño">
      <p class="intro">
        Cada componente con todas sus variantes. Aprobado en el Gate 1. Los valores viven en
        <code>styles/_tokens.scss</code>, el único archivo del proyecto que puede contener un hex
        o un espaciado literal.
      </p>

      <frc-seccion titulo="Tema">
        <div class="fila">
          <button matButton="outlined" (click)="tema.alternar()">
            Cambiar a {{ tema.esOscuroEfectivo() ? 'claro' : 'oscuro' }}
          </button>
        </div>
      </frc-seccion>

      <frc-seccion titulo="Botones">
        <div class="fila">
          <button matButton="filled">Guardar</button>
          <button matButton="outlined">Cancelar</button>
          <button matButton>Ver detalle</button>
          <button matButton="filled" class="destructivo">Eliminar</button>
        </div>
        <div class="fila">
          <button matButton="filled" disabled>Deshabilitado</button>
        </div>
      </frc-seccion>

      <frc-seccion titulo="Chips de estado">
        <p class="nota">
          Resueltos desde el registro central: {{ totalEstados }} estados de más de veinte
          máquinas distintas.
        </p>
        <div class="fila">
          @for (e of estadosDevolucion; track e) {
            <frc-estado-chip enumerado="EstadoDevolucion" [valor]="e" />
          }
        </div>
        <div class="fila">
          @for (e of estadosCaja; track e) {
            <frc-estado-chip enumerado="PdvCajaEstado" [valor]="e" />
          }
        </div>
        <p class="nota">Con etiqueta y tono explícitos, como los envía solicitud-gastos:</p>
        <div class="fila">
          <frc-estado-chip etiqueta="Listo para retirar" tono="ok" />
          <frc-estado-chip etiqueta="Vence hoy" tono="warn" />
        </div>
      </frc-seccion>

      <frc-seccion titulo="Importes" [panel]="true">
        <frc-dato etiqueta="Apertura de caja">
          <frc-importe [valor]="1500000" moneda="Guaraní" simbolo="₲" />
        </frc-dato>
        <frc-dato etiqueta="Ventas del turno">
          <frc-importe [valor]="12284500" moneda="Guaraní" simbolo="₲" />
        </frc-dato>
        <frc-dato etiqueta="Diferencia de arqueo">
          <frc-importe [valor]="-43500" moneda="Guaraní" simbolo="₲" />
        </frc-dato>
        <frc-dato etiqueta="Compra en dólares">
          <frc-importe [valor]="1284.5" moneda="Dólar" simbolo="US$" />
        </frc-dato>
      </frc-seccion>

      <frc-seccion titulo="Cards de entidad">
        <frc-card
          titulo="Coca Cola 2L retornable"
          subtitulo="Caja x6 · Cód. 7790895000123"
          icono="producto"
          (abrir)="avisar('Card de producto')"
        >
          <frc-estado-chip pie enumerado="EstadoDevolucion" valor="PENDIENTE" />
          <frc-importe aparte [valor]="12500" moneda="Guaraní" simbolo="₲" />
        </frc-card>

        <frc-card
          titulo="00341 · Distribuidora del Este"
          subtitulo="12 items · 28/07"
          (abrir)="avisar('Card sin miniatura')"
        >
          <frc-estado-chip pie enumerado="EstadoDevolucion" valor="RETIRADO" />
        </frc-card>

        <frc-card
          titulo="Marcela Ayala"
          subtitulo="Entrada 07:58 · Salida 16:02"
          icono="persona"
          [redondo]="true"
          [clickable]="false"
        />
      </frc-seccion>

      <frc-seccion titulo="Campos">
        <frc-selector
          etiqueta="Sucursal"
          [opciones]="sucursales"
          [valor]="sucursalElegida()"
          (valorChange)="sucursalElegida.set($event)"
        />
        <frc-campo-importe
          etiqueta="Monto"
          moneda="Guaraní"
          simbolo="₲"
          ayuda="El guaraní no lleva decimales: se redondea al salir del campo."
        />
      </frc-seccion>

      <frc-seccion titulo="Estados de lista">
        <p class="nota">Carga — skeleton con la forma de lo que va a llegar:</p>
        <frc-skeleton [cantidad]="2" [conMiniatura]="true" />

        <p class="nota">Vacío — dice por qué y ofrece salida:</p>
        <frc-estado-vacio
          titulo="No hay devoluciones separadas"
          detalle="Aparecen acá cuando se marcan como separadas en la sucursal."
          icono="producto"
          accion="Cargar devolución"
          (ejecutar)="avisar('Acción del estado vacío')"
        />

        <p class="nota">Error — qué pasó y cómo seguir:</p>
        <frc-estado-error (reintentar)="avisar('Reintento')" />
      </frc-seccion>

      <frc-seccion titulo="Paginación">
        <frc-paginacion
          [pagina]="pagina()"
          [page]="paginaDemo"
          (cambiar)="pagina.set($event)"
        />
      </frc-seccion>

      <frc-seccion titulo="Avisos y diálogos">
        <div class="fila">
          <button matButton="outlined" (click)="notificacion.ok('Guardado')">Éxito</button>
          <button matButton="outlined" (click)="notificacion.warn('Revisá el monto')">
            Advertencia
          </button>
          <button
            matButton="outlined"
            (click)="notificacion.danger('No se pudo conectar con el servidor')"
          >
            Error
          </button>
          <button matButton="outlined" (click)="confirmar()">Confirmación</button>
          <button matButton="outlined" (click)="abrirBuscador()">Buscador</button>
        </div>
      </frc-seccion>

      <frc-seccion titulo="Íconos">
        <p class="nota">
          SVG inline, sin fuente desde CDN — la misma razón por la que el motor facial no debe
          depender de jsdelivr.
        </p>
        <div class="iconos">
          @for (n of iconos; track n) {
            <div class="icono-demo">
              <frc-icono [nombre]="n" [tamano]="22" />
              <span>{{ n }}</span>
            </div>
          }
        </div>
      </frc-seccion>
    </frc-pagina>
  `,
  styles: `
    .intro {
      color: var(--text-soft);
      font-size: var(--fs-label);
      max-width: 62ch;
    }
    .nota {
      color: var(--text-mute);
      font-size: var(--fs-caption);
      margin: 0;
    }
    .fila {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sp-2);
      align-items: center;
    }
    .destructivo {
      --mat-button-filled-container-color: var(--danger-fill);
      --mat-button-filled-label-text-color: var(--on-tono);
    }
    .iconos {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: var(--sp-2);
    }
    .icono-demo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--sp-1);
      padding: var(--sp-2);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      font-size: 10px;
      color: var(--text-mute);
      text-align: center;
    }
  `,
})
export class GaleriaPage {
  readonly tema = inject(TemaService);
  readonly notificacion = inject(NotificacionService);
  private readonly dialogo = inject(DialogoService);

  readonly totalEstados = estadosRegistrados().length;
  readonly iconos = iconosDisponibles();

  readonly estadosDevolucion = [
    'PENDIENTE',
    'SEPARADO',
    'COLECTADO',
    'RETIRADO',
    'CANJEADO',
    'ACREDITADO',
    'DESCARTADO',
    'CANCELADA',
  ];
  readonly estadosCaja = [
    'EN_PROCESO',
    'CONCLUIDO',
    'NECESITA_VERIFICACION',
    'EN_VERIFICACION',
    'VERIFICADO_CONCLUIDO_SIN_PROBLEMA',
    'VERIFICADO_CONCLUIDO_CON_PROBLEMA',
  ];

  readonly sucursales = [
    { valor: 1, texto: 'Bodega' },
    { valor: 2, texto: 'Farmacia' },
    { valor: 3, texto: 'Depósito central', detalle: 'Solo stock' },
  ];
  readonly sucursalElegida = signal<unknown>(1);

  readonly pagina = signal(0);
  readonly paginaDemo = { getTotalPages: 7, getTotalElements: 132 };

  avisar(que: string): void {
    this.notificacion.neutral(que);
  }

  async confirmar(): Promise<void> {
    const ok = await this.dialogo.confirmarEliminacion('la devolución 00341');
    this.notificacion.neutral(ok ? 'Confirmado' : 'Cancelado');
  }

  async abrirBuscador(): Promise<void> {
    const config: ConfigBuscadorLocal<{ id: number; nombre: string; ruc: string }> = {
      modo: 'local',
      titulo: 'Elegir proveedor',
      placeholder: 'Nombre del proveedor',
      items: [
        { id: 1, nombre: 'Distribuidora del Este', ruc: '80012345-6' },
        { id: 2, nombre: 'Lácteos del Sur', ruc: '80098765-4' },
        { id: 3, nombre: 'Panificados Ñemby', ruc: '80055555-1' },
      ],
      texto: (p) => p.nombre,
      id: (p) => p.id,
      detalle: (p) => `RUC ${p.ruc}`,
    };
    const elegido = await this.dialogo.abrir<
      BuscadorComponent<{ id: number; nombre: string; ruc: string }>,
      typeof config,
      { nombre: string }
    >(BuscadorComponent, config);
    if (elegido) {
      this.notificacion.ok(`Elegiste ${elegido.nombre}`);
    }
  }
}
