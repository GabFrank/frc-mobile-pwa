/**
 * El CDC (Código de Control) de una factura electrónica de SIFEN: 44 dígitos.
 *
 * Funciones puras para reconocerlo en lo que devuelve el lector de texto de
 * una foto. La validación de verdad —que exista en SIFEN, que sea nuestra— la
 * sigue haciendo el central; acá se trata de no proponerle al usuario un número
 * mal leído.
 *
 * Estructura (manual técnico de SIFEN):
 *
 * | Pos.  | Largo | Campo                               |
 * |-------|-------|-------------------------------------|
 * | 1     | 2     | Tipo de documento (01 factura, …)   |
 * | 3     | 8     | RUC del emisor                      |
 * | 11    | 1     | DV del RUC                          |
 * | 12    | 3     | Establecimiento                     |
 * | 15    | 3     | Punto de expedición                 |
 * | 18    | 7     | Número de documento                 |
 * | 25    | 1     | Tipo de contribuyente (1 o 2)       |
 * | 26    | 8     | Fecha de emisión AAAAMMDD           |
 * | 34    | 1     | Tipo de emisión (1 o 2)             |
 * | 35    | 9     | Código de seguridad                 |
 * | 44    | 1     | Dígito verificador (módulo 11)      |
 */

export const LARGO_CDC = 44;

/**
 * Dígito verificador módulo 11 de SIFEN, sobre los 43 primeros dígitos.
 *
 * Pesos de 2 a 11 desde la derecha, cíclicos. Resto mayor a 1 → 11 − resto;
 * si no, 0.
 */
export function digitoVerificadorCdc(base: string): number {
  let peso = 2;
  let suma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    suma += Number(base[i]) * peso;
    peso = peso === 11 ? 2 : peso + 1;
  }
  const resto = suma % 11;
  return resto > 1 ? 11 - resto : 0;
}

/**
 * 44 dígitos con el dígito verificador correcto y una estructura posible.
 *
 * El dígito verificador solo deja pasar 1 de cada 11 números al azar. Leyendo
 * una foto entera aparecen muchas tiras de dígitos (códigos de barra, montos),
 * así que además se exige lo que todo CDC cumple: tipo de documento 01–09,
 * tipo de contribuyente y de emisión 1 o 2, y una fecha de emisión que existe.
 */
export function esCdcValido(cdc: string): boolean {
  if (!/^\d{44}$/.test(cdc)) {
    return false;
  }
  if (Number(cdc[43]) !== digitoVerificadorCdc(cdc.slice(0, 43))) {
    return false;
  }
  const tipoDocumento = Number(cdc.slice(0, 2));
  if (tipoDocumento < 1 || tipoDocumento > 9) {
    return false;
  }
  if (!'12'.includes(cdc[24]) || !'12'.includes(cdc[33])) {
    return false;
  }
  const anio = Number(cdc.slice(25, 29));
  const mes = Number(cdc.slice(29, 31));
  const dia = Number(cdc.slice(31, 33));
  const fecha = new Date(anio, mes - 1, dia);
  return (
    anio >= 2018 &&
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia
  );
}

/** El CDC que trae la URL del QR del KuDE (`…/qr?…&Id=<44 dígitos>&…`), si es válido. */
export function cdcDeQrKude(texto: string | null | undefined): string | null {
  const t = (texto ?? '').trim();
  const enUrl = /[?&](?:amp;)?id=(\d{44})(?!\d)/i.exec(t)?.[1];
  const candidato = enUrl ?? t.replace(/\s+/g, '');
  return esCdcValido(candidato) ? candidato : null;
}

/**
 * Letras que el lector suele poner en lugar de un dígito. Solo se corrigen
 * dentro de una palabra que ya es casi toda números (ver {@link cdcsEnTexto}).
 */
const PARECIDOS: Record<string, string> = {
  O: '0', o: '0', D: '0', Q: '0',
  I: '1', i: '1', l: '1', L: '1', '|': '1',
  Z: '2', z: '2',
  S: '5', s: '5',
  G: '6', b: '6',
  T: '7',
  B: '8',
  g: '9', q: '9',
};

/**
 * Los CDC válidos que aparecen en un texto leído de una foto, sin repetir y en
 * el orden en que aparecen.
 *
 * Renglón por renglón (el CDC del KuDE va en uno solo): las palabras que son
 * al menos la mitad dígitos se corrigen con {@link PARECIDOS} y se pegan, porque
 * unos emisores lo imprimen en bloques de 4 y otros todo junto; cualquier otra
 * palabra (`CDC:`) corta la tira. De cada tira de 44 o más dígitos se prueban
 * todas las ventanas de 44.
 */
export function cdcsEnTexto(texto: string | null | undefined): string[] {
  const encontrados: string[] = [];
  for (const renglon of (texto ?? '').split('\n')) {
    const pegado = renglon
      .split(/\s+/)
      .map((palabra) => {
        const digitos = (palabra.match(/\d/g) ?? []).length;
        const casiNumero = palabra.length > 0 && digitos >= Math.max(1, palabra.length / 2);
        return casiNumero ? [...palabra].map((c) => PARECIDOS[c] ?? c).join('') : ' ';
      })
      .join('');
    for (const tira of pegado.match(/\d{44,}/g) ?? []) {
      for (let i = 0; i + LARGO_CDC <= tira.length; i++) {
        const candidato = tira.slice(i, i + LARGO_CDC);
        if (esCdcValido(candidato) && !encontrados.includes(candidato)) {
          encontrados.push(candidato);
        }
      }
    }
  }
  return encontrados;
}

/** ¿Vale la pena releer este renglón solo con dígitos? Menciona el CDC o trae muchos números. */
export function renglonPareceCdc(renglon: string): boolean {
  return /cdc/i.test(renglon) || (renglon.match(/\d/g) ?? []).length >= 30;
}

/** El CDC en bloques de 4, como viene impreso: más fácil de comparar contra el papel. */
export function cdcEnBloques(cdc: string): string {
  return cdc.replace(/(\d{4})(?=\d)/g, '$1 ');
}
