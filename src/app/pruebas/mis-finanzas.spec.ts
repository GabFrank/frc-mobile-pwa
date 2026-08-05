import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { Cliente } from '../domains/cliente/cliente.model';
import type { PageInfo } from '../domains/page-info.model';
import type { Persona } from '../domains/personas/persona.model';
import { Usuario } from '../domains/personas/usuario.model';
import { EstadoVentaCredito, VentaCredito } from '../domains/venta-credito/venta-credito.model';
import { MisFinanzasPage } from '../pages/mis-finanzas/mis-finanzas.page';
import { MisFinanzasService } from '../pages/mis-finanzas/mis-finanzas.service';

describe('Mis finanzas · convenios', () => {
  let servicio: {
    clientePorPersona: ReturnType<typeof vi.fn>;
    conveniosPagina: ReturnType<typeof vi.fn>;
    conveniosAbiertos: ReturnType<typeof vi.fn>;
    venta: ReturnType<typeof vi.fn>;
  };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const cliente = (extra: Partial<Cliente> = {}): Cliente =>
    Object.assign(new Cliente(), { id: 7, credito: 2_000_000, ...extra });

  const convenio = (extra: Partial<VentaCredito> = {}): VentaCredito =>
    Object.assign(new VentaCredito(), {
      id: 1,
      valorTotal: 150_000,
      estado: EstadoVentaCredito.ABIERTO,
      venta: { id: 900, sucursalId: 3 },
      sucursal: { id: 3, nombre: 'Bodega' },
      ...extra,
    });

  const pagina = (
    contenido: VentaCredito[],
    extra: Partial<PageInfo<VentaCredito>> = {},
  ): PageInfo<VentaCredito> => ({
    getContent: contenido,
    getTotalElements: contenido.length,
    getTotalPages: 1,
    ...extra,
  });

  beforeEach(() => {
    localStorage.clear();
    servicio = {
      clientePorPersona: vi.fn(() => of(cliente())),
      conveniosPagina: vi.fn(() => of(pagina([]))),
      conveniosAbiertos: vi.fn(() => of([])),
      venta: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MisFinanzasService, useValue: servicio },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(
      Object.assign(new Usuario(), {
        id: 42,
        roles: ['ADMIN'],
        persona: { id: 11, nombre: 'GABRIEL' } as Persona,
      }),
    );
  });

  it('busca el cliente por la persona de la sesión, no por el usuario', () => {
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    expect(servicio.clientePorPersona).toHaveBeenCalledWith(11);
  });

  it('sin cliente asociado explica que no hay convenio, no muestra un error', () => {
    servicio.clientePorPersona.mockReturnValue(of(undefined));
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    expect(texto(f)).toContain('No tenés convenio');
    // No llegó a pedir convenios: sin cliente no hay a quién pedírselos.
    expect(servicio.conveniosPagina).not.toHaveBeenCalled();
  });

  it('lista los convenios con su importe y su estado', () => {
    servicio.conveniosPagina.mockReturnValue(of(pagina([convenio(), convenio({ id: 2 })])));
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    expect(texto(f)).toContain('Venta 900');
    expect(texto(f)).toContain('Abierto');
    expect(texto(f)).toContain('150.000');
  });

  it('el disponible es el límite menos la suma de los convenios abiertos', () => {
    servicio.conveniosAbiertos.mockReturnValue(
      of([convenio({ valorTotal: 500_000 }), convenio({ id: 2, valorTotal: 300_000 })]),
    );
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    const pagina1 = f.componentInstance;
    expect(pagina1.utilizado()).toBe(800_000);
    expect(pagina1.disponible()).toBe(1_200_000);
  });

  it('si falla el total utilizado, la lista igual se muestra', () => {
    servicio.conveniosAbiertos.mockReturnValue(throwError(() => new Error('caído')));
    servicio.conveniosPagina.mockReturnValue(of(pagina([convenio()])));
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    expect(texto(f)).toContain('Venta 900');
    expect(texto(f)).not.toContain('No se pudieron cargar');
  });

  it('cambiar de filtro vuelve a la primera página', () => {
    servicio.conveniosPagina.mockReturnValue(of(pagina([convenio()], { getTotalPages: 4 })));
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    f.componentInstance.irAPagina(2);
    f.detectChanges();
    expect(f.componentInstance.pagina()).toBe(2);

    f.componentInstance.cambiarFiltro(1);
    f.detectChanges();

    expect(f.componentInstance.pagina()).toBe(0);
    // El historial no filtra por estado.
    expect(servicio.conveniosPagina).toHaveBeenLastCalledWith(7, null, 0);
  });

  it('el filtro por defecto pide solo los abiertos', () => {
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    expect(servicio.conveniosPagina).toHaveBeenCalledWith(7, EstadoVentaCredito.ABIERTO, 0);
  });

  it('muestra el skeleton mientras carga y no el estado vacío', () => {
    servicio.conveniosPagina.mockReturnValue(EMPTY);
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    expect(texto(f)).not.toContain('Sin convenios');
  });

  it('propaga el error de la lista al estado de error', () => {
    servicio.conveniosPagina.mockReturnValue(throwError(() => new Error('sin conexión')));
    const f = TestBed.createComponent(MisFinanzasPage);
    f.detectChanges();

    expect(texto(f)).toContain('sin conexión');
  });
});
