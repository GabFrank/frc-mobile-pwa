import { print } from 'graphql';
import { describe, expect, it } from 'vitest';

import {
  deleteTransferenciaItemMutation,
  saveTransferenciaMutation,
} from '../graphql/transferencias/graphql-query';

import type { Sucursal } from '../domains/empresarial/sucursal/sucursal.model';
import type { Presentacion } from '../domains/productos/presentacion.model';
import {
  EtapaAsignacionLote,
  EtapaTransferencia,
  TipoTransferencia,
  Transferencia,
  TransferenciaEstado,
  TransferenciaItem,
} from '../domains/transferencia/transferencia.model';
import {
  asignacionDeLote,
  destinosPosibles,
  esBorrador,
  excedeElStock,
  itemDePreTransferencia,
  loteDePreTransferencia,
  nuevaTransferenciaInput,
  puedeFinalizar,
  unidadesDelBorrador,
} from '../pages/transferencias/transferencia-alta';

describe('Input de una transferencia nueva', () => {
  it('nace abierta, manual y en la etapa de creación', () => {
    const input = nuevaTransferenciaInput({
      sucursalOrigenId: 3,
      sucursalDestinoId: 7,
      usuarioId: 41,
    });

    expect(input).toEqual({
      sucursalOrigenId: 3,
      sucursalDestinoId: 7,
      estado: TransferenciaEstado.ABIERTA,
      tipo: TipoTransferencia.MANUAL,
      etapa: EtapaTransferencia.PRE_TRANSFERENCIA_CREACION,
      usuarioPreTransferenciaId: 41,
    });
  });

  /**
   * ⚠️ El central solo toma el responsable de `usuarioPreTransferenciaId`:
   * `usuarioId` no lo mira para la cabecera. `frc-mobile` no lo manda, así que
   * sus borradores quedan sin responsable hasta que alguien los finaliza.
   */
  it('manda el responsable, que es lo que el central no deduce de usuarioId', () => {
    const input = nuevaTransferenciaInput({
      sucursalOrigenId: 3,
      sucursalDestinoId: 7,
      usuarioId: 41,
    });

    expect(input.usuarioPreTransferenciaId).toBe(41);
  });

  it('no manda id: con id el central lo tomaría como edición', () => {
    const input = nuevaTransferenciaInput({
      sucursalOrigenId: 3,
      sucursalDestinoId: 7,
      usuarioId: 41,
    });

    expect('id' in input).toBe(false);
  });
});

describe('Sucursales que se pueden elegir como destino', () => {
  const sucursales = (): Sucursal[] =>
    [
      { id: 1, nombre: 'SUC. ROTONDA' },
      { id: 2, nombre: 'SUC. PALOMA 1' },
      { id: 3, nombre: 'DEPOSITO AQUARIO SDG' },
    ] as Sucursal[];

  it('deja afuera a la de origen: una transferencia a sí misma no mueve nada', () => {
    expect(destinosPosibles(sucursales(), 2).map((s) => s.id)).toEqual([1, 3]);
  });

  it('sin origen elegido todavía no ofrece ninguna', () => {
    expect(destinosPosibles(sucursales(), null)).toEqual([]);
  });

  it('compara por valor: el id del selector llega como texto', () => {
    expect(destinosPosibles(sucursales(), '2' as unknown as number).map((s) => s.id)).toEqual([
      1, 3,
    ]);
  });
});

/**
 * ⚠️ **El ítem del borrador escribe solo el grupo `PreTransferencia`.**
 * `saveTransferenciaItem` es un PATCH y las otras tres etapas son la razón de
 * ser del módulo: mandar sus campos en el alta —aunque sea en cero— borraría
 * la distinción entre «pedido» y «todavía no llegó ahí».
 */
