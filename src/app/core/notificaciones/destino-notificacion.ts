/**
 * A qué pantalla de la PWA lleva una notificación del central.
 *
 * ⚠️ **Los destinos que manda el central son rutas del escritorio**, no de
 * esta app. Se escribieron para `frc-sistemas-integrados-angular` y viajan sin
 * cambios a todos los clientes: `/productos/123`, `/operaciones/ventas/…`,
 * incluso `list-cotizacion`, que no es ni una ruta absoluta. Abrirlos tal cual
 * cae en el comodín `**` y termina en Inicio — la notificación se toca y no
 * pasa nada útil.
 *
 * Traducir acá y no en el central es deliberado: el central le habla a tres
 * clientes con rutas distintas, y hacerle conocer las de cada uno lo obliga a
 * cambiar cada vez que uno de ellos mueve una pantalla.
 *
 * ⚠️ **Nunca devuelve algo que no exista.** Lo que no tiene equivalente cae en
 * `/notificaciones`, no en Inicio: el toque vino de una notificación y su
 * lista es la respuesta honesta —ahí está el aviso completo—, mientras que
 * Inicio no dice nada sobre lo que se acaba de tocar.
 */

/** Lo que se abre cuando el destino no tiene equivalente en la PWA. */
export const DESTINO_POR_DEFECTO = '/notificaciones';

interface Regla {
  /** Se prueba contra la ruta ya normalizada, sin barra final. */
  patron: RegExp;
  /** `$1`, `$2`… son los grupos del patrón. */
  destino: string;
}

/**
 * El orden importa: la primera que coincide gana. Las más específicas van
 * antes que las genéricas —`/operaciones/transferencias/7` tiene que ganarle
 * a cualquier regla que empiece con `/operaciones`—.
 */
const REGLAS: readonly Regla[] = [
  // Coinciden tal cual: el id significa lo mismo de los dos lados.
  { patron: /^\/inventario\/(\d+)$/, destino: '/inventario/$1' },
  { patron: /^\/inventario$/, destino: '/inventario' },

  // Mismo recurso, distinta ruta.
  { patron: /^\/operaciones\/transferencias\/(\d+)$/, destino: '/transferencias/$1' },
  { patron: /^\/operaciones\/transferencias$/, destino: '/transferencias' },
  { patron: /^\/productos\/(\d+)$/, destino: '/producto/$1' },
  { patron: /^\/productos$/, destino: '/buscar' },

  /*
    Caja chica: el central lo llama «financiero», que es el nombre del módulo
    del escritorio. Acá los gastos y los retiros son la misma pantalla, y el
    id no se puede usar —la PWA lista, no abre un gasto suelto—.
  */
  { patron: /^\/financiero\/gastos(\/.*)?$/, destino: '/operaciones/gastos' },
  { patron: /^\/financiero\/retiros(\/.*)?$/, destino: '/operaciones/gastos' },

  /*
    El análisis de diferencia de caja es una pantalla del escritorio que la
    PWA no tiene. Lo más cerca es la caja, donde se ve el arqueo.
  */
  { patron: /^\/financiero\/analisis-diferencia(\/.*)?$/, destino: '/operaciones/caja' },

  /*
    Compras a crédito del funcionario: en la PWA es «Mis finanzas», y el
    detalle se abre desde ahí. El id de venta no tiene ruta propia.
  */
  { patron: /^\/mis-compras\/credito(\/.*)?$/, destino: '/mis-finanzas' },

  // Seguridad de la cuenta.
  { patron: /^\/configuracion\/seguridad$/, destino: '/cuenta' },
  { patron: /^\/configuracion(\/.*)?$/, destino: '/cuenta' },

  // La raíz es Inicio, y eso sí es lo que corresponde.
  { patron: /^\/$/, destino: '/inicio' },
];

/**
 * Traduce el destino de una notificación a una ruta de esta app.
 *
 * Acepta tanto la ruta cruda del central (`/productos/123`) como una URL
 * entera (`https://app/productos/123`), porque el service worker entrega una
 * y el `Router` la otra.
 */
export function destinoDeNotificacion(valor: string | null | undefined): string {
  const ruta = normalizar(valor);
  if (!ruta) {
    return DESTINO_POR_DEFECTO;
  }

  for (const regla of REGLAS) {
    const coincide = ruta.match(regla.patron);
    if (coincide) {
      return regla.destino.replace(/\$(\d)/g, (_, n: string) => coincide[Number(n)] ?? '');
    }
  }

  // Lo que ya es una ruta de esta app pasa derecho.
  return RUTAS_PROPIAS.has(ruta) ? ruta : DESTINO_POR_DEFECTO;
}

/**
 * Destinos de esta app que se aceptan tal cual.
 *
 * Cubre lo que el central manda por `manual(...)`, donde el destino lo escribe
 * quien dispara la notificación y bien puede ser una ruta de la PWA.
 *
 * ⚠️ **Coincidencia exacta, no por prefijo.** Comparar por prefijo dejaba
 * pasar `/operaciones/ventas/45/2` por empezar con `/operaciones` — una ruta
 * que no existe acá. El comodín la volvía a atrapar, el traductor la devolvía
 * igual, y quedaba un bucle de redirección. Lo agarró el spec.
 *
 * ⚠️ **Sostener esta lista al agregar una pantalla.** Si falta, un destino
 * válido termina en la lista de notificaciones: no se rompe nada, pero el
 * toque deja de llevar donde llevaba.
 */
const RUTAS_PROPIAS: ReadonlySet<string> = new Set([
  '/inicio',
  '/operaciones',
  '/operaciones/caja',
  '/operaciones/gastos',
  '/operaciones/recepcion',
  '/operaciones/devolucion',
  '/operaciones/solicitud-pago',
  '/operaciones/venta-tarjeta',
  '/mi-trabajo',
  '/mi-trabajo/aprobaciones',
  '/inventario',
  '/inventario/control',
  '/inventario/lugares',
  '/transferencias',
  '/notificaciones',
  '/marcacion',
  '/mis-finanzas',
  '/buscar',
  '/producto/vencidos',
  '/cuenta',
  '/cuenta/rostro',
  '/kiosco',
]);

/**
 * Deja la ruta en su forma comparable: sin origen, sin query, sin fragmento y
 * sin barra final. Todo lo que no sea una ruta absoluta se descarta —
 * `list-cotizacion`, que manda el central para la cotización, no es una ruta
 * de ningún lado—.
 */
function normalizar(valor: string | null | undefined): string | null {
  const texto = String(valor ?? '').trim();
  if (!texto) {
    return null;
  }

  let ruta = texto;
  if (/^https?:\/\//i.test(ruta)) {
    try {
      ruta = new URL(ruta).pathname;
    } catch {
      return null;
    }
  }

  if (!ruta.startsWith('/')) {
    return null;
  }

  ruta = ruta.split('?')[0].split('#')[0];
  // La raíz se conserva; el resto pierde la barra final.
  return ruta.length > 1 ? ruta.replace(/\/+$/, '') : ruta;
}
