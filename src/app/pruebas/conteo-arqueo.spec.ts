import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Moneda } from '../domains/moneda/moneda.model';
import { MonedaBillete } from '../domains/moneda/moneda-billetes/moneda-billetes.model';
import { ConteoFormComponent } from '../pages/operaciones/caja/conteo-form.component';

/** Denominación mínima para armar una moneda de prueba. */
const billete = (id: number, valor: number, extra: Partial<MonedaBillete> = {}): MonedaBillete =>
  Object.assign(new MonedaBillete(), { id, valor, activo: true, papel: true, ...extra });

const guarani = (billetes: MonedaBillete[]): Moneda =>
  Object.assign(new Moneda(), {
    id: 1,
    denominacion: 'GUARANI',
    simbolo: '₲',
    monedaBilleteList: billetes,
  });

describe('Arqueo de caja', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ConteoFormComponent>>;
  let form: ConteoFormComponent;

  /** Simula lo que escribe el cajero en la fila de una denominación. */
  const escribir = (b: MonedaBillete, texto: string) => {
    const input = document.createElement('input');
    input.value = texto;
    form.contar(b, { target: input } as unknown as Event);
  };

  const armar = (monedas: Moneda[]) => {
    fixture = TestBed.createComponent(ConteoFormComponent);
    fixture.componentRef.setInput('monedas', monedas);
    fixture.detectChanges();
    form = fixture.componentInstance;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('suma cantidad por valor de cada denominación', () => {
    const b50 = billete(1, 50_000);
    const b10 = billete(2, 10_000);
    armar([guarani([b50, b10])]);

    escribir(b50, '3');
    escribir(b10, '4');

    expect(form.totalGs()).toBe(190_000);
  });

  /*
    El repo anterior indexaba el formulario por VALOR de la denominación.
    Dos denominaciones del mismo importe —un billete y una moneda de 1.000,
    o un billete reemitido— colisionaban en la misma clave: lo que se
    contaba en una se perdía o se duplicaba en la otra.
  */
  it('distingue dos denominaciones del mismo valor', () => {
    const papel = billete(1, 1000, { papel: true });
    const metal = billete(2, 1000, { papel: false });
    armar([guarani([papel, metal])]);

    escribir(papel, '2');
    escribir(metal, '5');

    expect(form.totalGs()).toBe(7000);
    expect(form.armar().conteoMonedaList).toHaveLength(2);
  });

  it('marca la moneda metálica para poder diferenciarla en pantalla', () => {
    const metal = billete(2, 1000, { papel: false });
    const m = guarani([metal]);
    armar([m]);

    expect(form.etiqueta(metal, m)).toContain('moneda');
  });

  /*
    El teclado numérico del teléfono deja escribir `-` y `.`. Una cantidad
    negativa restaría del arqueo sin que se note en el total, y media unidad
    de un billete no existe.
  */
  it('ignora cantidades negativas', () => {
    const b = billete(1, 50_000);
    armar([guarani([b])]);

    escribir(b, '-2');

    expect(form.totalGs()).toBe(0);
    expect(form.armar().conteoMonedaList).toHaveLength(0);
  });

  it('trunca cantidades fraccionarias', () => {
    const b = billete(1, 10_000);
    armar([guarani([b])]);

    escribir(b, '2.7');

    expect(form.totalGs()).toBe(20_000);
  });

  it('no manda al servidor las denominaciones en cero', () => {
    const b50 = billete(1, 50_000);
    const b10 = billete(2, 10_000);
    armar([guarani([b50, b10])]);

    escribir(b50, '1');

    const lista = form.armar().conteoMonedaList ?? [];
    expect(lista).toHaveLength(1);
    expect(lista[0]!.monedaBilletes?.id).toBe(1);
  });

  it('vuelve a cero cuando se borra la cantidad', () => {
    const b = billete(1, 50_000);
    armar([guarani([b])]);

    escribir(b, '3');
    escribir(b, '');

    expect(form.totalGs()).toBe(0);
    expect(form.vacio()).toBe(true);
  });

  /*
    Las denominaciones salen del backend. El repo anterior las tenía escritas
    a mano, así que una denominación nueva en la base no aparecía en el
    arqueo y su efectivo no se contaba, sin ningún aviso.
  */
  it('toma las denominaciones que manda el servidor, incluida una desconocida', () => {
    const nueva = billete(9, 200_000);
    armar([guarani([billete(1, 50_000), nueva])]);

    escribir(nueva, '1');

    expect(form.totalGs()).toBe(200_000);
  });

  it('descarta las denominaciones dadas de baja', () => {
    const vigente = billete(1, 50_000);
    const dadaDeBaja = billete(2, 5000, { activo: false });
    const m = guarani([vigente, dadaDeBaja]);
    armar([m]);

    expect(form.denominacionesDe(m)).toEqual([vigente]);
  });

  it('ordena las denominaciones de menor a mayor', () => {
    const m = guarani([billete(1, 50_000), billete(2, 1000), billete(3, 10_000)]);
    armar([m]);

    expect(form.denominacionesDe(m).map((b) => b.valor)).toEqual([1000, 10_000, 50_000]);
  });

  it('lleva el total de cada moneda a su campo del conteo', () => {
    const gs = billete(1, 50_000);
    const rs = billete(2, 100);
    armar([
      guarani([gs]),
      Object.assign(new Moneda(), {
        id: 2,
        denominacion: 'REAL',
        simbolo: 'R$',
        monedaBilleteList: [rs],
      }),
    ]);

    escribir(gs, '2');
    escribir(rs, '3');

    const conteo = form.armar();
    expect(conteo.totalGs).toBe(100_000);
    expect(conteo.totalRs).toBe(300);
    expect(conteo.totalDs).toBe(0);
  });

  it('solo muestra el esperado cuando se lo pasan — el cierre, no la apertura', () => {
    const m = guarani([billete(1, 50_000)]);
    armar([m]);

    expect(form.esperadoDe(m)).toBeNull();

    fixture.componentRef.setInput('esperado', { gs: 500_000 });
    fixture.detectChanges();

    expect(form.esperadoDe(m)).toBe(500_000);
  });
});

