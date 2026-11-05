import { describe, expect, it } from 'vitest';

import {
  cdcDeQrKude,
  cdcEnBloques,
  cdcsEnTexto,
  digitoVerificadorCdc,
  esCdcValido,
  renglonPareceCdc,
} from './cdc';

// CDC reales de facturas de proveedores (fotos del grupo de compras).
const MARVI = '01800625072001001006749522026100813312781711';
const BOB = '01800534069001001005535722026102010693838310';
const CAMPOS = '01800521480001001034685022026101711190967160';

describe('digitoVerificadorCdc', () => {
  it('coincide con el último dígito de CDC reales', () => {
    for (const cdc of [MARVI, BOB, CAMPOS]) {
      expect(digitoVerificadorCdc(cdc.slice(0, 43))).toBe(Number(cdc[43]));
    }
  });
});

describe('esCdcValido', () => {
  it('acepta CDC reales', () => {
    expect(esCdcValido(MARVI)).toBe(true);
    expect(esCdcValido(CAMPOS)).toBe(true);
  });

  it('rechaza un dígito mal leído', () => {
    const malLeido = BOB.slice(0, 36) + '5' + BOB.slice(37); // 9383 → 5383
    expect(esCdcValido(malLeido)).toBe(false);
  });

  it('rechaza largos distintos de 44 y caracteres que no son dígitos', () => {
    expect(esCdcValido(MARVI.slice(1))).toBe(false);
    expect(esCdcValido(MARVI + '0')).toBe(false);
    expect(esCdcValido(MARVI.replace('8', 'B'))).toBe(false);
  });

  it('rechaza una estructura imposible aunque el dígito verificador cierre', () => {
    // Tipo de contribuyente 3 (posición 25), con el DV recalculado.
    const base = MARVI.slice(0, 24) + '3' + MARVI.slice(25, 43);
    expect(esCdcValido(base + digitoVerificadorCdc(base))).toBe(false);
  });

  it('rechaza una fecha de emisión que no existe', () => {
    // 2026-02-30
    const base = MARVI.slice(0, 25) + '20260230' + MARVI.slice(33, 43);
    expect(esCdcValido(base + digitoVerificadorCdc(base))).toBe(false);
  });
});

describe('cdcDeQrKude', () => {
  it('saca el CDC de la URL del QR', () => {
    const url = `https://ekuatia.set.gov.py/consultas/qr?nVersion=150&Id=${BOB}&dFeEmiDE=3230`;
    expect(cdcDeQrKude(url)).toBe(BOB);
  });

  it('acepta el &amp; como sale del XML', () => {
    expect(cdcDeQrKude(`https://ekuatia.set.gov.py/consultas/qr?nVersion=150&amp;Id=${BOB}`)).toBe(BOB);
  });

  it('un QR que no es de un KuDE no da CDC', () => {
    expect(cdcDeQrKude('https://ejemplo.com/?id=123')).toBeNull();
    expect(cdcDeQrKude('7790040145023')).toBeNull();
  });
});

describe('cdcsEnTexto', () => {
  it('lee el CDC en bloques de 4 con la etiqueta delante', () => {
    expect(cdcsEnTexto(`ERE CDC: ${cdcEnBloques(MARVI)}\nESTE DOCUMENTO`)).toEqual([MARVI]);
  });

  it('lee el CDC impreso todo junto', () => {
    expect(cdcsEnTexto(`CDC ${CAMPOS}`)).toEqual([CAMPOS]);
  });

  it('corrige letras parecidas dentro de un bloque de números', () => {
    const conLetras = cdcEnBloques(MARVI).replace('0180', 'O18O').replace('1711', 'l7l1');
    expect(cdcsEnTexto(`CDC: ${conLetras}`)).toEqual([MARVI]);
  });

  it('una letra mal corregida no inventa un CDC: el dígito verificador lo descarta', () => {
    // El lector puso S donde había un 9: S se corrige a 5 y el número no cierra.
    const malLeido = cdcEnBloques(BOB).replace('9383', 'S383');
    expect(cdcsEnTexto(`CDC: ${malLeido}`)).toEqual([]);
  });

  it('ignora tiras de números que no son un CDC', () => {
    const tabla = '3031121 7841503031121 30 MAZZEI CRACKERS 5.218 0,00 156.540\n7898142866782 - UME: C';
    expect(cdcsEnTexto(tabla)).toEqual([]);
  });

  it('encuentra el CDC dentro de una tira más larga', () => {
    expect(cdcsEnTexto(`99${MARVI}12`)).toEqual([MARVI]);
  });

  it('sin texto, nada', () => {
    expect(cdcsEnTexto('')).toEqual([]);
    expect(cdcsEnTexto(null)).toEqual([]);
  });
});

describe('renglonPareceCdc', () => {
  it('el renglón con la etiqueta o con muchos dígitos', () => {
    expect(renglonPareceCdc('CDC: 0180 0534 069')).toBe(true);
    expect(renglonPareceCdc(CAMPOS)).toBe(true);
    expect(renglonPareceCdc('BOB SUPREME ESTUCHE 6X18G (12)')).toBe(false);
  });
});

describe('cdcEnBloques', () => {
  it('agrupa de a 4', () => {
    expect(cdcEnBloques(MARVI)).toBe('0180 0625 0720 0100 1006 7495 2202 6100 8133 1278 1711');
  });
});
