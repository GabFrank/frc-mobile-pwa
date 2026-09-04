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

describe('CardComponent', () => {
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
