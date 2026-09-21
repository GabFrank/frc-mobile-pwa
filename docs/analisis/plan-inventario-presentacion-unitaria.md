# Plan — el conteo de inventario solo ofrece la presentación de 1

Rama: `feature/inventario-solo-presentacion-unitaria` (desde `develop` @ `82babae`).
Pieza: **mobile-pwa**, sola. Sin cambios en central, filial ni desktop.

## Qué resuelve

Al **agregar un producto al conteo** (pantalla de carga de una zona →
*Agregar producto*), el buscador despliega **todas** las presentaciones del
producto. Un toque de más sobre «x6» en lugar de «x1» carga el conteo en la
presentación equivocada: 100 unidades contadas se vuelven 600 al finalizar,
porque `finalizarInventarioEnSucursal()` multiplica
`cantidad × presentacion.cantidad`.

A partir de este cambio, en ese buscador **solo aparecen las presentaciones de
cantidad 1**. Si el producto **no tiene ninguna** de cantidad 1, se muestran
todas, como hoy (decisión de Franco, 2026-09-21: bloquear dejaría sin poder
contar productos que solo existen en caja).

## Alcance: una sola puerta donde se **elige**

`git grep` de `BuscadorProductoDialogComponent` y `nuevoItemInput`: el único
camino por el que el operador **elige** una presentación es
`InventarioCargaPage.agregarProducto()` → `frc-buscador-producto-dialog` →
`frc-producto-card`. No hay un «cambiar presentación».

Hay un segundo camino que **crea** renglones sin elegir: `aplicarLote()`
(`inventario-carga.page.ts:838`), que con una fila que ya tiene lote abre un
renglón nuevo **copiando la presentación de la fila** (`:803`, `:826`). No hay
toque que equivocar, así que no se filtra; pero un renglón x6 que ya estaba
(de antes del deploy o generado por la toma) se replica en x6 con cada lote.

Quedan **afuera, a propósito**:

| Camino | Por qué no se toca |
|---|---|
| `aplicarLote()` | Hereda la presentación de la fila; no hay elección |
| Código de balanza (pesable) | La presentación la resuelve el código escaneado, no un toque: no hay missclick posible |
| Renglones que ya trae la toma | Los genera el central al abrir la toma; el operador no los elige |
| Buscar, transferencias, devoluciones | Mismo buscador, pero ahí elegir la caja es legítimo. La opción nace apagada |

## Diseño

- `presentacion.util.ts` → función pura `presentacionesContables(lista)`:
  devuelve las **activas** de `cantidad === 1`; si no queda ninguna, devuelve
  la lista entera (el fallback de hoy).
  - `activo === false` queda afuera: si la x1 está inactiva y la x6 activa,
    tiene que caer al fallback, no ofrecer solo la inactiva. Un `activo`
    ausente cuenta como activo.
  - `cantidad` **nulo NO cuenta como 1**, aunque `etiquetaPresentacion()` lo
    muestre así: el central hace `ipi.getCantidad() * presentacion.getCantidad()`
    con un `Double` (`InventarioGraphQL.java:257`,
    `InventarioLoteService.java:196`) y un nulo da NullPointerException al
    finalizar. Preferirla sería empujar al operador hacia el renglón que traba
    la toma.
  - `cantidad` es `Float` en el esquema: `1.0` llega como `1`; `0.5` o `1.5` no
    son unitarias.
- `productoPorCodigoQuery` pide además `activo` en `presentaciones`
  (`productoPorIdQuery` ya lo pide). Sin eso el filtro daría un resultado
  distinto según se entre por código o por texto. Es un campo que el central
  ya expone: aditivo.
- `OpcionesBuscador.soloPresentacionUnitaria?: boolean` — apagada por defecto.
- `ProductoCardComponent` → `input soloUnitaria = false`; el `computed`
  `presentaciones` aplica la función cuando está encendido. Se filtra en la
  card y no en los resultados del buscador porque la búsqueda por código ya
  trae presentaciones y el detalle las trae al expandir: filtrar al mostrar
  cubre los dos orígenes con un solo punto.
