import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ConfiguracionGeneralGQL } from 'src/app/graphql/operaciones/configuracion-general/configuracion-general';
import { DatosService } from '../graphql/datos.service';
import { aplicarMarca, guardarMarca, marcaDeEmpresa } from './marca-empresa';

/**
 * Lee el nombre de la empresa del central y pone su logo. Se llama al cargar
 * la sesión; el resultado queda guardado para el próximo arranque, que lo
 * aplica en `main.ts` antes de mostrar nada.
 */
@Injectable({ providedIn: 'root' })
export class MarcaEmpresaService {
  private readonly datos = inject(DatosService);
  private readonly configuracionGeneralGQL = inject(ConfiguracionGeneralGQL);

  async cargar(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.datos.consultar(this.configuracionGeneralGQL, undefined, {
          mostrarCarga: false,
          notificarError: false,
          gql: { fetchPolicy: 'network-only' },
        }),
      );
      const nombre = (config?.nombreEmpresa ?? '').trim();
      // Sin fila de configuración no se sabe la empresa: queda la marca que ya estaba.
      if (!nombre) return;
      const marca = marcaDeEmpresa(nombre);
      guardarMarca(marca);
      aplicarMarca(marca);
    } catch {
      // Es solo el logo: si el central no contesta, queda el que estaba.
    }
  }
}
