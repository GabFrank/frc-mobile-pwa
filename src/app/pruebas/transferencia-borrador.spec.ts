import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { ProductoBusquedaService } from '../domains/productos/producto-busqueda.service';
import type { OpcionesBuscador } from '../shared/producto/buscador.types';
import {
  EtapaTransferencia,
  TransferenciaEstado,
  TransferenciaItem,
} from '../domains/transferencia/transferencia.model';
import { TransferenciaBorradorPage } from '../pages/transferencias/transferencia-borrador.page';
import { TransferenciaDetallePage } from '../pages/transferencias/transferencia-detalle.page';
import { TransferenciaNuevaPage } from '../pages/transferencias/transferencia-nueva.page';
import { TransferenciaService } from '../pages/transferencias/transferencia.service';
import { TransferenciasListaPage } from '../pages/transferencias/transferencias-lista.page';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

/**
 * Como en la base real: `SERVIDOR` y `COMPRAS` están activas pero **sin
 * depósito**, así que no mueven stock y no participan de una transferencia.
 * Lo discrimina `deposito`, no el nombre.
 */
const TODAS = [
  { id: 0, nombre: 'SERVIDOR', deposito: false, activo: true },
  { id: 999, nombre: 'COMPRAS', deposito: false, activo: true },
  { id: 1, nombre: 'SUC. ROTONDA', deposito: true, activo: true },
  { id: 3, nombre: 'SUC. PALOMA 1', deposito: true, activo: true },
  { id: 5, nombre: 'DEPOSITO AQUARIO SDG', deposito: true, activo: true },
];

const sesion = () => ({
  usuario: signal({ id: 41, nickname: 'diego', persona: { nombre: 'DIEGO' } }),
  sucursal: signal({ id: 1, nombre: 'SUC. ROTONDA', deposito: true, activo: true }),
  roles: signal(['CREAR TRANSFERENCIA']),
});

describe('Nueva transferencia', () => {
  let sucursales: { todas: ReturnType<typeof vi.fn> };
  let servicio: { crear: ReturnType<typeof vi.fn> };
  let notificacion: { warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn>; ok: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sucursales = { todas: vi.fn(() => of(TODAS)) };
    servicio = { crear: vi.fn(() => of({ id: 54_060 })) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'transferencias/:id/borrador', children: [] }]),
        { provide: SucursalService, useValue: sucursales },
        { provide: TransferenciaService, useValue: servicio },
        { provide: NotificacionService, useValue: notificacion },
        { provide: AuthService, useValue: sesion() },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(TransferenciaNuevaPage);
    f.detectChanges();
    return f;
  };

  it('solo ofrece sucursales que pueden mover stock', () => {
    const f = montar();
    expect(f.componentInstance.opcionesOrigen().map((o) => o.valor)).toEqual([1, 3, 5]);
  });

  it('arranca en la sucursal de la sesión', () => {
    expect(montar().componentInstance.origenId()).toBe(1);
  });

  /**
   * ⚠️ Una transferencia de una sucursal a sí misma no mueve nada. Se saca de
   * la lista en vez de rechazarla después de elegida.
   */
  it('no ofrece como destino la sucursal de origen', () => {
    const f = montar();
    expect(f.componentInstance.opcionesDestino().map((o) => o.valor)).toEqual([3, 5]);
  });

  it('elegir como origen la que era destino deja el destino en blanco', () => {
    const f = montar();
    f.componentInstance.cambiarDestino(3);
    f.componentInstance.cambiarOrigen(3);

    expect(f.componentInstance.destinoId()).toBeNull();
  });

  it('crea el borrador con el responsable y lleva a cargar productos', async () => {
    const f = montar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    f.componentInstance.cambiarDestino(3);

    await f.componentInstance.crear();

    expect(servicio.crear).toHaveBeenCalledWith({
      sucursalOrigenId: 1,
      sucursalDestinoId: 3,
      estado: TransferenciaEstado.ABIERTA,
      tipo: 'MANUAL',
      etapa: EtapaTransferencia.PRE_TRANSFERENCIA_CREACION,
      usuarioPreTransferenciaId: 41,
    });
    // `replaceUrl`: volver atrás desde el borrador no puede crear otra.
    expect(navegar).toHaveBeenCalledWith(['/transferencias', 54_060, 'borrador'], {
      replaceUrl: true,
    });
  });

  it('sin destino elegido no crea nada', async () => {
    const f = montar();
    await f.componentInstance.crear();

    expect(servicio.crear).not.toHaveBeenCalled();
    expect(notificacion.warn).toHaveBeenCalled();
  });
});

