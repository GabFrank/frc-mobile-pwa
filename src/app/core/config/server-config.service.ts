import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

const KEY_BASE_URL = 'frc.serverBaseUrl';

/**
 * Resuelve contra qué instancia del central habla la app.
 *
 * A diferencia del repo anterior —donde la URI de Apollo se calculaba
 * una sola vez al cargar el módulo y cambiar de servidor obligaba a
 * `window.location.reload()`— acá el valor se lee en cada request.
 *
 * Ver docs/arquitectura/configuracion-servidor.md del repo frc-mobile.
 */
@Injectable({ providedIn: 'root' })
export class ServerConfigService {
  /** URL base actual, sin barra final. Reactiva para la UI. */
  readonly baseUrl = signal<string>(this.leerBaseUrl());

  get graphqlUrl(): string {
    return `${this.baseUrl()}/graphql`;
  }

  get subscriptionsUrl(): string {
    return `${this.baseUrl().replace(/^http/, 'ws')}/subscriptions`;
  }

  get loginUrl(): string {
    return `${this.baseUrl()}/login`;
  }

  /**
   * Cambia la instancia destino. No requiere recargar la app: Apollo
   * resuelve la URI por operación. Sí invalida la sesión, porque el
   * token del servidor viejo no sirve en el nuevo.
   */
  cambiarServidor(baseUrl: string): void {
    const normalizada = baseUrl.replace(/\/+$/, '');
    localStorage.setItem(KEY_BASE_URL, normalizada);
    this.baseUrl.set(normalizada);
  }

  private leerBaseUrl(): string {
    const guardada = localStorage.getItem(KEY_BASE_URL);
    // El repo anterior persistía la cadena "null" con
    // `setItem(clave, null)`. Se contempla por si quedan
    // instalaciones con ese valor.
    if (guardada && guardada !== 'null') {
      return guardada.replace(/\/+$/, '');
    }
    return environment.defaultServerUrl;
  }
}
