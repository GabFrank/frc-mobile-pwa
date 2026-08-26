import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';

import { InventarioProductoItem } from 'src/app/domains/inventario/inventario.model';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { CampoFechaComponent } from 'src/app/shared/campos/campo-fecha.component';
import { IconoComponent } from 'src/app/shared/icono/icono.component';
import { OpcionSeleccion, SelectorComponent } from 'src/app/shared/selector/selector.component';
import {
  origenDeSugerencia,
  textoDeSugerencia,
  type SugerenciaVencimiento,
} from './vencimiento-sugerido';

/** Un renglón del conteo, ya resuelto por la pantalla. */
export interface FilaConteo {
  itemId: number;
  /** Descripción del producto. Cuelga de la presentación: la zona tiene varios. */
  etiqueta: string;
  presentacion: string;
  /** Stock del sistema, ya formateado. */
  sistema: string;
  contado: number | null;
  /** Contado − sistema. `null` mientras nadie contó, que no es cero. */
  diferencia: number | null;
  /** `yyyy-MM-dd`, o vacío. */
  vencimiento: string;
  /**
   * Lo que el central sabe de esta presentación, **exista o no** una fecha
   * cargada en el ítem. Es lo que deja comparar contra lo que dice el envase.
   */
  conocido: SugerenciaVencimiento | null;
  /** El conocido, pero solo cuando es lo que hoy tiene el campo. */
  sugerencia: SugerenciaVencimiento | null;
  /** La fecha que está en el campo ya pasó. */
  vencido: boolean;
  estado: unknown;
  original: InventarioProductoItem;
}

/**
 * Un ítem del conteo: cabecera siempre visible, formulario al desplegar.
 *
 * ⚠️ **La cabecera tiene que alcanzar para decidir si abrir.** Antes los tres
 * campos estaban siempre abiertos y una góndola de treinta ítems eran noventa
 * campos apilados: había que scrollear la zona entera para saber qué faltaba
 * contar. Por eso arriba van, en este orden, lo contado (el tilde), si hay
 * mercadería vencida y la diferencia con el sistema.
 *
 * ⚠️ **No reutiliza `frc-producto-card`.** Esa expande a las
 * **presentaciones** de un producto; acá cada fila **ya es** una presentación
 * y expande a un **formulario**. Meter los dos comportamientos en un
 * componente es exactamente lo que llevó el buscador de `frc-mobile` a 442
 * líneas y forzó la copia entera de la pantalla en transferencias. Lo que sí
 * se comparte es el vocabulario visual —miniatura, cabecera como botón,
 * chevron, superficie hundida al abrir— para que se lean de la misma familia.
 *
 * No guarda estado: quién está abierto y qué se editó viven en la pantalla.
 */
