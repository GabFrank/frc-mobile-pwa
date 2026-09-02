import { TipoEntidad } from 'src/app/domains/enums/tipo-entidad.enum';
import { descodificarQr, QrData } from 'src/app/generic/utils/qrUtils';
import {
  interpretarQrRetiro,
  TIPO_ENTIDAD_RETIRO,
} from 'src/app/pages/operaciones/gastos/gasto-retiro-qr';

/**
 * Qué hacer con lo que se acaba de leer.
 *
 * `navegar` es el caso normal. `producto` no es una ruta porque el código de
 * barras todavía hay que resolverlo contra el servidor: quien lo reciba
 * decide si abre el buscador o lo usa en su propio flujo.
 */
export type DestinoEscaneo =
  | { clase: 'navegar'; ruta: readonly unknown[]; queryParams?: Record<string, string> }
  | { clase: 'producto'; codigo: string }
  | { clase: 'desconocido'; mensaje: string };

/** `tipoEntidad` del QR de venta con tarjeta. Ver `venta-tarjeta-qr.ts`. */
const TIPO_ENTIDAD_VENTA_TARJETA = 'VT';

/**
 * Adónde lleva cada QR del sistema.
 *
 * ⚠️ **El id no está en el mismo campo para todos.** No es un descuido de
 * esta tabla: cada pantalla de `frc-mobile` que genera un QR eligió su
 * posición por su cuenta, y los QR ya impresos —los pegados en los carteles
 * de depósito, los de las planillas de inventario— no se pueden reemitir.
 * Verificado contra los generadores, uno por uno:
 *
 * | Tipo | Generador | Campo con el id |
 * |---|---|---|
 * | `TRF` | `info-transferencia.component.ts:745` | `idOrigen` (y `idCentral` con el mismo valor) |
 * | `INV` | `edit-inventario.component.ts:530` | `idCentral` — **no escribe `idOrigen`** |
 * | `REC_MERC` | `historico-nota-recepcion.component.ts:77` | `idCentral` (y `idOrigen` igual) |
 * | `PRE_GASTO_RETIRO` | `PreGastoService.java:500`, en el **central** | `idOrigen`, con la sucursal en `idCentral` |
 *
 * Por eso cada entrada declara de dónde saca su id en vez de que la tabla
 * asuma uno solo. Escribir `idCentral ?? idOrigen` funcionaría hoy de
 * casualidad y rompería con el primer tipo nuevo que no siga esa forma.
 */
interface Regla {
  /** Base de la ruta; se le agrega el id resuelto. */
  base: readonly string[];
  /** De qué campo del QR sale el id del registro. */
  id: (qr: QrData) => unknown;
  /** Qué decir si el QR es del tipo correcto pero le falta el id. */
  faltaId: string;
}

const REGLAS: Readonly<Record<string, Regla>> = {
  [TipoEntidad.TRANSFERENCIA]: {
    base: ['/transferencias'],
    id: (qr) => qr.idOrigen ?? qr.idCentral,
    faltaId: 'El QR no trae la transferencia.',
  },
  [TipoEntidad.INVENTARIO]: {
    base: ['/inventario'],
    id: (qr) => qr.idCentral,
    faltaId: 'El QR no trae el inventario.',
  },
  [TipoEntidad.RECEPCION_MERCADERIA]: {
    base: ['/operaciones/recepcion'],
    id: (qr) => qr.idCentral ?? qr.idOrigen,
    faltaId: 'El QR no trae la recepción.',
  },
  [TipoEntidad.SOLICITUD_PAGO]: {
    base: ['/operaciones/solicitud-pago'],
    id: (qr) => qr.idOrigen ?? qr.idCentral,
    faltaId: 'El QR no trae la solicitud de pago.',
  },
};

/**
 * Id de registro utilizable, o `null`.
 *
 * ⚠️ **`Number('')` es `0`, no `NaN`.** Es la trampa que hace falta cubrir
 * acá: `edit-inventario` no escribe `idOrigen`, así que ese campo llega vacío
 * en los QR de inventario. Con un `Number.isFinite()` a secas, un QR sin id
 * navegaba a `/inventario/0` —una pantalla de detalle pidiendo el registro
 * cero— en vez de avisar que el QR está incompleto. Lo encontró un test.
 */
