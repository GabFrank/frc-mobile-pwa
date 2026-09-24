# operaciones / pedidos — Recepción de Mercaderías

> ⚠️ **El módulo se llama `pedidos` pero la UI lo llama "Recepción de Mercaderías"** (`app.component.html:81`). No busques por el texto que ve el usuario.

**Ubicación:** `src/app/pages/operaciones/pedidos/`
**Tamaño:** 73 archivos TS, ~5.025 LOC — el submódulo más grande del repo.
**Ruta base:** `/operaciones/pedidos`

## Qué resuelve

El circuito de **recepción física de mercadería de un proveedor** en una sucursal: se cargan las notas (facturas/remitos) que trae el proveedor, se inicia una recepción, se verifica producto por producto lo que realmente llegó contra lo que dice la nota, y se cierra generando una constancia y —opcionalmente— una solicitud de pago.

## Rutas

| Ruta | Componente | Rol |
|---|---|---|
| `/operaciones/pedidos` | `PedidosComponent` | Menú del módulo |
| `/operaciones/pedidos/recibir-nota-recepcion` | `RecepcionNotasComponent` | Carga de notas e inicio de recepción |
| `/operaciones/pedidos/historico-nota-recepcion` | `HistoricoNotaRecepcionComponent` | Histórico de recepciones |
| `/operaciones/pedidos/recepcion-producto/:id` | `RecepcionProductoComponent` | Verificación producto por producto |
| `/operaciones/pedidos/solicitar-pago-nota-recepcion/:id` | `SolicitarPagoNotaRecepcionComponent` | Solicitud de pago de una nota |

## Modelo de datos

### ⚠️ `NotaRecepcionAgrupada` está deprecada

El backend fue refactorizado: **`RecepcionMercaderia` reemplaza a `NotaRecepcionAgrupada`**. `RecepcionMercaderia` modela con más precisión un evento de recepción física de una o más notas, e incorpora moneda y cotización.

**Ambas entidades siguen existiendo en el código.** `NotaRecepcionAgrupada` conserva su modelo, servicio y 11 archivos GraphQL, y todavía la referencian:

- `nota-recepcion.model.ts` (campo `notaRecepcionAgrupada`)
- `nota-recepcion.service.ts`
- `solicitar-pago-nota-recepcion.component.ts`
- `graphql/notaRecepcionPorNotaRecepcionAgrupadaId.ts`

**Para código nuevo usá `RecepcionMercaderia`.** La migración del histórico está documentada en [`../manuales-refactor/historico-recepcion-mercaderia.md`](../manuales-refactor/historico-recepcion-mercaderia.md) y [`../manuales-refactor/refactor-sesion-historico-recepcion.md`](../manuales-refactor/refactor-sesion-historico-recepcion.md).

### Entidades

| Entidad | Archivo | Qué representa |
|---|---|---|
| `Pedido` | `pedido.model.ts` | Pedido de compra al proveedor |
| `PedidoItem` | `pedido-item/pedido-item.model.ts` | Línea del pedido |
| `Compra` | `compra/compra.model.ts` | Compra asociada |
| `NotaRecepcion` | `nota-recepcion/nota-recepcion.model.ts` | Nota/factura que trae el proveedor |
| `RecepcionMercaderia` | `recepcion-mercaderia/recepcion-mercaderia.model.ts` | **Evento de recepción física** — la entidad central |
| `RecepcionMercaderiaItem` | `recepcion-mercaderia/recepcion-mercaderia-item.model.ts` | Línea verificada |
| `PedidoRecepcionProductoDto` | `nota-recepcion/nota-recepcion-agrupada/pedido-recepcion-producto-dto.model.ts` | DTO agregado por producto para la pantalla de verificación |
| `NotaRecepcionAgrupada` | `nota-recepcion/nota-recepcion-agrupada/` | ⚠️ deprecada |

También hay modelos auxiliares de pedido: `pedido-fecha-entrega`, `pedido-sucursal-entrega`, `pedido-sucursal-influencia`.

### Máquinas de estado

**`RecepcionMercaderiaEstado`** — el que gobierna el flujo:

```
PENDIENTE → EN_PROCESO → FINALIZADA
                ↑            │
                └────────────┘  (reabrir)
     cualquiera → CANCELADA
```

