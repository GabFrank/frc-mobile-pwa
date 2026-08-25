import { fechaLegible, horaLegible } from 'src/app/generic/utils/dateUtils';
import { Jornada, Marcacion } from './marcacion.model';

/** Un fichaje de la jornada, listo para mostrar. */
export interface HorarioMarcado {
  /** Estable, para `track`. No se muestra. */
  clave: 'entrada' | 'salidaAlmuerzo' | 'entradaAlmuerzo' | 'salida';
  etiqueta: string;
  /** `HH:mm`, con el día entre paréntesis cuando cayó en otro. */
  hora: string;
}

/**
 * El momento en que se hizo una marcación.
 *
 * ⚠️ **Una marcación no tiene un campo «fecha»**: guarda su momento en
 * `fechaEntrada` **o** en `fechaSalida`, según su tipo. Leer solo uno de los
 * dos deja la mitad de los fichajes sin hora, y como el campo existe y llega
 * `undefined`, no hay error que lo delate.
 *
 * `prefiere` dice cuál mirar primero, porque el slot de la jornada ya sabe
 * qué es cada marcación. El otro campo queda como respaldo: es lo que hace
 * el central al imprimir el reporte de marcaciones (`ImpresionService`), y
 * cubre los casos en que una marcación se reprocesó y quedó con el campo
 * cruzado.
 */
export function momentoDeMarcacion(
  marcacion: Marcacion | null | undefined,
  prefiere: 'entrada' | 'salida',
): string | null {
  if (!marcacion) {
    return null;
  }
  const primero = prefiere === 'salida' ? marcacion.fechaSalida : marcacion.fechaEntrada;
  const respaldo = prefiere === 'salida' ? marcacion.fechaEntrada : marcacion.fechaSalida;
  return primero ?? respaldo ?? null;
}

/** Los cuatro slots de una jornada, en el orden en que ocurren. */
const SLOTS: readonly {
  clave: HorarioMarcado['clave'];
  etiqueta: string;
  prefiere: 'entrada' | 'salida';
  de: (j: Jornada) => Marcacion | undefined;
}[] = [
  { clave: 'entrada', etiqueta: 'Entrada', prefiere: 'entrada', de: (j) => j.marcacionEntrada },
  {
    clave: 'salidaAlmuerzo',
    etiqueta: 'Salida a almorzar',
    prefiere: 'salida',
    de: (j) => j.marcacionSalidaAlmuerzo,
  },
  {
    clave: 'entradaAlmuerzo',
    etiqueta: 'Vuelta del almuerzo',
    prefiere: 'entrada',
    de: (j) => j.marcacionEntradaAlmuerzo,
  },
  { clave: 'salida', etiqueta: 'Salida', prefiere: 'salida', de: (j) => j.marcacionSalida },
];

/**
 * Los horarios que la persona marcó ese día, en orden.
 *
 * **Los slots vacíos no se muestran.** Una jornada sin almuerzo no marcó
 * almuerzo, y una todavía abierta no marcó salida: una fila con un guion
 * ocuparía lugar para decir «acá no pasó nada».
 *
 * ⚠️ **Un turno noche cruza la medianoche**, así que la salida puede caer al
 * día siguiente de `jornada.fecha`. En ese caso la hora sola mentiría —una
 * salida a las 06:00 se leería como una salida de madrugada del mismo día—,
 * y por eso se le agrega el día.
 */
export function horariosDeJornada(jornada: Jornada | null | undefined): HorarioMarcado[] {
  if (!jornada) {
    return [];
  }
  const diaDeLaJornada = fechaLegible(jornada.fecha, { conHora: false });

  return SLOTS.flatMap((slot) => {
    const momento = momentoDeMarcacion(slot.de(jornada), slot.prefiere);
    const hora = horaLegible(momento);
    if (hora == null) {
      return [];
    }
    const dia = fechaLegible(momento, { conHora: false });
    const otroDia = diaDeLaJornada != null && dia != null && dia !== diaDeLaJornada;
    return [
      {
        clave: slot.clave,
        etiqueta: slot.etiqueta,
        // Sin el año: dentro de una jornada el salto es de un día, no de uno.
        hora: otroDia ? `${hora} (${dia.slice(0, 5)})` : hora,
      },
    ];
  });
}
