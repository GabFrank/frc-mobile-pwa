# inventario

**Ubicación:** `src/app/pages/inventario/`
**Tamaño:** 52 archivos TS, ~4.229 LOC — el módulo más grande fuera de `operaciones`.
**Ruta base:** `/inventario`
**Permiso:** el ítem del menú exige el rol `VER INVENTARIO`.

## Qué resuelve

**Toma de inventario físico**: contar la mercadería real en góndola y depósito, compararla contra el stock del sistema y registrar las diferencias.

El conteo se organiza por **sector y zona** (la geografía física del local), de modo que varias personas puedan contar en paralelo sin pisarse.

```
Inventario (cabecera, por sucursal)
   └─ InventarioProducto (un producto en una zona)
        └─ InventarioProductoItem (un conteo concreto por presentación)
```

## Rutas

| Ruta | Componente |
|---|---|
| `''` | `InventarioComponent` |
| `list` | `ListInventarioComponent` |
| `control-inventario` | `ControlInventarioComponent` |
| `list/info/:id` | `EditInventarioComponent` |
| `list/info/:id/finalizar` | `FinalizarInventarioResumenComponent` |
| `list/info/:id/gestion-zona-sector/:sucursalId` | `GestionZonaSectorComponent` |
| `.../list-zonas` y `.../list-zonas/:sectorId` | `ListZonasComponent` |
| `.../list-zonas/:sectorId/adicionar-zona/:zonaId` | `AdicionarZonaComponent` |
| `.../adicionar-sector/:sectorId` | `AdicionarSectorComponent` |

> ⚠️ **Gotcha — rutas de hasta 6 segmentos con 4 parámetros.** `ListZonasComponent` está registrado dos veces, con y sin `:sectorId`. Al navegar programáticamente, armá la URL con cuidado: un parámetro de menos cae en la otra ruta en vez de fallar.

## Modelo de datos

### Jerarquía en tres niveles

**`Inventario`** — la cabecera: sucursal, `fechaInicio`/`fechaFin`, `abierto`, `tipo`, `estado`, observación.

**`InventarioProducto`** — un producto dentro de una **zona**, con flag `concluido`.

**`InventarioProductoItem`** — el conteo concreto:

| Campo | Significado |
|---|---|
| `cantidad` | Lo que dice el sistema |
| `cantidadFisica` | **Lo que se contó realmente** |
| `cantidadAnterior` | Lo que había en el inventario previo |
| `presentacion` | Unidad, caja, pack… |
| `verificado` | Ya se contó |
| `revisado` | Ya pasó revisión de un supervisor |
| `vencimiento` | Fecha de vencimiento del lote contado |
| `estado` | `BUENO` / `AVERIADO` / `VENCIDO` |
| `copiedFromItemId` | Item del que se copió |

> **Regla clave — tres cantidades, tres propósitos.** `cantidad` (sistema) vs `cantidadFisica` (contado) da la diferencia del inventario actual; `cantidadAnterior` permite ver la evolución entre tomas. **Nunca sobreescribas `cantidad` con `cantidadFisica`**: la diferencia es el resultado del inventario.

> **Regla clave — `verificado` y `revisado` son etapas distintas.** Primero alguien cuenta (`verificado`), después un supervisor valida (`revisado`). `RevisarInventarioComponent` trabaja sobre los verificados no revisados.

> ⚠️ **Gotcha — el conteo es por presentación, no por producto.** Un producto con presentaciones "unidad" y "caja x12" genera items separados. Sumar cantidades entre presentaciones sin convertir por `unidadPorCaja` da un número sin sentido.

> ⚠️ **Gotcha — `copiedFromItemId` señala items copiados de inventarios anteriores.** `onGetItemsDeInventariosAnteriores` permite arrastrar un conteo previo como base. Un item con este campo **no fue contado en esta toma**: filtralo antes de calcular cobertura del conteo.

### Enums

**`InventarioEstado`:** `ABIERTO` → `CONCLUIDO`, o `CANCELADO`.

**`InventarioProductoEstado`:** `BUENO` · `AVERIADO` · `VENCIDO` — el estado de la mercadería contada. Los averiados y vencidos alimentan el circuito de [devoluciones](operaciones-devolucion.md).

**`TipoInventario`** — cómo se selecciona qué contar:

| Tipo | Criterio |
|---|---|
| `ABC` | Por clasificación ABC (rotación/valor) |
| `ZONA` | Todo lo de una zona física |
| `PRODUCTO` | Lista puntual de productos |
| `CATEGORIA` | Por categoría de producto |

> **Regla clave — el tipo define el alcance y no debería cambiarse a mitad de conteo.** Un inventario `ZONA` cuenta todo lo de esa zona; uno `ABC` solo los productos de la clasificación. Cambiar el tipo con items ya cargados deja un conteo cuyo alcance no coincide con su definición.

> ⚠️ **Gotcha — `Inventario.abierto` y `Inventario.estado` son redundantes.** `abierto: boolean` convive con `estado: ABIERTO|CANCELADO|CONCLUIDO`. Nada garantiza que estén sincronizados. **Usá `estado`**, que es el que tiene los tres casos.

### DTOs de reporte

`ProductoSaldoDto` (`productoId`, `productoDescripcion`, `sucursalId`, `saldoTotal`, `imagenPrincipal`) y `ProductoVencidoView` alimentan los reportes de `ControlInventarioComponent`.

## Sectores y zonas

`Sector` y `Zona` viven en `domains/sector/` y `domains/zona/`, con sus propias queries. Un sector agrupa zonas; una zona es la unidad de conteo asignable a una persona.

`GestionZonaSectorComponent` y sus hijos permiten crear y editar esta geografía desde el inventario, sin salir al módulo de configuración.

## Servicio — `InventarioService`

### Ciclo de vida

| Método | Qué hace |
|---|---|
| `onSaveInventario(input)` | Alta/edición de cabecera |
| `onFinalizarInventario(id)` | Cierra y aplica las diferencias |
| `onCancelarInventario(id)` | Cancela |
| `onReabrirInventario(id)` | Reabre uno cerrado |
| `onDeleteInventario(id)` | Baja |

> ⚠️ **Gotcha — `onFinalizarInventario`, `onCancelarInventario` y `onReabrirInventario` NO son `async`.** Devuelven `Observable` directo, a diferencia del resto del servicio que devuelve `Promise<Observable>`. No les pongas `await`: te queda el observable envuelto en una promesa ya resuelta y la suscripción no dispara.

### Carga y conteo

| Método | Qué hace |
|---|---|
| `onGetInventario(id, showLoading?)` | Detalle |
| `onGetInventarioUsuario()` | Inventarios del usuario |
| `onGetInventarioUsuarioPaginado(...)` | Ídem, paginado |
| `onGetInventarioAbiertoPorSucursal(id)` | **Abiertos de una sucursal** |
| `onGetInventarioProItem(id, page)` | Items de un producto |
| `onGetItemsPorInvProYPresentacion(invProId, presentacionId, page, size)` | Items por presentación |
| `onGetItemsDeInventariosAnteriores(invProId, presentacionId, page, size)` | Conteos previos |
| `onGetInventarioItemsParaRevisar(...)` | Pendientes de revisión |
| `onSaveInventarioProducto(input)` / `onSaveInventarioProductoItem(input)` | Guardado |
| `onDeleteInventarioProducto(id)` / `onDeleteInventarioProductoItem(id, item?)` | Baja |

> **Usá `onGetInventarioAbiertoPorSucursal` antes de crear uno nuevo.** Dos inventarios abiertos simultáneos en la misma sucursal producen conteos que se pisan.

### Reportes

`onGetProductosConCantidadPositiva(...)`, `onGetProductosConCantidadNegativa(...)`, `onGetProductosFaltantes(...)`, `onGetProductosVencidos(filters)`.

> **Regla clave — cantidad negativa es una anomalía, no un caso normal.** El sistema puede llegar a stock negativo si se vendió más de lo registrado como recibido. Ese reporte es la herramienta de diagnóstico de ese descuadre.

## Operaciones GraphQL

21 archivos en `graphql/`.

**Mutations:** `saveInventario`, `saveInventarioProducto`, `saveInventarioProductoItem`, `deleteInventario`, `deleteInventarioProducto`, `deleteInventarioProductoItem`, `finalizar-inventario`, `cancelar-inventario`, `reabrir-inventario copy`.

