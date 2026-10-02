# Notificaciones push

Avisos que llegan **con la app cerrada**. Es lo último que faltaba de la
paridad con `frc-mobile`, y lo único que no se puede terminar desde el código.

## Lo que ya está

**El central no necesita ningún cambio.** Esto se verificó leyendo el código,
no asumiendo:

| Pieza | Dónde | Estado |
|---|---|---|
| Envío web | `fmc/service/FCMService.java` — arma el mensaje con `WebpushConfig` y `WebpushNotification` | listo |
| Registro del token | mutación `actualizarTokenFcm(tokenFcm, idDispositivo)` | listo |
| Tipo de dispositivo | enum `TipoDispositivo` ya tiene `WEB` y `WEB_MOBILE` | listo |
| Limpieza de tokens muertos | `FCMService.clasificarError` trata `THIRD_PARTY_AUTH_ERROR` —el rechazo típico de una suscripción webpush— como token inválido | listo |
| Cliente | `core/notificaciones/push.service.ts` + la fila «Avisos con la app cerrada» en Mi cuenta | listo |

## Las claves, y por qué están en el repo

Los valores viven en **`core/notificaciones/firebase.config.ts`**, no en
`environment.ts`: el proyecto de Firebase es **uno solo** para alpha, beta y
producción, así que no cambia con el canal y no es configuración de entorno.
Repetirlo en cada archivo de entorno solo agrega copias que hay que mantener
sincronizadas a mano.

Salen de la consola de Firebase, proyecto `bodega-franco-frc` (número
`170136643206`): `apiKey` y `appId` de la app Web, y la clave pública VAPID del
certificado Web Push (Configuración → Cloud Messaging → *Certificados push
web*).

**Ninguno es secreto.** La `apiKey` web y la VAPID **pública** viajan dentro
del bundle de cualquier PWA: quien abra el DevTools de la app las ve. Son
configuración, no credenciales. Lo que sí es secreto es el service account que
usa el central para *mandar* (`FCMInitializer`), y ese no vive en este repo.

A la `apiKey` la protege la **restricción por sitio** en Google Cloud Console
(Credenciales → `Browser key` → Sitios web), no el esconderla. Pendiente
cargar ahí los dominios de la PWA cuando existan.

Si alguno de los valores se vacía, la app **no ofrece** activar las
notificaciones y dice que no están configuradas. Lo que no hace es pedir el
permiso del navegador para después no poder registrar nada — ese permiso, una
vez denegado, no se vuelve a pedir en ese dispositivo.

> ⚠️ **`google-services.json` no sirve para saber si hay una app Web.** Ese
> archivo solo lista clientes Android; una app web registrada no aparece ahí.
> Leerlo al revés fue lo que hizo creer que faltaba registrarla.

## Decisiones que no se ven en el código

### El token va atado al `idDispositivo` de la sesión

Y esta es la parte que se rompe silenciosamente si se hace a medias.

El central resuelve `actualizarTokenFcm` buscando la sesión activa por
`(usuario, idDispositivo)`. **Si no la encuentra, no falla**: escribe el token
en *la primera sesión abierta del usuario, sea del dispositivo que sea*.

La PWA no registraba sesión, así que ese id nunca coincidía. Verificado contra
la base local: el token de un Chrome de escritorio terminó escrito sobre una
fila `WEB` de otro navegador, y con otro orden de filas habría caído sobre la
sesión **IOS** del mismo usuario — el iPhone dejando de recibir avisos y este
equipo recibiéndolos dos veces, sin que nadie toque nada.

`SesionDispositivoService` registra la sesión al cargar el usuario, y
`idDeDispositivo()` es compartido por las dos mitades. `frc-mobile` lo tiene
así desde siempre (`login.service.ts` → `registrarSesionActiva`); la PWA se
había quedado solo con la segunda mitad.

### Es un token de FCM, no una suscripción cruda

`SwPush.requestSubscription()` de Angular devuelve un `PushSubscription` del
estándar Web Push. **El central no sabe mandarle nada a eso**: `sendToToken`
espera un token de FCM.

