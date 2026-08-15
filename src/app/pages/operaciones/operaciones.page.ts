import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { CardComponent } from 'src/app/shared/card/card.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';

@Component({
  selector: 'frc-operaciones',
  standalone: true,
  imports: [PaginaComponent, CardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina titulo="Operaciones">
      @if (puedeCaja()) {
        <frc-card
          titulo="Caja"
          subtitulo="Apertura, cierre y arqueo"
          icono="dinero"
          (abrir)="ir('/operaciones/caja')"
        />
      }

      <!--
        Caja chica, Solicitudes de pago y Devoluciones quedan sin rol a
        propósito: las dos primeras porque los roles de tesorería no están
        repartidos —exigirlos las escondería para todos menos ADMIN— y
        Devoluciones porque el sistema no tiene un rol para eso. Ver
        permisos.ts.
      -->
      <frc-card
        titulo="Caja chica"
        subtitulo="Solicitudes de gasto y retiros"
        icono="documento"
        (abrir)="ir('/operaciones/gastos')"
      />

      @if (puedeVentaTarjeta()) {
        <frc-card
          titulo="Venta con tarjeta"
          subtitulo="Registrar el cupón del POS"
          icono="etiqueta"
          (abrir)="ir('/operaciones/venta-tarjeta')"
        />
      }

      @if (puedeRecepcion()) {
        <frc-card
          titulo="Recepción de mercadería"
          subtitulo="Recibir las notas del proveedor"
          icono="camion"
          (abrir)="ir('/operaciones/recepcion')"
        />
      }

      <frc-card
        titulo="Solicitudes de pago"
        subtitulo="Pedir autorización para pagar al proveedor"
        icono="dinero"
        (abrir)="ir('/operaciones/solicitud-pago')"
      />

      <frc-card
        titulo="Devoluciones"
        subtitulo="Productos averiados o vencidos"
        icono="tirar"
        (abrir)="ir('/operaciones/devolucion')"
      />
    </frc-pagina>
  `,
})
export class OperacionesPage {
  private readonly auth = inject(AuthService);
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);

  puedeCaja(): boolean {
    return this.roleService.tieneAlgunRol(this.auth.roles(), PERMISOS.caja);
  }

  /**
   * ⚠️ Muy poca gente tiene `RECIBIR PEDIDOS` hoy. Si el personal de depósito
   * dice que la opción no aparece, el arreglo es asignarles el rol.
   */
  puedeRecepcion(): boolean {
    return this.roleService.tieneAlgunRol(this.auth.roles(), PERMISOS.recepcion);
  }

  puedeVentaTarjeta(): boolean {
    return this.roleService.tieneAlgunRol(this.auth.roles(), PERMISOS.ventaTarjeta);
  }

  ir(ruta: string): void {
    void this.router.navigate([ruta]);
  }
}
