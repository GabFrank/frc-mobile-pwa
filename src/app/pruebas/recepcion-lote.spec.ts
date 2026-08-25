import { describe, expect, it } from 'vitest';

import { EstadoLote, Lote, normalizarNumeroLote } from '../domains/operaciones/lote.model';
import {
  detalleDeLote,
  fechaDeLote,
  indexarLotes,
  sugerenciasDeLote,
  textoDeSugerencias,
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

  const numeros = (filtro: string, max?: number) =>
    sugerenciasDeLote(lotes, filtro, max).opciones.map((s) => s.numeroLote);

  it('con el campo vacío no ofrece nada: es un reconocimiento, no un catálogo', () => {
    // Un producto de rotación alta junta cientos de lotes; volcarlos al abrir
    // el diálogo tapa el vencimiento y el retiro, que es lo que hay que cargar.
    expect(sugerenciasDeLote(lotes, '')).toEqual({ opciones: [], restantes: 0 });
    expect(sugerenciasDeLote(lotes, '   ')).toEqual({ opciones: [], restantes: 0 });
  });

  it('con la primera tecla ya sugiere', () => {
    expect(numeros('a')).toEqual(['AB-1', 'AB-2', 'X-AB']);
  });

  it('los que empiezan con lo tipeado van antes que los que lo contienen', () => {
    expect(numeros('ab')).toEqual(['AB-1', 'AB-2', 'X-AB']);
  });

  it('no repite el que ya está tipeado entero: ése se anuncia como lote registrado', () => {
    // 'AB-1' coincide exacto y queda fuera; 'AB-10' sigue siendo una sugerencia
    // útil, porque el operador todavía puede estar tipeando.
    const conPrefijo = lotes.concat(lote({ id: 4, numeroLote: 'AB-10' }));
    expect(sugerenciasDeLote(conPrefijo, 'ab-1', 6).opciones.map((s) => s.numeroLote)).toEqual([
      'AB-10',
    ]);
  });

  it('corta en el tope y dice cuántas quedaron afuera', () => {
    const muchos = Array.from({ length: 20 }, (_, i) => lote({ id: i, numeroLote: 'L' + i }));
    const sugerencias = sugerenciasDeLote(muchos, 'l', 6);
    // Cortar en silencio se lee como «no hay más» y el operador termina
    // creando un lote nuevo teniendo el suyo registrado.
    expect(sugerencias.opciones).toHaveLength(6);
    expect(sugerencias.restantes).toBe(14);
  });

  it('marca el que está fuera de circulación', () => {
    const [sugerencia] = sugerenciasDeLote(
      [lote({ estado: EstadoLote.CUARENTENA })],
      'l-1',
    ).opciones;
    expect(sugerencia.requiereAtencion).toBe(true);
  });
});

describe('Qué se dice debajo del campo de lote', () => {
  const sinNada = { opciones: [], restantes: 0 };

  it('con el campo vacío no dice nada: eso ya lo anuncia la ayuda del campo', () => {
    expect(textoDeSugerencias(sinNada, '', false)).toBeNull();
  });

  it('sin coincidencias avisa que el lote va a ser nuevo', () => {
    expect(textoDeSugerencias(sinNada, 'ZZ-9', false)).toContain('se va a crear uno nuevo');
  });

  it('un lote reconocido no necesita explicación: ya la da el aviso de arriba', () => {
    expect(textoDeSugerencias(sinNada, 'AB-1', true)).toBeNull();
  });

  it('con sugerencias a la vista y nada cortado no dice nada', () => {
    const sugerencias = sugerenciasDeLote([lote({ numeroLote: 'AB-1' })], 'ab');
    expect(textoDeSugerencias(sugerencias, 'ab', false)).toBeNull();
  });

  it('cuando cortó, dice cuántas faltan y en singular si es una', () => {
    expect(textoDeSugerencias({ opciones: [], restantes: 1 }, 'a', false)).toContain('1 lote más');
    expect(textoDeSugerencias({ opciones: [], restantes: 4 }, 'a', false)).toContain('4 lotes más');
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
