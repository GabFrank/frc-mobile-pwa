# Servicios transversales

Catálogo de `src/app/services/`. Son los servicios que cualquier módulo puede usar. Todos son `providedIn: 'root'` salvo aviso.

Para el servicio de datos genérico (`GenericCrudService`) ver [`../arquitectura/apollo-graphql.md`](../arquitectura/apollo-graphql.md). Para login ver [`../arquitectura/autenticacion-sesion.md`](../arquitectura/autenticacion-sesion.md).

---

## Estado global

### `MainService`

Estado compartido de la sesión. Se inicializa vía `APP_INITIALIZER` (`app.module.ts:196-200`).

| Miembro | Tipo | Uso |
|---|---|---|
| `usuarioActual` | `Usuario` | Usuario logueado. Lo escribe `LoginService` |
| `sucursalActual` | `Sucursal` | Sucursal de la sesión, viene en la respuesta de `/login` |
| `authenticationSub` | `BehaviorSubject<boolean>` | Emite `true`/`false` al loguear/desloguear. Arranca en `null` |
| `pushToken$` | `BehaviorSubject<string \| null>` | Token FCM |
| `isDev` | `boolean` | `isDevMode()` |
| `setPushToken(token)` / `getPushToken()` | | Escritura/lectura del token |

> ⚠️ **Gotcha — `authenticationSub` arranca en `null`, no `false`.** Un `subscribe` que asuma booleano recibe `null` en la primera emisión. Filtrá explícitamente si te importa la distinción entre "todavía no sé" y "no autenticado".

> ⚠️ **Gotcha — `load()` está vacío.** El `APP_INITIALIZER` llama `mainService.load()`, que hoy no hace nada. Es un punto de extensión disponible: si necesitás trabajo previo al arranque, va ahí.

---

## UI: avisos, cargas, modales

### `NotificacionService` — toasts

Envuelve `ToastController`. Enum `TipoNotificacion`: `SUCCESS` (`success`), `WARN` (`warning`), `DANGER` (`danger`), `NEUTRAL` (`light`).

| Método | Color | Duración |
|---|---|---|
| `open(msg, tipo, duracion)` | según tipo | `duracion` en **segundos** (default 2 s) |
| `toast(text)` | neutral | 2 s |
| `success(text)` | verde | 2 s |
| `warn(text)` | amarillo | 3 s |
| `danger(text)` | rojo | 3 s |
| `openGuardadoConExito()` | verde | 1 s |
| `openAlgoSalioMal(err?)` | rojo | 2 s |
| `openItemNoEncontrado()` | amarillo | 2 s |
| `openEliminadoConExito()` | verde | 2 s |

> ⚠️ **Gotcha — `duracion` va en segundos.** Internamente hace `duracion * 1000`. Pasar `2000` da un toast de 33 minutos.

### `CargandoService` — loading

`open(texto?, disable?, duration?)` devuelve el `HTMLIonLoadingElement`; `close(loading)` lo cierra.

> ⚠️ **Gotcha — `close()` tiene un `setTimeout` de 500 ms.** El loading no desaparece al instante. Si abrís y cerrás dos loadings en rápida sucesión, se pisan visualmente. Además `open()` no lleva registro: si perdés la referencia, el loading queda colgado en pantalla y solo se va con `backdropDismiss` (activo por defecto salvo que pases `disable = true`).

### `DialogoService` — alertas

`open(titulo, texto, siNo?)`. Con `siNo` distinto de `false` muestra **No / Sí**; con `siNo === false`, solo **Aceptar**. Devuelve el resultado del alert: el llamador compara `res.role === 'aceptar'`.

### `ModalService` — modales

`openModal(component, data?, modalSize?)` presenta el modal y devuelve `await modal.onWillDismiss()`. `closeModal(data)` lo cierra. Los datos llegan al componente hijo como `componentProps: { data }` — el hijo debe declarar `@Input() data`.

`ModalSize`: `AUTO` → `custom-modal`, `MEDIUM` → `custom-modal-medium`, `LARGE` → `custom-modal-large`. Sin tamaño, la clase es `my-custom-class`.

### `PopOverService` — popovers

`open(component, data?, size?, extraStyle?)` devuelve `onDidDismiss()`. `close(data?)`. `PopoverSize`: `XS` / `SM` / `MD`.

> ⚠️ **Gotcha — `ModalService` y `PopOverService` guardan un solo `current*`.** Anidar dos modales (o dos popovers) hace que `closeModal`/`close` cierre el equivocado. Evitá anidarlos.

### `MenuActionService`

`presentActionSheet(opciones: ActionMenuData[])` — action sheet de Ionic a partir de una lista de opciones.

### `PaginationStateService`

`setPaginationVisible(visible: boolean)` — muestra/oculta el componente global de paginación.

---

## Dispositivo y nativo

### `BarcodeScannerService`

`scan(): Observable<BarcodeScanResult>` con `{ text, format, cancelled }`. Único scanner soportado (`@capacitor-mlkit/barcode-scanning`).

