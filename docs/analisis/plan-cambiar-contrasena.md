# Plan — Cambiar contraseña desde «Mi cuenta»

## Qué y por qué

Quien entra con la contraseña de alta (`123`) ve «Cambiala desde tu cuenta», pero
**Mi cuenta no tenía dónde**. `frc-mobile` lo resolvía con un diálogo que saltaba
al ingresar; acá se pide lo contrario: un apartado fijo en **Mi cuenta** que
lleve a una pantalla de cambio, sin diálogo en el login.

## El backend ya alcanza

Solo cliente. El central no se toca.

- `saveUsuario(usuario: UsuarioInput!)` ya deja que **cualquiera cambie su propia
  clave** sin `EDITAR USUARIOS`: la rama «soloPropio» de
  `UsuarioGraphQL.exigirPermisoParaGuardar` conserva nickname, persona, creador y
  `activo` de la fila guardada. Está desde `e9d6a7e7` (`v4.7.0-alpha.225`,
  `v4.8.0-beta.12`, `v4.17.0`): alpha, farmacia y bodega lo tienen. **Mínimo:
  alpha.225 / beta.12 / v4.15.0** — un central anterior a `9994f616`
  (`conservarLoQueNoVino`) acepta el guardado pero deja `email` y `creadoEn` en
  null.
- ⚠️ **Con `EDITAR USUARIOS` el resolver no conserva nada**: mapea el input
  entero. Un input con solo `{ id, password }` revienta en
  `entity.getNickname().toUpperCase()` (NPE), y uno sin `personaId` o
  `usuarioId` borraría la persona o el creador. Por eso la pantalla **lee el
  usuario fresco** (`usuario(id)` con `nickname`, `activo`, `persona.id`,
  `usuario.id`) y manda el input **completo**, igual que `toInput()` de
  `frc-mobile`.
- ⚠️ **No usar `DatosService.guardar`**: completa `usuarioId` con el usuario en
  sesión, y en `UsuarioInput` ese campo es **el creador** del usuario. Va
  `mutar` con el input armado.
- El central guarda la clave en mayúsculas y el login compara sin distinguir
  mayúsculas (`TokenController`): no hay que normalizar en el cliente.
- El token no se valida contra la clave guardada: **la sesión abierta sigue
  valiendo** después del cambio.

## Fases

Una sola fase (commit + push de `feature/cuenta-cambiar-contrasena`).

1. `graphql-query.ts` + `usuarioParaCambioClave.ts`: query
   `data: usuario(id)` con los campos que el input necesita.
2. `pages/cuenta/contrasena.util.ts`: `validarNuevaContrasena(nueva, repetida)`
   → mensaje o `null`. Reglas: obligatoria, sin espacios al borde, al menos 3 caracteres (como
   `frc-mobile`), distinta de `123` (si no, el aviso del login sigue saliendo),
   las dos iguales. Y `inputCambioClave(usuario, clave)` → `UsuarioInput`
   completo.
3. `pages/cuenta/cambiar-contrasena.page.ts`, ruta `cuenta/contrasena` (literal,
   antes de cualquier `:id`; hoy no hay). Tres estados: cargando el usuario,
   error con reintentar, formulario. Dos campos `type=password` con botón de
   mostrar, `autocomplete="new-password"`. Guardar → aviso «Contraseña
   cambiada» y vuelve a `/cuenta`.
4. `cuenta.page.ts`: sección **Seguridad** con «Contraseña → Cambiar».
5. `login.page.ts`: el aviso dice dónde: «Mi cuenta → Seguridad».
6. Docs: `docs/modulos/home-y-configuracion.md` y bloque nuevo en
   `docs/PLAN_TESTEO_MANUAL.md` con su fila en la tabla de totales.

### Fase 2 — «¿Olvidaste tu contraseña?» en el login

