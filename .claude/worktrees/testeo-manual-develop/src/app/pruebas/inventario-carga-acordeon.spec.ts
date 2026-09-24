import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { InventarioEstado } from '../domains/inventario/inventario.model';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { InventarioCargaPage } from '../pages/inventario/inventario-carga.page';
import { InventarioService } from '../pages/inventario/inventario.service';
import { LoteService } from '../domains/lote/lote.service';
import { ProductoService } from '../pages/producto/producto.service';

/**
 * La lista de la zona como acordeón.
 *
 * Antes los tres campos de cada ítem estaban siempre abiertos: una góndola de
 * treinta ítems eran noventa campos apilados y había que recorrerla entera
 * para saber qué faltaba contar. Lo que estas pruebas cuidan es que
 * **colapsar no sea perder** —ni lo escrito ni la información para decidir si
 * abrir—, que es la única forma en que el cambio empeora la pantalla.
 */
describe('Conteo por zona, colapsado', () => {
  let servicio: { porId: ReturnType<typeof vi.fn>; guardarItem: ReturnType<typeof vi.fn> };

  const item = (id: number, presentacionId: number, descripcion: string, cantidad?: number) => ({
    id,
    cantidad,
    cantidadFisica: 70,
    presentacion: { id: presentacionId, cantidad: 1, producto: { id: 200 + id, descripcion } },
  });

  const inventario = (items: unknown[]) => ({
    id: 5,
    estado: InventarioEstado.ABIERTO,
    sucursal: { id: 3, nombre: 'SUC. ROTONDA' },
    inventarioProductoList: [
      { id: 91, zona: { id: 11, descripcion: 'gondola 1' }, inventarioProductoItemList: items },
    ],
  });

  const tresItems = [
    item(1, 9, 'COCA COLA 2LTS', 76),
    item(2, 8, 'CONTI GASEOSA COLA 3L'),
    item(3, 7, 'CORONITA EXTRA 210 ML'),
  ];

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(inventario(tresItems))),
      guardarItem: vi.fn(() => of({ id: 1 })),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La página lo inyecta siempre, pero solo lo usa con productos que
        // llevan control de lote: en estos casos ninguno lo lleva.
        {
          provide: LoteService,
          useValue: {
            stockPorLote: vi.fn(() => of([])),
            buscar: vi.fn(() => of({ getContent: [] })),
            actualizarFechas: vi.fn(() => of({})),
          },
        },
        { provide: InventarioService, useValue: servicio },
        { provide: ProductoService, useValue: { vencimientosConocidos: vi.fn(() => of([])) } },
        { provide: ProductoBusquedaService, useValue: { stock: vi.fn(() => of(0)) } },
        { provide: DialogoService, useValue: { abrir: vi.fn() } },
        { provide: NotificacionService, useValue: { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() } },
        {
          provide: AuthService,
          useValue: { usuario: signal({ id: 41 }), sucursal: signal({ id: 3 }), roles: signal([]) },
        },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(InventarioCargaPage);
    f.componentRef.setInput('id', '5');
    f.componentRef.setInput('productoId', '91');
    f.detectChanges();
    return f;
  };

  const campos = (f: ReturnType<typeof montar>) =>
    (f.nativeElement as HTMLElement).querySelectorAll('mat-form-field').length;

  it('arranca con la zona entera colapsada', () => {
    const f = montar();

    expect(f.componentInstance.abiertoId()).toBeNull();
    expect(campos(f)).toBe(0);
    // Pero los tres productos se ven: colapsado no es oculto.
    const texto = f.nativeElement.textContent;
    expect(texto).toContain('COCA COLA 2LTS');
    expect(texto).toContain('CONTI GASEOSA COLA 3L');
    expect(texto).toContain('CORONITA EXTRA 210 ML');
  });

  it('abrir uno cierra el que estaba', () => {
    const f = montar();

    f.componentInstance.alternar(1);
    f.detectChanges();
    expect(f.componentInstance.abiertoId()).toBe(1);
    // Contado, vencimiento y estado: tres campos, los de un solo ítem.
    expect(campos(f)).toBe(3);

    f.componentInstance.alternar(2);
    f.detectChanges();
    expect(f.componentInstance.abiertoId()).toBe(2);
    expect(campos(f)).toBe(3);
  });

  it('tocar el que ya está abierto lo cierra', () => {
    const f = montar();

    f.componentInstance.alternar(1);
    f.componentInstance.alternar(1);
    f.detectChanges();

    expect(f.componentInstance.abiertoId()).toBeNull();
    expect(campos(f)).toBe(0);
  });

  it('lo escrito sobrevive al colapso', () => {
    // La edición vive en una señal de la pantalla, no en los campos del DOM.
    // Si viviera en el DOM, cerrar la tarjeta borraría el conteo — y sería
    // una pérdida muda, en medio de una góndola.
    const f = montar();
    f.componentInstance.alternar(2);
    f.componentInstance.cambiarContado(2, { target: { value: '23' } } as unknown as Event);

    f.componentInstance.alternar(2);
    f.detectChanges();

    expect(f.componentInstance.items()[1].contado).toBe(23);
    expect(f.componentInstance.hayCambios()).toBe(true);

    f.componentInstance.guardar();
    expect(servicio.guardarItem.mock.calls[0][0].cantidad).toBe(23);
  });

  it('la cabecera colapsada dice el sistema y la diferencia', () => {
    // Es lo que decide si vale la pena abrir la tarjeta.
    const f = montar();

    const texto = f.nativeElement.textContent;
    expect(texto).toContain('Sistema: 70,00');
    // 76 contados contra 70 del sistema: sobran 6.
    expect(texto).toContain('+6');
  });

  it('sin contar muestra un guion, no un cero', () => {
    // Cero es una diferencia —coincide—; el guion dice que nadie fue a la
    // góndola todavía. Mostrarlos igual borra esa distinción.
    const f = montar();

    expect(f.componentInstance.items()[1].diferencia).toBeNull();
    expect(f.nativeElement.textContent).toContain('—');
  });

  it('el avance cuenta lo que hay en pantalla, no lo último que guardó el central', () => {
    // Si mirara solo la respuesta del central, el contador no se movería
    // mientras se cuenta, que es exactamente cuando se lo mira.
    const f = montar();
    expect(f.componentInstance.resumen().contados).toBe(1);

    f.componentInstance.cambiarContado(2, { target: { value: '70' } } as unknown as Event);
    f.detectChanges();

    expect(f.componentInstance.resumen().contados).toBe(2);
    // 70 contra 70 del sistema no es una diferencia; el ítem 1 sí lo es.
    expect(f.componentInstance.resumen().conDiferencia).toBe(1);
    expect(f.nativeElement.textContent).toContain('2 de 3 contados');
  });

  it('elegir un vencimiento deja la tarjeta abierta', () => {
    // El calendario se abre en un overlay: si al cerrarlo la tarjeta se
    // colapsara, no se vería el resultado de lo que se acaba de elegir.
    const f = montar();
    f.componentInstance.alternar(3);

    f.componentInstance.cambiarVencimiento(3, '2026-11-20');
    f.detectChanges();

    expect(f.componentInstance.abiertoId()).toBe(3);
    expect(f.componentInstance.items()[2].vencimiento).toBe('2026-11-20');
  });
});
