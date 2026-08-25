import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { SectorService } from '../domains/sector/sector.service';
import type { Zona } from '../domains/zona/zona.model';
import { InventarioEstado } from '../domains/inventario/inventario.model';
import type { InventarioProducto } from '../domains/inventario/inventario.model';
import { InventarioDetallePage } from '../pages/inventario/inventario-detalle.page';
import { InventarioService } from '../pages/inventario/inventario.service';

/**
 * Las zonas de una toma abierta: agregarlas, concluirlas y reabrirlas.
 */
describe('Zonas de la toma', () => {
  let servicio: {
    porId: ReturnType<typeof vi.fn>;
    guardarZona: ReturnType<typeof vi.fn>;
    finalizar: ReturnType<typeof vi.fn>;
  };
  let sectores: { deSucursal: ReturnType<typeof vi.fn> };
  let dialogo: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };
  let notificacion: { warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn>; ok: ReturnType<typeof vi.fn> };

  const inventario = (estado: InventarioEstado, zonas: unknown[]) => ({
    id: 5,
    estado,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: zonas,
  });

  const ZONA_ABIERTA: InventarioProducto = {
    id: 91,
    concluido: false,
    zona: { id: 11, descripcion: 'estante alto', sector: { id: 1, descripcion: 'gondola' } } as Zona,
    inventarioProductoItemList: [],
  };
  const ZONA_CONCLUIDA: InventarioProducto = {
    id: 92,
    concluido: true,
    zona: { id: 12, descripcion: 'estante bajo', sector: { id: 1, descripcion: 'gondola' } } as Zona,
    inventarioProductoItemList: [],
  };

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [ZONA_ABIERTA]))),
      guardarZona: vi.fn(() => of({ id: 91 })),
      finalizar: vi.fn(() => of({ id: 5 })),
    };
    sectores = { deSucursal: vi.fn(() => of([])) };
    dialogo = { confirmar: vi.fn(async () => true), abrir: vi.fn(async () => undefined) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InventarioService, useValue: servicio },
        { provide: SectorService, useValue: sectores },
        { provide: DialogoService, useValue: dialogo },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(InventarioDetallePage);
    f.componentRef.setInput('id', '5');
    f.detectChanges();
    return f;
  };

  /**
   * Regresión: los tres botones vivían en un solo `@if` con varios nodos
   * raíz. Angular no los proyecta al slot en ese caso y quedan sueltos en el
   * cuerpo de la card — lo avisa con **NG8011, que es un warning**, así que
   * el build pasa igual y solo se ve mirando la pantalla.
   *
   * Por eso se mira **dónde** está el botón, no si su texto aparece: con la
   * proyección rota el texto está igual, en el lugar equivocado.
   */
  it('los botones de zona van al pie de la card, no sueltos en el cuerpo', () => {
    const f = montar();
    const pie = f.nativeElement.querySelector('frc-card .pie') as HTMLElement | null;

    expect(pie).not.toBeNull();
    const textos = [...pie!.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(textos).toContain('Contar');
    expect(textos).toContain('Concluir');
  });

  it('una zona concluida ofrece reabrir en vez de concluir', () => {
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.ABIERTO, [ZONA_CONCLUIDA])));
    const f = montar();
    const pie = f.nativeElement.querySelector('frc-card .pie') as HTMLElement;
    const textos = [...pie.querySelectorAll('button')].map((b) => b.textContent?.trim());

    expect(textos).toContain('Reabrir');
    expect(textos).not.toContain('Concluir');
  });

  it('con la toma cerrada no hay ningún botón de escritura', () => {
    // Un conteo cerrado es un hecho histórico: escribir encima cambiaría el
    // resultado de una toma que ya ajustó el stock.
    servicio.porId = vi.fn(() => of(inventario(InventarioEstado.CONCLUIDO, [ZONA_ABIERTA])));
    const f = montar();
    const texto = f.nativeElement.textContent ?? '';

    expect(texto).not.toContain('Agregar zona');
    expect(texto).not.toContain('Contar');
    expect(texto).not.toContain('Concluir');
  });

  it('reabrir con otra zona sin concluir queda bloqueado', async () => {
    servicio.porId = vi.fn(() =>
      of(inventario(InventarioEstado.ABIERTO, [ZONA_ABIERTA, ZONA_CONCLUIDA])),
    );
    const f = montar();
    await f.componentInstance.marcarZona(ZONA_CONCLUIDA, false);

    // Dos zonas en curso mezclan los conteos: es la regla de `verificarAbiertos`.
    expect(notificacion.warn).toHaveBeenCalled();
    expect(servicio.guardarZona).not.toHaveBeenCalled();
  });

  it('concluir manda el id del renglón, para actualizar y no duplicar', async () => {
    const f = montar();
    await f.componentInstance.marcarZona(ZONA_ABIERTA, true);

    expect(servicio.guardarZona).toHaveBeenCalledWith({
      id: 91,
      inventarioId: 5,
      zonaId: 11,
      concluido: true,
    });
  });

  it('agregar una zona la da de alta sin id', async () => {
    sectores.deSucursal = vi.fn(() =>
      of([
        {
          id: 1,
          descripcion: 'gondola',
          zonaList: [
            { id: 11, descripcion: 'estante alto', activo: true },
            { id: 12, descripcion: 'estante bajo', activo: true },
          ],
        },
      ]),
    );
    dialogo.abrir = vi.fn(async () => ({ zonaId: 12 }));

    const f = montar();
    await f.componentInstance.agregarZona();
    await f.whenStable();

    // La 11 ya está en la toma, así que el diálogo solo recibe la 12.
    const datos = dialogo.abrir.mock.calls[0][1] as { disponibles: { zonaId: number }[] };
    expect(datos.disponibles.map((z) => z.zonaId)).toEqual([12]);

    expect(servicio.guardarZona).toHaveBeenCalledWith({
      inventarioId: 5,
      zonaId: 12,
      concluido: false,
    });
  });
});
