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

## En el teléfono 1:1; el 1:N vive en el kiosco

`frc-mobile` **busca** contra todas las galerías (`buscarYValidarUsuario`).
En el teléfono personal la pregunta es otra —*¿sos vos?*, no *¿quién sos?*—,
así que se compara contra la galería propia.

**El 1:N entra como segunda opinión, después del 1:1 y no en su lugar.**

⚠️ **El orden es lo que preserva la privacidad.** Primero corre el 1:1 contra
la galería propia; recién cuando pasó se le manda al central el embedding
consolidado para preguntarle quién es. Así, en un intento fallido **no sale
ningún rostro del dispositivo** — que era la propiedad que la #16 pedía no
perder. Hacer el 1:N primero, como se lee literalmente el alcance A de #17,
mandaría el rostro en cada intento.

**Qué agrega, entonces.** Justo el caso que el 1:1 no puede ver: un rostro que
se parece lo suficiente a *tu* galería pero que el central reconoce como de
otra persona. El 1:1 solo sabe decir «se parece a la galería con la que
comparé»; no sabe si se parece más a la de otro. Si el central identifica a
alguien distinto del de la sesión, **no se verifica**.

⚠️ **No se dice de quién era el rostro.** Nombrarlo revelaría quién más está
enrolado a cualquiera que apunte la cámara a una foto.

⚠️ **Si el central no contesta, no bloquea.** El 1:1 ya pasó; quedarse sin
poder marcar por un problema de red sería peor que perder una segunda opinión.

El 1:N que **sí marca por otra persona** vive solo en el kiosco, que es el
dispositivo compartido donde hace falta.

## Los umbrales no se bajaron, y no se bajan

`confirmarVerificacionFinal` viene de `frc-mobile` y exige **tres controles
independientes**; `embedding-galeria.util.ts` se copió verbatim, cambiando solo
la ruta del import.

⚠️ Si en la práctica cuesta pasar, el problema es el **enrolamiento** —pocas
poses, mala luz—, no el umbral. Aflojarlo convierte esto en un teatro.

⚠️ **Los frames salen de una sola foto, no de un rato frente a la cámara.**
Antes había un bucle a 12 fps que acumulaba aciertos consecutivos; ahora la
tanda entera dura ~320 ms y se acepta o se rechaza como un bloque. Insistir
tiene un costo visible —hay que tocar «Tomar otra foto»— y un límite.

## Cuenta regresiva, foto sola y reintento

El flujo es el de la PWA de gourmet, que ya estaba pedido: se abre el diálogo,
cuenta **3 segundos**, la foto **se toma sola**, y si no pasa se ofrece
**Tomar otra foto**. Ver la issue #16.

| Fase | Qué pasa |
|---|---|
| `preparando` | Se busca la galería y se enciende la cámara |
| `contando` | 3 · 2 · 1 sobre el video, en grande |
| `capturando` | La tanda de frames y la decisión |
| `fallo` | El motivo, con **Tomar otra foto** |
| `error` | Sin rostro enrolado, o la cámara no se pudo abrir |

⚠️ **La cuenta arranca con el evento `listo` de la cámara, no al abrir el
diálogo.** Si arrancara al abrir, correría mientras se bajan los 10 MB de
modelos y la foto saldría de una pantalla negra. Es lo mismo que hace gourmet
con su `onCaptureReady()`.

⚠️ **La cámara no se monta hasta saber que hay galería.** Pedir permiso de
cámara para después decir que no había con qué comparar gasta el permiso: una
vez denegado, el navegador no vuelve a preguntar.

⚠️ **Una foto sola no puede pasar `confirmarVerificacionFinal`**, que exige
`FRAMES_MINIMOS_VERIFICACION` = 3. Por eso «la foto» son **5 frames en ~320
ms**: para la persona es una foto, y la regla queda intacta. La alternativa
era relajar la regla, que es justo lo que la issue prohíbe.

