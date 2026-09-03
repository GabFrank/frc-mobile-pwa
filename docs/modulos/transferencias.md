# transferencias

**Ubicación:** `src/app/pages/transferencias/`
**Tamaño:** 33 archivos TS, ~4.166 LOC
**Ruta base:** `/transferencias`
**Permiso:** el ítem del menú exige el rol `VER TRANSFERENCIA`.

## Qué resuelve

**Movimiento de mercadería entre sucursales**, con trazabilidad de las cuatro etapas por las que pasa: quién la pidió, quién la preparó, quién la transportó y quién la recibió.

El diseño central: **cada ítem guarda cantidad, presentación, vencimiento y observación por separado en cada etapa.** Así se puede reconstruir exactamente en qué punto de la cadena apareció una diferencia.

## Rutas

| Ruta | Componente |
|---|---|
| `''` | `TransferenciaComponent` |
| `list` | `ListTransferenciasComponent` |
| `list/filtradas/:sucursalId/:etapa` | `ListTransferenciasComponent` |
| `list/info/:id` | `InfoTransferenciaComponent` |
| `nueva` | `NuevaTransferenciaComponent` |
| `gestion-productos` | `TransaferenciaListProductosComponent` *(sic)* |
| `edit/new` y `edit/:id` | `EditTransferenciaProductoComponent` |

## Las cuatro etapas — el modelo central

`TransferenciaItem` repite **cinco grupos de campos, cuatro veces**:

| Campo | PreTransferencia | Preparación | Transporte | Recepción |
|---|---|---|---|---|
| `cantidad*` | ✅ | ✅ | ✅ | ✅ |
| `presentacion*` | ✅ | ✅ | ✅ | ✅ |
| `vencimiento*` | ✅ | ✅ | ✅ | ✅ |
| `observacion*` | ✅ | ✅ | ✅ | ✅ |
| `motivoModificacion*` | ✅ | ✅ | ✅ | ✅ |
| `motivoRechazo*` | ✅ | ✅ | ✅ | ✅ |

Y `Transferencia` guarda **cuatro usuarios**: `usuarioPreTransferencia`, `usuarioPreparacion`, `usuarioTransporte`, `usuarioRecepcion`.

> **Regla clave — cada etapa registra lo suyo y no pisa lo anterior.** Si se piden 10 unidades (`cantidadPreTransferencia`), el depósito prepara 8 (`cantidadPreparacion`), se despachan 8 (`cantidadTransporte`) y llegan 7 (`cantidadRecepcion`), quedan las cuatro cifras. La diferencia 10→8 es falta de stock en origen; la 8→7 es un faltante en tránsito. **Colapsar esto en un solo campo destruye la capacidad de auditar.**

> ⚠️ **Gotcha — la presentación también puede cambiar entre etapas.** Se pide en cajas y se despacha en unidades: por eso hay `presentacionPreTransferencia` y `presentacionTransporte` separadas. Comparar cantidades entre etapas **sin comparar la presentación** da diferencias falsas.

### Motivos

**`TransferenciaItemMotivoRechazo`:** `FALTA_PRODUCTO` · `PRODUCTO_AVERIADO` · `PRODUCTO_VENCIDO` · `PRODUCTO_EQUIVOCADO`

**`TransferenciaItemMotivoModificacion`:** `CANTIDAD_INCORRECTA` · `VENCIMIENTO_INCORRECTO` · `PRESENTACION_INCORRECTA`

> **Rechazo ≠ modificación.** Rechazo es "esto no va"; modificación es "va, pero distinto a lo declarado". Cada etapa puede registrar uno de cada uno.

## Máquinas de estado — hay dos

### `TransferenciaEstado` — 8 valores

```
ABIERTA ──> EN_ORIGEN ──> EN_TRANSITO ──> EN_DESTINO ──> CONLCUIDA
                │                              │
                └─ FALTA_REVISION_EN_ORIGEN    └─ FALTA_REVISION_EN_DESTINO
                                                          → CANCELADA
```

El modelo trae los comentarios originales:

| Estado | Comentario en el código |
|---|---|
| `ABIERTA` | *"la transferencia esta siendo creada"* |
| `EN_ORIGEN` | *"ha sido creada pero aun esta en el deposito de origen"* |
| `EN_TRANSITO` | *"esta en camino"* |
| `EN_DESTINO` | *"ha llegado al destino y esta en verificacion"* |
| `FALTA_REVISION_EN_ORIGEN` / `FALTA_REVISION_EN_DESTINO` | Discrepancias sin resolver |
| `CONLCUIDA` | ⚠️ **mal escrito** (`CONLCUIDA`, no `CONCLUIDA`) |
| `CANCELADA` | |

> ⚠️ **`CONLCUIDA` está mal escrito y viaja al backend.** No lo corrijas del lado del cliente: el string tiene que coincidir con el del central.

