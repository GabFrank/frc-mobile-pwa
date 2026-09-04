import { ChangeDetectionStrategy, Component, EventEmitter, inject, input, Output } from '@angular/core';
import { Location } from '@angular/common';
import { FabEscaneoComponent } from '../escaneo/fab-escaneo.component';
import { IconoComponent } from '../icono/icono.component';

/**
 * Layout canónico de pantalla: barra superior, contenido y —opcionalmente—
 * una barra de acciones fija al pie.
 *
 * Se usa en listas, detalles y formularios. La estructura no cambia entre
 * módulos: eso es lo que hace que la app se sienta una sola app.
 *
 *   <frc-pagina titulo="Devoluciones" [conVolver]="true">
 *     <div acciones>…</div>       <!-- barra fija al pie, opcional -->
 *     …contenido…
 *   </frc-pagina>
 */
@Component({
  selector: 'frc-pagina',
  standalone: true,
  imports: [IconoComponent, FabEscaneoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="barra">
      @if (conVolver()) {
        <button type="button" class="icono-btn" (click)="volver()" aria-label="Volver">
          <frc-icono nombre="atras" [tamano]="22" />
        </button>
      }
      <h1>{{ titulo() }}</h1>
      <ng-content select="[accionBarra]" />
    </header>

    <!--
      El envoltorio existe para el FAB. Es el que delimita "de la barra
      superior hasta arriba de las acciones": puesto directamente sobre el
      host, el FAB quedaría anclado al borde inferior de la pantalla y taparía
      el botón de guardar de las pantallas que tienen barra de acciones.
    -->
    <div class="cuerpo">
      <main class="contenido" [class.con-fab]="conEscaner()">
        <ng-content />
      </main>

      @if (conEscaner()) {
        <frc-fab-escaneo />
      }
    </div>

    <footer class="acciones">
      <ng-content select="[acciones]" />
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .barra {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      padding: var(--sp-3) var(--sp-4);
      background: var(--brand-fill);
      color: var(--on-brand);
      flex-shrink: 0;
    }
    .barra h1 {
      flex: 1;
      margin: 0;
      font-size: var(--fs-title);
      font-weight: var(--fw-medium);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .icono-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: var(--sp-1);
      border-radius: var(--radius-sm);
      line-height: 0;
    }
    .icono-btn:hover { background: rgb(255 255 255 / 0.16); }
    .cuerpo {
      position: relative;
      flex: 1;
      min-height: 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .contenido {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--sp-4);
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }
    /*
      Que el contenido no termine debajo del FAB. Sin esto, la última card de
      una lista larga queda con la esquina tapada justo donde suele estar su
      botón.
    */
    .contenido.con-fab { padding-bottom: calc(var(--sp-12) + var(--sp-8)); }
    .acciones:empty { display: none; }
    /*
      Grid y no flex: el contenido de esta barra lo proyecta la PANTALLA, no
      esta plantilla, así que no lleva el atributo de encapsulación de
      frc-pagina y ninguna regla de acá puede apuntarlo: un selector como
      .acciones > algun-hijo nunca lo alcanzaría.

      Con grid-auto-columns 1fr el reparto lo decide el contenedor: un
      botón ocupa todo el ancho, dos se reparten mitad y mitad, sin que la
      pantalla tenga que declarar nada. Antes el envoltorio se encogía a su
      contenido y el botón principal quedaba de 112 px en una barra de 430.

      ⚠️ Eso vale para el hijo directo. Casi todas las pantallas envuelven
      los botones en un <div acciones> —hace falta para que el atributo de
      proyección quede fuera de cualquier @if— y adentro de ese envoltorio
      el botón vuelve a su ancho natural. Que ocupe su columna lo resuelve
      una regla global en styles.scss, por el mismo motivo de encapsulación
      que impide escribirla acá. No agregues un width 100% por pantalla:
      eso es lo que había antes y salían de dos anchos distintos.
    */
    .acciones {
      flex-shrink: 0;
      padding: var(--sp-3) var(--sp-4);
      border-top: 1px solid var(--border);
      background: var(--surface);
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: var(--sp-2);
      padding-bottom: max(var(--sp-3), env(safe-area-inset-bottom));
    }
  `,
})
export class PaginaComponent {
  private readonly location = inject(Location);

  readonly titulo = input.required<string>();
  readonly conVolver = input(false);
  /**
   * Botón flotante de escaneo.
   *
   * Encendido por defecto: escanear se hace desde cualquier pantalla y
   * pedirlo pantalla por pantalla garantiza que falte justo donde hacía
   * falta. Se apaga donde estorbaría —una pantalla que ya vive dentro de la
   * cámara, o el modo kiosco, que no tiene navegación—.
   */
  readonly conEscaner = input(true);

  /**
   * Si alguien lo escucha, **reemplaza** al comportamiento por defecto.
   *
   * Es lo que permite que un formulario intercepte el botón de volver para
   * preguntar "¿salir sin guardar?".
   *
   * Se usa `@Output()` y no `output()` porque `EventEmitter` expone
   * `observed`, que es justamente lo que hace falta para saber si hay quien
   * escuche. La API de signals no lo ofrece.
   */
  @Output() readonly atras = new EventEmitter<void>();

  volver(): void {
    if (this.atras.observed) {
      this.atras.emit();
      return;
    }
    // `Location.back()` en vez de navegar: evita apilar entradas en el
    // historial cuando el objetivo es simplemente volver.
    this.location.back();
  }
}