**`PedidoEstado`** (12 valores) refleja el ciclo completo del pedido, del que la recepción es una etapa:

```
ABIERTO · ACTIVO · MODIFICADO · CANCELADO · REPROGRAMADO
EN_VERIFICACION · EN_RECEPCION_NOTA · EN_RECEPCION_MERCADERIA
EN_VERIFICACION_SOLICITUD_AUTORIZACION
VERFICADO_SIN_MODIFICACION · VERFICADO_CON_MODIFICACION · CONCLUIDO
```

> ⚠️ **Gotcha — `VERFICADO_*` está mal escrito en el enum** (falta la `I`: "VERFICADO", no "VERIFICADO"). El valor viaja así al backend. **No lo corrijas del lado del cliente**: el string tiene que coincidir exactamente con el del backend.

**`PedidoItemEstado`:** `ACTIVO`, `CANCELADO`, `DEVOLUCION`, `CONCLUIDO`, `EN_FALTA`.

**`CompraEstado`:** `ACTIVO`, `CANCELADO`, `DEVOLVIDO`, `EN_OBSERVACION`, `IRREGULAR`, `PRE_COMPRA`.
**`CompraItemEstado`:** `SIN_MODIFICACION`, `MODIFICADO`.

> ⚠️ **Gotcha — `CompraItemEstado.SIN_MODIFICACIONN` tiene la clave con doble N**, pero su valor es el correcto (`'SIN_MODIFICACION'`). Solo molesta al autocompletar.

**`NotaRecepcionAgrupadaEstado`:** `EN_RECEPCION`, `CONCLUIDO`, `CANCELADO`.

**`TipoBoleta`:** `LEGAL`, `COMUN` — ⚠️ es un enum **numérico** (sin valores string asignados), a diferencia de todos los demás enums del módulo.

## Flujo completo

### 1. Carga de notas (`RecepcionNotasComponent`, 489 líneas)

1. **Elegir sucursal** — `onVerificarSucursal()` valida que la sucursal de recepción sea válida.
2. **Elegir proveedor** — `onSearchProveeodr()` *(sic, typo en el método)*.
3. **Agregar notas por número** — `onAddNumeroNota()` busca la nota y la suma a la lista.
4. **Iniciar recepción** — `onIniciarRecepcion()`.

**Validaciones al agregar una nota:**

- Si el estado de la nota está en `['RECEPCION_COMPLETA', 'CERRADA']`, se asume completa y no se agrega.
- `procesarNotaUnica()` consulta `onVerificarRecepcionActivaPorNotaYSucursal(notaId, sucursalId)`: si ya existe una recepción activa para esa nota **en esa sucursal**, avisa con el id y estado de la recepción existente en vez de crear una segunda.

> ⚠️ **Gotcha — el estado se limpia en `ionViewWillEnter`, no solo en `ngOnInit`.** El componente resetea su estado **cada vez que la vista se muestra**, para que volver desde "Nueva Recepción" no arrastre notas de la sesión anterior. Si agregás estado que deba sobrevivir a la navegación, no lo pongas acá.

> ⚠️ **Gotcha — la recepción activa se chequea por nota + sucursal.** La misma nota puede estar en recepción en dos sucursales distintas sin que el sistema lo impida.

**`onIniciarRecepcion(sucursalId, notaRecepcionIds[], proveedorId, monedaId, usuarioId, cotizacion?)`** — `cotizacion` cae a `1.0` si no se pasa.

> ⚠️ **Gotcha — cotización por defecto `1.0`.** Si el proveedor factura en moneda extranjera y no se informa cotización, los importes se calculan uno a uno. Verificá la moneda antes de iniciar.

### 2. Verificación de productos (`RecepcionProductoComponent`, 468 líneas)

Trabaja **por producto**, no por línea de nota. `PedidoRecepcionProductoDto` agrega las cantidades de un mismo producto que aparecen en varias notas de la misma recepción.

Métodos principales:

| Método | Qué hace |
|---|---|
| `onBuscarRecepcionMercaderia(id)` | Carga la recepción |
| `onGetPedidoItem()` | Trae los productos a verificar |
| `onBuscarProductoPorCodigoBarra(codigo)` | Verificación por escaneo |
| `openFilterActionSheet()` | Filtros de la lista |
| `openVerificacionDialog(producto)` | Abre el diálogo de cantidades |
| `onFinalizarRecepcion()` | Cierre |
| `onDeshacerVerificacion(item, event)` | Revierte la verificación de un producto |
| `onGenerarConstancia()` | Genera el PDF |

