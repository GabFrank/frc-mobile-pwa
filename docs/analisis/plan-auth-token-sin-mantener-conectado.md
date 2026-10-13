# Plan — el login falla con 401 si «Mantenerme conectado» está apagado

Rama: `fix/auth-token-sin-mantener-conectado` (desde `develop`, `f1c2bfe`). Solo `mobile-pwa`.

## El problema

Reporte: al entrar, la pantalla de login muestra
«Entraste, pero no se pudieron cargar tus datos: Response not successful: Received status code 401».

Entrar son dos llamadas: `POST /login` (devuelve el token) y la query GraphQL `usuarioLogin`
(trae los roles). La primera sale bien; la segunda vuelve 401.

Causa leída en el código (no reproducida todavía en navegador):

- `guardarSesion()` guarda el token en `localStorage` **o** en `sessionStorage`, según
  «Mantenerme conectado» (`core/auth/auth.tokens.ts`, `almacenDeSesion()`).
- El link de Apollo que arma `Authorization: Token <t>` lee **solo** `localStorage`
  (`app.config.ts:50`).

Con la casilla apagada la query sale sin `Authorization` y el central responde 401. Ninguna
operación GraphQL puede funcionar en ese modo: la opción está rota desde que existe (`6f256e3`).

Mismo origen, segundo defecto: `ServerConfigService.cambiarServidor()` borra el token solo de
`localStorage` (`server-config.service.ts:48-49`). Con la casilla apagada, el token de la
instancia anterior sobrevive al cambio de servidor.

Y el texto: «Entraste, pero…» afirma algo que la pantalla desmiente, y a continuación pega el
mensaje crudo de Apollo.

## Fases

### Fase 1 — el token se lee y se borra de donde realmente vive

- **Nuevo `core/auth/enlace-sesion.ts`**: `crearEnlaceDeSesion()` devuelve el `SetContextLink`
  que hoy está inline en `app.config.ts`, leyendo con `leerTokenEnSesion()` (que ya mira los dos
  almacenes y ya descarta la cadena `"null"`). Se extrae para poder probarlo: `app.config.ts` no
  tiene spec.
- `app.config.ts`: usa `crearEnlaceDeSesion()`; deja de importar `AUTH_TOKEN_KEY`.
- `server-config.service.ts`: `cambiarServidor()` llama `limpiarSesion()` en vez de los dos
  `localStorage.removeItem`. `auth.tokens.ts` es un módulo de funciones sin dependencias, así que
  no reaparece el ciclo con `AuthService` que el comentario actual evita.

Orden, para que el rojo sea por la razón correcta: (1) extraer el link **verbatim**, todavía con
`localStorage.getItem`; (2) escribir los tests y verlos fallar; (3) aplicar el fix.

Se exporta también el setter puro (`contextoConSesion`), que es lo que se prueba: no hace falta
montar Apollo.

Los specs corren con `isolate: false` (default del builder de Angular) y `sessionStorage` tiene
prioridad al leer: un token olvidado ahí contamina a los demás archivos. Los specs nuevos limpian
los dos almacenes antes y después, y los que hoy escriben la sesión y solo limpian `localStorage`
(`auth.service`, `sesion.service`, `sesion-y-roles`, `server-config`, `datos.service`) pasan a
limpiar los dos.

Comentarios que quedan viejos y se corrigen: `server-config.service.ts:46-47` y
`sesion.service.ts:90`.

Tests:

- `enlace-sesion.spec.ts`: manda `Authorization: Token <t>` con el token en `sessionStorage`
  (**el bug**); ídem en `localStorage`; no manda el encabezado sin token ni con la cadena `"null"`;
  conserva los encabezados que ya traía el contexto.
- `server-config.service.spec.ts`: cambiar de servidor borra la sesión que vive en
  `sessionStorage` (**el bug**); el `beforeEach` pasa a limpiar también `sessionStorage`.

### Fase 2 — el mensaje del login

- **Nuevo `pages/login/mensaje-sesion-no-cargada.ts`**: función pura
  `mensajeSesionNoCargada(falloDeRed, motivo)`; `login.page.ts` la usa.
  - Red (sin cambios): «Tus datos son correctos, pero no se pudo contactar al servidor. Revisá la
    conexión y probá de nuevo.»
  - Resto: «Tu usuario y contraseña son correctos, pero no se pudo cargar tu cuenta. Avisá a
    sistemas.» y, si hay motivo, « Detalle: <motivo>».
