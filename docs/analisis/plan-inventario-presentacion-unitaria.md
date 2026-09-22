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

**Fase 1** — util + opción + card + inventario + tests + docs.
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

**Fase 2** — el renglón recién agregado nace desplegado. Pedido de Franco tras
probar la fase 1 (2026-09-22): hoy se elige la presentación, se recarga la
lista y hay que buscar el renglón y tocarlo para cargar la cantidad.

- `InventarioCargaPage.agregarProducto()`: `saveInventarioProductoItem` ya
  devuelve el `id` del renglón nuevo (`graphql-query.ts:141`); hoy el `next`
  lo descarta (`:684`). Con `Number(res?.id)` finito y mayor que 0:
  `abiertoId.set(id)` y `recienAgregadoId.set(id)` antes de `cargar()`, que no
  toca `abiertoId`. Un id inválido o una respuesta nula no abre nada.
- `InventarioItemCardComponent` → `input enfocar = false` y
  `output enfocado`. En el constructor, **`afterNextRender`** —una sola vez por
  instancia, con el DOM ya pintado—: si `enfocar` y `abierta`, `scrollIntoView`
  del host (`block: 'nearest'`) y, si el campo «Contado» está habilitado **y
  vacío**, `focus({ preventScroll: true })`; después emite `enfocado`.
  - Nada de `effect`: leería `fila()`, que se reconstruye con cada tecla
    (`items()` arma objetos nuevos, `:292`), y volvería a enfocar en cada
    pulsación.
  - Vacío: un pesable ya nace con el peso como contado (`inventario-alta.ts:231`);
    subirle el teclado sería de más.
  - Con lote y sin lote todavía, el campo está deshabilitado: solo scroll, y
    queda a la vista el aviso de elegir lote.
- La página limpia `recienAgregadoId` en `(enfocado)`. **La marca vive en la
  página, no en la card**: `cargar()` cambia la lista por el skeleton y el
  `@for` recrea todas las cards, así que sin limpiarla al consumirla el foco
  volvía con cada recarga — «Guardar conteo», `aplicarLote()`, `quitarItem()`.
  `alternar()` también la limpia.
- ⚠️ **iOS no sube el teclado**: un `focus()` después de un viaje a la red ya
  no es un gesto del usuario. El campo queda enfocado y a la vista, pero hay
  que tocarlo. En Android sí sube.
- Consecuencia a la vista: con un renglón abierto, *Agregar producto* se
  esconde (`mostrarAgregar`, `:608`, a propósito desde antes). Para agregar
  otro, se colapsa el renglón o se guarda el conteo.

Tests: el alta abre el id devuelto (falla con el código viejo, que lo
descarta); id inválido o respuesta nula no abre; `(enfocado)` limpia la marca y
una segunda recarga no vuelve a enfocar; la card con `enfocar` enfoca el campo
vacío y emite `enfocado`; con el campo deshabilitado o ya contado no enfoca y
emite igual. Revertir y ver fallar.
Docs: `docs/modulos/inventario.md` (alta) y casos nuevos en el bloque 66.

**Auditoría del plan de la fase 2:** los dos ejes coincidieron en que un
`effect` en la card reenfocaba en cada tecla y que la marca limpiada solo en
`alternar()` reenfocaba en cada recarga. Se cambió a `afterNextRender` +
`enfocado`. Eje A sumó el pesable, el tipo del id y *Agregar producto* oculto;
eje B, iOS y los tests de recarga. Todo verificado contra el código.

**Fase 3** — sin presentación activa, no se opera. Pedido de Franco
(2026-09-22): si el producto **no tiene presentaciones**, o **ninguna está
activa**, el conteo muestra una alerta que lo dice y no deja elegir nada. Sirve
para que quien cuenta avise al encargado: el producto está en la góndola y el
catálogo no lo deja vender.

