import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MonedasSesion } from 'src/app/core/moneda/monedas-sesion';
import { Moneda } from 'src/app/domains/moneda/moneda.model';
import { ImporteComponent } from './importe.component';
import { ImportePipe } from './importe.pipe';

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

  describe('sin moneda', () => {
    const guarani = Object.assign(new Moneda(), {
      id: 1, denominacion: 'GUARANI', simbolo: 'Gs.', decimales: 0, principal: true,
    });
    const dolar = Object.assign(new Moneda(), { id: 2, denominacion: 'DOLAR', simbolo: 'US$', decimales: 2 });

    beforeEach(() => {
      fixture.componentInstance.moneda.set(null);
    });

    it('antes de conocer la moneda de la empresa, dos decimales como siempre', () => {
      fixture.componentInstance.valor.set(1500000);
      fixture.detectChanges();
      expect(texto()).toBe('1.500.000,00');
    });

    it('usa la moneda de la empresa: guaraníes sin «,00»', () => {
      TestBed.inject(MonedasSesion).empresa.set(guarani);
      fixture.componentInstance.valor.set(1500000);
      fixture.detectChanges();
      expect(texto()).toBe('1.500.000');
    });

    it('se corrige solo cuando la sesión termina de cargar la moneda', async () => {
      fixture.componentInstance.valor.set(1500000);
      fixture.detectChanges();
      expect(texto()).toBe('1.500.000,00');
      TestBed.inject(MonedasSesion).empresa.set(guarani);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(texto()).toBe('1.500.000');
    });

    it('con el símbolo de otra moneda del catálogo, sus decimales', () => {
      const sesion = TestBed.inject(MonedasSesion);
      sesion.empresa.set(guarani);
      sesion.catalogo.set([guarani, dolar]);
      fixture.componentInstance.valor.set(10.5);
      fixture.componentInstance.simbolo.set('US$');
      fixture.detectChanges();
      expect(texto()).toBe('US$ 10,50');
    });
  });
});

@Component({
  standalone: true,
  imports: [ImportePipe],
  template: `<span class="p">{{ valor() | importe: moneda() : simbolo() }}</span>`,
})
class AnfitrionPipe {
  readonly valor = signal<number | null>(1500000);
  readonly moneda = signal<string | null>(null);
  readonly simbolo = signal<string | null>(null);
}

describe('ImportePipe', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<AnfitrionPipe>>;
  const texto = () => (fixture.nativeElement as HTMLElement).querySelector('.p')!.textContent!.trim();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AnfitrionPipe] });
    fixture = TestBed.createComponent(AnfitrionPipe);
  });

  it('con moneda explícita, igual que siempre', () => {
    fixture.componentInstance.moneda.set('Guaraní');
    fixture.componentInstance.simbolo.set('₲');
    fixture.detectChanges();
    expect(texto()).toBe('₲ 1.500.000');
  });

  it('sin moneda, se actualiza cuando llega la de la empresa aunque el valor no cambie', async () => {
    fixture.detectChanges();
    expect(texto()).toBe('1.500.000,00');
    TestBed.inject(MonedasSesion).empresa.set(
      Object.assign(new Moneda(), { denominacion: 'GUARANI', decimales: 0 }),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(texto()).toBe('1.500.000');
  });
});
