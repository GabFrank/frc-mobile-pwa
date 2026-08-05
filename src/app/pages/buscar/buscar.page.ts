import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { AuthService } from 'src/app/core/auth/auth.service';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { BuscadorProductoComponent } from 'src/app/shared/producto/buscador-producto.component';
import { OpcionesBuscador, SeleccionProducto } from 'src/app/shared/producto/buscador.types';

/**
 * Pestaña **Buscar**: consulta de productos.
 *
 * Es la envoltura más liviana posible sobre `frc-buscador-producto`. Todo lo
 * que sabe hacer —texto, código, balanza, escaneo, expandir a presentaciones,
 * stock por sucursal— vive en el componente compartido, porque los mismos
 * usos aparecen en devolución, inventario, transferencias y productos
 * vencidos. Ver `docs/analisis/buscador-producto-inventario.md`.
 *
 * Acá se consulta, no se elige: la selección no lleva a ningún lado. Cuando
 * el buscador se abra como selector desde otra pantalla, esa pantalla escucha
 * `(seleccion)` y hace lo suyo.
 */
@Component({
  selector: 'frc-buscar-page',
  standalone: true,
  imports: [PaginaComponent, BuscadorProductoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Buscar">
      <frc-buscador-producto [opciones]="opciones()" (seleccion)="alElegir($event)" />
    </frc-pagina>
  `,
})
export class BuscarPage {
  private readonly auth = inject(AuthService);

  /**
   * El stock que se muestra es el de **la sucursal de la sesión**.
   *
   * Es la que el usuario pregunta por defecto. Para ver las demás está la
   * opción del menú `⋮`, que abre el diálogo por sucursal.
   */
  readonly opciones = computed<OpcionesBuscador>(() => ({
    devuelve: 'presentacion',
    mostrarPrecio: true,
    sucursalId: this.auth.sucursal()?.id,
  }));

  alElegir(_seleccion: SeleccionProducto): void {
    // Consulta pura: no hay a dónde devolver. Lo elegido ya se ve en la card
    // expandida, con su precio y su stock.
  }
}