Llegan al buscador, verificado en el central:
- por texto, Lucene (`app.search.producto.enabled`, por defecto `true`) filtra
  solo `producto.activo` y no mira presentaciones (`ProductoService.java:158-161`);
  la PWA no manda `conStock`, así que no pasa por `searchWithFiltersByIds`;
- por código, `findByCodigo` no filtra nada (`ProductoRepository.java:89-93`);
- el detalle (`ProductoResolver.java:212`) trae también las inactivas, con `activo`.
Un producto sin ninguna presentación no tiene código: solo llega por texto.
El camino SQL (`findbyAll`, con Lucene apagado) los excluye; ahí no aparecen.

**Regla** (`presentacionesContables()`, cambia la de la fase 1): trabaja solo
sobre las **activas** — las activas de 1; si no hay, las activas; si no hay
ninguna activa, `[]`. Una x1 inactiva con una x6 activa ofrece la x6; una x1
inactiva sola ya no se ofrece.

**«No hay» y «no pude preguntar» son distintos** (hallazgo de los dos ejes).
Hoy, si el detalle falla, la card queda vacía y dice «no tiene presentaciones
cargadas»; y `cargandoDetalle` guarda **un** id, así que abrir A y enseguida B
deja a una de las dos vacía mientras su detalle viaja. Con la alerta nueva,
eso sería acusar al catálogo por un corte de red. Por eso, en el buscador:
- `cargandoDetalle` pasa a un conjunto de ids, y se suma `detalleFallido`
  (conjunto de ids) con **Reintentar** en la card. Beneficia a todos los
  consumidores: hoy el error se muestra como «sin presentaciones».
- Un detalle que responde sin producto cuenta como fallido, no como vacío.
- Presentaciones **desconocidas** (`undefined`: la búsqueda por texto no las
  trae) no son **vacías** (`[]`, dicho por el central).

**La card, con `soloUnitaria`**, en este orden: cargando → «Cargando…»;
fallido → «No se pudieron cargar las presentaciones» + Reintentar;
desconocidas → «Cargando…»; `[]` → alerta de error «Este producto no tiene
presentaciones.»; ninguna activa →
«Este producto no tiene ninguna presentación activa.».
Sin botones en las dos alertas. Los textos no mandan a avisar a nadie
(pedido de Franco, 2026-09-22): dicen qué le falta al producto y nada más. Sin `soloUnitaria`, sin alertas: solo gana el
estado de error nuevo.

**El aviso «contá en unidades»** se muestra solo si **todo lo ofrecido es de
cantidad 1** y el filtro escondió alguna **activa de otra cantidad**. Antes
comparaba contra todas: con x6 activa + x1 inactiva ofrecía la x6 **diciendo
«contá en unidades»** — el operador contaba 12, tocaba la x6 y el central
registraba 72. Tampoco se muestra por ocultar solo inactivas.

**El código de balanza** emite su presentación sin pasar por la card.
`agregarProducto()` rechaza una presentación con `activo === false` (ausente
pasa) y no guarda, con «Esa presentación está inactiva.»
— no «ninguna activa»: `resolverPresentacionPorCodigo` cae en la principal sin
mirar `activo`, y el producto puede tener otra activa.

**Queda afuera, documentado:** `aplicarLote()` crea renglones heredando la
presentación de la fila aunque esté inactiva; y los renglones que ya están en
una presentación inactiva se siguen contando, guardando y quitando — bloquear
eso trabaría tomas abiertas.

Tests: la regla (x1 inactiva + x6 activa → x6; todas inactivas → vacío; sin
presentaciones → vacío; el test de la fase 1 que esperaba «todas» pasa a
esperar solo la activa); la card con la opción muestra cada alerta sin
botones; detalle fallido → estado de error con Reintentar, **sin** alerta de
catálogo; detalle nulo → fallido; A y B expandidos en paralelo no se pisan el
cargando; x6 activa + x1 inactiva → x6 **sin** «contá en unidades»; sin la
opción, sin alertas; `agregarProducto()` con presentación inactiva no guarda y
avisa. Revertir y ver fallar. Docs: módulo de inventario (regla nueva, las
alertas, lo que queda afuera) y bloque 66 (921 CARBON BRITEZ pasa a alerta).

