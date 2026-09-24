import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PaginacionComponent } from './paginacion.component';
import type { PageInfo } from 'src/app/domains/page-info.model';

@Component({
  standalone: true,
  imports: [PaginacionComponent],
  template: `
    <frc-paginacion [pagina]="pagina()" [page]="page()" (cambiar)="pagina.set($event)" />
  `,
})
class Anfitrion {
  readonly pagina = signal(0);
  readonly page = signal<PageInfo<unknown> | null>({
    getTotalPages: 3,
    getTotalElements: 47,
  });
}

describe('PaginacionComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Anfitrion>>;
  const botones = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
  const estado = () =>
    (fixture.nativeElement as HTMLElement).querySelector('.estado')?.textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
  });

  it('muestra la página en base 1 para el usuario', () => {
    expect(estado()).toContain('1 / 3');
    expect(estado()).toContain('47');
  });

  it('deshabilita anterior en la primera página', () => {
    expect((botones()[0] as HTMLButtonElement).disabled).toBe(true);
    expect((botones()[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('deshabilita siguiente en la última', () => {
    fixture.componentInstance.pagina.set(2);
    fixture.detectChanges();
    expect((botones()[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('avanza y retrocede', () => {
    (botones()[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.pagina()).toBe(1);

    (botones()[0] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.pagina()).toBe(0);
  });

  it('no se muestra con una sola página', () => {
    fixture.componentInstance.page.set({ getTotalPages: 1, getTotalElements: 4 });
    fixture.detectChanges();
    expect(botones().length).toBe(0);
  });

  it('no se muestra sin datos de página', () => {
    fixture.componentInstance.page.set(null);
    fixture.detectChanges();
    expect(botones().length).toBe(0);
  });
});
