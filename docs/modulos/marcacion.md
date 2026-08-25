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
| Alta de rostros de **otra** persona (`ingreso-persona`) | cada uno registra el suyo desde Mi cuenta; dar de alta a un tercero es otra pantalla |

---

# El historial: una sola lista, en «Mi trabajo»

El funcionario ve lo que marcó en **«Mi trabajo» → Marcación**, y desde
`/marcacion` lo lleva ahí el botón **Historial** de la barra superior
(`/mi-trabajo?tab=marcaciones`).

**No se hizo una pantalla aparte, y es una decisión.** Esa pestaña ya listaba
las jornadas del funcionario con la misma consulta —`misMarcacionesMobile`, la
única que filtra por la sesión y no por el `usuarioId` que mande el cliente—.
Duplicarla habría dado dos listas de lo mismo que se desincronizan a la
tercera corrección. Lo que faltaba no era la lista: eran **las horas**.

## Lo que faltaba era el fichaje, no la pantalla

La consulta pedía `minutosTrabajados` y el estado del día, así que el
historial decía *cuánto* se trabajó y nunca *a qué hora se marcó*. Ahora trae
también los cuatro fichajes de la jornada.

⚠️ **Solo campos propios de `Marcacion`** — `id`, `tipo`, `fechaEntrada`,
`fechaSalida`. `usuario`, `sucursalEntrada` y `sucursalSalida` son relaciones
**LAZY** en el central: pedirlas las resolvería fuera de la transacción del
resolver. Es exactamente el subconjunto que ya pide `estadoMarcacionUsuario`,
que funciona contra el central real.

**No hizo falta tocar el central.** El tipo `Jornada` del schema ya exponía
los cuatro slots; lo que no los pedía era el cliente. Por eso esto se puede
publicar contra cualquier instancia, alpha incluida.

## La regla que no está en el modelo

⚠️ **Una marcación no tiene un campo «fecha»**: guarda su momento en
`fechaEntrada` **o** en `fechaSalida`, según su tipo. Leer siempre el mismo
deja la mitad de los fichajes sin hora, y como el campo existe y llega
`undefined`, no hay error que lo delate.

Vive en `domains/marcacion/jornada.util.ts` (`momentoDeMarcacion`,
`horariosDeJornada`), con su spec, y la usan las **tres** pantallas que
muestran horarios: el «Hoy» de `/marcacion`, la pestaña de «Mi trabajo» y
—cuando exista— cualquiera que venga después.

Dos cosas que esa regla resuelve y conviene no deshacer:

- **Los slots vacíos no se muestran.** Una jornada sin almuerzo no marcó
  almuerzo; una fila con un guion ocupa lugar para decir que no pasó nada.
- **Un turno noche cruza la medianoche**, así que la salida puede caer al día
  siguiente de `jornada.fecha`. En ese caso la hora lleva el día
  —`05:40 (15/08)`—: sola se leería como una salida de madrugada del mismo día.

## Un tipo, no dos

`domains/rrhh/rrhh.model.ts` declaraba su propia `Jornada`, un subconjunto sin
los fichajes y con `estado` como `string` suelto. Mientras el historial solo
mostraba minutos nadie lo notaba. Ahora reexporta la de marcación: **una fila
del central, un tipo**.

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
`MarcacionPage` con `GeoService`, y corre **después** del rostro. Son dos
preguntas distintas —quién sos y dónde estás— y mezclarlas haría que aflojar
una afloje la otra.

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
