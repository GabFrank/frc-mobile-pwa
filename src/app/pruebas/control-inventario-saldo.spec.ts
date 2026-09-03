import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DatosService } from '../core/graphql/datos.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import type { ProductoSaldo } from '../domains/inventario/producto-saldo.model';
import {
  ProductosCantidadNegativaGQL,
  ProductosCantidadPositivaGQL,
  ProductosFaltantesGQL,
} from '../graphql/inventario/controlInventario';
import { ControlInventarioPage } from '../pages/inventario/control-inventario.page';

/**
 * El saldo del control de inventario se muestra en unidades.
 *
 * ⚠️ **`saldoTotal` vuelve del central como `Float` aunque el producto se
 * cuente por unidad**, igual que la existencia por sucursal: el saldo se
 * calcula sobre `movimiento_stock`, cuya columna es numérica con decimales.
 * Mostrar `-3,00` hace leer que falta una fracción de unidad.
 *
 * `ProductoSaldoDto` **no dice si el producto es de balanza** —no tiene ese
 * campo—, así que acá la regla la decide el valor: si viene fraccionado, los
 * decimales se conservan, porque en un pesable son kilos y en un producto por
 * unidad son un ajuste mal cargado. En los dos casos hay que verlos.
 */
describe('Control de inventario · saldo', () => {
  let datos: { consultar: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const SUCURSALES = [{ id: 1, nombre: 'SUC. CENTRAL', deposito: true, activo: true }];

  const montar = (saldoTotal: number) => {
    const fila: ProductoSaldo = {
      productoId: 472,
      productoDescripcion: 'COCA COLA LATA 350ML',
      sucursalId: 1,
      saldoTotal,
    };
    datos.consultar.mockReturnValue(
      of({ getContent: [fila], getTotalElements: 1, hasNext: false }),
    );
    const f = TestBed.createComponent(ControlInventarioPage);
    f.detectChanges();
    return f;
  };

  beforeEach(() => {
    datos = { consultar: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DatosService, useValue: datos },
        { provide: SucursalService, useValue: { todas: vi.fn(() => of(SUCURSALES)) } },
        { provide: AuthService, useValue: { sucursal: () => ({ id: 1 }) } },
        // La página los inyecta solo para pasárselos a `DatosService`, que acá
        // está mockeado: no llegan a usarse. Sin esto se construyen de verdad
        // y piden Apollo, que en el test no existe.
        { provide: ProductosCantidadPositivaGQL, useValue: {} },
        { provide: ProductosCantidadNegativaGQL, useValue: {} },
        { provide: ProductosFaltantesGQL, useValue: {} },
      ],
    });
  });

  it('un saldo entero se muestra sin decimales', () => {
    const f = montar(-3);

    expect(texto(f)).toContain('-3');
    expect(texto(f)).not.toContain('-3,00');
  });

  it('un sobrante entero tampoco los lleva, y conserva el signo', () => {
    const f = montar(7);

    expect(texto(f)).toContain('+7');
    expect(texto(f)).not.toContain('+7,00');
  });

  it('un saldo fraccionado sí los conserva: son kilos o un ajuste mal cargado', () => {
    const f = montar(2.5);

    expect(texto(f)).toContain('2,5');
  });

  it('el cero se muestra pelado', () => {
    const f = montar(0);

    expect(texto(f)).toContain('0');
    expect(texto(f)).not.toContain('0,00');
  });
});
