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
