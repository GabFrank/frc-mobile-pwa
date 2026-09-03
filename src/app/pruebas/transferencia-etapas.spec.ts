import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import {
  EtapaTransferencia,
  MotivoModificacion,
  MotivoRechazo,
  Transferencia,
  TransferenciaItem,
} from '../domains/transferencia/transferencia.model';
import { TransferenciaDetallePage } from '../pages/transferencias/transferencia-detalle.page';
import { TransferenciaService } from '../pages/transferencias/transferencia.service';
import {
  accionDeEtapa,
  inputDeVerificacion,
  itemVerificado,
  itemsSinVerificar,
  puedeEditarEtapa,
  requiereDesconfirmarAntes,
  responsableDeEtapa,
} from '../pages/transferencias/etapas';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * El detalle inyecta `ProductoBusquedaService` para verificar un producto por
 * su código, y ése inyecta operaciones GraphQL. Nada de eso es el tema de
 * estos tests, pero sin Apollo el montaje falla con un `NG0201`.
 */
const usuario = (id: number) => ({ id, persona: { id, nombre: 'U' + id } });

describe('Etapas de un ítem de transferencia', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; items: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of({ id: 1, isOrigen: true, isDestino: false })),
      items: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [{ provide: TransferenciaService, useValue: servicio }],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(TransferenciaDetallePage);
    f.componentRef.setInput('id', '1');
    f.detectChanges();
    return f;
  };

  it('conserva las cuatro cifras, no solo la última', () => {
    // 10 pedidos → 8 preparados → 8 despachados → 7 recibidos.
    // La diferencia 10→8 es falta de stock en origen; la 8→7, un faltante en
    // tránsito. Con una sola cifra los dos casos son indistinguibles.
    const item: TransferenciaItem = {
      id: 1,
      cantidadPreTransferencia: 10,
      cantidadPreparacion: 8,
      cantidadTransporte: 8,
      cantidadRecepcion: 7,
    };
    const f = montar();

    const pasos = f.componentInstance.pasosDe(item);
    expect(pasos.map((p) => p.cantidad)).toEqual([10, 8, 8, 7]);
    expect(pasos.map((p) => p.etiqueta)).toEqual([
      'Pedido',
      'Preparado',
      'Despachado',
      'Recibido',
    ]);
  });

  it('una etapa que todavía no pasó no se muestra en cero', () => {
    // «Sin cantidad» significa «no llegó ahí», no «cero unidades».
    const item: TransferenciaItem = { id: 1, cantidadPreTransferencia: 10, cantidadPreparacion: 8 };
    const f = montar();

    expect(f.componentInstance.pasosDe(item).map((p) => p.etiqueta)).toEqual([
      'Pedido',
      'Preparado',
    ]);
  });

  it('lleva la presentación de cada etapa', () => {
    // Se pide en cajas y se despacha en unidades: comparar cantidades sin
    // mirar la presentación da diferencias falsas.
    const item: TransferenciaItem = {
      id: 1,
      cantidadPreTransferencia: 2,
      presentacionPreTransferencia: { id: 1, cantidad: 12 } as never,
      cantidadTransporte: 24,
      presentacionTransporte: { id: 2, cantidad: 1 } as never,
    };
    const f = montar();

    const pasos = f.componentInstance.pasosDe(item);
    expect(pasos[0].porBulto).toBe(12);
    expect(pasos[1].porBulto).toBe(1);
  });

  it('muestra el motivo de rechazo de la etapa que lo registró', () => {
    const item: TransferenciaItem = {
      id: 1,
      cantidadPreTransferencia: 10,
      cantidadPreparacion: 0,
      motivoRechazoPreparacion: 'FALTA_PRODUCTO' as never,
    };
    const f = montar();

    const pasos = f.componentInstance.pasosDe(item);
    expect(pasos[1].rechazo).toBe('FALTA_PRODUCTO');
  });

  it('un ítem sin ninguna etapa no inventa filas', () => {
    const f = montar();
    expect(f.componentInstance.pasosDe({ id: 1 })).toEqual([]);
  });
});

