import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import type { Transferencia } from '../domains/transferencia/transferencia.model';
import { TransferenciaService } from '../pages/transferencias/transferencia.service';
import { TransferenciasListaPage } from '../pages/transferencias/transferencias-lista.page';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

const transferencia = (id: number): Transferencia =>
  ({
    id,
    sucursalOrigen: { id: 1, nombre: 'SUC. ROTONDA' },
    sucursalDestino: { id: 3, nombre: 'SUC. PALOMA 1' },
  }) as Transferencia;

const pagina = (contenido: Transferencia[], hasNext = false) => ({
  getContent: contenido,
  hasNext,
});

/**
 * La lista de `frc-mobile` eran solo las transferencias del usuario. La PWA
 * la trae de vuelta como una pestaña más, y entra por ella.
 */
describe('Lista de transferencias: la pestaña «Mías»', () => {
  let servicio: { conFiltros: ReturnType<typeof vi.fn>; porUsuario: ReturnType<typeof vi.fn> };
  let usuario: ReturnType<typeof signal<{ id?: number } | null>>;

  const montar = (inputs: Record<string, string> = {}): ComponentFixture<TransferenciasListaPage> => {
    const f = TestBed.createComponent(TransferenciasListaPage);
    for (const [nombre, valor] of Object.entries(inputs)) {
      f.componentRef.setInput(nombre, valor);
    }
    f.detectChanges();
    return f;
  };

  const pestanas = (f: ComponentFixture<TransferenciasListaPage>): string[] =>
    f.componentInstance.vistas().map((v) => v.etiqueta);

  /**
   * Elige una pestaña por su etiqueta, como lo hace el `mat-tab-group`.
   *
   * ⚠️ **Hay que esperar a que se asiente.** El grupo avisa su índice nuevo en
   * diferido: dos cambios en el mismo tick y el aviso del primero llega
   * después del segundo, y lo deshace. Con un dedo no pasa.
   */
  const elegir = async (
    f: ComponentFixture<TransferenciasListaPage>,
    etiqueta: string,
  ): Promise<void> => {
    f.componentInstance.cambiarVista(pestanas(f).indexOf(etiqueta));
    f.detectChanges();
    await f.whenStable();
  };

  beforeEach(() => {
    servicio = {
      conFiltros: vi.fn(() => of(pagina([]))),
      porUsuario: vi.fn(() => of([])),
    };
    usuario = signal<{ id?: number } | null>({ id: 41 });

    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [
        provideRouter([]),
        { provide: TransferenciaService, useValue: servicio },
        { provide: AuthService, useValue: { usuario, roles: signal(['VER TRANSFERENCIA']) } },
      ],
    });
  });

  it('entra por «Mías» y pregunta por el usuario de la sesión', () => {
    const f = montar();

    expect(pestanas(f)).toEqual(['Mías', 'Salen', 'Llegan', 'Todas']);
    expect(servicio.porUsuario).toHaveBeenCalledTimes(1);
    expect(servicio.porUsuario).toHaveBeenCalledWith(41);
    expect(servicio.conFiltros).not.toHaveBeenCalled();
  });

  it('muestra las del usuario, sin «Cargar más»', () => {
    servicio.porUsuario = vi.fn(() => of([transferencia(7), transferencia(8)]));
    const f = montar();

    const texto = f.nativeElement.textContent;
    expect(texto).toContain('#7');
    expect(texto).toContain('#8');
    expect(texto).not.toContain('Cargar más');
    // Con menos de 20 están todas: avisar del corte sería mentir.
    expect(texto).not.toContain('Son tus últimas');
  });

  /**
   * ⚠️ **El central corta en 20 y no pagina.** Veinte filas sin decir nada
   * afirman que no hay más.
   */
  it('al llegar al corte del central avisa que puede haber más', () => {
    servicio.porUsuario = vi.fn(() =>
      of(Array.from({ length: 20 }, (_, i) => transferencia(i + 1))),
    );
    const f = montar();

    expect(f.nativeElement.textContent).toContain('Son tus últimas 20');
  });

  it('vacía, dice dónde están las demás', () => {
    const f = montar();

    const texto = f.nativeElement.textContent;
    expect(texto).toContain('No participás en ninguna');
    expect(texto).toContain('Salen, Llegan y Todas');
  });

  /**
   * ⚠️ **Sin usuario no se preguntó nada.** Una lista vacía diría que no
   * participa en ninguna, que es otra respuesta.
   */
  it('sin id de usuario muestra un error y no consulta', () => {
    usuario.set(null);
    const f = montar();

    expect(servicio.porUsuario).not.toHaveBeenCalled();
    expect(f.componentInstance.error()).toContain('identificar tu usuario');
    expect(f.nativeElement.textContent).not.toContain('No participás en ninguna');
  });

  it('si la consulta falla muestra el error, no el vacío', () => {
    servicio.porUsuario = vi.fn(() => throwError(() => new Error('Sin conexión')));
    const f = montar();

    expect(f.componentInstance.error()).toBe('Sin conexión');
    expect(f.nativeElement.textContent).not.toContain('No participás en ninguna');
  });

  it('«Salen» pide una sola vez, por la bandera de origen', async () => {
    const f = montar();
    await elegir(f, 'Salen');

    expect(servicio.conFiltros).toHaveBeenCalledTimes(1);
    expect(servicio.conFiltros).toHaveBeenCalledWith(
      expect.objectContaining({ isOrigen: true, isDestino: null, page: 0 }),
    );
    expect(servicio.porUsuario).toHaveBeenCalledTimes(1);
  });

  /**
   * ⚠️ **«Mías» no acepta etapa ni sucursal.** Acotar sus 20 filas acá
   * respondería «no hay» cuando lo cierto es «no pregunté».
   */
  it('con filtro de URL no ofrece «Mías» y entra por «Todas»', () => {
    const f = montar({ sucursal: '3' });

    expect(pestanas(f)).toEqual(['Salen', 'Llegan', 'Todas']);
    expect(f.componentInstance.vista().etiqueta).toBe('Todas');
    expect(servicio.porUsuario).not.toHaveBeenCalled();
    expect(servicio.conFiltros).toHaveBeenCalledWith(
      expect.objectContaining({ sucursalDestinoId: 3, isOrigen: null, isDestino: null }),
    );
  });

  it('con la etapa en la URL tampoco', () => {
    const f = montar({ etapa: 'TRANSPORTE_EN_CAMINO' });

    expect(pestanas(f)).not.toContain('Mías');
    expect(servicio.conFiltros).toHaveBeenCalledWith(
      expect.objectContaining({ etapa: 'TRANSPORTE_EN_CAMINO' }),
    );
  });

  /** Un valor inventado no acota nada: no puede esconder la pestaña. */
  it('un filtro de URL que no vale no esconde «Mías»', () => {
    const f = montar({ etapa: 'CUALQUIERA', sucursal: 'abc' });

    expect(pestanas(f)).toContain('Mías');
    expect(f.componentInstance.filtrada()).toBe(false);
    expect(servicio.porUsuario).toHaveBeenCalledWith(41);
  });

  /**
   * Las dos pestañas salen de consultas distintas: sin cortar la anterior,
   * la que llega tarde pisa la lista de la pestaña que se está mirando.
   */
  it('una respuesta tardía de la pestaña anterior no pisa la actual', async () => {
    const lenta = new Subject<Transferencia[]>();
    servicio.porUsuario = vi.fn(() => lenta);
    servicio.conFiltros = vi.fn(() => of(pagina([transferencia(99)])));
    const f = montar();

    await elegir(f, 'Todas');
    lenta.next([transferencia(7)]);
    f.detectChanges();

    expect(f.componentInstance.filas().map((t) => t.id)).toEqual([99]);
  });

  /**
   * ⚠️ **Cortar un «Cargar más» en vuelo no puede dejarlo pegado**: quien
   * bajaba `cargandoMas` y `hayMas` era la respuesta que ya no llega.
   */
  it('cambiar de pestaña con un «Cargar más» en vuelo no deja nada pegado', async () => {
    const segunda = new Subject<ReturnType<typeof pagina>>();
    servicio.conFiltros = vi
      .fn()
      .mockReturnValueOnce(of(pagina([transferencia(1)], true)))
      .mockReturnValueOnce(segunda);
    const f = montar();
    await elegir(f, 'Salen');
    expect(f.componentInstance.hayMas()).toBe(true);

    f.componentInstance.cargarMas();
    expect(f.componentInstance.cargandoMas()).toBe(true);
    await elegir(f, 'Mías');

    expect(f.componentInstance.cargandoMas()).toBe(false);
    expect(f.componentInstance.hayMas()).toBe(false);
  });
});
