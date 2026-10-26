import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { EscanerService } from '../core/dispositivo/escaner.service';
import { DialogoService } from '../core/ui/dialogo.service';
import { NotificacionService } from '../core/ui/notificacion.service';
import { PdfService } from '../core/ui/pdf.service';
import { RetiroProveedorConsolidado } from '../domains/devolucion/retiro.model';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import type { Persona } from '../domains/personas/persona.model';
import { Proveedor } from '../domains/personas/proveedor.model';
import { Usuario } from '../domains/personas/usuario.model';
import { DevolucionRetiroPage } from '../pages/operaciones/devolucion/devolucion-retiro.page';
import { DevolucionService } from '../pages/operaciones/devolucion/devolucion.service';

/**
 * Retiro a proveedor: la etiqueta es una por devolución, y escanear su QR la
 * verifica entera y muestra todos sus productos.
 */
describe('Devoluciones · retiro a proveedor', () => {
  let servicio: Record<string, ReturnType<typeof vi.fn>>;
  let escaner: { escanear: ReturnType<typeof vi.fn>; disponible: boolean };
  let notificacion: Record<string, ReturnType<typeof vi.fn>>;
  let dialogo: { confirmar: ReturnType<typeof vi.fn> };
  let pdf: { abrirBase64: ReturnType<typeof vi.fn> };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  const consolidado: RetiroProveedorConsolidado = {
    proveedorId: '7',
    grupos: [
      {
        sucursalId: '1',
        sucursalNombre: 'CENTRAL',
        devoluciones: [
          {
            devolucionId: '24',
            identificador: 'DEV-1-24',
            productos: [
              { descripcion: 'CORONITA EXTRA', cantidad: 4, presentacion: 'x1' },
              { descripcion: 'CONTI MALZBIER', cantidad: 9, presentacion: 'x1' },
            ],
          },
          {
            devolucionId: '25',
            identificador: 'DEV-1-25',
            productos: [{ descripcion: 'AGUA SELTZ', cantidad: 6, presentacion: 'x1' }],
          },
        ],
      },
    ],
  };

  const proveedor = { id: 7, persona: { nombre: 'DISTRIBUIDORA' } } as unknown as Proveedor;

  beforeEach(() => {
    localStorage.clear();
    servicio = {
      proveedores: vi.fn(() => of({ getContent: [proveedor] })),
      consolidadoRetiro: vi.fn(() => of(consolidado)),
      configuracionRetiro: vi.fn(() => of({ retiroPermitirSeleccionManual: false })),
      retirar: vi.fn(() => of({ resultados: [{ id: '24', ok: true }] })),
      comprobanteRetiro: vi.fn(() => of('JVBERi0=')),
    };
    escaner = { escanear: vi.fn(async () => 'DEV-1-24'), disponible: true };
    notificacion = { ok: vi.fn(), warn: vi.fn(), danger: vi.fn() };
    dialogo = { confirmar: vi.fn(async () => true) };
    pdf = { abrirBase64: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DevolucionService, useValue: servicio },
        { provide: SucursalService, useValue: { todas: () => of([]) } },
        { provide: EscanerService, useValue: escaner },
        { provide: NotificacionService, useValue: notificacion },
        { provide: DialogoService, useValue: dialogo },
        { provide: PdfService, useValue: pdf },
      ],
    });
    TestBed.inject(AuthService).establecerUsuario(
      Object.assign(new Usuario(), {
        id: 42,
        roles: ['ADMIN'],
        persona: { id: 11, nombre: 'GABRIEL' } as Persona,
      }),
    );
  });

  function conProveedor() {
    const f = TestBed.createComponent(DevolucionRetiroPage);
    f.detectChanges();
    f.componentInstance.elegirProveedor(proveedor);
    f.detectChanges();
    return f;
  }

  it('lista una tarjeta por devolución, no por producto', () => {
    const f = conProveedor();
    expect(servicio['consolidadoRetiro']).toHaveBeenCalledWith(7, null);
    expect(texto(f)).toContain('DEV-1-24');
    expect(texto(f)).toContain('DEV-1-25');
    expect(texto(f)).toContain('2 productos');
    expect(texto(f)).toContain('0 de 2');
  });

  it('escanear el QR verifica la devolución y muestra todos sus productos', async () => {
    const f = conProveedor();
    expect(texto(f)).not.toContain('CORONITA EXTRA');

    await f.componentInstance.escanear();
    f.detectChanges();

    expect(texto(f)).toContain('CORONITA EXTRA');
    expect(texto(f)).toContain('CONTI MALZBIER');
    expect(texto(f)).toContain('1 de 2');
    expect(notificacion['ok']).toHaveBeenCalledWith('DEV-1-24 verificada: 2 productos.');
  });

  it('escanearla dos veces avisa, no la cuenta de nuevo', async () => {
    const f = conProveedor();
    await f.componentInstance.escanear();
    await f.componentInstance.escanear();
    f.detectChanges();

    expect(notificacion['warn']).toHaveBeenCalledWith('DEV-1-24 ya estaba verificada.');
    expect(texto(f)).toContain('1 de 2');
  });

  it('una devolución que no es de este retiro se rechaza', async () => {
    escaner.escanear.mockResolvedValue('DEV-1-99');
    const f = conProveedor();
    await f.componentInstance.escanear();

    expect(notificacion['warn']).toHaveBeenCalledWith(
      'DEV-1-99 no está lista para retirar con este proveedor.',
    );
  });

  it('sin la configuración, no se puede marcar sin escanear', () => {
    const f = conProveedor();
    expect(texto(f)).not.toContain('Marcar sin escanear');
  });

  it('con la configuración, se puede marcar a mano', () => {
    servicio['configuracionRetiro'].mockReturnValue(of({ retiroPermitirSeleccionManual: true }));
    const f = conProveedor();
    expect(texto(f)).toContain('Marcar sin escanear');
  });

  it('retira solo las verificadas y deja el comprobante listo', async () => {
    const f = conProveedor();
    await f.componentInstance.escanear();
    await f.componentInstance.retirar();
    f.detectChanges();

    expect(servicio['retirar']).toHaveBeenCalledWith([24], 42);
    expect(servicio['comprobanteRetiro']).toHaveBeenCalledWith([24]);
    expect(texto(f)).toContain('Ver comprobante');

    f.componentInstance.verComprobante();
    expect(pdf.abrirBase64).toHaveBeenCalledWith('JVBERi0=', 'comprobante-retiro.pdf');
  });

  it('muestra cuál no se pudo retirar y por qué', async () => {
    servicio['retirar'].mockReturnValue(
      of({ resultados: [{ id: '24', ok: false, mensaje: 'Stock insuficiente' }] }),
    );
    const f = conProveedor();
    await f.componentInstance.escanear();
    await f.componentInstance.retirar();
    f.detectChanges();

    expect(texto(f)).toContain('Stock insuficiente');
    expect(servicio['comprobanteRetiro']).not.toHaveBeenCalled();
  });
});
