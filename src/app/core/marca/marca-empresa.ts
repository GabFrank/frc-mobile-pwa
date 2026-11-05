import { apiParaHost } from '../config/api-por-host';

/**
 * Logo de la empresa: farmacia o bodega.
 *
 * Una sola compilación sirve a las dos empresas, así que el logo se elige al
 * correr, por `configuracion_general.nombre_empresa` del central (igual que el
 * desktop). Las imágenes viven en la app, no se piden al servidor.
 *
 * Cambia el ícono de la pestaña, el `apple-touch-icon` y el manifiesto (el
 * ícono y el nombre de la app instalada).
 */
export type MarcaEmpresa = 'bodega' | 'farmacia';

const CLAVE = 'frc.marcaEmpresa';

interface Recursos {
  png: string;
  ico: string;
  appleTouch: string;
  manifiesto: string;
  titulo: string;
}

const RECURSOS: Record<MarcaEmpresa, Recursos> = {
  bodega: {
    png: 'assets/images/frc.png',
    ico: 'favicon.ico',
    appleTouch: 'icons/icon-192x192.png',
    manifiesto: 'manifest.webmanifest',
    titulo: 'Bodega Franco',
  },
  farmacia: {
    png: 'assets/images/frc-farmacia.png',
    ico: 'icons/farmacia/favicon.ico',
    appleTouch: 'icons/farmacia/icon-192x192.png',
    manifiesto: 'manifest-farmacia.webmanifest',
    titulo: 'Farmacia Franco',
  },
};

export function marcaDeEmpresa(nombreEmpresa: string | null | undefined): MarcaEmpresa {
  return (nombreEmpresa ?? '').toUpperCase().includes('FARMACIA') ? 'farmacia' : 'bodega';
}

/**
 * La marca a usar antes de hablar con el central: la última guardada en este
 * dispositivo o, si nunca entró nadie, la que sugiere el host (las puertas que
 * van a `farmacia-api` son de la farmacia).
 */
export function marcaInicial(hostname = location.hostname): MarcaEmpresa {
  const guardada = leerGuardada();
  if (guardada) return guardada;
  return apiParaHost(hostname)?.includes('farmacia-api') ? 'farmacia' : 'bodega';
}

export function guardarMarca(marca: MarcaEmpresa): void {
  try {
    localStorage.setItem(CLAVE, marca);
  } catch {
    // Sin almacenamiento (modo privado): se vuelve a elegir en el próximo login.
  }
}

function leerGuardada(): MarcaEmpresa | null {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'farmacia' || valor === 'bodega' ? valor : null;
  } catch {
    return null;
  }
}

export function aplicarMarca(marca: MarcaEmpresa, doc: Document = document): void {
  const r = RECURSOS[marca];
  doc.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
    cambiarHref(link, link.type === 'image/x-icon' ? r.ico : r.png);
  });
  doc.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((l) => cambiarHref(l, r.appleTouch));
  doc.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]').forEach((l) => cambiarHref(l, r.manifiesto));
  doc
    .querySelectorAll<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    .forEach((m) => m.setAttribute('content', r.titulo));
}

function cambiarHref(link: HTMLLinkElement, href: string): void {
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}
