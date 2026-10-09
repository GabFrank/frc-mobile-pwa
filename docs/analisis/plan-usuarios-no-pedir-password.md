# Plan — las queries de usuario dejan de pedir `password`

Rama: `fix/usuarios-no-pedir-password` (desde `develop`). Nace del relevamiento de la issue #344
del central: `password` es el único campo del tipo `Usuario` que se puede retirar del schema, y
esta PWA es uno de los dos clientes que todavía lo piden.

## Qué cambia

`src/app/graphql/personas/usuario/graphql/graphql-query.ts` pide `password` en cinco operaciones:

| Export | Operación | Quién la usa hoy |
|---|---|---|
| `usuariosQuery` | `usuario { … }` | nadie |
| `usuariosSearch` | `usuarioSearch` | `UsuarioService.buscar()` → `asignar-chofer-dialog`, `transferencia-nueva` |
| `usuarioQuery` | `usuario(id)` | `UsuarioPorIdGQL`, sin consumidor fuera de `graphql/` |
| `usuarioPorPersonaIdQuery` | `usuarioPorPersonaId` | `UsuarioPorPersonaIdGQL`, sin consumidor |
| `saveUsuario` | `saveUsuario` (selección de la respuesta) | `SaveUsuarioGQL`, sin consumidor |

Ningún componente ni servicio lee `usuario.password` de una respuesta: las únicas lecturas de
`password` fuera de ese archivo son la clave que el usuario tipea en el login y el
`Usuario.toInput()`. `usuarioLoginQuery` ya no lo pedía.

Se quita la línea `password` de las cinco. No se toca `UsuarioInput.password` ni `Usuario.password`
del modelo: son el camino de escritura, que no cambia.

## Fases

**Fase única** — un commit, un push.

1. Quitar `password` de las cinco operaciones.
2. Test nuevo `graphql-query.spec.ts`: recorre todos los documentos que exporta el archivo y falla
   si alguno selecciona un campo `password`. Se comprueba que falla con el código viejo.
3. Docs: `docs/arquitectura/apollo-graphql.md` y `docs/arquitectura/autenticacion-sesion.md` dicen
   que «varias queries de usuario piden `password`»; pasan a decir que ninguna lo pide y que el
   test lo impide.
4. `docs/PLAN_TESTEO_MANUAL.md`: bloque 78 con la búsqueda de usuarios en transferencias, y la
   tabla de totales.

Verificación: `npm test` y `npm run build`, leídos del log.

## Migraciones y datos nuevos

N/A para mobile-pwa porque el cambio no toca persistencia ni agrega campos, columnas ni claves.

## Compatibilidad

- El cambio solo **deja de pedir** un campo: funciona contra cualquier central, de cualquier canal.
- Un usuario que posterga la actualización sigue con la versión que pide `password`, y **la
  postergación no tiene tope**: «Ahora no» vuelve a ofrecer a las 2 h, sin actualización forzada
  (`core/actualizacion/actualizacion.service.ts`). El día que el central quite el campo, a esa
  versión se le rompe `usuarioSearch` —asignar chofer y transferencia nueva—; el login no, porque
  `usuarioLoginQuery` no lo pide, así que sigue entrando y recibiendo la oferta.
- Quitar el campo del schema del central es **otro PR, en otro repo**, y no forma parte de este
  plan. Sus condiciones: este cambio en `master` de la PWA, y la APK `frc-mobile` fuera de uso
  —pide `password` en seis operaciones, incluida su query de login—. El desktop no lo pide.
- Revertir este commit es inocuo **hasta** ese PR del central. Después, revertirlo reintroduce la
  rotura de `usuarioSearch`.

## Auditoría del plan (paso 5)

| Hallazgo | Eje | Qué se hizo |
|---|---|---|
| La condición para el central no nombraba a la APK `frc-mobile` | A | Agregada arriba |
| «La ventana del service worker» no existe: la postergación no tiene tope | B | Texto corregido arriba |
| El revert deja de ser inocuo después del PR del central | B | Anotado arriba |
| El test cubre un archivo; no impide un `usuario { password }` en otro módulo | B | Los docs dicen «cubre este archivo». Hoy no hay otra selección de `password` en `src/` |
| `usuariosQuery` ya es inválida contra el schema (`usuario` sin `id`) y no tiene consumidor | A | Fuera de alcance; el test parsea, no valida contra el schema |

## Qué queda sin verificar

- Prueba manual de la búsqueda de usuarios (bloque 78): necesita sesión contra un central.
- `saveUsuario` no tiene consumidor en la PWA. Si una pantalla futura guarda un `Usuario` leído por
  estas queries, `toInput()` mandará `password` sin valor, y el `saveUsuario` del central escribe
  lo que recibe. No se resuelve acá: queda anotado en `apollo-graphql.md`.
