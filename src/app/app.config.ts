import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { ApolloLink, InMemoryCache } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';

import { routes } from './app.routes';
import { ServerConfigService } from './core/config/server-config.service';
import { AUTH_TOKEN_KEY } from './core/auth/auth.tokens';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),

    provideApollo(() => {
      const httpLink = inject(HttpLink);
      const serverConfig = inject(ServerConfigService);

      const auth = new SetContextLink((prevContext) => {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        if (!token || token === 'null') {
          return prevContext;
        }
        return {
          ...prevContext,
          headers: { ...prevContext['headers'], Authorization: `Token ${token}` },
        };
      });

      return {
        link: ApolloLink.from([
          auth,
          // `uri` como función: se evalúa en cada operación, así que
          // cambiar de servidor no obliga a recargar la app —a
          // diferencia del repo anterior, donde la URI se calculaba
          // una sola vez al cargar el módulo.
          httpLink.create({ uri: () => serverConfig.graphqlUrl }),
        ]),
        cache: new InMemoryCache(),
        // La política de caché NO se fija acá.
        //
        // El backend es la fuente de verdad de saldos, stock y estados:
        // cachear lecturas mostraría datos viejos en pantallas donde eso
        // tiene consecuencias operativas. Pero Apollo Client 4 exige
        // declarar `defaultOptions` con un tipo global, lo que las vuelve
        // difíciles de excepcionar por pantalla.
        //
        // En su lugar, la capa de datos pasa `fetchPolicy: 'no-cache'` y
        // `errorPolicy: 'all'` en cada operación — igual que hacía
        // GenericCrudService en el repo anterior. Así una pantalla que sí
        // quiera cachear (un catálogo estable, por ejemplo) puede pedirlo
        // explícitamente sin tocar configuración global.
      };
    }),
  ],
};
