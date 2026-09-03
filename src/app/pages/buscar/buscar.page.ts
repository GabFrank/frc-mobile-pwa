import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { AuthService } from 'src/app/core/auth/auth.service';
import { esSucursalOperable } from 'src/app/domains/empresarial/sucursal/sucursal.util';
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
    <!--
      Sin el botón flotante: el buscador ya trae el suyo, pegado al campo, y
      el flotante ofrecía lo mismo desde la otra esquina. Apagarlo además
      libera el relleno inferior que frc-pagina reserva para él, que acá es
      una fila de resultados.

      Lo que se pierde es leer un QR del sistema —una transferencia, un
      inventario— parado en esta pantalla: el escáner del buscador pide solo
      formatos de producto. Se sale de Buscar con un toque, así que el
      intercambio conviene.
    -->
    <frc-pagina titulo="Buscar" [conEscaner]="false">
      <frc-buscador-producto
        [opciones]="opciones()"
        [codigoInicial]="codigo()"
        (seleccion)="alElegir($event)"
      />
    </frc-pagina>
  `,
})
export class BuscarPage {
  private readonly auth = inject(AuthService);

  /**
   * Código que ya leyó el escáner universal del FAB.
   *
   * Llega por la URL, así que la pantalla se puede compartir o recargar y el
   * producto se vuelve a resolver solo. Sin esto, el escaneo desde el FAB
   * tendría que abrir la cámara una segunda vez acá adentro.
   */
  readonly codigo = input<string>();

  /**
   * El stock que se muestra es el de **la sucursal de la sesión**.
   *
   * Es la que el usuario pregunta por defecto. Para ver las demás está la
   * opción del menú `⋮`, que abre el diálogo por sucursal.
   *
   * ⚠️ **Solo si esa sucursal tiene depósito.** Una sucursal virtual
   * —`SERVIDOR`, `COMPRAS`— no mueve stock: preguntarle la existencia de un
   * producto devuelve un número sin significado. Un usuario con la sesión
   * ahí es normal, no un error. Ver `sucursal.util.ts`.
   */
  readonly opciones = computed<OpcionesBuscador>(() => {
    const sucursal = this.auth.sucursal();
    return {
      devuelve: 'presentacion',
      mostrarPrecio: true,
      sucursalId: esSucursalOperable(sucursal) ? sucursal?.id : undefined,
    };
  });

  alElegir(_seleccion: SeleccionProducto): void {
    // Consulta pura: no hay a dónde devolver. Lo elegido ya se ve en la card
    // expandida, con su precio y su stock.
  }
}
