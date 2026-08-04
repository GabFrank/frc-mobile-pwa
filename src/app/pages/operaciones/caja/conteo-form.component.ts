import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ConteoMoneda } from 'src/app/domains/caja/conteo-moneda/conteo-moneda.model';
import { Conteo } from 'src/app/domains/caja/conteo.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { MonedaBillete } from 'src/app/domains/moneda/moneda-billetes/moneda-billetes.model';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { formatearImporte } from 'src/app/generic/utils/moneda.util';

/** Lo que el balance dice que debería haber, por denominación de moneda. */
export interface EsperadoPorMoneda {
  gs?: number;
  rs?: number;
  ds?: number;
}

/**
 * Arqueo de efectivo: cuántas unidades hay de cada denominación.
 *
 * Es el mismo formulario para la apertura y para el cierre. La única
 * diferencia es que en el cierre se muestra **lo esperado** al lado de lo
 * contado, para que el cajero vea la diferencia mientras cuenta y no
 * después.
 *
 * ⚠️ **El total NO es dinero calculado en el cliente en el sentido de la
 * regla del proyecto.** Acá se multiplica una cantidad contada a mano por el
 * valor de un billete: es la captura del dato, no una liquidación. Lo que
 * nunca se calcula acá es la **diferencia de arqueo** contra el esperado —
 * eso lo hace el backend, porque define si el cajero responde por dinero
 * faltante.
 */
