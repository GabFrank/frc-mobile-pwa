import { DocumentNode, Kind, visit } from 'graphql';
import { describe, expect, it } from 'vitest';

import * as operacionesDeUsuario from '../graphql/personas/usuario/graphql/graphql-query';

/**
 * Ninguna operación de usuario pide `password`.
 *
 * El repo anterior lo traía en casi todas —búsqueda, detalle, guardado— sin que
 * ninguna pantalla lo leyera, y quedaba en memoria del cliente. Se quitó para
 * que el central pueda retirar el campo del tipo `Usuario`: una versión de la
 * app que vuelva a pedirlo falla entera el día que eso pase, porque GraphQL
 * rechaza la operación completa, no solo el campo.
 *
 * ⚠️ Cubre los documentos de **ese archivo**, que es donde vive todo lo que
 * devuelve un `Usuario` como raíz. No ve un `usuario { password }` anidado en
 * la operación de otro módulo.
 */
describe('Operaciones GraphQL de usuario', () => {
  const documentos = Object.entries(operacionesDeUsuario).filter(
    (entrada): entrada is [string, DocumentNode] =>
      (entrada[1] as DocumentNode | undefined)?.kind === Kind.DOCUMENT,
  );

  it('recorre los documentos del archivo', () => {
    // Si el filtro de arriba deja de reconocerlos, el test de abajo pasaría
    // sin haber mirado nada.
    expect(documentos.length).toBeGreaterThan(10);
  });

  it('ninguna selecciona el campo password', () => {
    const conPassword = documentos
      .filter(([, documento]) => {
        let loPide = false;
        visit(documento, {
          Field(campo) {
            if (campo.name.value === 'password') loPide = true;
          },
        });
        return loPide;
      })
      .map(([nombre]) => nombre);

    expect(conPassword).toEqual([]);
  });
});