**`onVerificarProductoMobile(...)`** es la mutation central:

```ts
recepcionMercaderiaId, productoId,
cantidadRecibida, cantidadRechazada,
notaRecepcionItemIdParaRechazo, motivoRechazo,
metodoVerificacion, usuarioId
```

> **Regla clave — el backend distribuye las cantidades.** Cuando el mismo producto viene en varias notas, el cliente manda la cantidad **total** verificada y **el backend la reparte** entre las notas. El mobile no calcula la distribución.
>
> Consecuencia: para rechazar hay que indicar explícitamente **a qué nota** se imputa el rechazo (`notaRecepcionItemIdParaRechazo`), porque eso el backend no lo puede inferir. De ahí existe `SeleccionarNotaItemRechazoDialogComponent`.

Por la misma razón, deshacer se hace **por producto** (`onDeshacerVerificacionPorProducto`) y no por línea: revertir una sola línea dejaría la distribución inconsistente.

### 3. Finalización

`onFinalizarRecepcion()` → `obtenerItemsPendientes()`. Si quedan productos sin verificar, `mostrarDialogoMotivoYFinalizar()` pide un motivo y los marca como **rechazados**; después `ejecutarFinalizar()` llama `finalizarRecepcionMercaderia`.

Cerrada la recepción, `onGenerarConstancia()` obtiene el PDF en base64 vía `generarConstanciaRecepcionPDF` y lo abre con `PdfViewerService` (`ConstanciaRecepcionPdfDialogComponent`).

### 4. Reapertura

`reabrirRecepcionMercaderia(recepcionId)` pasa `FINALIZADA` → `EN_PROCESO`. El backend valida que el estado actual sea `FINALIZADA`: no se puede reabrir una `EN_PROCESO` ni una `CANCELADA`.

**El procedimiento completo, con todas las validaciones y restricciones, está en [`../manuales-refactor/procedimiento-reabrir-recepciones-deshacer-verificaciones.md`](../manuales-refactor/procedimiento-reabrir-recepciones-deshacer-verificaciones.md) (300 líneas).** Es el documento a leer antes de tocar reapertura o deshacer verificación.

### 5. Solicitud de pago

`SolicitarPagoNotaRecepcionComponent` (109 líneas) → mutation `solicitarPagoNotaRecepcionAgrupada`.

> ⚠️ **Gotcha — la solicitud de pago sigue colgando de la entidad deprecada.** La mutation se llama `solicitarPagoNotaRecepcionAgrupada` y el componente usa `NotaRecepcionAgrupada`, no `RecepcionMercaderia`. Es la parte del módulo que quedó sin migrar.

## Servicios

### `RecepcionMercaderiaService`

| Método | Operación |
|---|---|
| `onGetRecepcionMercaderiaListPorUsuarioId(...)` | Lista con filtros |
| `onGetRecepcionMercaderiaPorId(...)` | Detalle |
| `onGetPedidoRecepcionProductoPorRecepcionMercaderia(...)` | Productos a verificar |
| `onGetPedidoRecepcionProductoPorRecepcionMercaderiaAndProducto(...)` | Un producto |
| `onIniciarRecepcion(...)` | Crea la recepción |
| `onSaveRecepcionMercaderiaItem(...)` | Guarda un ítem |
| `onVerificarProductoMobile(...)` | **Verificación (con distribución en backend)** |
| `onDeshacerVerificacionPorProducto(...)` | Revierte por producto |
| `onFinalizarRecepcionMercaderia(...)` | Cierra |
| `onReabrirRecepcionMercaderia(...)` | Reabre |
| `onVerificarRecepcionActivaPorNotaYSucursal(...)` | Chequeo de duplicados |
| `onGenerarConstanciaRecepcionPDF(recepcionId)` | PDF base64 |
| `onBuscarNotaRecepcionItemsPorProductoYRecepcion(...)` | Items de un producto en todas las notas |
| `onBuscarNotaRecepcionItemPorProductoYRecepcion(...)` | ⚠️ `@deprecated` — devuelve solo el primero |