- **El detalle técnico se conserva en pantalla**, al final y rotulado. El comentario de
  `login.page.ts` y el de `SesionService.registrarFallo()` documentan por qué está: cuando la query
  de sesión pedía un campo inexistente, la pantalla sin motivo no dejaba diagnosticar. Quien recibe
  la captura del cajero es sistemas, y la consola del teléfono no la ve nadie.
- Test `mensaje-sesion-no-cargada.spec.ts`: los tres casos, y que ninguno diga «Entraste».

### Fase 3 — documentación

- `docs/arquitectura/autenticacion-sesion.md`: en «Dos elecciones distintas», la regla «el token
  se lee con `leerTokenEnSesion()`, nunca con `localStorage.getItem`» y por qué.
- `docs/PLAN_TESTEO_MANUAL.md`, bloque 1: caso nuevo «Entrar sin "Mantenerme conectado"»; el 1.6
  y el 6.5 dejan de asumir Local Storage; tabla de totales (bloque 1: 8 → 9; total 710 → 711).
- `CLAUDE.md`: cantidad de archivos de test y de tests.
- Este plan se borra en el commit final.

## Datos nuevos

Ninguno: no hay campo, columna ni clave de almacenamiento nueva. Sin migración, sin cambio de
GraphQL, sin cambio en el central.

## Qué queda sin verificar

- **Que esta sea la causa del reporte.** No se sabe si quien lo vio tenía la casilla apagada. Se
  verifica reproduciendo en `localhost:4300` contra un central: casilla apagada → 401 antes del
  fix, entra después. Si el reporte fue con la casilla **prendida**, hay otra causa (el central
  rechazando un token recién emitido) y este fix no la cubre.
- **Para confirmarlo con quien lo reportó: mirar `localStorage['frc.mantenerConectado']`**, no
  preguntar por la casilla. La preferencia se guarda antes del POST aunque el login falle, y la
  casilla arranca desde ella: quien la destildó una vez queda en `'false'` sin tocar nada más.
- Dos pestañas con preferencias distintas: `guardarSesion()` limpia el `localStorage` compartido,
  así que entrar en la pestaña B con la casilla apagada deja a la A sin token pero con el usuario
  en memoria. Ya pasaba (el login fallido de B limpiaba igual); ahora B además entra.
- Con la casilla apagada, una ventana nueva (tocar un push, iOS matando la app) arranca sin sesión.
  Es lo que la opción promete, pero recién ahora es alcanzable.
- Safari / iOS real: `sessionStorage` en una PWA instalada en iOS no se probó.
- Otros lectores del token fuera de Apollo: hoy no hay (`grep AUTH_TOKEN_KEY|leerTokenEnSesion`),
  y las suscripciones por WebSocket no están implementadas.

## Auditoría del plan (paso 5)

Dos auditores, sin verse. Ningún bloqueante. Todo verificado contra el código antes de aplicarlo.

| Hallazgo | Qué se hizo |
|---|---|
| A y B: specs con `isolate: false` que no limpian `sessionStorage` | Aplicado (fase 1) |
| B: «falla con el código viejo» no era demostrable con un archivo que no existe | Aplicado: extraer verbatim → rojo → fix |
| A: el caso 6.5 del plan manual asume Local Storage | Aplicado (fase 3) |
| A: dos comentarios quedan viejos | Aplicado |
| B: la reproducción debe mirar la clave, no la casilla | Aplicado («sin verificar») |
| A: dos pestañas; ventana nueva sin sesión | Anotado («sin verificar»); no cambia el fix |
| B: mantener el detalle técnico en pantalla | Ya estaba en el plan |
| B: `esFalloDeTransporte` no reconoce un 5xx de Apollo — `ServerError` no trae `status`, así que un 502/503 al cargar el usuario cae en «Avisá a sistemas» y `restaurar()` no reintenta | **Fuera de alcance**: es otro defecto, preexistente. Se le avisa a Franco |
| B: si `usuarioId` es `null` tras el login, el motivo mostrado es el del intento anterior | Fuera de alcance: inalcanzable salvo respuesta sin `usuarioId`, que `login()` ya rechaza |
