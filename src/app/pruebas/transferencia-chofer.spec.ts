import { TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { EtapaTransferencia, Transferencia } from '../domains/transferencia/transferencia.model';
import { AsignarChoferDialogComponent } from '../pages/transferencias/asignar-chofer-dialog.component';
import {
  accionDeEtapa,
  puedeEditarEtapa,
  responsableDeEtapa,
} from '../pages/transferencias/etapas';
import { TransferenciaDetallePage } from '../pages/transferencias/transferencia-detalle.page';
import { TransferenciaService } from '../pages/transferencias/transferencia.service';
import { APOLLO_DE_PRUEBA } from './apollo-de-prueba';

const chofer = { id: 10, nickname: 'juan', persona: { id: 100, nombre: 'Juan Pérez' } };
const vehiculo = { id: 3, chapa: 'ABC 123' };
const persona = (id: number) => ({ id, nombre: 'P' + id });

/**
 * En la PWA, verificar para transporte arranca eligiendo al chofer: él queda
 * como responsable de la etapa, no el que tiene la sesión abierta. Es lo que
 * el central hace con `verificarParaTransporteMobile`.
 */
describe('Verificar para transporte pide el chofer', () => {
  it('solo el paso a transporte exige elegir chofer', () => {
    const en = (etapa: EtapaTransferencia) => accionDeEtapa({ id: 1, etapa });
    expect(en(EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA)?.exigeChofer).toBe(true);
    expect(en(EtapaTransferencia.PREPARACION_MERCADERIA)?.exigeChofer).toBe(false);
    expect(en(EtapaTransferencia.TRANSPORTE_VERIFICACION)?.exigeChofer).toBe(false);
    expect(en(EtapaTransferencia.TRANSPORTE_EN_CAMINO)?.exigeChofer).toBe(false);
  });

  describe('en el detalle', () => {
    let servicio: {
      porId: ReturnType<typeof vi.fn>;
      items: ReturnType<typeof vi.fn>;
      avanzarEtapa: ReturnType<typeof vi.fn>;
    };
    let dialogo: { abrir: ReturnType<typeof vi.fn>; confirmar: ReturnType<typeof vi.fn> };

    const montar = (transferencia: Partial<Transferencia>, items: object[] = [{ id: 1 }]) => {
      servicio = {
        porId: vi.fn(() => of({ id: 1, ...transferencia })),
        items: vi.fn(() => of(items)),
        avanzarEtapa: vi.fn(() => of(true)),
      };
      dialogo = { abrir: vi.fn(), confirmar: vi.fn(async () => true) };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [APOLLO_DE_PRUEBA],
        providers: [
          { provide: TransferenciaService, useValue: servicio },
          { provide: DialogoService, useValue: dialogo },
          { provide: AuthService, useValue: { usuario: () => ({ id: 8 }) } },
        ],
      });
      const f = TestBed.createComponent(TransferenciaDetallePage);
      f.componentRef.setInput('id', '1');
      f.detectChanges();
      return f.componentInstance;
    };

    it('abre el diálogo del chofer en vez de avanzar con el usuario logueado', async () => {
      const pagina = montar({ etapa: EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA });
      dialogo.abrir.mockResolvedValue(undefined);

      await pagina.avanzar(pagina.accion()!);

      expect(dialogo.abrir).toHaveBeenCalledWith(
        AsignarChoferDialogComponent,
        { transferenciaId: 1 },
        expect.anything(),
      );
      expect(servicio.avanzarEtapa).not.toHaveBeenCalled();
    });

    it('si el diálogo verificó, recarga la transferencia', async () => {
      const pagina = montar({ etapa: EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA });
      dialogo.abrir.mockResolvedValue(true);

      await pagina.avanzar(pagina.accion()!);

      expect(servicio.porId).toHaveBeenCalledTimes(2);
    });

    it('si se cancela, no recarga ni avanza', async () => {
      const pagina = montar({ etapa: EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA });
      dialogo.abrir.mockResolvedValue(undefined);

      await pagina.avanzar(pagina.accion()!);

      expect(servicio.porId).toHaveBeenCalledTimes(1);
    });

    it('las demás etapas siguen avanzando como antes', async () => {
      const pagina = montar(
        {
          etapa: EtapaTransferencia.PREPARACION_MERCADERIA,
          usuarioPreparacion: { id: 8, persona: { nombre: 'U8' } } as never,
        },
        [{ id: 1, cantidadPreparacion: 3 }],
      );

      await pagina.avanzar(pagina.accion()!);

      expect(dialogo.abrir).not.toHaveBeenCalled();
      expect(servicio.avanzarEtapa).toHaveBeenCalledWith(
        1,
        EtapaTransferencia.PREPARACION_MERCADERIA_CONCLUIDA,
        8,
      );
    });
  });
});

