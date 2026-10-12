import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DatosService } from '../core/graphql/datos.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { Usuario } from '../domains/personas/usuario.model';
import { CajaAbrirPage } from '../pages/operaciones/caja/caja-abrir.page';
import { CajaService } from '../pages/operaciones/caja/caja.service';
import { MaletinesGQL } from '../pages/operaciones/caja/graphql/moneda-y-maletin';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * Abrir caja: la sucursal la elige el cajero.
 *
 * Lo que estos casos protegen: la app habla con el central, y la sucursal de
 * la sesión ahí es la 0 (`SERVIDOR`). Con ella se ofrecían siete maletines
 * viejos que no son de ninguna sucursal real, y la apertura no iba a la
 * filial.
 */
describe('Abrir caja', () => {
  let sucursales: { todas: ReturnType<typeof vi.fn> };
  let datos: { consultar: ReturnType<typeof vi.fn> };
  let cajaService: { abrir: ReturnType<typeof vi.fn> };
  let dialogo: { confirmar: ReturnType<typeof vi.fn> };
  let notificacion: {
    warn: ReturnType<typeof vi.fn>;
    danger: ReturnType<typeof vi.fn>;
    ok: ReturnType<typeof vi.fn>;
  };
  /** Qué responde la consulta de maletines, por sucursal. */
  let maletinesDe: (sucId: unknown) => Observable<unknown>;

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const TODAS = [
    { id: 0, nombre: 'SERVIDOR', deposito: false, activo: true, ip: 'localhost' },
    { id: 1, nombre: 'SUC. CENTRAL', deposito: true, activo: true, ip: '172.25.1.1' },
    { id: 10, nombre: 'SUC. KATUETE 2', deposito: true, activo: true, ip: '172.25.1.10' },
    { id: 500, nombre: 'PANADERIA 1', deposito: true, activo: true, ip: null },
  ];

  /** La pantalla encadena promesas: hay que dejar correr un turno entero. */
  const asentar = async (f: { detectChanges: () => void }) => {
    await new Promise((r) => setTimeout(r));
    f.detectChanges();
  };

  const crear = async () => {
    const f = TestBed.createComponent(CajaAbrirPage);
    f.detectChanges();
    await asentar(f);
    return f;
  };

  const elegirSucursal = async (f: Awaited<ReturnType<typeof crear>>, id: number) => {
    f.componentInstance.cambiarSucursal(id);
    await asentar(f);
  };

  beforeEach(() => {
    localStorage.clear();
    sucursales = { todas: vi.fn(() => of(TODAS)) };
    maletinesDe = () => of([{ id: 77, descripcion: '0020221001', activo: true, abierto: false }]);
    datos = {
      consultar: vi.fn((gql: unknown, variables: { sucId?: unknown }) =>
        gql instanceof MaletinesGQL ? maletinesDe(variables?.sucId) : of([]),
      ),
    };
    cajaService = { abrir: vi.fn(() => of(true)) };
    dialogo = { confirmar: vi.fn(async () => true) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      imports: [...APOLLO_DE_PRUEBA],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SucursalService, useValue: sucursales },
        { provide: DatosService, useValue: datos },
        { provide: CajaService, useValue: cajaService },
        { provide: DialogoService, useValue: dialogo },
        { provide: NotificacionService, useValue: notificacion },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(
      Object.assign(new Usuario(), {
        id: 42,
        roles: ['ADMIN'],
        // La sesión contra el central dice SERVIDOR: no se tiene que usar.
        inicioSesion: { sucursal: { id: 0, nombre: 'SERVIDOR' } },
      }),
    );
  });

  it('no ofrece SERVIDOR ni las sucursales sin IP', async () => {
    const f = await crear();

    expect(f.componentInstance.opcionesSucursal().map((o) => o.texto)).toEqual([
      'SUC. CENTRAL',
      'SUC. KATUETE 2',
    ]);
  });

  it('no preselecciona sucursal ni consulta maletines con la de la sesión', async () => {
    const f = await crear();

    expect(f.componentInstance.sucursalId()).toBeNull();
    expect(datos.consultar.mock.calls.some(([gql]) => gql instanceof MaletinesGQL)).toBe(false);
    expect(texto(f)).toContain('Elegí la sucursal');
  });

  it('al elegir sucursal pide los maletines de esa sucursal', async () => {
    const f = await crear();
    await elegirSucursal(f, 10);

    const llamada = datos.consultar.mock.calls.find(([gql]) => gql instanceof MaletinesGQL);
    expect(llamada?.[1]).toEqual({ sucId: 10 });
    expect(f.componentInstance.opcionesMaletin()).toEqual([{ valor: 77, texto: '0020221001' }]);
  });

  it('cambiar de sucursal descarta el maletín que estaba elegido', async () => {
    const f = await crear();
    await elegirSucursal(f, 10);
    f.componentInstance.maletinId.set(77);

    await elegirSucursal(f, 1);

    expect(f.componentInstance.maletinId()).toBeNull();
  });

  it('si la filial no responde lo dice, en vez de «no hay maletines»', async () => {
    maletinesDe = () => throwError(() => new Error('No se pudo conectar con SUC. KATUETE 2.'));
    const f = await crear();
    await elegirSucursal(f, 10);

    expect(texto(f)).toContain('No se pudo conectar con SUC. KATUETE 2.');
    expect(texto(f)).not.toContain('No hay maletines disponibles');
    expect(texto(f)).toContain('Reintentar');
  });

  it('sin maletines libres nombra la sucursal elegida, no la de la sesión', async () => {
    maletinesDe = () => of([]);
    const f = await crear();
    await elegirSucursal(f, 10);

    expect(texto(f)).toContain('No hay maletines disponibles en SUC. KATUETE 2');
  });

  it('sin sucursal elegida no abre', async () => {
    const f = await crear();

    await f.componentInstance.abrir();

    expect(notificacion.warn).toHaveBeenCalledWith('Elegí la sucursal antes de abrir la caja.');
    expect(cajaService.abrir).not.toHaveBeenCalled();
  });

  it('abre en la sucursal elegida, con su maletín', async () => {
    const f = await crear();
    await elegirSucursal(f, 10);
    f.componentInstance.maletinId.set(77);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await f.componentInstance.abrir();

    expect(dialogo.confirmar.mock.calls[0][0].mensaje).toContain('SUC. KATUETE 2');
    const input = cajaService.abrir.mock.calls[0][0];
    expect(input.sucursalId).toBe(10);
    expect(input.maletinId).toBe(77);
    expect(input.usuarioId).toBe(42);
  });
});
