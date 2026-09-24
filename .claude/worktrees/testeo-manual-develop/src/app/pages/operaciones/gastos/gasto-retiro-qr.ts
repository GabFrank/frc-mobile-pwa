import { descodificarQr } from 'src/app/generic/utils/qrUtils';

/**
 * `tipoEntidad` del QR de retiro.
 *
 * ⚠️ **No está en el enum `TipoEntidad`.** El central lo escribe como cadena
 * literal en `PreGastoService.construirQrRetiro()`, y `frc-mobile` lo compara
 * también como literal. Agregarlo al enum sería inventar un miembro que el
 * backend no conoce; se declara acá, en el único lugar que lo necesita.
 */
export const TIPO_ENTIDAD_RETIRO = 'PRE_GASTO_RETIRO';

export interface DatosQrRetiro {
  /** Id de la solicitud de gasto. */
  preGastoId: number;
  /** Sucursal **de la solicitud**, la que hace falta para encontrarla. */
  sucursalId: number;
  /** Sucursal de la caja que paga. Puede no ser la misma. */
  sucursalCajaId: number | null;
  /** Lo que ata el retiro a esta solicitud puntual. */
  qrToken: string;
}

export type MotivoQrRetiro = 'qr-invalido' | 'no-es-retiro' | 'datos-incompletos';

export interface ResultadoQrRetiro {
  ok: boolean;
  motivo?: MotivoQrRetiro;
  mensaje?: string;
  datos?: DatosQrRetiro;
}

/**
 * Interpreta el QR que imprime el cajero para que el funcionario retire.
 *
 * Formato real, emitido por el central (`PreGastoService.java`):
 *
 * ```
 * frc-{sucursalCajaId}-PRE_GASTO_RETIRO-{preGastoId}-{sucursalId}-{qrToken}-{timestamp}
 * ```
 *
 * ⚠️ **Este QR no sigue la convención de los demás, y ahí estaba el bug.**
 * Tres campos caen en posiciones que su nombre no anticipa:
 *
 * | Campo del decodificador | Qué trae en realidad |
 * |---|---|
 * | `sucursalId` | la sucursal de la **caja**, no la del gasto |
 * | `idCentral` | la sucursal **del gasto** |
 * | `componentToOpen` | el `qrToken` |
 * | `data` | el timestamp |
 *
 * La pantalla leía `sucursalId` y `data` por sus nombres, así que buscaba la
 * solicitud en la sucursal equivocada y mandaba el timestamp como token. Se
 * notaba solo cuando la caja que paga es de otra sucursal que la que pidió el
 * gasto —que es justamente para lo que existe `sucursalCaja`—.
 *
 * Es una función pura, como `interpretarQrVenta`: se prueba sin montar
 * Angular y cada motivo de rechazo tiene su test.
 */
export function interpretarQrRetiro(texto: string): ResultadoQrRetiro {
  const qr = descodificarQr(texto);
  if (!qr) {
    return { ok: false, motivo: 'qr-invalido', mensaje: 'Ese código no es de esta aplicación.' };
  }

  if (qr.tipoEntidad !== TIPO_ENTIDAD_RETIRO) {
    return {
      ok: false,
      motivo: 'no-es-retiro',
      mensaje: 'Ese QR no corresponde a un retiro de caja chica.',
    };
  }

  const preGastoId = aId(qr.idOrigen);
  const sucursalId = aId(qr.idCentral);
  const qrToken = (qr.componentToOpen ?? '').trim();

  if (preGastoId == null || sucursalId == null || !qrToken) {
    return {
      ok: false,
      motivo: 'datos-incompletos',
      mensaje: 'El QR no trae la solicitud, la sucursal o el código de retiro.',
    };
  }

  return {
    ok: true,
    datos: {
      preGastoId,
      sucursalId,
      sucursalCajaId: aId(qr.sucursalId),
      qrToken,
    },
  };
}

/**
 * Id positivo, o `null`.
 *
 * ⚠️ **`Number('')` devuelve `0`, no `NaN`.** Sin esto, un campo vacío pasaba
 * el `Number.isFinite()` y la pantalla salía a buscar la solicitud número
 * cero en la sucursal cero.
 */
function aId(valor: unknown): number | null {
  const texto = String(valor ?? '').trim();
  if (!texto) {
    return null;
  }
  const numero = Number(texto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}
