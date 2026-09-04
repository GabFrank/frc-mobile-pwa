import { describe, expect, it } from 'vitest';

import {
  DatosSolicitud,
  construirPreGastoInput,
  faltaParaGuardar,
  totalesPorMoneda,
} from '../pages/operaciones/gastos/gastos-solicitud.reglas';

const completo = (): DatosSolicitud => ({
  sucursalId: 1,
  responsableId: 10,
  tipoGastoId: 5,
  moduloPadre: 'PERSONAS',
  enteId: null,
  errorResumen: false,
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

  it('rechaza la sucursal SERVIDOR, con id 0, con un mensaje que no miente', () => {
    // El central rechaza `sucursalId <= 0` al guardar (`PreGastoGraphQL.java`).
    // La pantalla ya no ofrece SERVIDOR en el selector, pero esta regla es la
    // fuente de verdad: si un `0` se cuela por otra vía, el mensaje tiene que
    // decir que esa sucursal no sirve, no «seleccione una sucursal» —eso
    // sugeriría que no hay ninguna elegida, y sí la hay.
    expect(faltaParaGuardar({ ...completo(), sucursalId: 0 })).toBe(
      'Esa sucursal no puede recibir solicitudes de caja chica',
    );
  });

  it('un id 0 de responsable o tipo de gasto tampoco cuenta como ausente', () => {
    expect(faltaParaGuardar({ ...completo(), responsableId: 0 })).toBeNull();
    expect(faltaParaGuardar({ ...completo(), tipoGastoId: 0 })).toBeNull();
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

  it('no deja guardar si falló el resumen del activo, aunque haya quedado un enteId cargado', () => {
    // El caso del defecto: se elige el activo A (enteId 50), falla el
    // resolverEnte del activo B, y sin este chequeo el 50 seguía imputado.
    expect(
      faltaParaGuardar({
        ...completo(),
        moduloPadre: 'VEHICULO',
        enteId: 50,
        errorResumen: true,
      }),
    ).toBe('No se pudo confirmar vehículo, intente de nuevo');
  });

  it('no exige el resumen del activo cuando el módulo padre no pide uno', () => {
    // `errorResumen` sin activo requerido no tiene que bloquear nada.
    expect(
      faltaParaGuardar({ ...completo(), moduloPadre: 'PERSONAS', errorResumen: true }),
    ).toBeNull();
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

  it('encuentra la moneda aunque el id llegue como string, como lo devuelve el central', () => {
    // GraphQL serializa `ID` como string: el catálogo real trae
    // `{ id: "1", ... }`, no `{ id: 1, ... }`. Sin esto la fila de totales
    // mostraba «Total : 5.000.000,00» en vez de «Total GUARANI: 5.000.000».
    const monedasComoLasDevuelveElCentral = [
      { id: '1', denominacion: 'GUARANI', simbolo: 'Gs.' },
      { id: '2', denominacion: 'Dólar', simbolo: 'US$' },
    ];

    const totales = totalesPorMoneda(
      [{ monto: 5000000, monedaId: 1, formaPago: 'EFECTIVO' }],
      monedasComoLasDevuelveElCentral,
    );

    expect(totales).toEqual([
      { monedaId: 1, denominacion: 'GUARANI', simbolo: 'Gs.', total: 5000000 },
    ]);
  });
});

describe('El input que se manda al central', () => {
  const base = {
    sucursalId: 1,
    responsableId: 41,
    tipoGastoId: 5,
    enteId: 50,
    beneficiarioTipo: 'PROVEEDOR' as const,
    beneficiarioPersonaId: 77,
    beneficiarioProveedorId: 33,
    fechaVencimiento: '2026-10-05',
    nivelUrgencia: 'NORMAL',
    descripcion: '  combustible de la semana  ',
    detalles: [{ monto: 500, monedaId: 1, formaPago: 'EFECTIVO' }],
  };

  it('no lleva cajaId', () => {
    // El campo existe en frc-mobile y viaja siempre undefined: sale de una
    // clave de localStorage que nadie escribe en todo el repo.
    expect(construirPreGastoInput(base)).not.toHaveProperty('cajaId');
  });

  it('la sucursal de la caja es la misma de retiro', () => {
    const input = construirPreGastoInput(base);
    expect(input.sucursalId).toBe(1);
    expect(input.sucursalCajaId).toBe(1);
  });

  it('manda el beneficiario que corresponde y no el otro', () => {
    // Mandar los dos dejaría al central decidiendo cuál vale.
    const proveedor = construirPreGastoInput(base);
    expect(proveedor.beneficiarioProveedorId).toBe(33);
    expect(proveedor.beneficiarioPersonaId).toBeUndefined();

    const persona = construirPreGastoInput({ ...base, beneficiarioTipo: 'PERSONA' });
    expect(persona.beneficiarioPersonaId).toBe(77);
    expect(persona.beneficiarioProveedorId).toBeUndefined();
  });

  it('recorta la descripción y la omite si queda vacía', () => {
    expect(construirPreGastoInput(base).descripcion).toBe('combustible de la semana');
    expect(
      construirPreGastoInput({ ...base, descripcion: '   ' }).descripcion,
    ).toBeUndefined();
  });

  it('omite el vencimiento vacío en vez de mandar cadena vacía', () => {
    expect(
      construirPreGastoInput({ ...base, fechaVencimiento: '' }).fechaVencimiento,
    ).toBeUndefined();
  });

  it('agrega la hora al vencimiento para que el central lo pueda parsear', () => {
    // El central hace LocalDateTime.parse(..., ISO_DATE_TIME) y traga la
    // excepción en silencio: sin hora, "2026-10-05" no matchea y el campo
    // queda nulo aunque la mutation responda OK.
    expect(construirPreGastoInput(base).fechaVencimiento).toBe('2026-10-05T00:00:00');
  });

  it('manda las finanzas con monto, moneda y forma de pago', () => {
    expect(construirPreGastoInput(base).finanzas).toEqual([
      { monto: 500, monedaId: 1, formaPago: 'EFECTIVO' },
    ]);
  });

  it('no manda usuarioId: lo completa la capa de datos desde la sesión', () => {
    expect(construirPreGastoInput(base)).not.toHaveProperty('usuarioId');
  });
});