**Los motivos de rechazo se distinguen** porque llevan a cosas distintas:

| Motivo | Qué hacer |
|---|---|
| No se detectó tu rostro | Acercarse, más luz |
| Tiene que ser tu rostro real, no una foto | No se arregla: es `antispoof`/`liveness` |
| No te reconocimos | Luz, de frente — o el enrolamiento es pobre |

**Tres intentos.** Al tercero el diálogo cierra como cancelado y la marcación
sigue por el camino de «sin verificación facial», que pregunta si se quiere
marcar igual y lo deja registrado. Insistir para siempre dejaría a alguien sin
poder marcar por una cámara mala, que es un problema distinto.

## `captura-facial.component.ts`, la cámara sin criterio

Enciende la cámara, carga los modelos y saca tandas de frames. **No decide
nada**: no compara contra ninguna galería, no habla con el central y no guarda
nada. El `overlay` es el número grande de la cuenta.

Es el `face-capture` de `frc-gourmet` portado, incluido su `overlayText`.

⚠️ **Vive en `pages/marcacion/`, no en `shared/`.** Lo usan dos pantallas del
mismo módulo, y la regla de tres del repo pide tres pantallas de módulos
distintos.

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


---

# El kiosco de marcación

`/marcacion/kiosco` — `KioscoMarcacionPage`. Un dispositivo compartido en la
puerta: la persona toca **Marcar**, cuenta de 3 s, la foto se toma sola, el
central dice quién es y la marcación queda **a nombre de quien la cámara
reconoció**. Es el flujo del `fichaje-facial` de `frc-gourmet`.

`inicio` → `contando` → `capturando` → (`eligiendo`) → `exito` → vuelve solo a
`inicio` a los 5 s, que es lo que hace falta con una fila en la puerta.

## Lleva rol, y la marcación propia no

`permisos.ts` dice que Marcación **no** lleva rol porque es autoservicio: el
filtro es la persona en sesión. **El kiosco rompe esa premisa** —marca por
otros—, así que pide `kioscoMarcacion` = `[ADMIN, RRHH GESTIONAR]`.

`frc-mobile` protege la pantalla equivalente comparando
`nickname === 'ADMIN'` (`AdminIngresoPersonaGuard`), que además de frágil no
se puede delegar a nadie. De hecho ese guard **redirige** `/marcacion` a
`ingreso-persona` cuando el usuario es ADMIN: en el repo viejo, la tablet
logueada como ADMIN *era* el kiosco. Acá es una pantalla aparte con su ruta.

## El doble control, y por qué hace falta

`usuarioPorEmbedding` resuelve el 1:N contra la caché en memoria del central.
Devolvía **el mejor match y nada más**: `findBestMatch()` calculaba el máximo y
descartaba el resto.

⚠️ **Hasta `V216.5` un `0.71` contra un segundo candidato de `0.69` llegaba
indistinguible de un `0.71` contra un `0.45`**, y el primero es una moneda al
aire. Ahora `usuarioPorEmbedding` devuelve también `similitudSegundo` y
`margen` — pero el margen se **registra**, no se usa para rechazar. Por eso
`validarIdentificacion()` recalcula la similitud **en el dispositivo** contra
la galería que vino en la respuesta, y exige las dos:

| Control | Umbral | Por qué ese |
|---|---|---|
| Central | `0.55` (`UMBRAL_SIMILITUD_FACIAL`) | Es el de búsqueda, el que usa su caché |
| Local | `0.75` (`UMBRAL_SIMILITUD_VERIFICACION`) | **Más estricto que el `0.55` de `frc-mobile`** |

`frc-mobile` acepta con `0.55` en las dos puntas, pero lo usa para **elegir** a
quién marcar en una pantalla donde después hay una verificación 1:1. Acá el
1:N es la única puerta: un rechazo de más cuesta un reintento, un falso
positivo deja una marcación a nombre de otra persona en el registro de
asistencia.