**Auditoría del plan de la fase 3:** eje A — alerta falsa si el detalle falla o
por la carrera de `cargandoDetalle`; el pesable puede resolver una inactiva
teniendo otra activa. Eje B — lo mismo, más el aviso «contá en unidades» sobre
una x6 (grave) y `aplicarLote()` como tercera puerta. Todo verificado contra
el código e incorporado arriba.

**Fase 4** — un botón por vez en la barra. Pedido de Franco tras probar las
fases 2 y 3 (2026-09-22): al guardar, el renglón seguía desplegado, y
«Guardar conteo» quedaba visible pero deshabilitado.

- **«Guardar conteo» cuenta lo que de verdad se guarda.** Hoy `cambiados()`
  cuenta cualquier entrada de `edicion` (`:457`), pero `guardar()` solo envía
  filas con `contado` o una fecha de lote (`:996-1000`): escribir un número y
  borrarlo dejaba «Guardar conteo (1)» que solo contesta «Escribí al menos una
  cantidad». Pasa a un `guardables()` con **el mismo filtro que usa
  `guardar()`**, y el botón, su número y la visibilidad salen de ahí.
- **La barra muestra uno solo:**
  - hay algo guardable, o se está guardando → solo «Guardar conteo (n)»;
  - no hay → solo «Agregar producto» (toma abierta), **salvo** que el renglón
    abierto espere su lote (conteo bloqueado): ahí el paso siguiente es el
    menú ⋮, y *Agregar producto* se leería como el siguiente — la confusión
    que motivó `mostrarAgregar`.
  - sin ninguno de los dos (toma cerrada), la barra no se pinta: hoy queda
    una franja vacía con borde.
- **Al guardar se contrae; lo que falló, no.** `terminar()` hoy vacía toda la
  `edicion` aunque algo falle (`:1066`), así que «queda abierto para
  reintentar» no dejaba nada que reintentar. Pasa a juntar los `itemId` que
  fallaron: de `edicion` salen **solo los que se guardaron**, y el renglón
  abierto queda en el **primero que falló** (o ninguno, si salió todo). La
  barra vuelve a «Guardar conteo» con los fallidos. Se limpia
  `recienAgregadoId`.
- **Cambia una decisión anterior:** *Agregar producto* se escondía con una
  card abierta porque, al lado de «Guardar conteo», competía. Con un botón por
  vez el criterio es «hay algo para guardar» (y el caso del lote de arriba).
- Agregar un producto con cambios sin guardar ya no se puede: primero se
  guarda. Hoy no se perdía nada (`cargar()` no toca `edicion`); es una
  restricción nueva, consecuencia del pedido.

Queda afuera, preexistente: `aplicarLote()`, `crearLote()` y `quitarItem()`
usan la señal `agregando`, así que mientras aplican el botón dice
«Agregando…»; y aplicar un lote a un renglón que ya tenía uno borra lo escrito
en el original (`:877`).

Tests: escribir y borrar no deja «Guardar conteo»; sin guardables se ve solo
*Agregar producto*; con guardables solo «Guardar conteo (n)» con el n
correcto; renglón abierto esperando lote → sin *Agregar producto*; toma
cerrada sin cambios → sin barra; guardar todo contrae y limpia; con un fallo,
la edición del fallido sobrevive, el renglón abierto es el fallido y vuelve
«Guardar conteo»; reescribir «mientras se cuenta un renglón el botón no está».
Revertir y ver fallar. Docs: módulo (la barra y el cierre) y bloque 66.