### `EtapaTransferencia` — 9 valores

```
PRE_TRANSFERENCIA_CREACION → PRE_TRANSFERENCIA_ORIGEN
→ PREPARACION_MERCADERIA → PREPARACION_MERCADERIA_CONCLUIDA
→ TRANSPORTE_VERIFICACION → TRANSPORTE_EN_CAMINO → TRANSPORTE_EN_DESTINO
→ RECEPCION_EN_VERIFICACION → RECEPCION_CONCLUIDA
```

> ⚠️ **Gotcha — `estado` y `etapa` son dos dimensiones distintas.** `estado` es el estado macro; `etapa` es el paso fino del workflow. Una transferencia `EN_TRANSITO` puede estar en `TRANSPORTE_EN_CAMINO` o en `TRANSPORTE_EN_DESTINO`. La lista filtrada por ruta (`list/filtradas/:sucursalId/:etapa`) usa **etapa**, no estado. Filtrar por uno cuando la UI usa el otro devuelve resultados vacíos sin error.

### `TipoTransferencia`

`MANUAL` · `AUTOMATICA` · `MIXTA` — según se cargue a mano, la genere el sistema por reposición, o ambas.

## `isOrigen` / `isDestino`

`Transferencia` trae dos booleanos calculados: si la sucursal del usuario actual es el origen o el destino.

> **Regla clave — la misma transferencia se ve distinto según de qué lado estés.** Un usuario en origen prepara y despacha; uno en destino recibe y verifica. Estos flags deciden qué acciones muestra la UI. **No infieras el rol comparando ids de sucursal en el cliente**: usá los flags que ya vienen resueltos.

## Servicio — `TransferenciaService`

| Método | Qué hace |
|---|---|
| `onGetTransferencia(id)` | Detalle |
| `onSaveTransferencia(input)` | Alta/edición |
| `onDeleteTransferencia(id)` | Baja |
| `onGetTransferenciasWithFilters(filters)` | Lista filtrada |
| `onGetTrasnferenciasPorUsuario(id)` | *(sic)* Por usuario |
| `onGetTrasferenciasPorFecha(inicio, fin)` | *(sic)* Por fecha |
| `onGetTransferenciaItensPorTransferenciaId(id, page?, size?)` | Items paginados |
| `onGetTransferenciaItensWithFilters(id, name?, page?, size?, showLoading?)` | Items filtrados |
| `onSaveTransferenciaItem(input)` / `onDeleteTransferenciaItem(id)` | ABM de items |
| **`onAvanzarEtapa(transferencia, etapa)`** | **Avanza el workflow** |
| `onFinalizar(transferencia)` | Cierra |
| `onImprimirTransferencia(id)` | Impresión |

> ⚠️ **Gotcha — `onFinalizar` y `onAvanzarEtapa` NO son `async`.** Devuelven `Observable<boolean>` directo, a diferencia del resto del servicio. No les pongas `await`.

> **`onAvanzarEtapa` es el único camino correcto para cambiar de etapa.** No guardes la transferencia con la etapa modificada vía `onSaveTransferencia`: el backend aplica validaciones y efectos (movimientos de stock) en el avance de etapa que un save directo saltea.

## Relación con el stock

Cada transferencia concluida genera movimientos de stock de tipo `TRANSFERENCIA` (ver [`operaciones-pagos-y-varios.md`](operaciones-pagos-y-varios.md)): salida en origen, entrada en destino. **El mobile no los crea**: son consecuencia del avance de etapa en el backend.

## Operaciones GraphQL

15 archivos.

**Mutations:** `saveTransferencia`, `saveTransferenciaItem`, `deleteTransferencia`, `deleteTransferenciaItem`, `prepararTransferencia`, `finalizarTransferencia`, `imprimirTransferencia`.

**Queries:** `getTransferencia`, `getTransferenciasPorUsuario`, `getTransferenciaPorFecha`, `getTransferenciasWithFilters`, `getTransferenciaItensPorTransferenciaId`, `getTransferenciaItensWithFilter`.

## Componentes

| Componente | Rol |
|---|---|
| `TransferenciaComponent` | Hub |
| `ListTransferenciasComponent` | Lista (también en modo filtrado por etapa) |
| `NuevaTransferenciaComponent` | Alta |
| `InfoTransferenciaComponent` | Detalle con las cuatro etapas |
| `TransaferenciaListProductosComponent` | Gestión de productos *(sic en el nombre)* |
| `EditTransferenciaProductoComponent` | Alta/edición de item |
| `ModificarItemDialogComponent` | Modificación con motivo |
| `IngresarCodigoPopComponent` | Ingreso manual de código |

