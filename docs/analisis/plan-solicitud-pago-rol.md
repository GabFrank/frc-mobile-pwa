# Plan — Solicitudes de pago con rol

**Problema.** En producción cualquier usuario con sesión entra a
`/operaciones/solicitud-pago` (lista, alta y detalle): la tarjeta del menú no
tiene condición y la ruta no tiene `rolGuard`. `permisos.ts` lo dejó abierto a
propósito el 2026-08-14 porque `TESORERIA CPP PAGAR` no lo tenía nadie.

**Decisión (Franco, 2026-10-19).** Los mismos roles que el menú del desktop
(`side-mini-variant.component.ts:170-172`): `ADMIN`, `ANALISIS DE CAJA`,
`ANALISIS FINANCIERO`, `ANALISIS CONTABLE`, `VER PRECIO COSTO`,
`RECIBIR PEDIDOS`, `TESORERIA VER`, `TESORERIA GESTIONAR`.

## Fase 1 — PWA (esta rama: `fix/solicitud-pago-rol`)

1. `permisos.ts`: área nueva `solicitudPago` con esos roles; sacar la fila
   «Solicitudes de pago» de la tabla «sin rol» y explicar el origen en el JSDoc.
2. `operaciones.routes.ts`: `canActivate: [rolGuard('solicitudPago')]` en
   `solicitud-pago`. Cubre lista, `nueva` y `:id`, y con eso también las otras
   puertas que navegan ahí: escáner (`escaneo-ruteo.ts:68`), notificaciones
   (`destino-notificacion.ts:121`) y «Crear solicitud» desde una recepción
   (`recepcion-detalle.page.ts:594`; `RECIBIR PEDIDOS` está en la lista, así
   que quien llega a recepción sigue pudiendo).
3. `operaciones.page.ts`: la tarjeta va dentro de `@if (puedeSolicitudPago())`,
   igual que caja/recepción; actualizar el comentario.

**Tests** (`src/app/pruebas/permisos-y-guard.spec.ts`): pasa con
`RECIBIR PEDIDOS` y con `TESORERIA VER`; rebota con `VENTA TOUCH` y sin roles.
Más uno que lee `rutasOperaciones` y exige `canActivate` en `solicitud-pago`:
el spec llama al guard directo, así que sin este test sacar el guard de la
ruta no rompe nada (auditoría eje B). Revertir el guard de la ruta y ver que
ese test falla.

**Docs.** Bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md` con «Esperado» por
caso (entra con RECIBIR PEDIDOS, rebota con VENTA TOUCH, URL a mano, deep link
desde notificación, «Crear solicitud» desde recepción) y la fila en la tabla
«Resumen para completar»; corregir el caso 30.4
(`PLAN_TESTEO_MANUAL.md:2488-2490`), que dice que Solicitudes de pago se ve
siempre; `docs/modulos/operaciones-pagos-y-varios.md` si dice
que no lleva rol; el comentario de `operaciones.page.ts:27`. Y los pasos de
prueba escritos en la respuesta (regla 4.1).

**Sin datos nuevos** (no hay columna, clave ni campo). Sin migración.

**Riesgo.** Usuarios que hoy crean solicitudes desde la PWA sin ninguno de
esos roles dejan de ver la opción. El arreglo es asignarles el rol, no abrir
el guard. Un rol recién asignado se ve al reabrir la app (los roles se
traen al arrancar, `sesion.service.ts:71-83`), sin volver a iniciar sesión.
Un borrador `PENDIENTE` que dejó un usuario sin rol ya no lo abre él: se
termina desde el desktop. No se pudo contar en producción cuántos usuarios tiene cada rol (la
consulta de solo lectura a bodega fue rechazada en esta sesión).

**Límite.** Es control de interfaz: la API sigue aceptando las operaciones
hasta la fase 2.

**Descartado.** Venta con tarjeta ya tiene `rolGuard('ventaTarjeta')` en sus
rutas hijas (`venta-tarjeta.routes.ts:13,19`); el guard en el padre sobraba. Una
notificación manual hacia `/operaciones/solicitud-pago` a un usuario sin rol
termina en el aviso «No tenés permiso» y en Inicio.

## Fase 2 — central (rama aparte, PR aparte)

Pendiente de análisis de llamadores (desktop, PWA, procesos internos). Se
completa en este plan antes de implementarla.

## Sin verificar

- Conteo real de usuarios por rol en bodega y farmacia.
