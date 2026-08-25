import { describe, expect, it } from 'vitest';

import { EstadoLote, Lote, normalizarNumeroLote } from '../domains/operaciones/lote.model';
import {
  detalleDeLote,
  fechaDeLote,
  indexarLotes,
  sugerenciasDeLote,
  validarLoteDeVerificacion,
} from '../pages/operaciones/recepcion/recepcion-lote';

const lote = (extra: Partial<Lote> = {}): Lote => ({
  id: 1,
  numeroLote: 'L-100',
  estado: EstadoLote.LIBERADO,
  ...extra,
});

describe('Número de lote', () => {
  it('normaliza con trim y mayúsculas, igual que el central', () => {
    // Sin esto, " lote2026101 " y "LOTE2026101" serían dos lotes distintos y
    // el saldo del mismo lote quedaría partido en dos filas.
    expect(normalizarNumeroLote(' lote2026101 ')).toBe('LOTE2026101');
    expect(normalizarNumeroLote(null)).toBe('');
  });
});

describe('Fechas que llegan del central', () => {
  it('recorta "yyyy-MM-dd HH:mm" a lo que entiende un input de fecha', () => {
    // El central serializa con espacio, no con la T de ISO 8601: el input
    // descarta el string entero y el campo queda vacío teniendo el dato.
    expect(fechaDeLote('2026-11-30 00:00')).toBe('2026-11-30');
    expect(fechaDeLote('2026-11-30')).toBe('2026-11-30');
  });

  it('la época Unix no es una fecha', () => {
    expect(fechaDeLote('1970-01-01 00:00')).toBe('');
  });

  it('sin dato devuelve vacío, no la palabra undefined', () => {
    expect(fechaDeLote(null)).toBe('');
    expect(fechaDeLote(undefined)).toBe('');
    expect(fechaDeLote('')).toBe('');
  });
});

describe('Detalle de un lote', () => {
  it('arma vencimiento y retiro en una línea', () => {
    expect(
      detalleDeLote(lote({ fechaVencimiento: '2026-11-30 00:00', fechaRetiro: '2026-11-01 00:00' })),
    ).toBe('vence 30/11/2026 · retiro 01/11/2026');
  });

  it('un lote fuera de circulación lo dice', () => {
    expect(detalleDeLote(lote({ estado: EstadoLote.BLOQUEADO }))).toBe('bloqueado');
  });

  it('un lote sin fechas no miente diciendo que no existe', () => {
    expect(detalleDeLote(lote())).toBe('sin fechas cargadas');
  });
});

describe('Índice de lotes', () => {
  it('indexa por número normalizado', () => {
    const indice = indexarLotes([lote({ numeroLote: ' l-100 ' })]);
    expect(indice.get('L-100')?.id).toBe(1);
  });

  it('con dos filas del mismo número gana la primera, que es la más próxima por FEFO', () => {
    const indice = indexarLotes([lote({ id: 1 }), lote({ id: 2 })]);
    expect(indice.get('L-100')?.id).toBe(1);
  });

  it('ignora las filas sin número', () => {
    expect(indexarLotes([lote({ numeroLote: '' })]).size).toBe(0);
  });
});

describe('Sugerencias mientras se tipea', () => {
  const lotes = [
    lote({ id: 1, numeroLote: 'AB-1' }),
    lote({ id: 2, numeroLote: 'AB-2' }),
    lote({ id: 3, numeroLote: 'X-AB' }),
  ];

  it('sin filtro ofrece todos, que es volver a recibir un lote ya comprado', () => {
    expect(sugerenciasDeLote(lotes, '').map((s) => s.numeroLote)).toEqual(['AB-1', 'AB-2', 'X-AB']);
  });

  it('los que empiezan con lo tipeado van antes que los que lo contienen', () => {
    expect(sugerenciasDeLote(lotes, 'ab').map((s) => s.numeroLote)).toEqual([
      'AB-1',
      'AB-2',
      'X-AB',
    ]);
  });

  it('no repite el que ya está tipeado entero: ése se anuncia como lote registrado', () => {
    // 'AB-1' coincide exacto y queda fuera; 'AB-10' sigue siendo una sugerencia
    // útil, porque el operador todavía puede estar tipeando.
    const conPrefijo = lotes.concat(lote({ id: 4, numeroLote: 'AB-10' }));
    expect(sugerenciasDeLote(conPrefijo, 'ab-1').map((s) => s.numeroLote)).toEqual(['AB-10']);
  });

  it('corta en el tope para no volverse un listado', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => lote({ id: i, numeroLote: 'L' + i }));
    expect(sugerenciasDeLote(muchos, '', 6)).toHaveLength(6);
  });

  it('marca el que está fuera de circulación', () => {
    const [sugerencia] = sugerenciasDeLote([lote({ estado: EstadoLote.CUARENTENA })], '');
    expect(sugerencia.requiereAtencion).toBe(true);
  });
});

describe('Lote obligatorio al verificar', () => {
  it('un producto con control de lote no se recibe sin número', () => {
    expect(validarLoteDeVerificacion(true, 10, '')).toBeTruthy();
    expect(validarLoteDeVerificacion(true, 10, '   ')).toBeTruthy();
  });

  it('con número, pasa', () => {
    expect(validarLoteDeVerificacion(true, 10, 'L-1')).toBeNull();
  });

  it('una verificación que es toda rechazo no tiene lote que informar', () => {
    expect(validarLoteDeVerificacion(true, 0, '')).toBeNull();
  });

  it('un producto sin control de lote no lo pide', () => {
    expect(validarLoteDeVerificacion(false, 10, '')).toBeNull();
  });
});
