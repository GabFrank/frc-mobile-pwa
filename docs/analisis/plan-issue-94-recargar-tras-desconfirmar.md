# Plan — issue #94: recargar los ítems si falla guardar la verificación

Rama: `fix/transferencias-recargar-tras-desconfirmar` (desde `develop` en `507561f`).

## Problema

`TransferenciaDetallePage.guardarVerificacion` (`src/app/pages/transferencias/transferencia-detalle.page.ts`)
hace dos mutations seguidas cuando `requiereDesconfirmarAntes(...)` es verdadero:

1. `desconfirmarItem(item.id, etapa)` — vacía la etapa del ítem y desactiva su movimiento.
2. `guardarItem(input)` — guarda la verificación nueva.

Si la 1 sale bien y la 2 falla, el `catch` devuelve `false` sin recargar: el central ya tiene la
etapa vacía y la grilla sigue mostrando el ítem verificado hasta reabrir la transferencia.

**Consecuencia peor que la visual**: `pendientes` y `accionHabilitada` se calculan sobre esa lista,
así que el botón de concluir la etapa queda habilitado. El central **no valida** ítems con la etapa
vacía al avanzar (`TransferenciaGraphQL.avanzarEtapa`, case `PREPARACION_MERCADERIA_CONCLUIDA`:
copia `cantidadPreparacion` a `cantidadTransporte` aunque sea `null`).

## Cambio (fase única)

1. En el `catch` de `guardarVerificacion`, `this.cargarItems()` antes de `return false`. Se recarga
   **siempre**, no solo cuando corrió la 1: si la 1 falló no cambió nada y la recarga trae lo mismo;
   si la 2 se guardó y falló solo la respuesta, la recarga muestra lo guardado.
2. Señal `itemsSinCargar`: `cargarItems()` la pone en `true` si la query falla y en `false` si sale
   bien. Con `true`, `accionHabilitada` es `false` en las acciones que exigen ítems verificados, y
   `motivoDeBloqueo` dice que no se pudieron cargar los productos y que se reabra la transferencia.
   Cubre el caso «falla la 2 y también la recarga» (red caída). Alcanza también a la carga inicial,
   que hoy con los ítems caídos deja la lista vacía → 0 pendientes → botón habilitado.

Llamadores de `guardarVerificacion` (todos en la misma página): `confirmar`, `modificar`,
`rechazar`. Sus contratos no cambian: siguen recibiendo `false` en el fallo, y `rechazar` sigue sin
mandar el push cuando no se guardó.

Sin backend, sin GraphQL, sin migraciones, sin datos nuevos (la señal es estado de pantalla: la
escribe `cargarItems`, la leen `accionHabilitada` y `motivoDeBloqueo`).

## Tests

En `src/app/pruebas/transferencia-etapas.spec.ts`, «El botón de avance, en la pantalla» (ya monta
`TransferenciaDetallePage` con `TransferenciaService` mockeado):

- Confirmar un ítem rechazado: `desconfirmarItem` OK, `guardarItem` falla, `items` devuelve después
  el ítem con la etapa vacía → `items` se llamó 2 veces, 1 pendiente, botón apagado. **Falla con el
  código viejo** (se comprueba revirtiendo el fix).
- Mismo caso pero la recarga también falla → botón apagado y `motivoDeBloqueo` lo explica.
- `npm test` y `npm run build` (gate real).

**Prueba por pantalla** (local, `npm start` en 4300 contra el central local), interceptando en el
navegador las mutations para forzar el error:

1. Ítem rechazado → confirmar con `guardarItem` forzado a error → toast de error y la grilla muestra
   el ítem sin verificar, con el botón de concluir apagado.
2. Igual, con la query de ítems también forzada a error → botón apagado con el motivo.
3. Sin intercepción: confirmar, modificar y rechazar siguen igual.

## Documentación

Bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md` con los casos 1 y 2, y tabla de totales.

## Fuera de alcance (anotar en la issue)

- Carrera entre recargas: `cargarItems` no descarta respuestas viejas. Ya existe en el camino feliz.
- Desktop `edit-transferencia.component.ts` `onConfirm` guarda sin desconfirmar antes: un ítem
  rechazado confirmado ahí podría quedar con el motivo. No verificado.

## Sin verificar

- El error real del `guardarItem` por lock de lotes (central#463) no se reproduce: se simula con la
  intercepción. Lo que importa es que la 2 falle después de la 1, no por qué.

## Auditoría del plan (paso 5)

- Eje A: sin cambio de contrato; desktop y mobile no encadenan desconfirmar + guardar. Riesgos
  menores: la recarga muda no cubre la red caída (→ punto 2 del cambio) y la carrera entre recargas
  (→ fuera de alcance).
- Eje B: la premisa «no hay specs de página» era falsa (→ tests en `transferencia-etapas.spec.ts`);
  si la recarga falla el botón de concluir queda habilitado y el central no lo frena (verificado →
  punto 2 del cambio).
