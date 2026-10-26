import { normalizarIdentificador } from 'src/app/domains/devolucion/devolucion-identificador';
import {
  RetiroBloqueResultado,
  RetiroProducto,
  RetiroProveedorConsolidado,
} from 'src/app/domains/devolucion/retiro.model';

/**
 * Reglas del retiro a proveedor, sin Angular.
 *
 * La unidad del retiro es la **devolución**, no el producto: su etiqueta es
 * una sola, con un QR, y escanearla verifica la devolución entera y muestra
 * todos sus productos.
 */

/** Una devolución lista para retirar, como la muestra la pantalla. */
export interface DevolucionParaRetiro {
  devolucionId: number;
  /** `DEV-1-24`, normalizado: es contra lo que se compara lo escaneado. */
  identificador: string;
  sucursal: string;
  productos: RetiroProducto[];
}

/** Aplana los grupos por sucursal en una sola lista de devoluciones. */
export function devolucionesDelConsolidado(
  consolidado: RetiroProveedorConsolidado | null | undefined,
): DevolucionParaRetiro[] {
  const lista: DevolucionParaRetiro[] = [];
  for (const grupo of consolidado?.grupos ?? []) {
    for (const d of grupo.devoluciones ?? []) {
      const id = Number(d.devolucionId);
      if (!Number.isFinite(id)) {
        continue;
      }
      lista.push({
        devolucionId: id,
        identificador: normalizarIdentificador(d.identificador) ?? (d.identificador ?? `#${id}`),
        sucursal: grupo.sucursalNombre ?? '',
        productos: d.productos ?? [],
      });
    }
  }
  return lista;
}

export type ResultadoEscaneo =
  | { clase: 'verificada'; devolucion: DevolucionParaRetiro }
  | { clase: 'repetida'; devolucion: DevolucionParaRetiro }
  | { clase: 'ajena'; mensaje: string };

/** Qué pasa con un código leído durante el retiro. */
export function verificarEscaneo(
  lista: readonly DevolucionParaRetiro[],
  verificadas: ReadonlySet<number>,
  texto: string | null | undefined,
): ResultadoEscaneo {
  const identificador = normalizarIdentificador(texto);
  if (identificador == null) {
    return { clase: 'ajena', mensaje: 'Ese código no es la etiqueta de una devolución.' };
  }
  const devolucion = lista.find((d) => d.identificador === identificador);
  if (!devolucion) {
    return {
      clase: 'ajena',
      // Puede ser de otro proveedor, estar en otra sucursal que la elegida,
      // o no estar separada todavía: la lista solo trae lo que se puede retirar.
      mensaje: `${identificador} no está en este retiro: es de otro proveedor, está en otra sucursal o no está separada.`,
    };
  }
  return verificadas.has(devolucion.devolucionId)
    ? { clase: 'repetida', devolucion }
    : { clase: 'verificada', devolucion };
}

/** Resultado del retiro separado en las que pasaron y las que no. */
export function separarResultados(
  respuesta: RetiroBloqueResultado | null | undefined,
): { retiradas: number[]; fallidas: { id: number; mensaje: string }[] } {
  const retiradas: number[] = [];
  const fallidas: { id: number; mensaje: string }[] = [];
  for (const r of respuesta?.resultados ?? []) {
    const id = Number(r.id);
    if (r.ok) {
      retiradas.push(id);
    } else {
      fallidas.push({ id, mensaje: r.mensaje ?? 'No se pudo retirar.' });
    }
  }
  return { retiradas, fallidas };
}

/** `4 x1`: cantidad en la presentación y su factor. */
export function cantidadDelProducto(p: RetiroProducto): string {
  const cantidad = p.cantidad ?? 0;
  const numero = Number.isInteger(cantidad) ? String(cantidad) : cantidad.toFixed(3);
  return [numero, p.presentacion].filter(Boolean).join(' ');
}