describe('De qué lado está el usuario', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; items: ReturnType<typeof vi.fn> };

  const montarCon = (isOrigen: boolean, isDestino: boolean) => {
    servicio = {
      porId: vi.fn(() => of({ id: 1, isOrigen, isDestino })),
      items: vi.fn(() => of([])),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [{ provide: TransferenciaService, useValue: servicio }],
    });
    const f = TestBed.createComponent(TransferenciaDetallePage);
    f.componentRef.setInput('id', '1');
    f.detectChanges();
    return f;
  };

  it('en origen se prepara y despacha', () => {
    // Los flags los resuelve el backend: no se infiere comparando ids.
    expect(montarCon(true, false).componentInstance.rol()).toContain('Origen');
  });

  it('en destino se recibe y verifica', () => {
    expect(montarCon(false, true).componentInstance.rol()).toContain('Destino');
  });

  it('la misma sucursal en los dos extremos es un caso válido', () => {
    expect(montarCon(true, true).componentInstance.rol()).toBe('Origen y destino');
  });

  it('sin ninguno de los dos, es consulta', () => {
    expect(montarCon(false, false).componentInstance.rol()).toBe('Solo consulta');
  });
});

/**
 * El avance de etapa dispara movimientos de stock en el central: una
 * condición mal copiada despacha mercadería que nadie preparó, o carga en
 * destino algo que nunca llegó. Por eso las reglas viven en funciones puras
 * y se prueban una por una.
 */
describe('Qué avance corresponde a cada etapa', () => {
  const enEtapa = (etapa: EtapaTransferencia, extra: Partial<Transferencia> = {}) =>
    accionDeEtapa({ id: 1, etapa, ...extra });

  it('recorre el flujo completo hasta recepción concluida', () => {
    expect(enEtapa(EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN)?.destino).toBe(
      EtapaTransferencia.PREPARACION_MERCADERIA,
    );
    expect(enEtapa(EtapaTransferencia.PREPARACION_MERCADERIA)?.destino).toBe(
      EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA,
    );
    expect(enEtapa(EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA)?.destino).toBe(
      EtapaTransferencia.TRANSPORTE_VERIFICACION,
    );
    expect(enEtapa(EtapaTransferencia.TRANSPORTE_VERIFICACION)?.destino).toBe(
      EtapaTransferencia.TRANSPORTE_EN_CAMINO,
    );
    expect(enEtapa(EtapaTransferencia.TRANSPORTE_EN_CAMINO)?.destino).toBe(
      EtapaTransferencia.RECEPCION_EN_VERIFICACION,
    );
    expect(enEtapa(EtapaTransferencia.RECEPCION_EN_VERIFICACION)?.destino).toBe(
      EtapaTransferencia.RECEPCION_CONCLUIDA,
    );
  });

  it('desde TRANSPORTE_EN_DESTINO también se inicia la recepción', () => {
    // El flujo real saltea esa etapa, pero cuando queda registrada la
    // transferencia tiene que poder seguir. Contemplar solo EN_CAMINO la
    // dejaría clavada.
    expect(enEtapa(EtapaTransferencia.TRANSPORTE_EN_DESTINO)?.destino).toBe(
      EtapaTransferencia.RECEPCION_EN_VERIFICACION,
    );
  });

  it('recepción concluida es el final: no ofrece nada más', () => {
    expect(enEtapa(EtapaTransferencia.RECEPCION_CONCLUIDA)).toBeNull();
  });

  it('no se ofrece preparar lo que otro ya tomó', () => {
    // `usuarioPreparacion` es la marca de que otro depósito la está
    // preparando. Mostrar el botón invitaría a que dos se pisen.
    expect(
      enEtapa(EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN, {
        usuarioPreparacion: usuario(9) as never,
      }),
    ).toBeNull();
  });

  it('solo las etapas que cierran una verificación exigen los ítems revisados', () => {
    expect(enEtapa(EtapaTransferencia.PREPARACION_MERCADERIA)?.exigeItemsVerificados).toBe(true);
    expect(enEtapa(EtapaTransferencia.TRANSPORTE_VERIFICACION)?.exigeItemsVerificados).toBe(true);
    expect(enEtapa(EtapaTransferencia.RECEPCION_EN_VERIFICACION)?.exigeItemsVerificados).toBe(
      true,
    );
    expect(enEtapa(EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN)?.exigeItemsVerificados).toBe(
      false,
    );
  });

  it('iniciar la recepción es el único paso que pide el QR de la sucursal', () => {
    expect(enEtapa(EtapaTransferencia.TRANSPORTE_EN_CAMINO)?.exigeQrDeDestino).toBe(true);
    expect(enEtapa(EtapaTransferencia.PREPARACION_MERCADERIA)?.exigeQrDeDestino).toBe(false);
  });

  it('sin etapa no hay avance que ofrecer', () => {
    expect(accionDeEtapa(null)).toBeNull();
    expect(accionDeEtapa({ id: 1 })).toBeNull();
  });
});

