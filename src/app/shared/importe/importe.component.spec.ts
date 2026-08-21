import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ImporteComponent } from './importe.component';

@Component({
  standalone: true,
  imports: [ImporteComponent],
  template: `<frc-importe [valor]="valor()" [moneda]="moneda()" [simbolo]="simbolo()" />`,
})
class Anfitrion {
  readonly valor = signal<number | null>(0);
  readonly moneda = signal<string | null>('Guaraní');
  readonly simbolo = signal<string | null>(null);
}

describe('ImporteComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Anfitrion>>;

  const texto = () =>
    (fixture.nativeElement as HTMLElement).querySelector('.importe')!.textContent!.trim();
  const esNegativo = () =>
    (fixture.nativeElement as HTMLElement)
      .querySelector('.importe')!
      .classList.contains('negativo');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    fixture = TestBed.createComponent(Anfitrion);
  });

  it('formatea guaraníes sin decimales', () => {
    fixture.componentInstance.valor.set(1500000);
    fixture.detectChanges();
    expect(texto()).toBe('1.500.000');
  });

  it('formatea otras monedas con dos decimales', () => {
    fixture.componentInstance.valor.set(1284.5);
    fixture.componentInstance.moneda.set('Dólar');
    fixture.detectChanges();
    expect(texto()).toBe('1.284,50');
  });

  it('antepone el símbolo', () => {
    fixture.componentInstance.valor.set(12500);
    fixture.componentInstance.simbolo.set('₲');
    fixture.detectChanges();
    expect(texto()).toBe('₲ 12.500');
  });

  it('marca los negativos para que salten a la vista en un arqueo', () => {
    fixture.componentInstance.valor.set(-43500);
    fixture.detectChanges();
    expect(esNegativo()).toBe(true);

    fixture.componentInstance.valor.set(43500);
    fixture.detectChanges();
    expect(esNegativo()).toBe(false);
  });

  it('el cero no es negativo', () => {
    fixture.componentInstance.valor.set(0);
    fixture.detectChanges();
    expect(esNegativo()).toBe(false);
  });

  it('no muestra nada ante valor nulo', () => {
    fixture.componentInstance.valor.set(null);
    fixture.detectChanges();
    expect(texto()).toBe('');
  });
});
