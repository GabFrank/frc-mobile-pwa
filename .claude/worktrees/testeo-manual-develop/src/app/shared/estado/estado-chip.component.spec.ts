import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { EstadoChipComponent } from './estado-chip.component';
import type { TonoEstado } from './estado-registry';

@Component({
  standalone: true,
  imports: [EstadoChipComponent],
  template: `
    <frc-estado-chip
      [enumerado]="enumerado()"
      [valor]="valor()"
      [etiqueta]="etiqueta()"
      [tono]="tono()"
    />
  `,
})
class Anfitrion {
  readonly enumerado = signal<string | null>(null);
  readonly valor = signal<string | null>(null);
  readonly etiqueta = signal<string | null>(null);
  readonly tono = signal<TonoEstado | null>(null);
}

describe('EstadoChipComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Anfitrion>>;
  const chip = () => (fixture.nativeElement as HTMLElement).querySelector('.chip')!;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    fixture = TestBed.createComponent(Anfitrion);
  });

  it('resuelve etiqueta y tono desde el registro central', () => {
    fixture.componentInstance.enumerado.set('EstadoDevolucion');
    fixture.componentInstance.valor.set('ACREDITADO');
    fixture.detectChanges();

    expect(chip().textContent!.trim()).toBe('Acreditado');
    expect(chip().classList.contains('t-ok')).toBe(true);
  });

  it('la etiqueta explícita gana sobre el registro', () => {
    // Es el caso de solicitud-gastos, donde el backend ya calculó cómo se
    // muestra el estado.
    fixture.componentInstance.enumerado.set('EstadoDevolucion');
    fixture.componentInstance.valor.set('ACREDITADO');
    fixture.componentInstance.etiqueta.set('Listo para retirar');
    fixture.componentInstance.tono.set('warn');
    fixture.detectChanges();

    expect(chip().textContent!.trim()).toBe('Listo para retirar');
    expect(chip().classList.contains('t-warn')).toBe(true);
  });

  it('muestra un guion cuando no hay nada que mostrar', () => {
    fixture.detectChanges();
    expect(chip().textContent!.trim()).toBe('—');
    expect(chip().classList.contains('t-neutral')).toBe(true);
  });

  it('no rompe ante un estado que el backend agregó y no está registrado', () => {
    fixture.componentInstance.enumerado.set('EstadoDevolucion');
    fixture.componentInstance.valor.set('NUEVO_ESTADO');
    fixture.detectChanges();

    expect(chip().textContent!.trim()).toBe('Nuevo estado');
    expect(chip().classList.contains('t-neutral')).toBe(true);
  });
});
