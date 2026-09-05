import { describe, expect, it } from 'vitest';

import {
  PedidoRecepcionProductoDto,
  PedidoRecepcionProductoEstado,
  RecepcionMercaderiaEstado,
} from '../domains/pedidos/recepcion.model';
import { Presentacion } from '../domains/productos/presentacion.model';
import {
  aPresentacion,
  aUnidadBase,
  escalaDe,
  itemsPendientes,
  pendienteDe,
  puedeDeshacer,
  restanteDeCarga,
  resumirVerificacion,
  tienePendiente,
  validarCarga,
  validarLinea,
} from '../pages/operaciones/recepcion/recepcion-cantidades';

const item = (extra: Partial<PedidoRecepcionProductoDto> = {}): PedidoRecepcionProductoDto => ({
  producto: { id: 1, descripcion: 'Producto' },
  totalCantidadARecibirPorUnidad: 48,
  totalCantidadRecibidaPorUnidad: 0,
  totalCantidadRechazadaPorUnidad: 0,
  ...extra,
});

const caja = { id: 7, descripcion: 'Caja', cantidad: 12 } as Presentacion;

describe('Escala de la presentación', () => {
  it('convierte en las dos direcciones', () => {
    expect(aUnidadBase(3, 12)).toBe(36);
    expect(aPresentacion(36, 12)).toBe(3);
  });

  it('en modo unidad base la escala es 1, ignorando la presentación', () => {
    // El backend manda `mostrarEnUnidadBase` para los productos que se
    // cuentan sueltos: ahí la presentación no significa nada.
    expect(escalaDe(caja, true)).toBe(1);
    expect(escalaDe(caja)).toBe(12);
  });

  it('una presentación sin cantidad cae en 1, no en 0', () => {
    // Con 0 la conversión daría Infinity en pantalla o borraría lo contado.
    expect(escalaDe({ cantidad: 0 } as Presentacion)).toBe(1);
    expect(escalaDe(null)).toBe(1);
  });
});

describe('Lo que falta recibir', () => {
  it('usa lo que calculó el backend cuando viene', () => {
    expect(pendienteDe(item({ cantidadPendientePorUnidad: 10 }))).toBe(10);
  });

  it('si no viene, lo deduce de las tres cantidades', () => {
    expect(
      pendienteDe(
        item({
          cantidadPendientePorUnidad: undefined,
          totalCantidadRecibidaPorUnidad: 30,
          totalCantidadRechazadaPorUnidad: 6,
        }),
      ),
    ).toBe(12);
  });

  it('un producto con todo recibido no queda pendiente', () => {
    expect(tienePendiente(item({ totalCantidadRecibidaPorUnidad: 48 }))).toBe(false);
  });

  it('lo rechazado también cierra el pendiente', () => {
    // Rechazar es una forma de resolver la línea: ya no falta nada por hacer.
    expect(
      tienePendiente(
        item({ totalCantidadRecibidaPorUnidad: 40, totalCantidadRechazadaPorUnidad: 8 }),
      ),
    ).toBe(false);
  });

  it('lista solo los que quedaron a medias', () => {
    const pendientes = itemsPendientes([
      item({ producto: { id: 1 }, totalCantidadRecibidaPorUnidad: 48 }),
      item({ producto: { id: 2 }, totalCantidadRecibidaPorUnidad: 20 }),
      item({ producto: { id: 3 } }),
    ]);
    expect(pendientes.map((p) => p.producto?.id)).toEqual([2, 3]);
  });
});

describe('Deshacer una verificación', () => {
  it('se puede si el producto figura como recibido', () => {
    expect(
      puedeDeshacer(
        item({ estado: PedidoRecepcionProductoEstado.RECIBIDO }),
        RecepcionMercaderiaEstado.FINALIZADA,
      ),
    ).toBe(true);
  });

  it('también con cantidades cargadas y la recepción en proceso', () => {
    // Se cargó de menos: el estado sigue PENDIENTE pero hay algo que borrar.
    expect(
      puedeDeshacer(
        item({
          estado: PedidoRecepcionProductoEstado.PENDIENTE,
          totalCantidadRecibidaPorUnidad: 12,
        }),
        RecepcionMercaderiaEstado.EN_PROCESO,
      ),
    ).toBe(true);
  });

  it('no se puede si nunca se cargó nada', () => {
    expect(
      puedeDeshacer(
        item({ estado: PedidoRecepcionProductoEstado.PENDIENTE }),
        RecepcionMercaderiaEstado.EN_PROCESO,
      ),
    ).toBe(false);
  });
});