**Auditoría del plan de la fase 4:** los dos ejes marcaron como bloqueantes
«Guardar conteo» sin nada guardable (la barra quedaba sin salida) y el
guardado parcial que borraba lo fallido; el eje B, además, el renglón con lote
esperando el ⋮. Verificado contra el código e incorporado arriba.

**Fase 5** — en el buscador, abrir un producto cierra el anterior. Pedido de
Franco (2026-09-22): con un producto desplegado se podía desplegar otro y el
primero quedaba abierto.

- Hoy cada `ProductoCardComponent` guarda su propio `abierta = signal(false)`
  (`producto-card.component.ts:405`); el buscador no sabe cuál está abierta.
- **El buscador pasa a ser la única fuente**, igual que la lista del conteo
  (`inventario-carga.page.ts:154`): `abiertoId` en el buscador; la card recibe
  `abierta` como **input** (default `false`: el host de
  `descripcion-completa.spec.ts` no lo pasa) y al tocar la cabecera emite
  `alternada`. El buscador hace `abiertoId` = ese id o `null` si ya era, y
  llama a `alExpandir()` **solo al abrir**. Con `expandible = false` la card
  sigue emitiendo `seleccionar`, sin cambios.
- **Una búsqueda nueva y el pesable ponen `abiertoId` en `null`.** Vacían la
  lista y recrean las cards (`buscador-producto.component.ts:374-377`): con la
  marca vieja, una card podía nacer abierta sin que nadie pidiera su detalle
  ni su stock, y quedar en «Cargando presentaciones…» para siempre. «Cargar
  más» agrega filas y conserva las instancias: no la toca.
- **Descartado:** un híbrido con `linkedSignal` (estado local + input). Los
  dos auditores mostraron el caso anterior y otro: cerrar A dejaba la marca en
  A, y A reaparecía abierta en la búsqueda siguiente.
- Como la card la monta **solo** el buscador (`git grep`), vale para Buscar,
  transferencias, devoluciones y el conteo.

Tests: abrir A y después B deja solo B abierta (falla hoy: las dos quedan con
`aria-expanded="true"`); tocar la abierta la cierra; buscar de nuevo con A en
los resultados la muestra cerrada; el detalle se pide al abrir y no al cerrar;
`expandible = false` sigue eligiendo. Revertir y ver fallar. Docs: casos en el
plan de testeo.

**Auditoría del plan de la fase 5:** los dos ejes encontraron que el diseño
híbrido dejaba una card abierta sin detalle tras una búsqueda nueva, y que
«mismo criterio que el conteo» era falso; el eje B recomendó la card
controlada. Verificado e incorporado arriba.

**Fase 6** — una toma cerrada es de solo lectura. Pedido de Franco
(2026-09-22), a partir del hallazgo del paso 8 de las fases 4 y 5.

Hoy, en el conteo de una zona de una toma `CONCLUIDO` o `CANCELADO`, el campo
«Contado», las fechas y el estado siguen editables y «Guardar conteo» manda
el cambio. El central **no lo frena**: `InventarioProductoItemService.save()`
(`:293`) solo mira renglones duplicados. En una `CONCLUIDO` el stock ya se
ajustó al finalizar: cambiar un conteo después deja el registro diciendo otra
cosa que el ajuste aplicado, y el stock no se recalcula. Se llega a esa
pantalla por URL directa (`inventario.routes.ts:46`, sin guard), con «Atrás»
después de finalizar, o **teniéndola abierta mientras otro dispositivo
finaliza la toma**.

- **La vista.** `InventarioItemCardComponent` → `input soloLectura = false`.
  Con `soloLectura`: «Contado» deshabilitado (en el mismo `[disabled]`, así el
  foco de la fase 2 no lo toma); `frc-campo-fecha` y `frc-selector` con su
  `deshabilitado` (verificado: no emiten); sin «usar» del vencimiento conocido
  ni «Buscar lote» / «Crear lote». La página pasa
  `[soloLectura]="!puedeAgregar()"`; `mostrarGuardar` exige `puedeAgregar()`.
