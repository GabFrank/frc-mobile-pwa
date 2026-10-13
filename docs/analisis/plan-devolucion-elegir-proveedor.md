# Devolución nueva: elegir proveedor o seguir sin proveedor — PLAN

Rama `feature/devolucion-elegir-proveedor`, desde `develop`. Solo mobile-pwa.

## Qué pasa hoy

`DevolucionNuevaPage` manda siempre `tipo: SIN_PROVEEDOR` (`devolucion-nueva.page.ts:278`, con el
comentario «hasta que se porte el módulo de proveedores»). Una devolución sin proveedor solo puede
terminar en `DESCARTADO`: todo lo que se carga desde el teléfono queda como pérdida de la empresa,
aunque el producto se le pueda reclamar al proveedor. El escritorio sí deja elegir el tipo y el
proveedor.

`frc-mobile` (la APK) no tiene módulo de devoluciones: no hay pantalla que portar. La referencia es
el escritorio (`edit-devolucion.component`: selector de tipo + buscador de proveedor).

## Qué se hace

En la sección «Devolución» de la pantalla se elige **a quién va**:

- **Con proveedor** — aparece el buscador de proveedor (mismo patrón que la recepción de
  mercadería: campo + Buscar + cards; elegido se muestra con «Cambiar»). Se guarda
  `tipo: CON_PROVEEDOR` y `proveedorId`.
- **Sin proveedor** — no pide nada más. Se guarda `tipo: SIN_PROVEEDOR`, sin `proveedorId`.

**No hay valor por defecto.** El problema reportado es justamente que todo salía sin proveedor sin
que nadie lo decidiera; con un default, seguiría pasando. No se puede guardar hasta elegir, y con
«Con proveedor» hasta tener el proveedor.

Las reglas van en `devolucion-nueva.reglas.ts`, sin Angular, como `gastos-solicitud.reglas.ts`:

- `faltaParaGuardar(datos)` → qué le falta al operador, o `null`.
- `destinoParaInput(destino, proveedor)` → `{ tipo, proveedorId? }`; nunca manda `proveedorId` con
  `SIN_PROVEEDOR`.

`DevolucionService.proveedores(texto)` reusa `ProveedoresPorTextoGQL` (ya portado; lo usan
recepción, gastos y solicitud de pago).

El detalle ya muestra el proveedor si lo hay (`devolucion-detalle.page.ts:84`). Se suma el tipo al
historial solo si no está.

## Fases

1. Reglas + tests (`devolucion-nueva.reglas.spec.ts`).
2. Servicio + pantalla, con sus estados: buscando, sin resultados («Ningún proveedor con ese
   nombre»), error de red.
3. `docs/modulos/operaciones-devolucion.md` y bloque 13 de `docs/PLAN_TESTEO_MANUAL.md` con la tabla
   de totales. Este plan se borra en el PR.

Gate: `npm test` y `npm run build`, con Node 20.

## Contrato

Sin cambios en el central: `saveDevolucion` ya acepta `tipo: CON_PROVEEDOR` + `proveedorId` (es lo
que manda el escritorio) y `proveedorSearchByPersonaPage` ya existe en los tres canales (lo usa la
recepción). No depende de promover el central.

Lo que cambia para el circuito: una devolución con proveedor creada en el teléfono se separa ahí y
sigue en el escritorio (colecta, retiro, canje o crédito), y empieza a aparecer en el aviso
«Devoluciones en espera» de compras y en el retiro consolidado de ese proveedor.

## Datos nuevos

Ninguno.

## Sin verificar

- Prueba en un teléfono real y en Safari (teclado sobre el buscador de proveedor).
- Que el rol que carga devoluciones en la sucursal sepa a qué proveedor corresponde cada producto:
  la pantalla no lo sugiere.