describe('Borrador de la transferencia', () => {
  let servicio: {
    porId: ReturnType<typeof vi.fn>;
    items: ReturnType<typeof vi.fn>;
    guardarItem: ReturnType<typeof vi.fn>;
    eliminarItem: ReturnType<typeof vi.fn>;
    finalizar: ReturnType<typeof vi.fn>;
  };
  let dialogo: { confirmar: ReturnType<typeof vi.fn>; abrir: ReturnType<typeof vi.fn> };
  let notificacion: { warn: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn>; ok: ReturnType<typeof vi.fn> };
  let busqueda: { stock: ReturnType<typeof vi.fn> };

  const BORRADOR = {
    id: 54_060,
    estado: TransferenciaEstado.ABIERTA,
    etapa: EtapaTransferencia.PRE_TRANSFERENCIA_CREACION,
    sucursalOrigen: { id: 1, nombre: 'SUC. ROTONDA' },
    sucursalDestino: { id: 3, nombre: 'SUC. PALOMA 1' },
  };

  const ITEM: TransferenciaItem = {
    id: 900,
    cantidadPreTransferencia: 2,
    presentacionPreTransferencia: { id: 88, cantidad: 12 } as never,
    producto: { id: 7, descripcion: 'GALLETITA' } as never,
  };

  beforeEach(() => {
    servicio = {
      porId: vi.fn(() => of(BORRADOR)),
      items: vi.fn(() => of([ITEM])),
      guardarItem: vi.fn(() => of({ id: 901 })),
      eliminarItem: vi.fn(() => of(true)),
      finalizar: vi.fn(() => of(true)),
    };
    dialogo = { confirmar: vi.fn(async () => true), abrir: vi.fn(async () => undefined) };
    notificacion = { warn: vi.fn(), danger: vi.fn(), ok: vi.fn() };
    busqueda = { stock: vi.fn(() => of(100)) };

    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [
        provideRouter([{ path: 'transferencias/:id', children: [] }]),
        { provide: TransferenciaService, useValue: servicio },
        { provide: DialogoService, useValue: dialogo },
        { provide: NotificacionService, useValue: notificacion },
        { provide: ProductoBusquedaService, useValue: busqueda },
        { provide: AuthService, useValue: sesion() },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(TransferenciaBorradorPage);
    f.componentRef.setInput('id', '54060');
    f.detectChanges();
    return f;
  };

  it('muestra los ítems ya cargados', () => {
    const f = montar();
    expect(f.componentInstance.items().length).toBe(1);
    expect(f.nativeElement.textContent).toContain('GALLETITA');
  });

  /**
   * ⚠️ **Una transferencia que ya salió de creación no se edita acá.** Sus
   * ítems son lo que otra etapa está verificando, y quitarlos por esta
   * pantalla dejaría a alguien preparando mercadería que ya no figura.
   */
  it('lo que ya no es borrador se abre en el detalle', async () => {
    servicio.porId = vi.fn(() =>
      of({ ...BORRADOR, etapa: EtapaTransferencia.PRE_TRANSFERENCIA_ORIGEN }),
    );
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const f = montar();
    await f.whenStable();

    expect(navegar).toHaveBeenCalledWith(['/transferencias', 54_060], { replaceUrl: true });
  });

  /**
   * ⚠️ **«No pude traer los ítems» no es «no tiene ítems».** Sin aviso, un
   * borrador cargado se ve vacío: el operador lo vuelve a cargar entero y
   * termina mandando todo dos veces.
   */
  it('si los ítems no se pueden traer, lo dice', async () => {
    servicio.items = vi.fn(() => throwError(() => new Error('sin conexión')));
    const f = montar();
    await f.whenStable();

    expect(notificacion.warn).toHaveBeenCalled();
  });

  it('quitar un ítem lo borra en el central y refresca la lista', async () => {
    const f = montar();
    servicio.items.mockClear();

    await f.componentInstance.quitar(ITEM, new Event('click'));

    expect(servicio.eliminarItem).toHaveBeenCalledWith(900);
    expect(servicio.items).toHaveBeenCalled();
  });

  it('no quita nada si se cancela la confirmación', async () => {
    dialogo.confirmar = vi.fn(async () => false);
    const f = montar();

    await f.componentInstance.quitar(ITEM, new Event('click'));

    expect(servicio.eliminarItem).not.toHaveBeenCalled();
  });

  it('finalizar cierra la creación y abre el detalle', async () => {
    const f = montar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await f.componentInstance.finalizar();

    expect(servicio.finalizar).toHaveBeenCalledWith(54_060, 41);
    expect(navegar).toHaveBeenCalledWith(['/transferencias', 54_060], { replaceUrl: true });
  });

  /**
   * ⚠️ **`finalizarTransferencia` devuelve `false` sin error** cuando el
   * estado no es `ABIERTA`. Tratarlo como éxito llevaría al detalle
   * anunciando algo que no pasó.
   */
  it('un false del central no se festeja como éxito', async () => {
    servicio.finalizar = vi.fn(() => of(false));
    const f = montar();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await f.componentInstance.finalizar();

    expect(navegar).not.toHaveBeenCalled();
    expect(notificacion.danger).toHaveBeenCalled();
  });

  /**
   * ⚠️ El central acepta finalizar una transferencia vacía: queda pendiente
   * en origen y alguien la abre para preparar lo que no hay.
   */
  it('sin ítems no deja finalizar', async () => {
    servicio.items = vi.fn(() => of([]));
    const f = montar();

    expect(f.componentInstance.puedeFinalizar()).toBe(false);

    await f.componentInstance.finalizar();
    expect(servicio.finalizar).not.toHaveBeenCalled();
  });

  it('agregar un producto guarda el ítem con lo cargado en el diálogo', async () => {
    dialogo.abrir = vi
      .fn()
      .mockResolvedValueOnce({
        producto: { id: 7, descripcion: 'GALLETITA' },
        presentacion: { id: 88, cantidad: 12 },
      })
      .mockResolvedValueOnce({ cantidad: 3, vencimiento: '2026-12-31', observacion: '' });
    const f = montar();

    await f.componentInstance.agregar();

    expect(servicio.guardarItem).toHaveBeenCalledWith({
      transferenciaId: 54_060,
      presentacionPreTransferenciaId: 88,
      cantidadPreTransferencia: 3,
      vencimientoPreTransferencia: '2026-12-31',
      activo: true,
      poseeVencimiento: true,
    });
  });

  /**
   * El buscador mira las dos sucursales a la vez: lo que hay en origen para
   * mandar y lo que ya hay en destino. Es el modo que el componente soporta y
   * que hasta ahora no usaba nadie.
   */
  it('el buscador se abre con el stock de origen y el de destino', async () => {
    const f = montar();
    await f.componentInstance.agregar();

    const opciones = dialogo.abrir.mock.calls[0][1].opciones as OpcionesBuscador;
    expect(opciones.sucursalId).toBe(1);
    expect(opciones.sucursalDestinoId).toBe(3);
  });

  it('cancelar el buscador no guarda nada', async () => {
    const f = montar();
    await f.componentInstance.agregar();

    expect(servicio.guardarItem).not.toHaveBeenCalled();
  });

  it('editar un ítem cargado lo guarda con su id', async () => {
    dialogo.abrir = vi.fn().mockResolvedValueOnce({ cantidad: 5, vencimiento: null, observacion: 'rotas' });
    const f = montar();

    await f.componentInstance.editar(ITEM);

    expect(servicio.guardarItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: 900, cantidadPreTransferencia: 5 }),
    );
  });
});

