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

> ⚠️ **Gotcha — `distanciaSucursalMetros` es `Int` en el esquema del central**, y `precisionGps` es `Float`. La distancia sale de un cálculo de Haversine, que da decimales: mandarla cruda hace que graphql-java rechace la mutation entera con «Variable 'entity' has an invalid value: Expected type 'Int' but was 'Double'» y **la marcación no se registra**. `frc-mobile` nunca lo vio porque mandaba `distanciaSucursalMetros: 0` fijo — no calculaba la distancia. En la PWA el redondeo vive en `MarcacionService.guardar()`, que es el único punto por el que pasan todas las marcaciones.

> ⚠️ **Gotcha — `accionPendiente` es ambigua a propósito, y el cliente la desambigua.** Con la entrada marcada y el almuerzo sin marcar, `JornadaMarcacionRules.construirEstado()` devuelve `accionPendiente = SALIDA` y habilita **`puedeMarcarSalida` y `puedeMarcarSalidaAlmuerzo` al mismo tiempo**: el central acepta las dos y espera que el funcionario elija con `esSalidaAlmuerzo`. `AlmuerzoProcessor.handleSalida()` es donde pesa — `true` la manda a `marcacionSalidaAlmuerzo`, `false` a `marcacionSalida` y cierra la jornada (`EstadoJornada.NORMAL`). **Deducir el flag de `accionPendiente` es un bug**: en ese estado la acción siempre vale `SALIDA`, así que toda primera salida del día quedaba como almuerzo y el retorno pasaba a ser obligatorio. Hay que leer los dos flags.

> **En una entrada el flag no se usa.** `AlmuerzoProcessor.handleEntrada()` lo ignora y decide por posición: si ya hay entrada y hay salida de almuerzo sin retorno, esa entrada **es** el retorno. `frc-mobile` mandaba `esSalidaAlmuerzo: true` en «Entrada Almuerzo», y era inocuo pero no significaba nada.

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
identificación— desaparece: queda **una sola pantalla** que muestra el estado
del día, la sucursal detectada y el botón que corresponda.

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

## La sucursal sale del GPS, no de una lista

`deteccion-sucursal.util.ts` toma la posición y devuelve la **operable más
cercana** con coordenadas cargadas, y a cuántos metros quedó. Corre sola al
abrir la pantalla, y de nuevo con **Recalcular**. No hay selección manual.

⚠️ **Hubo un desplegable, y era el agujero.** Mientras la sucursal se elegía a
mano —la persistida, si no la de la sesión, si no la primera de la lista—, la
distancia no medía nada: alcanzaba con seleccionar la sucursal donde uno
*dice* estar y el aviso de «estás lejos» no aparecía nunca. Verificado en un
Android real contra alpha el 2026-08-15. Ver la issue #15.

**Sin posición no se marca**, y esto es deliberado: caer en silencio a la
sucursal de la sesión reabriría el mismo agujero por la puerta de atrás —
bastaría con negar el permiso de ubicación—. Los botones quedan
deshabilitados y la pantalla dice por qué.

⚠️ **«No pude preguntar» y «no hay contra qué comparar» son dos respuestas
distintas**, y se dicen distinto:

| Estado | Qué pasó | Qué hay que hacer |
|---|---|---|
| `sin-posicion` | No hubo posición: permiso negado, GPS apagado, tiempo agotado | Es del teléfono: dar el permiso y **Recalcular** |
| `sin-coordenadas` | Hubo posición, pero ninguna sucursal operable tiene `localizacion` | Es del central: cargar las coordenadas |

Juntarlas en un «no se pudo» genérico manda a revisar el permiso del teléfono
cuando el que falta es un dato del central.

⚠️ **El filtro por `soloOperables()` vive dentro de la util, no en quien la
llama.** `SERVIDOR` y `COMPRAS` son virtuales y llevan las coordenadas del
central: dejarlas competir les daría todas las marcaciones de quien esté cerca
de la casa central. Que el filtro sea interno hace imposible olvidarlo.

⚠️ **La util no aplica ningún radio.** Devuelve la más cercana aunque queden
kilómetros; el corte lo decide la pantalla, que avisa y deja marcar. Recortar
ahí convertiría un GPS malo —lo normal en un interior— en «no podés marcar».

## La posición se toma dos veces, y es a propósito

La de la **apertura** sirve para decir dónde estás y habilitar el botón. La
del **momento de marcar** es la que viaja en `latitud`, `longitud`,
`precisionGps` y `distanciaSucursalMetros`.

Entre una y otra pueden pasar minutos. Guardar la de la apertura sería
registrar como evidencia un lugar donde la persona ya no está.

