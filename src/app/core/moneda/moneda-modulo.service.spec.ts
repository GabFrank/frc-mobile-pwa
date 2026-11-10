import { TestBed } from '@angular/core/testing';
import { ServerError } from '@apollo/client/errors';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Moneda } from 'src/app/domains/moneda/moneda.model';
import {
  MonedaDeModuloGQL,
  MonedaEmpresaGQL,
  MonedasFormatoGQL,
} from 'src/app/graphql/operaciones/moneda/moneda-modulo';
import { MonedasGQL } from 'src/app/graphql/operaciones/moneda/monedas';
import { DatosService, ErrorDatos } from '../graphql/datos.service';
import { MonedaModuloService, monedaEmpresaDeLista } from './moneda-modulo.service';
import { MonedasSesion } from './monedas-sesion';

const moneda = (datos: Partial<Moneda>): Moneda => Object.assign(new Moneda(), datos);

/** Lo que contesta un central sin la configuración por módulo: el schema rechaza el campo. */
const campoDesconocido = () =>
  throwError(() => new ErrorDatos("Validation error (FieldUndefined@[data]) : Field 'monedaEmpresa' in type 'Query' is undefined"));

const sinRed = () =>
  throwError(() => {
    const causa = new ServerError('503', { response: { status: 503 } as Response, bodyText: '' });
    return new ErrorDatos('503', causa);
  });

