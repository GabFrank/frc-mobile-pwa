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
  bg: '#f7f5f4',
  surface: '#ffffff',
  text: '#1c1917',
  textSoft: '#6b6462',
  textMute: '#767068',
};

const OSCURO = {
  brand: '#ff7368',
  brandText: '#ff7368',
  onBrand: '#1c1917',
  ok: '#66bb6a',
  warn: '#ffa726',
  danger: '#ff6f6a',
  info: '#64b5f6',
  neutral: '#a39c99',
  okBg: '#1b2e1d',
  warnBg: '#32261a',
  dangerBg: '#331d1d',
  infoBg: '#1a2836',
  neutralBg: '#332e2b',
  bg: '#16130f',
  surface: '#2a2523',
  text: '#f2ede9',
  textSoft: '#b3aaa5',
  textMute: '#9a918c',
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

  /*
    `--text-mute` no estaba cubierto y daba 3.71:1 en oscuro. No es un token
    decorativo: es el gris de las etiquetas de la barra inferior, de las
    notas y de los textos de ayuda. Se descubrió mirando la app en un
    teléfono real, no acá — que es exactamente lo que este test evita que
    vuelva a pasar.
  */
  it('el texto terciario sobre la superficie', () => {
    expect(contraste(t.textMute, t.surface)).toBeGreaterThanOrEqual(AA);
    expect(contraste(t.textMute, t.bg)).toBeGreaterThanOrEqual(AA);
  });

  it('el fondo tintado del chip neutral no se confunde con la superficie', () => {
    expect(t.neutralBg).not.toBe(t.surface);
  });

  it('el contenido sobre el relleno de marca', () => {
    expect(contraste(t.onBrand, t.brand)).toBeGreaterThanOrEqual(AA);
  });

  /*
    `matButton="tonal"` pinta con `--danger-bg` de fondo y `--brand-text` de
    etiqueta —el mismo par que `primary-container`—. No estaba cubierto
    porque hasta ahora el puente de tokens no reasignaba
    `--mat-sys-secondary-container`, así que Material generaba su propio
    par ajeno a la marca.
  */
  it('el texto de marca sobre el relleno tonal del botón secundario', () => {
    expect(contraste(t.brandText, t.dangerBg)).toBeGreaterThanOrEqual(AA);
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
});

/*
  Los RELLENOS son los mismos en los dos temas y siempre llevan etiqueta
  blanca: un botón rojo se ve igual en claro y en oscuro.

  Es una decisión, no una casualidad. El valor de un tono como relleno no
  puede ser el mismo que como texto: el de texto tiene que resaltar contra
  la superficie, y en oscuro eso lo obliga a ser claro —blanco encima daría
  1.94:1 en `--warn`—. La alternativa era relleno claro con texto oscuro:
  da los números, pero se lee como un botón desteñido.
*/
const RELLENOS = {
  brand: '#db392e',
  ok: '#2a7030',
  warn: '#b34d00',
  danger: '#c62828',
  info: '#1565c0',
  neutral: '#6b6462',
};
const BLANCO = '#ffffff';

describe('Contraste — rellenos', () => {
  it.each(Object.entries(RELLENOS))('la etiqueta blanca sobre el relleno %s', (_n, relleno) => {
    expect(contraste(BLANCO, relleno)).toBeGreaterThanOrEqual(AA);
  });
});

/*
  Separación entre la card y el fondo. Es un mínimo perceptual, no WCAG, y
  aplica SOLO al tema oscuro: la elevación la damos con una sombra, y una
  sombra sobre casi-negro no se ve. Si además la superficie no se distingue
  del fondo, la pantalla entera se lee como una sola plancha —que fue
  justamente el reporte: "parece que el brillo está bajo"—.

  En tema claro no corresponde exigirlo: la sombra y el borde sí se ven, y
  las referencias van de 1.06x (GitHub) a 1.10x (Material). Nuestro tema
  claro está en 1.09x y no tiene el problema.
*/
describe('Separación de superficies — solo tema oscuro', () => {
  it('la card se despega del fondo', () => {
    expect(contraste(OSCURO.surface, OSCURO.bg)).toBeGreaterThanOrEqual(1.15);
  });
});
