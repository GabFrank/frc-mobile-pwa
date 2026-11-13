import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import type { Persona } from '../domains/personas/persona.model';
import { Usuario } from '../domains/personas/usuario.model';
import { CreditoResumenComponent } from '../pages/inicio/credito-resumen.component';
import {
  CreditoOtraEmpresa,
  MisFinanzasService,
  ResumenCredito,
} from '../pages/mis-finanzas/mis-finanzas.service';

describe('Inicio · crédito con la otra empresa', () => {
  let servicio: {
    resumenCredito: ReturnType<typeof vi.fn>;
    creditoOtraEmpresa: ReturnType<typeof vi.fn>;
  };

  const propio: ResumenCredito = { limite: 2_000_000, utilizado: 500_000, disponible: 1_500_000, porcentaje: 25 };
  const otra: CreditoOtraEmpresa = {
    empresa: 'Farmacia',
    resumen: { limite: 900_000, utilizado: 870_000, disponible: 30_000, porcentaje: 96.7 },
  };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';
  const boton = (f: { nativeElement: HTMLElement }, etiqueta: string) =>
    f.nativeElement.querySelector<HTMLButtonElement>(`button[aria-label^="${etiqueta}"]`);

  const crear = () => {
    const f = TestBed.createComponent(CreditoResumenComponent);
    f.detectChanges();
    return f;
  };

  beforeEach(() => {
    localStorage.clear();
    servicio = {
      resumenCredito: vi.fn(() => of(propio)),
      creditoOtraEmpresa: vi.fn(() => of(null)),
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
      Object.assign(new Usuario(), { id: 42, persona: { id: 11, nombre: 'GABRIEL' } as Persona }),
    );
  });

  it('sin crédito en la otra empresa no ofrece el intercambio', () => {
    localStorage.setItem('frc.credito.visible', 'true');
    const f = crear();

    expect(boton(f, 'Ver crédito en')).toBeNull();
    expect(texto(f)).toContain('Crédito disponible');
    expect(texto(f)).toContain('1.500.000');
  });

  it('el intercambio muestra la otra empresa y vuelve, sin navegar', () => {
    localStorage.setItem('frc.credito.visible', 'true');
    servicio.creditoOtraEmpresa.mockReturnValue(of(otra));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate');
    const f = crear();

    boton(f, 'Ver crédito en Farmacia')!.click();
    f.detectChanges();
    expect(texto(f)).toContain('Crédito disponible en Farmacia');
    expect(texto(f)).toContain('30.000');
    expect(texto(f)).not.toContain('1.500.000');

    boton(f, 'Ver mi crédito')!.click();
    f.detectChanges();
    expect(texto(f)).not.toContain('en Farmacia');
    expect(texto(f)).toContain('1.500.000');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('con los valores ocultos, cambiar de empresa no los muestra', () => {
    servicio.creditoOtraEmpresa.mockReturnValue(of(otra));
    const f = crear();

    boton(f, 'Ver crédito en Farmacia')!.click();
    f.detectChanges();

    const el = f.nativeElement as HTMLElement;
    expect(texto(f)).toContain('••••••');
    expect(texto(f)).not.toContain('30.000');
    expect(el.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBeNull();
    const indicador = el.querySelector<HTMLElement>('.indicador')!;
    expect(indicador.style.width).toBe('0%');
    // La otra está al 96 %: con el ojo cerrado no se pinta ni el color de alerta.
    expect(indicador.classList.contains('warn')).toBe(false);
  });

  it('si acá no es cliente pero allá sí, muestra la otra sin botón', () => {
    localStorage.setItem('frc.credito.visible', 'true');
    servicio.resumenCredito.mockReturnValue(of(null));
    servicio.creditoOtraEmpresa.mockReturnValue(of(otra));
    const f = crear();

    expect(texto(f)).toContain('Crédito disponible en Farmacia');
    expect(texto(f)).toContain('30.000');
    expect(boton(f, 'Ver mi crédito')).toBeNull();
  });

  it('mientras acá no es cliente y la otra no respondió, queda cargando', () => {
    servicio.resumenCredito.mockReturnValue(of(null));
    const pendiente = new Subject<CreditoOtraEmpresa | null>();
    servicio.creditoOtraEmpresa.mockReturnValue(pendiente);
    const f = crear();

    expect((f.nativeElement as HTMLElement).querySelector('.cargando')).not.toBeNull();

    pendiente.next(null);
    pendiente.complete();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('.card')).toBeNull();
  });

  it('si la otra empresa falla, no muestra error y lo propio queda igual', () => {
    localStorage.setItem('frc.credito.visible', 'true');
    servicio.creditoOtraEmpresa.mockReturnValue(throwError(() => new Error('caído')));
    const f = crear();

    expect(texto(f)).toContain('1.500.000');
    expect(texto(f)).not.toContain('No se pudo');
    expect(boton(f, 'Ver crédito en')).toBeNull();
  });

  it('Enter sobre un botón no navega; sobre la card, sí', () => {
    servicio.creditoOtraEmpresa.mockReturnValue(of(otra));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = crear();
    const enter = () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });

    boton(f, 'Mostrar valores')!.dispatchEvent(enter());
    boton(f, 'Ver crédito en Farmacia')!.dispatchEvent(enter());
    expect(navegar).not.toHaveBeenCalled();

    (f.nativeElement as HTMLElement).querySelector('.card')!.dispatchEvent(enter());
    expect(navegar).toHaveBeenCalledWith(['/mis-finanzas']);
  });

  it('reintentar lo propio no vuelve a consultar a la otra empresa', () => {
    servicio.resumenCredito.mockReturnValueOnce(throwError(() => new Error('caído')));
    const f = crear();
    expect(texto(f)).toContain('No se pudo cargar tu crédito');

    f.componentInstance.cargar();
    f.detectChanges();

    expect(servicio.resumenCredito).toHaveBeenCalledTimes(2);
    expect(servicio.creditoOtraEmpresa).toHaveBeenCalledTimes(1);
  });
});
