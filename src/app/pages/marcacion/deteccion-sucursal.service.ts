import { inject, Injectable, signal } from '@angular/core';

import { GeoService, Posicion, ProgresoGeo } from 'src/app/core/dispositivo/geo.service';
import { Sucursal } from 'src/app/domains/empresarial/sucursal/sucursal.model';
import { SucursalService } from 'src/app/domains/empresarial/sucursal/sucursal.service';
import { soloOperables } from 'src/app/domains/empresarial/sucursal/sucursal.util';
import { detectarSucursal, SucursalDetectada } from './deteccion-sucursal.util';

/**
 * En qué punto está la detección de la sucursal.
 *
 * ⚠️ **`sin-posicion` y `sin-coordenadas` son dos respuestas distintas** y hay
 * que decirlas distinto: una es «no pude preguntar dónde estás», la otra es
 * «pregunté, pero ninguna sucursal tiene coordenadas para comparar». Juntarlas
 * en un «no se pudo» genérico manda a revisar el permiso del teléfono cuando
 * el que falta es un dato del central.
 */
export type EstadoDeteccion = 'buscando' | 'ok' | 'sin-posicion' | 'sin-coordenadas';

/**
 * Dónde está el dispositivo, y por lo tanto contra qué sucursal se marca.
 *
 * Lo usan las dos pantallas que marcan —la personal y el kiosco—, y por eso
 * vive acá y no dentro de una de ellas: la regla que importa es **que no haya
 * caída silenciosa a la sucursal de la sesión**, y duplicarla en dos pantallas
 * es la forma segura de que una de las dos la pierda. Ver la issue #15.
 */
@Injectable({ providedIn: 'root' })
export class DeteccionSucursalService {
  private readonly geo = inject(GeoService);
  private readonly sucursalesService = inject(SucursalService);

  readonly estado = signal<EstadoDeteccion>('buscando');
  readonly sucursal = signal<Sucursal | null>(null);
  readonly distancia = signal<number | null>(null);
  readonly progreso = signal<ProgresoGeo | null>(null);
  /** La posición con la que se detectó. Es la evidencia que viaja. */
  readonly posicion = signal<Posicion | null>(null);

  /** Las operables, que son las únicas contra las que se mide. */
  private readonly sucursales = signal<Sucursal[]>([]);

  /**
   * Carga las sucursales y detecta.
   *
   * `alFallar` corre si las sucursales no se pudieron traer — que no es lo
   * mismo que no tener coordenadas, aunque la pantalla termine igual de
   * imposibilitada de marcar.
   */
  cargar(alFallar?: () => void): void {
    this.sucursalesService.todas().subscribe({
      next: (todas) => {
        this.sucursales.set(soloOperables(todas ?? []));
        void this.detectar();
      },
      error: () => {
        this.estado.set('sin-coordenadas');
        alFallar?.();
      },
    });
  }

  /**
   * Toma la posición y resuelve en qué sucursal se está.
   *
   * Devuelve la sucursal y los metros cuando se pudo, o `null` cuando no.
   * Quien llama **no debe caer a ninguna sucursal por defecto** si esto da
   * `null`: es lo que vaciaba de sentido a la distancia.
   */
  async detectar(): Promise<SucursalDetectada<Sucursal> | null> {
    this.estado.set('buscando');
    this.sucursal.set(null);
    this.distancia.set(null);
    this.posicion.set(null);

    const posicion = await this.geo.posicionActual((p) => this.progreso.set(p));
    if (!posicion) {
      this.estado.set('sin-posicion');
      return null;
    }

    const detectada = detectarSucursal(this.sucursales(), posicion, (latA, lngA, latB, lngB) =>
      this.geo.distanciaMetros(latA, lngA, latB, lngB),
    );
    if (!detectada) {
      this.estado.set('sin-coordenadas');
      return null;
    }

    this.posicion.set(posicion);
    this.sucursal.set(detectada.sucursal);
    this.distancia.set(detectada.metros);
    this.estado.set('ok');
    return detectada;
  }
}