Pedido de Franco el 2026-11-03: quien se olvida la clave no tenía salida desde
la PWA. El desktop ya lo resuelve (`develop`, desde el 16/10:
`recuperar-contrasena-dialog`) contra `/public/recuperacion-contrasena/*` del
central (`RecuperacionContrasenaController`, desde `v4.7.0-alpha.192`,
`v4.8.0-beta.11`, `v4.16.0`: alpha, farmacia y bodega lo tienen). Se porta el
**lado del usuario**; aprobar o rechazar solicitudes sigue siendo de RRHH en
el desktop. **El central no se toca.**

Flujo, igual al desktop:

1. Identidad: usuario + cédula + captcha (`GET captcha`, `POST verificar`).
2. Con correo: código de 6 dígitos (`POST consultar` para validarlo) → clave
   nueva (`POST restablecer`).
3. Sin correo: solicitud a RRHH con teléfono, correo y observación (`POST
   solicitud-rrhh`) → número y **código secreto, que se muestra una sola vez**
   → se manda por WhatsApp. Acá el usuario ya está en el teléfono, así que en
   vez del QR del desktop va un botón que abre `wa.me` con el mensaje.
4. Consultar una solicitud (número + código secreto + cédula) → si RRHH la
   aprobó, clave nueva.

Piezas:

- `core/auth/recuperacion-contrasena.service.ts` + modelo: `HttpClient` contra
  `ServerConfigService.baseUrl()`, sin token (las rutas son públicas y el
  interceptor solo agrega el token si hay sesión — verificar). Traduce errores
  como el desktop: status 0, `error.message` del central, 404 «el servidor
  todavía no tiene esta función», timeout.
- `pages/login/recuperar-contrasena.page.ts`, ruta **pública**
  `recuperar-contrasena` (fuera del shell y sin guard, como `login`), recibe el
  usuario escrito en el login por query param. Estado en signals; cada paso con
  su carga y su error.
- `login.page.ts`: enlace «¿Olvidaste tu contraseña?».
- `contrasena.util.ts`: **una sola validación para las dos pantallas**, la del
  central de recuperación (`validarContrasena`): obligatoria, hasta 50, sin
  espacios al borde, distinta del usuario, no un mismo carácter repetido; más
  «distinta de 123» (si no, el aviso del login vuelve) y que coincidan. Sale el
  mínimo de 3 de la fase 1: el desktop lo sacó a propósito (`9987846b`). La
  cédula la controla el central y se muestra su mensaje.

Datos nuevos: ninguno en el central. En la PWA, **`{solicitudId,
codigoSecreto}` en `sessionStorage`** (`frc.recuperacion.solicitud`): lo escribe
`enviarSolicitud` y lo lee la identidad («Tenés la solicitud N° … en curso»);
se borra al completar, al rechazarse o vencer, o cuando el central dice que ya
no está vigente. Decidido por la auditoría (eje B · R1): sin eso el secreto se
perdía al ir a WhatsApp. Vive solo en esa pestaña y no sirve sin la cédula.

Tests de la fase 2: spec del servicio (URLs, cuerpos, traducción de errores) y
de la validación nueva. Runtime contra el central local: captcha real, usuario
sin correo → solicitud → aprobar por GraphQL con un usuario con `RRHH APROBAR`
→ consultar → restablecer → login con la nueva; código secreto equivocado
(cuenta intentos); y el camino con correo hasta donde llegue sin SMTP local
(el central responde «El envío de correos no está configurado»: se ve el
mensaje).

