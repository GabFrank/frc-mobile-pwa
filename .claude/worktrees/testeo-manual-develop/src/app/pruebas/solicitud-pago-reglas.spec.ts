import { describe, expect, it } from 'vitest';

import { Moneda } from '../domains/moneda/moneda.model';
import { NotaRecepcion } from '../domains/pedidos/recepcion.model';
import {
  PagoEstado,
  SolicitudPago,
  SolicitudPagoEstado,
} from '../domains/pedidos/solicitud-pago.model';
import { resolverEstado } from '../shared/estado/estado-registry';
import {
  esEditable,
  estaEnColaDePagos,
  faltaParaGuardar,
  fechaParaBackend,
  hayMonedasMezcladas,
  puedeSolicitar,
  resumenDelPago,
  totalEstimado,
  yaEstaEnLaLista,
} from '../pages/operaciones/solicitud-pago/solicitud-pago-reglas';

const nota = (extra: Partial<NotaRecepcion> = {}): NotaRecepcion => ({
  id: 1,
  numero: 100,
  valorTotal: 500_000,
  estado: 'RECEPCION_COMPLETA',
  ...extra,
});

/** `Moneda` es una clase con `toInput()`: el literal suelto no la satisface. */
const moneda = (id: number) => ({ id }) as Moneda;

const completo = {
  proveedorId: 7,
  monedaId: 1,
  formaPagoId: 2,
  notas: [nota()],
};

describe('Qué falta para poder guardar', () => {
  it('con todo cargado no falta nada', () => {
    expect(faltaParaGuardar(completo)).toBeNull();
  });

  it('sin proveedor no deja avanzar', () => {
    expect(faltaParaGuardar({ ...completo, proveedorId: null })).toContain('proveedor');
  });

  it('sin notas no deja avanzar', () => {
    // Una solicitud sin notas no pide nada: el backend guardaría una
    // cabecera en cero y el proveedor no cobraría.
    expect(faltaParaGuardar({ ...completo, notas: [] })).toContain('nota');
  });

  it('sin moneda ni forma de pago no deja avanzar', () => {
    expect(faltaParaGuardar({ ...completo, monedaId: null })).toContain('moneda');
    expect(faltaParaGuardar({ ...completo, formaPagoId: null })).toContain('forma de pago');
  });

  it('el proveedor se reclama antes que las notas', () => {
    // Las notas se buscan por proveedor: pedirlas primero sería pedir algo
    // que todavía no se puede hacer.
    expect(faltaParaGuardar({ proveedorId: null, notas: [] })).toContain('proveedor');
  });
});

describe('Total estimado', () => {
  it('suma el valor de las notas', () => {
    expect(totalEstimado([nota({ valorTotal: 100 }), nota({ id: 2, valorTotal: 250 })])).toBe(350);
  });

  it('una nota sin valor cuenta como cero, no rompe la suma', () => {
    expect(totalEstimado([nota({ valorTotal: undefined }), nota({ id: 2, valorTotal: 80 })])).toBe(
      80,
    );
  });

  it('sin notas es cero', () => {
    expect(totalEstimado([])).toBe(0);
  });
});

describe('Notas repetidas', () => {
  it('detecta la nota ya cargada', () => {
    expect(yaEstaEnLaLista([nota({ id: 5 })], nota({ id: 5 }))).toBe(true);
  });

  it('compara como texto, porque el id llega número o string', () => {
    // GraphQL tipa el id como ID: llega '5' en una consulta y 5 en otra.
    // Comparando con === se agregaría dos veces la misma nota.
    expect(yaEstaEnLaLista([nota({ id: 5 })], nota({ id: '5' as unknown as number }))).toBe(true);
  });

  it('una nota distinta no es repetida', () => {
    expect(yaEstaEnLaLista([nota({ id: 5 })], nota({ id: 6 }))).toBe(false);
  });
});

describe('Monedas mezcladas', () => {
  it('avisa cuando las notas no comparten moneda', () => {
    expect(
      hayMonedasMezcladas([nota({ moneda: moneda(1) }), nota({ id: 2, moneda: moneda(2) })]),
    ).toBe(true);
  });

  it('con una sola moneda no avisa', () => {
    expect(
      hayMonedasMezcladas([nota({ moneda: moneda(1) }), nota({ id: 2, moneda: moneda(1) })]),
    ).toBe(false);
  });

  it('las notas sin moneda no cuentan como una moneda más', () => {
    // Si no, cualquier nota sin moneda dispararía el aviso de conversión.
    expect(hayMonedasMezcladas([nota({ moneda: undefined }), nota({ id: 2, moneda: moneda(1) })])).toBe(
      false,
    );
  });
});

