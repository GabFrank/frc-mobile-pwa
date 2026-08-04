import { describe, expect, it } from 'vitest';

/**
 * Contraste de los tokens de color.
 *
 * Existe porque el juicio a ojo falla: en la primera pasada visual creí que
 * el texto sobre el rojo en tema oscuro tenía poco contraste (da 4.83:1, pasa)
 * y no vi que el naranja de advertencia sobre su chip daba 2.75:1 — ilegible.
 *
 * Umbral: WCAG AA para texto normal, 4.5:1.
 */

function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const canales = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lineal = canales.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lineal[0]! + 0.7152 * lineal[1]! + 0.0722 * lineal[2]!;
}

function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const AA = 4.5;

const CLARO = {
  brand: '#db392e',
  brandText: '#c43026',
  onBrand: '#ffffff',
  ok: '#2a7030',
  warn: '#b34d00',
  danger: '#c62828',
  info: '#1565c0',
  neutral: '#6b6462',
  okBg: '#e8f3e9',
  warnBg: '#fdf0e3',
  dangerBg: '#fbeaea',
  infoBg: '#e8eff8',
  neutralBg: '#f0eeed',
  onTono: '#ffffff',
  bg: '#f7f5f4',
  surface: '#ffffff',
  text: '#1c1917',
  textSoft: '#6b6462',
};

const OSCURO = {
  brand: '#e8544a',
  brandText: '#e8544a',
  onBrand: '#1c1917',
  ok: '#66bb6a',
  warn: '#ffa726',
  danger: '#ef5350',
  info: '#64b5f6',
  neutral: '#a39c99',
  okBg: '#1b2e1d',
  warnBg: '#32261a',
  dangerBg: '#331d1d',
  infoBg: '#1a2836',
  neutralBg: '#2a2523',
  onTono: '#1c1917',
  bg: '#16130f',
  surface: '#201c1a',
  text: '#f2ede9',
  textSoft: '#b3aaa5',
};

describe.each([
  ['claro', CLARO],
  ['oscuro', OSCURO],
])('Contraste — tema %s', (_nombre, t) => {
  it('el texto principal sobre la superficie', () => {
    expect(contraste(t.text, t.surface)).toBeGreaterThanOrEqual(AA);
    expect(contraste(t.text, t.bg)).toBeGreaterThanOrEqual(AA);
  });

  it('el texto secundario sobre la superficie', () => {
    expect(contraste(t.textSoft, t.surface)).toBeGreaterThanOrEqual(AA);
  });

  it('el contenido sobre el relleno de marca', () => {
    expect(contraste(t.onBrand, t.brand)).toBeGreaterThanOrEqual(AA);
  });

  it('la marca como color de texto', () => {
    expect(contraste(t.brandText, t.surface)).toBeGreaterThanOrEqual(AA);
    expect(contraste(t.brandText, t.bg)).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ['ok', 'ok', 'okBg'],
    ['warn', 'warn', 'warnBg'],
    ['danger', 'danger', 'dangerBg'],
    ['info', 'info', 'infoBg'],
    ['neutral', 'neutral', 'neutralBg'],
  ] as const)('el chip de %s se lee sobre su fondo tintado', (_n, tono, fondo) => {
    expect(contraste(t[tono], t[fondo])).toBeGreaterThanOrEqual(AA);
  });

  it.each(['ok', 'warn', 'danger', 'info', 'neutral'] as const)(
    'el tono %s se lee como texto sobre la superficie',
    (tono) => {
      expect(contraste(t[tono], t.surface)).toBeGreaterThanOrEqual(AA);
    },
  );

  /*
    Los tonos también se usan como RELLENO —toasts, botón destructivo— y ese
    caso no estaba cubierto. En tema oscuro el texto encima era `#fff` fijo:
    1,94:1 sobre `--warn`. Un aviso de advertencia era prácticamente
    invisible sobre su propio fondo.
  */
  it.each(['ok', 'warn', 'danger', 'info', 'neutral'] as const)(
    'el texto sobre un relleno de %s se lee',
    (tono) => {
      expect(contraste(t.onTono, t[tono])).toBeGreaterThanOrEqual(AA);
    },
  );
});
