# notificaciones

**Ubicación:** `src/app/pages/notificaciones/`
**Tamaño:** 31 archivos TS, ~1.792 LOC
**Rutas base:** `/notificacion` y `/comentarios` (**ambas cargan el mismo módulo**)

## Qué resuelve

Notificaciones push con **hilo de comentarios**. No es solo un aviso: cada notificación admite discusión encadenada entre los usuarios con acceso, con adjuntos.

Sirve para eventos operativos que requieren que alguien responda — una diferencia de maletín, una venta con stock negativo, un retiro en sucursal.

## Rutas

| Ruta | Componente |
|---|---|
| `''` | `NotificacionMenuComponent` |
| `lista` | `NotificacionComponent` |
| `preferencias` | `PreferenciasComponent` |
| `comentarios/:id` | `ComentariosComponent` |
| `crear-notificacion` | `CrearNotificacionComponent` |

> ⚠️ **Gotcha — `/notificacion` y `/comentarios` son la misma cosa.** Ambas rutas raíz cargan `NotificacionModule` (`app-routing.module.ts:27-50`). No hay módulo separado de comentarios.

## Tipos de notificación

`DESCRIPCION_POR_TIPO_NOTIFICACION` (`models/notificacion.model.ts`):

| Tipo | Qué avisa |
|---|---|
| `RETIRO` | Retiro realizado en sucursal |
| `VENTA_TRANSFERENCIA` | Venta con pago por transferencia bancaria |
| `VENTA_STOCK_CRITICO` | **Venta con producto en stock cero o negativo** |
| `VENTA_CREDITO_CLIENTE` | Compra a crédito propia |
| `DIFERENCIA_MALETIN` | **Diferencia detectada en maletín** |

> **Estos tipos son eventos de control, no marketing.** `VENTA_STOCK_CRITICO` y `DIFERENCIA_MALETIN` señalan descuadres que alguien tiene que investigar — de ahí que el módulo tenga hilo de comentarios.

> ⚠️ **Gotcha — el mapa de descripciones vive en el cliente, pero `tipo` es un string libre del backend.** Un tipo nuevo en el central no aparece acá hasta que se agregue al `Record`. Manejá el caso de tipo desconocido: no asumas que siempre hay descripción.

## Modelo

### `Notificacion` y `NotificacionDestinatario`

**Están separadas a propósito.** `Notificacion` es el evento; `NotificacionDestinatario` es la entrega a un usuario concreto, con su propio `leida` y `fechaLeida`.

| `Notificacion` | |
|---|---|
| `titulo`, `mensaje`, `tipo` | |
| `data` | Payload libre (string) |
| `estadoTablero` | Estado en el tablero de seguimiento |
| `fechaVerificacion` | Cuándo se verificó |
| `conteoComentarios` | Comentarios acumulados |

| `NotificacionDestinatario` | |
|---|---|
| `leida`, `fechaLeida`, `fechaEntrega` | Por usuario |

> **Regla clave — "leída" es por destinatario, no por notificación.** Una notificación enviada a cinco usuarios tiene cinco registros de destinatario. Marcar como leída afecta solo al usuario actual.

> ⚠️ **Gotcha — `data` es un string, no un objeto.** Payload serializado. Si lo usás, parsealo defensivamente: no hay contrato tipado.

### `NotificacionComentario`

`comentario`, `usuario`, `creadoEn`, `actualizadoEn`, **`comentarioPadre`** (auto-referencia → hilos anidados) y `mediaUrl` (adjunto).

> **Los comentarios son un árbol, no una lista.** `comentarioPadre` permite responder a un comentario puntual. Al renderizar, agrupá por padre; al crear, pasá `comentarioPadreId`.

### `ConfiguracionNotificacion`

`tipo`, `descripcion`, `habilitado`, **`esObligatorio`**.

> **Regla clave — hay notificaciones que el usuario no puede desactivar.** `esObligatorio: true` marca las que deben llegar sí o sí (típicamente las de control). La pantalla de preferencias debe mostrarlas deshabilitadas, no ocultarlas.

## Servicio — `NotificacionService`

| Método | Qué hace |
|---|---|
| `notificaciones(variables)` | Lista paginada con filtros |
| `marcarComoLeida(notificacionId)` | Marca una |
| `marcarTodasComoLeidas()` | Marca todas |
| `conteoNoLeidas()` | **Contador para el badge** |
| `refrescarConteoNoLeidas()` | Fuerza recálculo |
| `resetConteoNoLeidas()` | Resetea el contador local |
| `comentarios(notificacionId)` | Hilo |
| `crearComentario(notificacionId, comentario, comentarioPadreId?, mediaUrl?)` | Comenta |
| `usuariosConAcceso(notificacionId)` | Quiénes ven la notificación |
| `enviarNotificacionPersonalizada(titulo, mensaje, tipoEnvio, usuariosIds?)` | **Envío manual** |
| `obtenerUsuariosActivos()` | Usuarios para elegir destinatarios |

`NotificacionesUsuarioVariables` acepta `leidas`, `page`, `size`, `estadoTablero`, `fechaInicio`, `fechaFin`.

> ⚠️ **Gotcha — `refrescarConteoNoLeidas()` y `resetConteoNoLeidas()` hacen cosas distintas.** El primero vuelve a consultar el backend; el segundo solo pone el contador local en cero. Usar `reset` cuando querías `refrescar` deja el badge desincronizado hasta la próxima consulta.

> ⚠️ **Este módulo no usa el patrón de archivo GraphQL del resto del repo.** En vez de `graphql/nombreOperacion.ts` con una clase `Query`/`Mutation`, usa `graphql/*-query.service.ts` y `*-mutation.service.ts`. Es la misma idea con otra convención de nombres — al buscar operaciones, tenelo en cuenta.

## Envío manual

`CrearNotificacionComponent` + `enviarNotificacionPersonalizada` permiten mandar una notificación a mano a usuarios elegidos (`obtenerUsuariosActivos` los lista).

## Push

La entrega llega por FCM (`PushNotificationsService`, ver [`../infraestructura/services.md`](../infraestructura/services.md)). `initPush()` registra el dispositivo y `syncTokenToBackend()` asocia el token al usuario tras el login.

> ⚠️ **El token FCM se sincroniza al registrar la sesión**, en `LoginService.registrarSesionActiva()`. Si esa llamada falla, el dispositivo queda sin recibir push aunque el usuario esté logueado correctamente.

## Modelos duplicados

`models/usuario.model.ts` y `models/persona.model.ts` son **versiones locales** de los modelos de `domains/personas/`.

> ⚠️ **Gotcha — hay dos `Usuario` distintos en el proyecto.** Este módulo define el suyo con solo los campos que necesita. No los mezcles: un `Usuario` de `domains/` no es asignable a este sin conversión. Anotado en [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

## Al trabajar en este módulo

1. "Leída" es por destinatario, no por notificación.
2. Los comentarios son un árbol (`comentarioPadre`).
3. Respetá `esObligatorio` en preferencias.
4. `data` es string: parsealo defensivamente.
5. Las operaciones GraphQL usan la convención `*-query.service.ts`, no la del resto del repo.
