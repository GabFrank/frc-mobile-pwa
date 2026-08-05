# operaciones / solicitud-gastos

**Ubicación:** `src/app/pages/operaciones/solicitud-gastos/`
**Tamaño:** 45 archivos TS, ~3.515 LOC — 2.º submódulo más grande de `operaciones`.
**Rutas:** `/operaciones/solicitud-gastos` y también `/solicitud-gastos` (raíz — ver gotcha de ruta duplicada en [`../arquitectura/routing-navegacion.md`](../arquitectura/routing-navegacion.md)).

## Qué resuelve

El circuito completo de **caja chica**: un funcionario solicita dinero para un gasto, retira el efectivo de una caja validando con QR, y después **rinde** el gasto con fotos de factura y producto.

```
Solicitud (PreGasto) → Retiro con QR → Rendición (GastoRendicion) → Devolución de vuelto
```

**Es el módulo mejor estructurado del repo.** Separa `models/`, `interfaces/`, `pages/`, `services/`, `utils/`, con lógica compartida extraída a utilidades y comentarios que explican el porqué. Usalo como referencia de estilo para módulos nuevos.

## Rutas

| Ruta | Componente | Rol |
|---|---|---|
| `''` | `SolicitudComponent` | Hub del módulo |
| `list-solicitud-gastos` | `ListSolicitudGastosComponent` | Mis solicitudes |
| `nuevo-solicitud-gastos` | `NuevoSolicitudGastosComponent` | Alta de solicitud |
| `detalle/:id/:sucursalId` | `DetalleSolicitudGastosComponent` | Detalle, retiro y rendición |

`AgregarRendicionGastoComponent` se usa dentro del detalle.

> ⚠️ **Gotcha — el detalle necesita `sucursalId` en la ruta, no solo `id`.** Un `PreGasto` se resuelve por id **y** sucursal (`obtenerPreGastoPorId(id, sucId)`). Navegar sin `sucursalId` no encuentra la solicitud.

## Modelo de datos

### `PreGasto` — la entidad central

| Campo | Significado |
|---|---|
| `montoSolicitado` | Lo que pidió el funcionario |
| `montoRetirado` | Lo que efectivamente retiró de la caja |
| `montoGastado` | Lo que rindió con comprobantes |
| `saldoDevolver` | Vuelto pendiente de devolución |
| `qrToken` | Token del QR que valida el retiro |
| `retiroConfirmadoEn` | Timestamp del retiro |
| `estado` / `estadoRendicion` | **Dos estados independientes** |
| `estadoEtiqueta` / `estadoColor` / `estadoIcono` | Presentación, **calculada en el backend** |
| `finanzas` | Detalle multi-moneda: `{ monto, moneda }[]` |
| `gasto` | `PreGastoGasto` con retiros y vueltos por moneda |
| `rendiciones` | `GastoRendicion[]` |
| `funcionario` | `PersonaResumen` (`id`, `nombre`) |

> ⚠️ **Gotcha — `estadoEtiqueta`, `estadoColor` y `estadoIcono` vienen del backend.** No los calcules en el cliente ni los hardcodees: si el backend agrega un estado, la UI lo refleja sola siempre que se usen estos campos.

> ⚠️ **Gotcha — `estado` y `estadoRendicion` son dos máquinas separadas.** Una solicitud puede estar aprobada y retirada (`estado`) pero con la rendición todavía pendiente (`estadoRendicion`). Chequear solo `estado` da una lectura incompleta.

### `PreGastoGasto` — montos por moneda

`retiroGs` / `retiroRs` / `retiroDs` y `vueltoGs` / `vueltoRs` / `vueltoDs` — guaraníes, reales y dólares. Campos separados por moneda, no una lista.

### `GastoRendicion`

Además del `montoTotal` y las fotos (`fotosFacturaUrls[]`, `fotosProductoUrls[]`), tiene campos específicos por tipo de gasto:

| Campo | Para qué tipo |
|---|---|
| `kmActual`, `litros`, `precioPorLitro` | Combustible |
| `establecimientoAlimentacion` | Alimentación |
| `ubicacionProvisoria` | Gasto en ruta |

> ⚠️ **Gotcha — hay campos de foto en singular y en plural.** `fotoFacturaUrl` / `fotoProductoUrl` (viejo, una sola) conviven con `fotosFacturaUrls[]` / `fotosProductoUrls[]` (nuevo, múltiples). Para código nuevo usá los plurales; los singulares siguen ahí por compatibilidad.

### `Ente` y `TipoGasto`

`Ente` es el **activo** al que se imputa el gasto (un vehículo, un inmueble, un equipo). `TipoGasto` define el tipo y trae el `moduloPadre`, que determina qué activo hace falta.

## Reglas de negocio — `tipo-gasto-modulo-reglas.util.ts`

**El corazón del módulo.** Decide qué campos pide el formulario según el tipo de gasto.

### `ModuloPadreGasto` — 13 valores

```
MUEBLE · INMUEBLE · PERSONAS · VEHICULO · EQUIPOS
ANDE · JUNTA_SANEAMIENTO · IMPUESTO · INTERNET · SEGURIDAD · BASURA · SEGURO
OTRO
```

### `TipoNaturalezaGasto`

`VARIABLE` · `CONTINUO` · `RECURRENTE`

### Las reglas

**1. Servicios continuos** — `esModuloServicioContinuo(modulo)`

```
ANDE · JUNTA_SANEAMIENTO · IMPUESTO · INTERNET · SEGURIDAD · BASURA · SEGURO
```

Son servicios facturados periódicamente. **Todos se imputan a un `INMUEBLE`**, aunque el módulo padre diga otra cosa.

**2. Resolución del tipo de ente** — `tipoEnteDesdeModuloPadre(modulo)`

| Módulo padre | Tipo de ente |
|---|---|
| `VEHICULO`, `MUEBLE`, `INMUEBLE` | el mismo |
| `EQUIPOS` | `EQUIPO` (singular) |
| cualquier servicio continuo | `INMUEBLE` |
| resto (`PERSONAS`, `OTRO`) | `null` — no requiere activo |

> ⚠️ **Gotcha — `EQUIPOS` (plural) mapea a `EQUIPO` (singular).** El módulo padre y el tipo de ente no usan el mismo string. Comparar directo falla.

**3. Activo obligatorio** — `requiereEnteActivo(modulo)`: `true` si `tipoEnteDesdeModuloPadre` no es `null`. Lo aplica `validarFormulario`.

**4. Cuotas de activo** — `esModuloPadreConCuotasActivo(modulo)`

```
INMUEBLE · MUEBLE · VEHICULO · EQUIPOS
```

`mostrarTarjetaCuotasActivoEnSolicitud(modulo, naturaleza, esPagoCuotaActivo)` decide si mostrar la tarjeta de cuotas:
1. Si el módulo no admite cuotas → `false`
2. Si `esPagoCuotaActivo` es booleano explícito → ese valor manda
3. Si no → `true` cuando la naturaleza es `CONTINUO` o `RECURRENTE`

**5. Etiquetas de UI** — `etiquetaModuloPadre(modulo)` traduce a texto para el usuario. Varios servicios continuos muestran contexto: `ANDE` → *"Inmueble (ANDE)"*, `JUNTA_SANEAMIENTO` → *"Inmueble (agua)"*.

## Precisión de moneda — `monto-moneda.util.ts`

**El guaraní no tiene decimales.** Toda la aritmética y el formato dependen de eso.

| Constante / función | Valor / comportamiento |
|---|---|
| `PRECISION_GUARANI` | `0` |
| `PRECISION_DECIMAL` | `2` |
| `esMonedaGuaraniPorTexto(texto)` | `true` si contiene `GUARANI`, `GUARANÍ`, `₲` o `GS.` |
| `precisionPorTextoMoneda(texto)` | `0` para guaraní, `2` para el resto |
| `precisionMonedaPorId(opciones, monedaId)` | Busca la moneda en las opciones y devuelve su precisión |

