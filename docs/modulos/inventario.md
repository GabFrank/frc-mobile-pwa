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

**`InventarioProducto`** — **una zona** del inventario, con flag `concluido`. El nombre engaña: la tabla tenía `producto_id` y el central se lo sacó en la migración `V61.1`, dejando la unicidad en `(inventario_id, zona_id)`. **El producto de cada renglón sale de `presentacion.producto` del item**, que es de donde lo lee `frc-mobile` (`invProItem?.presentacion?.producto?.descripcion`). Pedir `producto` o `creadoEn` sobre `InventarioProducto` hace que el central rechace la consulta entera.

**`InventarioProductoItem`** — el conteo concreto:

| Campo | Significado |
|---|---|
| `cantidad` | **Lo que se contó realmente** — sí, al revés de lo que suena |
| `cantidadFisica` | Lo que dice el sistema |
| `cantidadAnterior` | El stock del sistema al sumar el ítem a la toma |
| `presentacion` | Unidad, caja, pack… |
| `verificado` | Ya se contó |
| `revisado` | Ya pasó revisión de un supervisor |
| `vencimiento` | Fecha de vencimiento del lote contado |
| `estado` | `BUENO` / `AVERIADO` / `VENCIDO` |
| `copiedFromItemId` | Item del que se copió — **solo en memoria de `frc-mobile`**, ver abajo |

> ⚠️ **Regla clave — los nombres están al revés.** Lo contado va en **`cantidad`** y el stock del sistema en **`cantidadFisica`**. No es una interpretación: `InventarioGraphQL.finalizarInventarioEnSucursal()` suma `ipi.getCantidad() * ipi.getPresentacion().getCantidad()` y le resta el saldo de `movimiento_stock`, así que `cantidad` **es** el conteo para el central. `EditInventarioItemDialogComponent` coincide: el campo del formulario escribe `cantidad`, y `cantidadFisica`/`cantidadAnterior` se llenan con el stock del momento. La resta es el resultado del inventario; sobrescribir una con otra lo borra.
>
> *Este documento decía lo contrario, y la PWA lo implementó así: el conteo cargado desde el teléfono viajaba en un campo que el central no mira al finalizar.*

> ⚠️ **Regla clave — `verificado` y `revisado` no son dos etapas sino dos resultados del mismo paso.** Los escribe **quien cuenta**: si lo contado coincide con el sistema queda `verificado`; si hubo que corregirlo, `revisado`. Nunca las dos. `RevisarInventarioComponent` trabaja sobre los `revisado`, que son los que tuvieron diferencia.

> ⚠️ **Gotcha — el conteo es por presentación, no por producto.** Un producto con presentaciones "unidad" y "caja x12" genera items separados. Sumar cantidades entre presentaciones sin convertir por `unidadPorCaja` da un número sin sentido.

> ⚠️ **Gotcha — `copiedFromItemId` no existe en el central.** `onGetItemsDeInventariosAnteriores` permite arrastrar un conteo previo como base, y el diálogo de edición marca así el item copiado, pero la marca **vive solo en memoria**: `toInput()` no la manda, la tabla `inventario_producto_item` no tiene la columna y el tipo GraphQL no expone el campo. **Pedirlo en una consulta la hace fallar entera** (`FieldUndefined`). Si alguna vez hay que distinguir lo arrastrado, primero se persiste en el central.

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

1. Lo contado es `cantidad` y el sistema `cantidadFisica`, al revés de lo que suenan. Nunca pises una con la otra: la diferencia es el resultado.
2. El conteo es **por presentación**; convertí por `unidadPorCaja` antes de sumar.
3. Chequeá `onGetInventarioAbiertoPorSucursal` antes de abrir uno nuevo.
4. `onFinalizar/onCancelar/onReabrir` devuelven `Observable`, no `Promise`.
5. No pidas `producto` ni `creadoEn` sobre `InventarioProducto`, ni `copiedFromItemId` sobre el item: no existen en el schema del central y tumban la consulta entera.


---

# Qué cambió en la PWA

> **Estado:** portados la **lista, el detalle con el resumen del conteo y la
> finalización**. La carga del conteo y la gestión de zonas no.

| Ruta | Componente |
|---|---|
| `/inventario` | `InventarioListaPage` |
| `/inventario/nuevo` | `InventarioNuevoPage` — rol `CREAR INVENTARIO` |
| `/inventario/:id` | `InventarioDetallePage` — incluye el alta y el cierre de zonas |

