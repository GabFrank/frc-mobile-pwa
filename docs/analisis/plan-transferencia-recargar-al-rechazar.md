# Plan — Recargar la transferencia cuando el central rechaza el avance (issue #92)

**Problema.** Si el central rechaza un avance de etapa, la PWA muestra el
motivo (lo hace `DatosService`) pero la pantalla se queda en la etapa vieja,
con el mismo botón. Con el fix del central #450 el rechazo típico es «la
transferencia N ya está en etapa X: la avanzó otro usuario», justo cuando la
pantalla está desactualizada. Visto con la 58220 el 2026-10-20.

**Decisión.** La que propone la issue: ante el rechazo, recargar.

## Fase única — PWA (rama `fix/transferencias-recargar-al-rechazar`)

1. `transferencia-detalle.page.ts`, `avanzar`: en el `error` del subscribe,
   `this.cargar()` (hoy `() => undefined`).
2. `asignar-chofer-dialog.component.ts`: en el `catch` de `confirmar` y de
   `continuarSinChofer`, cerrar con `false`. Cambia una decisión anterior
   («queda abierto con lo cargado»): con el rechazo típico, reintentar desde
   el diálogo nunca puede andar. Se pierde lo cargado de chofer/vehículo si el
   rechazo fue por red; se acepta, la página muestra el estado real y el
   botón vuelve a abrir el diálogo.
   El `ok === false` de `continuarSinChofer` queda como está (abierto, sin
   aviso): el central no devuelve `false` en ese camino y la issue no lo pide.
3. `verificarConChofer` en la página: recarga si el diálogo devolvió `true`
   **o `false`**; con `undefined` (Cancelar, clic afuera, Escape) no recarga.

4. `asignar-chofer-dialog.component.ts`, `elegirChofer`: un usuario sin
   persona no se acepta como chofer (aviso y no se asigna). Es el único
   rechazo de `verificarParaTransporteMobile` que se arreglaba reintentando
   en el diálogo (`TransferenciaGraphQL.java:519-521`); atajarlo antes
   justifica cerrar siempre con `false`. (Auditoría eje B.)
5. Comentarios que quedan falsos: JSDoc de `verificarConChofer` («`true` solo
   si el central la aceptó») y los `catch` del diálogo («se queda abierto con
   lo cargado»). (Auditoría eje A.)

**Tests** (`src/app/pruebas/transferencia-chofer.spec.ts`):
- página: si el avance normal falla, recarga (`porId` 2 veces);
- página: si el avance falla y la recarga también, queda en `error()` sin tirar;
- página: si el diálogo devuelve `false`, recarga; con `undefined`, no (ya existe);
- diálogo: los dos «si el central rechaza, queda abierto» pasan a «cierra con
  `false`». «Si devuelve false, queda abierto» se mantiene;
- diálogo: un usuario sin persona no queda como chofer.
Revertir cada cambio y ver que su test falla.

## Auditoría (paso 5) y qué se hizo

| Hallazgo | Eje | Qué se hizo |
|---|---|---|
| Chofer sin persona: único rechazo que se arreglaba reintentando; cerrar con `false` obliga a recargar todo | B | Punto 4: se ataja al elegirlo |
| Error de red: la recarga también falla y la página pasa a la pantalla de error con «Reintentar» en vez del detalle viejo; dos avisos seguidos | A y B | Aceptado: con la red caída reintentar desde la vista vieja tampoco anda, y si fue timeout con commit, recargar muestra la verdad. Caso propio en el bloque 86 |
| `ok === false` sin error en `avanzar` no recarga ni avisa | A | Fuera de alcance: pasa solo con la transferencia inexistente en el central. Igual que hoy |
| Comentarios que quedan falsos | A | Punto 5 |
| Sin #450 en el central, `avanzarEtapaTransferencia` repite la etapa y devuelve `true`: el fix no se dispara | A | No es regresión. La prueba del caso «otro ya avanzó» necesita un central con #450 |
| Caché de Apollo devolviendo la etapa vieja | A y B | Descartado: `gql-base.ts` usa `no-cache` y `porId` no lo pisa |
| Otras pantallas que avanzan etapa con el mismo defecto | A | No hay: el borrador usa `finalizarTransferencia` y ya trata su `false` |

**Datos nuevos.** Ninguno: no hay campo, columna ni clave nueva.

**Docs.** Bloque 86 en `docs/PLAN_TESTEO_MANUAL.md` con «Esperado» por caso y
su fila en «Resumen para completar»; los pasos también en la respuesta.

## Qué queda sin verificar y cómo

- La prueba por pantalla necesita un rechazo real: dos sesiones sobre la misma
  transferencia (una avanza, la otra intenta lo mismo) contra un central local
  con el fix de #450. Si el central local no lo tiene, el rechazo sale igual
  por otra validación (p. ej. ítems sin revisar forzados por otra sesión), o
  se simula cortando el central en el momento del avance.
