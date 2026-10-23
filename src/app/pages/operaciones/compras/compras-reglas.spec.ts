import { describe, expect, it } from 'vitest';

import type { RenglonFactura } from 'src/app/domains/compras/compras.model';
import {
  facturaYaUsada,
  avisosVisibles,
  aId,
  contarFiltros,
  esKude,
  filtrarRenglones,
  repartoCompleto,
  repartoIgual,
  sumaReparto,
  textoFactor,
  textoParaBuscar,
  tonoAviso,
  tonoEtapa,
  tonoRenglon,
} from './compras-reglas';

/** CDC del KuDE de MARVI, el que se probó contra SIFEN. */
const CDC = '01800625072001001006749522026100813312781711';

function renglon(id: number, estado: string, avisosIva: string[] = []): RenglonFactura {
  return { id, estado, diferencias: [], avisosIva, avisos: [], sugerencias: [] };
}

describe('esKude', () => {
  it('reconoce la URL del QR de ekuatia', () => {
    expect(
      esKude('https://ekuatia.set.gov.py/consultas/qr?nVersion=150&Id=' + CDC + '&dRucRec=80099482'),
    ).toBe(true);
  });

  it('reconoce la URL con &amp; como sale del XML', () => {
    expect(esKude('https://ekuatia.set.gov.py/consultas/qr?nVersion=150&amp;Id=' + CDC)).toBe(true);
  });

  it('reconoce el CDC impreso, con los espacios del KuDE', () => {
    expect(esKude('0180 0625 0720 0100 1006 7495 2202 6100 8133 1278 1711')).toBe(true);
  });

  it('un código de barras no es un KuDE: sigue yendo al buscador', () => {
    expect(esKude('7841503002169')).toBe(false);
  });

  it('otra URL de ekuatia sin CDC no es un KuDE', () => {
    expect(esKude('https://ekuatia.set.gov.py/consultas/')).toBe(false);
  });

  it('vacío no es un KuDE', () => {
    expect(esKude('')).toBe(false);
    expect(esKude(null)).toBe(false);
  });
});

describe('aId', () => {
  it('un texto vacío no es el registro cero', () => {
    expect(aId('')).toBeNull();
    expect(aId(null)).toBeNull();
    expect(aId('0')).toBeNull();
    expect(aId('abc')).toBeNull();
    expect(aId('45')).toBe(45);
  });
});

describe('tonos', () => {
  it('coincide en verde, diferencia y fuera de pedido en amarillo, sin producto en rojo', () => {
    expect(tonoRenglon('OK')).toBe('ok');
    expect(tonoRenglon('DIFERENCIA')).toBe('warn');
    expect(tonoRenglon('FUERA_DE_PEDIDO')).toBe('warn');
    expect(tonoRenglon('SIN_PRODUCTO')).toBe('danger');
    expect(tonoRenglon('OTRO')).toBe('neutral');
  });

  it('un bloqueo se ve en rojo y una advertencia en amarillo', () => {
    expect(tonoAviso({ nivel: 'BLOQUEO' })).toBe('danger');
    expect(tonoAviso({ nivel: 'ADVERTENCIA' })).toBe('warn');
    expect(tonoAviso({ nivel: 'INFO' })).toBe('info');
  });
});

describe('filtros de renglones', () => {
  const renglones = [
    renglon(1, 'OK'),
    renglon(2, 'OK', ['El precio de la factura es el del pedido más el IVA del 10 %']),
    renglon(3, 'DIFERENCIA'),
    renglon(4, 'SIN_PRODUCTO'),
    renglon(5, 'FUERA_DE_PEDIDO'),
  ];

  it('«para revisar» incluye lo que coincide pero trae un aviso de IVA', () => {
    expect(filtrarRenglones(renglones, 'revisar').map((r) => r.id)).toEqual([2, 3, 4, 5]);
  });

  it('«coinciden» es lo que no hay que tocar', () => {
    expect(filtrarRenglones(renglones, 'ok').map((r) => r.id)).toEqual([1]);
  });

  it('los conteos cuadran con los filtros', () => {
    expect(contarFiltros(renglones)).toEqual({ todos: 5, revisar: 4, 'sin-producto': 1, ok: 1 });
  });

  it('una alerta del central manda a «para revisar» lo que coincide', () => {
    const conAlerta = {
      ...renglon(6, 'OK'),
      alertas: ['El código es de «ARCOR HOGAREÑAS 7 SEMILLAS 189G», pero la factura dice «GOMAS MOGUL COLA»'],
    };
    expect(filtrarRenglones([renglon(1, 'OK'), conAlerta], 'revisar').map((r) => r.id)).toEqual([6]);
  });

  it('un central sin el campo alertas no rompe el filtro', () => {
    expect(filtrarRenglones([renglon(1, 'OK')], 'ok').map((r) => r.id)).toEqual([1]);
  });
});

