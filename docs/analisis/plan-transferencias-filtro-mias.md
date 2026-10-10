# Plan — Transferencias: pestaña «Mías» en la lista

Rama: `feature/transferencias-filtro-mias` (desde `develop`, `641c146`). Pieza: **mobile-pwa**, sola.

## Qué se pide

La lista de transferencias de la PWA tiene tres pestañas genéricas —**Salen · Llegan · Todas**—,
todas por sucursal. `frc-mobile` mostraba otra cosa: **solo las transferencias donde el usuario
participa**. Se pide recuperar ese punto de vista como un filtro más.

## Qué hacía `frc-mobile` (verificado en el código)

- `ListTransferenciasComponent.onGetTransferencias()` llama a `transferenciasPorUsuario(id)` con el
  id del usuario logueado.
- En el central, `TransferenciaRepository.findByUsuario` (SQL nativo): transferencias donde el
  usuario es `usuario_pre_transferencia_id`, `usuario_preparacion_id`, `usuario_transporte_id` **o**
  `usuario_recepcion_id`; `order by id desc limit 20`. Devuelve `[Transferencia]!`, **sin paginar**.
- La query existe en `origin/develop`, `origin/release/beta` y `origin/master` del central.

## Decisiones

| # | Decisión | Por qué |
|---|---|---|
| 1 | Usar `transferenciasPorUsuario` tal cual, **sin tocar el central** | Es la misma regla que tenía `frc-mobile` y ya está en los tres canales: la PWA se puede publicar sola |
| 2 | **No** usar `ultimoResponsableId` de `transferenciasWithFilters` | Filtra solo por el responsable de la etapa más avanzada: una transferencia que creé y otro preparó deja de ser «mía». No es lo que había |
| 3 | La pestaña se llama **«Mías»** y va **primera, por defecto** | Concuerda con «Salen / Llegan / Todas» (las transferencias). Por defecto porque era la única vista de `frc-mobile` y es la que usa quien opera |
| 4 | **Sin «Cargar más»** en Mías; una nota dice que son las últimas 20 | El central corta en 20 y no pagina. Mostrar 20 sin decirlo afirma que no hay más |
| 5 | Si la URL trae `etapa` o `sucursal`, **Mías no se ofrece** | `transferenciasPorUsuario` no acepta esos filtros, y filtrar 20 filas en el cliente daría «no hay» cuando lo cierto es «no pregunté». El caso de la URL («qué viene en camino para acá») no es sobre el usuario. Queda como hoy: Salen · Llegan · Todas |
| 6 | Cancelar la consulta anterior al cambiar de pestaña | Ahora hay dos fuentes distintas: una respuesta tardía de la pestaña anterior pisaría la lista de la actual |
| 7 | Sin id de usuario → estado de **error**, no lista vacía | «No hay» y «no pude preguntar» son respuestas distintas (`PATRONES.md` §6) |

## Fase única

Archivos:

- `src/app/graphql/transferencias/graphql-query.ts` — `transferenciasPorUsuarioQuery` (alias `data:`, misma `cabecera` que la lista).
- `src/app/graphql/transferencias/transferenciasPorUsuario.ts` — `TransferenciasPorUsuarioGQL` (nuevo).
- `src/app/pages/transferencias/transferencia.service.ts` — `porUsuario(usuarioId)`.
- `src/app/pages/transferencias/transferencias-lista.page.ts` — la pestaña, la nota, el vacío propio, la cancelación.
- `src/app/pruebas/transferencia-lista-mias.spec.ts` — nuevo. `transferencia-borrador.spec.ts` — el stub del servicio gana `porUsuario`.
- `docs/modulos/transferencias.md`, `docs/PLAN_TESTEO_MANUAL.md` (bloque 81, 18.1 y totales), `CLAUDE.md` si corresponde.

Tests de la fase (`transferencia-lista-mias.spec.ts`):

1. Al entrar pide `porUsuario` con el id del usuario y **no** `conFiltros`.
2. Las pestañas son Mías · Salen · Llegan · Todas.
3. Mías no muestra «Cargar más» y sí la nota de las últimas 20.
4. Cambiar a «Salen» pide `conFiltros` con `isOrigen: true`.
5. Con `etapa` o `sucursal` en la URL no hay pestaña Mías y se pide `conFiltros`.
6. Sin id de usuario: estado de error, sin consultar.
7. Mías vacía: el vacío propio, que manda a las otras pestañas.
8. Una respuesta tardía de la pestaña anterior no pisa la actual.

## Datos nuevos

Ninguno. No hay campo, columna ni clave nueva: se **lee** una query existente.

## Migraciones

N/A para mobile-pwa: no tiene base. El central no se toca.

## Qué queda sin verificar

- Teléfono físico e iOS: la pantalla es Material puro, sin capacidad de dispositivo.
- Que `transferenciasPorUsuario` responda con los campos de `cabecera` en farmacia y bodega: se
  verifica contra el central local/alpha; el tipo `Transferencia` es el mismo que ya devuelve
  `transferenciasWithFilters` en esos canales.

## Auditoría del plan (paso 5) — hallazgos y qué se hizo

| Eje | Hallazgo | Verificado | Qué se hizo |
|---|---|---|---|
| A | El único salto real con filtro —`inventario-detalle.page.ts:398`, «N transferencias sin recibir»— manda `sucursalId`, y la lista lee `sucursal`: hoy no acota nada, y con Mías por defecto caería en una lista que contradice al contador | Sí | Entra en la fase: el emisor pasa a mandar `sucursal`, con test. Con filtro de URL la pestaña inicial pasa a ser **Todas**: `isOrigen`/`isDestino` son banderas de la fila, y arrancar en «Salen» escondería las que ya están en destino |
| A | Una notificación de transferencia abre `/transferencias` sin parámetros: ahora cae en Mías, y quien no participa ve vacío | Sí | El vacío de Mías dice dónde están las demás (test 7) |
| A | `transferenciasPorUsuario` y los 15 campos de `cabecera` existen en `develop`, `release/beta` y `master` del central | Sí | Sin cambios |
| B | El `effect` rastrea `indice` porque `cargar()` lo lee: cada cambio de pestaña ya cargaba dos veces | Sí | `untracked(() => this.cargar())` |
| B | Al cancelar un «Cargar más» en vuelo, `cargandoMas` y `hayMas` quedaban pegados | Sí | Se limpian en toda carga que no agrega; test Salen (con más) → Mías |
| B | El índice de pestaña si la lista pasa de 4 a 3 con el componente vivo | Supuesto | La vista se guarda por clave y el índice se deriva |
| B | `auth.usuario()` nulo al montar | Descartado: `provideAppInitializer(restaurar)` y `rolGuard` | La decisión 7 queda como defensa |
