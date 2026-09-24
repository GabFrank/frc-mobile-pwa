import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from '../core/graphql/datos.service';
import { GastosService } from '../pages/operaciones/gastos/gastos.service';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

describe('GastosService — alta de solicitud', () => {
  let datos: {
    consultar: ReturnType<typeof vi.fn>;
    mutar: ReturnType<typeof vi.fn>;
    guardar: ReturnType<typeof vi.fn>;
    paginado: ReturnType<typeof vi.fn>;
  };

  const servicio = () => TestBed.inject(GastosService);

  beforeEach(() => {
    datos = {
      consultar: vi.fn(() => of(null)),
      mutar: vi.fn(() => of(null)),
      guardar: vi.fn(() => of({ id: 1 })),
      paginado: vi.fn(() => of([])),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [...APOLLO_DE_PRUEBA],
      providers: [{ provide: DatosService, useValue: datos }],
    });
  });

  describe('resolución del ente', () => {
    it('devuelve el ente existente sin crear uno nuevo', async () => {
      // Crear un ente duplicado por cada solicitud ensucia el catálogo
      // financiero, y el activo termina con dos fichas de deuda.
      datos.consultar.mockReturnValue(of({ id: 5, tipoEnte: 'VEHICULO' }));

      const ente = await servicio().resolverEnte('VEHICULO', 88);

      expect(ente.id).toBe(5);
      expect(datos.mutar).not.toHaveBeenCalled();
    });

    it('crea el ente cuando el activo todavía no tiene ficha financiera', async () => {
      datos.consultar.mockReturnValue(of(null));
      datos.mutar.mockReturnValue(of({ id: 9 }));

      const ente = await servicio().resolverEnte('INMUEBLE', 12);

      expect(ente.id).toBe(9);
      // ⚠️ `saveEnte` recibe su argumento como `ente:`, no `entity:`.
      expect(datos.mutar.mock.calls[0][1]).toEqual({
        ente: { tipoEnte: 'INMUEBLE', referenciaId: 12, activo: true },
      });
    });

    it('mapea EQUIPOS a EQUIPO', async () => {
      // El módulo padre es plural y el tipo de ente singular. Comparar
      // directo falla y el ente se crearía con un tipo que el central no
      // reconoce.
      datos.consultar.mockReturnValue(of(null));
      datos.mutar.mockReturnValue(of({ id: 3 }));

      await servicio().resolverEnte('EQUIPOS', 4);

      expect(datos.consultar.mock.calls[0][1]).toMatchObject({ tipoEnte: 'EQUIPO' });
    });

    it('un servicio continuo se imputa a un inmueble', async () => {
      // La luz la consume un local, no la categoría «ANDE».
      datos.consultar.mockReturnValue(of({ id: 2 }));

      await servicio().resolverEnte('ANDE', 30);

      expect(datos.consultar.mock.calls[0][1]).toMatchObject({ tipoEnte: 'INMUEBLE' });
    });

    it('rechaza un módulo que no admite activo', async () => {
      await expect(servicio().resolverEnte('PERSONAS', 1)).rejects.toThrow(
        'El tipo de gasto no admite vinculación a un activo',
      );
    });
  });

  describe('buscadores paginados', () => {
    it('devuelve hayMas según el hasNext del central', async () => {
      datos.consultar.mockReturnValue(
        of({ getContent: [{ id: 1, chapa: 'ABC123' }], hasNext: true }),
      );

      const pagina = await servicio().buscarVehiculos('abc', 0);

      expect(pagina.items).toHaveLength(1);
      expect(pagina.hayMas).toBe(true);
      expect(datos.consultar.mock.calls[0][1]).toMatchObject({ texto: 'abc', page: 0 });
    });

    it('corta cuando no hay más páginas', async () => {
      // Con `hayMas` en true de más, «Cargar más» pide páginas vacías para
      // siempre.
      datos.consultar.mockReturnValue(of({ getContent: [], hasNext: false }));

      expect((await servicio().buscarPersonas('', 3)).hayMas).toBe(false);
    });

    it('una respuesta sin contenido no rompe la lista', async () => {
      datos.consultar.mockReturnValue(of(null));

      expect(await servicio().buscarMuebles('x', 0)).toEqual({ items: [], hayMas: false });
    });
  });

  describe('alta', () => {
    it('manda el input al guardado, sin cajaId', async () => {
      // `cajaId` existe en frc-mobile y viaja siempre undefined: sale de una
      // clave de localStorage que nadie escribe.
      const input = {
        sucursalId: 1,
        finanzas: [{ monedaId: 1, formaPago: 'EFECTIVO', monto: 500 }],
      };

      servicio().crearSolicitud(input).subscribe();

      expect(datos.guardar).toHaveBeenCalled();
      expect(datos.guardar.mock.calls[0][1]).not.toHaveProperty('cajaId');
      expect(datos.guardar.mock.calls[0][1]).toMatchObject(input);
    });
  });
});