describe('textoFactor', () => {
  it('dice cuántas unidades base trae cada unidad de la factura', () => {
    expect(textoFactor(20, 'CAJ')).toBe('1 CAJ = 20 u.');
    expect(textoFactor(null, 'UNI')).toBe('1 UNI = 1 u.');
  });
});

describe('textoParaBuscar', () => {
  it('saca el «C/20» y el gramaje de la descripción del proveedor', () => {
    expect(textoParaBuscar('SENSEI PAPAS FRITAS PIZZA 140gr.C/20')).toBe('SENSEI PAPAS FRITAS');
    expect(textoParaBuscar('POLIFOAM ESPONJA DE ACERO INOX C/60')).toBe('POLIFOAM ESPONJA ACERO');
    expect(textoParaBuscar(null)).toBe('');
  });
});

describe('tonoEtapa', () => {
  it('lo que espera la factura en amarillo, lo que sigue en otra área en azul, lo terminado en verde', () => {
    expect(tonoEtapa('RECEPCION_NOTA', 'PENDIENTE')).toBe('warn');
    expect(tonoEtapa('RECEPCION_NOTA', 'EN_PROCESO')).toBe('info');
    expect(tonoEtapa('RECEPCION_MERCADERIA')).toBe('info');
    expect(tonoEtapa('CONCLUIDA')).toBe('ok');
    expect(tonoEtapa(null)).toBe('neutral');
  });
});

describe('repartoIgual', () => {
  it('reparte entero y da las sobras a las primeras', () => {
    expect(repartoIgual(14, 3)).toEqual([5, 5, 4]);
    expect(repartoIgual(2, 3)).toEqual([1, 1, 0]);
  });

  it('con cantidad decimal la última se lleva el resto', () => {
    const partes = repartoIgual(10.5, 2);
    expect(sumaReparto(partes)).toBeCloseTo(10.5, 6);
  });

  it('sin sucursales no reparte', () => {
    expect(repartoIgual(5, 0)).toEqual([]);
  });
});

describe('repartoCompleto', () => {
  it('pide que sume el renglón', () => {
    expect(repartoCompleto(14, [5, 5, 4])).toBe(true);
    expect(repartoCompleto(14, [5, 5, null])).toBe(false);
  });

  it('no acepta negativos aunque sume', () => {
    expect(repartoCompleto(4, [5, -1])).toBe(false);
  });
});

describe('avisosVisibles', () => {
  const avisos = [
    { tipo: 'PAGO', nivel: 'INFO', mensaje: 'La factura no dice la forma de pago: elegila antes de crear la compra.' },
    { tipo: 'IVA', nivel: 'INFO', mensaje: 'Los precios de la factura incluyen IVA.' },
  ];

  it('sin forma de pago elegida se ven todos', () => {
    expect(avisosVisibles(avisos, false).map((a) => a.tipo)).toEqual(['PAGO', 'IVA']);
  });

  it('con la forma de pago elegida, el aviso de pago se va', () => {
    expect(avisosVisibles(avisos, true).map((a) => a.tipo)).toEqual(['IVA']);
  });
});

describe('facturaYaUsada', () => {
  it('reconoce los dos rechazos definitivos del central', () => {
    expect(facturaYaUsada('Esta factura ya está cargada: nota 55357 del pedido 2069.')).toBe(true);
    expect(
      facturaYaUsada('Esta factura ya creó la compra 2069: se carga sola cuando se finalice su planificación en el desktop.'),
    ).toBe(true);
  });

  it('un error de SIFEN o de red sí deja reintentar', () => {
    expect(facturaYaUsada('SIFEN no respondió. Probá de nuevo.')).toBe(false);
    expect(facturaYaUsada(null)).toBe(false);
  });
});