Las rutas de hasta **seis segmentos y cuatro parámetros** del repo anterior
desaparecen: la geografía de zonas y sectores se gestiona desde configuración,
no desde adentro del inventario.

## La diferencia es el resultado, no un error

`inventario-conteo.ts` concentra el cálculo, con tests:

- ⚠️ **`cantidad` es lo contado; `cantidadFisica`, lo que dice el sistema.**
  Al revés de lo que sugieren los nombres, y al revés de lo que decía este
  documento. Lo fija el central:
  `InventarioGraphQL.finalizarInventarioEnSucursal()` suma
  `ipi.getCantidad() * presentacion.getCantidad()` y le resta el saldo de
  `movimiento_stock`. `frc-mobile` coincide: el campo del diálogo de conteo
  escribe `cantidad`, y `cantidadFisica`/`cantidadAnterior` guardan el stock
  del momento. La resta **es** el resultado del inventario; sobrescribir una
  con otra lo borra.
- **Sin contar no es cero.** `diferenciaDe()` devuelve `null` cuando no hay
  `cantidad`: cero significa «contado y coincide».
- **Lo arrastrado no se puede distinguir.** `copiedFromItemId` es una marca
  de memoria de `frc-mobile` que nunca llega al central: no hay columna ni
  campo. La PWA no lo pide —pedirlo tumbaba la pantalla entera con un
  `FieldUndefined`— y por eso tampoco separa lo arrastrado de lo contado.

> ⚠️ **Esto estuvo al revés y no se notaba.** La PWA escribía el conteo en
> `cantidadFisica` y devolvía `cantidad` intacta, así que
> `finalizarInventario` ajustaba el stock contra un número que nadie había
> contado. No podía verse en una prueba manual: hasta que la PWA no pudo
> **abrir** una toma, el circuito nunca se cerraba dentro de la app. Lo fija
> `inventario-conteo.spec.ts`, con un caso que cita el cálculo del central.

## Quién escribe `verificado` y `revisado`

Los escribe **quien cuenta**, no un supervisor aparte, comparando lo contado
contra lo que decía el sistema: coincide → `verificado`; hubo que corregir →
`revisado`. Nunca las dos. Vive en `marcasDeConteo()`, junto a
`estadoDeRevision()`, que es la misma regla leída del otro lado.

⚠️ La carga marcaba `verificado: true` fijo. Con eso, todo ítem contado
aparecía en la revisión como «cantidad exacta» — incluidos los que tenían
diferencia, que son justo los que el supervisor busca.

El detalle lista **una card por zona** —`inventarioProductoList` agrupa por
zona, no por producto— y muestra la diferencia por zona y en total, **con
signo**: `+` es sobrante y `−` faltante.

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
| ~~**Abrir una toma**~~ | ✅ `/inventario/nuevo`, con rol propio. Ver abajo |
| ~~Agregar zonas a la toma~~ | ✅ desde el detalle, con `saveInventarioProducto`. Ver abajo |
| ~~Agregar a la toma un producto que no estaba~~ | ✅ con el buscador, desde la pantalla de conteo. Ver abajo |
| Arrastrar el conteo de una toma anterior | `getInventarioItemsDeInventariosAnteriores` está; la marca de lo arrastrado no llega al central |
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

> ⚠️ **La pantalla es de una zona, no de un producto.** Lista todos los ítems
> de la zona y cada renglón se titula con su producto, leído de
> `presentacion.producto`. Titularlo con `InventarioProducto.producto` era
> imposible: ese campo no existe en el central.

## Agregar un producto a la zona

*Agregar producto* abre `frc-buscador-producto-dialog`, el mismo buscador de
la pestaña Buscar: descripción, código, cámara y códigos de balanza. Recibe la
sucursal de la toma, así que muestra el stock de cada producto antes de
elegirlo.

El ítem se **persiste al elegirlo**, con el stock del sistema y sin conteo, y
la lista se recarga. Así hay una sola fuente de verdad —lo que dice el
central— y no un renglón a medio existir que se pierde si alguien sale de la
pantalla antes de guardar.

