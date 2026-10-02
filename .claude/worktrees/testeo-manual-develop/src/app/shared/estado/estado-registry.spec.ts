import { describe, expect, it } from 'vitest';
import { estadosRegistrados, resolverEstado } from './estado-registry';

describe('estado-registry', () => {
  it('resuelve un estado registrado con su etiqueta y tono', () => {
    const e = resolverEstado('EstadoDevolucion', 'ACREDITADO');
    expect(e.etiqueta).toBe('Acreditado');
    expect(e.tono).toBe('ok');
  });

  it('mapea los finales de devolución a los tonos correctos', () => {
    expect(resolverEstado('EstadoDevolucion', 'DESCARTADO').tono).toBe('danger');
    expect(resolverEstado('EstadoDevolucion', 'PENDIENTE').tono).toBe('warn');
    expect(resolverEstado('EstadoDevolucion', 'RETIRADO').tono).toBe('info');
  });

  it('respeta los valores mal escritos del backend', () => {
    // `CONLCUIDA` está así en el central. Corregirlo del lado del cliente
    // rompería la coincidencia del string.
    expect(resolverEstado('TransferenciaEstado', 'CONLCUIDA').etiqueta).toBe('Concluida');
  });

  it('no rompe ante un estado desconocido: lo humaniza en tono neutro', () => {
    const e = resolverEstado('EstadoDevolucion', 'ESTADO_NUEVO_DEL_BACKEND');
    expect(e.tono).toBe('neutral');
    expect(e.etiqueta).toBe('Estado nuevo del backend');
  });

  it('tolera valor nulo', () => {
    expect(resolverEstado('EstadoDevolucion', null).etiqueta).toBe('—');
    expect(resolverEstado('EstadoDevolucion', undefined).tono).toBe('neutral');
  });

  it('tiene registrados los estados de las máquinas principales', () => {
    const claves = estadosRegistrados();
    for (const prefijo of [
      'EstadoDevolucion',
      'PdvCajaEstado',
      'TransferenciaEstado',
      'InventarioEstado',
      'SolicitudPagoEstado',
      'VentaTarjetaEstado',
    ]) {
      expect(claves.some((c) => c.startsWith(`${prefijo}.`))).toBe(true);
    }
  });

  it('todo estado registrado usa un tono del vocabulario cerrado', () => {
    const permitidos = ['ok', 'warn', 'danger', 'info', 'neutral'];
    for (const clave of estadosRegistrados()) {
      const [enumerado, valor] = clave.split('.');
      expect(permitidos).toContain(resolverEstado(enumerado, valor).tono);
    }
  });
});
