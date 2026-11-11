# Plan #137: un precio en otra moneda inactivo se muestra y se edita en su moneda

Issue: GabFrank/frc-mobile-pwa#137. Rama: `fix/precios-moneda-inactivos`, **sobre `fix/precios-sucursal-central` (#135,
PR #138, sin mergear)**: toca el mismo archivo. El PR va a `develop` y muestra también los commits de #135 hasta que
ese se mergee. Pieza: **mobile-pwa** solamente (el central lo lleva Gabriel y no hace falta).

## Problema

`PreciosPage` toma la moneda de cada precio de `MonedasSesion.preciosOtraMoneda`, la lista `preciosEnOtraMoneda` del
central, que trae **solo los activos** (`PrecioPorSucursalRepository.findConMoneda`). Un precio en USD inactivo no está
y la pantalla lo trata como de la moneda de la empresa:

- se muestra «₲ 5» en vez de «US$ 4,50» (alpha, 11/11/2026);
- **editar el importe** abre la máscara de guaraníes y la mutation sale sin `monedaId`; el central conserva la moneda
  guardada: **30.000 pensados en guaraníes quedan como 30.000 US$**;
- activar/desactivar no pierde nada (el central conserva la moneda), pero la pantalla mintió hasta ese momento.

## Enfoque

La pantalla pide, **aparte**, la moneda de todos los precios del producto, activos o no: la misma forma que usa el
escritorio (`monedaDePreciosDeProductoQuery`, desktop `preciosMoneda.ts`):
`producto(id) { presentaciones { precios { id moneda { id denominacion simbolo decimales } } } }`. El campo
`PrecioPorSucursal.moneda` existe en el central desde V260.5, el mismo que trae `preciosEnOtraMoneda`.

- **Aparte, no en la query de siempre:** contra un central sin `moneda` falla solo esta lectura, no la pantalla. La
  query principal (`graphql/productos/graphql-query.ts:154`) no se toca. Pide solo `id` y los campos de moneda que se
  usan.
- **Solo si el central soporta precios en otra moneda** (`preciosMonedaSoportado`). `preciosEnOtraMoneda` y
  `PrecioPorSucursal.moneda` nacieron juntos (V260.5, commit 1d153195), así que es un indicador confiable. Si no lo
  soporta, ningún precio está en otra moneda y no se pide nada: bodega y farmacia hoy, sin cambios.
- **Sin caché y sin respuestas viejas** (B3): `fetchPolicy: 'network-only'`, `notificarError: false`, y se descarta la
  respuesta si en el medio cambió el producto o llegó una lectura más nueva (contador, como `PrecioMonedaService`).
- **Qué moneda tiene un precio:** si la lectura por producto respondió, **gana siempre** (moneda = la suya; sin moneda
  = la de la empresa), también para los activos, que la lista de la sesión puede tener vieja (B6). Si no respondió, la
  lista de la sesión, como hoy. Un precio que la lectura no trae (creado después) es **desconocido**, no de la empresa
  (B4). Las claves, `String(p.id)`.
- **«No sé» no es guaraníes** (PATRONES §6): un precio **inactivo** sin moneda conocida (lectura en curso, fallida o
  sin ese precio) muestra el número **sin símbolo** con la etiqueta «Moneda sin confirmar» —`frc-importe` no sabe
  mostrar «sin moneda», pone ₲ (B2)—, y **«Editar» queda deshabilitado** con una ayuda visible en la fila, ligada al
  botón con `aria-describedby` (B8). Si la lectura falló, aviso inline con «Reintentar». Activar/desactivar, marcar
  principal (y su degradación) y eliminar siguen: no tocan el importe, y sin moneda conocida no se manda `monedaId`, así
  que el central conserva la guardada (verificado: `PrecioPorSucursalGraphQL.java:135-152`; mandar la de la empresa
  la borraría, por eso nunca se manda).
- **Las dos listas** (B1): la de precios editables y la de «Precios de una sucursal» usan la misma regla.
- **Recargar sin parpadear** (B5): mientras se relee tras guardar, se usa el último mapa bueno; si la recarga falla,
  se conserva y se ofrece «Reintentar».
- **El selector de moneda del alta** cuenta también los precios en otra moneda de la lectura por producto (B7).
- **Fuera de alcance (A1):** si la lista de la sesión falla por un corte momentáneo, la PWA cree que el central no
  maneja monedas y **todos** los precios en USD, activos incluidos, se ven en guaraníes. Pasa hoy y es más amplio que
  esta issue; se anota aparte.

**Descartado:**
- Cambiar `findConMoneda` del central para que traiga los inactivos: lo usan el escritorio y el kiosco, y lo lleva
  Gabriel. Queda anotado en la issue.