> 🐛 **N+1 de queries.** `onBuscarNotaRecepcionItemsPorProductoYRecepcion` (`recepcion-mercaderia.service.ts:182-232`) trae la recepción y después hace **una query por cada nota** dentro de un `for`, en serie. Una recepción con 15 notas dispara 16 requests secuenciales. Anotado en [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

> ⚠️ **Gotcha — este servicio sí propaga errores.** A diferencia del resto del repo, usa `onCustomSave`/`onCustomGet` y hace `obs.error(...)` explícito. **Tus llamadas necesitan handler de error** o vas a tener excepciones no capturadas — al revés del cuidado habitual con `GenericCrudService`.

### `NotaRecepcionService` y `NotaRecepcionAgrupadaService`

Operaciones sobre notas: búsqueda por número, por proveedor+número, por pedido, por recepción agrupada; alta y baja.

## Operaciones GraphQL

Repartidas en cuatro carpetas `graphql/`:

- `nota-recepcion/graphql/` — 10 operaciones sobre notas
- `nota-recepcion/nota-recepcion-agrupada/graphql/` — 11 (entidad deprecada)
- `recepcion-mercaderia/graphql/` — 13 (**las vigentes**)
- `pedido-item/graphql/` — 3

Mutations relevantes: `iniciarRecepcion`, `verificarProductoMobile`, `deshacerVerificacionPorProducto`, `finalizarRecepcionMercaderia`, `reabrirRecepcionMercaderia`, `generarConstanciaRecepcionPDF`, `saveRecepcionMercaderiaItem`.

> ⚠️ **`verificarProductoMobile` lleva el sufijo `Mobile` a propósito** — es la regla del proyecto: el desktop usa su propio método de verificación y no debe tocarse. Ver [`../REGLAS_DESARROLLO.md`](../REGLAS_DESARROLLO.md).

> ⚠️ **Typo en un nombre de archivo:** `getNotaRecepcionPorOriveedorAndNumero.ts` (debería ser `PorProveedor`). El archivo funciona; solo dificulta encontrarlo.

## Diálogos

| Componente | Para qué |
|---|---|
| `RecepcionProductoVerificacionDialogComponent` (441 líneas) | Captura cantidad recibida / rechazada. El diálogo más complejo del módulo |
| `SeleccionarNotaItemRechazoDialogComponent` | Elige a qué nota se imputa un rechazo |
| `NotaRecepcionInfoDialogComponent` | Detalle de una nota |
| `ConstanciaRecepcionPdfDialogComponent` | Muestra la constancia PDF |

## Al trabajar en este módulo

1. Leé primero [`../manuales-refactor/procedimiento-reabrir-recepciones-deshacer-verificaciones.md`](../manuales-refactor/procedimiento-reabrir-recepciones-deshacer-verificaciones.md).
2. Usá `RecepcionMercaderia`, no `NotaRecepcionAgrupada`.
3. No calcules distribución de cantidades entre notas: es responsabilidad del backend.
4. Cualquier cambio en el backend que toque recepción debe respetar el desktop — sufijo `Mobile`.
5. Manejá los errores: este módulo sí los propaga.

---

# Qué cambió en la PWA

> **Estado:** portado el **circuito completo de recepción** —abrir con las
> notas del proveedor, verificar producto por producto, deshacer, finalizar y
> reabrir, más la constancia en PDF—. `NotaRecepcionAgrupada` **no se porta**,
> y la solicitud de pago queda para la fase de pagos.

| Ruta | Componente |
|---|---|
| `/operaciones/recepcion` | `RecepcionesListaPage` |
| `/operaciones/recepcion/nueva` | `RecepcionNuevaPage` |
| `/operaciones/recepcion/:id` | `RecepcionDetallePage` |

El submódulo `pedidos` se llama acá **`recepcion`**: es lo que el usuario ve
en el menú y lo que realmente hace. El nombre viejo obligaba a saber que
«Recepción de Mercaderías» vivía en una carpeta llamada de otra forma.

## La aritmética vive en un solo archivo, con tests

`recepcion-cantidades.ts` concentra lo que antes estaba repartido entre el
diálogo de 441 líneas y la pantalla de 468:

- **Dos escalas, y las funciones dicen cuál usan.** Todo lo que viene del
  backend está en **unidad base**; la pantalla muestra en **presentación**.
  `aUnidadBase()` y `aPresentacion()` son el único puente.
- **Una presentación sin cantidad vale 1, no 0.** Con cero, la conversión
  daría `Infinity` en pantalla o borraría lo cargado.
- **`mostrarEnUnidadBase` gana sobre la presentación elegida.** Es el backend
  diciendo que ese producto se cuenta suelto.

## Recibir de menos sin rechazar está prohibido

Es la regla que sostiene el reclamo al proveedor: la diferencia entre lo que
dice la nota y lo que bajó del camión tiene que quedar **imputada a una nota y
con un motivo**. Si se aceptara «recibí 8 de 10» sin más, la falta
desaparecería del sistema.

Es una regla **del cliente**: el backend valida que recibido + rechazado no
supere lo pendiente, pero no exige el rechazo. Está en `validarCarga()`.

## Un rechazo sin línea de nota se pierde en silencio

Verificado en `RecepcionMercaderiaItemService.verificarProductoMobile`
(central): si llega `cantidadRechazada > 0` con
`notaRecepcionItemIdParaRechazo` en `null`, el bucle que asigna el rechazo no
entra nunca, la mutation **devuelve `true`** y las cantidades rechazadas
quedan en cero.

Por eso la PWA **nunca manda un rechazo sin esa línea**: con una sola nota la
resuelve sola, con varias abre `SeleccionarNotaRechazoDialogComponent`, y si
no la consigue **corta la operación** en vez de mandar algo que se va a
perder. El diálogo además muestra cuánto queda pendiente en cada nota, porque
el backend rechaza la operación entera si la nota elegida no alcanza.

## Un producto con lote no se recibe sin el número

Lo decide el **producto**: `producto.lote === true` hace que el diálogo de
verificación abra el bloque «Trazabilidad» con número de lote, vencimiento y
fecha de retiro, y que el número sea obligatorio para lo que se recibe. Una
verificación que es **toda rechazo** no lo pide: no hay mercadería que trazar.

La regla no vive solo en la pantalla. El central la aplica en
`RecepcionMercaderiaItemService.validarLoteObligatorio`, igual que el desktop
en su verificación detallada: mobile, el desktop y una llamada directa al
GraphQL son tres puertas independientes, y sin lote la finalización de la
recepción entra la mercadería **sin trazabilidad y sin un solo error**.

### Qué hace el central con esas tres fechas

Al finalizar la recepción, `MovimientoStockLoteService.registrarEntradaCompra`
llama a `LoteService.obtenerOCrear`, que **crea o reutiliza** la fila de
`operaciones.lote` para ese (producto, número). De ahí sale el desglose de
stock por lote que alimenta FEFO y el recall.

Dos reglas del central que la pantalla refleja y no reimplementa:

- **Nunca se pisa una fecha ya cargada** de un lote existente. Por eso, cuando
  lo tipeado coincide con un lote registrado, la pantalla trae sus fechas y
  **deshabilita** las que el lote ya tiene: dejarlas editables mostraría una
  fecha distinta de la que se va a guardar. Las que le faltan sí se cargan —
  ésas el central las completa.
- **La fecha de retiro es opcional.** Sin ella se deriva de
  `vencimiento − producto.diasVencimiento`, que es el comportamiento
  histórico. Cargarla a mano la pisa.

### Por qué el lote se guarda como variación y no solo en el ítem

`recepcion_mercaderia_item` tiene **un solo** campo `lote`, y en mobile el
mismo producto se puede verificar en varias pasadas: dos cajas del lote A
ahora y cinco unidades del lote B después. La segunda pasada pisaría a la
primera y todo el stock quedaría atribuido al último número tipeado.

Por eso `verificarProductoMobile` deja **una variación por pasada** con su
cantidad, su lote y sus fechas. `registrarEntradaCompra` prefiere las
variaciones sobre el ítem justamente para este caso, y el campo del ítem se
escribe solo la primera vez, para que la constancia y el detalle tengan algo
que mostrar.

> La fecha de retiro de la variación necesita la migración **`V202.5`** del
> central. Sin ella el número de lote y el vencimiento se guardan igual, pero
> el retiro cargado a mano se pierde entre la verificación y la finalización.

### Sugerencias mientras se tipea

El diálogo trae los lotes ya registrados del producto con `lotesPorProducto`
—la misma operación de solo lectura que usa el desktop, sin método paralelo
`Mobile`— y filtra en memoria: no hay una consulta por tecla. Incluye
**bloqueados y en cuarentena a propósito**: si el operador está por recibir
uno de ésos hay que avisarle, no esconderlo.

**Con el campo vacío no se sugiere nada.** Un producto de rotación alta junta
un lote por compra, y a los pocos meses son cientos: volcarlos al abrir el
diálogo empujaba el vencimiento y el retiro fuera de la pantalla, que es
justamente lo que hay que cargar. El reconocimiento arranca con la primera
tecla —`MIN_CARACTERES_LOTE`—, corta en seis opciones y **dice cuántas
coincidencias quedaron afuera**: un corte silencioso se lee como «no hay más»
y el operador termina creando un lote nuevo teniendo el suyo registrado.
Cuando ninguna coincide, el texto avisa que ese número va a crear un lote
nuevo; cuando coincide entero, lo dice el aviso de «lote ya registrado».

Las reglas puras están en `recepcion-lote.ts`, con tests en
`pruebas/recepcion-lote.spec.ts`.

## La cotización ya no cae en 1.0 en silencio

`frc-mobile` iniciaba la recepción con la primera moneda de la lista y
`cotizacion: 1.0` fijo. Una nota en dólares se cargaba como si fueran
guaraníes.

Acá la moneda **se toma de la nota** cuando la trae, se puede cambiar, y si no
es la local **la cotización es obligatoria** —el botón de iniciar queda
deshabilitado sin ella—. Contra guaraníes sigue siendo 1, pero porque esa es
la cotización real, no porque falte el dato.

## La sucursal se escanea, y además se puede elegir

`frc-mobile` la resuelve **solo** escaneando el QR del cartel del depósito
(con un atajo de desarrollo que cargaba la sucursal 13). Es el control de que
quien recibe está parado donde entra la mercadería, y se mantiene como camino
principal.

Se agrega elegirla de la lista porque en iPhone y en un navegador de
escritorio no siempre hay cámara disponible, y quedarse sin recibir por eso no
es aceptable. **La lista solo trae sucursales con depósito** (`soloOperables`):
una sucursal virtual no mueve stock, así que recibir contra ella no significa
nada. Escanear el QR de una virtual también se rechaza, con el motivo.

> ⚠️ Si preferís que la sucursal sea **solo** por escaneo, es un `@if` en
> `recepcion-nueva.page.ts`. Está señalado en el comentario de la clase.

## Otras diferencias

| Tema | `frc-mobile` | PWA |
|---|---|---|
| Items de un producto en las notas | una query por nota **en serie** dentro de un `for` (16 requests con 15 notas) | un `forkJoin` en paralelo |
| `metodoVerificacion` | siempre `MANUAL`, incluso llegando por escaneo | `ESCANER` cuando se llegó leyendo el código |
| Usuario que verifica | el que inició la recepción | el que está operando ahora |
| Validación de una línea | contra `aRecibir − recibido − yaCargado`, sin descontar rechazos previos | contra el pendiente real, el mismo número que valida al guardar |
| Editar una línea cargada | modo edición con índices | quitar y volver a cargar |
| Varias notas con el mismo número | diálogo de selección | se avisa y se pide resolver desde el desktop |
| Constancia PDF | diálogo con visor propio | `PdfService`, con el camino de iOS resuelto |
| Número de lote | no se carga: la mercadería entra sin trazabilidad | obligatorio si el producto lo lleva, con sugerencias de los lotes ya registrados |

## Lo que falta

| Qué | Nota |
|---|---|
| Solicitud de pago | queda para la fase de pagos; en `frc-mobile` todavía cuelga de `NotaRecepcionAgrupada` |
| Compartir la recepción por QR | el QR se genera con `codificarQr`; falta la pantalla que lo muestre |
| Varias notas con el mismo número | hoy se avisa en vez de dejar elegir |
| Cancelar una recepción | el backend lo soporta, no hay pantalla |
| Ver el lote de un producto ya verificado | el número se guarda, pero `PedidoRecepcionProductoDto` no lo devuelve: la lista de productos no lo puede mostrar |
| `NotaRecepcionAgrupada` | **no se porta a propósito** |
