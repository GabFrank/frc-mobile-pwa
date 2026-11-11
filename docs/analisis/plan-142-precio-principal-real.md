# Plan #142: el kiosco toma el precio principal con su id real

Issue: GabFrank/frc-mobile-pwa#142. Rama: `fix/kiosco-precio-principal-real` (desde `develop` d88eba3). Pieza:
**mobile-pwa**. El arreglo del central va aparte (GabFrank/franco-system-backend-servidor#605, Gabriel).

## Problema

`precioEscogido` (`shared/producto/presentacion.util.ts`) devuelve `presentacion.precioPrincipal`. El central lo arma
con una consulta nativa `select *` sobre `presentacion` join `precio_por_sucursal`, y el `id` que llega es el de la
**presentación** (#605). El kiosco usa `precioEscogido(p).id` para buscar la moneda del precio (`monedaPropiaDe`): no
la encuentra y **muestra en guaraníes un precio principal en dólares**, ante el cliente (alpha 11/11/2026: «₲ 5» en
vez de «US$ 4,55»; presentación 5, precio 10).

## Enfoque

El **importe** de `precioPrincipal` está bien (la columna `precio` solo existe en `precio_por_sucursal`); lo que llega
mal es el `id` (y `activo`, `principal`, `creado_en`, `usuario_id`, que la PWA no lee). Hay que encontrar en la lista
`precios` **ese mismo precio** para tener su id real, sin cambiar el importe que se muestra hoy:

1. con `precioPrincipal` con importe: el de la lista que es `principal` y tiene **el mismo importe**; si ninguno
   coincide, `precioPrincipal` como hoy (el importe no cambia; el id sigue siendo el del central);
2. sin `precioPrincipal`: el primero de la lista que es `principal` con importe;
3. si no: el primer activo con importe (como hoy).

**Por qué por importe y no el primer principal de la lista:** en alpha hay **67 presentaciones con dos precios
principales** (filas viejas), y en **55** los importes difieren. El central elige uno con `limit 1` sin orden; tomar
otro de la lista cambiaría el importe del kiosco, la ficha y el buscador (auditoría A1/B1). Comparando el importe se
elige el mismo que el central.

Solo el kiosco usa el id (`monedaPropiaDe`); `precioDe` (importe) lo usan también ficha, buscador y tarjeta, y no
cambia en ningún caso.

**Descartado:** el primer principal de la lista (cambia importes con principales duplicados); arreglar la consulta
del central desde acá (#605 es de Gabriel); comparar también la moneda (no viaja en estas consultas).

## Fase única

- `presentacion.util.ts`: la regla de arriba y su comentario (con el porqué y #605).
- **Tests** (spec nuevo `src/app/pruebas/precio-escogido.spec.ts`, fallan con el código viejo):
  - lista con el principal id 10 y `precioPrincipal` id 5 con el mismo importe → id 10;
  - **dos principales en la lista con importes distintos** → el del importe de `precioPrincipal`, no el primero;
  - ningún principal de la lista con ese importe → `precioPrincipal` (como hoy);
  - sin `precioPrincipal` → el principal de la lista; principal sin importe → se saltea;
  - sin principal en ninguno → primer activo con importe;
  - `precioDe` da el mismo importe que antes en todos los casos;
  - kiosco: `monedaPropiaDe` con `monedaDe` simulado → pide la moneda del precio 10, no del 5.
- `docs/PLAN_TESTEO_MANUAL.md`: bloque nuevo y totales. `docs/modulos/producto.md`: nota.

## Pruebas de runtime

PWA local contra alpha (MR), kiosco: BANES FORTE con el precio 10 en 4,55 US$ → «US$ 4,55»; en Gs → «₲ 20.735»;
ficha de producto y buscador con el mismo importe que antes. Al terminar, precio 10 en 20.735 Gs.

## Auditoría (paso 5, 11/11/2026)

| # | Hallazgo | Qué se hizo |
|---|---|---|
| A1/B1 | Varios principales por presentación: el primero de la lista puede no ser el del central | Verificado en alpha (67, 55 con importes distintos); se elige el principal **con el mismo importe** que `precioPrincipal` |
| A2 | `codigoPorCodigo` no trae `precios` | Cae a `precioPrincipal`, solo usa el importe: sin cambio |
| A3 | Otros campos de `precioPrincipal` vienen de la presentación (`activo`, `principal`...) | La PWA solo lee `id` y `precio`: anotado en el comentario |
| B2 | Claves de la conversión del kiosco | Por id de presentación: no cambian |
| B3 | Principal inactivo mostrado en el kiosco | Regla del central (`where c.principal = true`), sin cambio; fuera de alcance |
| B4 | Specs existentes | Siguen pasando (ningún fixture con principal en la lista y `precioPrincipal`) |
| B5 | Tests que no fallaban con el viejo; faltaban casos | Reescritos: duplicados con importes distintos, principal sin importe, `monedaPropiaDe` del kiosco |

## Sin verificar

- Dos principales con **el mismo importe** en monedas distintas (p. ej. 10 Gs y 10 US$): se elige el primero de la
  lista; la moneda no viaja en estas consultas para desempatar.
