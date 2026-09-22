# Plan — lotes en el conteo: presentación del renglón nuevo y orden de las fechas

Rama: `fix/inventario-lotes-presentacion-y-fechas` (desde `develop` @ `6497c46`,
con el PR #55 mergeado). Pieza: **mobile-pwa**, sola. Sin cambios en el central.

Son los dos pendientes que el PR #55 dejó documentados en
`docs/modulos/inventario.md`.

## Fase 1 — el renglón nuevo de un lote toma la presentación con la regla del alta

**Qué pasa hoy.** Al agregar un lote a un renglón que **ya tiene** uno,
`aplicarLote()` abre un renglón nuevo copiando `fila.original.presentacion.id`
(`contextoDeLote()`, `inventario-carga.page.ts`). Si el original está en la
x6, o en una presentación que hoy está inactiva, el renglón nuevo nace ahí:
esquiva las dos reglas del PR #55 —contar en unidades, y no operar sin
presentación activa—.

Cuando el renglón **no** tiene lote, `aplicarLote()` completa ese mismo
renglón (con su `id`): no se crea nada y la presentación no cambia. Eso queda
como está.

**Regla nueva, solo para el renglón nuevo** (decisión de Franco, 2026-09-22):

1. Se pide el detalle del producto (`ProductoBusquedaService.detalle()`, que
   trae todas las presentaciones con `activo` y `cantidad`).
2. Si hay una **x1 activa**, va en esa (si hay varias, la del renglón original
   si es una de ellas; si no, la primera).
3. Si no hay x1 activa y **la del renglón original está activa**, va en esa.
4. Si no, y hay **una sola** activa, va en esa.
5. Si no hay **ninguna** activa: alerta «Este producto no tiene ninguna
   presentación activa.» y no se crea nada.
6. Si hay **varias** activas, ninguna x1 y la original inactiva: no se adivina.
   Aviso «La presentación de este renglón está inactiva: agregá el producto
   con *Agregar producto* y elegí la presentación.», y no se crea nada.

Es `presentacionesContables()` (activas de 1, si no las activas, si no nada)
más la preferencia por la original. Va en una función pura
(`presentacionParaNuevoLote()` en `inventario-alta.ts`) para testearla sin la
pantalla.

**Cuándo se decide.** **Antes** del diálogo de crear lote y del buscador de
lotes: así no se tipea ni se elige un lote que después se rechaza, y en crear
lote no queda un maestro huérfano. La escritura sigue dentro de
`conTomaAbierta()`, después del diálogo: si la toma se cierra entre medio,
queda cubierto.

- Si el detalle **falla o responde vacío** (`porId` puede devolver `null`): no
  se crea nada, y **no** se muestra «ninguna activa» —sería afirmar algo que
  nadie dijo—. El error lo avisa `DatosService`; el vacío, un aviso propio.
- `agregando` se pone al empezar y se baja en **todos** los caminos: error,
  vacío, «ninguna», «elegir», diálogo cancelado. Los ítems del menú ⋮ y los
  botones «Buscar/Crear lote» se deshabilitan mientras `agregando`: el viaje
  extra agranda la ventana de un doble toque que crearía dos lotes o dos
  renglones.
- **El mismo lote dos veces en la zona** (eje A). «Crear lote» puede devolver
  un lote que ya existía (`obtenerOCrear`). Si ese lote ya está en la zona en
  otro renglón, hoy el central lo rechazaba como duplicado porque el renglón
  nuevo nacía en la misma presentación; en la x1, la clave (zona +
  presentación + vencimiento + lote, `InventarioProductoItemService.java:345`)
  ya no coincide, y `contadoPorProductoYLote` sumaría los dos. Después de
  `lotes.crear`, si el lote devuelto ya está en la zona se avisa «Ese lote ya
  está en esta zona.» y no se crea el renglón —la misma exclusión que «Buscar
  lote» ya aplica (`:1014`)—.

## Fase 2 — primero las fechas del lote, después el renglón

**Qué pasa hoy.** «Guardar conteo» (`enviar()`) manda **en paralelo**, por
cada renglón con lote que tiene fechas cambiadas, `actualizarFechas` (el
maestro del lote) y `guardarItem` (el renglón, con `vencimiento` como copia
que sostiene la clave de duplicado del central). Si el central rechaza las
fechas —por ejemplo, un retiro posterior al vencimiento—, el renglón igual se
guarda con una fecha que el lote no tiene.

**Cambio.** Por renglón, no por operación:

- Renglón **con fechas de lote cambiadas** (con o sin conteo): primero
  `actualizarFechas`; si sale bien, `guardarItem` con el `vencimiento` **que
  devolvió el maestro** (`fechaVencimiento`, recortado a `yyyy-MM-dd`: el tipo
  es `Date`). También sin conteo nuevo: si no, la copia del renglón —que
  sostiene la clave de duplicado— quedaba vieja (eje A). Sin conteo se manda
  la `cantidad` que el renglón ya tenía.
- Si `actualizarFechas` **falla o responde vacío** (`DatosService` deja pasar
  `data: null` sin error): **no** se manda `guardarItem` y el renglón queda
  entre los fallidos, con lo escrito conservado. Un vacío no es lo mismo que
  una respuesta válida con `fechaVencimiento: null`.
- Si las fechas salen bien y **`guardarItem` falla**: de `edicion` se quitan
  `vencimiento` y `fechaRetiro` y queda solo lo contado. Reintentar manda solo
  el renglón: volver a mandar las fechas tocaría otra vez el FEFO de toda la
  red, y pisaría una corrección que otro haya hecho entre medio.
- Renglón con **solo** conteo: `guardarItem` solo, como hoy.
- Renglones distintos en paralelo; el orden es solo dentro de un renglón.
- `pendientes` cuenta **renglones** —la unión por `itemId`, como
  `guardables()`—, no operaciones: con operaciones, un renglón con las dos
  terminaba antes de tiempo o nunca, y `guardando` quedaba trabado.
- El error de `actualizarFechas` salía dos veces (`DatosService` y el
  `danger` propio): queda uno.

## Fase 3 — el stock del sistema, en la presentación del renglón

**Qué pasa hoy** (hallazgo de los dos ejes). El saldo de un lote y el stock
del producto llegan **en unidades** (`LoteRepository.java:50-70`,
`buscador-lote-dialog.component.ts:252`, `productoPorSucursalStock`), y la
PWA los pone tal cual en `cantidadFisica`. En un renglón x6 eso compara cajas
contadas contra unidades del sistema: la diferencia sale mal y
`marcasDeConteo()` lo marca `revisado` aunque coincida. `frc-mobile` convertía
(`stockPorProducto / presentacion.cantidad`,
`edit-inventario-item-dialog.component.ts:65`).

`finalizarInventarioEnSucursal()` **no** usa `cantidadFisica` —suma
`cantidad × presentacion.cantidad` contra `movimiento_stock`—, así que el
ajuste de stock nunca estuvo mal: lo que está mal es lo que se ve y la marca
de revisión.

**Cambio.** Una función `enPresentacion(unidades, presentacion)` divide por
`presentacion.cantidad` (con `cantidad` nula o 0, sin convertir). Se usa en
los tres lugares donde la PWA carga el stock del sistema: `nuevoItemInput()`
(alta), y `aplicarLote()` al completar un renglón y al abrir uno nuevo. Con la
x1 no cambia nada.

## Tests

## Tests

Fase 1:
- `presentacionParaNuevoLote()`: x1 activa gana aunque el original sea x6;
  varias x1 activas prefiere la original; sin x1, la original activa; sin x1
  y original inactiva con una sola activa, esa; ninguna activa → «ninguna»;
  varias activas sin x1 y original inactiva → «elegir».
- Pantalla: crear lote sobre un renglón en x6 con la x1 activa crea el
  renglón nuevo en la x1; con ninguna activa, no abre el diálogo ni llama a
  `lotes.crear` y avisa; con el detalle fallando o vacío, tampoco y sin
  «ninguna activa»; `agregando` baja en todos esos caminos.
- Crear lote que devuelve un lote ya presente en la zona: aviso y sin renglón.
- Buscar lote: con «elegir», no abre el buscador de lotes.
- Completar un renglón **sin** lote sigue usando su propia presentación.
- `inventario-lote.spec.ts` gana `detalle` en el mock de la búsqueda.

Fase 2:
- Con fechas y conteo, `guardarItem` va **después** de `actualizarFechas` y
  con el vencimiento del maestro (los mocks devuelven la fecha: los
  `actualizarFechas: of({})` de hoy no la traen).
- Solo fechas: también manda `guardarItem` con la copia nueva.
- `actualizarFechas` falla o responde vacío: sin `guardarItem`, renglón
  fallido con lo escrito.
- Fechas bien y renglón mal: al reintentar no se vuelve a llamar a
  `actualizarFechas`.
- `guardando` no queda trabado con renglones mixtos.

Fase 3:
- `enPresentacion()`: x6 divide, x1 no cambia, cantidad nula o 0 no divide.
- Alta en x6 (sin x1 activa) y lote en un renglón x6: `cantidadFisica` en
  cajas.

- Revertir cada fase y ver fallar.

Docs: `docs/modulos/inventario.md` (sacar los dos pendientes y describir las
reglas nuevas) y un bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md`.

## Datos nuevos

Ninguno. No hay campo, clave ni configuración nuevos; el vencimiento que viaja
en `guardarItem` pasa a salir de la respuesta del maestro en vez de lo tipeado,
y `cantidadFisica` pasa a ir en la presentación del renglón.

## Sin verificar / cómo se verificaría

- Prueba manual contra el central local, con un producto con control de lote
  y más de una presentación.
- ~~La respuesta de `actualizarFechas` trae `fechaVencimiento`~~: verificado,
  `actualizarFechasLote` pide `fechaVencimiento` y `fechaRetiro`
  (`graphql/lote/graphql-query.ts:132-143`).

## Auditoría del plan (paso 5)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| A | Con el renglón nuevo en la x1, un lote existente devuelto por «Crear lote» podía quedar dos veces en la zona sin que el central lo rechace | Exclusión después de crear, como «Buscar lote» |
| A | Un renglón con solo fechas dejaba vieja su copia del vencimiento | También manda `guardarItem` con la del maestro |
| A | `fechaVencimiento` es `Date` | Se recorta a `yyyy-MM-dd` |
| A y B | El saldo y el stock llegan en unidades y se cargan sin convertir en renglones que no son x1 | Fase 3, con `frc-mobile` como referencia |
| B | `pendientes` contaba operaciones: con renglones mixtos `guardando` se trababa | Cuenta renglones |
| B | Fechas bien y renglón mal: reintentar volvía a mandar las fechas | Se quitan de `edicion` al salir bien |
| B | `null` en `actualizarFechas` o en el detalle | Fallo, no «borrado» ni «ninguna activa» |
| B | `agregando` y el doble toque con el viaje extra | Se baja en todos los caminos; ⋮ y botones deshabilitados |
| B | `inventario-lote.spec.ts` no simula `detalle`; los mocks de fechas no devuelven fecha | Se ajustan |