function idDeRegistro(valor: unknown): number | null {
  const texto = String(valor ?? '').trim();
  if (!texto) {
    return null;
  }
  const numero = Number(texto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

/**
 * Decide adónde va lo que se leyó, sin tocar el router ni el servidor.
 *
 * Es una función pura para poder probar la tabla entera sin montar Angular:
 * es justamente la parte donde un campo mal leído manda al usuario a otro
 * registro, y eso no se ve mirando el código.
 *
 * El orden importa. Primero se intenta leer como QR del sistema; recién si
 * no lo es se lo trata como código de barras de producto. Al revés, un QR
 * interno terminaría buscándose como si fuera un EAN.
 */
export function rutearEscaneo(texto: string): DestinoEscaneo {
  const codigo = texto.trim();
  if (!codigo) {
    return { clase: 'desconocido', mensaje: 'No se leyó ningún código.' };
  }

  const qr = descodificarQr(codigo);
  if (!qr) {
    // No es un QR del sistema. Puede ser el código de barras de un producto,
    // que es lo más frecuente: se devuelve para que lo resuelva quien sepa.
    return { clase: 'producto', codigo };
  }

  const regla = REGLAS[qr.tipoEntidad ?? ''];
  if (regla) {
    const id = idDeRegistro(regla.id(qr));
    if (id == null) {
      return { clase: 'desconocido', mensaje: regla.faltaId };
    }
    return { clase: 'navegar', ruta: [...regla.base, id] };
  }

  // Los tres que siguen no entran en la tabla porque no navegan a un id: la
  // pantalla de destino necesita el QR entero para validarlo y actuar.

  if (qr.tipoEntidad === TIPO_ENTIDAD_RETIRO) {
    // Este sí resuelve a un id, pero sus campos no caen donde el nombre
    // sugiere, así que lo interpreta su función dedicada en vez de leerlo
    // acá a mano. El token viaja aparte: es lo que autoriza el retiro.
    const retiro = interpretarQrRetiro(codigo);
    if (!retiro.ok || !retiro.datos) {
      return { clase: 'desconocido', mensaje: retiro.mensaje ?? 'QR de retiro no válido.' };
    }
    return {
      clase: 'navegar',
      ruta: ['/operaciones/gastos', retiro.datos.preGastoId, retiro.datos.sucursalId],
      queryParams: { token: retiro.datos.qrToken },
    };
  }

  if (qr.tipoEntidad === TIPO_ENTIDAD_VENTA_TARJETA) {
    // Solo el cajero de turno puede registrar el cupón, y eso se valida
    // contra la caja abierta: la comprobación vive en la pantalla.
    return {
      clase: 'navegar',
      ruta: ['/operaciones/venta-tarjeta'],
      queryParams: { qr: codigo },
    };
  }

  if (qr.tipoEntidad === TipoEntidad.VENTA_CREDITO) {
    // La autorización se hace contra la persona en sesión y una clave de un
    // solo uso. Ver `mis-finanzas.page.ts`.
    return {
      clase: 'navegar',
      ruta: ['/mis-finanzas'],
      queryParams: { qr: codigo },
    };
  }

  if (qr.tipoEntidad === TipoEntidad.SUCURSAL) {
    // El QR del cartel del depósito identifica una sucursal, pero por sí solo
    // no dice qué hacer con ella: sirve dentro de una recepción o de un
    // inventario, no como destino.
    return {
      clase: 'desconocido',
      mensaje: 'Ese QR identifica una sucursal. Escanealo desde la pantalla donde la necesitás.',
    };
  }

  return { clase: 'desconocido', mensaje: 'Ese QR no abre ninguna pantalla de la app.' };
}

/**
 * El camino inverso: de un QR del sistema a un enlace que abre esa pantalla.
 *
 * Sirve para mandar un registro por WhatsApp. **Un enlace le gana al QR
 * cuando el otro no está enfrente**: lo toca y la app se le abre en la
 * transferencia, sin cámara de por medio. El QR sigue siendo lo que sirve
 * cuando están los dos con el teléfono en la mano.
 *
 * Sale de `rutearEscaneo` a propósito, y no de una tabla propia: es la misma
 * ruta a la que llega quien lo escanea. Si mañana cambia dónde vive el
 * detalle de transferencias, el enlace cambia con ella.
 *
 * ⚠️ **Los QR con `queryParams` no dan enlace.** Ahí viaja el token que
 * autoriza un retiro de caja chica: en un mensaje de WhatsApp queda escrito
 * para siempre, y quien lea la conversación puede usarlo. Devuelve `null` y
 * el que comparte manda solo el código.
 */
export function enlaceAlRegistro(texto: string): string | null {
  const destino = rutearEscaneo(texto);
  if (destino.clase !== 'navegar' || destino.queryParams) {
    return null;
  }
  const ruta = destino.ruta.map(String).join('/').replace(/^\/+/, '');
  try {
    return new URL(ruta, document.baseURI).href;
  } catch {
    return null;
  }
}