En plataforma no nativa devuelve `{ text: '', format: '', cancelled: true }` sin abrir nada.

Avisa a `ServerConnectionService` antes y después del escaneo para que no aparezca un falso "servidor offline".

> ⚠️ **Gotcha crítico — no uses `Platform.is('capacitor')`.** En este stack (Ionic 6 + Capacitor 7) devuelve `false` dentro de la app nativa, y el scanner nunca se disparaba. Usá `Capacitor.isNativePlatform()`, como hace el resto de los servicios nativos del proyecto. Está documentado en el propio código (`barcode-scanner.service.ts`).

### `CamaraService`

| Método | Qué hace |
|---|---|
| `iniciarCamara(): Promise<MediaStream>` | Abre el stream de la cámara web |
| `detenerCamara(video?)` | Corta el stream y libera tracks |
| `capturarFoto(videoElement, espejar = false): string` | Captura un frame como data URL |

`espejar` sirve para la cámara frontal, donde la imagen se ve invertida.

### `GeoLocationService`

| Método | Qué hace |
|---|---|
| `getCurrentLocation(...)` | Posición actual, con progreso (`GeoProgress`) |
| `checkIfLocationMatches(...)` | Si la posición cae dentro de un radio objetivo |
| `calculateDistance(...)` | Distancia en km |
| `calculateDistanceMeters(...)` | Distancia en metros |

Se usa en marcación para validar que el funcionario esté en la sucursal.

### `FingerprintAuthService`

`showFingerprintDialog()` — diálogo biométrico nativo.

### `AudioRecordingService`

Grabación de audio con estado observable (`EstadoGrabacion`). Requiere `RECORD_AUDIO`.

### `MediaUploadService`

Subida de archivos con progreso (`ProgresoSubidaMedia`).

### `PdfViewerService`

`openPdfFromBase64(base64Data, fileName)` — guarda el PDF en `Directory.Cache` con `@capacitor/filesystem` y lo abre con el visor nativo (`@capacitor-community/file-opener`).

Muestra un loading "Generando y descargando el reporte…". Si el visor nativo falla, hace fallback a `window.open('data:application/pdf;base64,...', '_system')` y avisa; si eso también falla, sugiere instalar un visor.

> **Este es el camino estándar para mostrar cualquier PDF en la app** (recibos, comprobantes, reportes). El `base64Data` va **sin** el prefijo `data:application/pdf;base64,`.

### `PushNotificationsService`

`initPush()` registra el dispositivo en FCM. `syncTokenToBackend()` envía el token al central — lo llama `LoginService` después de registrar la sesión.

### `HoraServidorService`

Hora del servidor corregida por offset, para no depender del reloj del dispositivo.

| Miembro | Qué hace |
|---|---|
| `horaActual$: BehaviorSubject<Date>` | Emite **cada segundo** la hora corregida |
| `obtenerHoraActual(): Date` | Hora corregida puntual |
| `estaSincronizado(): boolean` | Si ya logró sincronizar alguna vez |
| `sincronizarConServidor()` | Fuerza una sincronización |

Consulta `GET /config/hora-servidor` al arrancar y luego **cada 5 minutos**, con `timeout(5000)`. Estima la latencia como `(despues - antes) / 2` y la suma al timestamp del servidor para calcular `offsetMs`.

> ⚠️ **Gotcha — si nunca sincroniza, devuelve la hora local en silencio.** Ante fallo solo hace `console.warn` y `offsetMs` queda en `0`. Para lógica sensible al tiempo (marcaciones, cierres de caja), chequeá `estaSincronizado()` antes de confiar en el valor.

> ⚠️ **Gotcha — emite cada segundo mientras la app viva.** Suscribirse a `horaActual$` sin desuscribirse dispara detección de cambios una vez por segundo. Usá `untilDestroyed` o `obtenerHoraActual()` si solo necesitás el valor puntual.

### `ServerConnectionService`

Estado de conexión con el servidor. Ver [`../arquitectura/configuracion-servidor.md`](../arquitectura/configuracion-servidor.md).

### `ConfigService`

`setMode(mode: string)` — 15 líneas, configuración mínima de modo de UI.

---

## Reconocimiento facial

Tres piezas encadenadas. El motor es `@vladmandic/human` sobre TensorFlow WASM, on-device.

### `FaceRecognitionService` — motor

| Método | Qué hace |
|---|---|
| `init()` | Carga los modelos. **Obligatorio antes de usar el resto** |
| `prepararImagen(dataUrl, maxSize = 640)` | Redimensiona antes de inferir |
| `detect(input)` | Detección cruda |
| `getDescriptor(input)` | Embedding facial (`number[]`) |
| `getDescriptorConScore(input)` | Embedding + score de calidad |
| `getDescriptorConScoreDesdeImagen(dataUrl)` | Ídem desde data URL |
| `similarity(e1, e2)` | Similitud entre dos embeddings |
| `calcularMejorSimilitudConGaleria(embedding, galeria)` | Mejor match contra una galería |
| `fastDetectFace(base64)` | Detección rápida vía ML Kit |