⚠️ **Sin galería en la respuesta no se marca.** No se cae al veredicto del
central: quedarse con un solo control es justamente lo que la función existe
para evitar.

## El riesgo asumido, y con qué se mide

Un falso positivo en el kiosco **marca por otra persona**, y eso queda en el
registro de asistencia como un hecho. En 1:1 el peor caso era que alguien no
pudiera marcar.

**Ahora queda registrado.** `administrativo.marcacion` guarda desde `V216.5`:

| Columna | Qué es |
|---|---|
| `metodo_registro` | `MANUAL` · `FACIAL_1A1` · `FACIAL_1AN_KIOSCO` |
| `similitud_facial` | La que informó **el central**, 0..1 |
| `margen_segundo_candidato` | Cuánto le sacó al segundo |

⚠️ **`similitud_facial` es siempre la del central, nunca la calculada en el
dispositivo.** Son medidas distintas —una contra la caché del central, otra
contra la galería propia— y mezclarlas en la misma columna la vuelve
inservible: nadie sabría después cuál está mirando. Si el central no contestó,
queda vacía.

⚠️ **El margen se registra pero todavía no decide nada.** Poner hoy un umbral
de margen sería inventar el número que la medición existe para averiguar: hace
falta ver qué margen dan estas caras, estas cámaras y esta luz. Cuando haya
datos, es una línea en `validarIdentificacion()`.

⚠️ **Son tres mitades, no dos.** Hay una migración por repositorio y el orden
importa:

| Repo | Migración | Cuándo |
|---|---|---|
| `franco-system-backend-filial` | `V91.5` | **Primero**, en todas las filiales |
| `franco-system-backend-servidor` | `V216.5` | Después |
| `frc-mobile-pwa` | — | Con el central, o después |

Contra un central sin `V216.5` los campos nuevos hacen fallar la mutation
entera y **la marcación deja de funcionar**, no solo los campos nuevos.

Y la de la filial va **antes** que el deploy del central, no después. La
replicación lógica **no propaga DDL**, y `administrativo.marcacion` viaja en
las dos direcciones: las publicaciones `central_filialN_pub` no llevan lista
de columnas, así que el publisher manda todas. Si el central gana una columna
que una filial no tiene, en cuanto alguien marque el apply worker de esa
filial muere con `is missing replicated column`, entra en crash-loop y **la
bajada central→filial queda cortada** con el WAL creciendo.

No es hipotético: es el mismo modo de falla del incidente del 2026-08-20 con
el enum `tipo_dispositivo` (`V90.7` de la filial), cambiando el enum por una
columna. Sin `out-of-order`, además, una filial que ya pasó ese
`installed_rank` **saltea la migración en silencio**: hay que confirmar
`flyway_schema_history` filial por filial.

## Dos cosas que se apartan de gourmet, a propósito

**No se ofrece ENTRADA/SALIDA al principio.** Gourmet arranca preguntando; acá
lo decide el central con `estadoMarcacionUsuario(usuarioId)` **de la persona
identificada**. Ofrecer las dos permite dos entradas seguidas, que es
justamente lo que el estado del backend existe para impedir. La única
pregunta que queda es la ambigua a propósito —salida de almuerzo o cierre del
día—, cuando el central habilita las dos.

**No hay cola offline.** Gourmet encola en `localStorage` y reintenta al
reconectar. Este repo no tiene ese patrón en ningún módulo y agregarlo acá es
un subsistema entero —conflictos, reintentos, orden—; queda fuera y dicho.

## La posición es la de la detección, no la de cada marcación

A diferencia de la marcación personal, que **vuelve a tomar el GPS al marcar**,
el kiosco usa la posición con la que detectó la sucursal. El dispositivo está
fijo en una pared: volver a tomarla por persona agregaría hasta 6 s a cada una
de una fila, para registrar la misma coordenada.