> ⚠️ **El archivo se llama `edit-transferenci-producto.component.ts`** (falta la `a` final en "transferencia"), en la carpeta `edit-transferencia-producto/`. **Su `.spec` es el que rompe `ng test`** con TS2724 — ver [`../TODO_TECNICO.md`](../TODO_TECNICO.md) ítem 13.

> ⚠️ **Comentario delator en el routing:** `path: 'gestion-productos', // ← AGREGAR ESTA RUTA`. Es un recordatorio de desarrollo que quedó commiteado.

## Al trabajar en este módulo

1. **Nunca colapses los campos por etapa.** La trazabilidad es el objetivo del módulo.
2. Compará presentación junto con cantidad al calcular diferencias entre etapas.
3. Usá `onAvanzarEtapa`, no `onSaveTransferencia`, para mover el workflow.
4. `estado` y `etapa` son dimensiones distintas: fijate cuál filtra la pantalla.
5. Usá `isOrigen` / `isDestino` en vez de comparar sucursales a mano.


---

# Qué cambió en la PWA

> **Estado:** portadas la **lista**, el **detalle con las cuatro etapas** y el
> **avance de etapa completo, hasta recepción concluida**, con la verificación
> ítem por ítem. El **alta** de la transferencia y la gestión de sus ítems
> —agregar y quitar productos— no.

| Ruta | Componente |
|---|---|
| `/transferencias` | `TransferenciasListaPage` |
| `/transferencias/:id` | `TransferenciaDetallePage` |

## El modo E del buscador, por fin con consumidor

`ProductoCardComponent` ahora acepta **dos existencias** —`stock` y
`stockDestino`, con sus etiquetas—, y `OpcionesBuscador` una
`sucursalDestinoId`.

> Era exactamente lo que faltaba: `TransaferenciaListProductosComponent`
> **copió la pantalla entera del buscador** en `frc-mobile` porque hacía falta
> una columna más de stock y el componente no la aceptaba. Ahora entra por
> input.

## Las cuatro etapas se muestran, no se colapsan

Es la razón de ser del módulo. Si se piden 10, se preparan 8, se despachan 8
y llegan 7, **las cuatro cifras quedan a la vista**: la diferencia 10→8 es
falta de stock en origen, la 8→7 un faltante en tránsito. Con una sola cifra
los dos casos son indistinguibles.

⚠️ **Una etapa sin cantidad no se muestra en cero**: significa «no llegó
ahí», no «cero unidades». Mostrarla en cero diría algo falso.

⚠️ **Cada etapa lleva su presentación.** Se pide en cajas y se despacha en
unidades: comparar cantidades sin mirar la presentación da diferencias
falsas.

## El rol lo dice el backend

`isOrigen` / `isDestino` vienen resueltos y deciden qué corresponde hacer: en
origen se prepara y despacha, en destino se recibe y verifica. **No se infiere
comparando ids de sucursal**, y la lista filtra por esos mismos flags.

Que una sucursal sea origen **y** destino es un caso válido, no un error.

## El avance de etapa

Las reglas viven en [`etapas.ts`](../../src/app/pages/transferencias/etapas.ts),
en funciones puras y sin UI. Están separadas a propósito: **cada avance
dispara movimientos de stock en el central**, y una condición mal copiada
despacha mercadería que nadie preparó.

| Etapa actual | Botón | Destino |
|---|---|---|
| `PRE_TRANSFERENCIA_ORIGEN` | Preparar productos | `PREPARACION_MERCADERIA` |
| `PREPARACION_MERCADERIA` | Concluir preparación | `PREPARACION_MERCADERIA_CONCLUIDA` |
| `PREPARACION_MERCADERIA_CONCLUIDA` | Verificar para transporte | `TRANSPORTE_VERIFICACION` |
| `TRANSPORTE_VERIFICACION` | Concluir y despachar | `TRANSPORTE_EN_CAMINO` |
| `TRANSPORTE_EN_CAMINO` **o** `TRANSPORTE_EN_DESTINO` | Iniciar recepción | `RECEPCION_EN_VERIFICACION` |
| `RECEPCION_EN_VERIFICACION` | Concluir recepción | `RECEPCION_CONCLUIDA` |

Se muestra **una sola acción**, la que corresponde. Un menú de etapas sería una
invitación a saltear pasos que mueven stock.

### Quién puede

La etapa la trabaja **quien la tomó**: el que aprieta «Preparar productos»
queda como `usuarioPreparacion` y es el único que confirma sus ítems. Mientras
nadie la tomó —responsable en blanco— está abierta a cualquiera.

> ⚠️ **Se recalcula en cada cambio de etapa.** En `frc-mobile` el flag
> `puedeEditar` se prende y **nunca se apaga**, así que alcanzaba con haber
> sido responsable de una etapa para poder editar las siguientes.

