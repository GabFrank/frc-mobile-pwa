import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BuscadorComponent,
  ConfigBuscadorPaginado,
} from '../shared/buscador/buscador.component';

interface Fila {
  id: number;
  nombre: string;
}

function montar(config: ConfigBuscadorPaginado<Fila>) {
  TestBed.configureTestingModule({
    imports: [BuscadorComponent],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: config },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });
  return TestBed.createComponent(BuscadorComponent<Fila>);
}

const base = (
  cargarPagina: ConfigBuscadorPaginado<Fila>['cargarPagina'],
): ConfigBuscadorPaginado<Fila> => ({
  modo: 'paginado',
  titulo: 'Buscar',
  cargarPagina,
  texto: (f) => f.nombre,
  id: (f) => f.id,
});

const texto = (fixture: ReturnType<typeof montar>) =>
  (fixture.nativeElement as HTMLElement).textContent ?? '';

/**
 * Deja correr el `.then()/.catch()/.finally()` de `cargarPagina`, que es una
 * promesa plana no registrada como tarea pendiente de Angular: `whenStable()`
 * se resuelve al toque y no espera nada. Mismo patrón que `escaner.spec.ts`.
 */
const asentar = async () => {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
};

describe('Buscador en modo paginado', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('muestra los resultados de la primera página', async () => {
    const fixture = montar(
      base(async () => ({ items: [{ id: 1, nombre: 'MANDIOCA' }], hayMas: false })),
    );
    fixture.detectChanges();
    await asentar();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('MANDIOCA');
  });

  it('dice que no pudo consultar cuando la carga falla, y NO «Sin resultados»', async () => {
    const fixture = montar(base(async () => Promise.reject(new Error('red caída'))));
    fixture.detectChanges();
    await asentar();
    fixture.detectChanges();

    // Un fallo de red presentado como «Sin resultados» le dice al operador que
    // el proveedor no existe. Cargaría el gasto contra otro.
    expect(texto(fixture)).toContain('No se pudo consultar');
    expect(texto(fixture)).not.toContain('Sin resultados');
    expect(fixture.componentInstance.error()).toBe(true);
  });

  it('sale del estado de error cuando la consulta vuelve a funcionar', async () => {
    let fallar = true;
    const fixture = montar(
      base(async () => {
        if (fallar) {
          throw new Error('red caída');
        }
        return { items: [{ id: 7, nombre: 'COSTILLA' }], hayMas: false };
      }),
    );
    fixture.detectChanges();
    await asentar();
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe(true);

    fallar = false;
    fixture.componentInstance.reintentar();
    await asentar();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe(false);
    expect(texto(fixture)).toContain('COSTILLA');
  });

  it('acumula la página siguiente en vez de reemplazarla', async () => {
    const paginas: Record<number, Fila[]> = {
      0: [{ id: 1, nombre: 'UNO' }],
      1: [{ id: 2, nombre: 'DOS' }],
    };
    const fixture = montar(
      base(async (_t, pagina) => ({ items: paginas[pagina] ?? [], hayMas: pagina === 0 })),
    );
    fixture.detectChanges();
    await asentar();
    fixture.detectChanges();

    fixture.componentInstance.cargarMas();
    await asentar();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('UNO');
    expect(texto(fixture)).toContain('DOS');
  });
});
