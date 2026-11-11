# Plan #135: los precios generales del central se editan desde la PWA

Issue: GabFrank/frc-mobile-pwa#135. Rama: `fix/precios-sucursal-central` (desde `develop` 11e1fc9).
Pieza: **mobile-pwa** solamente. El central no cambia (lo lleva Gabriel y no hace falta).

## Problema

`PreciosPage` solo deja editar los precios cuya `sucursal.id` es la de la sesión (`esPrecioEditable`). Pero el central
**guarda todo precio en su propia sucursal**: `PrecioPorSucursalGraphQL.savePrecioPorSucursal` pisa el `sucursalId` del
input con su property `sucursalId` (0 = SERVIDOR, sin depósito). En alpha los 13.890 precios están en la sucursal 0.

Resultado: ningún precio se puede editar, desactivar ni marcar principal desde la PWA, ni siquiera el que se acaba de
agregar en esa misma pantalla, porque nace en la 0 y aparece en «Precios de otras sucursales». Bloquea 101.2 y 101.6
del plan de testeo.

La idea de «precio de esta sucursal» no se da en los datos: los precios que crea el central son **generales**, de
todas las sucursales. El escritorio los edita igual, contra el mismo central (`adicionar-precio-dialog`).

## Enfoque

**Editable = los precios de la sucursal del central, y solo esos.** La sucursal del central se le pregunta al central
con `sucursalActual` (`SucursalService.actual()`, ya portado), que lee **la misma property** que usa
`savePrecioPorSucursal` para pisar la sucursal (`PrecioPorSucursalGraphQL.java:98`, `SucursalGraphQL.java:53`). No se
escribe un `0` fijo. Son los precios generales: el PDV de cada sucursal los lee por presentación, sin filtrar sucursal
(filial `PresentacionResolver.java:56`), así que llegan a toda la red.

- **Un precio de una sucursal concreta deja de ser editable, aunque sea la de la sesión** (auditoría A1). Hoy la PWA lo
  deja editar, pero al guardarlo el central le pisa la sucursal con la suya: el precio **se muda a todas las
  sucursales** sin que nadie lo note. Queda de solo lectura con la etiqueta de su sucursal y una ayuda que explica por
  qué. En alpha no hay ninguno (13.890 en la 0); en producción, sin verificar.
- **«No sé» no es «sí»** (PATRONES §6): mientras `sucursalActual` no respondió, o si falló, no hay nada editable y
  «Agregar» está bloqueado (B5: si no, el combo ofrece tipos que ya existen como generales y deja crear duplicados).
  Si falló, aviso inline con «Reintentar», sin toast (`notificarError: false`, B2). Mientras carga se muestra el
  esqueleto de la lista, no los precios en «otras sucursales» que después saltan (B3).
- **Editar manda el `sucursalId` del propio precio** (= el del central), convertido a número y validado; si no es un
  id válido, no se guarda (nunca se cae a la sucursal de la sesión, B4). Hoy da igual porque el central la pisa, pero
  si empieza a respetar el input, editar con la sucursal de la sesión movería el precio. **Un precio nuevo** sigue con
  la sucursal de la sesión, como el escritorio (`adicionar-precio-dialog.component.ts:547`); el central lo deja en la
  suya.
- **Marcar principal** degrada entre los editables, que ahora son todos de la misma sucursal: no puede mezclar un
  principal general con uno de una sucursal (B1).
- **El combo de «Agregar precio»** oculta los tipos que ya tienen precio general: agregar otro sería un duplicado de
  hecho, porque el central lo guarda en la misma sucursal (B5).
- **Permisos:** sin cambio. `EDITAR PRECIOS` ya edita en el escritorio los mismos precios generales; la PWA deja de
  esconderlo (A6).
- Textos: la sección pasa a «Precios de todas las sucursales» (los editables); «Precios de una sucursal» para los de
  sucursales concretas, de solo lectura.

**Descartado:**
- Escribir `0` fijo: otra instancia del central puede tener otra property.
- Decidir por `deposito = false`: `COMPRAS` también es virtual y no es la del central.
- Cambiar el central para que respete el input: lo lleva Gabriel, cambia el modelo de precios de toda la red.

## Fase única

- `sucursal.service.ts`: `actual()` con `notificarError: false` (no tiene otros llamadores).
- `precios.page.ts`:
  - `esPrecioEditable(precio, sucursalCentralId)`: `true` solo si coincide con la del central conocida.
  - Señales `sucursalCentralId`, `cargandoSucursalCentral` (arranca en `true`), `errorSucursalCentral`; carga en el
    constructor con `takeUntilDestroyed` y «Reintentar».
  - `preciosPropios` → `preciosEditables`, `preciosAjenos`, `tiposPrecioDisponibles` y el bloqueo de «Agregar» según
    lo anterior.
  - Los llamadores de edición (`guardarEdicion`, activar/desactivar, degradar cada precio viejo y marcar principal)
    pasan el `sucursal.id` del precio, validado; `agregarPrecio` sigue con la de la sesión.
  - Textos y ayuda del precio de sucursal concreta.
