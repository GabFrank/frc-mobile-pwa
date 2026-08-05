# marcacion

**Ubicación:** `src/app/pages/marcacion/`
**Tamaño:** 18 archivos TS, ~1.763 LOC
**Ruta base:** `/marcacion`

## Qué resuelve

**Control de asistencia**: el funcionario marca entrada y salida desde su celular, y el sistema valida que esté **físicamente en la sucursal** (GPS) y que **sea quien dice ser** (reconocimiento facial).

Es el módulo con más integración de hardware del repo: cámara, GPS y motor de inferencia on-device.

## Rutas

| Ruta | Componente |
|---|---|
| `''` | `TipoMarcacionComponent` |
| `ingreso-persona` | `IngresoPersonaComponent` |
| `localizacion/:arg` | `LocalizacionMarcacionComponent` |
| `localizacion/:arg/identificacion/:sucId` | `IdentificacionMarcacionComponent` |
| `localizacion/:arg/ingreso-persona/:sucId` | `IngresoPersonaComponent` |

**El flujo es una cascada de rutas anidadas:** elegir tipo → validar ubicación → identificar rostro. Cada paso agrega un parámetro a la URL, así que el estado del flujo vive en la ruta y sobrevive a un refresh.

> ⚠️ **Gotcha — la ruta de entrada depende del usuario.** `AppComponent` calcula `marcacionRoute`: si el nickname es literalmente `'ADMIN'` va a `/marcacion/ingreso-persona`, si no a `/marcacion`. Detecta admin **por nickname, no por rol** — ver [`../arquitectura/routing-navegacion.md`](../arquitectura/routing-navegacion.md).

`AdminIngresoPersonaGuard` protege el alta de personas.

## Modelo — `Marcacion`

| Campo | Para qué |
|---|---|
| `tipo` | `ENTRADA` / `SALIDA` |
| `latitud`, `longitud` | **Dónde se marcó** |
| `precisionGps` | Precisión reportada por el dispositivo |
| `distanciaSucursalMetros` | **Distancia calculada a la sucursal** |
| `deviceId`, `deviceInfo` | Dispositivo usado |
| `sucursalEntrada` / `fechaEntrada` | |
| `sucursalSalida` / `fechaSalida` | |
| `presencial` | Si fue presencial |
| `autorizacion` | Autorización especial |
| `codigo` | Código alternativo de marcación |
| `esSalidaAlmuerzo` | **Distingue salida de almuerzo de salida de jornada** |

> **Regla clave — se guarda la evidencia, no solo el veredicto.** `latitud`, `longitud`, `precisionGps` y `distanciaSucursalMetros` quedan registrados en cada marcación. Permite auditar después: una marcación a 300 m con precisión de 500 m es distinta de una a 300 m con precisión de 5 m. **No descartes estos campos al guardar.**

> **Regla clave — `esSalidaAlmuerzo` cambia el cálculo de horas.** Una salida de almuerzo no cierra la jornada. Tratarla como salida normal parte la jornada en dos y descuadra las horas trabajadas.

> ⚠️ **Gotcha — `sucursalId`, `sucursalEntrada` y `sucursalSalida` coexisten.** Entrada y salida pueden ser en sucursales distintas (un funcionario que se traslada). `sucursalId` es la de la marcación puntual.

## Sucursal persistida

`MarcacionService` mantiene la última sucursal elegida en `localStorage['sucursalPersistida']`, expuesta como `sucursalPersistida$`.

| Método | Qué hace |
|---|---|
| `obtenerSucursalPersistida()` | Valor actual |
| `guardarSucursalPersistida(sucursal)` | Guarda o borra si es `null` |
| `limpiarSucursalPersistida()` | Borra |

**Existe para que el funcionario no tenga que elegir su sucursal cada vez.**

> ⚠️ **Gotcha — `logOut()` la limpia.** `login.service.ts:242` llama `limpiarSucursalPersistida()`: la sucursal es del funcionario, no del dispositivo, y no debe filtrarse al siguiente usuario.