Las tres etapas que **cierran** una verificación exigen las dos cosas: ser el
responsable y no dejar ítems sin revisar. Las otras tres —tomar la
preparación, pasar a transporte, iniciar la recepción— son justamente el acto
de hacerse cargo, y ahí todavía no hay responsable a quien pedirle permiso.

### La verificación ítem por ítem

En `PREPARACION_MERCADERIA`, `TRANSPORTE_VERIFICACION` y
`RECEPCION_EN_VERIFICACION` cada ítem tiene su menú: **verificar con el
código**, **confirmar como viene**, **modificar**, **rechazar** y **deshacer**.

Un ítem cuenta como revisado con **cualquiera** de las tres marcas de la
etapa: cantidad, vencimiento o motivo de rechazo. Rechazar también es haberlo
mirado — es lo que distingue «no va» de «todavía no lo revisé».

> ⚠️ **Los ítems se traen todos de una** (500). El botón «Concluir» necesita
> saber si están **todos** verificados, y con paginación esa cuenta se haría
> sobre la página visible: `frc-mobile` la hace así y habilita el botón con
> ítems sin tocar en las páginas que nadie abrió.

### ⚠️ Qué central hace falta

Todo esto exige un central con el commit `8f29003f` —presente desde
`v4.7.0-alpha.42`, `v4.8.0-beta.3` y `v4.10.0`—, que trae dos cosas juntas:
la mutation `desconfirmarTransferenciaItem` y la conversión de
`saveTransferenciaItem` en un PATCH.

**Contra un central anterior el daño es silencioso.** Ahí el save es un
reemplazo completo (`ModelMapper` + `service.save`), así que un input que trae
solo los campos de la etapa en curso **pone en `null` las otras tres**: se
pierden las cuatro cifras por etapa, que son la razón de ser del módulo, y la
operación responde OK.

Al 2026-08-15 farmacia corría `4.7.0-beta.2` y bodega `4.8.0`: **ninguna lo
tiene**. Alpha sí. Las dos mitades se publican juntas.

### ⚠️ El save del central es un PATCH

`saveTransferenciaItem` **conserva lo que el input no trae**: un campo ausente
significa «no lo toques», nunca «borralo». Mandar `null` no borra nada.

Consecuencias, las dos verificadas contra `TransferenciaItemGraphQL`:

- **Desconfirmar va por `desconfirmarTransferenciaItem(id, etapa)`**, que
  vacía las columnas de esa etapa y desactiva el movimiento de stock.
  `frc-mobile` desconfirma poniendo nulos y guardando: contra este central eso
  no vacía nada, y la pantalla queda mostrando un estado que no se guardó.
- **Confirmar un ítem antes rechazado son dos llamadas**: primero vaciar la
  etapa, después guardar. Si no, el ítem sigue rechazado mientras la pantalla
  lo muestra en verde.

> ⚠️ **Siempre viaja una cantidad y una presentación para la etapa**, incluso
> al rechazar. El central multiplica `cantidad × presentacion.cantidad` para
> armar el movimiento de stock —aunque después lo deje inactivo por el
> rechazo—, y con cualquiera de las dos en `null` responde un error de
> servidor, no una validación.

### Dos cosas que se apartan de `frc-mobile`

Las dos están anotadas en el código, y se revierten en una línea si el negocio
prefiere el comportamiento viejo:

| Qué | `frc-mobile` | Acá |
|---|---|---|
| Motivo de modificación | Siempre `CANTIDAD_INCORRECTA`, aun cuando lo que cambió fue el vencimiento o la presentación | El que corresponde a lo que cambió — para eso el enum tiene los tres valores |
| Destinatario del push de rechazo | El responsable de la **etapa en curso**, que es quien acaba de rechazar: se manda un push a sí mismo | El de la **etapa anterior** — el que preparó lo que ahora se rechaza |

Y una que se agrega: `frc-mobile` **no ofrece «Modif. Item» en la recepción**
—está en el `switch` que lo procesa, pero no en la lista de acciones—. Recibir
menos de lo despachado es exactamente el caso que el módulo existe para
registrar, así que acá está en las tres etapas.

## Lo que falta

| Qué | Nota |
|---|---|
| Alta de transferencia | usa el buscador en modo E, que ya existe |
| Agregar y quitar ítems | el ABM de productos de la transferencia, antes de despacharla |
| Impresión | `imprimirTransferencia` devuelve base64 |
| Asignar lotes a mano | el central lo acepta (`lotesAsignados`); sin eso el desglose sale por FEFO, que es lo que hacen hoy todos los clientes |

> ⚠️ **`onAvanzarEtapa` es el único camino correcto para cambiar de etapa.**
> Guardar la transferencia con la etapa modificada saltea las validaciones y
> los movimientos de stock que el backend aplica en el avance. Está anotado en
> el servicio.
