import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { CampoImporteComponent } from './campo-importe.component';

@Component({
  standalone: true,
  imports: [CampoImporteComponent, ReactiveFormsModule],
  template: `<frc-campo-importe [formControl]="control" [moneda]="moneda()" />`,
})
class Anfitrion {
  readonly control = new FormControl<number | null>(null);
  readonly moneda = signal<string | null>('Guaraní');
}

describe('CampoImporteComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Anfitrion>>;
  const input = () => (fixture.nativeElement as HTMLElement).querySelector('input')!;

  const escribir = (texto: string) => {
    const el = input();
    el.value = texto;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('publica el valor parseado en el FormControl', () => {
    escribir('1.500.000');
    expect(fixture.componentInstance.control.value).toBe(1500000);
  });

  it('interpreta el punto decimal de los teclados móviles', () => {
    fixture.componentInstance.moneda.set('Dólar');
    fixture.detectChanges();
    escribir('10.50');
    expect(fixture.componentInstance.control.value).toBe(10.5);
  });

  it('al salir del campo redondea a la precisión de la moneda', () => {
    escribir('1234,56');
    input().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    // Un guaraní con decimales es un dato inválido, no un detalle visual.
    expect(fixture.componentInstance.control.value).toBe(1235);
  });

  it('no reformatea mientras se está escribiendo', () => {
    escribir('1234');
    expect(input().value).toBe('1234');
  });

  it('formatea al recibir un valor desde el formulario', () => {
    fixture.componentInstance.control.setValue(1500000);
    fixture.detectChanges();
    expect(input().value).toBe('1.500.000');
  });

  it('respeta formControl.disable()', () => {
    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    // Sin setDisabledState el campo seguía editable y empujando valores.
    expect(input().disabled).toBe(true);
  });

  it('vuelve a habilitarse con enable()', () => {
    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    fixture.componentInstance.control.enable();
    fixture.detectChanges();
    expect(input().disabled).toBe(false);
  });

  it('deja el control en null si se borra el texto', () => {
    escribir('100');
    escribir('');
    expect(fixture.componentInstance.control.value).toBeNull();
  });

  describe('sin moneda', () => {
    const salir = () => {
      input().dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };

    beforeEach(() => {
      fixture.componentInstance.moneda.set(null);
      fixture.detectChanges();
    });

    it('no cae a la moneda de la empresa: el monto puede cargarse antes de elegir la moneda', () => {
      TestBed.inject(MonedasSesion).empresa.set(
        Object.assign(new Moneda(), { denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0 }),
      );
      escribir('1234,56');
      salir();
      expect(fixture.componentInstance.control.value).toBe(1234.56);
    });

    it('sin moneda de empresa conocida, dos decimales como antes', () => {
      escribir('1234,56');
      salir();
      expect(fixture.componentInstance.control.value).toBe(1234.56);
    });
  });
});
