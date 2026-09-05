import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { FamiliaSearchGQL } from '../graphql/productos/familiaSearch';
import { SubfamiliaSearchGQL } from '../graphql/productos/subfamiliaSearch';
import { CategoriaPage } from '../pages/producto/editar/categoria.page';
import { ProductoEditarService } from '../pages/producto/editar/producto-editar.service';

/**
 * Familia y subfamilia: dos bugs a la vez.
 *
 * 1. El `id` de `Subfamilia` viaja como string (`ID` en el schema): sin
 *    `mismoId()`, la fila de la subfamilia elegida —`sub.id` string, cargado
 *    desde `producto()`— nunca matchea contra la de la lista, también
 *    string, y ninguna fila queda marcada "elegida".
 * 2. La etiqueta es `nombre`, no `descripcion` — confirmado por el dueño del
 *    producto: `descripcion` es una reseña libre, no un nombre.
 */
describe('Familia y subfamilia', () => {
  let datos: { consultar: ReturnType<typeof vi.fn> };

  const producto = () => ({
    id: 51,
    subfamilia: {
      id: '7', // como lo manda el central: ID -> string
      nombre: 'ANALGESICOS',
      familia: { id: '2', nombre: 'MEDICAMENTOS' },
    },
  });

  const estado = {
    cargando: () => false,
    error: () => null,
    producto,
    cargar: vi.fn(),
  };

  beforeEach(() => {
    datos = {
      consultar: vi.fn().mockReturnValue(
        of({
          getContent: [
            { id: '7', nombre: 'ANALGESICOS' },
            { id: '8', nombre: 'ANTIGRIPALES' },
          ],
          hasNext: false,
        }),
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ProductoEditarService, useValue: estado },
        { provide: DialogoService, useValue: {} },
        { provide: FamiliaSearchGQL, useValue: {} },
        { provide: SubfamiliaSearchGQL, useValue: {} },
        { provide: DatosService, useFactory: () => datos },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(CategoriaPage);
    f.componentRef.setInput('id', '51');
    f.detectChanges();
    return f;
  };

  it('marca como elegida la subfamilia del producto aunque el id venga como string', () => {
    const f = montar();
    f.detectChanges();

    const filas = f.nativeElement.querySelectorAll('.fila');
    expect(filas.length).toBe(2);
    // La primera (id '7') es la del producto: tiene que estar marcada.
    expect(filas[0].classList.contains('elegida')).toBe(true);
    expect(filas[1].classList.contains('elegida')).toBe(false);
  });

  it('muestra nombre, no descripcion, para familia y subfamilia', () => {
    const f = montar();
    f.detectChanges();

    const texto = f.nativeElement.textContent as string;
    expect(texto).toContain('MEDICAMENTOS');
    expect(texto).toContain('ANALGESICOS');
    expect(texto).toContain('ANTIGRIPALES');
  });
});