@Component({
  selector: 'frc-inventario-item-card',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    IconoComponent,
    SelectorComponent,
    CampoFechaComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.abierta]="abierta()">
     <div class="fila">
      <button
        type="button"
        class="cabecera"
        [attr.aria-expanded]="abierta()"
        (click)="alternar.emit()"
      >
        <span class="thumb" [class.contado]="fila().contado !== null">
          <frc-icono [nombre]="fila().contado !== null ? 'check' : 'producto'" [tamano]="22" />
        </span>

        <span class="datos">
          <span class="fila-1">
            <span class="titulo">{{ fila().etiqueta }}</span>
            @if (fila().vencido) {
              <frc-icono class="marca-vencido" nombre="vencido" [tamano]="16" />
            }
          </span>
          <span class="fila-2">
            <span class="sistema">{{ fila().presentacion }} · Sistema: {{ fila().sistema }}</span>
            <span class="dif" [class.falta]="esFalta()" [class.sobra]="esSobra()">
              {{ textoDiferencia() }}
            </span>
          </span>
        </span>

        <span class="chevron" [class.girado]="abierta()">
          <frc-icono nombre="chevronAbajo" [tamano]="20" />
        </span>
      </button>

      <!--
        ⚠️ Hermano del botón de la cabecera, no anidado: un botón dentro de
        otro es HTML inválido, y el clic del menú burbujearía al cuerpo
        desplegando la tarjeta cada vez que se abre el menú. Es la misma
        razón por la que frc-producto-card los tiene separados.
      -->
      @if (puedeQuitar()) {
        <button
          type="button"
          class="menu-btn"
          [matMenuTriggerFor]="menu"
          aria-label="Más opciones"
        >
          <frc-icono nombre="masOpciones" [tamano]="20" />
        </button>

        <mat-menu #menu="matMenu">
          <button mat-menu-item (click)="quitar.emit()">
            <frc-icono nombre="tirar" [tamano]="18" />
            <span class="etiqueta-menu">Quitar del conteo</span>
          </button>
        </mat-menu>
      }
     </div>

      @if (abierta()) {
        <div class="cuerpo">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Contado</mat-label>
            <input
              matInput
              class="entrada-num"
              type="number"
              inputmode="decimal"
              [value]="fila().contado ?? ''"
              (input)="contado.emit($event)"
            />
          </mat-form-field>

          <frc-campo-fecha
            etiqueta="Vencimiento"
            [valor]="fila().vencimiento || null"
            (valorChange)="vencimiento.emit($event ?? '')"
          />

          @if (fila().sugerencia; as s) {
            <!--
              De dónde salió la fecha que está en el campo. Sin el origen,
              «sugerido» a secas no deja decidir si creerle.
            -->
            <p class="pista" [class.alerta]="s.vencido">{{ pista(s) }}</p>
          } @else if (fila().conocido; as c) {
            <!--
              Lo que el central sabía, cuando NO es lo que hay en el campo.
              Antes esto se escondía justo en ese caso —el único en que sirve—
              y quien contaba no tenía contra qué comparar el envase.
            -->
            <div class="anterior" [class.alerta]="c.vencido">
              <frc-icono nombre="reloj" [tamano]="16" />
              <span class="anterior-texto">
                <span class="anterior-fecha">Anterior {{ legible(c.fecha) }}</span>
                <span class="anterior-fuente">{{ origen(c) }}</span>
              </span>
              <button type="button" class="usar" (click)="usarConocido.emit(c.fecha)">usar</button>
            </div>
          }

          <frc-selector
            etiqueta="Estado"
            [opciones]="estados()"
            [valor]="fila().estado"
            (valorChange)="estado.emit($event)"
          />
        </div>
      }
    </article>
  `,
  styles: `
    .card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-md);
      overflow: hidden;
    }
    .card.abierta {
      border-color: var(--border);
      box-shadow: var(--elev-1);
    }
    .fila {
      display: flex;
      align-items: stretch;
    }
    .cabecera {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3);
      background: none;
      border: none;
      font: inherit;
      color: var(--text);
      text-align: left;
      cursor: pointer;
    }
    .cabecera:hover { background: var(--surface-sunken); }
    .thumb {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      background: var(--surface-sunken);
      display: grid;
      place-items: center;
      color: var(--text-mute);
      flex-shrink: 0;
    }
    /* El tilde marca lo ya contado, que es lo que se busca de un vistazo. */
    .thumb.contado {
      background: var(--ok-bg);
      color: var(--ok);
    }
    .datos {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .fila-1 {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      min-width: 0;
    }
    .titulo {
      font-weight: var(--fw-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .marca-vencido { color: var(--danger); flex-shrink: 0; line-height: 0; }
    .fila-2 {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--sp-3);
    }
    .sistema {
      font-size: var(--fs-label);
      color: var(--text-soft);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dif {
      flex-shrink: 0;
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
      font-weight: var(--fw-bold);
      font-size: var(--fs-label);
      color: var(--text-mute);
    }
    .dif.falta { color: var(--danger); }
    .dif.sobra { color: var(--warn); }
    .chevron {
      flex-shrink: 0;
      color: var(--text-mute);
      line-height: 0;
      transition: transform 120ms ease;
    }
    .chevron.girado { transform: rotate(180deg); }
    .menu-btn {
      flex-shrink: 0;
      padding: 0 var(--sp-3);
      background: none;
      border: none;
      border-left: 1px solid var(--border-light);
      color: var(--text-mute);
      cursor: pointer;
      line-height: 0;
    }
    .menu-btn:hover { background: var(--surface-sunken); color: var(--brand-text); }
    .etiqueta-menu { margin-left: var(--sp-2); }

    .cuerpo {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      padding: var(--sp-3);
      border-top: 1px solid var(--border-light);
      background: var(--surface-sunken);
    }
    .entrada-num {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
    }
    .pista { margin: 0; font-size: var(--fs-caption); color: var(--text-mute); }
    .pista.alerta { color: var(--danger); }

    .anterior {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      padding: var(--sp-2);
      border: 1px dashed var(--border);
      border-radius: var(--radius-sm);
      color: var(--text-soft);
    }
    .anterior.alerta { color: var(--danger); border-color: var(--danger); }
    .anterior frc-icono { flex-shrink: 0; line-height: 0; }
    .anterior-texto {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .anterior-fecha {
      font-size: var(--fs-label);
      font-variant-numeric: tabular-nums;
    }
    .anterior-fuente {
      font-size: var(--fs-caption);
      color: var(--text-mute);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .usar {
      flex-shrink: 0;
      padding: var(--sp-1) var(--sp-3);
      background: none;
      border: 1px solid currentColor;
      border-radius: var(--radius-full);
      font: inherit;
      font-size: var(--fs-caption);
      color: var(--brand-text);
      cursor: pointer;
    }
    .usar:hover { background: var(--surface); }
  `,
})
export class InventarioItemCardComponent {
  readonly fila = input.required<FilaConteo>();
  readonly abierta = input(false);
  readonly estados = input<OpcionSeleccion[]>([]);
  /**
   * El menú aparece solo si se puede sacar el renglón — es decir, con la toma
   * abierta. Cerrada, el alcance del conteo ya es un hecho histórico.
   */
  readonly puedeQuitar = input(false);

  readonly alternar = output<void>();
  readonly contado = output<Event>();
  /** `yyyy-MM-dd`, o vacío al borrar la fecha. */
  readonly vencimiento = output<string>();
  readonly estado = output<unknown>();
  /** La fecha del «Anterior», para copiarla al campo. */
  readonly usarConocido = output<string>();
  readonly quitar = output<void>();

  readonly esFalta = computed(() => (this.fila().diferencia ?? 0) < 0);
  readonly esSobra = computed(() => (this.fila().diferencia ?? 0) > 0);

  /**
   * Sin contar no hay diferencia, y cero **sí** es una diferencia: el guion
   * dice «nadie fue a la góndola», el 0 dice «coincide».
   */
  readonly textoDiferencia = computed(() => {
    const dif = this.fila().diferencia;
    if (dif == null) {
      return '—';
    }
    return dif > 0 ? '+' + dif : String(dif);
  });

  pista(sugerencia: SugerenciaVencimiento): string {
    return textoDeSugerencia(sugerencia);
  }

  legible(fecha: string): string {
    return fechaLegible(fecha, { conHora: false }) ?? fecha;
  }

  origen(sugerencia: SugerenciaVencimiento): string {
    const origen = origenDeSugerencia(sugerencia);
    return sugerencia.vencido ? origen + ' · ya vencido' : origen;
  }
}