describe('MonedaModuloService', () => {
  let servicio: MonedaModuloService;
  let sesion: MonedasSesion;
  let respuestas: Map<unknown, () => Observable<unknown>>;
  let consultar: ReturnType<typeof vi.fn>;

  const empresaGQL = { document: 'empresa' };
  const moduloGQL = { document: 'modulo' };
  const monedasGQL = { document: 'monedas' };
  /** El catalogo con principal y decimales. Por defecto contesta lo mismo que la lista basica. */
  const formatoGQL = { document: 'monedasFormato' };

  const listaVieja = [
    // Un central viejo: el id llega como texto y no hay `codigoIso`.
    { id: '2', denominacion: 'DOLAR', simbolo: 'US$', principal: false, decimales: 2 },
    { id: '1', denominacion: 'GUARANI', simbolo: 'Gs.', principal: true, decimales: 0 },
  ];

  beforeEach(() => {
    respuestas = new Map<unknown, () => Observable<unknown>>([
      [empresaGQL, campoDesconocido],
      [moduloGQL, campoDesconocido],
      [monedasGQL, () => of(listaVieja)],
      [formatoGQL, () => respuestas.get(monedasGQL)!()],
    ]);
    consultar = vi.fn((gql: unknown) => respuestas.get(gql)!());

    TestBed.configureTestingModule({
      providers: [
        { provide: DatosService, useValue: { consultar } },
        { provide: MonedaEmpresaGQL, useValue: empresaGQL },
        { provide: MonedaDeModuloGQL, useValue: moduloGQL },
        { provide: MonedasGQL, useValue: monedasGQL },
        { provide: MonedasFormatoGQL, useValue: formatoGQL },
      ],
    });
    servicio = TestBed.inject(MonedaModuloService);
    sesion = TestBed.inject(MonedasSesion);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  describe('cargar', () => {
    it('con un central nuevo usa monedaEmpresa', async () => {
      respuestas.set(empresaGQL, () =>
        of({ id: '7', denominacion: 'GUARANI', simbolo: 'Gs.', codigoIso: 'PYG', decimales: 0, principal: true }),
      );
      await servicio.cargar();
      expect(servicio.empresa()?.id).toBe(7);
      expect(servicio.empresa()?.codigoIso).toBe('PYG');
      // Sigue siendo un `Moneda`, con sus métodos.
      expect(servicio.empresa()).toBeInstanceOf(Moneda);
      expect(sesion.catalogo().map((m) => m.id)).toEqual([2, 1]);
    });

    it('con un central viejo cae a la principal de la lista', async () => {
      await servicio.cargar();
      expect(servicio.empresa()?.id).toBe(1);
      expect(servicio.empresa()?.denominacion).toBe('GUARANI');
    });

    it('sin principal en la lista, cae al guaraní', async () => {
      respuestas.set(monedasGQL, () =>
        of([
          { id: '2', denominacion: 'DOLAR', simbolo: 'US$' },
          { id: '1', denominacion: 'Guaraní', simbolo: '₲' },
        ]),
      );
      await servicio.cargar();
      expect(servicio.empresa()?.id).toBe(1);
    });

    it('si no se reconoce ninguna, null: los importes quedan como antes', async () => {
      respuestas.set(monedasGQL, () => of([{ id: '2', denominacion: 'DOLAR', simbolo: 'US$' }]));
      await servicio.cargar();
      expect(servicio.empresa()).toBeNull();
    });

    it('si falla todo, null y sin lanzar', async () => {
      respuestas.set(monedasGQL, sinRed);
      await expect(servicio.cargar()).resolves.toBeUndefined();
      expect(servicio.empresa()).toBeNull();
      expect(sesion.catalogo()).toEqual([]);
    });

    it('un central sin principal ni decimales en el schema: cae a la lista básica y al guaraní por nombre', async () => {
      respuestas.set(formatoGQL, campoDesconocido);
      respuestas.set(monedasGQL, () =>
        of([
          { id: '2', denominacion: 'DOLAR', simbolo: 'US$' },
          { id: '1', denominacion: 'GUARANI', simbolo: 'Gs.' },
        ]),
      );
      await servicio.cargar();
      expect(servicio.empresa()?.id).toBe(1);
      expect(sesion.catalogo().map((m) => m.id)).toEqual([2, 1]);
    });

    it('si monedaEmpresa devuelve null, también cae a la lista', async () => {
      respuestas.set(empresaGQL, () => of(null));
      await servicio.cargar();
      expect(servicio.empresa()?.id).toBe(1);
    });

    it('no pide spinner ni toast: no es algo que la persona pidió', async () => {
      await servicio.cargar();
      for (const llamada of consultar.mock.calls) {
        expect(llamada[2]).toEqual({ mostrarCarga: false, notificarError: false });
      }
    });

    it('una carga vieja que termina tarde no pisa a la nueva', async () => {
      let liberar!: (v: unknown) => void;
      respuestas.set(monedasGQL, () => new Observable((s) => { liberar = (v) => { s.next(v); s.complete(); }; }));
      const vieja = servicio.cargar();
      respuestas.set(monedasGQL, () => of([{ id: '9', denominacion: 'GUARANI', principal: true }]));
      await servicio.cargar();
      liberar(listaVieja);
      await vieja;
      expect(servicio.empresa()?.id).toBe(9);
    });
  });

  describe('monedaDe', () => {
    it('devuelve la moneda que el central configuró para el módulo', async () => {
      respuestas.set(moduloGQL, () => of({ id: '2', denominacion: 'DOLAR', codigoIso: 'USD', decimales: 2 }));
      await servicio.cargar();
      const m = await servicio.monedaDe('COMPRAS', 5);
      expect(m?.id).toBe(2);
      expect(consultar).toHaveBeenCalledWith(moduloGQL, { modulo: 'COMPRAS', sucursalId: 5 }, expect.anything());
    });

    it('no manda sucursalId si no se pasó', async () => {
      respuestas.set(moduloGQL, () => of({ id: '1', denominacion: 'GUARANI' }));
      await servicio.monedaDe('PDV');
      expect(consultar).toHaveBeenCalledWith(moduloGQL, { modulo: 'PDV' }, expect.anything());
    });

    it('recuerda la respuesta por módulo y sucursal', async () => {
      respuestas.set(moduloGQL, () => of({ id: '2', denominacion: 'DOLAR' }));
      await servicio.monedaDe('COMPRAS', 5);
      await servicio.monedaDe('COMPRAS', 5);
      await servicio.monedaDe('COMPRAS', 6);
      const delModulo = consultar.mock.calls.filter((c) => c[0] === moduloGQL);
      expect(delModulo).toHaveLength(2);
    });

    it('con un central viejo, la de la empresa', async () => {
      await servicio.cargar();
      const m = await servicio.monedaDe('PRECIOS');
      expect(m?.id).toBe(1);
    });

    it('espera la carga en curso antes de responder con la de la empresa', async () => {
      const carga = servicio.cargar();
      const m = await servicio.monedaDe('COSTOS');
      await carga;
      expect(m?.id).toBe(1);
    });

    it('si el schema lo rechazó, no vuelve a preguntar en la sesión', async () => {
      await servicio.cargar();
      await servicio.monedaDe('COMPRAS');
      await servicio.monedaDe('PDV');
      const delModulo = consultar.mock.calls.filter((c) => c[0] === moduloGQL);
      expect(delModulo).toHaveLength(1);
    });

    it('un fallo de red sí se vuelve a intentar', async () => {
      respuestas.set(moduloGQL, sinRed);
      await servicio.cargar();
      expect((await servicio.monedaDe('COMPRAS'))?.id).toBe(1);
      respuestas.set(moduloGQL, () => of({ id: '2', denominacion: 'DOLAR' }));
      expect((await servicio.monedaDe('COMPRAS'))?.id).toBe(2);
    });

    it('si el módulo resuelve a null, la de la empresa', async () => {
      respuestas.set(moduloGQL, () => of(null));
      await servicio.cargar();
      expect((await servicio.monedaDe('COMPRAS'))?.id).toBe(1);
    });

    it('una carga nueva olvida lo aprendido de la sesión anterior', async () => {
      await servicio.cargar();
      await servicio.monedaDe('COMPRAS');
      respuestas.set(moduloGQL, () => of({ id: '2', denominacion: 'DOLAR' }));
      await servicio.cargar();
      expect((await servicio.monedaDe('COMPRAS'))?.id).toBe(2);
    });
  });
});

describe('monedaEmpresaDeLista', () => {
  it('prefiere la principal activa', () => {
    const lista = [
      moneda({ id: 1, denominacion: 'GUARANI', principal: true, activo: false }),
      moneda({ id: 2, denominacion: 'DOLAR', principal: true, activo: true }),
    ];
    expect(monedaEmpresaDeLista(lista)?.id).toBe(2);
  });

  it('sin principal, el guaraní por nombre o símbolo', () => {
    expect(monedaEmpresaDeLista([moneda({ id: 2, denominacion: 'DOLAR' }), moneda({ id: 3, simbolo: '₲' })])?.id).toBe(3);
  });

  it('lista vacía, null', () => {
    expect(monedaEmpresaDeLista([])).toBeNull();
  });
});
