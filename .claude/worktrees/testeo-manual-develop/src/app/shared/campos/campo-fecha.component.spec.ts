import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CampoFechaComponent } from './campo-fecha.component';

@Component({
  standalone: true,
  imports: [CampoFechaComponent, ReactiveFormsModule],
  template: `<frc-campo-fecha [formControl]="control" [minimo]="minimo()" />`,
})
class Anfitrion {
  readonly control = new FormControl<string | null>(null);
  readonly minimo = signal<string | null>(null);
}

describe('CampoFechaComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Anfitrion>>;
  const input = () => (fixture.nativeElement as HTMLElement).querySelector('input')!;

  const escribir = (texto: string) => {
    const el = input();
    el.value = texto;
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('muestra la fecha del central como dd/MM/yyyy', () => {
    fixture.componentInstance.control.setValue('2026-03-05');
    fixture.detectChanges();

    expect(input().value).toBe('05/03/2026');
  });

  it('publica texto yyyy-MM-dd, no un Date', () => {
    // Es lo que viaja en los inputs de GraphQL. Devolver un Date obliga a
    // cada llamador a convertir, y ahí es donde aparece el toISOString() que
    // corre el día.
    escribir('15/03/2026');
    expect(fixture.componentInstance.control.value).toBe('2026-03-15');
  });

  it('acepta la fecha escrita a mano en formato de acá', () => {
    // ⚠️ Con el adaptador nativo de Material esto vaciaba el campo:
    // Date.parse lee MM/dd/yyyy y 15/03/2026 le da Invalid Date.
    escribir('31/12/2026');
    expect(fixture.componentInstance.control.value).toBe('2026-12-31');
  });

  it('lo que no es una fecha deja el valor vacío, no el anterior', () => {
    fixture.componentInstance.control.setValue('2026-03-05');
    fixture.detectChanges();

    escribir('cualquier cosa');

    // Si el campo se ve vacío, vacío tiene que estar lo que se guarde.
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  it('un vencimiento vacío no muestra ninguna fecha', () => {
    expect(input().value).toBe('');
  });

  it('la época Unix se lee como fecha ausente', () => {
    // El central serializa un Date nulo como 1970-01-01.
    fixture.componentInstance.control.setValue('1970-01-01');
    fixture.detectChanges();

    expect(input().value).toBe('');
  });

  it('entiende lo que manda el central con hora', () => {
    // yyyy-MM-dd HH:mm, con espacio y no con la T de ISO.
    fixture.componentInstance.control.setValue('2026-03-05 09:30');
    fixture.detectChanges();

    expect(input().value).toBe('05/03/2026');
  });

  it('respeta el mínimo declarado', () => {
    fixture.componentInstance.minimo.set('2026-03-10');
    fixture.detectChanges();

    expect(input().getAttribute('min')).toContain('2026-03-10');
  });

  it('formControl.disable() deshabilita de verdad', () => {
    // Sin setDisabledState el campo quedaba editable y seguía empujando
    // valores al modelo aunque el formulario lo considerara deshabilitado.
    fixture.componentInstance.control.disable();
    fixture.detectChanges();

    expect(input().disabled).toBe(true);
  });
});