describe('Quién puede trabajar la etapa', () => {
  it('el responsable de la etapa, y nadie más', () => {
    const t: Transferencia = {
      id: 1,
      etapa: EtapaTransferencia.PREPARACION_MERCADERIA,
      usuarioPreparacion: usuario(7) as never,
    };
    expect(puedeEditarEtapa(t, 7)).toBe(true);
    expect(puedeEditarEtapa(t, 8)).toBe(false);
  });

  it('mientras nadie la tomó, está abierta', () => {
    const t: Transferencia = { id: 1, etapa: EtapaTransferencia.PREPARACION_MERCADERIA };
    expect(puedeEditarEtapa(t, 8)).toBe(true);
  });

  it('cada etapa mira a su propio responsable', () => {
    // En `frc-mobile` el permiso se prende y no se apaga nunca: haber sido
    // responsable de una etapa alcanzaba para editar las siguientes.
    const t: Transferencia = {
      id: 1,
      etapa: EtapaTransferencia.RECEPCION_EN_VERIFICACION,
      usuarioPreparacion: usuario(7) as never,
      usuarioRecepcion: usuario(9) as never,
    };
    expect(responsableDeEtapa(t)?.id).toBe(9);
    expect(puedeEditarEtapa(t, 7)).toBe(false);
    expect(puedeEditarEtapa(t, 9)).toBe(true);
  });
});

describe('Cuándo un ítem está revisado', () => {
  const etapa = EtapaTransferencia.PREPARACION_MERCADERIA;

  it('con la cantidad cargada', () => {
    expect(itemVerificado({ id: 1, cantidadPreparacion: 8 }, etapa)).toBe(true);
  });

  it('rechazarlo también es haberlo mirado', () => {
    // Rechazar no es «no lo revisé»: es «lo revisé y no va».
    expect(
      itemVerificado({ id: 1, motivoRechazoPreparacion: MotivoRechazo.FALTA_PRODUCTO }, etapa),
    ).toBe(true);
  });

  it('cero unidades cuenta como revisado', () => {
    // «Cero» es una respuesta; `null` es la ausencia de respuesta.
    expect(itemVerificado({ id: 1, cantidadPreparacion: 0 }, etapa)).toBe(true);
  });

  it('sin ninguna marca, falta revisarlo', () => {
    expect(itemVerificado({ id: 1, cantidadPreTransferencia: 10 }, etapa)).toBe(false);
  });

  it('los pendientes se cuentan contra la etapa en curso, no contra otra', () => {
    const items: TransferenciaItem[] = [
      { id: 1, cantidadPreparacion: 8 },
      { id: 2, cantidadPreTransferencia: 10 },
    ];
    expect(itemsSinVerificar(items, etapa).map((i) => i.id)).toEqual([2]);
    // En transporte todavía no se revisó ninguno de los dos.
    expect(
      itemsSinVerificar(items, EtapaTransferencia.TRANSPORTE_VERIFICACION).map((i) => i.id),
    ).toEqual([1, 2]);
  });

  it('en una etapa que no verifica ítems no hay pendientes', () => {
    expect(itemsSinVerificar([{ id: 1 }], EtapaTransferencia.TRANSPORTE_EN_CAMINO)).toEqual([]);
  });
});

