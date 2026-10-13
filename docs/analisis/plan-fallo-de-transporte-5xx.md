# Plan — un 5xx del central se trata como credencial rechazada (#81)

Rama: `fix/datos-fallo-de-transporte-5xx` (desde `develop`, `3c587f0`). Solo `mobile-pwa`.

## El problema, reproducido

`esFalloDeTransporte()` (`core/graphql/datos.service.ts`) decide si un fallo es de transporte
(red caída, 5xx) o del servidor rechazando algo (401/403). La usa `SesionService` para dos cosas:
reintentar al restaurar la sesión, y elegir el mensaje del login.

Un test con Apollo real (`HttpLink` + `HttpTestingController`, la query `usuarioLogin` por
`DatosService.porId`) da esto hoy:

| Respuesta | Error que llega | `esFalloDeTransporte` | Debería |
|---|---|---|---|
| 503 | `ErrorDatos` «Response not successful: Received status code 503», causa: otro `ErrorDatos` sin causa | `false` | `true` |
| 401 | ídem con 401 | `false` | `false` |
| sin respuesta (status 0) | `ErrorDatos` «Http failure response for …: 0 », ídem | `false` en el test | `true` |

El issue acertó el síntoma y erró la causa. No alcanza con leer `statusCode`: **el status no llega
nunca a la función**.

1. Todas las operaciones usan `errorPolicy: 'all'` (`gql-base.ts`). Con esa política Apollo Client
   4 no rechaza: entrega el fallo de red en `result.error`, y `normalizar()` lo pasa a `errors`.
2. `DatosService.ejecutar()` ve `res.errors` y lanza `new ErrorDatos(mensajes)` **sin causa**. El
   `ServerError` original, con su `statusCode`, se pierde ahí.
3. El `catchError` de la misma función envuelve ese `ErrorDatos` en otro, así que `causa` es un
   `ErrorDatos` sin `status`.
4. `esFalloDeTransporte` cae entonces a la expresión regular sobre el mensaje. La rama por
   `status` es código muerto para toda operación GraphQL.

El caso de red funciona en el navegador solo porque el XHR de Angular rellena
`statusText = 'Unknown Error'` y la regex busca `unknown error`. En el test el `statusText` viene
vacío y da `false`: la detección depende de un texto, no del status.

Consecuencias en producción con el central respondiendo 502/503 (deploy, reinicio, nginx sin
backend):

- `SesionService.restaurar()` no reintenta y **cierra la sesión**; el cajero vuelve al login. Es lo
  contrario de lo que afirma `docs/arquitectura/autenticacion-sesion.md`.
- El login dice «no se pudo cargar tu cuenta. Avisá a sistemas» en vez de «no se pudo contactar al
  servidor».

## Fases

### Fase 1 — que la causa llegue, y clasificar por ella

Todo en `core/graphql/datos.service.ts`:

- `ejecutar()`, rama `res.errors`: `new ErrorDatos(mensajes, res.errors[0])`. `GqlResult.errors`
  ya trae los objetos originales (`normalizar()` hace `[r.error]`), solo estaban tipados como
  `{message}`.
- `ejecutar()`, `catchError`: si lo que llega ya es un `ErrorDatos`, se relanza tal cual después
  de notificar, en vez de envolverlo de nuevo. El mensaje no cambia.
- `esFalloDeTransporte()`, en este orden:
  1. si la causa es un `CombinedGraphQLErrors` (error de GraphQL con HTTP 200) → `false`, sin mirar
     el texto: hoy un mensaje del central que diga «unknown error» se clasificaría como transporte;
  2. si la causa trae `statusCode` (`ServerError`) o `status` → transporte si es 0 o ≥ 500;
  3. si es un `TimeoutError` de rxjs → transporte;
  4. si no hay número, por el texto. **El status 0 nunca llega como número**: `apollo-angular`
     solo arma `ServerError` para status ≥ 300 y el resto lo convierte en `new Error(mensaje)`. Para
     la red caída el texto es el único camino, así que la regex se ancla:
     `^Http failure response for .+: 0(?:\s|$)`, más `failed to fetch|networkerror|err_connection`.
     Sale `unknown error` suelto.
- `SesionService.cargarUsuario()`: `timeout` de 10 s por intento. Hoy no hay ninguno; con
  reintentos, un proxy que tarda 60 s en dar 504 pasaría de 60 s a ~3 min de pantalla en blanco
  (el initializer espera a `restaurar()`). Con el tope son ~32 s como máximo.
- `mensajeSesionNoCargada()`: en el caso de transporte, si el motivo trae un status del servidor
  (`status code 5xx`) se conserva como «Detalle:». Un 500 no se arregla «revisando la conexión» y
  sin el número no se distingue de un wifi caído.

Orden: primero el test (rojo en 503 y en red), después el fix.

Tests:

- **Nuevo `core/graphql/fallo-de-transporte.spec.ts`**, con Apollo real de punta a punta: 500, 502,
  503 y 504 → transporte; 401 y 403 → no; sin respuesta → transporte; un error de GraphQL con HTTP 200
  → no, aunque su mensaje diga «unknown error». Verifica `HttpTestingController` y limpia en
  `afterEach` (los specs comparten estado: `isolate: false`). No se usa un objeto plano con `status`: un stub así es justo lo que escondió este defecto.
- `datos.service.spec.ts`: un `ErrorDatos` no se envuelve dos veces y conserva la causa; el
  mensaje que ve el usuario es el mismo de antes.
- `sesion.service.spec.ts`: `restaurar()` reintenta ante un fallo de transporte y no cierra la
  sesión si un reintento sale bien; ante un 401 no reintenta. Hoy esa lógica no tiene ningún test. Con timers falsos (las esperas
  suman 1,6 s) y `vi.useRealTimers()` en `afterEach`; el doble de `porId` falla con un `ErrorDatos`
  cuya causa es un `ServerError` real, no con `new Error('401')`.
- `mensaje-sesion-no-cargada.spec.ts`: transporte con status 5xx conserva el detalle; red pura no.

### Fase 2 — documentación

- `docs/arquitectura/autenticacion-sesion.md`: la tabla 401/403 vs 0/5xx ya dice lo correcto; se
  agrega de dónde sale el status y por qué no se clasifica por el texto.
  Y se corrige lo que promete de más: tras los tres intentos la sesión **sí** se cierra, y al
  llegar al login desde `restaurar()` no se muestra ningún motivo (solo se muestra al entrar).
- `docs/PATRONES.md`, si tiene sección de errores: `ErrorDatos.causa` es el error original.
- `docs/PLAN_TESTEO_MANUAL.md`: caso nuevo en el bloque 1, «El central responde 503 al
  arrancar»; tabla de totales. `CLAUDE.md`: conteo de tests.
- Este plan se borra en el commit final.

## Datos nuevos

Ninguno. Sin migración, sin cambio de GraphQL ni del central, sin claves de almacenamiento.

## Qué queda sin verificar

- Un 502/503 real de nginx en bodega/farmacia: el test lo simula con `HttpTestingController`. Se
  podría verificar a mano apagando el central local con la PWA abierta y recargando (eso da status
  0, no 503); un 503 de verdad necesita un proxy delante.
- CORS: un 502 de nginx **sin** encabezados CORS el navegador lo entrega como status 0, no como
  502. Los dos caen en «transporte», así que el resultado es el mismo, pero el camino no.
- Otros llamadores que hoy reciben el `ErrorDatos` doble: ninguno lee `.causa` salvo
  `esFalloDeTransporte` (`grep`), pero las pantallas muestran `error.message`, que no cambia.
- **PWA instalada, sin red:** el service worker de Angular responde un **504 sintético** cuando el
  `fetch` falla (`ngsw-worker.js`, `safeFetch`). Si el POST a `/graphql` pasa por ahí, en la app
  instalada un corte de wifi llega como 504 y no como status 0 — o sea que hoy cierra la sesión.
  El fix lo cubre igual (≥ 500), pero hay que verlo con build de producción y SW activo.
- **Token inválido → el central responde 500, no 401** (verificado contra el alpha local: sin
  token 401, con token basura 500). Con el fix un token corrupto se reintenta tres veces y recién
  después se cierra la sesión; el resultado final es el mismo que hoy, 1,6 s más tarde. Es poco
  probable (los tokens no vencen). El detalle del lado del central se le pasa a Gabriel por privado.

## Fuera de alcance

- Mostrar en el login el motivo cuando se llega desde `restaurar()` (hoy no se muestra nada).
- `mensajeDeError()` muestra «Response not successful: Received status code 503» en inglés en los
  avisos de toda la app.

## Auditoría del plan (paso 5)

Dos auditores, sin verse. Ningún bloqueante; todo verificado contra el código antes de aplicarlo.

| Hallazgo | Qué se hizo |
|---|---|
| A y B: el status 0 nunca trae número; la regex es el camino real y hay que anclarla | Aplicado |
| A y B: la regex corría sobre errores GraphQL con HTTP 200 | Aplicado: `CombinedGraphQLErrors` → `false` primero |
| A: el service worker convierte «sin red» en 504 | Caso 504 en el spec; anotado en «sin verificar» |
| B: los reintentos alargan el arranque en blanco si el proxy tarda en dar 5xx | Aplicado: `timeout` de 10 s por intento |
| B: un 500 pierde el detalle en el mensaje del login | Aplicado |
| B: el doc promete que la sesión no se cierra, y se cierra tras tres intentos | Aplicado (fase 2) |
| A y B: tests de `restaurar()` con `ServerError` real y timers falsos; limpiar estado global | Aplicado |
| B: token inválido da 500 en el central | Anotado; no cambia el resultado final. Va por privado |
| A: borrar el spec exploratorio | Aplicado |
