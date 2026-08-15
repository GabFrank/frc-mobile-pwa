import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Location, TitleCasePipe } from '@angular/common';

import { DialogoService } from 'src/app/core/ui/dialogo.service';
import { NotificacionService } from 'src/app/core/ui/notificacion.service';
import { Sector } from 'src/app/domains/sector/sector.model';
import { SectorService } from 'src/app/domains/sector/sector.service';
import { Zona } from 'src/app/domains/zona/zona.model';
import { ZonaService } from 'src/app/domains/zona/zona.service';
import { CardComponent } from 'src/app/shared/card/card.component';
import { EstadoChipComponent } from 'src/app/shared/estado/estado-chip.component';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { EstadoVacioComponent } from 'src/app/shared/estados-ui/estado-vacio.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { DatoComponent } from 'src/app/shared/layout/dato.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';
import { fechaLegible } from 'src/app/generic/utils/dateUtils';
import { DatosLugar, LugarDialogComponent, ResultadoLugar } from './lugar-dialog.component';

/**
 * Un sector y sus zonas.
 *
 * ⚠️ **Dar de baja un sector no es lo mismo que desactivarlo.** El central
 * borra la fila; si tiene zonas colgando, la baja falla por integridad
 * referencial. Por eso el diálogo ofrece el toggle *Activo*, que es lo que
 * se usa el 99% de las veces: un sector inactivo deja de ofrecerse en tomas
 * nuevas sin tocar el histórico de las viejas.
 *
 * ⚠️ **Las zonas se releen del sector, no se parchean en memoria.** Guardar
 * una zona devuelve la zona, no el sector; recalcular la lista a mano
 * dejaría el conteo del listado anterior desactualizado en cuanto alguien
 * agregue dos seguidas.
 */
