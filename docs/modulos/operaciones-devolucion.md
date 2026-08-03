# operaciones / devolucion

**Ubicación:** `src/app/pages/operaciones/devolucion/`
**Tamaño:** 40 archivos TS, ~2.667 LOC — 3.er submódulo más grande de `operaciones`.
**Ruta base:** `/operaciones/devolucion` (+ `/operaciones/retiro-proveedor`)

## Qué resuelve

**Devolución de productos averiados o vencidos**, desde que se detectan en góndola hasta que salen de la empresa (retirados por el proveedor, canjeados, acreditados o descartados).

El circuito atraviesa tres actores: quien detecta y separa el producto en la sucursal, quien lo **colecta** hacia un depósito central, y quien lo **retira** para entregárselo al proveedor.

## Rutas

### `devolucion`

| Ruta | Componente | Rol |
|---|---|---|
| `''` | `DevolucionHomeComponent` | Hub de opciones |
| `nueva` | `DevolucionComponent` | Carga de devolución (con escaneo) |
| `historial` | `ListDevolucionComponent` | Lista paginada con filtros |
| `detalle/:id` | `DetalleDevolucionComponent` | Detalle, reabrible |
| `colecta` | `ColectaDevolucionComponent` | Colecta interna |
| `historial-colectas` | `HistorialOperacionesComponent` | Cabeceras de colecta |
| `historial-retiros` | `HistorialOperacionesComponent` | Cabeceras de retiro |

> `historial-colectas` e `historial-retiros` comparten componente: `HistorialOperacionesComponent` se parametriza por ruta.

### `retiro-proveedor` (módulo aparte)

`/operaciones/retiro-proveedor` → `RetiroProveedorComponent`. Está anidado en la carpeta `devolucion/` pero es **su propio módulo lazy**, registrado como ruta hermana en `operaciones-routing.module.ts`.

## Máquina de estados

`EstadoDevolucion` — 8 valores. **Es la regla de negocio central del módulo.**

```
PENDIENTE ──> SEPARADO ──> COLECTADO ──> RETIRADO ──┬──> CANJEADO
                                                     └──> ACREDITADO
     └──────────────> DESCARTADO
     └──────────────> CANCELADA
```

| Estado | Significado |
|---|---|
| `PENDIENTE` | Cargada, todavía en góndola |
| `SEPARADO` | Físicamente apartada, con etiqueta impresa |
| `COLECTADO` | Retirada de la sucursal hacia el depósito |
| `RETIRADO` | Entregada al proveedor |
| `CANJEADO` | El proveedor la reemplazó por producto nuevo |
| `ACREDITADO` | El proveedor emitió nota de crédito |
| `DESCARTADO` | Se tiró — sin recupero |
| `CANCELADA` | Anulada |

`TipoDevolucion`: `SIN_PROVEEDOR` · `CON_PROVEEDOR`.

> **Regla clave — el tipo determina el final posible.** Una `SIN_PROVEEDOR` (rotura interna, vencido sin acuerdo) solo puede terminar en `DESCARTADO`. `CANJEADO` y `ACREDITADO` requieren `CON_PROVEEDOR`.

### Avance y reversión

| Operación | Mutation | Alcance |
|---|---|---|
| Avanzar | `avanzarEstadoDevolucion(devolucionId, estado, usuarioId)` | Una devolución |
| Revertir estado | `revertirEstadoDevolucion(devolucionId, usuarioId)` | Una devolución |
| Revertir colecta | `revertirColectaDevolucion(colectaId, usuarioId)` | **Toda la colecta** |
| Revertir retiro | `revertirRetiroDevolucion(retiroId, usuarioId)` | **Todo el retiro** |

> ⚠️ **Gotcha — revertir una colecta o un retiro afecta a todas sus devoluciones.** No es lo mismo que revertir el estado de una devolución individual. La UI lo deja claro; una llamada directa al servicio, no.

> ⚠️ **Gotcha — no toda operación es reversible.** La UI deshabilita "Revertir" según el estado (`feat(devoluciones): deshabilitar revertir cuando la operacion no es reversible`). La validación real está en el backend: el cliente solo refleja lo que el backend permite.

## Modelo de datos

### `Devolucion`

| Campo | Nota |
|---|---|
| `tipo` | `SIN_PROVEEDOR` / `CON_PROVEEDOR` |
| `proveedor` | Solo si `CON_PROVEEDOR` |
| `sucursalOrigen` | Dónde se detectó |
| `sucursalUbicacion` | Dónde está **ahora** (cambia al colectar) |
| `colectadoEn` | Timestamp de colecta |
| `identificador` | Código de la caja/bulto físico |
| `estado`, `motivo`, `observacion`, `fecha` | |
| `items` | `DevolucionItem[]` |

> ⚠️ **Gotcha — `sucursalOrigen` ≠ `sucursalUbicacion`.** Origen es dónde se generó y no cambia; ubicación es dónde está físicamente y se actualiza al colectar. Los filtros del histórico usan una u otra según lo que se busque.

### `DevolucionItem`

Producto, presentación, `motivoAveria`, cantidad, `lote`, `vencimiento`, `costoUnitario`, más `cantidadReingresada` y `vencimientoReingreso` para el producto que vuelve a stock tras un canje.

### `MotivoAveria`

| Campo | Efecto |
|---|---|
| `descripcion` | Texto |
| `activo` | Si se ofrece al cargar |
| `generaGasto` | **Si la pérdida se imputa como gasto** |
| `aplicaProveedor` | **Si el motivo admite reclamo al proveedor** |

> **Regla clave — `generaGasto` y `aplicaProveedor` deciden el destino económico.** Un motivo con `aplicaProveedor: false` (ej. rotura por mal manejo interno) no puede terminar en `ACREDITADO`: la pérdida es de la empresa. Los motivos se traen con `motivosAveriaActivos` — no los hardcodees.