> ⚠️ **Gotcha — la moneda se detecta por texto, no por id.** `esMonedaGuaraniPorTexto` hace matching de substrings sobre el nombre. Si alguien renombra la moneda en el backend a algo que no contenga ninguno de esos cuatro patrones, **los guaraníes pasan a mostrarse con 2 decimales** sin ningún error.

> **Nota de diseño:** el archivo documenta que esta lógica estaba duplicada en tres lugares y se centralizó. No la vuelvas a duplicar.

## Validaciones — `validarFormulario(datos)`

Devuelve el mensaje de error, o `null` si está todo bien. En orden:

1. `sucursalId` presente → *"Seleccione una sucursal de retiro"*
2. `responsableId` presente → *"No se encontró la persona del usuario en sesión"*
3. `tipoGastoId` presente → *"Seleccione un tipo de gasto"*
4. Si el tipo requiere activo y falta `enteId` → *"Seleccione {etiqueta}"*
5. Beneficiario `PERSONA` → exige `beneficiarioPersonaId`
6. Beneficiario `PROVEEDOR` → exige `beneficiarioProveedorId`
7. Por cada detalle: monto > 0, y `monedaId` + `formaPago` completos
8. **No se permite repetir moneda entre los detalles**

> ⚠️ **Regla clave — una moneda por detalle, sin repetir.** El detalle financiero es una lista de `{monto, monedaId, formaPago}` y cada moneda puede aparecer **una sola vez**. Para pedir dos montos en guaraníes con formas de pago distintas, no alcanza el modelo actual.

> ⚠️ **Gotcha — `responsableId` sale de la sesión, no se elige.** `obtenerResponsableSesion()` lo resuelve del usuario logueado. El error "No se encontró la persona del usuario en sesión" aparece cuando el usuario no tiene `persona` asociada — un problema de datos, no de UI.

## Retiro con QR

`confirmarRetiroFuncionario({ preGastoId, sucursalId, qrToken, funcionarioPersonaId })`

El funcionario se presenta en la caja, muestra el QR de su solicitud, el cajero lo escanea y se confirma el retiro. El `qrToken` viene en el `PreGasto` y ata el retiro a esa solicitud puntual.

## Servicio — `SolicitudGastosService`

Es un servicio con estado, no solo un wrapper de queries. `cargarDatosIniciales()` precarga tipos de gasto, monedas y sucursales; `actualizarConfigTipoGasto()` y `actualizarConfigSucursal()` recalculan la configuración del formulario.

**Búsquedas paginadas** (una por tipo de entidad, todas con la firma `(texto, pagina) => Promise<{items, hayMas}>`, lista para `BuscadorModalComponent` en modo `paginado`):

`cargarPaginaPersonas` · `cargarPaginaProveedores` · `cargarPaginaVehiculos` · `cargarPaginaMuebles` · `cargarPaginaInmuebles` · `cargarPaginaEquipos`

**Otros métodos:** `aplicarAutocompletadoSolicitud(...)`, `resolverEnteDesdeActivo(moduloPadre, referenciaId)`, `prepararConfigActivo(...)`, `cargarResumenFinancieroEnte(...)`, `iconoModuloPadre(...)`, `textoActivoSeleccionado(...)`, `obtenerPreGastoPorId(id, sucId)`, `getMisSolicitudes(...)`, `guardarGastoRendicion(input)`, `extraerMensajeError(error)`.

> ⚠️ **Gotcha — este módulo NO usa `GenericCrudService` para todo.** `confirmarRetiroFuncionario` y `guardarGastoRendicion` llaman Apollo directo con `.mutate(...).pipe(first()).toPromise()` y lanzan `Error` con el mensaje del backend. Es intencional: necesitan propagar el error real al usuario, algo que `GenericCrudService` no permite. **Estos métodos lanzan excepción — envolvelos en `try/catch`.**

## Operaciones GraphQL

`graphql/` — 17 archivos.