- **Los métodos.** `editar()` —por donde pasan todos los `cambiarX`— no
  registra nada con la toma cerrada. `agregarProducto()` gana el guard que le
  faltaba (`agregarLote`/`crearLote` ya lo tienen vía `contextoDeLote()`, y
  `quitarItem()` también).
- ⚠️ **El estado se vuelve a consultar antes de escribir.** `inventario` se
  carga una vez y no se refresca: si otro teléfono finaliza, esta pantalla
  seguía creyendo `ABIERTO` y el guardado pasaba. `guardar()` y
  `agregarProducto()` piden `porId` (sin caché, `gql-base.ts:63`) y solo
  escriben si la toma sigue `ABIERTO`.
- ⚠️ **Si llega cerrada, lo no guardado se descarta y se avisa.** `items()`
  mezcla `edicion` con lo del central: con la toma cerrada, los campos
  deshabilitados mostrarían como registrados valores que nunca se guardaron,
  sin forma de descartarlos. Al recibir una toma no `ABIERTO` —en `cargar()`
  o en la consulta previa al guardado— se vacía `edicion` y, si había algo,
  aviso: «La toma ya no está abierta: lo que no se había guardado se
  descartó.».
- Sigue siendo una barrera **del cliente**: el central acepta el guardado si
  llega de otro lado (desktop, `frc-mobile`, una llamada a mano), y queda una
  ventana mínima entre la consulta y el guardado. Cerrarlo del todo es un
  cambio en el central, fuera de esta rama.
- Queda afuera: una **zona** concluida (`InventarioProducto.concluido`) dentro
  de una toma abierta sigue como hoy.

Tests: con `CONCLUIDO` y `CANCELADO`, campos deshabilitados, sin «usar», sin
«Buscar/Crear lote», sin barra; `editar()` no registra; con ediciones y una
recarga que trae `CONCLUIDO`, se descartan, se avisa y la card muestra el
valor del central; `guardar()` con la toma finalizada en el medio (la consulta
previa trae `CONCLUIDO`) no llama a `guardarItem`; `agregarProducto()` igual;
con `ABIERTO`, todo como antes. Revertir y ver fallar. Docs: módulo y bloque
nuevo.

**Auditoría del plan de la fase 6:** eje A — la pantalla abierta mientras otro
finaliza (el guard miraba un estado viejo) y `agregarProducto()` sin guard;
confirmó que ninguna otra pantalla edita ítems y que los campos compartidos
respetan `deshabilitado`. Eje B — ediciones pendientes que quedaban mostradas
como registro, sin salida; guard en `editar()`. Verificado e incorporado.

**Fase 7** — la card de zona del detalle de la toma. Pedido de Franco
(2026-09-22), tras probar la fase 6.

- **Zona y sector con mayúscula inicial por palabra** («zona gaseosas» →
  «Zona Gaseosas», «deposito» → «Deposito»), con `TitleCasePipe`, el mismo
  que ya usan `lugares.page.ts` y `sector-detalle.page.ts` (verificado: con
  acentos, ñ, números y guiones sale bien —«estante café» → «Estante Café»,
  «DEPOSITO A-2» → «Deposito A-2»—; las siglas se aplanan, «UPS» → «Ups», igual
  que en esas pantallas). Solo presentación: lo que se guarda no cambia.
- **Un solo criterio en todo el recorrido de la toma**, no solo en la card:
  una función `nombreDeLugar()` (en `inventario-alta.ts`, junto a las otras
  reglas de zonas) que transforma **solo la descripción**; los textos de
  relleno («Sin zona», «Sin sector») quedan como están. Se usa en:
  - la card de zona y el diálogo de concluir/reabrir (`zonaDe()`/`sectorDe()`);
  - el aviso de «no se finaliza con una zona sin concluir»
    (`motivoNoFinalizar()`, `inventario-conteo.ts:143`);
  - el título de la pantalla de conteo (`inventario-carga.page.ts:298`), a la
    que se entra con «Contar» desde esa card;
  - las zonas y sectores del diálogo «Agregar zona» (`inventario-alta.ts:71-72`),
    que se abre desde la misma pantalla. Corrige lo que este plan decía: ese
    diálogo solo aplicaba el pipe al nombre de la sucursal.
