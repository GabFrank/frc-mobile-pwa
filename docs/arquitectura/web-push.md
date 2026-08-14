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

Los cuatro valores del bloque `firebaseWeb` de `environment.ts` salen de la
consola de Firebase, proyecto `bodega-franco-frc` (número `170136643206`):
`apiKey` y `appId` de la app Web, y la clave pública VAPID del certificado Web
Push (Configuración → Cloud Messaging → *Certificados push web*).

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

Los pasos 1 a 3 se ejecutaron el 2026-08-14 contra el central local. Los pasos
4 y 5 no: mandar una notificación de verdad y probar en un iPhone quedan para
una pasada manual. Ver el bloque 38 de
[`PLAN_TESTEO_MANUAL.md`](../PLAN_TESTEO_MANUAL.md).