**Mutations:** `savePreGasto`, `saveGastoRendicion`, `confirmarRetiroFuncionario`, `saveEnte`.
**Queries:** `preGastoPorId`, `preGastosSearch`, `tipoGastos`, `enteByReferenciaId`, `enteFinancialSummary`, `getEnteFinancialSummary`, y las búsquedas paginadas `personaSearchPage`, `proveedorSearchByPersonaPage`, `vehiculoSearchPage`, `muebleSearchPage`, `inmuebleSearchPage`, `equipoSearchPage`.

> ⚠️ **Gotcha — `enteFinancialSummary` y `getEnteFinancialSummary` son dos archivos distintos** para el mismo concepto. Verificá cuál usa el código antes de modificar.

## Al trabajar en este módulo

1. Las reglas de qué campos pide el formulario están **todas** en `tipo-gasto-modulo-reglas.util.ts`. No las repliques en componentes.
2. Cualquier cálculo de montos debe pasar por `monto-moneda.util.ts` — el guaraní sin decimales rompe todo lo demás.
3. Los métodos de retiro y rendición lanzan excepciones: manejalas.
4. `estado` y `estadoRendicion` son independientes.


---

# Qué cambió en la PWA

> **Estado:** portados las **reglas de tipo de gasto**, la consulta de
> solicitudes y el **retiro con QR**. El alta de solicitud y la rendición no.

| Ruta | Componente |
|---|---|
| `/operaciones/gastos` | `GastosListaPage` |
| `/operaciones/gastos/:id/:sucursalId` | `GastosDetallePage` |

Una sola ruta, no dos: `frc-mobile` registraba el módulo en
`/operaciones/solicitud-gastos` **y** en `/solicitud-gastos`.

## Las reglas se portaron enteras, con tests

`domains/gastos/tipo-gasto.reglas.ts` es lógica pura y se llevó **verbatim**,
con un test por rama. Cada una tiene consecuencias: imputar un gasto al
activo equivocado, o no pedirlo cuando hace falta, deja el gasto sin dueño.

Las tres que más cuestan de adivinar leyendo el código:

- **Los siete servicios continuos se imputan a un `INMUEBLE`**, no a su
  propio módulo. La luz o el agua las consume un local.
- **`EQUIPOS` (plural) mapea a `EQUIPO` (singular).** Comparar directo falla.
- **Un `esPagoCuotaActivo` explícito manda sobre la naturaleza**, porque es
  una decisión que alguien ya tomó para esa solicitud. `null` no cuenta como
  explícito.

## Los estados los presenta el backend

`estadoEtiqueta`, `estadoColor` y `estadoIcono` vienen calculados y **no se
recalculan acá**. Es el único módulo del repo que lo hace, y es el patrón
correcto: un estado nuevo en el central aparece en la UI sin tocar el
cliente.

Lo único que se traduce es el **color** — el backend manda nombres de Ionic
(`success`, `warning`) y el sistema de diseño habla de tonos semánticos. Esa
traducción está en un solo lugar.

⚠️ **`estado` y `estadoRendicion` se muestran los dos.** Son máquinas
separadas: una solicitud puede estar retirada y con la rendición pendiente.

## El retiro se escanea

El QR de la solicitud lleva el `qrToken`, que **ata el retiro a esa solicitud
puntual**. Escanearlo abre el detalle con el token en la URL; si la solicitud
ya se cargó, se usa el suyo.

⚠️ El retiro se imputa a la **persona**, no al usuario. Un usuario sin
persona asociada da un error de datos, no de pantalla.

## Lo que falta

| Qué | Espera a |
|---|---|
| **Alta de solicitud** | los buscadores paginados de personas, proveedores, vehículos, muebles, inmuebles y equipos — seis, uno por tipo de activo |
| **Rendición** | subida de fotos de factura y producto |
| Devolución de vuelto | la rendición |
| Validaciones del formulario (`validarFormulario`) | el alta. La regla dura: **una moneda por detalle, sin repetir** |