- **«Contar» y «Concluir»/«Reabrir» juntos, siempre en su propia línea y a la
  derecha.** El pie de `frc-card` es `flex` con `flex-wrap`
  (`card.component.ts:67-72`) y cada botón se proyectaba suelto junto al
  texto del conteo: sin lugar, el segundo bajaba solo. Pasan a un único
  `<div pie class="botones">` —un solo nodo raíz, que proyecta bien—, dentro
  de un `@if (abierto())` para no dejar un contenedor vacío con la toma
  cerrada. `.botones` ocupa la línea entera (`flex-basis: 100%`) y alinea a la
  derecha: en un teléfono de 360 px el grupo no entra junto al conteo de
  todos modos (medido por el auditor: quedan ~170-190 px), así que se decide
  una vez y se ve igual en cualquier ancho.

Tests: zona y sector con mayúscula inicial en la card, sin tocar «Sin zona»;
el aviso de finalizar y el título del conteo con el mismo criterio; los dos
botones comparten el mismo contenedor (`parentElement`), no solo el pie; con
la toma cerrada no hay contenedor. Ajustar los tests que esperan el texto
crudo en `motivoNoFinalizar`. Docs: casos en el plan de testeo.

**Auditoría del plan de la fase 7:** eje A — el diálogo «Agregar zona» no
aplicaba el pipe a zonas (la justificación era falsa), los rellenos «Sin
zona» cambiarían, y el aviso de finalizar y el título del conteo quedaban con
otro criterio. Eje B — la proyección funciona; a 360 px el grupo baja
siempre, y un contenedor vacío quedaba con la toma cerrada. Incorporado.

## Datos nuevos

| Dato | Quién lo escribe | Quién lo lee |
|---|---|---|
| `OpcionesBuscador.soloPresentacionUnitaria` | `InventarioCargaPage.agregarProducto()` | `BuscadorProductoComponent` → `ProductoCardComponent.soloUnitaria` |
| `InventarioCargaPage.recienAgregadoId` (fase 2) | `agregarProducto()`; lo limpian `(enfocado)` y `alternar()` | plantilla → `InventarioItemCardComponent.enfocar` |

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

## Auditoría del diff (paso 8)

Tres fijos; los condicionales no se disparan (el diff no toca release ni nada
replicado).

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| Fijo 1 | El código de balanza emite su presentación sin pasar por la card | Medido en bodega prod: los 56 pesables activos tienen solo x1. Documentado en el módulo, sin filtrar |
| Fijo 1 | La bandera es solo del cliente: el central acepta cualquier presentación | Documentado: es contra el error de toque, no una garantía |
| Fijo 2 | `Presentacion.activo` existe en el esquema desde el primer commit (2022) | Sin acción: ningún canal queda atrás |
| Fijo 2 | `catchError(() => of(null))` en la búsqueda por código tragaría un campo inexistente | Fuera de alcance; no aplica a `activo` |
| Fijo 3 | El aviso quedaba como último hijo y dejaba el borde del último botón; tono mudo | `:last-of-type` y tono `--warn` |
| Fijo 3 | El test «por código» no ejercita el escaneo, solo el producto ya cargado | Renombrado a lo que prueba |

## Revisión de datos en producción (bodega, 2026-09-21, solo lectura)

Productos **activos**: 9.041. Con x1 activa: 9.019. Seis tienen más de una x1
activa (se ofrecen todas esas). Ninguna presentación con `activo` nulo.

