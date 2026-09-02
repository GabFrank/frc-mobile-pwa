import { Injectable } from '@angular/core';

/** Un archivo listo para adjuntar. El nombre viaja con extensión. */
export interface ArchivoCompartible {
  blob: Blob;
  nombre: string;
}

export interface Compartible {
  titulo: string;
  /** Cuerpo del mensaje. En WhatsApp aparece como pie de la imagen. */
  texto?: string;
  archivo?: ArchivoCompartible;
}

/**
 * Qué terminó pasando. El llamador casi nunca lo necesita —el servicio ya
 * avisó— pero los tests sí, y alguna pantalla puede querer no hacer nada
 * cuando el usuario cerró la hoja.
 */
export type ResultadoCompartir = 'compartido' | 'cancelado' | 'whatsapp' | 'fallo';

/**
 * Compartir con las apps del teléfono — WhatsApp, correo, Drive.
 *
 * Reemplaza a `@capacitor/share` de `frc-mobile`, que escribía el archivo con
 * `Filesystem.writeFile` en el caché de la app y le pasaba la URI al plugin.
 * Acá no hace falta ningún archivo en disco: `navigator.share` acepta un
 * `File` en memoria y el sistema abre la misma hoja, con WhatsApp y sus
 * contactos recientes arriba.
 *
 * ⚠️ **Esa hoja no existe en el escritorio.** `navigator.share` está en
 * Android y en Safari, pero no en Chrome de Linux ni en Firefox. La primera
 * versión de esto descargaba el PNG cuando faltaba, y el resultado era que
 * en la computadora el botón «no compartía nada, solo bajaba una imagen».
 * Por eso el último recurso ahora es **abrir WhatsApp** con un enlace
 * `wa.me` **en la misma vista**: no puede llevar la imagen —ningún enlace
 * puede— pero lleva el enlace al registro, que es lo que el otro necesita
 * tocar. **Nunca se termina en una descarga, ni en una pestaña de más.**
 *
 * ⚠️ **`navigator.share` solo corre dentro del gesto del usuario.** Fuera del
 * manejador del clic tira `NotAllowedError`. Por eso el archivo tiene que
 * llegar acá **ya generado**: si el llamador espera a componer el PNG dentro
 * del handler, para cuando se llama a `share` el gesto ya venció. Ver
 * `QrDialogComponent`, que lo prepara al abrirse.
 *
 * ⚠️ **Cancelar también es una excepción.** Cerrar la hoja rechaza la promesa
 * con `AbortError`; tratarlo como error mostraba «no se pudo compartir» cada
 * vez que alguien se arrepentía.
 */
@Injectable({ providedIn: 'root' })
export class CompartirService {
  /** `true` si el sistema tiene hoja de compartir. Falso en escritorio Firefox. */
  hayHojaDeCompartir(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  /**
   * `true` si además acepta adjuntar **este** archivo.
   *
   * Se pregunta por el archivo concreto, no por la capacidad en abstracto:
   * `canShare` mira el tipo y el tamaño, y Android rechaza formatos que
   * ninguna app registró. Chrome de escritorio en Linux suele decir que no.
   */
  puedeAdjuntar(archivo: ArchivoCompartible | undefined): boolean {
    if (!archivo || !this.hayHojaDeCompartir() || typeof navigator.canShare !== 'function') {
      return false;
    }
    try {
      return navigator.canShare({ files: [this.aFile(archivo)] });
    } catch {
      return false;
    }
  }

  /**
   * Abre la hoja del sistema. Tiene que llamarse desde el manejador del clic.
   *
   * Tres caminos, de mejor a peor: la hoja con el archivo adentro, la hoja
   * solo con el texto, y navegar a WhatsApp con el mensaje escrito. El
   * último no es decorativo: en el escritorio es lo único que queda.
   */
  async compartir(datos: Compartible): Promise<ResultadoCompartir> {
    if (this.puedeAdjuntar(datos.archivo)) {
      const resultado = await this.lanzar({
        title: datos.titulo,
        text: datos.texto,
        files: [this.aFile(datos.archivo!)],
      });
      if (resultado !== 'fallo') {
        return resultado;
      }
    } else if (this.hayHojaDeCompartir()) {
      const resultado = await this.lanzar({ title: datos.titulo, text: datos.texto });
      if (resultado !== 'fallo') {
        return resultado;
      }
    }

    return this.abrirWhatsapp(datos.texto ?? datos.titulo);
  }

  private async lanzar(datos: ShareData): Promise<ResultadoCompartir> {
    try {
      await navigator.share(datos);
      return 'compartido';
    } catch (error) {
      if (this.esCancelacion(error)) {
        return 'cancelado';
      }
      // Sin este log el fallo queda mudo: la hoja no se abre y el usuario
      // solo ve que el botón «no hace nada».
      console.warn('[compartir] La hoja del sistema falló:', error);
      return 'fallo';
    }
  }

  /**
   * Plan B: abrir WhatsApp con el mensaje escrito.
   *
   * `wa.me` resuelve solo adónde ir: en el teléfono levanta la app, en la
   * computadora abre WhatsApp Web. El usuario elige el contacto y manda; el
   * texto ya está puesto.
   *
   * ⚠️ **Va en la misma vista, no en una pestaña nueva.** Es lo que se pidió,
   * y es lo que se parece a la app: en el teléfono `wa.me` le pasa la posta a
   * WhatsApp y la PWA queda atrás, sin una pestaña de más que después haya
   * que cerrar a mano. En la computadora el precio es que volver con «atrás»
   * recarga la app.
   *
   * De paso desaparece el problema que traía `window.open`: pedir `noopener`
   * en sus opciones lo obliga a devolver `null` *aunque la pestaña se haya
   * abierto* —está en la spec y se verificó en Chrome con un clic real—, así
   * que el chequeo de «popup bloqueado» daba siempre verdadero y se abrían
   * dos WhatsApp. Navegar en la misma vista no lo bloquea nadie: no hay nada
   * que detectar ni plan B que tener.
   */
  private abrirWhatsapp(texto: string): ResultadoCompartir {
    window.location.href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    return 'whatsapp';
  }

  private aFile(archivo: ArchivoCompartible): File {
    return new File([archivo.blob], archivo.nombre, {
      type: archivo.blob.type || 'application/octet-stream',
    });
  }

  private esCancelacion(error: unknown): boolean {
    return (error as { name?: string } | null)?.name === 'AbortError';
  }
}
