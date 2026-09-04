import { effect, Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro' | 'sistema';

const CLAVE = 'frc.tema';

/**
 * Tema claro/oscuro.
 *
 * `sistema` sigue la preferencia del SO; las otras dos la pisan estampando
 * `data-theme` en `:root`, que es lo que los tokens contemplan en ambas
 * direcciones (ver styles/_tokens.scss).
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  readonly tema = signal<Tema>(this.leer());

  constructor() {
    effect(() => this.aplicar(this.tema()));
  }

  alternar(): void {
    this.tema.update((actual) => (this.esOscuroEfectivo(actual) ? 'claro' : 'oscuro'));
  }

  establecer(tema: Tema): void {
    this.tema.set(tema);
  }

  esOscuroEfectivo(tema: Tema = this.tema()): boolean {
    if (tema === 'sistema') {
      return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }
    return tema === 'oscuro';
  }

  private aplicar(tema: Tema): void {
    const raiz = document.documentElement;
    if (tema === 'sistema') {
      raiz.removeAttribute('data-theme');
    } else {
      raiz.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
    }
    localStorage.setItem(CLAVE, tema);
  }

  private leer(): Tema {
    const guardado = localStorage.getItem(CLAVE);
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : 'sistema';
  }
}