| Caso | Productos | Qué ve el conteo |
|---|---|---|
| Sin x1, solo otras cantidades | 13 | Todas (fallback) |
| x1 existe pero inactiva | 2 — 921 CARBON BRITEZ KUE GRANDE, 4532 REXONA CLINICAL MEN… | Todas (fallback): en los dos es la única presentación |
| Sin ninguna presentación | 7 | «no tiene presentaciones cargadas», como hoy |

## Auditoría del diff de las fases 2 y 3 (paso 8)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| Fijo 1 | Todas las puertas donde se **elige** respetan «sin activa no se opera»: lista, pesable, escaneo, reintentar | Sin acción |
| Fijo 1 | `aplicarLote()` copia la presentación de la fila aunque esté inactiva; la query de ítems no pide `activo` | Afuera a propósito (plan y doc del módulo); decisión pendiente de Franco |
| Fijo 2 | Sin esquema ni GraphQL nuevo; `saveInventarioProductoItem` devuelve `id`; `presentaciones` del central nunca es nula | Sin acción |
| Fijo 2 y 3 | Producto sin `id`: «Cargando…» para siempre | Cuenta como fallido |
| Fijo 2 | Un `[]` confirmado se volvía a pedir en cada apertura | El detalle se pide solo si las presentaciones son desconocidas |
| Fijo 2 | Un fallo del detalle muestra el toast global además de Reintentar | Preexistente (`porId` notifica); se deja |
| Fijo 3 | `cantidad` nula entraba por el respaldo de las activas | Excluida también del respaldo |
| Fijo 3 | Si `cargar()` fallaba tras agregar, la marca de foco quedaba huérfana | Se limpia en el error |
| Fijo 3 | Un bullet de la doc quedó pegado a otro párrafo | Corregido |

## Auditoría del diff de las fases 4 y 5 (paso 8)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| Fijo 1 | La barra nueva no abre agregar a una toma cerrada; los filtros de presentación siguen valiendo con la card controlada | Sin acción |
| Fijo 1 | **Preexistente**: en una toma cerrada o cancelada el campo de conteo es editable y «Guardar conteo» manda el cambio; no verificado si el central lo rechaza | Fuera de alcance; decisión pendiente de Franco |
| Fijo 2 | Sin esquema; `guardables()` usa el mismo criterio que `guardar()`; reintentar es idempotente en valor | Sin acción |
| Fijo 2 | **Preexistente**: si falla `actualizarFechas`, `guardarItem` igual guarda su copia del vencimiento y diverge del maestro del lote | Fuera de alcance; anotado |
| Fijo 3 | `id: null` hacía `null === null` y la card nacía abierta | `[abierta]` exige id |
| Fijo 3 | Aplicando un lote a un renglón que lo esperaba, la barra desaparecía sin indicador | Se muestra «Agregando…» |
| Fijo 3 | Nombre de test viejo, redacción de 66.13, «Cargar más» sin documentar | Corregidos |

## Auditoría del diff de la fase 6 (paso 8)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| Fijo 1 | Elegir/crear lote y quitar un renglón miraban el estado antes de su diálogo y escribían después sin volver a consultar; crear lote dejaba además un maestro huérfano | Las tres escrituras pasan por `conTomaAbierta()` (crear lote, antes de crear el maestro) |
| Fijo 2 | Sin esquema; `porId` es sin caché | Sin acción |
| Fijo 2 y 3 | El error de la consulta salía dos veces | Se deja el de `DatosService` |
| Fijo 2 | Una respuesta `null` descartaba lo editado con un aviso falso | Sin respuesta no se escribe ni se descarta |
| Fijo 3 | El alta rechazada por toma cerrada, sin ediciones, no decía nada | Aviso «La toma ya no está abierta.» |
| Fijo 3 | El test de solo lectura miraba «Buscar lote» en un producto sin lote: pasaba igual sin el cambio | Producto con lote, contraprueba con la toma abierta y fechas/estado verificados |