describe('Ítem que se agrega al borrador', () => {
  it('escribe cantidad y presentación de pre-transferencia, y nada de las otras etapas', () => {
    const input = itemDePreTransferencia({
      transferenciaId: 54_060,
      presentacionId: 88,
      cantidad: 12,
    });

    expect(input).toEqual({
      transferenciaId: 54_060,
      presentacionPreTransferenciaId: 88,
      cantidadPreTransferencia: 12,
      activo: true,
      poseeVencimiento: false,
    });
  });

  it('con vencimiento lo manda como texto y prende poseeVencimiento', () => {
    const input = itemDePreTransferencia({
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
      vencimiento: '2026-12-31',
    });

    expect(input.vencimientoPreTransferencia).toBe('2026-12-31');
    expect(input.poseeVencimiento).toBe(true);
  });

  it('sin vencimiento no manda el campo: un nulo no borra nada en un PATCH', () => {
    const input = itemDePreTransferencia({
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
      vencimiento: '',
    });

    expect('vencimientoPreTransferencia' in input).toBe(false);
  });

  it('la observación viaja solo si tiene texto', () => {
    const conTexto = itemDePreTransferencia({
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
      observacion: '  falta la caja  ',
    });
    const enBlanco = itemDePreTransferencia({
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
      observacion: '   ',
    });

    expect(conTexto.observacionPreTransferencia).toBe('falta la caja');
    expect('observacionPreTransferencia' in enBlanco).toBe(false);
  });

  it('al editar viaja el id del ítem, que es lo que lo convierte en edición', () => {
    const input = itemDePreTransferencia({
      id: 900,
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
    });

    expect(input.id).toBe(900);
  });
});

/**
 * ⚠️ Los tres valores de `lotesAsignados` son la parte del módulo donde una
 * confusión no se ve: mandar `[]` de más borra una asignación que alguien
 * eligió, y mandar `null` creyendo que borra deja el lote viejo puesto
 * mientras la pantalla muestra otro.
 */
describe('De qué lote sale el ítem', () => {
  it('con un lote elegido manda la lista y la etapa de creación', () => {
    const input = itemDePreTransferencia({
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
      lote: { loteId: 707 },
    });

    expect(input.lotesAsignados).toEqual([{ loteId: 707, cantidad: 3 }]);
    expect(input.etapaAsignacionLote).toBe(EtapaAsignacionLote.PRE_TRANSFERENCIA);
  });

  /**
   * ⚠️ El central multiplica por la presentación de la etapa: mandar la
   * cantidad ya en unidades saca del lote tantas veces de más como unidades
   * tenga la presentación, y no falla, así que nadie se entera.
   */
  it('la cantidad viaja en presentaciones, la misma que cantidadPreTransferencia', () => {
    const input = itemDePreTransferencia({
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 4,
      lote: { loteId: 707 },
    });

    expect(input.lotesAsignados?.[0].cantidad).toBe(input.cantidadPreTransferencia);
  });

  it('sin lote y sin lote anterior no manda el campo: no hay nada que tocar', () => {
    const input = itemDePreTransferencia({
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
    });

    expect('lotesAsignados' in input).toBe(false);
    expect('etapaAsignacionLote' in input).toBe(false);
  });

  /** La lista vacía es lo ÚNICO que borra: un `null` sería «no lo toques». */
  it('al sacarle el lote a un ítem que lo tenía manda la lista vacía', () => {
    const input = itemDePreTransferencia({
      id: 900,
      transferenciaId: 1,
      presentacionId: 2,
      cantidad: 3,
      lote: null,
      loteAnterior: 707,
    });

    expect(input.lotesAsignados).toEqual([]);
    expect(input.etapaAsignacionLote).toBe(EtapaAsignacionLote.PRE_TRANSFERENCIA);
  });

  it('cambiar de lote reemplaza, no acumula', () => {
    const { lotesAsignados } = asignacionDeLote({ loteId: 808 }, 5, 707);

    expect(lotesAsignados).toEqual([{ loteId: 808, cantidad: 5 }]);
  });
});

describe('El lote que un ítem ya tiene', () => {
  const conAsignacion = (etapa: EtapaAsignacionLote): TransferenciaItem => ({
    id: 1,
    lotesAsignados: [{ loteId: 707, numeroLote: 'L-2026-88', etapa }],
  });

  it('devuelve el de la etapa de creación', () => {
    expect(loteDePreTransferencia(conAsignacion(EtapaAsignacionLote.PRE_TRANSFERENCIA))?.loteId).toBe(
      707,
    );
  });

  /**
   * ⚠️ La asignación de preparación la decide quien prepara, desde el
   * escritorio. Mostrarla en el borrador invitaría a pisarla.
   */
  it('ignora la de preparación, que no es la que edita esta pantalla', () => {
    expect(loteDePreTransferencia(conAsignacion(EtapaAsignacionLote.PREPARACION))).toBeNull();
  });

  it('sin asignación devuelve null, que es FEFO', () => {
    expect(loteDePreTransferencia({ id: 1 })).toBeNull();
    expect(loteDePreTransferencia(null)).toBeNull();
  });
});

