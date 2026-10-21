# Plan — issue #98: dos recargas de ítems que se cruzan

Rama: `fix/transferencias-recargas-cruzadas` (desde `develop` en `a3f6027`, con #99 ya mergeado).

## Problema

`TransferenciaDetallePage.cargarItems()` (`src/app/pages/transferencias/transferencia-detalle.page.ts`)
se suscribe a `servicio.items(id, 0, TODOS)` y aplica la respuesta que llegue. Hay **dos** caminos
por los que la grilla queda con datos viejos:

1. **Deduplicación de Apollo (el más probable).** Las variables son siempre las mismas, y Apollo
   4.2.9 deduplica por defecto (`queryDeduplication = true`, `ApolloClient.js:77`): si la recarga B
   se pide mientras la A sigue en vuelo, B se **engancha a la petición HTTP de A**
   (`QueryManager.js:552-568`, `shareReplay`) y recibe la respuesta de antes del guardado. `no-cache`
   no lo evita.
2. **Respuestas desordenadas.** Sin deduplicación, dos peticiones reales pueden llegar en otro
   orden; gana la que llega última, no la que se pidió última.

En los dos casos `pendientes` / `accionHabilitada` se calculan sobre la lista vieja, y desde #94 un
error viejo que llega tarde deja `itemsSinCargar` en `true` y el botón apagado de más.

⚠️ **Cortar la suscripción no cancela la petición en Apollo**: `apollo-angular` envuelve
`client.query()` en una Promise (`fromLazyPromise`, `apollo-angular.mjs:10-23,115-117`), así que la
petición sigue en vuelo y la deduplicación la sigue compartiendo. Por eso hacen falta las dos
piezas del cambio.

Llamadores de `cargarItems()` (todos en la misma página): `cargar()` (carga completa), el
`desconfirmar` del menú, y `guardarVerificacion` (éxito y error). Ninguno usa lo que devuelve.

## Cambio (fase única)

1. **`GqlOptions` acepta `context`** (`src/app/core/graphql/gql-base.ts`): un campo opcional que
   `Query.fetch` ya esparce en `apollo.query`. Sin cambio para quien no lo pase.
2. **`TransferenciaService.items()` pide con `context: { queryDeduplication: false }`**: cada recarga
   es una petición propia y trae el estado de después del guardado. Solo esta consulta; la
   deduplicación global queda como está.
3. **`cargarItems()` corta la carga anterior**, con el patrón de `transferencias-lista.page.ts:367-475`:
   campo `private cargaItems?: Subscription`, `this.cargaItems?.unsubscribe()` antes de pedir, y
   `inject(DestroyRef).onDestroy(...)`. La respuesta de la carga cortada ya no llega a `next`/`error`:
   no toca `items` ni `itemsSinCargar`, ni muestra el toast de error (`catchError` de `DatosService` no
   corre). El contador global de carga baja igual: `finalize` corre al desuscribir.

Sin backend, sin GraphQL de esquema, sin migraciones, sin datos nuevos.

## Fuera de alcance (se anota en la issue)

- `cargar()` (la cabecera, `porId`) tiene la misma forma; las recargas que se cruzan salen de las
  acciones por ítem, que solo recargan ítems.
- `transferencia-borrador.page.ts:223-236` tiene el mismo `cargarItems()` sin corte, y usa la misma
  `items()`: el punto 2 ya le saca la deduplicación, pero no el desorden de respuestas.

## Tests

En `src/app/pruebas/transferencia-etapas.spec.ts`, con `items` devolviendo `Subject`s
(`mockReturnValueOnce`; la primera llamada la hace el `effect` de `cargar()` al montar):

- Dos `cargarItems()`; responde la segunda y después la primera → `items()` queda con la segunda.
- Dos `cargarItems()`; la segunda responde bien y la primera falla después → `itemsSinCargar()` en
  `false`.
- `TransferenciaService.items()` pasa `queryDeduplication: false` en el contexto (spy sobre
  `DatosService.consultar`).
- Revertir el fix y comprobar que fallan. `npm test` y `npm run build`.

Los tests con `Subject` no pasan por Apollo: la deduplicación se prueba por pantalla.

**Prueba por pantalla** (local, central `develop` en 8081), desde la consola del navegador (Apollo
va por XHR: `provideHttpClient()` sin `withFetch`):

1. Retener la respuesta de la primera consulta de ítems y disparar una segunda recarga. **Código
   viejo**: no sale una segunda petición en Network (deduplicada). **Nuevo**: salen dos, y la grilla
   y el botón muestran la segunda aunque la primera se suelte después.
2. Camino normal: confirmar, modificar, rechazar y desconfirmar siguen actualizando la grilla.

## Documentación

Bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md`; una línea en `docs/modulos/transferencias.md` junto a
la nota de #94; y en `docs/arquitectura/capa-de-datos.md`, que `GqlOptions.context` existe y que la
deduplicación de Apollo hace que dos consultas iguales en vuelo compartan la respuesta.

## Sin verificar

- La carrera real en el teléfono con red lenta: se simula reteniendo la respuesta.

## Auditoría del plan (paso 5)

- Eje A: la primera versión decía que cortar la suscripción alcanzaba. Falso: la deduplicación de
  Apollo comparte la petición y el `unsubscribe` no la cancela (verificado en `node_modules`) →
  puntos 1 y 2 del cambio. Sin efectos secundarios del corte (contador y toast verificados). Sumó el
  borrador como pantalla con la misma carrera → fuera de alcance.
- Eje B: el estado nunca queda peor (si la nueva falla, `itemsSinCargar` bloquea). Señaló que los
  tests con `Subject` no ven la deduplicación y que la prueba por pantalla tiene que mirar Network →
  incorporado.
