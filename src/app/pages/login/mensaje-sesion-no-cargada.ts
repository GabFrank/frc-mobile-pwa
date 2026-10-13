/**
 * Qué decirle a quien pasó el login pero cuyo usuario no se pudo cargar.
 *
 * La contraseña ya fue aceptada, y el mensaje lo dice primero: sin eso el
 * cajero prueba otras claves cuando el problema no es la suya.
 *
 * El motivo técnico va al final y rotulado. No se saca de la pantalla: quien
 * diagnostica recibe una captura, no la consola del teléfono.
 */
export function mensajeSesionNoCargada(falloDeRed: boolean, motivo: string | null): string {
  if (falloDeRed) {
    return 'Tus datos son correctos, pero no se pudo contactar al servidor. Revisá la conexión y probá de nuevo.';
  }
  const base =
    'Tu usuario y contraseña son correctos, pero no se pudo cargar tu cuenta. Avisá a sistemas.';
  return motivo ? `${base} Detalle: ${motivo}` : base;
}
