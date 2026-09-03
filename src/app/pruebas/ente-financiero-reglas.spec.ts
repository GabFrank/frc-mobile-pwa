import { describe, expect, it } from 'vitest';

import {
  aplicarAutocompletado,
  avisoVencimiento,
  construirVistaResumen,
} from '../domains/gastos/ente-financiero.reglas';

const monedas = [
  { id: 1, denominacion: 'Guaraní', simbolo: '₲' },
  { id: 2, denominacion: 'Dólar', simbolo: 'US$' },
];

describe('Aviso de vencimiento', () => {
  it('no dice nada cuando el central no informó los días', () => {
    // Silencio, no «vence hoy». Un cero acá afirmaría algo que nadie dijo.
    expect(avisoVencimiento(null)).toBeNull();
    expect(avisoVencimiento(undefined)).toBeNull();
  });

  it('avisa que ya está vencida', () => {
    expect(avisoVencimiento(-3)).toBe('Cuota vencida hace 3 días');
  });

  it('avisa cuando falta poco', () => {
    expect(avisoVencimiento(4)).toBe('Vence en 4 días');
    expect(avisoVencimiento(10)).toBe('Vence en 10 días');
  });

  it('informa sin urgencia cuando falta mucho', () => {
    expect(avisoVencimiento(45)).toBe('Próximo vencimiento en 45 días');
  });
});

describe('Vista del resumen del activo', () => {
  it('conserva la denominación de la moneda, no solo el símbolo', () => {
    // El original redondeaba todo a entero, así que un resumen en dólares
    // perdía los centavos. La denominación es lo que decide la precisión.
    const vista = construirVistaResumen(
      { descripcion: 'CAMIONETA', montoTotal: 1284.5, montoPendiente: 642.25, monedaId: 2 },
      monedas,
    );

    expect(vista.denominacion).toBe('Dólar');
    expect(vista.montoTotal).toBe(1284.5);
    expect(vista.montoPendiente).toBe(642.25);
  });

  it('muestra el plan cuando hay cuotas', () => {
    const vista = construirVistaResumen(
      { cuotasTotales: 12, cuotasPagadas: 3, cuotasFaltantes: 9, monedaId: 1 },
      monedas,
    );

    expect(vista.mostrarCuotas).toBe(true);
    expect(vista.cuotaTexto).toBe('Cuota 4/12');
    expect(vista.cuotasFaltantesTexto).toBe('9 cuotas pendientes');
  });

  it('respeta el número de cuota que informa el central por sobre el calculado', () => {
    const vista = construirVistaResumen(
      { cuotasTotales: 12, cuotasPagadas: 3, numeroCuotaActual: 9, monedaId: 1 },
      monedas,
    );

    expect(vista.cuotaTexto).toBe('Cuota 9/12');
  });

  it('singulariza una sola cuota pendiente', () => {
    const vista = construirVistaResumen(
      { cuotasTotales: 6, cuotasPagadas: 5, cuotasFaltantes: 1, monedaId: 1 },
      monedas,
    );

    expect(vista.cuotasFaltantesTexto).toBe('1 cuota pendiente');
  });

  it('sin cuotas usa el estado que informa el central', () => {
    const vista = construirVistaResumen({ estadoCuota: 'AL DÍA', monedaId: 1 }, monedas);

    expect(vista.mostrarCuotas).toBe(false);
    expect(vista.cuotaTexto).toBe('AL DÍA');
  });

  it('sin día fijo lo dice, en vez de inventar uno', () => {
    expect(construirVistaResumen({ monedaId: 1 }, monedas).vencimientoTexto).toBe(
      'Sin día fijo',
    );
    expect(construirVistaResumen({ diaVencimiento: 10, monedaId: 1 }, monedas).vencimientoTexto)
      .toBe('Día 10 del mes');
  });
});

describe('Autocompletado al elegir un activo', () => {
  const vacio = {
    fechaVencimiento: '',
    detalles: [{ monto: null, monedaId: null, formaPago: 'EFECTIVO' }],
    beneficiarioTipo: 'PROVEEDOR' as const,
    beneficiarioProveedorId: null,
    textoProveedor: '',
  };

  it('completa el primer detalle cuando está vacío', () => {
    const r = aplicarAutocompletado(
      { montoSugerido: 450000, monedaId: 1, autocompletarMonto: true },
      vacio,
    );

    expect(r.detalles[0].monto).toBe(450000);
    expect(r.detalles[0].monedaId).toBe(1);
    expect(r.detalles[0].formaPago).toBe('EFECTIVO');
  });

  it('NO pisa un monto que el operador ya cargó', () => {
    // Es el apartamiento deliberado de frc-mobile: allá, cambiar de activo
    // borraba sin aviso lo que la persona había tipeado.
    const r = aplicarAutocompletado(
      { montoSugerido: 450000, monedaId: 1, autocompletarMonto: true },
      { ...vacio, detalles: [{ monto: 99, monedaId: 2, formaPago: 'EFECTIVO' }] },
    );

    expect(r.detalles[0].monto).toBe(99);
    expect(r.detalles[0].monedaId).toBe(2);
  });

  it('respeta un autocompletarMonto en false', () => {
    const r = aplicarAutocompletado(
      { montoSugerido: 450000, monedaId: 1, autocompletarMonto: false },
      vacio,
    );

    expect(r.detalles[0].monto).toBeNull();
  });

  it('completa el vencimiento solo si estaba vacío', () => {
    expect(
      aplicarAutocompletado({ fechaVencimientoSugerida: '2026-10-05T00:00:00' }, vacio)
        .fechaVencimiento,
    ).toBe('2026-10-05');

    expect(
      aplicarAutocompletado(
        { fechaVencimientoSugerida: '2026-10-05T00:00:00' },
        { ...vacio, fechaVencimiento: '2026-09-30' },
      ).fechaVencimiento,
    ).toBe('2026-09-30');
  });

  it('fuerza el beneficiario al proveedor que informa el central', () => {
    const r = aplicarAutocompletado(
      { proveedorId: 77, proveedorNombre: 'inmobiliaria del este' },
      { ...vacio, beneficiarioTipo: 'PERSONA' },
    );

    expect(r.beneficiarioTipo).toBe('PROVEEDOR');
    expect(r.beneficiarioProveedorId).toBe(77);
    expect(r.textoProveedor).toBe('INMOBILIARIA DEL ESTE');
  });

  it('deja todo como estaba cuando el resumen no sugiere nada', () => {
    expect(aplicarAutocompletado({}, vacio)).toEqual(vacio);
  });
});
