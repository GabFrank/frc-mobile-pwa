import { fotoALienzo } from 'src/app/core/dispositivo/imagen';
import { conLectorDeTexto } from 'src/app/core/dispositivo/lector-texto';
import { leerQrDeImagen } from 'src/app/core/dispositivo/qr-de-imagen';
import type { LecturaDeFoto } from 'src/app/core/dispositivo/escaner.types';
import { cdcDeQrKude, cdcEnBloques, cdcsEnTexto, renglonPareceCdc } from './cdc';

/**
 * Lado mayor de la foto para leerla. Una foto de cámara de 4000 px no lee
 * mejor el CDC que una de 2000 y tarda varias veces más; las del WhatsApp ya
 * vienen de ~1600.
 */
const LADO_MAXIMO = 2000;

/**
 * Busca el CDC de una factura electrónica en una foto del KuDE.
 *
 * Pensado para las fotos que se sacan apuradas y se mandan al grupo: torcidas,
 * con sombra, a veces sin el QR entero. Tres intentos, del más barato al más caro:
 *
 * 1. **El QR, en la foto completa.** Tiene más resolución que la cámara en vivo.
 * 2. **El texto de toda la hoja.** Los emisores imprimen el CDC en bloques de
 *    4 o todo junto, grande o en letra de matriz: se buscan 44 dígitos seguidos.
 * 3. **El renglón del CDC releído solo con dígitos**, recortado y agrandado,
 *    para cuando en el paso 2 un número salió como letra.
 *
 * Solo se acepta un CDC con el dígito verificador y la estructura correctos
 * ({@link esCdcValido}), y el usuario igual lo ve antes de confirmar.
 * Devuelve los 44 dígitos o `null`.
 */
export async function leerCdcDeFoto(archivo: File): Promise<string | null> {
  const lienzo = await fotoALienzo(archivo, LADO_MAXIMO);

  const desdeQr = cdcDeQrKude(await leerQrDeImagen(lienzo));
  if (desdeQr) {
    return desdeQr;
  }

  return conLectorDeTexto(async (lector) => {
    const lectura = await lector.leer(lienzo);
    const [enLaHoja] = cdcsEnTexto(lectura.texto);
    if (enLaHoja) {
      return enLaHoja;
    }
    for (const renglon of lectura.renglones.filter((r) => renglonPareceCdc(r.texto))) {
      const [releido] = cdcsEnTexto(await lector.releerRenglon(lienzo, renglon, '0123456789'));
      if (releido) {
        return releido;
      }
    }
    return null;
  });
}

/** El botón «Leer CDC de una foto» de los escáneres de factura. */
export const LEER_CDC_DE_FOTO: LecturaDeFoto = {
  etiqueta: 'Leer el CDC de una foto',
  // En bloques de 4, como en el papel, para que el usuario lo compare. El
  // central y `esKude` ignoran los espacios.
  leer: async (archivo) => {
    const cdc = await leerCdcDeFoto(archivo);
    return cdc ? cdcEnBloques(cdc) : null;
  },
};
