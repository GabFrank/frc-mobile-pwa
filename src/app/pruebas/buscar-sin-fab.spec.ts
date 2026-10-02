import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { EscanerService } from '../core/dispositivo/escaner.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import { BuscarPage } from '../pages/buscar/buscar.page';
import { PaginaComponent } from '../shared/layout/pagina.component';

/**
 * En **Buscar** no va el botón flotante de escaneo.
 *
 * La pantalla ya tiene el suyo, pegado al campo, y el flotante quedaba
 * ofreciendo lo mismo desde la otra esquina. Apagarlo además libera el
 * `padding-bottom` que `frc-pagina` reserva para él, que acá es una fila de
 * resultados.
 *
 * ⚠️ El caso de control no sobra. Sin él, el día que alguien renombre el
 * selector `frc-fab-escaneo` la primera prueba sigue en verde —no encuentra
 * nada porque el nombre cambió, no porque esté apagado— y el test deja de
 * decir la verdad sin que nadie lo note.
 */
describe('Buscar · sin botón flotante', () => {
  const fabs = (f: { nativeElement: HTMLElement }) =>
    f.nativeElement.querySelectorAll('frc-fab-escaneo').length;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ProductoBusquedaService,
          useValue: {
            buscarPorCodigoOTexto: vi.fn(() => of([])),
            pesable: vi.fn(() => null),
            stock: vi.fn(() => of(0)),
          },
        },
        { provide: EscanerService, useValue: { escanear: vi.fn(), disponible: true } },
        { provide: NotificacionService, useValue: { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() } },
        { provide: DialogoService, useValue: { abrir: vi.fn() } },
        // Sucursal con depósito: es la que decide si se pide el stock, y no
        // tiene nada que ver con el FAB. Se fija para que el montaje no
        // dependa del estado de la sesión.
        {
          provide: AuthService,
          useValue: {
            sucursal: signal({ id: 1, deposito: true, activo: true }),
            // Buscar ofrece el alta de producto a quien tenga el rol, así que
            // el mock necesita responder qué roles tiene la sesión.
            roles: signal([]),
          },
        },
      ],
    });
  });

  it('la pantalla de Buscar no lo renderiza', () => {
    const f = TestBed.createComponent(BuscarPage);
    f.detectChanges();

    expect(fabs(f)).toBe(0);
  });

  it('pero una página cualquiera sí lo trae, que es el valor por defecto', () => {
    const f = TestBed.createComponent(PaginaComponent);
    f.componentRef.setInput('titulo', 'Cualquiera');
    f.detectChanges();

    expect(fabs(f)).toBe(1);
  });
});
