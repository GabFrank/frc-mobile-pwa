# Plan: el chip «Abierto» de los convenios en azul

Pedido de Franco (15/11/2026). Rama: `fix/mis-finanzas-chip-abierto-azul` (desde `develop` f2cfd36). Pieza:
**mobile-pwa**. Sin backend.

## Problema

En Mis finanzas (lista e Historial) el chip de un convenio `ABIERTO` sale gris (`tono: 'neutral'` en
`shared/estado/estado-registry.ts`). Franco lo quiere azul.

## Enfoque

Cambiar `EstadoVentaCredito.ABIERTO` a `tono: 'info'`, el azul del vocabulario cerrado de tonos (`--info` /
`--info-bg` en `_tokens.scss`, con su par de modo oscuro). No hace falta ningún color nuevo. Se reescribe el
comentario de arriba: sigue sin ser naranja (no es algo pendiente del funcionario) y ahora es azul, que es «en curso».

**Quién lo lee:** `EstadoVentaCredito` solo lo usa `pages/mis-finanzas` (resumen, lista e Historial). La clave del
registro es por enum, así que `PagoEstado.ABIERTO` e `InventarioEstado.ABIERTO` no cambian.

**Descartado:** un tono nuevo «azul» (el vocabulario es cerrado y hay un test que lo impide); pintar el chip por CSS
en la página (rompe el registro único de estados).

## Fase única

- `estado-registry.ts`: el tono y su comentario.
- **Test**: en `estado-registry.spec.ts`, `resolverEstado('EstadoVentaCredito', 'ABIERTO').tono` es `'info'` (falla con
  el código viejo).
- `docs/PLAN_TESTEO_MANUAL.md`: bloque 108 con su caso y la fila en el resumen.

Datos nuevos: ninguno.

## Verificación

`npm test`, `npm run build` y por pantalla: `npm start` (4300), Mis finanzas con un funcionario con convenios abiertos,
pestañas de la lista e Historial, en modo claro y oscuro.

## Auditoría del plan

- **Eje A:** único consumidor `mis-finanzas.page.ts:163`; ningún test ni doc fija ABIERTO en gris; `--info` sobre
  `--info-bg` con contraste suficiente en claro y oscuro. Sin bloqueantes.
- **Eje B:** se revierte con un commit; sin estado persistido; en el peor caso un usuario ve gris hasta que el service
  worker se actualiza (los chunks llevan hash, `ngsw.json` va `no-cache`). El test falla con el código viejo.
- **Riesgo menor (los dos):** ABIERTO comparte azul con otros `info` («Parcial», «En curso»). Aceptado: en Mis
  finanzas no hay otro chip `info`, y se distinguen por etiqueta e icono.

## Sin verificar

El teléfono físico: el color sale de los mismos tokens que el resto de los chips `info`.