- Cuando el filtro **escondió** presentaciones, la card lo dice debajo de la
  lista: «Solo la presentación de 1 unidad: contá en unidades.» Cubre el
  error inverso: quien escanea el código de la caja x6 ve solo la x1 y, sin
  aviso, podía cargar «10» pensando en cajas.
- `BuscadorProductoComponent` pasa `opciones().soloPresentacionUnitaria` a la
  card.
- `InventarioCargaPage.agregarProducto()` enciende la opción.

## Fases

**Fase 1 (única)** — util + opción + card + inventario + tests + docs.
Menos de 150 líneas netas; partirla no deja nada probable por separado.

Tests (vitest):
- `presentacionesContables`: deja solo las de 1; varias de 1 → todas esas;
  cae en todas si no hay ninguna de 1; x1 inactiva + x6 activa → todas;
  `cantidad` nulo y fraccionarias (0.5, 1.5) no cuentan; lista vacía → vacía.
- Buscador: con la opción, la card expandida muestra solo la de 1 y el aviso;
  sin la opción, muestra todas y sin aviso (no rompe Buscar ni
  transferencias); producto sin presentación de 1 → todas, sin aviso.
- Camino por código: producto que ya llega con x1 y x6 (sin pedir `detalle`)
  → solo la x1.
- Camino por texto: expandir, completar `detalle` → sigue filtrado (prueba
  la reactividad del `computed` con la instancia reusada por el `@for`).
- Inventario: `agregarProducto()` abre el diálogo con
  `soloPresentacionUnitaria: true`.
- Revertir el filtro y confirmar que el test del buscador falla.

Docs: `docs/modulos/inventario.md` — sección «Agregar un producto a la zona»
y la tabla de casos legítimos, que hoy lista «Unidad y caja x12» (líneas 64,
434, 481): se deja escrito que **es una decisión** —contar siempre en
unidades— y se nombra `aplicarLote()` como el camino que hereda presentación;
bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md` + tabla de totales.

## Datos nuevos

| Dato | Quién lo escribe | Quién lo lee |
|---|---|---|
| `OpcionesBuscador.soloPresentacionUnitaria` | `InventarioCargaPage.agregarProducto()` | `BuscadorProductoComponent` → `ProductoCardComponent.soloUnitaria` |

Nada persiste: no hay migración ni configuración. En GraphQL solo se pide un
campo que el central ya expone (`activo` en la query por código).

## Sin verificar / cómo se verificaría

- Prueba manual en `npm start` contra central local: agregar al conteo un
  producto con x1 y x6, y otro que solo tenga caja.
- Teléfono real e iOS: sin dispositivo en esta sesión.

## Auditoría del plan (paso 5)

Dos auditores, sin verse. Todo hallazgo se verificó contra el código.

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| A y B | Presentaciones inactivas: el filtro podía dejar solo una x1 inactiva y no caer al fallback; la query por código no pide `activo` | Filtro excluye `activo === false`; `activo` se suma a `productoPorCodigoQuery` |
| A | `cantidad` nulo como 1 contradice al central (NPE al finalizar) | Nulo no cuenta como unitaria |
| A y B | Escanear la caja muestra solo la x1 sin decir nada: error inverso (contar cajas como unidades) | Aviso «contá en unidades» cuando el filtro escondió algo; caso en la prueba manual |
| A | La doc del módulo lista «unidad y caja» como legítimo | Se reescribe como decisión explícita |
| B | «Una sola puerta» era falso: `aplicarLote()` también crea renglones | Tabla de alcance corregida; queda afuera a propósito, documentado |
| B | Faltaban tests del camino por código y de la recarga del detalle | Agregados a la fase |
| B | Tomas abiertas y service worker postergado | Sin riesgo: nada persiste ni cambia contrato; rollback = revertir el front |
