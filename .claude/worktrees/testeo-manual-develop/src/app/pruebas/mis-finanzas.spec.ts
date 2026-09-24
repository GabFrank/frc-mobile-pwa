import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EMPTY, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { EscanerService } from '../core/dispositivo/escaner.service';
import { NotificacionService } from '../core/ui/notificacion.service';
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
    autorizarPorQr: ReturnType<typeof vi.fn>;
  };
  let escaner: { escanear: ReturnType<typeof vi.fn>; disponible: boolean };
  let notificacion: {
    ok: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
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
      autorizarPorQr: vi.fn(() => of(true)),
    };
    escaner = { escanear: vi.fn(async () => undefined), disponible: true };
    notificacion = { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: MisFinanzasService, useValue: servicio },
        { provide: EscanerService, useValue: escaner },
        { provide: NotificacionService, useValue: notificacion },
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
    expect(pagina1.resumen()?.utilizado).toBe(800_000);
    expect(pagina1.resumen()?.disponible).toBe(1_200_000);
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

  describe('confirmar compra por QR', () => {
    // frc-{sucursal}-{tipoEntidad}-{idOrigen}-{idCentral}-{componente}-{data}-{timestamp}
    const qr = (partes: Partial<Record<'suc' | 'tipo' | 'origen' | 'clave' | 'ts', string>> = {}) =>
      [
        'frc',
        partes.suc ?? '3',
        partes.tipo ?? 'VENTA_CREDITO',
        partes.origen ?? '11',
        '0',
        '',
        partes.clave ?? 'abc123',
        partes.ts ?? '1770000000000',
      ].join('-');

    const montar = (leido: string | undefined) => {
      escaner.escanear.mockResolvedValue(leido);
      const f = TestBed.createComponent(MisFinanzasPage);
      f.detectChanges();
      return f;
    };

    it('pide solo el formato QR', async () => {
      const f = montar(qr());
      await f.componentInstance.confirmarPorQr();

      expect(escaner.escanear).toHaveBeenCalledWith(
        expect.objectContaining({ formatos: ['qr_code'] }),
      );
    });

    it('autoriza con la persona de la sesión y los datos del QR', async () => {
      servicio.autorizarPorQr.mockReturnValue(of(true));
      const f = montar(qr());
      await f.componentInstance.confirmarPorQr();

      expect(servicio.autorizarPorQr).toHaveBeenCalledWith(11, '1770000000000', 3, 'abc123');
      expect(notificacion.ok).toHaveBeenCalled();
    });

    it('rechaza el QR de otra persona sin ir al servidor', async () => {
      const f = montar(qr({ origen: '99' }));
      await f.componentInstance.confirmarPorQr();

      expect(servicio.autorizarPorQr).not.toHaveBeenCalled();
      expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('otra persona'));
    });

    it('rechaza un QR que no es de una compra a crédito', async () => {
      const f = montar(qr({ tipo: 'PRODUCTO' }));
      await f.componentInstance.confirmarPorQr();

      expect(servicio.autorizarPorQr).not.toHaveBeenCalled();
      expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('compra a crédito'));
    });

    it('rechaza un código que no es de esta app', async () => {
      const f = montar('7840001234567');
      await f.componentInstance.confirmarPorQr();

      expect(servicio.autorizarPorQr).not.toHaveBeenCalled();
      expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('no es de esta'));
    });

    it('cancelar el escáner no hace nada', async () => {
      const f = montar(undefined);
      await f.componentInstance.confirmarPorQr();

      expect(servicio.autorizarPorQr).not.toHaveBeenCalled();
      expect(notificacion.warn).not.toHaveBeenCalled();
    });

    it('un false del central se avisa: el QR venció o ya se usó', async () => {
      servicio.autorizarPorQr.mockReturnValue(of(false));
      const f = montar(qr());
      await f.componentInstance.confirmarPorQr();

      expect(notificacion.ok).not.toHaveBeenCalled();
      expect(notificacion.warn).toHaveBeenCalledWith(expect.stringContaining('venció'));
    });
  });
});