**Queries:** `getInventario`, `getInventarioPorUsuario`, `getInventarioPorUsuarioPaginadoGQL`, `getInventarioPorFecha`, `getInventarioAbiertoPorSucursal`, `getInventarioItemsParaRevisar`, `getInventarioItemsPorInvProYPresentacion`, `getInventarioItemsDeInventariosAnteriores`, `getProductosConCantidadPositivaGQL`, `getProductosConCantidadNegativaGQL`, `getProductosFaltantesGQL`.

> ⚠️ **Dos archivos con `" copy"` en el nombre y uno de ellos está en uso.** `reabrir-inventario copy.ts` **es el que importa el servicio** — no es un duplicado muerto, es el archivo real con nombre de copia. `getInventarioProductoItemPorInventarioProducto copy.ts` habría que verificarlo. Anotado en [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

## Componentes

| Componente | Rol |
|---|---|
| `InventarioComponent` | Hub |
| `ListInventarioComponent` | Lista |
| `NuevoInventarioComponent` | Alta |
| `EditInventarioComponent` | Carga del conteo |
| `RevisarInventarioComponent` | Revisión del supervisor |
| `FinalizarInventarioResumenComponent` | Resumen previo al cierre |
| `ControlInventarioComponent` | Reportes |
| `EditInventarioItemDialogComponent` | Edición de un item |
| `SelectZonaDialogComponent` | Selección de zona |
| `GestionZonaSectorComponent` + hijos | ABM de sectores y zonas |

## Al trabajar en este módulo

1. Nunca pises `cantidad` con `cantidadFisica`: la diferencia es el resultado.
2. El conteo es **por presentación**; convertí por `unidadPorCaja` antes de sumar.
3. Chequeá `onGetInventarioAbiertoPorSucursal` antes de abrir uno nuevo.
4. `onFinalizar/onCancelar/onReabrir` devuelven `Observable`, no `Promise`.
5. Filtrá los items con `copiedFromItemId` al medir cobertura del conteo.


---

# Qué cambió en la PWA

> **Estado:** portados la **lista, el detalle con el resumen del conteo y la
> finalización**. La carga del conteo y la gestión de zonas no.

| Ruta | Componente |
|---|---|
| `/inventario` | `InventarioListaPage` |
| `/inventario/:id` | `InventarioDetallePage` |

Las rutas de hasta **seis segmentos y cuatro parámetros** del repo anterior
desaparecen: la geografía de zonas y sectores se gestiona desde configuración,
no desde adentro del inventario.

## La diferencia es el resultado, no un error

`inventario-conteo.ts` concentra el cálculo, con tests:

- **`cantidad` es lo que dice el sistema; `cantidadFisica`, lo contado.** La
  resta **es** el resultado del inventario. Sobrescribir una con otra lo
  borra.
- **Sin contar no es cero.** `diferenciaDe()` devuelve `null` cuando no hay
  `cantidadFisica`: cero significa «contado y coincide».
- **Lo arrastrado se cuenta aparte.** Un ítem con `copiedFromItemId` viene de
  una toma anterior y **nadie lo tocó ahora**: no suma a la cobertura ni a la
  diferencia. Sumarlo haría creer que se recorrió mercadería que nadie contó.

El detalle muestra la diferencia por producto y en total, **con signo**: `+`
es sobrante y `−` faltante.

## Finalizar aplica las diferencias

No es un cambio de estado: lo que quedó sin contar entra como diferencia
contra el stock. Por eso la confirmación **dice cuántos ítems tienen
diferencia y cuánto suma**, en vez de preguntar «¿seguro?».

## Dos gotchas heredados que se respetan

- **Se usa `estado`, no `abierto`.** Son redundantes y nada garantiza que
  estén sincronizados; `estado` es el que tiene los tres casos.
- **Zona y sector se llaman `descripcion`, no `nombre`.** Costó un error de
  compilación al portar.

## Lo que falta

| Qué | Nota |
|---|---|
| **Cargar el conteo** | es el modo D del buscador: cantidad, vencimiento y estado por presentación, **en su propia pantalla** y no dentro del buscador (ver el análisis del buscador) |
| Revisión del supervisor | trabaja sobre los verificados no revisados |
| Gestión de zonas y sectores | |
| Reportes de control | positivos, negativos, faltantes y vencidos |
| Cancelar y reabrir | ya están en el servicio |