#### Auditoría del plan de la fase 2

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| B · R1 | El código secreto se muestra una vez y abrir WhatsApp puede descartar la pestaña: la solicitud queda viva e inservible, y pedir otra anula la anterior (incluso aprobada) y gasta una de las 3 del día | `{solicitudId, codigoSecreto}` en `sessionStorage` hasta completar, rechazar, vencer o anular; al volver se ofrece «Consultar su estado» |
| B · R2 | `solicitud-rrhh` consume el token antes de validar: un error o un doble toque lo quema | Una llamada a la vez; teléfono y correo validados antes de enviar con el patrón del central |
| B · R3 | Doble «Guardar»: el segundo responde «código no válido» con la clave ya cambiada | Una llamada a la vez; si falla tras un envío previo, avisa «probá entrar con la nueva» |
| B · R4 | El correo de la solicitud queda en el usuario | La pantalla lo avisa |
| A / B · R5 | Bloqueo de 30 min tras 20 fallos **por IP**: una sucursal sale por una sola IP | Se muestra el mensaje del central; sin reintentos automáticos. Anotado en el módulo |
| A | 5xx con HTML (túnel de alpha caído) | Cae en el mensaje genérico; caso en el spec |
| A | Contrato, CORS (`allowedOriginPatterns("*")` antes de Security), proxies, interceptor, service worker | Sin hallazgos |

#### Auditoría del diff de la fase 2

Ejes fijos sin hallazgos (nada en logs ni URL, cuerpos iguales al controller,
404 y 5xx con HTML caen en mensajes propios). Aplicado: el paso del código
mostraba nada si el código había vencido (ahora muestra el estado, y el estado
se limpia al cambiar de paso, como el desktop); la solicitud guardada se borra
también cuando el central dice que ya no está vigente; el aviso «probá entrar
con la nueva» sale solo si el intento anterior quedó sin respuesta (red,
timeout, 5xx), no si el central lo rechazó. Queda: en Mi cuenta se puede poner
la cédula como clave (`saveUsuario` no la controla).

#### Resultado de las pruebas de la fase 2 (2026-11-03)

- `npm test` 1.625 en verde; `npm run build` en verde.
- Por pantalla contra el central local de `develop`, bloque 97 completo. El
  captcha no lo resolví: en la **copia de prueba** del central (no en el repo)
  acepté además una respuesta fija; las demás se validan normal, y el captcha
  equivocado se probó. El correo salió a un SMTP de prueba local (nada sale
  afuera), así que el camino con correo se probó entero.
  - 97.1–97.2: usuario precargado, imagen, cédula y captcha equivocados.
  - 97.3: validaciones de teléfono y correo; con **doble clic** se creó una sola
    solicitud.
  - 97.4: tras recargar, «Tenés la solicitud N° … en curso» la retoma.
  - 97.5: pendiente → aprobada por GraphQL con `RRHH APROBAR` → clave nueva con
    doble clic → `COMPLETADA`, sin error, y se entra con la nueva.
  - 97.6: código secreto equivocado → «Le quedan 4 intentos».
  - 97.7: con correo → código → clave nueva → `COMPLETADA`; sin correo
    configurado, el mensaje del central.
  - Mi cuenta con las reglas nuevas: el propio usuario se rechaza, `ab` pasa.
- Bug encontrado y corregido en la prueba: el «no coinciden» se ocultaba con la
  segunda clave vacía y eso mismo habilitaba «Guardar» sin repetir la clave.
- Segunda pasada, tras la auditoría del diff (1.626 tests en verde):
  - código del correo vencido (vencimiento adelantado por SQL): «El código
    venció. Pida uno nuevo.» en el mismo paso; «enviar otro código» lo limpia;
  - solicitud guardada que ya no está vigente: mensaje del central, la copia
    guardada se borra y el aviso de «en curso» desaparece;
  - intento incierto: con la respuesta cortada a propósito, el primer
    «Guardar» se aplicó en el central y la pantalla vio «No se pudo conectar»;
    al reintentar, «no válido» más «probá entrar con la nueva», y entra.
- Datos restaurados: usuarios, cédula temporal, rol, solicitudes e intentos.
  El captcha de prueba se revirtió en la copia del central.

Sin verificar: el bloqueo por IP real detrás de nginx/túnel (en local la IP es
`::1`), el correo real por la API de Gmail, y el teléfono real (abrir WhatsApp y
volver con la pestaña descartada).

## Tests

- `contrasena.util.spec.ts`: cada regla de `validarNuevaContrasena` y que
  `inputCambioClave` lleve `nickname`, `personaId`, `usuarioId` (creador, no el
  de la sesión) y `activo`.