Si entre las dos la más cercana **cambió**, no se marca: se muestra la nueva y
se avisa. Marcar contra la de la apertura afirmaría un lugar equivocado.

## Una sola acción a la vez

El backend dice qué corresponde (`accionPendiente`) y la pantalla ofrece
**solo eso**. Mostrar entrada y salida juntas permite dos entradas seguidas.

`esSalidaAlmuerzo` viaja aparte del `tipo`: una salida de almuerzo es
`SALIDA` pero **no cierra la jornada**.

## La sucursal persistida se retiró

`MarcacionService` guardaba la última sucursal elegida en
`localStorage['frc.marcacion.sucursal']`. Se fue entera con la issue #15: la
sucursal ahora sale del GPS en cada marcación, y un valor guardado volvería a
ganarle a lo que dice la posición.

⚠️ **De paso apareció que nunca se limpiaba.** El comentario decía «se borra
al cerrar sesión», pero `limpiarSucursal()` no lo llamaba nadie: la clave
quedaba en el teléfono para siempre, así que el próximo usuario de ese aparato
heredaba la sucursal del anterior. Dejó de importar al no haber más clave.

## Lo que falta

| Qué | Espera a |
|---|---|
| Alta de rostros de **otra** persona (`ingreso-persona`) | cada uno registra el suyo desde Mi cuenta; dar de alta a un tercero es otra pantalla |
| Historial propio | ya está en «Mi trabajo» → Marcación |

---

# El rostro en la PWA

Se registra desde **Mi cuenta → Mi rostro** (`/cuenta/rostro`) y se usa al
marcar. Todo ocurre **en el dispositivo**: no se manda una foto a ningún lado
ni se le pregunta al servidor quién es la persona. Lo único que sale es el
embedding consolidado, y solo si pasó.

## Es verificación 1:1, no identificación 1:N

`frc-mobile` **busca** contra todas las galerías (`buscarYValidarUsuario`).
Acá el usuario ya está en sesión, así que la pregunta es otra: *¿sos vos?*, no
*¿quién sos?*. Se compara contra la galería propia, que además es más barato y
más difícil de confundir.

## Los umbrales no se bajaron, y no se bajan

`confirmarVerificacionFinal` viene de `frc-mobile` y exige **tres controles
independientes**; `embedding-galeria.util.ts` se copió verbatim, cambiando solo
la ruta del import.

⚠️ Si en la práctica cuesta pasar, el problema es el **enrolamiento** —pocas
poses, mala luz—, no el umbral. Aflojarlo convierte esto en un teatro.

⚠️ **Los aciertos tienen que ser consecutivos.** Un fallo reinicia la cuenta y
descarta los frames: acumular aciertos sueltos permitiría insistir un rato
frente a la cámara con la foto de otro.

## Cinco capturas libres, como `frc-gourmet`

El usuario saca cinco seguidas en los ángulos que quiera, con sugerencias
rotativas en vez de pasos con nombre: el ángulo lo elige la persona, y
etiquetarlos «izquierda/derecha» mentiría sobre lo que hace falta.

Se verificó que `construirGaleriaDesdeCapturas` acepta N capturas antes de
fijar el número en cinco.

## La ubicación sigue siendo un chequeo aparte

El diálogo facial **no valida dónde está la persona**. Eso sigue en
`MarcacionPage` con `GeoService`. Son dos preguntas distintas —quién sos y
dónde estás— y mezclarlas haría que aflojar una afloje la otra.

⚠️ **El orden es: dónde estás, después quién sos, y de nuevo dónde estás.** La
sucursal se detecta al abrir porque sin ella no hay nada que marcar; el rostro
se pide al tocar el botón, antes del GPS del momento, porque es el paso que
puede fallar por gusto del usuario —cancelar, no tener rostro cargado— y no
tiene sentido esperar al GPS para descubrirlo.

## Los modelos no se commitean

`@vladmandic/human` con `HUMAN-FACERES-1024` (1024 dimensiones). Los cinco
pares de archivos se copian desde `node_modules` en cada build
(`scripts/face-models.mjs`) y están en `.gitignore`.

⚠️ **No es solo por peso** —10 MB, que además hicieron fallar un push—: los
modelos tienen que corresponder a la versión de Human instalada. Un modelo
viejo contra una librería nueva produce embeddings que **no se alinean con la
galería** y no da ningún error: simplemente deja de reconocer a la gente.

Se sirven desde `/face-models` y `ngsw-config.json` los declara como asset
group **lazy**: quien nunca marca con rostro no los descarga.