@Component({
  selector: 'frc-conteo-form',
  standalone: true,
  imports: [SeccionComponent, ImporteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (m of monedas(); track m.id) {
      <frc-seccion [titulo]="m.denominacion ?? 'Moneda'" [panel]="true">
        @for (b of denominacionesDe(m); track b.id) {
          <div class="fila">
            <label [attr.for]="'den-' + b.id" class="valor">
              {{ etiqueta(b, m) }}
            </label>
            <input
              [id]="'den-' + b.id"
              class="cantidad frc-num"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              [value]="cantidadDe(b) || ''"
              (input)="contar(b, $event)"
              [attr.aria-label]="'Cantidad de ' + etiqueta(b, m)"
            />
            <span class="subtotal frc-num">
              <frc-importe
                [valor]="subtotalDe(b)"
                [moneda]="m.denominacion ?? null"
                [simbolo]="m.simbolo ?? null"
              />
            </span>
          </div>
        } @empty {
          <p class="sin-denominaciones">
            Esta moneda no tiene denominaciones cargadas. Avisá a sistemas: sin ellas no se
            puede arquear.
          </p>
        }

        <div class="total">
          <span>Contado</span>
          <frc-importe
            [valor]="totalDe(m)"
            [moneda]="m.denominacion ?? null"
            [simbolo]="m.simbolo ?? null"
          />
        </div>

        @if (esperadoDe(m); as esp) {
          <div class="total esperado">
            <span>Esperado</span>
            <frc-importe
              [valor]="esp"
              [moneda]="m.denominacion ?? null"
              [simbolo]="m.simbolo ?? null"
            />
          </div>
          <div class="total diferencia" [class.hay]="totalDe(m) - esp !== 0">
            <span>Diferencia</span>
            <frc-importe
              [valor]="totalDe(m) - esp"
              [moneda]="m.denominacion ?? null"
              [simbolo]="m.simbolo ?? null"
            />
          </div>
        }
      </frc-seccion>
    }
  `,
  styles: `
    .fila {
      display: grid;
      grid-template-columns: 1fr 5rem auto;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-light);
    }
    .valor {
      font-size: var(--fs-body);
      color: var(--text);
    }
    .cantidad {
      width: 100%;
      padding: var(--sp-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font-size: var(--fs-body);
      text-align: right;
    }
    .cantidad:focus-visible {
      outline: 2px solid var(--brand-text);
      outline-offset: -1px;
    }
    .subtotal {
      min-width: 7rem;
      text-align: right;
      color: var(--text-soft);
      font-size: var(--fs-label);
    }
    .total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding-top: var(--sp-3);
      font-weight: var(--fw-medium);
    }
    .total.esperado,
    .total.diferencia {
      padding-top: var(--sp-2);
      font-weight: var(--fw-regular);
      color: var(--text-soft);
    }
    .total.diferencia.hay {
      color: var(--danger);
      font-weight: var(--fw-medium);
    }
    .sin-denominaciones {
      margin: 0;
      color: var(--warn);
      font-size: var(--fs-label);
    }
  `,
})
export class ConteoFormComponent {
  readonly monedas = input.required<Moneda[]>();

  /** Solo en el cierre. Sin esto no se muestran las filas de esperado. */
  readonly esperado = input<EsperadoPorMoneda | null>(null);

  /** Emite en cada cambio: la pantalla decide cuándo guardar. */
  readonly cambio = output<Conteo>();

  /**
   * Cantidades por id de denominación.
   *
   * Se indexa por **id**, no por valor. El repo anterior usaba el valor como
   * clave del formulario, lo que rompe si dos denominaciones comparten
   * importe —un billete y una moneda de 1.000, o un billete reemitido— y
   * además impide distinguir el papel del metal.
   */
  private readonly cantidades = signal<ReadonlyMap<number, number>>(new Map());

  readonly totalGs = computed(() => this.totalPorDenominacion('GUARANI'));
  readonly totalRs = computed(() => this.totalPorDenominacion('REAL'));
  readonly totalDs = computed(() => this.totalPorDenominacion('DOLAR'));

  denominacionesDe(m: Moneda): MonedaBillete[] {
    return (m.monedaBilleteList ?? [])
      .filter((b) => b.activo !== false && b.valor != null)
      .sort((a, b) => (a.valor ?? 0) - (b.valor ?? 0));
  }

  etiqueta(b: MonedaBillete, m: Moneda): string {
    const importe = formatearImporte(b.valor ?? 0, m.denominacion, m.simbolo);
    // `papel` distingue billete de moneda. Importa al contar: se apilan y se
    // guardan distinto, y sin la marca dos denominaciones del mismo valor
    // serían indistinguibles en pantalla.
    return b.papel === false ? `${importe} (moneda)` : importe;
  }

  cantidadDe(b: MonedaBillete): number {
    return this.cantidades().get(b.id ?? -1) ?? 0;
  }

  subtotalDe(b: MonedaBillete): number {
    return this.cantidadDe(b) * (b.valor ?? 0);
  }

  totalDe(m: Moneda): number {
    return this.denominacionesDe(m).reduce((suma, b) => suma + this.subtotalDe(b), 0);
  }

  esperadoDe(m: Moneda): number | null {
    const esp = this.esperado();
    if (!esp) {
      return null;
    }
    switch (m.denominacion) {
      case 'GUARANI':
        return esp.gs ?? 0;
      case 'REAL':
        return esp.rs ?? 0;
      case 'DOLAR':
        return esp.ds ?? 0;
      default:
        return null;
    }
  }

  contar(b: MonedaBillete, evento: Event): void {
    const crudo = Number((evento.target as HTMLInputElement).value);
    // Una cantidad de billetes es un entero no negativo. El teclado numérico
    // deja escribir `-` y `.`, y un `-2` en una denominación restaría del
    // arqueo sin que se note en el total.
    const cantidad = Number.isFinite(crudo) && crudo > 0 ? Math.floor(crudo) : 0;

    this.cantidades.update((previas) => {
      const proximas = new Map(previas);
      if (cantidad === 0) {
        proximas.delete(b.id ?? -1);
      } else {
        proximas.set(b.id ?? -1, cantidad);
      }
      return proximas;
    });

    this.cambio.emit(this.armar());
  }

  /** El arqueo listo para mandar. */
  armar(): Conteo {
    const conteo = new Conteo();
    conteo.totalGs = this.totalGs();
    conteo.totalRs = this.totalRs();
    conteo.totalDs = this.totalDs();
    conteo.conteoMonedaList = this.monedas()
      .flatMap((m) => this.denominacionesDe(m))
      // Solo se mandan las denominaciones con cantidad: una fila en cero no
      // aporta nada al arqueo y ensucia el detalle guardado.
      .filter((b) => this.cantidadDe(b) > 0)
      .map((b) => {
        const cm = new ConteoMoneda();
        cm.cantidad = this.cantidadDe(b);
        cm.monedaBilletes = b;
        return cm;
      });
    return conteo;
  }

  /** `true` si no se contó nada en ninguna moneda. */
  vacio(): boolean {
    return this.totalGs() === 0 && this.totalRs() === 0 && this.totalDs() === 0;
  }

  private totalPorDenominacion(denominacion: string): number {
    const moneda = this.monedas().find((m) => m.denominacion === denominacion);
    return moneda ? this.totalDe(moneda) : 0;
  }
}
