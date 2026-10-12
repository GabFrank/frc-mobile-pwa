import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { PdvCaja } from '../domains/caja/caja.model';
import { Usuario } from '../domains/personas/usuario.model';
import { CajaCerrarPage } from '../pages/operaciones/caja/caja-cerrar.page';
import { CajaDetallePage } from '../pages/operaciones/caja/caja-detalle.page';
import { CajaService } from '../pages/operaciones/caja/caja.service';
import { ImprimirBalanceGQL } from '../pages/operaciones/caja/graphql/imprimirBalance';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * El balance impreso al cerrar caja.
 *
 * `frc-mobile` lo pedía después de cerrar; la primera versión de la PWA no
 * lo pedía nunca. Lo que estos casos protegen es que imprimir sea un paso
 * **aparte**: si la impresora falla, la caja igual quedó cerrada y hay que
 * decirlo así, con un lugar donde reintentar.
 */
describe('Cierre de caja: el balance impreso', () => {
  let cajaService: {
    porId: ReturnType<typeof vi.fn>;
    cerrar: ReturnType<typeof vi.fn>;
    imprimirBalance: ReturnType<typeof vi.fn>;
  };
  let notificacion: {
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
    ok: ReturnType<typeof vi.fn>;
  };
  let navegar: ReturnType<typeof vi.spyOn>;

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const MONEDAS = [
    {
      id: 1,
      denominacion: 'GUARANI',
      simbolo: 'Gs.',
      activo: true,
      monedaBilleteList: [{ id: 8, valor: 100000, activo: true, papel: true }],
    },
  ];

  // Como llega de GraphQL: el id de la sucursal es un string.
  const caja = (extra: Partial<PdvCaja> = {}): PdvCaja =>
    Object.assign(new PdvCaja(), {
      id: 1371,
      activo: true,
      sucursal: { id: '24', nombre: 'SUC. KM2' },
      ...extra,
    });

  const asentar = async (f: { detectChanges: () => void }) => {
    await new Promise((r) => setTimeout(r));
    f.detectChanges();
  };

  /** Monta el cierre con un billete contado, listo para confirmar. */
  const montarCierre = async () => {
    const f = TestBed.createComponent(CajaCerrarPage);
    f.componentRef.setInput('id', '1371');
    f.componentRef.setInput('suc', '24');
    f.detectChanges();
    await asentar(f);
    const campo = f.nativeElement.querySelector('input') as HTMLInputElement;
    campo.value = '2';
    campo.dispatchEvent(new Event('input'));
    f.detectChanges();
    return f;
  };

  beforeEach(() => {
    localStorage.clear();
    cajaService = {
      porId: vi.fn(() => of(caja())),
      cerrar: vi.fn(() => of(true)),
      imprimirBalance: vi.fn(() => of(true)),
    };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      imports: [...APOLLO_DE_PRUEBA],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CajaService, useValue: cajaService },
        { provide: DatosService, useValue: { consultar: vi.fn(() => of(MONEDAS)) } },
        { provide: DialogoService, useValue: { confirmar: vi.fn(async () => true) } },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(
      Object.assign(new Usuario(), { id: 494, roles: ['ADMIN'] }),
    );
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('después de cerrar pide el balance en la sucursal de la caja', async () => {
    const f = await montarCierre();

    await f.componentInstance.cerrar();

    expect(cajaService.cerrar).toHaveBeenCalled();
    expect(cajaService.imprimirBalance).toHaveBeenCalledWith(1371, 24);
    expect(notificacion.ok).toHaveBeenCalledWith('Balance enviado a imprimir');
  });

  it('si la impresora falla, la caja igual quedó cerrada y lo dice', async () => {
    cajaService.imprimirBalance.mockReturnValue(of(false));
    const f = await montarCierre();

    await f.componentInstance.cerrar();

    expect(notificacion.warn.mock.calls[0][0]).toContain('se cerró, pero no se pudo imprimir');
    // Va al detalle, que es donde está «Imprimir balance» para reintentar.
    expect(navegar).toHaveBeenCalledWith(['/operaciones/caja', 1371], {
      queryParams: { suc: 24 },
      replaceUrl: true,
    });
  });

  it('si el cierre es rechazado no manda a imprimir nada', async () => {
    cajaService.cerrar.mockReturnValue(of(false));
    const f = await montarCierre();

    await f.componentInstance.cerrar();

    expect(cajaService.imprimirBalance).not.toHaveBeenCalled();
    expect(navegar).not.toHaveBeenCalled();
  });

  describe('Detalle', () => {
    const montarDetalle = async (c: PdvCaja) => {
      cajaService.porId.mockReturnValue(of(c));
      const f = TestBed.createComponent(CajaDetallePage);
      f.componentRef.setInput('id', '1371');
      f.componentRef.setInput('suc', '24');
      f.detectChanges();
      await asentar(f);
      return f;
    };

    it('una caja abierta ofrece cerrar, no imprimir', async () => {
      const f = await montarDetalle(caja());

      expect(texto(f)).toContain('Cerrar caja');
      expect(texto(f)).not.toContain('Imprimir balance');
    });

    it('una caja cerrada ofrece imprimir el balance y ya no cerrar', async () => {
      const f = await montarDetalle(caja({ activo: false }));

      expect(texto(f)).toContain('Imprimir balance');
      expect(texto(f)).not.toContain('Cerrar caja');
    });

    it('avisa cuando el balance no se pudo imprimir', async () => {
      cajaService.imprimirBalance.mockReturnValue(of(false));
      const f = await montarDetalle(caja({ activo: false }));

      f.componentInstance.imprimir(f.componentInstance.caja()!);

      expect(cajaService.imprimirBalance).toHaveBeenCalledWith(1371, 24);
      expect(notificacion.warn.mock.calls[0][0]).toContain('No se pudo imprimir el balance');
    });
  });
});

describe('CajaService.imprimirBalance', () => {
  let consultar: ReturnType<typeof vi.fn>;

  const servicio = () => {
    TestBed.configureTestingModule({
      imports: [...APOLLO_DE_PRUEBA],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DatosService, useValue: { consultar } },
      ],
    });
    return TestBed.inject(CajaService);
  };

  it('manda la sucursal como `sucId`, que es como la declara la query', () => {
    consultar = vi.fn(() => of({ id: 1371 }));
    let impreso: boolean | undefined;

    servicio()
      .imprimirBalance(1371, 24)
      .subscribe((r) => (impreso = r));

    const [gql, variables] = consultar.mock.calls[0];
    expect(gql).toBeInstanceOf(ImprimirBalanceGQL);
    // Con `sucursalId` el central no recibía la sucursal y no derivaba a la filial.
    expect(variables).toEqual({ id: 1371, sucId: 24 });
    expect(impreso).toBe(true);
  });

  it('una respuesta vacía o un error son «no se imprimió», no una excepción', () => {
    const resultados: boolean[] = [];
    consultar = vi
      .fn()
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(throwError(() => new Error('filial caída')));
    const s = servicio();

    s.imprimirBalance(1371, 24).subscribe((r) => resultados.push(r));
    s.imprimirBalance(1371, 24).subscribe((r) => resultados.push(r));

    expect(resultados).toEqual([false, false]);
  });
});