> **Nota de calidad — este servicio maneja bien el storage**, a diferencia del resto del repo: usa `removeItem` (no `setItem(clave, null)`) y envuelve el `JSON.parse` en `try/catch` limpiando la clave si está corrupta. **Es el patrón a copiar** — compará con el ítem 4 del [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

## Validación de ubicación

`LocalizacionMarcacionComponent` + `GeoLocationService`:

| Método de `GeoLocationService` | Uso |
|---|---|
| `getCurrentLocation(...)` | Posición, con progreso (`GeoProgress`) |
| `checkIfLocationMatches(...)` | Si está dentro del radio |
| `calculateDistanceMeters(...)` | Distancia que se guarda en la marcación |

El servicio reporta progreso porque obtener una posición precisa en interiores puede tardar: la UI muestra el avance en vez de quedarse colgada.

## Reconocimiento facial

`IdentificacionMarcacionComponent` usa `ReconocimientoFacialHelperService` (ver [`../infraestructura/services.md`](../infraestructura/services.md)).

Flujo:
1. `inicializarMotorFacial()` — carga los modelos
2. `capturarFrameConScore(...)` — captura frames evaluando calidad
3. `evaluarFrameBusqueda(video)` o `evaluarFrameVerificacion(...)`
4. `confirmarVerificacionFinal(...)` — exige **3 frames válidos** y **3 aciertos consecutivos**
5. `buscarYValidarUsuario(embedding)` — resuelve la identidad contra el backend

> **Regla clave — la identificación exige múltiples frames coincidentes.** `FRAMES_MINIMOS_VERIFICACION = 3` y `HITS_CONSECUTIVOS_VERIFICACION = 3` evitan que un frame borroso o una foto sostenida frente a la cámara valide una identidad. **No bajes estos umbrales para "agilizar" el flujo.**

> **Regla clave — verificación (`0.75`) es más estricta que búsqueda (`0.55`).** En verificación ya se sabe contra quién comparar; en búsqueda hay que tolerar más variación para no descartar al usuario correcto. Ambos umbrales están calibrados contra condiciones reales de sucursal.

`IngresoPersonaComponent` registra rostros nuevos: captura varias imágenes y llama `onIncorporarEmbeddingMarcacion` (ver `IncorporarEmbeddingResult`). Solo capturas con score ≥ `SCORE_MINIMO_GALERIA` (0.7) entran a la galería.

> ⚠️ **Gotcha — la galería facial viaja como JSON en un campo de texto del usuario.** `parsearGaleriaFacial` la deserializa. No es una tabla relacional: cargar embeddings sin control hace crecer ese campo indefinidamente.

## Servicio — `MarcacionService`

| Método | Qué hace |
|---|---|
| `onSaveMarcacion(input)` | Registra la marcación |
| `onGetMarcacionesPorUsuario(usuarioId, fechaInicio?, fechaFin?, page?, size?)` | Historial |
| `onGetJornadasPorUsuario(usuarioId, fechaInicio?, fechaFin?)` | **Jornadas armadas** |
| `onGetEstadoMarcacionUsuario(usuarioId)` | **Estado actual: ¿entró? ¿salió?** |

> **Regla clave — `Jornada` la arma el backend.** El cliente no empareja entradas con salidas: pide `onGetJornadasPorUsuario` y recibe las jornadas ya calculadas, con el manejo de salidas de almuerzo, jornadas partidas y marcaciones huérfanas. **No repliques ese cálculo.**

**Consultá `onGetEstadoMarcacionUsuario` antes de ofrecer marcar**: define si corresponde ENTRADA o SALIDA. Ofrecer ambas sin consultar permite dos entradas seguidas.

> **Nota de estilo — este servicio usa `inject()` en vez de constructor injection**, más moderno que el resto del repo.

## Operaciones GraphQL

`saveMarcacion`, `getMarcacionesPorUsuario`, `getJornadasPorUsuario`, `getEstadoMarcacionUsuario`.

## Integración con RRHH

El historial de marcaciones también aparece en [`mis-rrhh`](mis-rrhh-y-finanzas.md) como segmento del dashboard del funcionario.

## Al trabajar en este módulo

1. Guardá siempre la evidencia de GPS (`precisionGps`, `distanciaSucursalMetros`), no solo el veredicto.
2. No bajes los umbrales faciales ni la exigencia de frames.
3. Consultá el estado antes de ofrecer marcar.
4. Las jornadas las calcula el backend.
5. `esSalidaAlmuerzo` no cierra la jornada.
6. El manejo de `localStorage` de este módulo es el patrón correcto: copialo.


---

# Qué cambió en la PWA

> **Estado:** portado el **marcado con validación de ubicación**. El
> **reconocimiento facial no**.

| Ruta | Componente |
|---|---|
| `/marcacion` | `MarcacionPage` |

La cascada de rutas anidadas del repo anterior —tipo → ubicación →
identificación— desaparece: sin paso facial queda **una sola pantalla** que
muestra el estado del día, la sucursal y el botón que corresponda.

## El GPS se reimplementó, no se perdió

`GeoService` en `core/dispositivo/` reemplaza al `NativeLocationPlugin`, un
plugin Java de 155 líneas sobre `FusedLocationProvider`. La web no ofrece el
fusionado de sensores, pero **el patrón que lo hacía útil sí**: calentar,
exigir varias lecturas, filtrar por precisión y promediar. Se conservan sus
constantes (`±33 m`, 700 ms de calentamiento, 6,3 s de tope, 2 lecturas).

> ⚠️ **Es la pérdida técnica más concreta de la migración.** Sin fusionado
> nativo la precisión empeora en interiores, que es justo donde se marca.

**Por eso la distancia no bloquea: avisa.** Si la marcación queda lejos, se
pide confirmación y se guarda igual — con `precisionGps` y
`distanciaSucursalMetros`. Bloquear con un umbral que todavía no está
calibrado dejaría gente sin poder marcar; guardar la evidencia permite
recalibrarlo con datos reales, que es lo que el módulo ya hacía.

Si no hay ubicación en absoluto, también se puede marcar confirmando: queda
registrado sin GPS, que es un dato honesto.

## Una sola acción a la vez

El backend dice qué corresponde (`accionPendiente`) y la pantalla ofrece
**solo eso**. Mostrar entrada y salida juntas permite dos entradas seguidas.

`esSalidaAlmuerzo` viaja aparte del `tipo`: una salida de almuerzo es
`SALIDA` pero **no cierra la jornada**.

## La sucursal persistida, con su gotcha

Se guarda en `localStorage` con el patrón correcto del repo anterior —
`removeItem`, no `setItem(clave, null)`, y `JSON.parse` en `try/catch` que
limpia la clave si está corrupta.

⚠️ **Se borra al cerrar sesión** (`auth.service.ts`): la sucursal es del
funcionario, no del dispositivo. Sin eso, el próximo que entre en ese
teléfono marca contra la sucursal del anterior.

## Lo que falta

| Qué | Espera a |
|---|---|
| **Reconocimiento facial** | portar el motor on-device. `frc-gourmet` ya lo resolvió en web; los umbrales (3 frames, 3 aciertos, 0,75 verificación / 0,55 búsqueda) **no se bajan** |
| Alta de rostros (`ingreso-persona`) | lo anterior |
| Historial propio | ya está en «Mi trabajo» → Marcación |
