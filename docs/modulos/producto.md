# producto

**Ubicación:** `src/app/pages/producto/`
**Tamaño:** 31 archivos TS, ~3.233 LOC
**Ruta base:** `/producto`

## Qué resuelve

Consulta y edición de productos, y **el modo consulta de precios** — una pantalla pensada para funcionar como terminal fija en el salón, donde el cliente escanea un producto y ve su precio.

## Rutas

| Ruta | Componente | Nota |
|---|---|---|
| `''` | `ProductoDashboardComponent` | Hub |
| `buscar/:mostrarPrecio` | `SearchProductoDialogComponent` | Búsqueda; el parámetro controla si muestra precio |
| `edit/:id` | `EditProductoComponent` | Edición |
| `consultar-precio` | `ConsultarPrecioDashboardComponent` | Consulta de precio |
| `mostrar-precio` | `MostrarPrecioComponent` | **Modo kiosco** |
| `precio-config` | `PrecioConfigComponent` | **Configuración del kiosco** |
| `productos-vencidos` | `ProductosVencidosComponent` | Reporte |

> ⚠️ **Gotcha — `mostrar-precio` y `precio-config` ocultan el footer.** `AppComponent` los excluye explícitamente (`app.component.ts:392-394`) porque son pantallas de kiosco. Si agregás otra pantalla de este tipo, sumala a esa condición.

## Búsqueda de productos — `ProductoBusquedaService`

**El servicio más importante del módulo.** Centraliza toda la lógica de resolver un texto o escaneo a un producto, apoyándose en `barcodeUtils` (ver [`../infraestructura/generic-utils.md`](../infraestructura/generic-utils.md)).

| Método | Qué hace |
|---|---|
| `buscarPorCodigoOTexto(texto, offset?)` | Búsqueda general: prueba códigos y, si no, busca por descripción |
| `buscarProductoPorEscaneo(textoEscaneado)` | Resuelve un escaneo a un producto |
| `buscarProductoPesable(codigoCompleto)` | **Producto pesable: devuelve producto + peso** |
| `esBusquedaPesable(texto)` | Detecta código de balanza |

> **Regla clave — un escaneo produce varios códigos candidatos, no uno.** `codigosParaBuscar()` devuelve una lista ordenada por prioridad y el servicio los prueba en orden hasta encontrar producto. Un GS1 trae el GTIN embebido, un EAN-14 con cero inicial equivale a su EAN-13. **No busques con el texto crudo del scanner.**

> **Regla clave — los pesables devuelven producto Y cantidad.** `buscarProductoPesable` retorna `ResultadoBusquedaPesable` con el producto y el peso en kilos extraído del código (prefijo `20`, gramos en las posiciones 7-12 divididos por 1000). Si lo tratás como un código normal, perdés la cantidad y el operador la tiene que cargar a mano.

## `producto-presentacion.util.ts`

- `resolverPresentacionPorCodigo(...)` — qué presentación corresponde al código escaneado.
- `productoTienePresentaciones(...)` — si el producto tiene presentaciones cargadas.

> **Regla clave — el código escaneado identifica la presentación, no solo el producto.** Un mismo producto tiene códigos distintos para unidad y para caja. Resolver la presentación es lo que determina el precio y la cantidad correctos. Ver [`../infraestructura/domains-modelos.md`](../infraestructura/domains-modelos.md).

## Modo kiosco — consulta de precios

`MostrarPrecioComponent` está pensado para una tablet o celular fijo en el salón con un lector conectado:

- Mantiene el **foco permanente en el input** (varios `setTimeout(() => this.inputEl.setFocus(), …)`), para que el lector siempre escriba ahí.
- Sin footer ni navegación.
- Auto-scroll al resultado.

> ⚠️ **Gotcha — el foco se re-fuerza con `setTimeout` en cuatro lugares.** Es frágil pero necesario: sin eso, cualquier interacción táctil roba el foco y el lector deja de funcionar. Si tocás este componente, verificá el foco en device real, no en navegador.

### `PrecioConfigComponent` — configuración del kiosco

Permite apuntar el kiosco a un servidor concreto. Escribe `serverIp`, `serverPort` y **borra la sesión** (`usuarioId`, `token`), igual que `ChangeServerIpDialogComponent`.

> ⚠️ **Gotcha — hay IPs hardcodeadas también acá.** `precio-config.component.ts:35-36` fija `159.203.86.103:8081`. Es la **segunda** copia de esos valores (la otra está en `change-server-ip-dialog`). Si cambia la infraestructura, hay que actualizar los dos lugares. Anotado en [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

> ⚠️ **Gotcha — repite el problema del string `"null"`.** Usa `localStorage.setItem('token', null)`, que persiste la cadena `"null"`. Ver ítem 4 del TODO.

## Otros componentes

| Componente | Rol |
|---|---|
| `ProductoDashboardComponent` | Hub del módulo |
| `SearchProductoDialogComponent` | Buscador reutilizable (también lo usa `operaciones/devolucion`) |
| `EditProductoComponent` | Edición; el alta exige rol `NUEVO-PRODUCTO` |
| `AjustarStockDialogComponent` | Ajuste manual de existencias |
| `ProductoVerificacionDialogComponent` | Verificación de producto |
| `ConsultarPrecioDashboardComponent` | Consulta con más contexto que el kiosco |
| `ProductosVencidosComponent` | Reporte de vencidos |

> ⚠️ **`SearchProductoDialogComponent` es consumido desde fuera del módulo.** `operaciones/devolucion` lo usa para agregar productos. Cambiar su API de entrada/salida rompe ese flujo.

## Operaciones GraphQL

| Archivo | Uso |
|---|---|
| `productoPorId.ts` | Detalle |
| `productoPorCodigo.ts` | **Resolución de código escaneado** |
| `productoSearchForPdv.ts` | Búsqueda para punto de venta |
| `allProductos.ts` | Listado |
| `stockBySucursalAndProductoId.ts` | Stock por sucursal |
| `productosVencidos.ts` | Reporte |
| `saveProducto.ts` | Alta/edición |
| `saveImagenProducto.ts` | Imagen |

## Permisos

`NUEVO-PRODUCTO` habilita el alta. Es uno de los strings de rol inline (ver el gotcha de roles inconsistentes en [`../arquitectura/routing-navegacion.md`](../arquitectura/routing-navegacion.md)).

## Al trabajar en este módulo

1. Toda búsqueda por código pasa por `ProductoBusquedaService`. No llames `productoPorCodigo` con texto crudo.
2. Los pesables traen cantidad además de producto.
3. El código resuelve **presentación**, no solo producto.
4. `SearchProductoDialogComponent` tiene consumidores externos.
5. En las pantallas de kiosco, verificá el foco en device real.
