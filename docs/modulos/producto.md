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

`EDITAR PRODUCTOS` habilita la edición; `EDITAR PRECIOS`, la sección de precios. `NUEVO-PRODUCTO`, que este documento nombraba, **no existe en `personas.role`**.

## Al trabajar en este módulo

1. Toda búsqueda por código pasa por `ProductoBusquedaService`. No llames `productoPorCodigo` con texto crudo.
2. Los pesables traen cantidad además de producto.
3. El código resuelve **presentación**, no solo producto.
4. `SearchProductoDialogComponent` tiene consumidores externos.
5. En las pantallas de kiosco, verificá el foco en device real.

---

# Qué cambió en la PWA

> **Estado:** implementados la **búsqueda**, la **ficha** (`/producto/:id`),
> el **modo kiosco** (`/kiosco`) y el **reporte de vencidos**
> (`/producto/vencidos`). Falta la **edición y el alta**, que exigen rol
> `NUEVO-PRODUCTO`.

## Pantallas

| Ruta | Componente | Estado |
|---|---|---|
| `/buscar` | `BuscarPage` | ✅ búsqueda por texto, por código y de balanza |

**Dejó de ser un diálogo.** En `frc-mobile`, `SearchProductoDialogComponent`
se abría desde adentro de otros flujos. Acá es la pestaña **Buscar** de la
barra inferior: buscar un producto se hace todo el día, no es un paso dentro
de otra cosa.

## Las tres reglas se conservan enteras

`ProductoBusquedaService` se portó con su lógica intacta, porque es la parte
más cargada de negocio de toda la búsqueda:

1. **Un escaneo produce varios códigos candidatos**, que se prueban en orden
   con `concatMap` —no `mergeMap`—: el orden *es* la prioridad, y lanzarlos en
   paralelo devolvería el que conteste primero, no el más específico.
2. **Los pesables traen la cantidad.** El escaneo de un código de balanza no
   entra por la búsqueda común: iría a `productoSearch` y el peso se perdería.
3. **El código resuelve la presentación.** Está en `presentacion.util.ts` con
   sus tests: escanear la caja y cobrar la unidad es el bug que evita.

El escaneo usa el [escáner compartido](../arquitectura/escaner.md) con
`FORMATOS_PRODUCTO` — los ocho del retail paraguayo, balanza incluida.

## Detalles que salieron de probar contra el central real

> ⚠️ **El tamaño de tanda no lo elige el cliente: son 10, escritos a mano en
> el backend.** `ProductoRepository.java:53` tiene `limit 10` en la consulta
> nativa de `productoSearch`. La constante `LOTE` de la pantalla existe solo
> para detectar «hay más» comparando la cantidad recibida; con otro valor, el
> botón «Cargar más» no aparece nunca. Si el backend cambia el límite, hay que
> cambiarla.

> ⚠️ **El peso no se formatea con el pipe `number` de Angular.** La app no
> registra `LOCALE_ID`, así que el pipe usa `en-US` y 1,5 kg sale como
> `1.500 kg` — que acá se lee «mil quinientos». Va por `formatearCantidad()`
> de `moneda.util.ts`, que usa `es-PY`. El bug se coló en la primera versión y
> lo encontró un test.

## La lista de productos

La card es `frc-producto-card` y el buscador entero, `frc-buscador-producto`
— los dos en `shared/producto/`, genéricos por la regla de tres.

| Decisión | Por qué |
|---|---|
| **La cantidad lidera la presentación**: `Cantidad: 12 (Caja)` | Es lo que decide el precio y lo que se compara entre filas. El nombre es contexto. `frc-mobile` mostraba solo `Presentación: {{cantidad}}`, sin nombre |
| **Sin sucursal no se muestra stock** | La existencia siempre es de un local. Sin sucursal no hay nada que mostrar, y **el servidor no es un local** (`sucursal_id = 0`) |
| **El menú `⋮` se arma por contexto** | «Ver stock por sucursal» siempre; el resto lo declara quien abrió el buscador |
| **En modo `devuelve: 'producto'` la card no se expande** | Los filtros de control de inventario y productos vencidos solo querían el producto, pero obligaban a expandir y tocar una presentación que después descartaban |
| **El stock por sucursal se pide en una sola consulta** | `stockPorSucursales` agrupa en la base. La alternativa —una llamada por sucursal— son 18 requests y el navegador da 6 conexiones por origen: ocupan todo el pool mientras duran. Medido: **32 ms contra 83 ms** |
| **La búsqueda anterior se cancela en vuelo** | `frc-mobile` solo limpiaba el timer del debounce: si dos búsquedas salían, ganaba la que contestara última, no la que se pidió última |

