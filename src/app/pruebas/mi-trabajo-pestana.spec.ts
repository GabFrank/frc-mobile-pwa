import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { Usuario } from '../domains/personas/usuario.model';
import { TipoMarcacion } from '../domains/marcacion/marcacion.model';
import { MiTrabajoPage } from '../pages/mi-trabajo/mi-trabajo.page';
import { RrhhService } from '../pages/mi-trabajo/rrhh.service';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * «Mi trabajo» es el historial de marcaciones, y a él llega el botón
 * «Historial» de la pantalla de Marcación con `?tab=marcaciones`.
 *
 * Lo que se cubre acá es que ese parámetro **elija la pestaña** y que la
 * pestaña **muestre las horas fichadas**, que era justamente lo que faltaba:
 * la lista existía pero solo decía cuántos minutos se trabajaron.
 */
describe('Mi trabajo · historial de marcaciones', () => {
  let servicio: Record<string, ReturnType<typeof vi.fn>>;

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const jornada = () => ({
    id: 91,
    fecha: '2026-08-14',
    minutosTrabajados: 495,
    estado: 'NORMAL',
    marcacionEntrada: { id: 11, tipo: TipoMarcacion.ENTRADA, fechaEntrada: '2026-08-14 07:12' },
    marcacionSalida: { id: 12, tipo: TipoMarcacion.SALIDA, fechaSalida: '2026-08-14 17:45' },
  });

  beforeEach(() => {
    localStorage.clear();
    servicio = {
      resumen: vi.fn(() => of(null)),
      marcaciones: vi.fn(() => of([jornada()])),
      vales: vi.fn(() => of([])),
      recibos: vi.fn(() => of([])),
      vacaciones: vi.fn(() => of([])),
    };
    TestBed.configureTestingModule({
      imports: APOLLO_DE_PRUEBA,
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RrhhService, useValue: servicio },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(
      Object.assign(new Usuario(), { id: 42, nickname: 'tester' }),
    );
  });

  it('muestra la hora de entrada y la de salida, no solo los minutos', () => {
    const fixture = TestBed.createComponent(MiTrabajoPage);
    fixture.detectChanges();

    expect(texto(fixture)).toContain('07:12');
    expect(texto(fixture)).toContain('17:45');
  });

  it('los horarios quedan en el pie de la card, no sueltos en la pantalla', () => {
    // Un bloque de control de flujo con más de un nodo raíz no proyecta, y el
    // AOT lo avisa con NG8011 — que es un warning y pasa desapercibido. El
    // síntoma sería ver las horas fuera de su card. Ver docs/PATRONES.md §16.
    const fixture = TestBed.createComponent(MiTrabajoPage);
    fixture.detectChanges();

    const enElPie = fixture.nativeElement.querySelectorAll('.pie .horario');
    expect(enElPie.length).toBe(2);
  });

  it('`?tab=vales` abre la pestaña de vales y no consulta la de marcación', () => {
    // Sin esto, el botón «Historial» de Marcación dependería del orden en que
    // estén declaradas las pestañas: si alguien las reordena, cae en otra.
    const fixture = TestBed.createComponent(MiTrabajoPage);
    fixture.componentRef.setInput('tab', 'vales');
    fixture.detectChanges();

    expect(servicio['vales']).toHaveBeenCalled();
    expect(servicio['marcaciones']).not.toHaveBeenCalled();
  });

  it('sin parámetro arranca en marcación, que es la primera', () => {
    const fixture = TestBed.createComponent(MiTrabajoPage);
    fixture.detectChanges();

    expect(servicio['marcaciones']).toHaveBeenCalled();
  });
});