@Component({
  selector: 'frc-sector-detalle',
  standalone: true,
  imports: [
    PaginaComponent,
    SeccionComponent,
    DatoComponent,
    CardComponent,
    EstadoChipComponent,
    SkeletonComponent,
    EstadoVacioComponent,
    EstadoErrorComponent,
    MatButtonModule,
    TitleCasePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!--
      Titlecase en pantalla, mayúsculas al guardar. Es el par que usa
      frc-mobile, y hay que tomarlo entero: en la base conviven 35 sectores
      en minúscula con 6 en mayúscula, así que mostrar el texto crudo
      dejaría la lista pareciendo dos cargas distintas.
    -->
    <frc-pagina [titulo]="titulo() | titlecase" [conVolver]="true">
      @if (sector(); as s) {
        <div acciones>
          <button matButton (click)="editarSector(s)">Editar sector</button>
          <button matButton="filled" (click)="nuevaZona(s)">Nueva zona</button>
        </div>
      }

      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
      } @else if (sector(); as s) {
        <frc-seccion titulo="Sector" [panel]="true">
          <frc-dato etiqueta="Descripción" [valor]="(s.descripcion ?? '—') | titlecase" />
          <frc-dato etiqueta="Sucursal" [valor]="s.sucursal?.nombre ?? '—'" />
          <frc-dato etiqueta="Estado" [valor]="s.activo === false ? 'Inactivo' : 'Activo'" />
          @if (s.creadoEn) {
            <frc-dato etiqueta="Creado" [valor]="fecha(s.creadoEn)" />
          }
        </frc-seccion>

        @if (zonas().length === 0) {
          <frc-estado-vacio
            titulo="Sin zonas"
            detalle="Sin zonas no se puede contar este sector: la zona es lo que se le asigna a cada persona."
            icono="inventario"
          />
        } @else {
          <frc-seccion [titulo]="'Zonas (' + zonas().length + ')'">
            @for (z of zonas(); track z.id) {
              <frc-card
                [titulo]="(z.descripcion ?? 'Zona') | titlecase"
                icono="inventario"
                (abrir)="editarZona(z, s)"
              >
                @if (z.activo === false) {
                  <frc-estado-chip aparte etiqueta="Inactiva" tono="neutral" />
                }
              </frc-card>
            }
          </frc-seccion>
        }
      }
    </frc-pagina>
  `,
})
export class SectorDetallePage {
  private readonly sectores = inject(SectorService);
  private readonly zonasServicio = inject(ZonaService);
  private readonly dialogo = inject(DialogoService);
  private readonly notificacion = inject(NotificacionService);
  private readonly location = inject(Location);

  /** Input opcional: el router lo asigna después de construir (NG0950). */
  readonly sectorId = input<string>();

  readonly sector = signal<Sector | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly zonas = computed(() => this.sector()?.zonaList ?? []);
  readonly titulo = computed(() => this.sector()?.descripcion ?? 'Sector');

  constructor() {
    effect(() => {
      if (this.sectorId() !== undefined) {
        this.cargar();
      }
    });
  }

  cargar(): void {
    const id = Number(this.sectorId());
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Identificador de sector inválido.');
      this.cargando.set(false);
      return;
    }
    this.cargando.set(true);
    this.error.set(null);

    this.sectores.porId(id).subscribe({
      next: (s) => {
        this.sector.set(s ?? null);
        this.cargando.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.cargando.set(false);
      },
    });
  }

  fecha(valor: Date | string | undefined): string {
    return fechaLegible(valor as string | undefined) ?? '—';
  }

  async editarSector(s: Sector): Promise<void> {
    const res = await this.dialogo.abrir<LugarDialogComponent, DatosLugar, ResultadoLugar>(
      LugarDialogComponent,
      {
        tipo: 'sector',
        descripcion: s.descripcion,
        activo: s.activo !== false,
        contexto: s.sucursal?.nombre,
        puedeEliminar: true,
      },
    );
    if (!res) {
      return;
    }

    if (res.accion === 'eliminar') {
      await this.eliminarSector(s);
      return;
    }

    this.sectores
      .guardar({
        id: s.id,
        sucursalId: s.sucursal?.id,
        descripcion: res.descripcion,
        activo: res.activo,
      })
      .subscribe({
        next: () => this.cargar(),
        error: (err: Error) => this.notificacion.danger(err.message),
      });
  }

  private async eliminarSector(s: Sector): Promise<void> {
    if (s.id == null) {
      return;
    }
    const tieneZonas = this.zonas().length > 0;
    const ok = await this.dialogo.confirmar({
      titulo: 'Eliminar sector',
      mensaje: tieneZonas
        ? `«${s.descripcion}» tiene ${this.zonas().length} zonas. El central no lo va a dejar borrar mientras cuelguen de él; si lo que querés es sacarlo de circulación, desactivalo.`
        : `Se elimina «${s.descripcion}». Los conteos viejos que lo mencionan quedan sin sector.`,
      confirmar: 'Eliminar',
    });
    if (!ok) {
      return;
    }

    this.sectores.eliminar(s.id).subscribe({
      next: (borrado) => {
        if (borrado) {
          this.location.back();
        } else {
          this.notificacion.warn('El central no eliminó el sector.');
        }
      },
      error: (err: Error) => this.notificacion.danger(err.message),
    });
  }

  async nuevaZona(s: Sector): Promise<void> {
    const res = await this.dialogo.abrir<LugarDialogComponent, DatosLugar, ResultadoLugar>(
      LugarDialogComponent,
      { tipo: 'zona', contexto: s.descripcion },
    );
    if (res?.accion !== 'guardar') {
      return;
    }

    this.zonasServicio
      .guardar({ sectorId: s.id, descripcion: res.descripcion, activo: res.activo })
      .subscribe({
        next: () => this.cargar(),
        error: (err: Error) => this.notificacion.danger(err.message),
      });
  }

  async editarZona(z: Zona, s: Sector): Promise<void> {
    const res = await this.dialogo.abrir<LugarDialogComponent, DatosLugar, ResultadoLugar>(
      LugarDialogComponent,
      {
        tipo: 'zona',
        descripcion: z.descripcion,
        activo: z.activo !== false,
        contexto: s.descripcion,
        puedeEliminar: true,
      },
    );
    if (!res) {
      return;
    }

    if (res.accion === 'eliminar') {
      await this.eliminarZona(z);
      return;
    }

    this.zonasServicio
      .guardar({
        id: z.id,
        sectorId: s.id,
        descripcion: res.descripcion,
        activo: res.activo,
      })
      .subscribe({
        next: () => this.cargar(),
        error: (err: Error) => this.notificacion.danger(err.message),
      });
  }

  private async eliminarZona(z: Zona): Promise<void> {
    if (z.id == null) {
      return;
    }
    const ok = await this.dialogo.confirmar({
      titulo: 'Eliminar zona',
      // Una zona con conteos encima no se borra: el central rechaza la baja.
      mensaje: `Se elimina «${z.descripcion}». Si ya se contó algo en ella, el central va a rechazarlo — en ese caso desactivala.`,
      confirmar: 'Eliminar',
    });
    if (!ok) {
      return;
    }

    this.zonasServicio.eliminar(z.id).subscribe({
      next: (borrado) => {
        if (borrado) {
          this.cargar();
        } else {
          this.notificacion.warn('El central no eliminó la zona.');
        }
      },
      error: (err: Error) => this.notificacion.danger(err.message),
    });
  }
}
