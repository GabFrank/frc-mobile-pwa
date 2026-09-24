import { Injectable, computed, signal } from '@angular/core';

/**
 * Estado de carga global.
 *
 * Diferencia con el repo anterior: allá `CargandoService.open()` abría un
 * overlay bloqueante que tapaba la pantalla, y `close()` tenía un
 * `setTimeout` de 500 ms; si se perdía la referencia, el loader quedaba
 * colgado.
 *
 * Acá se expone un contador reactivo y las pantallas deciden cómo
 * mostrarlo — normalmente con skeletons, que es el patrón aprobado. El
 * overlay bloqueante se reserva para acciones que no admiten interacción
 * concurrente.
 */
@Injectable({ providedIn: 'root' })
export class CargandoService {
  private readonly pendientes = signal(0);

  /** `true` mientras haya al menos una operación en curso. */
  readonly cargando = computed(() => this.pendientes() > 0);

  /** Texto opcional para el overlay bloqueante. */
  readonly mensaje = signal<string | null>(null);

  iniciar(mensaje?: string): void {
    if (mensaje) {
      this.mensaje.set(mensaje);
    }
    this.pendientes.update((n) => n + 1);
  }

  finalizar(): void {
    this.pendientes.update((n) => Math.max(0, n - 1));
    if (this.pendientes() === 0) {
      this.mensaje.set(null);
    }
  }

  /**
   * Envuelve una promesa marcando carga al inicio y al final, incluso si
   * falla. Evita el loader colgado por un error sin capturar.
   */
  async con<T>(trabajo: Promise<T>, mensaje?: string): Promise<T> {
    this.iniciar(mensaje);
    try {
      return await trabajo;
    } finally {
      this.finalizar();
    }
  }
}