⚠️ **El stock va a `cantidadFisica`, no a `cantidad`.** Es la trampa de este
módulo aplicada al alta: `cantidad` es lo contado y es lo que el central suma
al finalizar. Ponerle el stock ahí haría que la toma se cerrara sola, con cero
diferencia, sin que nadie hubiera contado. El ítem nace sin `verificado` ni
`revisado` — son el resultado de contar, y todavía no contó nadie.

**El peso de un código de balanza entra como lo contado.** Pesar, escanear la
etiqueta y que la cantidad salga del código es el flujo real de la balanza.

**Una presentación que ya está en la zona no se duplica.** La clave real es
`(inventario_producto, presentacion)`: dos renglones de lo mismo se suman los
dos al finalizar. Otra presentación del mismo producto sí se puede agregar —
«unidad» y «caja x12» son dos ítems legítimos.

**Si no se pudo consultar el stock, no se agrega.** Un cero inventado diría que
el sistema no tiene nada de ese producto, que es una afirmación que nadie hizo.

Guardar el conteo va **de a un ítem**, porque no hay mutation de lote, y espera
a que terminen todas antes de recargar: recargar en el medio mostraría la lista
a mitad de camino. Si alguna falla, lo dice y recarga igual, para que se vea lo
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

---

# Abrir una toma — `/inventario/nuevo`

Se llega desde el botón *Nuevo inventario* de la lista. Es el paso que
faltaba para que el ciclo entero —abrir, contar, finalizar— ocurra en el
teléfono.

## Rol propio, más restrictivo

`CREAR INVENTARIO` (29 usuarios), no `VER INVENTARIO` (36): abrir una toma
define el alcance de lo que se va a contar y, al finalizarla, ajusta el stock
de la sucursal. `frc-mobile` no pide ninguno — el botón cuelga del hub y lo ve
cualquiera que llegue al módulo.

## Las tomas abiertas se avisan, no bloquean

Al elegir la sucursal se consulta `inventarioAbiertoPorSucursal` y **se listan
todas** las que vuelven, con quién las abrió y hace cuántos días, más un botón
para **cancelar** cada una. El alta sigue disponible; la confirmación dice
cuántas hay antes de abrir otra.

⚠️ **Esto empezó siendo un bloqueo y los datos reales lo desmintieron.** La
regla «una sola toma abierta por sucursal» es correcta, pero nunca se aplicó:
en la base de bodega, **`SUC. CENTRAL` tiene 24 inventarios en estado
`ABIERTO`** —el más viejo de mayo de 2023, casi todos de otra gente y sin
ítems cargados— y en toda la tabla hay **2.851 filas donde `estado` y
`abierto` no coinciden**. Con un bloqueo, cerrás una y aparece la siguiente: el
alta quedaba inutilizable.

⚠️ **Y el bloqueo empujaba a la peor salida.** La única forma de destrabarlo
era *Finalizar*, y finalizar una toma de 2023 hace que el central cree
movimientos de ajuste que llevan el stock **de hoy** al conteo de entonces. Por
eso ahora la pantalla ofrece **Cancelar**, que era el remedio correcto y estaba
en el servicio sin que ninguna pantalla lo usara.

| | Qué le hace al stock |
|---|---|
| **Cancelar** | Nada. Pone `CANCELADO` y **desactiva** los ajustes que la toma hubiera generado |
| **Finalizar** | **Crea** ajustes que llevan el stock de hoy a lo contado en esa toma |

`frc-mobile` también avisa y sigue. La diferencia es que acá el aviso dice
**cuántas** son: ver una sola hace pensar «la cierro y sigo»; ver que son 24
dice que el problema es otro.

⚠️ `frc-mobile` tiene ese chequeo escrito y **nunca lo ejecuta**: vive en
`cargarDatos()`, que solo se llama desde `onScanQr()`, dentro de un bloque
oculto por `[hidden]="isNew"` con `isNew` siempre en `true`. Desde el hub, el
alta pasa de largo.

⚠️ Y su confirmación es `if (res.role = 'aceptar')` — una **asignación**, no
una comparación. Cancelar crea el inventario igual.

**Si la consulta falla, se avisa pero no se afirma que la sucursal está
limpia.** «No hay ninguna» y «no pude preguntar» son respuestas distintas.

## Finalizar una toma vieja lo dice

Cuando la toma lleva **180 días o más** abierta, la confirmación de *Finalizar*
cambia: dice cuántos días lleva, que va a ajustar el stock de hoy con lo que se
contó entonces, y que si nadie la va a terminar lo correcto es cancelarla. El
diálogo pasa a ser destructivo.

