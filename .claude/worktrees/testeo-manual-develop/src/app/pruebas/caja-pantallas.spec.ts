import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { PdvCaja, PdvCajaEstado } from '../domains/caja/caja.model';
import { Usuario } from '../domains/personas/usuario.model';
import { CajaListaPage } from '../pages/operaciones/caja/caja-lista.page';
import { CajaDetallePage } from '../pages/operaciones/caja/caja-detalle.page';
import { CajaService } from '../pages/operaciones/caja/caja.service';

/**
 * Casos 3.1 a 3.8 del plan de testeo manual, automatizados.
 */
describe('Pantallas de caja', () => {
  let cajaService: { abiertasDelUsuario: ReturnType<typeof vi.fn>; porId: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const caja = (extra: Partial<PdvCaja> = {}): PdvCaja =>
    Object.assign(new PdvCaja(), {
      id: 4,
      descripcion: 'Caja 04',
      estado: PdvCajaEstado['En proceso'],
      ...extra,
    });

  beforeEach(() => {
    localStorage.clear();
    cajaService = {
      abiertasDelUsuario: vi.fn(() => of([])),
      porId: vi.fn(() => of(caja())),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CajaService, useValue: cajaService },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(
      Object.assign(new Usuario(), { id: 42, roles: ['ADMIN'] }),
    );
  });

  describe('3.1 · Lista sin cajas', () => {
    it('muestra el estado vacío, no una lista en blanco', () => {
      const f = TestBed.createComponent(CajaListaPage);
      f.detectChanges();

      expect(texto(f)).toContain('No tenés cajas abiertas');
      // El vacío tiene que explicar por qué está vacío.
      expect(texto(f)).toContain('punto de venta');
    });
  });

  describe('3.2 · Lista con cajas', () => {
    it('muestra una card por caja con su chip de estado', () => {
      cajaService.abiertasDelUsuario.mockReturnValue(
        of([caja(), caja({ id: 5, descripcion: 'Caja 05', estado: PdvCajaEstado['Concluido'] })]),
      );
      const f = TestBed.createComponent(CajaListaPage);
      f.detectChanges();

      expect(texto(f)).toContain('Caja 04');
      expect(texto(f)).toContain('Caja 05');
      expect(texto(f)).toContain('En proceso');
      expect(texto(f)).toContain('Concluido');
    });
  });

  describe('3.3 · Skeleton mientras carga', () => {
    it('muestra el placeholder y no el estado vacío', () => {
      // Observable que nunca emite: simula la carga en curso.
      cajaService.abiertasDelUsuario.mockReturnValue(of<PdvCaja[]>().pipe());
      const f = TestBed.createComponent(CajaListaPage);
      f.componentInstance.cargando.set(true);
      f.detectChanges();

      expect(f.nativeElement.querySelector('frc-skeleton')).toBeTruthy();
      expect(texto(f)).not.toContain('No tenés cajas abiertas');
    });
  });

  describe('3.8 · Error de red en la lista', () => {
    it('ofrece reintentar y no queda cargando para siempre', () => {
      cajaService.abiertasDelUsuario.mockReturnValue(
        throwError(() => new Error('No se pudo conectar con el servidor.')),
      );
      const f = TestBed.createComponent(CajaListaPage);
      f.detectChanges();

      expect(texto(f)).toContain('Reintentar');
      expect(f.componentInstance.cargando()).toBe(false);
      // Sin "Ups!! Algo salió mal": el mensaje dice qué pasó.
      expect(texto(f)).toContain('conectar');
    });

    it('reintentar vuelve a consultar', () => {
      cajaService.abiertasDelUsuario.mockReturnValue(throwError(() => new Error('x')));
      const f = TestBed.createComponent(CajaListaPage);
      f.detectChanges();

      cajaService.abiertasDelUsuario.mockReturnValue(of([caja()]));
      f.componentInstance.cargar();
      f.detectChanges();

      expect(texto(f)).toContain('Caja 04');
    });
  });

  describe('3.4 · Detalle de caja — el caso crítico', () => {
    it('carga la caja cuando el router asigna el id', async () => {
      const f = TestBed.createComponent(CajaDetallePage);
      // El router asigna el input DESPUÉS de construir el componente.
      f.componentRef.setInput('id', '4');
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();

      expect(cajaService.porId).toHaveBeenCalledWith(4, undefined);
      // Antes de la corrección mostraba siempre "no es válida".
      expect(texto(f)).not.toContain('no es válida');
      expect(texto(f)).toContain('Caja 04');
    });

    it('resuelve la caja en su sucursal cuando la URL la trae', async () => {
      const f = TestBed.createComponent(CajaDetallePage);
      f.componentRef.setInput('id', '1');
      f.componentRef.setInput('suc', '16');
      f.detectChanges();
      await f.whenStable();

      // El id de caja se repite entre filiales: sin la sucursal, el central
      // resuelve la "Caja 1" de otra sucursal.
      expect(cajaService.porId).toHaveBeenCalledWith(1, 16);
    });

    it('avisa cuando el id no sirve', async () => {
      const f = TestBed.createComponent(CajaDetallePage);
      f.componentRef.setInput('id', 'abc');
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();

      expect(texto(f)).toContain('no es válida');
      expect(cajaService.porId).not.toHaveBeenCalled();
    });
  });

  describe('3.5 y 3.6 · Balance y diferencia', () => {
    const conBalance = (dif: number) =>
      caja({
        balance: {
          totalAperGs: 1500000,
          totalVentaGs: 12284500,
          totalCierreGs: 11200000,
          diferenciaGs: dif,
          diferenciaRs: 0,
          diferenciaDs: 0,
        },
      });

    const montarConBalance = async (dif: number) => {
      cajaService.porId.mockReturnValue(of(conBalance(dif)));
      const f = TestBed.createComponent(CajaDetallePage);
      f.componentRef.setInput('id', '4');
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
      return f;
    };

    it('muestra los guaraníes sin decimales y con puntos de miles', async () => {
      const f = await montarConBalance(0);
      expect(texto(f)).toContain('₲ 1.500.000');
      expect(texto(f)).toContain('₲ 12.284.500');
    });

    it('marca la diferencia y avisa que la resuelve un supervisor', async () => {
      const f = await montarConBalance(-43500);
      expect(f.componentInstance.hayDiferencia()).toBe(true);
      expect(texto(f)).toContain('supervisor');
      expect(f.nativeElement.querySelector('.negativo')).toBeTruthy();
    });

    it('sin diferencia no muestra el aviso ni un "-0"', async () => {
      const f = await montarConBalance(0);
      expect(f.componentInstance.hayDiferencia()).toBe(false);
      expect(texto(f)).not.toContain('supervisor');
      expect(texto(f)).not.toContain('-0');
    });
  });
});
