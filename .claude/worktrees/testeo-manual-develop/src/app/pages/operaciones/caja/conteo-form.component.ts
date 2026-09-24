import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';

import { ConteoMoneda } from 'src/app/domains/caja/conteo-moneda/conteo-moneda.model';
import { Conteo } from 'src/app/domains/caja/conteo.model';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { MonedaBillete } from 'src/app/domains/moneda/moneda-billetes/moneda-billetes.model';
import { ImporteComponent } from 'src/app/shared/importe/importe.component';
import { formatearImporte } from 'src/app/generic/utils/moneda.util';

/** Lo que el balance dice que debería haber, por moneda. */
export interface EsperadoPorMoneda {
  gs?: number;
  rs?: number;
  ds?: number;
}

/**
 * Campo del `Conteo` donde va el total de cada moneda.
 *
 * ⚠️ Esto NO es una lista de monedas soportadas por la UI —los tabs se
 * generan de lo que manda el servidor—. Es el **contrato del backend**:
 * `Conteo` tiene exactamente tres campos de total (`totalGs`, `totalRs`,
 * `totalDs`), así que solo esas tres monedas tienen dónde ser guardadas.
 *
 * Si aparece una cuarta moneda con denominaciones, la pantalla lo dice en
 * vez de contarla y perderla en silencio. Arreglarlo de verdad requiere un
 * campo nuevo en `ConteoInput`, o sea backend.
 */
const CAMPO_DE_TOTAL: Readonly<Record<string, 'totalGs' | 'totalRs' | 'totalDs'>> = {
  GUARANI: 'totalGs',
  REAL: 'totalRs',
  DOLAR: 'totalDs',
};

/**
 * Arqueo de efectivo: cuántas unidades hay de cada denominación.
 *
 * Un tab por moneda, generado de lo que manda el servidor. En el teléfono
 * las monedas apiladas eran un scroll largo en el que se perdía de vista
 * dónde iba uno; con tabs, cada moneda es una pantalla y los totales de
 * todas quedan visibles arriba.
 *
 * Es el mismo formulario para la apertura y para el cierre. La única
 * diferencia es que en el cierre se muestra **lo esperado**, para que el
 * cajero vea la diferencia mientras cuenta y no después.
 *
 * ⚠️ **El total NO es dinero calculado en el cliente en el sentido de la
 * regla del proyecto.** Acá se multiplica una cantidad contada a mano por el
 * valor de un billete: es la captura del dato, no una liquidación. Lo que
 * nunca se calcula acá es la **diferencia de arqueo que queda registrada** —
 * eso lo hace el backend, porque define si el cajero responde por dinero
 * faltante. La que se muestra es una ayuda para recontar antes de confirmar.
 */
