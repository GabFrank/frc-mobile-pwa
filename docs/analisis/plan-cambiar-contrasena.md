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
