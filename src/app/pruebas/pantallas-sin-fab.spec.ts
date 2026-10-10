import { describe, expect, it } from 'vitest';

/**
 * En qué pantallas **no** va el botón flotante de escaneo.
 *
 * El flotante siempre navega: un QR del sistema abre su registro y un código
 * de barras lleva a Buscar. Por eso se apaga en tres clases de pantalla:
 *
 * - **formularios**, donde un toque se lleva lo cargado sin preguntar;
 * - **pantallas con su propio escanear**, donde quedaban dos botones con el
 *   mismo ícono y comportamiento distinto —el de la pantalla actúa sobre el
 *   registro, el flotante saca de ella—;
 * - **las que viven dentro de la cámara y el kiosco de marcación**.
 *
 * La lista es explícita a propósito. Una pantalla nueva nace con el flotante
 * encendido, que es el valor por defecto de `frc-pagina`, y no rompe nada.
 * Lo que rompe es que una de estas vuelva a encenderlo, o que otra lo apague
 * sin anotarse acá: apagarlo es una decisión y tiene que quedar escrita.
 *
 * Se lee el fuente en vez de montar cada pantalla: son 25 fixtures con sus
 * dobles de Apollo para verificar un atributo. Que el atributo efectivamente
 * quita el botón del DOM ya lo prueba `buscar-sin-fab.spec.ts`.
 */
// Ver `sin-dialogos-nativos.spec.ts`: el tipo lo aporta Vite y la llamada
// tiene que escribirse literal.
declare global {
  interface ImportMeta {
    glob(patron: string, opciones: Record<string, unknown>): Record<string, string>;
  }
}

const SIN_FLOTANTE: readonly string[] = [
  // Viven dentro de la cámara, o ya tienen el escaneo como acción central.
  'buscar/buscar.page.ts',
  'cuenta/enroll-facial.page.ts',
  'inventario/inventario-carga.page.ts',
  'inventario/inventario-nuevo.page.ts',
  'operaciones/gastos/gastos-rendicion.page.ts',
  'transferencias/transferencia-borrador.page.ts',
  'transferencias/transferencia-nueva.page.ts',
  // Formularios.
  'operaciones/caja/caja-abrir.page.ts',
  'operaciones/caja/caja-cerrar.page.ts',
  'operaciones/devolucion/devolucion-nueva.page.ts',
  'operaciones/gastos/gastos-solicitud-nueva.page.ts',
  'operaciones/solicitud-pago/solicitud-pago-nueva.page.ts',
  'operaciones/venta-tarjeta/venta-tarjeta-registro.page.ts',
  'producto/editar/categoria.page.ts',
  'producto/editar/datos-generales.page.ts',
  'producto/editar/precios.page.ts',
  'producto/editar/presentacion-editar.page.ts',
  'producto/editar/producto-nuevo.page.ts',
  // Tienen su propio escanear.
  'mis-finanzas/mis-finanzas.page.ts',
  'operaciones/gastos/gastos-lista.page.ts',
  'operaciones/recepcion/recepcion-detalle.page.ts',
  'operaciones/recepcion/recepcion-nueva.page.ts',
  'operaciones/venta-tarjeta/venta-tarjeta-lista.page.ts',
  'producto/editar/codigos.page.ts',
  // Kiosco.
  'marcacion/kiosco-marcacion.page.ts',
];

describe('Pantallas sin botón flotante', () => {
  const fuentes = import.meta.glob('../pages/**/*.page.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  // El lookahead no sobra: sin él, el prefijo también toma a
  // frc-paginacion, que nunca lleva el atributo, y Mis finanzas pasaría por
  // encendida.
  const etiquetas = (contenido: string) => contenido.match(/<frc-pagina(?=[\s>])[^>]*>/g) ?? [];

  // Se mira **dentro de la etiqueta de apertura** y con la forma exacta. El
  // atributo nombrado en un comentario no apaga nada, y sin corchetes es el
  // texto "false", que para el input es verdadero.
  const apagada = (etiqueta: string) => etiqueta.includes('[conEscaner]="false"');

  const paginas = Object.entries(fuentes)
    .map(([ruta, contenido]) => ({
      ruta: ruta.replace('../pages/', ''),
      etiquetas: etiquetas(String(contenido ?? '')),
    }))
    .filter((p) => p.etiquetas.length > 0);

  it('lo apagan exactamente las pantallas de la lista', () => {
    const apagadas = paginas.filter((p) => p.etiquetas.every(apagada)).map((p) => p.ruta);

    expect([...apagadas].sort()).toEqual([...SIN_FLOTANTE].sort());
  });

  it('ninguna pantalla lo apaga a medias', () => {
    // Dos frc-pagina en un archivo, una apagada y otra no: la prueba de
    // arriba la contaría como encendida y el descuido pasaría sin verse.
    const aMedias = paginas
      .filter((p) => p.etiquetas.some(apagada) && !p.etiquetas.every(apagada))
      .map((p) => p.ruta);

    expect(aMedias).toEqual([]);
  });

  it('las de navegación lo conservan', () => {
    const encendidas = paginas.filter((p) => !p.etiquetas.some(apagada)).map((p) => p.ruta);

    // El control: si el glob dejara de resolver o la expresión dejara de
    // encontrar etiquetas, la primera prueba fallaría, pero conviene que
    // diga por qué.
    expect(encendidas).toContain('inicio/inicio.page.ts');
    expect(encendidas).toContain('transferencias/transferencias-lista.page.ts');
    // ⚠️ El detalle de transferencia tiene escáner propio y aun así lo
    // conserva: una transferencia a nombre de otro se toma escaneando **su**
    // QR, y los escaneos de esa pantalla leen sucursal y producto, no ese
    // código. El flotante es el único camino desde ahí.
    expect(encendidas).toContain('transferencias/transferencia-detalle.page.ts');
    expect(encendidas.length).toBeGreaterThan(20);
  });
});