### `embedding-galeria.util.ts` — umbrales y galería

Constantes que gobiernan todas las decisiones faciales:

| Constante | Valor | Significado |
|---|---|---|
| `UMBRAL_SIMILITUD_FACIAL` | `0.55` | Mínimo para considerar un match en búsqueda |
| `UMBRAL_SIMILITUD_VERIFICACION` | `0.75` | Mínimo, más estricto, para verificar identidad conocida |
| `SCORE_MINIMO_DETECCION` | `0.45` | Calidad mínima de detección |
| `SCORE_MINIMO_FRAME` | `0.55` | Calidad mínima de un frame en búsqueda |
| `SCORE_MINIMO_FRAME_VERIFICACION` | `0.6` | Ídem en verificación |
| `SCORE_MINIMO_GALERIA` | `0.7` | Calidad mínima para incorporar una captura a la galería |
| `FRAMES_MINIMOS_VERIFICACION` | `3` | Frames válidos exigidos |
| `HITS_CONSECUTIVOS_VERIFICACION` | `3` | Aciertos seguidos exigidos |

Funciones: `parsearGaleriaFacial(json)` y `construirGaleriaDesdeCapturas(...)`. La galería viaja como **JSON en un campo de texto del usuario**.

> ⚠️ **Gotcha — no toques estos umbrales sin pruebas de campo.** Están calibrados contra condiciones reales de sucursal (luz, cámaras de gama baja). Bajarlos produce falsos positivos de identidad; subirlos hace que funcionarios legítimos no puedan marcar. Verificación (`0.75`) es deliberadamente más estricta que búsqueda (`0.55`) porque en verificación ya se sabe contra quién comparar.

### `ReconocimientoFacialHelperService` — orquestación

Encapsula las reglas de negocio para que las pantallas no manejen umbrales.

| Método | Qué hace |
|---|---|
| `inicializarMotorFacial()` | Delega en `FaceRecognitionService.init()` |
| `obtenerGaleriaDesdeUsuario(usuario)` | Parsea la galería del usuario |
| `evaluarFrameVerificacion(...)` | Evalúa un frame contra una identidad conocida |
| `evaluarFrameBusqueda(video)` | Evalúa un frame para buscar identidad |
| `confirmarVerificacionFinal(...)` | Aplica frames mínimos + hits consecutivos |
| `embeddingCumpleUmbralVerificacion(...)` | Chequeo puntual de umbral |
| `buscarYValidarUsuario(embedding)` | Busca en backend y valida el resultado |
| `buscarUsuarioPorEmbedding(embedding, excludeIds)` | Búsqueda cruda, con exclusiones |
| `validarEmbeddingConCache(...)` | Validación con caché para evitar consultas repetidas |
| `capturarFrameConScore(...)` | Captura un frame usable |

**Usá este servicio, no el motor directo.** `FaceRecognitionService` no aplica las reglas de aceptación.

### `FaceAiService`

`getPersonAge(imageUrl)` — estimación de edad vía Azure Cognitive Face. 31 líneas.

> ⚠️ **Seguridad — credencial hardcodeada.** `face-ai.service.ts:8` contiene una credencial en el código, señalada en [`REPORTE_VULNERABILIDADES.md`](../../../../REPORTE_VULNERABILIDADES.md). No repliques el patrón ni agregues claves nuevas al bundle.

---

## Datos de usuario

### `UsuarioService`

Operaciones GraphQL sobre `Usuario`:

| Método | Qué hace |
|---|---|
| `onGetUsuario(id)` | Usuario por id |
| `onGetUsuarioParaLogin(id)` | Versión con los campos que necesita el arranque de sesión |
| `onGetUsuarioPorPersonaId(id)` | Por id de persona |
| `onSeachUsuario(texto)` | Búsqueda por texto |
| `onSaveUsuario(input)` | Alta/edición |
| `onSaveInicioSesion(input)` | Registra/cierra sesión activa |
| `onSaveUsuarioImage(...)` | Guarda imagen de usuario |
| `onGetUsuarioImages(id, type, showLoading = true)` | Imágenes del usuario |
| `getIsUserFaceAuth(id)` | Si el usuario tiene habilitada la autenticación facial |
| `onIncorporarEmbeddingMarcacion(...)` | Suma un embedding facial a la galería |
| `onGetUsuarioPorEmbedding(embedding, excludeIds)` | Busca usuario por rostro |

---

## Servicios con nombre engañoso

- **`update-service.service.ts`** no es un servicio Angular: exporta funciones sueltas (`getCurrentAppVersion`, `performImmediateUpdate`, …). No se inyecta, se importa. Ver [`../arquitectura/actualizaciones-app.md`](../arquitectura/actualizaciones-app.md).
- **`embedding-galeria.util.ts`** está en `services/` pero es un módulo de utilidades y constantes, sin clase inyectable.