- Pedir la moneda precio por precio al tocar «Editar»: una lectura por producto alcanza y deja bien la vista.
- Bloquear «Editar» de todos los inactivos siempre: con la lectura disponible no hace falta.

## Fase única

- `graphql/operaciones/moneda`: query `monedaDePreciosDeProductoQuery` (alias `data:`) y `MonedaDePreciosDeProductoGQL`.
- `domains/moneda/precio-moneda.ts`: función pura `monedasDePreciosDeProducto(producto)` → `Map<precioId, Moneda | null>`
  (`null` = la de la empresa), con test.
- `precios.page.ts`:
  - señales `monedasDelProducto` (mapa o `null`), `cargandoMonedasDelProducto`, `errorMonedasDelProducto`; carga cuando
    hay producto y el central soporta la moneda; «Reintentar»; recarga tras guardar;
  - `monedaGuardada(p)`, `monedaDesconocida(p)`; `referencia(p)` y `monedaIdDe(p)` las usan;
  - plantilla: importe con «moneda sin confirmar» y «Editar» deshabilitado con ayuda cuando `monedaDesconocida(p)`;
    aviso inline si la lectura falló.
- **Tests** (`producto-precios.spec.ts` y `precio-moneda.spec`, fallan con el código viejo):
  - función pura: precio sin moneda → `null` (empresa), con moneda → la moneda; un id que no está → ausente;
  - un USD inactivo (fuera de la lista de la sesión) se muestra en US$ y al editar manda `monedaId` 3;
  - la lectura por producto gana sobre la sesión también para un activo;
  - si la lectura falla: «Editar» deshabilitado para el inactivo (con la ayuda), número sin símbolo, aviso con
    «Reintentar»; activar no manda `monedaId`; marcar principal degrada un inactivo desconocido sin `monedaId`;
  - un precio que la lectura no trae, inactivo → desconocido;
  - un precio inactivo en «Precios de una sucursal» usa la misma regla;
  - la recarga tras guardar pide sin caché y una respuesta vieja (otro producto) se descarta;
  - central sin soporte de moneda: no se pide la lectura y todo sigue como antes.
- `docs/PLAN_TESTEO_MANUAL.md`: bloque nuevo y totales. `docs/modulos/producto.md`: la regla.

## Contrato y canales (eje A)

Una lectura nueva del lado de la PWA, sin cambios en el central: `producto(id)` y `PrecioPorSucursal.moneda` existen
desde V260.5 (alpha). Bodega y farmacia (sin V260.5) no la piden porque `preciosMonedaSoportado` es `false`; si la
pidieran, fallaría solo esa lectura.

## Pruebas de runtime

PWA local contra el central alpha, usuario MR, BANES FORTE:
1. Precio 10 en 4,50 US$ inactivo: se muestra «US$ 4,50»; «Editar» abre la máscara en US$; guardar manda `monedaId` 3.
2. Lectura que falla (XHR cortado en el navegador): el inactivo muestra «moneda sin confirmar», «Editar» deshabilitado,
   «Activar» anda; «Reintentar» lo arregla.
3. Regresión: precios activos en Gs y en USD, igual que antes; agregar y marcar principal siguen.

Al terminar: precio 10 de nuevo en 20.735 Gs, activo y principal.

## Auditoría (paso 5, 11/11/2026)

| # | Hallazgo | Qué se hizo |
|---|---|---|
| A1 | Un corte de la lista de la sesión deja `soportado` en falso y todo USD se ve en Gs | Fuera de alcance (más amplio, pasa hoy); se anota aparte |
| A2 | Un central sin `moneda` rechaza la query entera | Lectura aparte; la query principal no se toca |
| A3 | `producto(id)` y `moneda` resuelven; costo de una query más por pantalla | Aceptado; solo `id` y campos de moneda |
| A4 | Las dos lecturas pueden diferir | Claves por id; ausente = desconocido |
| A5 | Otras pantallas con precios | Kiosco muestra el principal (activo); solo esta pantalla edita |
| B1 | La lista de solo lectura seguía con ₲ | Las dos listas con la misma regla |
| B2 | `frc-importe` no muestra «sin moneda» | Número sin símbolo + etiqueta |
| B3 | Caché tras guardar; respuestas viejas | `network-only`, contador y control del producto |
| B4 | Precio ausente del mapa | Desconocido, no de la empresa |
| B5 | Parpadeo y fallo en la recarga | Último mapa bueno durante la recarga |
| B6 | Conflicto sesión/producto | Gana la lectura por producto |
| B7 | Selector de moneda del alta | Cuenta también la lectura por producto |
| B8 | Ayuda de un botón deshabilitado | Texto visible + `aria-describedby` |
| B9 | Tests faltantes | Agregados |

## Sin verificar

- Kiosco y escritorio siguen con la lista de activos: no muestran inactivos, así que no les afecta.