- `npm test` y `npm run build` (AOT) en verde.
- Runtime contra un central local: cambiar la clave de un usuario de prueba sin
  `EDITAR USUARIOS` y con él; verificar por SQL que nickname, persona, creador y
  `activo` quedaron iguales, que el login con la clave nueva entra y con la
  vieja no, y que el aviso de `123` deja de salir. Restaurar la clave al final.

## Datos nuevos

Ninguno: ni columna, ni clave de almacenamiento, ni campo GraphQL.

## Auditoría del plan (paso 5)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| B · R1/R2 | Una clave con espacio al borde (autocompletado del teclado con «mostrar») deja al usuario afuera; una de solo espacios el central la toma como vacía y da un falso «cambiada» | `validarNuevaContrasena` rechaza espacios al borde (cubre los dos); `autocorrect="off"` en los campos; caso en el spec |
| A · 3 / B · R4 | Con `EDITAR USUARIOS`, el input con lo leído al abrir revierte lo que un admin cambió mientras tanto | Se relee el usuario justo antes de mutar |
| A · 1 | El plan decía que un central viejo «también acepta»: acepta pero borra `email` y `creadoEn` | Corregido arriba con el mínimo de versión |
| A · 2 / B · R3 | `personas.usuario` se replica a las filiales: el desktop valida contra la copia de la filial; una filial sin suscripción (la 25) sigue con la clave vieja | Anotado; en runtime se mira la fila en la filial local |
| B | La sesión abierta y las de otros dispositivos no se cortan al cambiar la clave | Anotado: cambiarla no echa a nadie |

## Auditoría del diff (paso 8)

Ejes fijos sin hallazgos (el id sale de la sesión y el central igual frena a
otro usuario; la clave no queda en caché, URL ni almacenamiento; la query y el
input existen en develop y master). Menores aplicados: la suscripción del
guardado se corta al salir de la pantalla; si la relectura no trae el usuario
no se guarda; al terminar vuelve a Mi cuenta sin dejar el formulario en el
historial. No aplicado: el campo `username` oculto con `display:none` (algún
gestor de contraseñas puede ignorarlo; es comodidad).

## Resultado de las pruebas (2026-11-03)

- `npm test`: 1.610 tests en verde. `npm run build` (AOT) en verde.
- Por pantalla, contra un central local de `develop` (`3eedb2d4`, perfil `dev`,
  sin migraciones aplicadas), bloque 96 completo:
  - 96.1–96.3: el aviso dice dónde; la sección está; las cuatro reglas frenan.
  - 96.4 (`PRUEBANR`, sin `EDITAR USUARIOS`): cambió solo la clave; persona,
    creador, email, `activo` y `creado_en` iguales por SQL.
  - 96.5: con `123` no entra; con la nueva en minúsculas entra y sin aviso.
  - 96.6 (`PRUEBAVERIF`, con `EDITAR USUARIOS`, creador y email cargados): solo
    cambió la clave. Con la pantalla abierta se le cambió el creador por SQL y
    al guardar quedó **el nuevo**: la relectura antes de mutar funciona.
  - 96.7: con la red cortada, error con «Reintentar» al abrir; al guardar,
    aviso, botón habilitado y la clave sin cambiar.
- Usuarios de prueba restaurados al terminar.

## Qué queda sin verificar / omitido a propósito

- **La bajada a la filial.** En la `general` local esos usuarios no existen, así
  que no se pudo ver la fila replicada. El backend no cambia: es la réplica de
  siempre de `personas.usuario`.
- Teléfono real (Android/iPhone): el autocompletado del teclado y el gestor de
  contraseñas con `autocomplete="new-password"`.

- **No se pide la contraseña actual.** El central no la verifica y `frc-mobile`
  tampoco la pedía; pedirla en el cliente sería un control decorativo.
- No se fuerza el cambio: el aviso del login sigue siendo un aviso.
- iPhone/Safari: sin capacidades de dispositivo; solo formulario.
