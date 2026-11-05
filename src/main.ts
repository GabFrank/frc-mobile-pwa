import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { aplicarMarca, marcaInicial } from './app/core/marca/marca-empresa';

// Antes de arrancar: el logo de la farmacia o de la bodega, el último que se usó en este dispositivo.
aplicarMarca(marcaInicial());

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