/**
 * ⚠️ **La lista navega siempre a `/transferencias/:id`**, sin mirar la etapa.
 * El detalle es el que manda al borrador cuando lo que se abrió todavía se
 * está creando: sin eso, un borrador se abre en una pantalla de etapas que no
 * tiene ninguna acción que ofrecerle.
 */
describe('Abrir un borrador desde la lista', () => {
  it('el detalle manda a la carga de productos', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [
        provideRouter([{ path: 'transferencias/:id/borrador', children: [] }]),
        {
          provide: TransferenciaService,
          useValue: {
            porId: vi.fn(() =>
              of({ id: 54_060, etapa: EtapaTransferencia.PRE_TRANSFERENCIA_CREACION }),
            ),
            items: vi.fn(() => of([])),
          },
        },
        { provide: AuthService, useValue: sesion() },
      ],
    });
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const f = TestBed.createComponent(TransferenciaDetallePage);
    f.componentRef.setInput('id', '54060');
    f.detectChanges();
    await f.whenStable();

    expect(navegar).toHaveBeenCalledWith(['/transferencias', 54_060, 'borrador'], {
      replaceUrl: true,
    });
  });
});

describe('Entrada al alta desde la lista', () => {
  const montarConRoles = (roles: string[]) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [
        provideRouter([{ path: 'transferencias/nueva', children: [] }]),
        {
          provide: TransferenciaService,
          useValue: { conFiltros: vi.fn(() => of({ getContent: [], hasNext: false })) },
        },
        { provide: AuthService, useValue: { ...sesion(), roles: signal(roles) } },
      ],
    });
    const f = TestBed.createComponent(TransferenciasListaPage);
    f.detectChanges();
    return f;
  };

  it('con el rol de alta ofrece crear una', () => {
    expect(montarConRoles(['CREAR TRANSFERENCIA']).nativeElement.textContent).toContain(
      'Nueva transferencia',
    );
  });

  /**
   * ⚠️ **Ver transferencias no es crearlas.** Son 257 los usuarios con `VER
   * TRANSFERENCIA`: dejar el botón a la vista para todos ellos convierte una
   * pantalla de consulta en una de alta.
   */
  it('sin el rol de alta no lo ofrece', () => {
    expect(montarConRoles(['VER TRANSFERENCIA']).nativeElement.textContent).not.toContain(
      'Nueva transferencia',
    );
  });
});
