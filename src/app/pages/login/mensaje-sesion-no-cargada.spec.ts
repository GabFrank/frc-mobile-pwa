import { describe, expect, it } from 'vitest';

import { mensajeSesionNoCargada } from './mensaje-sesion-no-cargada';

describe('mensajeSesionNoCargada', () => {
  const MOTIVO = 'Response not successful: Received status code 401';

  it('ante un fallo de red manda a revisar la conexión, sin detalle técnico', () => {
    const mensaje = mensajeSesionNoCargada(true, 'Failed to fetch');

    expect(mensaje).toContain('no se pudo contactar al servidor');
    expect(mensaje).not.toContain('Failed to fetch');
  });

  it('si el servidor rechazó, manda a sistemas y conserva el motivo', () => {
    const mensaje = mensajeSesionNoCargada(false, MOTIVO);

    expect(mensaje).toContain('Avisá a sistemas.');
    expect(mensaje.endsWith(`Detalle: ${MOTIVO}`)).toBe(true);
  });

  it('sin motivo no deja un «Detalle:» colgando', () => {
    expect(mensajeSesionNoCargada(false, null)).not.toContain('Detalle');
  });

  it('nunca afirma que la persona entró', () => {
    // «Entraste, pero…» lo desmentía la misma pantalla: seguía en el login.
    for (const mensaje of [
      mensajeSesionNoCargada(true, null),
      mensajeSesionNoCargada(false, null),
      mensajeSesionNoCargada(false, MOTIVO),
    ]) {
      expect(mensaje).not.toMatch(/entraste/i);
    }
  });
});