describe('Validación de una línea', () => {
  it('rechaza cantidades vacías o negativas', () => {
    expect(validarLinea(0, 12, 48)).toMatch(/mayor a cero/);
    expect(validarLinea(-1, 12, 48)).toMatch(/mayor a cero/);
  });

  it('rechaza pasarse de lo que falta', () => {
    // 5 cajas de 12 son 60, y solo faltan 48.
    expect(validarLinea(5, 12, 48)).toMatch(/no puede superar/);
  });

  it('acepta justo lo que falta', () => {
    expect(validarLinea(4, 12, 48)).toBeNull();
  });
});

describe('Validación de la carga completa', () => {
  it('acepta recibir todo lo pendiente', () => {
    expect(validarCarga({ recibida: 48, rechazada: 0 }, 48)).toBeNull();
  });

  it('exige rechazo cuando se recibe de menos', () => {
    // Sin esto la falta desaparece del sistema y no hay reclamo al proveedor.
    const error = validarCarga({ recibida: 40, rechazada: 0 }, 48);
    expect(error).toMatch(/Agregá un rechazo/);
  });

  it('acepta recibir de menos si la diferencia se rechaza', () => {
    expect(validarCarga({ recibida: 40, rechazada: 8 }, 48)).toBeNull();
  });

  it('no deja pasarse de lo pendiente', () => {
    expect(validarCarga({ recibida: 40, rechazada: 12 }, 48)).toMatch(/no puede superar/);
  });

  it('no deja guardar una carga vacía', () => {
    expect(validarCarga({ recibida: 0, rechazada: 0 }, 48)).toMatch(/al menos una cantidad/);
  });
});

describe('Resumen del diálogo', () => {
  it('muestra todo en la presentación elegida', () => {
    const resumen = resumirVerificacion(
      item({ cantidadPendientePorUnidad: 48 }),
      12,
      { recibida: 24, rechazada: 0 },
    );
    expect(resumen.aRecibir).toBe(4);
    expect(resumen.recibido).toBe(2);
    expect(resumen.falta).toBe(2);
  });

  it('suma lo verificado antes a lo que se está cargando', () => {
    const resumen = resumirVerificacion(
      item({ totalCantidadRecibidaPorUnidad: 12, cantidadPendientePorUnidad: 36 }),
      12,
      { recibida: 12, rechazada: 0 },
    );
    expect(resumen.recibido).toBe(2);
  });

  it('el rechazado es solo el de esta carga', () => {
    // Lo rechazado antes ya está imputado: mostrarlo acá haría creer que se
    // está rechazando de nuevo.
    const resumen = resumirVerificacion(
      item({ totalCantidadRechazadaPorUnidad: 24, cantidadPendientePorUnidad: 24 }),
      12,
      { recibida: 12, rechazada: 12 },
    );
    expect(resumen.rechazado).toBe(1);
  });

  it('marca completo solo si se recibió todo y sin rechazos', () => {
    const completo = resumirVerificacion(item({ cantidadPendientePorUnidad: 48 }), 12, {
      recibida: 48,
      rechazada: 0,
    });
    expect(completo.completo).toBe(true);

    const conRechazo = resumirVerificacion(item({ cantidadPendientePorUnidad: 48 }), 12, {
      recibida: 40,
      rechazada: 8,
    });
    expect(conRechazo.completo).toBe(false);
  });

  it('lo que resta cargar descuenta recibido y rechazado', () => {
    expect(
      restanteDeCarga(item({ cantidadPendientePorUnidad: 48 }), { recibida: 24, rechazada: 12 }),
    ).toBe(12);
  });
});
