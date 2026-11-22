import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DatosService } from '../core/graphql/datos.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import type { ProductoSaldo } from '../domains/inventario/producto-saldo.model';
import type { PageInfo } from '../domains/page-info.model';
import {
  ProductosCantidadNegativaGQL,
  ProductosCantidadPositivaGQL,
  ProductosFaltantesGQL,
} from '../graphql/inventario/controlInventario';
import { ControlInventarioPage } from '../pages/inventario/control-inventario.page';

/**
 * Cambiar de filtro mientras la consulta anterior sigue en camino (#674).
 *
 * «Todas las sucursales» tarda mucho más que una sola. Si se elige una
 * sucursal antes de que vuelva, la respuesta vieja llegaba después y pisaba la
 * lista: la pantalla decía «SUC. CENTRAL» y mostraba productos de todas, y
 * «Cargar más» les agregaba páginas de Central.
 */
describe('Control de inventario · cambiar de filtro con una consulta en camino', () => {
  const pagina = (filas: ProductoSaldo[]): PageInfo<ProductoSaldo> =>
    ({ getContent: filas, getTotalElements: filas.length, hasNext: false }) as PageInfo<ProductoSaldo>;
  const fila = (productoId: number, sucursalId: number): ProductoSaldo => ({
    productoId,
    productoDescripcion: 'P' + productoId,
    sucursalId,
    saldoTotal: 1,
  });

  let lenta: Subject<PageInfo<ProductoSaldo>>;
  let datos: { consultar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    lenta = new Subject();
    datos = { consultar: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DatosService, useValue: datos },
        {
          provide: SucursalService,
          useValue: { todas: vi.fn(() => of([{ id: 1, nombre: 'SUC. CENTRAL', deposito: true, activo: true }])) },
        },
        { provide: AuthService, useValue: { sucursal: () => null } },
        { provide: ProductosCantidadPositivaGQL, useValue: {} },
        { provide: ProductosCantidadNegativaGQL, useValue: {} },
        { provide: ProductosFaltantesGQL, useValue: {} },
      ],
    });
  });

  it('la respuesta del filtro anterior no pisa la del filtro elegido', () => {
    // Primera consulta (todas las sucursales): queda en camino.
    datos.consultar.mockReturnValueOnce(lenta);
    const f = TestBed.createComponent(ControlInventarioPage);
    f.detectChanges();

    // Se elige Central y su respuesta vuelve enseguida.
    datos.consultar.mockReturnValueOnce(of(pagina([fila(1104, 1)])));
    f.componentInstance.cambiarSucursal(1);
    f.detectChanges();

    // Recién ahora vuelve la de todas.
    lenta.next(pagina([fila(935, 4), fila(7188, 4)]));
    f.detectChanges();

    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('Código 1104');
    expect(texto).not.toContain('Código 935');
  });
});
