import type { ArchivoCompartible } from 'src/app/core/dispositivo/compartir.service';

/**
 * El QR como imagen para mandar por WhatsApp.
 *
 * No se reusa el canvas que se ve en pantalla: ese mide 240 px porque es lo
 * que entra en el diálogo, y una foto de 240 px que WhatsApp recomprime se
 * lee mal. Acá se redibuja el mismo código en grande y se le agrega el
 * rótulo, para que del otro lado se sepa qué es antes de escanearlo.
 *
 * ⚠️ **La imagen exportada no tiene tema.** Sale del teléfono y se ve en
 * cualquier lado, así que el fondo es blanco y el texto oscuro siempre. Estos
 * son los únicos valores literales del módulo y no pueden salir de
 * `_tokens.scss`: no hay CSS acá, es un mapa de píxeles.
 */
const LADO_QR = 512;
const MARGEN = 48;
const ALTO_ROTULO = 96;
const FONDO = '#ffffff';
const TINTA = '#111111';

/**
 * Dibuja el QR en grande, con su rótulo debajo, y lo devuelve como PNG.
 *
 * Devuelve `null` si el navegador no da un contexto 2D o no sabe exportar el
 * canvas. El llamador sigue pudiendo compartir el texto.
 *
 * ⚠️ **`qrcode` sale de `default`, no de un export con nombre.** Es CommonJS:
 * `const { toCanvas } = await import('qrcode')` compila, typechequea y vale
 * `undefined` en el build de producción. Ver el comentario largo de
 * `QrDialogComponent`.
 */
export async function componerImagenQr(codigo: string, rotulo: string): Promise<Blob | null> {
  const { default: QRCode } = await import('qrcode');

  const soloQr = document.createElement('canvas');
  await QRCode.toCanvas(soloQr, codigo, {
    width: LADO_QR,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const lienzo = document.createElement('canvas');
  lienzo.width = LADO_QR + MARGEN * 2;
  lienzo.height = LADO_QR + MARGEN * 2 + (rotulo ? ALTO_ROTULO : 0);

  const pincel = lienzo.getContext('2d');
  if (!pincel) {
    return null;
  }

  pincel.fillStyle = FONDO;
  pincel.fillRect(0, 0, lienzo.width, lienzo.height);
  pincel.drawImage(soloQr, MARGEN, MARGEN);

  if (rotulo) {
    pincel.fillStyle = TINTA;
    pincel.font = '600 34px system-ui, -apple-system, sans-serif';
    pincel.textAlign = 'center';
    // El ancho máximo hace que un rótulo largo se condense en vez de salirse
    // del papel; `fillText` no corta ni pone puntos suspensivos.
    pincel.fillText(rotulo, lienzo.width / 2, LADO_QR + MARGEN + 56, LADO_QR);
  }

  return await new Promise<Blob | null>((resolver) => {
    if (typeof lienzo.toBlob !== 'function') {
      resolver(null);
      return;
    }
    lienzo.toBlob((blob) => resolver(blob), 'image/png');
  });
}

/**
 * Nombre del archivo. Sin esto WhatsApp muestra «image.png» y en la galería
 * del que recibe quedan cinco QR indistinguibles.
 */
export function nombreImagenQr(rotulo: string): string {
  const base = rotulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'qr'}.png`;
}

/**
 * El mensaje que acompaña al QR.
 *
 * Tres capas, de la más cómoda a la que siempre funciona:
 *
 * 1. **El enlace al registro.** Es lo que el otro toca. Le abre la app
 *    directo en la transferencia, sin cámara y sin escanear nada — y es lo
 *    único que sirve cuando el mensaje se lee desde la computadora.
 * 2. **El QR**, cuando viajó como imagen adjunta.
 * 3. **El código en texto**, para pegarlo en la carga manual del escáner:
 *    la salida para la pantalla rota o la cámara sin permiso.
 *
 * ⚠️ **El enlace sale del origen desde el que se comparte.** Compartiendo
 * desde `localhost:4300` el otro recibe un `localhost` que no le abre nada.
 * No es un bug del mensaje: es que en desarrollo no hay ninguna URL pública
 * que ofrecer.
 */
export function textoParaCompartir(rotulo: string, codigo: string, enlace?: string | null): string {
  const partes = [];
  if (rotulo) {
    partes.push(rotulo);
  }
  if (enlace) {
    partes.push(enlace, '');
    partes.push(`Tocá el enlace para abrirlo en la app. Si no, pegá este código en la carga manual del escáner:\n${codigo}`);
  } else {
    partes.push('', `Escaneá el QR con el botón de la app, o pegá este código en la carga manual:\n${codigo}`);
  }
  return partes.join('\n');
}

/** Todo lo que hace falta para adjuntar el QR, o `null` si no se pudo dibujar. */
export async function archivoQr(codigo: string, rotulo: string): Promise<ArchivoCompartible | null> {
  const blob = await componerImagenQr(codigo, rotulo);
  return blob ? { blob, nombre: nombreImagenQr(rotulo) } : null;
}
