# Plan — Rechazos sin el prefijo de graphql-java (issue #93)

**Problema.** graphql-java antepone `Exception while fetching data (<ruta>) : `
a toda excepción de un resolver, y la PWA la muestra tal cual. Ejemplo visto
el 2026-10-21 probando la #92: *«Exception while fetching data (/data) : La
transferencia 58012 ya esta en etapa …»*.

El central solo desenvuelve las excepciones que ya son `GraphQLError`
(`GraphqlExceptionHandler.java:34-40`); el resto llega con el prefijo.

**Por dónde pasa.** Un solo lugar: `DatosService.ejecutar`
(`core/graphql/datos.service.ts:240`). Todas las operaciones usan
`errorPolicy: 'all'` (`gql-base.ts:64,69,128`) y las suscripciones pasan por el
mismo `ejecutar`. Ningún código decide por el texto del mensaje.

⚠️ **La forma real no es un arreglo con un error por elemento.** Apollo 4.2.9
devuelve un único `error: CombinedGraphQLErrors` cuyo `message` une todos los
mensajes con `\n`, y `normalizar` (`gql-base.ts:150`) lo envuelve en
`errors: [r.error]`. Por eso el ` · ` de hoy nunca separa nada.

## Fase única — PWA (rama `fix/datos-sin-prefijo-graphql`)

1. `datos.service.ts`, en `ejecutar`: aplanar
   `res.errors.flatMap((e) => CombinedGraphQLErrors.is(e) ? e.errors : [e])`
   y limpiar **cada** mensaje con la regex del desktop
   (`/^Exception while fetching data \([^)]*\) : /`) antes de unirlos con ` · `.
   Sin mutar los errores: se arma texto nuevo.
2. Si al limpiar no queda texto útil (vacío o `null`, una excepción sin
   mensaje), se deja el mensaje original; si ni eso hay, «Ocurrió un error
   inesperado.» (el texto que ya usa `mensajeDeError`).
3. La **causa** del `ErrorDatos` sigue siendo el error original
   (`res.errors[0]`): `esFalloDeTransporte` decide por ella y no cambia.

**Tests** (`core/graphql/datos.service.spec.ts`), con la forma real
(`errors: [new CombinedGraphQLErrors(...)]`):
- un rechazo con prefijo llega limpio al `ErrorDatos` y al aviso; *(falla sin el fix)*
- con dos errores se limpian los dos y se separan con ` · `; *(falla sin el fix)*
- `… : null` deja el mensaje original y no «null»; *(falla sin el fix)*
- regresión: sin prefijo, o con el texto en el medio, queda igual; la causa
  conserva el original.

**Datos nuevos.** Ninguno.

**Docs.** Una línea en `docs/arquitectura/capa-de-datos.md` (sección
`DatosService`); bloque 87 en `docs/PLAN_TESTEO_MANUAL.md` con su fila.

## Auditoría (paso 5) y qué se hizo

| Hallazgo | Eje | Qué se hizo |
|---|---|---|
| Apollo 4 une los errores en un `CombinedGraphQLErrors` con `\n`: la regex anclada limpiaba solo el primero, y un test con arreglo de dos no lo veía | A | Puntos 1 y tests con la forma real (verificado en `gql-base.ts:150` y `CombinedGraphQLErrors.js:6-7`) |
| Excepción sin mensaje: limpio quedaría «null» o vacío | A y B | Punto 2 |
| Los tests de regresión pasan también con el código viejo | B | Marcado cuáles prueban el fix |
| Formato real del central (graphql-java 18.5, « : » exacto, rutas sin paréntesis) | B | Sin cambios: la regex sirve |
| Otros caminos (Apollo directo, sesión, suscripciones) o código que compare el texto | A y B | No hay |

**Límite conocido, fuera de alcance:** excepciones del central con
`getMessage() == null` que implementan `GraphQLError`
(`UnauthenticatedAccessException`, `ProductoDescripcionYaExisteException`) no
traen prefijo ni mensaje. Hoy Apollo las muestra como «Error message not
found.»; con el punto 2 pasan a «Ocurrió un error inesperado.». Darles un
texto de negocio es del central.

## Qué queda sin verificar y cómo

- Por pantalla: provocar un rechazo real contra un central local (`develop`
  ya trae #450: avanzar dos veces la misma etapa) y ver el aviso sin prefijo.