> ⚠️ **`stockPorSucursales` es nueva en el central.** Se agregó en esta ola
> porque no existía: `productoPorSucursalStock` es por sucursal, y tanto el
> desktop como `frc-mobile` la llamaban en bucle. En `gestion-compras` del
> desktop eso llegó a requerir espaciar los pedidos con `setTimeout` «para no
> saturar el servidor» — ver
> [issue #208 del desktop](https://github.com/GabFrank/frc-sistemas-integrados-angular/issues/208).
> Una sucursal sin movimientos **no vuelve** en el resultado: se muestra en cero.

## Lo que falta, y cuándo se hace

El buscador está **terminado para consultar**. Lo que queda no está olvidado:
se implementa **cuando aparezca el consumidor que lo necesita**. Adelantarlo
sería adivinar la forma sin el caso de uso, que es lo que llevó al componente
original a 442 líneas y a que transferencias lo copiara.

El inventario completo, función por función, está en
[`../analisis/buscador-producto-inventario.md`](../analisis/buscador-producto-inventario.md) §6 y §7.

| Qué | Cuándo |
|---|---|
| **Abrirlo como diálogo selector** — `(seleccion)` ya emite, falta el envoltorio | Con **devolución**, el primer consumidor real |
| **Foco automático en el campo** | Con el modo diálogo. En una pestaña, robar el foco levanta el teclado sin que nadie lo pida |
| **Ver imagen del producto** — `imagenPrincipal` viene en la query, la card muestra un ícono | Con el detalle de producto |
| **FAB «subir»** | Si las listas se vuelven largas. Con 10 por tanda no hace falta |
| **Stock de origen y destino** en la card | Con **transferencias** |
| **Modo inventario** — cantidad, vencimiento, estado | Con **inventario**, en su propia pantalla: es un formulario, no un selector |
| ~~**Detalle de producto**~~ | ✅ `/producto/:id`. Todos los códigos y todos los tipos de precio |
| ~~**Modo kiosco**~~ | ✅ `/kiosco`, fuera del shell |
| **Edición y alta** | Sigue pendiente. Cambiar un precio desde el salón, sin costos ni márgenes a la vista, es de donde salen los precios mal cargados |


---

# La ficha, el kiosco y los vencidos

## Ficha — `/producto/:id`

Lo que la card del buscador no puede mostrar: **todos** los códigos de cada
presentación —los inactivos tachados, porque siguen pegados a cajas viejas— y
**todos** los tipos de precio, no solo el principal. Es la pantalla a la que
se va a resolver una discusión sobre cuál precio corresponde.

Se llega desde el menú `⋮` del buscador. Es una acción **propia del
buscador**, como «ver stock», y no una que declare el llamador.

> ⚠️ **Una acción declarada por el llamador no se puede distinguir de otra.**
> Todas emiten `seleccion` con el producto y nada más. Con una sola alcanzaba;
> con dos, ya no. Por eso las genéricas viven adentro del buscador.

> ⚠️ **La existencia por sucursal necesita `stockPorSucursales`**, que es una
> consulta nueva del central. Contra una instancia vieja la sección dice «No
> se pudo consultar». Lo que **no** puede hacer es listar las sucursales en
> cero: eso afirmaría que no hay mercadería.

## Kiosco — `/kiosco`

Tablet o teléfono fijo en la góndola con un lector HID conectado. El cliente
pasa el producto y ve el precio; nadie toca la pantalla.

**Vive fuera del shell**, así que no tiene barra inferior ni botón flotante.
`frc-mobile` lograba lo mismo listando la ruta en una condición que escondía
el footer, que había que acordarse de actualizar cada vez que se agregaba una
pantalla de kiosco.

Tres cosas definen el modo, y las tres se prueban en el bloque 26:

1. **El foco vuelve al campo pase lo que pase** — un lector HID escribe donde
   esté el foco, así que un toque perdido lo deja mudo hasta que alguien se dé
   cuenta. Excepción: los clicks dentro de un overlay de Material, o el
   diálogo del escáner se quedaría sin su propio campo.
2. **La presentación del código escaneado se resalta** — un producto con
   unidad y caja tiene dos precios y los dos son correctos.
3. **El precio se borra solo a los 20 segundos** — si no, el próximo cliente
   lee un precio que no es el suyo.

> **El selector de moneda no se porta, y es una decisión.** `frc-mobile`
> multiplicaba el precio por un tipo de cambio en el cliente. Acá el dinero lo
> calcula el backend (regla 6): cuando las sucursales de frontera lo
> necesiten, el precio convertido tiene que venir del central.

## Productos vencidos — `/producto/vencidos`

Qué hay que sacar de la góndola. Cada fila dice de dónde salió la fecha —nota
de compra, transferencia o inventario— y, cuando el conteo contradice a esa
fuente, lo muestra: es la razón por la que alguien discute una fila.

Del reporte de escritorio quedaron fuera los filtros por sector, zona y
usuario. Son de la pantalla grande, donde se audita; acá el caso es caminar el
pasillo con el teléfono.

> ⚠️ **Abre en «Ya vencidos» porque el central ordena al revés para este
> caso.** `ProductosVencidosService.java:62` pagina con `ORDER BY vencimiento
> DESC` y el schema **no acepta parámetro de orden**, así que sin acotar la
> ventana encabezan lotes que vencen en 2030. Acotarla es una mitigación del
> cliente; el arreglo va en el central y, como lo usa el desktop, con sufijo
> `Mobile` (regla 5).

> El tono de cada fila sale de la **clasificación** que ya calcula el central
> (`vencido` / `por-vencer` / `vigente`), no de su `vencimientoColor`, que es
> un hex crudo. Así el umbral de «por vencer» —hoy siete días— queda del lado
> del backend.

---

# La configuración del kiosco

Un engranaje en la barra del kiosco elige **cómo lee los códigos**, y la
elección queda **por dispositivo** en `localStorage` (`frc.kioscoModo`).

⚠️ **Es de la tablet, no del usuario.** El kiosco es un equipo fijo a la
góndola: lo configura quien lo instala y no se vuelve a tocar. El mismo usuario
abre la app en su teléfono mañana, donde no hay ningún lector conectado.

| Modo | Qué hace |
|---|---|
| **Lector** (default) | hay un lector HID. El campo queda enfocado y el teclado en pantalla se suprime |
| **Cámara** | no hay lector. El escáner **se vuelve a abrir solo** después de cada consulta |

## Por qué el modo cámara se rearma

Sin eso, una tablet sin lector obliga a **tocar el ícono de la cámara antes de
cada consulta**: eso no es un kiosco, es un teléfono prestado. La pantalla la
mira un cliente.

⚠️ **El rearme es en cadena, no en bucle.** Se encadena al cierre del diálogo
anterior; un `setInterval` abriría escáneres encima del que ya está abierto.
Salir del kiosco corta la cadena, o la cámara se reabre sobre Inicio.

`frc-mobile` abre el escáner **una sola vez**, al entrar en modo `cam`, y
después queda mudo hasta que alguien vuelva a tocar.

## El servidor se muestra, no se edita

`frc-mobile` repite acá el formulario de IP y puerto, con la IP de producción
escrita a mano en el componente (`precio-config.component.ts`). Eso deja dos
lugares que hay que mantener sincronizados.

Cambiar de servidor **cierra la sesión**, así que no es algo que se haga con un
kiosco abierto: se hace desde *Mi cuenta → Servidor*. Acá se dice cuál está
activo, que es la pregunta real de quien instala la tablet.

## Sin cámara no se puede elegir cámara

La opción se deshabilita y explica por qué. Elegirla dejaría el kiosco **mudo**:
sin lector no entra nada por el campo, y no habría de dónde leer.
