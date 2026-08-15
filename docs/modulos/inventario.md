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
| ~~**Cargar el conteo**~~ | ✅ `/inventario/:id/producto/:productoId`. Cantidad, vencimiento y estado por presentación, en su propia pantalla. Ver abajo |
| ~~Revisión del supervisor~~ | ✅ `/inventario/:id/revisar`. Ver abajo |
| ~~Gestión de zonas y sectores~~ | ✅ `/inventario/lugares`. Ver abajo |
| ~~Reportes de control~~ | ✅ `/inventario/control`. Ver abajo |
| Agregar a la toma un producto que no estaba | necesita `saveInventarioProducto`, que no está portado |
| Cancelar y reabrir | ya están en el servicio |

---

# La carga del conteo — `/inventario/:id/producto/:productoId`

Se llega desde el botón *Contar* de cada producto del detalle, que **solo
aparece si el inventario está abierto**: concluido o cancelado, el conteo ya
es un hecho histórico y escribir encima cambiaría el resultado de una toma
cerrada.

Un bloque por presentación, con lo que dice el sistema, el campo *Contado*, el
vencimiento y el estado.

> ⚠️ **`cantidad` no se toca nunca.** Es lo que dice el sistema, y la
> diferencia contra `cantidadFisica` **es** el resultado del inventario. La
> pantalla solo escribe `cantidadFisica`, y manda `cantidad` de vuelta tal
> como vino.

> La diferencia se recalcula **mientras se escribe**, no al guardar: es lo que
> le dice al operador si tiene que volver a contar antes de irse del pasillo.

> ⚠️ **Un ítem arrastrado de una toma anterior lo dice.** `copiedFromItemId`
> lo marca y la pantalla lo avisa: sin eso, alguien lo lee como mercadería ya
> recorrida.

## Lo que no se puede hacer desde acá

**Agregar a la toma un producto que no estaba.**
`saveInventarioProductoItem` resuelve `inventarioProductoId` pero **no lo
crea**, y `saveInventarioProducto` no está portado. Abrir el inventario —donde
se define el alcance— sigue siendo del escritorio.

Guardar va **de a un ítem**, porque no hay mutation de lote, y espera a que
terminen todas antes de recargar: recargar en el medio mostraría la lista a
mitad de camino. Si alguna falla, lo dice y recarga igual, para que se vea lo
que sí entró.

---

# La revisión del supervisor — `/inventario/:id/revisar`

La segunda etapa: alguien contó, y acá se mira **qué quedó** para decidir si el
inventario se finaliza. Se llega desde el botón *Revisar* del detalle, que está
también con el inventario **cerrado**: revisar es leer lo que quedó, y esa
pregunta no caduca al finalizarlo.

⚠️ **Esta pantalla no corrige nada.** El conteo se edita en la carga, con el
producto delante. Un botón de editar acá sería invitar a cambiar cantidades sin
tener la mercadería a la vista.

## `verificado` y `revisado` no son una escalera

Son **dos resultados del mismo paso**, no dos pasos:

| Chip | Qué pasó |
|---|---|
| Cantidad exacta | se contó y coincidió con el sistema (`verificado`) |
| Modificado | se contó y hubo que corregirlo (`revisado`) |
| Sin revisar | nadie lo tocó |

Nunca vienen los dos juntos. `null` cuenta como `false`, igual que en el
`ORDER BY` del central: leído estrictamente, un ítem con la columna vacía
saldría **primero** en la lista y rotulado «sin revisar» — el orden diciendo
una cosa y el cartel otra.

## El selector ordena, no filtra

El parámetro `filtro` de `getInventarioItemsParaRevisar` alimenta un
`ORDER BY CASE` que **sube** los que coinciden; el resto sigue viniendo detrás.

⚠️ `frc-mobile` lo llama filtro y, cuando una página vuelve vacía, avisa «no se
encontraron productos con el criterio seleccionado». Eso hace leer «ninguno»
donde el central dice «ninguno primero». Acá se llama **Orden**, y el parámetro
del servicio también.

---

# Control de inventario — `/inventario/control`

Tres preguntas distintas sobre el saldo que lleva el central en
`movimiento_stock`:

| Reporte | Qué muestra |
|---|---|
| **Saldo negativo** | se sacó más de lo que había — casi siempre falta cargar una entrada |
| **Saldo positivo** | sobra contra el sistema |
| **Sin movimiento** | no se movió en el período: mercadería dormida o mal imputada |

⚠️ **«Sin movimiento» exige sucursal y rango; los otros dos no.** No es un
capricho del schema: un faltante solo significa algo **dentro de un período**,
mientras que un saldo positivo o negativo es un estado actual.

`frc-mobile` mete los tres detrás de un menú de acciones. Acá son un selector:
cuál está activo **es** la pregunta de la pantalla, y esconderlo obliga a abrir
un menú para saber qué se está mirando.

---

# Lugares del depósito — `/inventario/lugares`

Sectores y zonas: la geografía sobre la que se cuenta.

⚠️ **No cuelgan de un inventario, aunque `frc-mobile` los anide adentro.** Allá
se llega por `inventario/list/info/:id/gestion-zona-sector/:sucursalId/…`, seis
rutas anidadas por las que el id del inventario viaja **sin que nadie lo use**.
Sectores y zonas son de la **sucursal**: los mismos estantes sirven para todas
las tomas que vengan.

`adicionar-sector` no se portó porque no hay nada que portar: el componente es
un scaffold vacío del CLI y el alta de sector ocurre dentro de `list-zonas`.
Dos pantallas y un diálogo cubren lo que allá son seis rutas.

## Rol propio, más restrictivo

Va con `CREAR INVENTARIO` (29 usuarios), no con `VER INVENTARIO` (36): acá se
**borra** la geografía sobre la que se cuenta, y eso no es mirar un conteo.
`frc-mobile` no pide ningún rol — la pantalla cuelga de la toma y cualquiera
que llegue al inventario puede borrar zonas.

## Baja y desactivación no son lo mismo

El central **borra la fila**; si tiene zonas colgando, la baja falla por
integridad referencial. Por eso el diálogo ofrece el toggle *Activo*, que es lo
que se usa casi siempre: inactivo deja de ofrecerse en tomas nuevas sin tocar
el histórico de las viejas.

## Mayúsculas al guardar, titlecase al mostrar

Es el par que usa `frc-mobile`, y hay que tomarlo **entero**. En la base
conviven 35 sectores en minúscula con 6 en mayúscula; guardar en mayúsculas y
mostrar el texto crudo dejaría la lista pareciendo dos cargas distintas.

## Tres defectos de la capa de datos portada

Aparecieron usándola, no leyéndola:

- **`deleteSector` y `deleteZona` no aliaseaban a `data`.** La baja se ejecutaba
  en el central y la app la reportaba como fallida — el peor de los dos mundos.
- **`sectores(id:)` recibe el id de la *sucursal*,** no el del sector. El
  servicio lo llamaba sin variables.
- **`Zona.activo` estaba tipado `number`** contra un `Boolean` del schema, y
  `saveSector`/`saveZona` como si devolvieran un booleano cuando devuelven la
  entidad.