describe('Unidades cargadas en el borrador', () => {
  const item = (cantidad: number, porBulto: number): TransferenciaItem =>
    ({
      id: cantidad * 1000 + porBulto,
      cantidadPreTransferencia: cantidad,
      presentacionPreTransferencia: { id: 1, cantidad: porBulto } as Presentacion,
    }) as TransferenciaItem;

  /**
   * ⚠️ **Se multiplica por la presentación.** Sumar «2 cajas + 3 unidades» y
   * decir 5 sería un número que no existe en ningún depósito.
   */
  it('convierte cada renglón a unidades antes de sumar', () => {
    expect(unidadesDelBorrador([item(2, 12), item(3, 1)])).toBe(27);
  });

  it('un renglón sin presentación cuenta como unidades sueltas', () => {
    expect(unidadesDelBorrador([{ cantidadPreTransferencia: 4 } as TransferenciaItem])).toBe(4);
  });

  it('sin ítems da cero', () => {
    expect(unidadesDelBorrador([])).toBe(0);
  });
});

describe('Finalizar el borrador', () => {
  const borrador = (): Transferencia => ({
    id: 1,
    estado: TransferenciaEstado.ABIERTA,
    etapa: EtapaTransferencia.PRE_TRANSFERENCIA_CREACION,
  });
  const unItem = [{ id: 10 } as TransferenciaItem];

  it('se puede finalizar un borrador con ítems', () => {
    expect(puedeFinalizar(borrador(), unItem)).toBe(true);
  });

  /**
   * ⚠️ El central no lo valida: una transferencia vacía se finaliza igual y
   * llega hasta preparación sin nada que preparar.
   */
  it('no se finaliza sin ítems, aunque el central lo aceptaría', () => {
    expect(puedeFinalizar(borrador(), [])).toBe(false);
  });

  it('no se finaliza lo que ya salió de creación', () => {
    const enOrigen = {
      ...borrador(),
      estado: TransferenciaEstado.EN_ORIGEN,
      etapa: EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN,
    };

    expect(puedeFinalizar(enOrigen, unItem)).toBe(false);
  });

  it('sin transferencia cargada no se finaliza nada', () => {
    expect(puedeFinalizar(null, unItem)).toBe(false);
  });
});

describe('Qué es un borrador', () => {
  it('lo es mientras está en la etapa de creación', () => {
    expect(esBorrador({ etapa: EtapaTransferencia.PRE_TRANSFERENCIA_CREACION })).toBe(true);
  });

  it('deja de serlo apenas queda pendiente en origen', () => {
    expect(esBorrador({ etapa: EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN })).toBe(false);
  });

  it('sin transferencia no hay borrador', () => {
    expect(esBorrador(null)).toBe(false);
  });
});

/**
 * ⚠️ **Avisa, no bloquea.** Pedir más de lo que hay es un caso real —se
 * repone lo que va llegando—, y el stock recién se descuenta al despachar.
 */
describe('Aviso de stock en origen', () => {
  const caja = { id: 1, cantidad: 12 } as Presentacion;

  it('avisa cuando lo pedido supera lo que hay, ya convertido a unidades', () => {
    expect(excedeElStock(3, caja, 24)).toBe(true);
  });

  it('no avisa cuando alcanza', () => {
    expect(excedeElStock(2, caja, 24)).toBe(false);
  });

  it('sin stock conocido no inventa un aviso', () => {
    expect(excedeElStock(3, caja, null)).toBe(false);
  });
});

/**
 * ⚠️ **El alias `data:` es la convención del repo**, y sin él el resultado
 * llega `undefined` sin error ni log: `DatosService` lee siempre `data`.
 */
describe('Operaciones GraphQL del alta', () => {
  it('el alta de la cabecera aliasea la raíz a data', () => {
    expect(print(saveTransferenciaMutation)).toContain('data: saveTransferencia(');
  });

  it('manda el input por el argumento `transferencia`, que es como lo declara el central', () => {
    expect(print(saveTransferenciaMutation)).toContain('transferencia: $entity');
  });

  /**
   * La pantalla decide con la etapa si sigue en el borrador o pasa al
   * detalle: sin traerla de vuelta habría que adivinar qué guardó el central.
   */
  it('devuelve estado y etapa de la transferencia creada', () => {
    const documento = print(saveTransferenciaMutation);

    expect(documento).toContain('estado');
    expect(documento).toContain('etapa');
  });

  it('el borrado de un ítem también aliasea a data', () => {
    expect(print(deleteTransferenciaItemMutation)).toContain('data: deleteTransferenciaItem(');
  });
});