Guardar el JSON de la suscripción con `actualizarTokenFcm` haría que todo
pareciera funcionar —permiso concedido, mutación en verde, fila en
`inicio_sesion`— y no llegaría ni una notificación. Por eso se usa el SDK de
Firebase para acuñar el token, aunque el nombre de la tarea diga «Web Push».

La alternativa —Web Push nativo con VAPID de punta a punta— **sí** obligaría a
tocar el central: haría falta una librería de web-push del lado servidor y un
par de claves propio. No se tomó ese camino porque el que ya existe funciona y
no toca un backend que está en producción.

### Comparte el service worker de Angular

Firebase busca por defecto un `firebase-messaging-sw.js` propio. Registrar un
segundo service worker sobre `ngsw-worker.js` es pelearse por el control de la
página: gana uno y el push queda en el que perdió. Se le pasa la registración
que ya está activa.

### Tocar la notificación no navega, y el arreglo es del central

Verificado el 2026-08-14: el aviso **llega y se muestra** —título, cuerpo y
`requireInteraction`— pero la notificación mostrada tiene `data: null`, así
que tocarla no hace nada. Con la app cerrada, ni siquiera la abre.

`ngsw` arma la notificación copiando campos de **`payload.notification`**, y
abre lo que encuentre en `notification.data.onActionClick`:

```js
const onActionClick = notification?.data?.onActionClick?.[notificationAction];
switch (onActionClick?.operation) { /* openWindow, navigate… */ }
```

El central manda el destino en el `data` **del mensaje**, que es hermano de
`notification`, no hijo. Nunca llega al service worker como
`notification.data`.

El arreglo va en `FCMService.getWebpushConfig`, anidando el destino dentro del
`WebpushNotification`:

```java
.putCustomData("data", Collections.singletonMap("onActionClick",
    Collections.singletonMap("default", Map.of(
        "operation", "navigateLastFocusedOrOpen",
        "url", path))))
```

**No hay forma de resolverlo solo del lado del cliente.** La PWA no puede
inventar un dato que nunca recibió, y agregar un segundo manejador de `push`
al service worker mostraría el aviso dos veces.

### El SDK entra por `import()` dinámico

No tiene por qué pesar en el arranque de quien nunca activa las
notificaciones. Es el mismo criterio que ZXing en el escáner.

### iOS necesita la app instalada

Safari expone `PushManager` recién cuando la PWA corre desde la pantalla de
inicio (iOS 16.4+). Por eso hay un estado `requiereInstalar` en vez de un
botón que falla: en Safari sin instalar, `Notification` ni siquiera existe.

Es la misma dependencia que tiene el bloque de instalación en Mi cuenta, y la
razón de que las dos cosas vivan juntas.

## Cómo probarlo

⚠️ **`ng serve` no sirve**: el service worker está en `enabled: !isDevMode()`,
y sin service worker no hay dónde recibir el aviso. Hay que servir un build.

```bash
npm run build
cd dist/mobile-pwa/browser && python3 -m http.server 4400 --bind 127.0.0.1
```

`localhost` es contexto seguro, así que el service worker y el push funcionan
sin HTTPS. Ojo que ese servidor estático **no hace fallback de SPA**: si se
recarga una ruta profunda sin el service worker activo, da 404. Entrar por
`/`.

1. Entrar y mirar que `inicio_sesion` tenga una fila para el
   `frc.idDispositivo` de `localStorage`, con `tipo_dispositivo` `WEB` o
   `WEB_MOBILE`. **Esto va primero**: sin la fila, el token del paso 3 se
   escribe en la sesión de otro aparato.
2. Mi cuenta → *Avisos con la app cerrada* → **Activar**. El navegador pide
   permiso; al conceder, la fila pasa a «Activados en este dispositivo».
3. Verificar que el token quedó **en esa misma fila**, no en otra del mismo
   usuario.
4. Cerrar la app **por completo** y disparar una notificación desde el central.
5. En iPhone, repetir con la PWA **instalada**: sin instalar no va a aparecer
   ni el botón.

Los pasos 1 a 4 se ejecutaron el 2026-08-14 contra el central local: el aviso
llegó y se mostró. El paso 5 —iPhone— no. Tocar la notificación **no
funciona todavía**; ver arriba. El bloque 38 de
[`PLAN_TESTEO_MANUAL.md`](../PLAN_TESTEO_MANUAL.md).
