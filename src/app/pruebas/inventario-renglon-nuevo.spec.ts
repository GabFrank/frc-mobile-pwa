import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import {
  FilaConteo,
  InventarioItemCardComponent,
} from 'src/app/pages/inventario/inventario-item-card.component';

const fila = (extra: Partial<FilaConteo> = {}) =>
  ({
    itemId: 500,
    etiqueta: 'COCA COLA 250ML',
    presentacion: 'Cantidad: 1',
    sistema: '10',
    contado: null,
    diferencia: null,
    vencimiento: '',
    lote: null,
    productoConLote: false,
    fechaRetiro: '',
    conocido: null,
    vencido: false,
    ...extra,
  }) as unknown as FilaConteo;

@Component({
  standalone: true,
  imports: [InventarioItemCardComponent],
  template: `
    <frc-inventario-item-card
      [fila]="fila()"
      [abierta]="abierta()"
      [enfocar]="enfocar()"
      (enfocado)="avisos = avisos + 1"
    />
  `,
})
class Anfitrion {
  readonly fila = signal(fila());
  readonly abierta = signal(true);
  readonly enfocar = signal(true);
  avisos = 0;
}

/**
 * El renglón recién agregado nace listo para contar.
 *
 * Antes se elegía la presentación, la lista se recargaba y había que buscar el
 * renglón y tocarlo para cargar la cantidad.
 */
describe('Renglón recién agregado al conteo', () => {
  const montados: HTMLElement[] = [];

  afterEach(() => {
    montados.splice(0).forEach((el) => el.remove());
  });

  const montar = async (ajustar: (a: Anfitrion) => void = () => undefined) => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    const f = TestBed.createComponent(Anfitrion);
    ajustar(f.componentInstance);
    // El foco solo existe en un elemento que está en el documento.
    document.body.appendChild(f.nativeElement);
    montados.push(f.nativeElement);
    f.detectChanges();
    await f.whenStable();
    return f;
  };

  const campo = (f: { nativeElement: HTMLElement }) =>
    f.nativeElement.querySelector<HTMLInputElement>('input.entrada-num')!;

  it('pone el foco en «Contado» y avisa que lo usó', async () => {
    const f = await montar();

    expect(document.activeElement).toBe(campo(f));
    expect(f.componentInstance.avisos).toBe(1);
  });

  it('sin la marca no toca el foco', async () => {
    const f = await montar((a) => a.enfocar.set(false));

    expect(document.activeElement).not.toBe(campo(f));
    expect(f.componentInstance.avisos).toBe(0);
  });

  it('escribir no devuelve el foco: se da una sola vez', async () => {
    // Cada tecla reconstruye la fila; un `effect` volvería a enfocar.
    const f = await montar();
    campo(f).blur();

    f.componentInstance.fila.set(fila({ contado: 7 }));
    f.detectChanges();
    await f.whenStable();

    expect(document.activeElement).not.toBe(campo(f));
    expect(f.componentInstance.avisos).toBe(1);
  });

  it('con el campo bloqueado por lote no enfoca, pero avisa igual', async () => {
    const f = await montar((a) => a.fila.set(fila({ productoConLote: true, lote: null })));

    expect(campo(f).disabled).toBe(true);
    expect(document.activeElement).not.toBe(campo(f));
    expect(f.componentInstance.avisos).toBe(1);
  });

  it('un pesable ya contado no sube el teclado', async () => {
    const f = await montar((a) => a.fila.set(fila({ contado: 1.235 })));

    expect(document.activeElement).not.toBe(campo(f));
    expect(f.componentInstance.avisos).toBe(1);
  });
});