describe('Lo que se manda al guardar un ítem', () => {
  const item: TransferenciaItem = {
    id: 5,
    cantidadPreTransferencia: 10,
    presentacionPreTransferencia: { id: 3, cantidad: 12 } as never,
    vencimientoPreTransferencia: '2026-12-31',
  };

  it('confirmar copia lo declarado por la etapa anterior', () => {
    const input = inputDeVerificacion(
      item,
      1,
      EtapaTransferencia.PREPARACION_MERCADERIA,
      {},
    ) as Record<string, unknown>;
    expect(input['cantidadPreparacion']).toBe(10);
    expect(input['presentacionPreparacionId']).toBe(3);
    expect(input['vencimientoPreparacion']).toBe('2026-12-31');
  });

  it('solo escribe los campos de la etapa en curso', () => {
    // El save del central es un PATCH: mandar de más pisa etapas anteriores,
    // que es justo lo que el módulo existe para conservar.
    const input = inputDeVerificacion(
      item,
      1,
      EtapaTransferencia.PREPARACION_MERCADERIA,
      { cantidad: 8 },
    ) as Record<string, unknown>;
    expect(input['cantidadPreTransferencia']).toBeUndefined();
    expect(input['cantidadTransporte']).toBeUndefined();
    expect(input['cantidadRecepcion']).toBeUndefined();
  });

  it('un rechazo viaja igual con su cantidad y su presentación', () => {
    // El central multiplica cantidad × presentación para armar el movimiento
    // de stock incluso cuando lo va a dejar inactivo por el rechazo: sin
    // ellas responde un error de servidor, no una validación.
    const input = inputDeVerificacion(item, 1, EtapaTransferencia.PREPARACION_MERCADERIA, {
      motivoRechazo: MotivoRechazo.PRODUCTO_AVERIADO,
    }) as Record<string, unknown>;
    expect(input['motivoRechazoPreparacion']).toBe(MotivoRechazo.PRODUCTO_AVERIADO);
    expect(input['cantidadPreparacion']).toBe(10);
    expect(input['presentacionPreparacionId']).toBe(3);
  });

  it('el vencimiento viaja como fecha sola, sin la hora que trae el central', () => {
    // `Date` de GraphQL llega como ISO con hora; el input del central espera
    // texto. Recortar con `toISOString()` correría el día en Paraguay.
    const conHora: TransferenciaItem = {
      ...item,
      vencimientoPreTransferencia: '2026-12-31T00:00:00.000-03:00',
    };
    const input = inputDeVerificacion(
      conHora,
      1,
      EtapaTransferencia.PREPARACION_MERCADERIA,
      {},
    ) as Record<string, unknown>;
    expect(input['vencimientoPreparacion']).toBe('2026-12-31');
  });

  it('la etapa de recepción hereda de transporte, no de lo pedido', () => {
    const enTransito: TransferenciaItem = {
      ...item,
      cantidadTransporte: 8,
      presentacionTransporte: { id: 4, cantidad: 1 } as never,
    };
    const input = inputDeVerificacion(
      enTransito,
      1,
      EtapaTransferencia.RECEPCION_EN_VERIFICACION,
      {},
    ) as Record<string, unknown>;
    expect(input['cantidadRecepcion']).toBe(8);
    expect(input['presentacionRecepcionId']).toBe(4);
  });
});

describe('Cuándo hay que desconfirmar antes de guardar', () => {
  const etapa = EtapaTransferencia.PREPARACION_MERCADERIA;

  it('confirmar un ítem antes rechazado exige vaciar la etapa primero', () => {
    // El save es un PATCH: mandar el motivo en `null` no lo borra. Sin este
    // paso el ítem seguiría rechazado y la pantalla lo mostraría en verde.
    const item: TransferenciaItem = {
      id: 1,
      motivoRechazoPreparacion: MotivoRechazo.FALTA_PRODUCTO,
    };
    expect(requiereDesconfirmarAntes(item, etapa, {})).toBe(true);
  });

  it('cambiar un motivo por otro no necesita vaciar nada', () => {
    const item: TransferenciaItem = {
      id: 1,
      motivoRechazoPreparacion: MotivoRechazo.FALTA_PRODUCTO,
    };
    expect(
      requiereDesconfirmarAntes(item, etapa, { motivoRechazo: MotivoRechazo.PRODUCTO_VENCIDO }),
    ).toBe(false);
    expect(
      requiereDesconfirmarAntes(item, etapa, {
        motivoModificacion: MotivoModificacion.CANTIDAD_INCORRECTA,
      }),
    ).toBe(false);
  });

  it('un ítem sin motivos se guarda directo', () => {
    expect(requiereDesconfirmarAntes({ id: 1, cantidadPreparacion: 8 }, etapa, {})).toBe(false);
  });
});

