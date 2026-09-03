import { describe, expect, it } from 'vitest';

import {
  DatosSolicitud,
  faltaParaGuardar,
  totalesPorMoneda,
} from '../pages/operaciones/gastos/gastos-solicitud.reglas';

const completo = (): DatosSolicitud => ({
  sucursalId: 1,
  responsableId: 10,
  tipoGastoId: 5,
  moduloPadre: 'PERSONAS',
  enteId: null,
  beneficiarioTipo: 'PROVEEDOR',
  beneficiarioPersonaId: null,
  beneficiarioProveedorId: 33,
  detalles: [{ monto: 50000, monedaId: 1, formaPago: 'EFECTIVO' }],
});

describe('Qué falta para poder pedir la plata', () => {
  it('no falta nada cuando está todo', () => {
    expect(faltaParaGuardar(completo())).toBeNull();
  });

  it('pide la sucursal de retiro', () => {
    expect(faltaParaGuardar({ ...completo(), sucursalId: null })).toBe(
      'Seleccione una sucursal de retiro',
    );
  });

  it('avisa cuando el usuario en sesión no tiene persona', () => {
    // Es un problema de datos, no de pantalla: el retiro se imputa a la
    // persona, no al usuario.
    expect(faltaParaGuardar({ ...completo(), responsableId: null })).toBe(
      'No se encontró la persona del usuario en sesión',
    );
  });

  it('pide el tipo de gasto', () => {
    expect(faltaParaGuardar({ ...completo(), tipoGastoId: null })).toBe(
      'Seleccione un tipo de gasto',
    );
  });

  it('exige el activo cuando el módulo padre lo requiere, con su etiqueta', () => {
    expect(
      faltaParaGuardar({ ...completo(), moduloPadre: 'VEHICULO', enteId: null }),
    ).toBe('Seleccione Vehículo');
  });

  it('un servicio continuo exige un inmueble, y lo dice con su contexto', () => {
    // La luz la consume un local. El módulo padre dice ANDE; el activo es un
    // inmueble.
    expect(faltaParaGuardar({ ...completo(), moduloPadre: 'ANDE', enteId: null })).toBe(
      'Seleccione Inmueble (ANDE)',
    );
  });

  it('no pide activo para PERSONAS ni para OTRO', () => {
    expect(faltaParaGuardar({ ...completo(), moduloPadre: 'OTRO', enteId: null })).toBeNull();
  });

  it('exige la persona cuando el beneficiario es una persona', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        beneficiarioTipo: 'PERSONA',
        beneficiarioPersonaId: null,
      }),
    ).toBe('Seleccione la persona beneficiaria');
  });

  it('exige el proveedor cuando el beneficiario es un proveedor', () => {
    expect(faltaParaGuardar({ ...completo(), beneficiarioProveedorId: null })).toBe(
      'Seleccione el proveedor beneficiario',
    );
  });

  it('rechaza un monto en cero', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [{ monto: 0, monedaId: 1, formaPago: 'EFECTIVO' }],
      }),
    ).toBe('Cargue un monto mayor a cero en el detalle 1');
  });

  it('rechaza un detalle sin forma de pago', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [{ monto: 100, monedaId: 1, formaPago: null }],
      }),
    ).toBe('Complete la moneda y la forma de pago del detalle 1');
  });

  it('NO permite repetir la misma moneda en dos detalles', () => {
    // Es la regla dura del modelo: el detalle financiero es una lista de
    // {monto, moneda, forma de pago} y cada moneda aparece una sola vez.
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [
          { monto: 100, monedaId: 1, formaPago: 'EFECTIVO' },
          { monto: 200, monedaId: 1, formaPago: 'TRANSFERENCIA' },
        ],
      }),
    ).toBe('No repita la misma moneda en más de un detalle');
  });

  it('permite dos detalles en monedas distintas', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [
          { monto: 100, monedaId: 1, formaPago: 'EFECTIVO' },
          { monto: 200, monedaId: 2, formaPago: 'EFECTIVO' },
        ],
      }),
    ).toBeNull();
  });
});

describe('Totales por moneda', () => {
  const monedas = [
    { id: 1, denominacion: 'Guaraní', simbolo: '₲' },
    { id: 2, denominacion: 'Dólar', simbolo: 'US$' },
  ];

  it('agrupa por moneda y conserva la denominación para el formato', () => {
    // La denominación es lo que decide si el importe lleva decimales. El
    // símbolo solo no alcanza.
    const totales = totalesPorMoneda(
      [
        { monto: 100, monedaId: 1, formaPago: 'EFECTIVO' },
        { monto: 50, monedaId: 2, formaPago: 'EFECTIVO' },
      ],
      monedas,
    );

    expect(totales).toEqual([
      { monedaId: 1, denominacion: 'Guaraní', simbolo: '₲', total: 100 },
      { monedaId: 2, denominacion: 'Dólar', simbolo: 'US$', total: 50 },
    ]);
  });

  it('ignora los detalles sin moneda o sin monto', () => {
    expect(
      totalesPorMoneda([{ monto: null, monedaId: 1, formaPago: 'EFECTIVO' }], monedas),
    ).toEqual([]);
  });
});