describe('Editable', () => {
  it('solo en PENDIENTE', () => {
    // El central tira IllegalStateException con cualquier otro estado.
    expect(esEditable(SolicitudPagoEstado.PENDIENTE)).toBe(true);
    expect(esEditable(SolicitudPagoEstado.SOLICITADO)).toBe(false);
    expect(esEditable(SolicitudPagoEstado.PARCIAL)).toBe(false);
    expect(esEditable(SolicitudPagoEstado.CONCLUIDO)).toBe(false);
    expect(esEditable(SolicitudPagoEstado.CANCELADO)).toBe(false);
    expect(esEditable(null)).toBe(false);
  });
});

describe('Borrador y cola de pagos', () => {
  it('solo un borrador se puede solicitar', () => {
    expect(puedeSolicitar(SolicitudPagoEstado.PENDIENTE)).toBe(true);
    expect(puedeSolicitar(SolicitudPagoEstado.SOLICITADO)).toBe(false);
    expect(puedeSolicitar(null)).toBe(false);
  });

  it('la cola de pagos son SOLICITADO y PARCIAL, no PENDIENTE', () => {
    // Es exactamente lo que mira PagoProveedorService.listarPendientes en el
    // central. Si PENDIENTE entrara acá, la pantalla diría que una solicitud
    // está esperando cobro cuando en realidad nadie la ve.
    expect(estaEnColaDePagos(SolicitudPagoEstado.SOLICITADO)).toBe(true);
    expect(estaEnColaDePagos(SolicitudPagoEstado.PARCIAL)).toBe(true);
    expect(estaEnColaDePagos(SolicitudPagoEstado.PENDIENTE)).toBe(false);
    expect(estaEnColaDePagos(SolicitudPagoEstado.CONCLUIDO)).toBe(false);
    expect(estaEnColaDePagos(SolicitudPagoEstado.CANCELADO)).toBe(false);
  });

  it('un borrador nunca está en la cola, y lo que está en la cola no es borrador', () => {
    for (const estado of Object.values(SolicitudPagoEstado)) {
      expect(puedeSolicitar(estado) && estaEnColaDePagos(estado)).toBe(false);
    }
  });
});

describe('El enum sigue al backend', () => {
  it('tiene los cinco estados del central, incluido SOLICITADO', () => {
    // El central sumó SOLICITADO en la migración V194.5. Sin este valor acá,
    // el estado que importa —el único pagable— se dibujaba en gris como
    // desconocido y no se podía filtrar.
    expect(Object.values(SolicitudPagoEstado)).toEqual([
      'PENDIENTE',
      'SOLICITADO',
      'PARCIAL',
      'CONCLUIDO',
      'CANCELADO',
    ]);
  });
});

describe('Resumen del pago', () => {
  it('sin pago devuelve null, que no es lo mismo que un pago pendiente', () => {
    expect(resumenDelPago({} as SolicitudPago)).toBeNull();
    expect(resumenDelPago(null)).toBeNull();
  });

  it('nombra el pago, su estado y quién lo autorizó', () => {
    const texto = resumenDelPago({
      pago: {
        id: 12,
        estado: PagoEstado.PARCIAL,
        autorizadoPor: { persona: { nombre: 'ANA' } },
      },
    } as SolicitudPago);
    expect(texto).toContain('#12');
    expect(texto).toContain('parcial');
    expect(texto).toContain('ANA');
  });

  it('marca los pagos programados', () => {
    const texto = resumenDelPago({
      pago: { id: 3, estado: PagoEstado.ABIERTO, programado: true },
    } as SolicitudPago);
    expect(texto).toContain('programado');
  });
});

describe('Fecha para el backend', () => {
  it('una fecha sola sale con hora, que es el formato de 16 que parsea el central', () => {
    expect(fechaParaBackend('2026-08-20')).toBe('2026-08-20 00:00');
  });

  it('si ya trae hora no se le agrega otra', () => {
    expect(fechaParaBackend('2026-08-20 14:30')).toBe('2026-08-20 14:30');
  });

  it('vacío es undefined: el campo es opcional y mandar cadena vacía lo rompe', () => {
    expect(fechaParaBackend('')).toBeUndefined();
    expect(fechaParaBackend(null)).toBeUndefined();
    expect(fechaParaBackend('   ')).toBeUndefined();
  });
});

describe('Estados en el registro visual', () => {
  it('los cuatro de la solicitud están registrados', () => {
    for (const estado of Object.values(SolicitudPagoEstado)) {
      expect(resolverEstado('SolicitudPagoEstado', estado).etiqueta).not.toBe('—');
    }
  });

  it('PagoEstado tiene ABIERTO y SolicitudPagoEstado no', () => {
    // Son enums parecidos y no intercambiables: cinco valores contra cuatro.
    expect(Object.values(PagoEstado)).toContain('ABIERTO');
    expect(Object.values(SolicitudPagoEstado)).not.toContain('ABIERTO');
    expect(resolverEstado('PagoEstado', 'ABIERTO').etiqueta).toBe('Abierto');
  });
});