describe('La verificación para transporte no es solo del chofer', () => {
  const enTransporte = {
    id: 1,
    etapa: EtapaTransferencia.TRANSPORTE_VERIFICACION,
    usuarioTransporte: { id: 10, persona: { nombre: 'Juan Pérez' } } as never,
  };

  it('otro usuario puede revisar los ítems y despachar', () => {
    expect(puedeEditarEtapa(enTransporte, 8)).toBe(true);
    expect(puedeEditarEtapa(enTransporte, 10)).toBe(true);
  });

  it('sin sesión no', () => {
    expect(puedeEditarEtapa(enTransporte, null)).toBe(false);
  });

  it('el chofer sigue siendo el responsable que se muestra', () => {
    expect(responsableDeEtapa(enTransporte)?.id).toBe(10);
  });

  it('las otras etapas siguen siendo de quien las tomó', () => {
    const enPreparacion = {
      id: 1,
      etapa: EtapaTransferencia.PREPARACION_MERCADERIA,
      usuarioPreparacion: { id: 10 } as never,
    };
    expect(puedeEditarEtapa(enPreparacion, 8)).toBe(false);
  });
});

describe('El diálogo del chofer', () => {
  let servicio: { verificarParaTransporte: ReturnType<typeof vi.fn> };
  let dialogo: { abrir: ReturnType<typeof vi.fn>; confirmar: ReturnType<typeof vi.fn> };
  let ref: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    servicio = { verificarParaTransporte: vi.fn(() => of({ id: 1 })) };
    dialogo = { abrir: vi.fn(), confirmar: vi.fn(async () => true) };
    ref = { close: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [APOLLO_DE_PRUEBA],
      providers: [
        { provide: TransferenciaService, useValue: servicio },
        { provide: DialogoService, useValue: dialogo },
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { transferenciaId: 1 } },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(AsignarChoferDialogComponent);
    f.detectChanges();
    return f.componentInstance;
  };

  const conChoferYVehiculo = async () => {
    const d = montar();
    dialogo.abrir.mockResolvedValueOnce(chofer);
    await d.elegirChofer();
    dialogo.abrir.mockResolvedValueOnce(vehiculo);
    await d.elegirVehiculo();
    return d;
  };

  it('no deja confirmar sin chofer o sin vehículo', async () => {
    const d = montar();
    expect(d.puedeConfirmar()).toBe(false);

    dialogo.abrir.mockResolvedValueOnce(chofer);
    await d.elegirChofer();
    expect(d.puedeConfirmar()).toBe(false);

    dialogo.abrir.mockResolvedValueOnce(vehiculo);
    await d.elegirVehiculo();
    expect(d.puedeConfirmar()).toBe(true);
  });

  it('el chofer no puede ir como acompañante, ni un acompañante dos veces', async () => {
    const d = await conChoferYVehiculo();

    dialogo.abrir.mockResolvedValueOnce(persona(100));
    await d.agregarAcompanante();
    dialogo.abrir.mockResolvedValueOnce(persona(200));
    await d.agregarAcompanante();
    dialogo.abrir.mockResolvedValueOnce(persona(200));
    await d.agregarAcompanante();

    expect(d.acompanantes().map((p) => p.id)).toEqual([200]);
  });

  it('elegir como chofer a un acompañante lo saca de la lista', async () => {
    const d = montar();
    dialogo.abrir.mockResolvedValueOnce(persona(100));
    await d.agregarAcompanante();

    dialogo.abrir.mockResolvedValueOnce(chofer);
    await d.elegirChofer();

    expect(d.acompanantes()).toEqual([]);
  });

  it('manda el chofer elegido, el vehículo y los acompañantes, y cierra', async () => {
    const d = await conChoferYVehiculo();
    dialogo.abrir.mockResolvedValueOnce(persona(200));
    await d.agregarAcompanante();

    await d.confirmar();

    expect(dialogo.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: expect.stringContaining('Juan Pérez') }),
    );
    expect(servicio.verificarParaTransporte).toHaveBeenCalledWith({
      transferenciaId: 1,
      choferUsuarioId: 10,
      vehiculoId: 3,
      acompanantesIds: [200],
    });
    expect(ref.close).toHaveBeenCalledWith(true);
  });

  it('si no confirma el aviso, no manda nada', async () => {
    const d = await conChoferYVehiculo();
    dialogo.confirmar.mockResolvedValueOnce(false);

    await d.confirmar();

    expect(servicio.verificarParaTransporte).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('si el central rechaza, queda abierto con lo cargado', async () => {
    const d = await conChoferYVehiculo();
    servicio.verificarParaTransporte.mockReturnValueOnce(throwError(() => new Error('etapa')));

    await d.confirmar();

    expect(ref.close).not.toHaveBeenCalled();
    expect(d.enviando()).toBe(false);
    expect(d.chofer()?.id).toBe(10);
  });
});
