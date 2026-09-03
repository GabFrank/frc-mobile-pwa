# Alta de solicitud de caja chica

**Fecha:** 2026-09-03
**Issue:** [#10 — Lo que falta de paridad con `frc-mobile`](https://github.com/GabFrank/frc-mobile-pwa/issues/10)
**Estado:** diseño aprobado, pendiente de plan de implementación

## Qué resuelve

Hoy la PWA **consulta** solicitudes de caja chica, permite el **retiro con QR** y
permite **rendir** el gasto con fotos. Lo único que sigue siendo del escritorio
es el primer paso: **crear la solicitud**. Un funcionario que necesita plata
para un gasto tiene que pedirle a alguien con una computadora que la cargue.

Cerrar esto deja el circuito entero en el teléfono:

```
Solicitud → Retiro con QR → Rendición → Devolución de vuelto
   ↑ esto
```

Es el formulario más grande que quedaba de la paridad: tipo de gasto, activo
imputado con su buscador paginado, beneficiario y detalle financiero
multi-moneda.

## Qué NO entra

- **Autorización, rechazo y delegación.** El `PreGasto` nace `PENDIENTE` y lo
  autoriza otro, en otra pantalla que no existe en la PWA ni en `frc-mobile`.
- **Edición de una solicitud ya creada.** `savePreGasto` acepta un `id`, pero
  `frc-mobile` nunca lo manda desde el alta y no hay pantalla de edición que
  portar.
- **La devolución de vuelto**, que sigue esperando en el issue #10.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Alcance | Formulario completo, **con** resumen del activo y autocompletado | Es lo que hace que un gasto recurrente —alquiler, cuota de un vehículo— se cargue casi solo. Sin eso el operador retipea la cuota todos los meses. |
| Después de guardar | Al **detalle** de la solicitud recién creada | Ahí está el QR de retiro, que es lo que el funcionario necesita inmediatamente. `frc-mobile` va a la lista; nos apartamos a propósito. |
| Entrega | **Un solo PR** | Una sola pasada de prueba manual, un solo gate. Nada queda a medias en `develop`. |
| Autocompletado sobre un monto ya cargado | **Solo si el detalle está vacío** | `frc-mobile` pisa el primer detalle sin avisar cada vez que se elige un activo: lo tipeado desaparece en silencio. |
| Patrón de formulario | Signals, como `solicitud-pago-nueva.page.ts` | Es el patrón de las cuatro pantallas de alta del repo. Portar el `FormGroup`/`FormArray` de `frc-mobile` introduciría un segundo patrón de formularios y nadie sabría cuál seguir. |

## El backend no se toca

**No hace falta ningún método con sufijo `Mobile`** (regla 5 de `CLAUDE.md`).
Las diez operaciones necesarias ya existen en el esquema del central,
verificadas contra `src/main/resources/graphql/`:

| Operación | Archivo del esquema |
|---|---|
| `savePreGasto(entity: PreGastoInput!): PreGasto!` | `financiero/pre_gasto.graphqls:152` |
| `tipoGastos(page, size): [TipoGasto]!` | `financiero/tipo_gasto.graphqls:81` |
| `enteByReferenciaId(tipoEnte!, referenciaId!): Ente` | `activos/ente.graphqls:95` |
| `saveEnte(ente: EnteInput!): Ente!` | `activos/ente.graphqls:105` |
| `getEnteFinancialSummary(enteId!, tipoGastoId): EnteFinancialSummary` | `financiero/pre_gasto.graphqls:148` |
| `vehiculoSearchPage` | `activos/vehiculo.graphqls:95` |
| `muebleSearchPage` | `activos/mueble.graphqls:66` |
| `inmuebleSearchPage` | `activos/inmueble.graphqls:77` |
| `equipoSearchPage` | `equipos/equipo.graphqls:97` |
| `personaSearchPage` | `personas/persona.graphqls:57` |

> ⚠️ **El campo se llama `getEnteFinancialSummary`.** `EnteFinancialSummary`, sin
> el `get`, es el **tipo** de retorno. En `frc-mobile` el archivo
> `enteFinancialSummary.ts` es la clase `Query` y `getEnteFinancialSummary.ts` es
> el documento que esa clase importa: **no son dos versiones del mismo
> concepto**, aunque `docs/modulos/operaciones-solicitud-gastos.md` lo diga así.

Como no se agrega ni se modifica nada, el escritorio no se entera y no hay
promoción del central que esperar.

> ⚠️ **`savePreGasto` recibe su argumento como `entity:` y `saveEnte` como
> `ente:`.** Nombres distintos para la misma idea, en el mismo flujo. Equivocarse
> da un error de GraphQL que no señala la causa.

## Arquitectura

### Capa de datos — `src/app/graphql/`

Nuevos, todos con el alias `data:` en el campo raíz (regla 1: sin el alias el
resultado llega `undefined` **sin error ni log**):

```
graphql/operaciones/gastos/
  tipoGastos.ts
  savePreGasto.ts
  enteByReferenciaId.ts
  saveEnte.ts
  enteFinancialSummary.ts     ← clase Query del campo getEnteFinancialSummary
  vehiculoSearchPage.ts
  muebleSearchPage.ts
  inmuebleSearchPage.ts
  equipoSearchPage.ts
graphql/personas/persona/
  personaSearchPage.ts
```

**Lo que se reusa y no se porta:**

- **`proveedorSearchByPersonaPage` ya está**, como
  `graphql/personas/proveedor/proveedoresPorTexto.ts`. Es literalmente la misma
  query del central, con el mismo alias. De los seis buscadores de `frc-mobile`
  solo faltan cinco.
- **Monedas y formas de pago ya están portadas**
  (`graphql/operaciones/moneda/monedas.ts`,
  `graphql/operaciones/solicitud-pago/formasPago.ts`).

### Modelo — `src/app/domains/gastos/`

**Ya existe, no se toca:** `tipo-gasto.reglas.ts`, con los 13 valores de
`ModuloPadreGasto`, los siete servicios continuos, `tipoEnteDesdeModuloPadre`,
`requiereEnteActivo`, `esModuloPadreConCuotasActivo`, `mostrarCuotasActivo` y
`etiquetaModuloPadre` — portado verbatim con un test por rama.

**Nuevo:**

- `ente.model.ts` — `Ente`, `TipoEnte`, y `Vehiculo` / `Mueble` / `Inmueble` /
  `Equipo` con la forma que devuelve cada `*SearchPage`, más el tipo unión
  `ActivoBusqueda`.
- `pre-gasto.model.ts` suma `PreGastoInput` y `PreGastoDetalleFinanzasInput`.

### Reglas puras — funciones con tests, sin Angular

`pages/operaciones/gastos/gastos-solicitud.reglas.ts`, portado de
`validarFormulario`. Devuelve el mensaje de error o `null`, en este orden:

1. `sucursalId` presente → *«Seleccione una sucursal de retiro»*
2. `responsableId` presente → *«No se encontró la persona del usuario en sesión»*
3. `tipoGastoId` presente → *«Seleccione un tipo de gasto»*
4. Tipo que requiere activo sin `enteId` → *«Seleccione {etiqueta}»*
5. Beneficiario `PERSONA` → exige `beneficiarioPersonaId`
6. Beneficiario `PROVEEDOR` → exige `beneficiarioProveedorId`
7. Por cada detalle: monto > 0, `monedaId` y `formaPago` completos
8. **Una moneda por detalle, sin repetir**

> La regla 8 se porta entera, a diferencia de lo que pasó en la rendición. Ahí el
> `GastoRendicionInput.montoTotal` es un único `Float` sin moneda, y ofrecer
> varias filas mentía sobre lo que el backend guarda. Acá
> `PreGastoInput.finanzas` **es** una lista de `{monto, monedaId, formaPago}`: el
> modelo lo soporta de verdad.

`domains/gastos/ente-financiero.reglas.ts` — `construirVistaResumenFinanciero` y
`construirNotificacionVencimiento` (vencida / ≤10 días / más adelante), también
puras y testeadas.

### Formato de dinero

**`monto-moneda.util.ts` de `frc-mobile` no se porta.** El `ImportePipe` de la
PWA (`shared/importe/importe.pipe.ts`) ya hace lo mismo: decide guaraní sin
decimales contra dos decimales por el nombre de la moneda, que es exactamente
`esMonedaGuaraniPorTexto`. Duplicarlo sería reintroducir la lógica que ese
archivo dice haber centralizado.

Para la entrada de montos se usa `shared/campos/campo-importe.component.ts`, y
para el vencimiento `campo-fecha` con `fecha-py.adapter`.

> ⚠️ **La precisión del resumen se resuelve por `monedaId`, no por el símbolo.**
> `getEnteFinancialSummary` devuelve `monedaSimbolo` y `monedaId`, pero no la
> denominación, y el `ImportePipe` decide por el nombre. Hay que buscar la moneda
> en el catálogo ya cargado. El original hace
> `Math.round(monto).toLocaleString('es-PY')` para todo, así que **un resumen en
> dólares pierde los centavos**; acá no.

## La pantalla

**Ruta:** `/operaciones/gastos/nueva`.

> ⚠️ **Va declarada ANTES de `:id/:sucursalId`** en `gastos.routes.ts`. Es el
> error más repetido del repo: como segmento posterior, `nueva` entraría por
> `:id` y la pantalla intentaría abrir la solicitud `NaN`. El archivo ya arrastra
> el mismo comentario por `rendir`.

**Entrada:** botón de acción en `gastos-lista.page.ts`, como en
`solicitudes-pago-lista.page.ts`.

**Sin guard de rol.** Verificado en `frc-mobile`: el alta no está detrás de
ninguno. Cualquier funcionario con persona asociada puede pedir; quien autoriza
es otro, después.

**Archivo:** `gastos-solicitud-nueva.page.ts`, standalone y zoneless.

No hay acordeón en el sistema de diseño de la PWA, así que van secciones
apiladas con `frc-seccion` en vez de los `ion-accordion` de `frc-mobile`:

| Sección | Contenido |
|---|---|
| Responsable | La persona de la sesión, solo lectura. No se elige. |
| Beneficiario | Selector `PROVEEDOR` (por defecto) / `PERSONA`, y debajo el buscador que corresponda |
| Tipo de gasto | `frc-buscador` en modo `local` sobre el catálogo cargado |
| Activo imputado | Solo si `requiereEnteActivo(moduloPadre)`. Etiqueta, ícono y buscador salen del módulo padre |
| Resumen del activo | La tarjeta del resumen financiero |
| Montos y pago | Lista de detalles `{monto, moneda, formaPago}` con total por moneda |
| Retiro | Sucursal, vencimiento, urgencia y descripción |

**Estado en signals:** `beneficiarioTipo`, `tipoGasto`, `enteId`,
`activoReferenciaId`, `detalles: signal<DetalleFinanciero[]>`, `sucursalId`,
`fechaVencimiento`, `nivelUrgencia`, `descripcion`, `guardando`.

**Derivado en `computed`:** `moduloPadre`, `requiereActivo`, `etiquetaActivo`,
`totalesPorMoneda`, `errorValidacion`.

No se portan los diez flags de error precalculados de `frc-mobile`
(`errorTipoGasto`, `errorSucursal`, …). Existían para no poner métodos en un
template de Ionic; con `computed` el recálculo ya está resuelto.

**Los buscadores** usan `frc-buscador` en modo `paginado`
(`shared/buscador/buscador.component.ts`), que ya existe y se usa en 19
pantallas. Lo que falta no es el componente: son los `cargarPagina` por tipo de
entidad, con la firma `(texto, pagina) => Promise<{items, hayMas}>`.

> ⚠️ En modo paginado, `cargarPagina` debe devolver `hayMas: false` cuando se
> acaba; si no, el scroll pide páginas vacías indefinidamente.

**Sucursal de retiro:** por defecto la de `inicioSesion.sucursal`, y elegible.
**Sin filtrar por `soloOperables()`** — ese filtro existe para lo que mueve
stock, y una caja chica se retira igual en una sucursal sin depósito.

**Urgencia:** `NORMAL` (por defecto) · `BAJA` · `ALTA` · `URGENTE`, verbatim.

## El activo: resolución del ente, resumen y autocompletado

Al elegir un activo:

1. `enteByReferenciaId(tipoEnte, referenciaId)`.
2. Si no existe, **`saveEnte` lo crea** con `{tipoEnte, referenciaId, activo: true, usuarioId}`.
3. Con el `enteId`, `getEnteFinancialSummary(enteId, tipoGastoId)`.
4. El resumen alimenta la tarjeta y el autocompletado.

> ⚠️ **El paso 2 es una escritura disparada por elegir, no por guardar.** Si el
> operador abandona el formulario, el `Ente` queda creado igual. Es como funciona
> `frc-mobile` y es defendible —el `Ente` es la ficha del activo en el catálogo
> financiero, no la solicitud—, pero queda escrito para que nadie lo reporte como
> un registro fantasma.

**Autocompletado**, portado de `aplicarAutocompletadoSolicitud`:

- `fechaVencimientoSugerida` → vencimiento, **solo si el campo está vacío**.
- `montoSugerido` + `monedaId` → **el primer detalle**, si
  `autocompletarMonto !== false` y **el detalle está vacío**. Sin `monedaId`, cae
  al guaraní del catálogo.
- `proveedorId` → fuerza el beneficiario a `PROVEEDOR` con ese proveedor.

**Dos apartamientos del original, deliberados:**

1. **No pisa un monto ya cargado.** `frc-mobile` reemplaza el primer detalle cada
   vez que se elige un activo, aunque el operador ya haya escrito un importe: lo
   tipeado desaparece sin aviso.
2. **`descripcion` sale de la firma.** La función original la recibe en el
   contexto y la devuelve idéntica: `descripcionSugerida` nunca llega al
   formulario, solo a la tarjeta. Portar el parámetro sería copiar algo que no
   hace nada.

## Lo que se descarta del repo viejo

- **`extraerCajaId()` es código muerto.** Lee `localStorage.getItem('cajaId')` y
  en todo `frc-mobile` **nadie escribe esa clave** (verificado con grep sobre
  `src/`). `cajaId` viaja siempre `undefined`. No se porta.
- **`monto-moneda.util.ts`** — lo cubre el `ImportePipe`.
- **Los flags de error precalculados** — los cubre `computed`.

## Estados de carga, vacío y error

Regla 4: sin los tres, el módulo no está terminado. En un formulario no son
obvios, así que:

- **Cargando** — al entrar se piden tipos de gasto, monedas, formas de pago y
  sucursales. Mientras tanto, `frc-skeleton` en lugar de los selectores.
- **Error de carga inicial** — `frc-estado-error` con reintentar. `frc-mobile`
  silencia ese fallo con un `catch {}` pelado y deja los selectores vacíos: un
  selector de tipo de gasto vacío no se distingue de «no hay tipos de gasto».
- **Vacío** — no aplica a la pantalla; cada `frc-buscador` ya trae el suyo.
- **Error al guardar** — por `NotificacionService`, **con el mensaje real del
  central**. `savePreGasto` puede rechazar por reglas que el cliente no conoce, y
  tragarse ese texto deja al operador sin saber qué corregir.

> ⚠️ **El resumen del activo tiene su propio estado de error, y es donde más
> fácil se miente.** Si `getEnteFinancialSummary` falla, la tarjeta dice **«No se
> pudo consultar el activo»**. Nunca montos en cero: un cero acá afirma que no se
> debe nada, y nadie lo dijo.

## Tests

`vitest`, además del AOT.

| Archivo | Qué cubre |
|---|---|
| `gastos-solicitud.reglas.spec.ts` | Un caso por rama de validación. Foco en monedas repetidas y en beneficiario × tipo que requiere activo. |
| `ente-financiero.reglas.spec.ts` | La vista del resumen, la notificación de vencimiento en sus tres tramos, y la precisión por moneda que corrige al original. |
| `gastos-solicitud-nueva.page.spec.ts` | Que el activo aparezca y desaparezca según el módulo padre; que el autocompletado **no pise** un monto ya cargado; que el input armado **no lleve `cajaId`**. |

**Gate:** `npm run build` (AOT — `tsc --noEmit` no typechequea el template) y
`npm test`.

## Plan de testeo manual

Regla 4.1: bloque nuevo **52 · Alta de solicitud de caja chica** en
`docs/PLAN_TESTEO_MANUAL.md`, con «Esperado» por caso y la tabla de totales
actualizada desde los 472 actuales.

Los casos que dependen de un activo con plan de cuotas cargado en la base van
marcados como no ejecutados hasta que se corran contra datos reales. Compilar no
es probar, y verificar por SQL o por una query GraphQL directa es evidencia
parcial: hay que decirlo como tal.

## Cierre

1. Levantar `npm start` en el 4300.
2. Indicar pantalla, pasos y un caso con datos que existan de verdad —el activo y
   el tipo de gasto se eligen consultando la base, no se inventan.
3. Esperar la aprobación explícita.
4. Preguntar si se pushea.
5. Recién ahí `git push` y PR.

**Que una prueba haya funcionado no es autorización para pushear.**