@Component({
  selector: 'frc-conteo-form',
  standalone: true,
  imports: [MatTabsModule, ImporteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      Resumen fuera de los tabs: con una moneda por tab, sin esto habría que
      entrar a cada una para saber cuánto se lleva contado.
    -->
    <div class="resumen">
      @for (m of visibles(); track m.id) {
        <div class="resumen-item" [class.activa]="m.id === monedaActiva()?.id">
          <span class="resumen-moneda">{{ nombre(m) }}</span>
          <frc-importe
            [valor]="totalDe(m)"
            [moneda]="m.denominacion ?? null"
            [simbolo]="m.simbolo ?? null"
          />
          @if (esperadoDe(m); as esp) {
            <span class="resumen-dif" [class.hay]="totalDe(m) - esp !== 0">
              <frc-importe
                [valor]="totalDe(m) - esp"
                [moneda]="m.denominacion ?? null"
                [simbolo]="m.simbolo ?? null"
              />
            </span>
          }
        </div>
      }
    </div>

    <mat-tab-group
      [selectedIndex]="indiceActivo()"
      (selectedIndexChange)="indiceActivo.set($event)"
      animationDuration="120ms"
    >
      @for (m of visibles(); track m.id) {
        <mat-tab [label]="nombre(m)">
          <div class="panel">
            @if (!campoDe(m)) {
              <p class="aviso">
                El servidor no tiene dónde guardar un arqueo en {{ nombre(m) }}: el conteo solo
                admite guaraníes, reales y dólares. Avisá a sistemas antes de contar esta moneda.
              </p>
            }

            @for (b of denominacionesDe(m); track b.id) {
              <div class="fila">
                <label [attr.for]="'den-' + b.id" class="valor">{{ etiqueta(b, m) }}</label>
                <input
                  [id]="'den-' + b.id"
                  class="cantidad"
                  type="number"
                  inputmode="numeric"
                  min="0"
                  step="1"
                  [value]="cantidadDe(b) || ''"
                  (input)="contar(b, $event)"
                  [attr.aria-label]="'Cantidad de ' + etiqueta(b, m)"
                />
              </div>
            }

            @if (esperadoDe(m); as esp) {
              <div class="cierre">
                <div class="cierre-fila">
                  <span>Esperado</span>
                  <frc-importe
                    [valor]="esp"
                    [moneda]="m.denominacion ?? null"
                    [simbolo]="m.simbolo ?? null"
                  />
                </div>
                <div class="cierre-fila" [class.hay]="totalDe(m) - esp !== 0">
                  <span>Diferencia</span>
                  <frc-importe
                    [valor]="totalDe(m) - esp"
                    [moneda]="m.denominacion ?? null"
                    [simbolo]="m.simbolo ?? null"
                  />
                </div>
              </div>
            }
          </div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
  styles: `
    .resumen {
      display: flex;
      gap: var(--sp-2);
      /*
        Si hay más monedas de las que entran a lo ancho, la tira scrollea
        sola. El cuerpo de la página nunca scrollea de costado.
      */
      overflow-x: auto;
      padding-bottom: var(--sp-1);
    }
    .resumen-item {
      flex: 1 0 auto;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--sp-2) var(--sp-3);
      border: 1px solid var(--border-light);
      border-radius: var(--radius-sm);
      background: var(--surface);
    }
    .resumen-item.activa { border-color: var(--brand-text); }
    .resumen-moneda {
      font-size: var(--fs-caption);
      color: var(--text-mute);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .resumen-dif { font-size: var(--fs-caption); color: var(--text-soft); }
    .resumen-dif.hay { color: var(--danger); }

    .panel {
      display: flex;
      flex-direction: column;
      padding-top: var(--sp-3);
    }

    /*
      Dos columnas, y la de la cantidad con ancho FIJO.

      Antes había una tercera con el subtotal de la fila, dimensionada por su
      texto: al escribir una cantidad el subtotal pasaba de "Gs. 0" a
      "Gs. 20.000" y empujaba el campo hacia la izquierda. Un input que se
      mueve mientras se tipea es difícil de usar y, contando efectivo, hace
      perder el lugar.

      El subtotal además no aportaba: es una multiplicación trivial, y el
      total de la moneda ya está arriba y se actualiza en vivo.

      La columna de la izquierda puede encogerse (minmax con 0) para que la
      fila no desborde en 320 px.
    */
    .fila {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 5.5rem;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-2) 0;
      border-bottom: 1px solid var(--border-light);
    }
    .valor {
      font-size: var(--fs-body);
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cantidad {
      width: 100%;
      min-width: 0;
      padding: var(--sp-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      background: var(--surface);
      color: var(--text);
      font-family: var(--font-num);
      font-size: var(--fs-body);
      text-align: right;
    }
    .cantidad:focus-visible {
      outline: 2px solid var(--brand-text);
      outline-offset: -1px;
    }
    .cierre {
      display: flex;
      flex-direction: column;
      gap: var(--sp-1);
      padding-top: var(--sp-3);
    }
    .cierre-fila {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      color: var(--text-soft);
      font-size: var(--fs-label);
    }
    .cierre-fila.hay {
      color: var(--danger);
      font-weight: var(--fw-medium);
    }

    .aviso {
      margin: 0 0 var(--sp-2);
      color: var(--warn);
      font-size: var(--fs-label);
    }
  `,
})
export class ConteoFormComponent {
  readonly monedas = input.required<Moneda[]>();

  /** Solo en el cierre. Sin esto no se muestra ninguna fila de esperado. */
  readonly esperado = input<EsperadoPorMoneda | null>(null);

  /** Emite en cada cambio: la pantalla decide cuándo guardar. */
  readonly cambio = output<Conteo>();

  /**
   * Las que se pueden arquear: activas y con al menos una denominación
   * vigente.
   *
   * Una moneda dada de baja, o una que quedó cargada sin denominaciones, no
   * tiene nada que contar: su tab estaría vacío y solo agregaría un lugar
   * más donde mirar. Se filtran acá y no en cada pantalla para que la
   * apertura y el cierre no puedan divergir.
   */
  readonly visibles = computed(() =>
    this.monedas().filter(
      (m) => m.activo !== false && this.denominacionesDe(m).length > 0,
    ),
  );

  readonly indiceActivo = signal(0);
  /*
    El tipo se anota a mano porque TypeScript infiere `Moneda` para un
    acceso por índice —da por hecho que existe— y entonces marcaba el `?.`
    de la plantilla como innecesario. Sí lo es: entre que cambian las
    monedas visibles y se reajusta el índice activo, el acceso devuelve
    `undefined`.
  */
  readonly monedaActiva = computed<Moneda | null>(
    () => this.visibles()[this.indiceActivo()] ?? null,
  );

  /**
   * Cantidades por id de denominación.
   *
   * Se indexa por **id**, no por valor. El repo anterior usaba el valor como
   * clave del formulario, lo que rompe si dos denominaciones comparten
   * importe —un billete y una moneda de 1.000, o un billete reemitido— y
   * además impide distinguir el papel del metal.
   */
  private readonly cantidades = signal<ReadonlyMap<number, number>>(new Map());

  readonly totalGs = computed(() => this.totalDelCampo('totalGs'));
  readonly totalRs = computed(() => this.totalDelCampo('totalRs'));
  readonly totalDs = computed(() => this.totalDelCampo('totalDs'));

  nombre(m: Moneda): string {
    return m.denominacion ?? `Moneda ${m.id}`;
  }

  campoDe(m: Moneda): 'totalGs' | 'totalRs' | 'totalDs' | undefined {
    return m.denominacion ? CAMPO_DE_TOTAL[m.denominacion] : undefined;
  }

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

  /** Aporte de una denominación al total. Ya no se muestra por fila. */
  subtotalDe(b: MonedaBillete): number {
    return this.cantidadDe(b) * (b.valor ?? 0);
  }

  totalDe(m: Moneda): number {
    return this.denominacionesDe(m).reduce((suma, b) => suma + this.subtotalDe(b), 0);
  }

  esperadoDe(m: Moneda): number | null {
    const esp = this.esperado();
    const campo = this.campoDe(m);
    if (!esp || !campo) {
      return null;
    }
    const valor = { totalGs: esp.gs, totalRs: esp.rs, totalDs: esp.ds }[campo];
    return valor ?? null;
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
    conteo.conteoMonedaList = this.visibles()
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
    return (this.armar().conteoMonedaList ?? []).length === 0;
  }

  private totalDelCampo(campo: 'totalGs' | 'totalRs' | 'totalDs'): number {
    return this.visibles()
      .filter((m) => this.campoDe(m) === campo)
      .reduce((suma, m) => suma + this.totalDe(m), 0);
  }
}
