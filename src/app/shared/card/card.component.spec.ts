import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardComponent } from './card.component';

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `<frc-card titulo="Sin acción" subtitulo="detalle" />`,
})
class SinAccion {}

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `
    <frc-card titulo="Con acción" (abrir)="abierta.set(abierta() + 1)">
      <button pie type="button" (click)="accionInterna.set(true)">Acción</button>
    </frc-card>
  `,
})
class ConAccion {
  readonly abierta = signal(0);
  readonly accionInterna = signal(false);
}

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `
    <frc-card titulo="Zona" (abrir)="abierta.set(abierta() + 1)">
      <span aparte class="dif">-3</span>
      <div botonera><button type="button">Contar</button></div>
    </frc-card>
  `,
})
class ConBotonera {
  readonly abierta = signal(0);
}

describe('CardComponent', () => {
  describe('[botonera]', () => {
    it('sin usarla no se pinta: las cards de siempre no cambian', () => {
      TestBed.configureTestingModule({ imports: [SinAccion] });
      const fixture = TestBed.createComponent(SinAccion);
      fixture.detectChanges();

      const fila = (fixture.nativeElement as HTMLElement).querySelector('.card-botonera')!;
      expect(fila.children.length).toBe(0);
      expect(getComputedStyle(fila).display).toBe('none');
    });

    it('con botones, es una fila al final, después de la columna de la derecha', () => {
      TestBed.configureTestingModule({ imports: [ConBotonera] });
      const fixture = TestBed.createComponent(ConBotonera);
      fixture.detectChanges();

      const article = (fixture.nativeElement as HTMLElement).querySelector('article')!;
      const hijos = [...article.children].map((c) => c.className);
      expect(hijos.indexOf('card-botonera')).toBeGreaterThan(hijos.indexOf('aside'));
      expect(article.querySelector('.card-botonera button')?.textContent).toBe('Contar');
      expect(article.querySelector('.aside .dif')).not.toBeNull();
    });

    it('tocar el hueco de la botonera, fuera de los botones, tampoco la abre', () => {
      TestBed.configureTestingModule({ imports: [ConBotonera] });
      const fixture = TestBed.createComponent(ConBotonera);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.card-botonera')!.click();
      expect(fixture.componentInstance.abierta()).toBe(0);
    });

    it('tocar un botón de la botonera no abre la card', () => {
      TestBed.configureTestingModule({ imports: [ConBotonera] });
      const fixture = TestBed.createComponent(ConBotonera);
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.card-botonera button')!.click();
      expect(fixture.componentInstance.abierta()).toBe(0);
    });
  });

  describe('sin quien escuche (abrir)', () => {
    it('no se anuncia como botón ni captura el foco', () => {
      TestBed.configureTestingModule({ imports: [SinAccion] });
      const fixture = TestBed.createComponent(SinAccion);
      fixture.detectChanges();

      const article = (fixture.nativeElement as HTMLElement).querySelector('article')!;
      // Una card sin acción no debe ser una parada muerta para el teclado.
      expect(article.getAttribute('role')).toBeNull();
      expect(article.getAttribute('tabindex')).toBeNull();
    });
  });

  describe('con (abrir)', () => {
    let fixture: ReturnType<typeof TestBed.createComponent<ConAccion>>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [ConAccion] });
      fixture = TestBed.createComponent(ConAccion);
      fixture.detectChanges();
    });

    it('se anuncia como botón accesible', () => {
      const article = (fixture.nativeElement as HTMLElement).querySelector('article')!;
      expect(article.getAttribute('role')).toBe('button');
      expect(article.getAttribute('tabindex')).toBe('0');
    });

    it('emite al hacer click', () => {
      const article = (fixture.nativeElement as HTMLElement).querySelector('article')!;
      article.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.abierta()).toBe(1);
    });

    it('no se abre cuando el click viene de un control de sus slots', () => {
      const boton = (fixture.nativeElement as HTMLElement).querySelector('button[pie]')!;
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      fixture.detectChanges();

      // El botón interno hace lo suyo; la card no debe abrirse además.
      expect(fixture.componentInstance.accionInterna()).toBe(true);
      expect(fixture.componentInstance.abierta()).toBe(0);
    });

    it('responde a Enter', () => {
      const article = (fixture.nativeElement as HTMLElement).querySelector('article')!;
      article.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.abierta()).toBe(1);
    });
  });
});
