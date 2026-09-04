import { describe, expect, it } from 'vitest';

/**
 * Ningún archivo de la app puede abrir un diálogo nativo del navegador.
 *
 * `alert`, `confirm` y `prompt` bloquean el hilo, no se pueden estilar
 * —aparecen con el chrome del navegador y el "localhost dice" encima—,
 * ignoran el tema, y varios navegadores los **suprimen del todo** cuando la
 * página corre como PWA instalada.
 *
 * Ese último punto es el que lo vuelve un defecto y no una cuestión de
 * gusto: la pantalla de configuración del servidor usaba `prompt()`, así que
 * habría dejado de funcionar exactamente en el modo en que se va a usar la
 * app. Se descubrió probando en un teléfono real.
 *
 * La alternativa está en `DialogoService`: `confirmar()` y `pedirTexto()`.
 */
// El tipo lo aporta Vite, que no está en el `tsconfig` del proyecto. Se
// declara acá en vez de sumar sus tipos solo para este test. La llamada tiene
// que escribirse literal —`import.meta.glob(...)`—: Vite la reemplaza durante
// la transformación del archivo y no la resuelve en tiempo de ejecución.
declare global {
  interface ImportMeta {
    glob(patron: string, opciones: Record<string, unknown>): Record<string, string>;
  }
}

describe('Sin diálogos nativos', () => {
  // Se leen los fuentes por glob y no con `fs` porque el proyecto no tiene
  // los tipos de Node.
  const fuentes = import.meta.glob('../**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('no llama a alert, confirm ni prompt', () => {
    // Se buscan las llamadas, no las palabras: `confirmar()` y una etiqueta
    // que diga "Confirmar" son legítimas.
    const llamadaNativa = /(?:^|[^.\w])(?:window\.|globalThis\.)?(?:alert|confirm|prompt)\s*\(/;

    // Una **firma de método** en una interfaz no es una llamada. Aparece de
    // verdad: el evento `beforeinstallprompt` declara `prompt(): Promise<void>`,
    // y ese `prompt` es la API de instalación de la PWA, no la del navegador.
    // Sin esta excepción, el test prohíbe declarar el tipo de algo que sí se
    // puede usar.
    const firmaDeTipo = /^\s*(?:readonly\s+)?(?:alert|confirm|prompt)\s*\([^)]*\)\s*:/;

    const culpables = Object.entries(fuentes)
      .filter(([ruta]) => !ruta.endsWith('.spec.ts'))
      .filter(([, contenido]) =>
        contenido
          .split('\n')
          .some(
            (linea: string) =>
              !linea.trimStart().startsWith('*') &&
              !firmaDeTipo.test(linea) &&
              llamadaNativa.test(linea),
          ),
      )
      .map(([ruta]) => ruta);

    expect(culpables).toEqual([]);
  });

  it('encuentra fuentes para revisar', () => {
    // Sin esto, un glob que dejara de resolver haría pasar el test anterior
    // sin haber mirado un solo archivo.
    expect(Object.keys(fuentes).length).toBeGreaterThan(100);
  });
});
