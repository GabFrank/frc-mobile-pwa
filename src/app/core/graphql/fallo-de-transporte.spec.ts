import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { InMemoryCache } from '@apollo/client';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UsuarioLoginGQL } from 'src/app/graphql/personas/usuario/graphql/usuarioLogin';
import { NotificacionService } from '../ui/notificacion.service';
import { DatosService, esFalloDeTransporte } from './datos.service';

const URL = 'http://central.prueba/graphql';

/**
 * `esFalloDeTransporte` contra el error que **de verdad** produce la cadena
 * `HttpClient` → `apollo-angular` → Apollo Client → `DatosService`.
 *
 * No se usa un objeto plano con `status`: con `errorPolicy: 'all'` el fallo
 * no llega por el canal de error sino dentro del resultado, y ahí el status
 * se perdía. Un doble armado a mano tenía el status donde la función lo
 * buscaba y por eso el defecto no se veía.
 */
describe('esFalloDeTransporte, con Apollo real', () => {
  let datos: DatosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApollo(() => ({
          link: inject(HttpLink).create({ uri: URL }),
          cache: new InMemoryCache(),
        })),
        { provide: NotificacionService, useValue: { ok: () => {}, danger: () => {} } },
      ],
    });
    datos = TestBed.inject(DatosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Lanza la query de sesión, responde como se indique y devuelve el error. */
  async function errorAnte(responder: (peticion: TestRequest) => void): Promise<unknown> {
    const resultado = firstValueFrom(
      datos.porId(TestBed.inject(UsuarioLoginGQL), 1, undefined, {
        mostrarCarga: false,
        notificarError: false,
      }),
    ).then(
      () => {
        throw new Error('La consulta tenía que fallar.');
      },
      (error: unknown) => error,
    );
    // Apollo despacha la petición en una microtarea posterior.
    await new Promise((r) => setTimeout(r, 0));
    responder(http.expectOne(URL));
    return resultado;
  }

  const conStatus = (status: number) => (peticion: TestRequest) =>
    peticion.flush('cuerpo que no es GraphQL', { status, statusText: 'x' });

  for (const status of [500, 502, 503, 504]) {
    it(`un ${status} es transporte`, async () => {
      expect(esFalloDeTransporte(await errorAnte(conStatus(status)))).toBe(true);
    });
  }

  for (const status of [401, 403]) {
    it(`un ${status} no es transporte: la credencial no sirve`, async () => {
      expect(esFalloDeTransporte(await errorAnte(conStatus(status)))).toBe(false);
    });
  }

  it('sin respuesta del servidor es transporte', async () => {
    // Status 0. `apollo-angular` no lo entrega como número sino como un
    // `Error` con el mensaje de `HttpErrorResponse`, así que se reconoce por
    // el texto — sin depender del `statusText`, que acá viene vacío.
    const error = await errorAnte((peticion) => peticion.error(new ProgressEvent('error')));

    expect(esFalloDeTransporte(error)).toBe(true);
  });

  it('un error de GraphQL con HTTP 200 no es transporte, diga lo que diga', async () => {
    const error = await errorAnte((peticion) =>
      peticion.flush({ data: null, errors: [{ message: 'Unknown error: failed to fetch usuario' }] }),
    );

    expect(esFalloDeTransporte(error)).toBe(false);
  });
});
