# Autenticación y sesión

Todo el flujo vive en `src/app/services/login.service.ts` (370 líneas). **La autenticación no usa GraphQL** — es REST directo contra el central.

## Endpoints REST

Todos contra `http://{serverIp}:{serverPort}` (ver [configuracion-servidor.md](configuracion-servidor.md)):

| Método | Endpoint | Body / Params | Devuelve |
|---|---|---|---|
| `POST` | `/login` | `{ nickname, password }` | `{ token, usuarioId, sucursal }` |
| `POST` | `/login/biometric` | `{ biometricToken, idDispositivo }` | `{ token, usuarioId, sucursal }` |
| `GET` | `/login/biometric-owner/{idDispositivo}` | — | `number` (id de usuario) o `null` |

## Estado en `localStorage`

| Clave | Contenido | Escrita por |
|---|---|---|
| `token` | Token de sesión, usado en el header `Authorization: Token <token>` | `login()`, `biometricLogin()` |
| `usuarioId` | Id del usuario logueado | ídem |
| `deviceId` | UUID generado una vez por instalación | `getOrCreateDeviceId()` |
| `serverIp` / `serverPort` | Servidor destino | `app.module.ts`, diálogo de cambio de IP |
| `pushToken` | Token FCM | `PushNotificationsService` |

`sessionStorage['justLoggedOut'] = 'true'` se setea en `logOut()` para que el arranque sepa distinguir "recién cerró sesión" de "nunca inició".

> ⚠️ **Gotcha — `logOut()` guarda el string `"null"`, no `null`.** `login.service.ts:240-241` hace `localStorage.setItem('token', null)`, que persiste la cadena `"null"`. Todo chequeo debe compararse contra ambos casos: `token == null || token === 'null'`. El mismo patrón ya está contemplado en `app.module.ts:53-67` para `serverIp`.

## Flujo de login por contraseña

`login(nickname, password)` — `login.service.ts:156`

1. Abre loading "Entrando al sistema....".
2. `POST /login`.
3. Si viene `token`: lo guarda, guarda `usuarioId`, setea `mainService.sucursalActual` desde `res['sucursal']`.
4. Busca el usuario completo con `usuarioService.onGetUsuarioParaLogin(usuarioId)`.
5. Publica el usuario en `mainService.usuarioActual` y emite `mainService.authenticationSub.next(true)`.
6. Llama `registrarSesionActiva(usuario)`.
7. **Regla de negocio:** si la contraseña ingresada es literalmente `'123'` (`login.service.ts:193`), abre `CambiarContrasenhaDialogComponent` como popover obligatorio. Si el usuario la cambia, hace `window.location.reload()`.

`'123'` es la contraseña por defecto con que se dan de alta los usuarios: el chequeo fuerza el cambio en el primer ingreso. Es una comparación literal en el cliente, no una marca del backend.

### Normalización de errores

`normalizeLoginError()` (`:317`) traduce la respuesta HTTP a un mensaje para el usuario:

- **401**, o mensaje que contenga `contrase`, `credencial`, `bad credential`, `usuario no existe`, `unauthorized` → *"Usuario o contraseña incorrectos. Verifique e intente nuevamente."*
- **status 0** (sin respuesta) → *"Error de conexión con el servidor. Verifique la configuración."*
- Cualquier otro → *"No se pudo iniciar sesión por un error del servidor. Intente nuevamente."*

La distinción existe para que el usuario sepa si el problema es su contraseña o el servidor caído — un caso frecuente en LAN de sucursal.

## Login biométrico

`biometricLogin(biometricToken)` — `login.service.ts:250`

Manda `{ biometricToken, idDispositivo }` a `/login/biometric`. El backend asocia el dispositivo con un usuario, de modo que la biometría es **por dispositivo**, no por credencial.

`getBiometricOwnerUserId()` (`:300`) consulta qué usuario tiene registrada la biometría en este dispositivo — sirve para mostrar el nombre en la pantalla de login antes de autenticar. Devuelve `null` ante cualquier error (no propaga).

El diálogo biométrico nativo lo dispara `FingerprintAuthService`; el reconocimiento facial es un mecanismo aparte, ver [`../infraestructura/services.md`](../infraestructura/services.md).

## Sesión activa (`InicioSesion`)

`registrarSesionActiva()` — `login.service.ts:107`

Registra la sesión en el backend con: usuario, sucursal actual, `idDispositivo`, `token` de push, tipo de dispositivo (`IOS` / `ANDROID`, resuelto por `DeviceDetectorService`) y `creadoEn`.

**Regla de reuso:** si el usuario ya tenía una `inicioSesion` con el **mismo `idDispositivo`**, reutiliza ese `id` y conserva la `horaInicio` original en vez de crear un registro nuevo (`:117-125`). Así el historial no se llena de sesiones duplicadas por reinicios de app.

Tras guardar, sincroniza el token FCM con `pushNotificationsService.syncTokenToBackend()`.

`cerrarSesionActiva()` (`:135`) cierra la sesión seteando `horaFin` y `token = null`. Si no hay `id` o `sucursal`, sale sin hacer nada. **Nunca rechaza**: resuelve la promesa tanto en `next` como en `error` (`:150-151`), para que un backend caído no bloquee el logout.

## Verificación de sesión al arrancar

`isAuthenticated()` (`:64`) devuelve un `Observable<Usuario>`:

- Si no hay `usuarioId` en `localStorage` → emite `null`.
- Si hay → consulta `onGetUsuarioParaLogin(id)` y, si responde, repuebla `mainService.sucursalActual` y `usuarioActual` y emite `true` en `authenticationSub`.

> ⚠️ **Gotcha — la sesión se valida contra el servidor, no contra el token.** Si el central está inaccesible, la consulta nunca responde y el observable **no emite nada** (ni `null`): la app queda esperando. El token en sí no se verifica en el cliente ni tiene expiración chequeada localmente.

## Logout

`logOut()` (`:238`), en orden:

1. `cerrarSesionActiva()` (espera al backend, tolerante a fallo)
2. Borra `token` y `usuarioId` (con el problema del string `"null"` descrito arriba)
3. `marcacionService.limpiarSucursalPersistida()` — la sucursal elegida para marcación no debe sobrevivir al cambio de usuario
4. `sessionStorage['justLoggedOut'] = 'true'`
5. Limpia `usuarioActual` local y de `MainService`, emite `authenticationSub.next(false)`
6. Navega a `/`

## Seguridad — estado conocido

- Credenciales y token viajan por **HTTP plano**.
- El token vive en `localStorage`.
- Varias queries de usuario traen el campo `password` en texto plano.

Auditado en [`REPORTE_VULNERABILIDADES.md`](../../../../REPORTE_VULNERABILIDADES.md) (2026-04-02); la remediación es transversal a los 4 componentes y está en curso. **Antes de tocar código de auth, leé ese reporte.**