- **Tests** (`producto-precios.spec.ts`, con `SucursalService` en el `montar`; fallan con el código viejo):
  - `esPrecioEditable`: precio de la 0 con central 0 → sí; con central desconocido → no; precio de la sucursal de la
    sesión → no; sin sucursal → no;
  - página: con `sucursalActual` = 0, los precios de la 0 son editables y «Agregar» está habilitado; mientras carga,
    nada editable y sin precios en «Precios de una sucursal»; si falla, aviso, nada editable, «Agregar» bloqueado, y
    «Reintentar» lo habilita;
  - editar, activar/desactivar y marcar principal (incluida la degradación) mandan `sucursalId` 0, el del precio;
    agregar manda el de la sesión;
  - el combo no ofrece un tipo que ya tiene precio general.
- `docs/PLAN_TESTEO_MANUAL.md`: bloque nuevo para #135 con «Esperado» por caso, la tabla de totales y el total general
  actualizados; nota en 101.2 y 101.6 de que ya se pueden correr.
- `docs/modulos/producto.md`: la regla de qué precio es editable y por qué.

## Contrato y canales (eje A)

Sin cambios de GraphQL: `sucursalActual` existe en el central desde siempre (`SucursalGraphQL.java:57`). Sale a alpha
por `develop`; beta (farmacia) y prod (bodega) tienen la misma query. El permiso sigue siendo el mismo: la sección de
precios pide `EDITAR PRECIOS` con su guard de ruta.

## Pruebas de runtime

PWA local (`npm start`, 4300) contra alpha, usuario MR:
1. Producto › Editar › Presentación › Precios: los precios de la sucursal 0 aparecen en «Precios de todas las
   sucursales», editables.
2. 101.2: editar un precio en Gs y guardar; el request no lleva `monedaId` y el precio queda en la sucursal 0.
3. 101.6: precio en USD (4,39 → 4,50), guardar, desactivar y activar; la moneda se conserva.
4. Agregar un precio nuevo: aparece editable enseguida.
5. Marcar principal: el anterior se degrada.
6. `sucursalActual` que falla (bloqueo de la request en el navegador): los precios de la 0 quedan de solo lectura y
   aparece el aviso con «Reintentar».

Al terminar: precios de prueba de alpha restaurados.

## Auditoría (paso 5, 11/11/2026)

| # | Hallazgo | Qué se hizo |
|---|---|---|
| A1 | Editar un precio de una sucursal concreta lo muda a la del central (el central pisa la sucursal) | **Cambio de regla: editable solo la sucursal del central**; los de sucursal concreta, de solo lectura con explicación |
| A2 | `sucursalActual` y `savePrecioPorSucursal` leen la misma property | Confirmado |
| A3 | Caché tras cambiar de servidor | `no-cache` por defecto; la señal vive en la página |
| A4 | El escritorio manda la sucursal de la sesión al editar y al agregar | Agregar igual; editar manda la del precio (más seguro, hoy equivalente) |
| A5 | El PDV lee precios por presentación, sin sucursal | Los generales llegan a toda la red |
| A6 | Permisos | Sin ampliación: el escritorio ya edita los generales con el mismo rol |
| B1 | Marcar principal podía mezclar general y sesión | Desaparece: todo lo editable es de la misma sucursal |
| B2 | `actual()` mostraba toast al fallar | `notificarError: false` + aviso inline |
| B3 | Parpadeo entre secciones mientras carga | Carga arranca en `true`, esqueleto hasta saber |
| B4 | `sucursal.id` es string / puede faltar | Conversión validada; sin id válido no se guarda, nunca la sesión |
| B5 | Combo y duplicados | Oculta tipos con precio general; «Agregar» bloqueado sin sucursal del central |
| B6 | Tests faltantes | Agregados al plan (llamadores, fallo y reintento, carga, combo) |
| B7 | Regla 4.1 | Bloque, tabla, total y pasos en la respuesta |

## Sin verificar

- Si en producción quedan precios en sucursales concretas: pasan a solo lectura en la PWA (antes, editarlos los mudaba
  a todas las sucursales).
- El filtro de la publicación de réplica de `precio_por_sucursal` (se asume que baja a todas las filiales, como hoy).