El detalle también ofrece **Cancelar toma** junto a *Finalizar*, con el
inventario abierto.

## Solo sucursales operables, y el tipo no se elige

Sin depósito no hay stock que contar: `SERVIDOR` y `COMPRAS` quedan afuera por
`soloOperables()`. El tipo es siempre `ZONA`, como en `frc-mobile`: toda la
app —el detalle, la carga, la revisión— cuenta por zona. Un `ABC` o un
`CATEGORIA` define su alcance en el escritorio.

⚠️ **El input no lleva `id`.** `saveInventario` decide que es un alta con
`input.getId() == null`, y de eso depende que dispare el aviso push de
«inventario iniciado» a los roles de inventario.

---

# Zonas de la toma — dentro de `/inventario/:id`

Con el inventario abierto, el detalle suma *Agregar zona* y, por zona,
*Concluir* / *Reabrir*.

⚠️ **Un `@if` por botón, no uno con los tres adentro.** Un bloque de control
de flujo con más de un nodo raíz **no proyecta al slot** y los botones caen
sueltos en el cuerpo de la card en vez del pie. Angular lo avisa con `NG8011`,
que es un **warning**: el build pasa igual y solo se ve mirando la pantalla.
Lo cuida `inventario-zonas.spec.ts`, que mira **dónde** está el botón y no si
su texto aparece — con la proyección rota el texto está igual, en el lugar
equivocado. Es la segunda vez que se cae en esto; la primera fue el botón de
guardar de la carga del conteo.

Los sectores se piden **al tocar el botón**, no al cargar la pantalla: es una
consulta que solo necesita quien va a agregar, y la mayoría entra al detalle a
mirar cómo va el conteo.

## Qué zonas se ofrecen

`zonasDisponibles()` descuenta las que **ya están en la toma** y las
**inactivas**.

⚠️ La unicidad de `inventario_producto` es `(inventario_id, zona_id)`:
ofrecer una repetida termina en un error del central donde tenía que haber una
lista más corta. `frc-mobile` también las descuenta, con un `filter` sobre
`s.zonaList` que **muta el array del servicio** — el segundo intento en la
misma pantalla arranca con la lista ya recortada.

El selector es una **lista con filtro por texto**, no un acordeón de sectores:
un depósito grande tiene decenas de zonas y se las busca por nombre.

## Crear la zona que falta, sin salir de la toma

Si la zona no existe, el mismo diálogo la crea: sector —de los que hay, o uno
nuevo escrito ahí— y descripción. La zona recién creada **se suma a la toma sin
un segundo paso**, como si se la hubiera elegido de la lista.

Es lo que hace útil el flujo de `frc-mobile`, que anida la gestión de lugares
adentro del inventario: encontrarse con que falta una zona **con la mercadería
delante** no puede obligar a salir, ir a otra pantalla y volver. La diferencia
es que acá solo se **crea**; administrar, desactivar y borrar sigue en
`/inventario/lugares`, y no se heredan las seis rutas anidadas.

⚠️ **Tres escrituras encadenadas y ninguna transacción.** Sector, zona y
renglón de la toma. Si falla la zona, el sector ya quedó creado: se avisa qué
pasó y se recarga, en vez de decir «no se pudo» sobre algo que sí ocurrió —
negarlo deja a la persona creando el sector de nuevo y duplicándolo.

**Mayúsculas al guardar, titlecase al mostrar**, igual que en Lugares del
depósito: en el central conviven cargas de años distintos y se comparan por
texto.

## Una sola zona abierta a la vez

Reabrir una zona con otra sin concluir queda bloqueado, igual que en
`verificarAbiertos()` de `frc-mobile`: con dos zonas en curso, quien cuenta
pierde de vista en cuál está y los conteos se mezclan.

`concluido` sin valor cuenta como abierta — el central deja la columna en
`null` hasta que alguien la concluye.

## El input de la zona no lleva `productoId` ni `creadoEn`

El `toInput()` de `frc-mobile` los manda igual. El
`InventarioProductoInput` del central no los declara, así que la validación de
GraphQL rechaza la mutation entera antes de llegar al resolver — el mismo
campo fantasma que ya tumbó consultas acá: el central le sacó `producto_id` a
la tabla en la migración `V61.1`.
