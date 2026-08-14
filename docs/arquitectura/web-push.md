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

## Lo que falta, y por qué no lo puede hacer el código

Dos acciones en la **consola de Firebase**, sobre el proyecto
`bodega-franco-frc` (número `170136643206`):

1. **Registrar una app Web.** Hoy el proyecto tiene registradas las dos apps
   Android (`com.sistemasinformaticos.frc` y `com.system.frc`) y **ninguna
   web**. De ahí salen `apiKey` y `appId`.
2. **Generar el certificado Web Push** (Configuración → Cloud Messaging → Web
   Push certificates). De ahí sale la **clave pública VAPID**.

Los tres valores van a `src/environments/environment.ts` y
`environment.prod.ts`, en el bloque `firebaseWeb`. `projectId` y
`messagingSenderId` ya están puestos: salen de
`android/app/google-services.json` del repo `frc-mobile` y son los mismos para
todas las plataformas del proyecto.

Mientras estén vacíos, la app **no ofrece** activar las notificaciones y dice
que todavía no están configuradas. Lo que no hace es pedir el permiso del
navegador para después no poder registrar nada — ese permiso, una vez
denegado, no se vuelve a pedir en ese dispositivo.

## Decisiones que no se ven en el código

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

## Cómo probarlo cuando estén las claves

1. Completar los tres valores en `environment.ts`.
2. `npm run build` y servir sobre **HTTPS** o `localhost` — sin contexto
   seguro no hay service worker ni push.
3. Mi cuenta → *Avisos con la app cerrada* → **Activar**. El navegador pide
   permiso; al conceder, la fila pasa a «Activados en este dispositivo».
4. Verificar en la base que `inicio_sesion` tiene el token para ese
   `id_dispositivo` (`frc.idDispositivo` en `localStorage`).
5. Cerrar la app **por completo** y disparar una notificación desde el central.
6. En iPhone, repetir con la PWA **instalada**: sin instalar no va a aparecer
   ni el botón.

Los casos están escritos en el bloque 38 de
[`PLAN_TESTEO_MANUAL.md`](../PLAN_TESTEO_MANUAL.md), marcados como **no
ejecutados**: sin las claves no hay forma de correrlos.