### `DevolucionItemDraft`

Fila de trabajo de la UI mientras se escanea, antes de armar el `DevolucionItemInput`. Documentado como tal en el propio modelo: no es una entidad del backend.

### Modelos del retiro consolidado

`retiro-proveedor.model.ts` define `RetiroProveedorConsolidado` → `RetiroSucursalGrupo[]` → `RetiroLineaConsolidada[]` + `RetiroCaja[]`.

La estructura agrupa **por sucursal** y dentro de cada una ofrece dos vistas: `lineas` (totales por producto, para el remito) y `cajas` (bultos físicos individuales, para el control de carga).

> **Nota del propio archivo:** *"Los nombres de campos coinciden EXACTAMENTE con el schema del backend — Apollo no valida el schema en build, por lo que cualquier desalineación rompe en runtime."* Aplica a todo el repo, pero acá está escrito.

## Servicios

### `DevolucionService`

| Método | Qué hace |
|---|---|
| `onSaveDevolucion(input)` | Alta/edición de cabecera |
| `onSaveDevolucionItem(input)` | Alta/edición de ítem |
| `onDeleteDevolucionItem(id)` | Baja de ítem |
| `onGetDevolucionById(id)` | Detalle |
| `onGetDevolucionesConFiltros(filtros)` | Lista filtrada y paginada |
| `onGetMotivosAveriaActivos()` | Catálogo de motivos |
| `onAvanzarEstado(devolucionId, estado, usuarioId)` | Avanza |
| `onRevertirEstado(devolucionId, usuarioId?)` | Revierte una |
| `onColectarEnBloque(...)` | Colecta varias de una |
| `onGetColectas(page, size)` | Cabeceras de colecta |
| `onGetRetiros(page, size)` | Cabeceras de retiro |
| `onRevertirColecta(colectaId, usuarioId?)` | Revierte colecta completa |
| `onRevertirRetiro(retiroId, usuarioId?)` | Revierte retiro completo |
| `onGetRemito(devolucionIds[])` | Remito PDF (base64) |
| `onGetRemitoRetiro(retiroId)` | Remito de un retiro |
| `onGetEtiquetasSeparadoPdf(devolucionId)` | Etiquetas PDF |

### `RetiroProveedorService`

| Método | Qué hace |
|---|---|
| `onGetConfiguracion()` | Devuelve `{ retiroPermitirSeleccionManual: boolean }` |
| `onGetConsolidado(...)` | Consolidado por proveedor |
| `onRetirarEnBloque(...)` | Retira varias, devuelve `RetiroBloqueResultado` |
| `onGetRemito(devolucionIds[])` | Remito |

> ⚠️ **Gotcha — `retiroPermitirSeleccionManual` es un flag de configuración del backend.** Habilita o no el retiro manual (elegir devoluciones a mano en vez de tomar el consolidado completo). **Consultalo antes de mostrar la opción**; no asumas que está disponible.

> ⚠️ **Gotcha — `onRetirarEnBloque` devuelve resultado por devolución.** `RetiroBloqueResultado.resultados[]` trae `{id, ok, mensaje}` para cada una: **la operación es parcialmente exitosa**. No alcanza con que la mutation no falle — hay que recorrer los resultados y avisar de los que tienen `ok: false`.

### `ImpresionEtiquetaService`

`preguntarEImprimir(devolucionId)` — pregunta al usuario y, si acepta, obtiene las etiquetas y las imprime. Se llama al pasar a `SEPARADO`: la etiqueta identifica físicamente el producto apartado.

## PDFs

Cuatro operaciones devuelven **base64** para abrir con `PdfViewerService`:

| Operación | Documento |
|---|---|
| `etiquetasSeparadoPdf(devolucionId)` | Etiquetas de separado |
| `remitoRetiro(devolucionIds[])` | Remito de retiro |
| `remitoRetiroProveedor(...)` | Remito consolidado por proveedor |

> ⚠️ **Gotcha — `remitoRetiroProveedor.ts` existe dos veces**, en `devolucion/graphql/` y en `retiro-proveedor/graphql/`. Verificá cuál importa el código que estás tocando.

## Operaciones GraphQL

16 en `devolucion/graphql/` + 5 en `retiro-proveedor/graphql/`.

**Mutations:** `saveDevolucion`, `saveDevolucionItem`, `deleteDevolucionItem`, `avanzarEstadoDevolucion`, `revertirEstadoDevolucion`, `colectarDevolucionesEnBloque`, `revertirColectaDevolucion`, `revertirRetiroDevolucion`, `retirarDevolucionesEnBloque`.

**Queries:** `devolucionById`, `devolucionConFiltros`, `motivosAveriaActivos`, `colectasDevolucion`, `retirosDevolucion`, `retiroProveedorConsolidado`, `devolucionConfiguracion`, + las de PDF.

## Estado del módulo

Desarrollado entre el **2026-07-08 y el 2026-07-16**, integrado a `develop` vía PR #89. Según la memoria del proyecto, el **testing manual sigue pendiente**. Tratá el comportamiento documentado acá como "lo que el código hace", no como "lo que está validado en producción".

## Al trabajar en este módulo

1. La transición de estados la valida el backend. No repliques la máquina en el cliente: usá `avanzarEstado` y mostrá lo que el backend permita.
2. Revertir colecta/retiro es masivo; revertir estado es individual.
3. `onRetirarEnBloque` es parcialmente exitoso: revisá `resultados[]`.
4. Los motivos de avería vienen del backend con sus flags — `generaGasto` y `aplicaProveedor` deciden a dónde puede terminar la devolución.
5. Consultá `devolucionConfiguracion` antes de ofrecer el retiro manual.