describe('Arqueo — monedas dinámicas', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  const crear = (monedas: Moneda[]) => {
    const f = TestBed.createComponent(ConteoFormComponent);
    f.componentRef.setInput('monedas', monedas);
    f.detectChanges();
    return f;
  };

  it('crea un tab por cada moneda que manda el servidor', () => {
    const f = crear([
      guarani([billete(1, 50_000)]),
      Object.assign(new Moneda(), { id: 2, denominacion: 'REAL', simbolo: 'R$' }),
      Object.assign(new Moneda(), { id: 3, denominacion: 'DOLAR', simbolo: 'US$' }),
    ]);

    const tabs = f.nativeElement.querySelectorAll('.mat-mdc-tab');
    expect(tabs.length).toBe(3);
  });

  it('no asume tres monedas: con una sola muestra un solo tab', () => {
    const f = crear([guarani([billete(1, 50_000)])]);

    expect(f.nativeElement.querySelectorAll('.mat-mdc-tab').length).toBe(1);
  });

  /*
    Los tabs se generan de los datos, pero `Conteo` tiene exactamente tres
    campos de total. Una moneda fuera de ese contrato se contaría en pantalla
    y se perdería al guardar, así que la pantalla lo dice.
  */
  it('avisa cuando el servidor no tiene dónde guardar el arqueo de una moneda', () => {
    const f = crear([
      Object.assign(new Moneda(), {
        id: 7,
        denominacion: 'EURO',
        simbolo: '€',
        monedaBilleteList: [billete(1, 50)],
      }),
    ]);

    expect(f.componentInstance.campoDe(f.componentInstance.monedas()[0]!)).toBeUndefined();
    expect(f.nativeElement.textContent).toContain('no tiene dónde guardar');
  });

  it('suma dos monedas que comparten campo de total', () => {
    // Caso defensivo: si el servidor devolviera dos registros GUARANI, el
    // total no puede quedarse con el de una sola.
    const f = crear([guarani([billete(1, 50_000)]), guarani([billete(2, 10_000)])]);
    const form = f.componentInstance;
    const escribirEn = (b: MonedaBillete, texto: string) => {
      const input = document.createElement('input');
      input.value = texto;
      form.contar(b, { target: input } as unknown as Event);
    };

    escribirEn(form.monedas()[0]!.monedaBilleteList![0]!, '1');
    escribirEn(form.monedas()[1]!.monedaBilleteList![0]!, '2');

    expect(form.totalGs()).toBe(70_000);
  });
});