describe('El botón de avance, en la pantalla', () => {
  const montar = (
    transferencia: Partial<Transferencia>,
    items: TransferenciaItem[],
    usuarioId: number | null,
  ) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [
        {
          provide: TransferenciaService,
          useValue: {
            porId: vi.fn(() => of({ id: 1, ...transferencia })),
            items: vi.fn(() => of(items)),
          },
        },
        {
          provide: AuthService,
          useValue: { usuario: () => (usuarioId == null ? null : usuario(usuarioId)) },
        },
      ],
    });
    const f = TestBed.createComponent(TransferenciaDetallePage);
    f.componentRef.setInput('id', '1');
    f.detectChanges();
    return f.componentInstance;
  };

  it('no deja concluir con ítems sin revisar, y dice cuántos faltan', () => {
    const pagina = montar(
      { etapa: EtapaTransferencia.PREPARACION_MERCADERIA, usuarioPreparacion: usuario(7) as never },
      [{ id: 1, cantidadPreparacion: 8 }, { id: 2 }],
      7,
    );
    expect(pagina.accionHabilitada()).toBe(false);
    expect(pagina.motivoDeBloqueo()).toContain('1 producto');
  });

  it('con todos revisados, el responsable puede concluir', () => {
    const pagina = montar(
      { etapa: EtapaTransferencia.PREPARACION_MERCADERIA, usuarioPreparacion: usuario(7) as never },
      [{ id: 1, cantidadPreparacion: 8 }],
      7,
    );
    expect(pagina.accionHabilitada()).toBe(true);
    expect(pagina.motivoDeBloqueo()).toBeNull();
  });

  it('otro usuario no concluye la etapa ajena, y se le dice de quién es', () => {
    const pagina = montar(
      { etapa: EtapaTransferencia.PREPARACION_MERCADERIA, usuarioPreparacion: usuario(7) as never },
      [{ id: 1, cantidadPreparacion: 8 }],
      8,
    );
    expect(pagina.accionHabilitada()).toBe(false);
    expect(pagina.motivoDeBloqueo()).toContain('U7');
    expect(pagina.editable()).toBe(false);
  });

  it('tomar la etapa siguiente no exige ser responsable de ninguna', () => {
    // «Preparar productos», «Verificar para transporte» e «Iniciar recepción»
    // son justamente el acto de hacerse cargo: ahí todavía no hay responsable
    // a quien pedirle permiso.
    const pagina = montar(
      { etapa: EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA },
      [{ id: 1 }],
      8,
    );
    expect(pagina.accionHabilitada()).toBe(true);
  });

  it('en una etapa sin verificación no se muestran acciones por ítem', () => {
    const pagina = montar({ etapa: EtapaTransferencia.TRANSPORTE_EN_CAMINO }, [{ id: 1 }], 8);
    expect(pagina.verificando()).toBe(false);
    expect(pagina.editable()).toBe(false);
  });

  it('marca cada ítem según lo que registró la etapa en curso', () => {
    const pagina = montar(
      { etapa: EtapaTransferencia.PREPARACION_MERCADERIA },
      [{ id: 1 }],
      8,
    );
    expect(pagina.marcaDe({ id: 1 })).toBe('pendiente');
    expect(pagina.marcaDe({ id: 1, cantidadPreparacion: 8 })).toBe('verificado');
    expect(
      pagina.marcaDe({
        id: 1,
        cantidadPreparacion: 8,
        motivoModificacionPreparacion: MotivoModificacion.CANTIDAD_INCORRECTA,
      }),
    ).toBe('modificado');
    expect(
      pagina.marcaDe({
        id: 1,
        cantidadPreparacion: 8,
        motivoRechazoPreparacion: MotivoRechazo.PRODUCTO_VENCIDO,
      }),
    ).toBe('rechazado');
  });
});
