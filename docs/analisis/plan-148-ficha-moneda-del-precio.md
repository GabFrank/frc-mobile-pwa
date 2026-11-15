# Plan: la ficha del producto muestra cada precio en su moneda (#148)

Issue #148 (reporte de alpha, 13/11/2026). Rama: `fix/producto-ficha-moneda-precio` (desde `develop` f65f6f6).
Pieza: **mobile-pwa**. Sin backend: todo lo que se usa ya existe en el central.

## Problema

`pages/producto/producto-detalle.page.ts:107` fija `moneda="Guaraní" simbolo="₲"` en todos los precios. Un precio
de 5,85 USD sale «₲ 6». La consulta de la ficha (`productoPorIdQuery`) no pide la moneda de los precios.

## Enfoque

Reusar lo que ya resuelve la pantalla de Precios (`editar/precios.page.ts`, #137/#139):

1. **La moneda por producto**: `MonedaDePreciosDeProductoGQL` (activos **e inactivos**: la ficha muestra los dos),
   `network-only`, sin toast. Se pide solo si el central maneja monedas (`preciosMonedaSoportado` o
   `preciosMonedaSinRespuesta`), igual que Precios.
2. **La lista de la sesión** (`MonedasSesion.preciosOtraMoneda`) mientras la anterior no llegó o si no respondió.
3. La decisión «`null` = la de la empresa, `undefined` = no se sabe» hoy vive en `PreciosPage.monedaGuardada()`. Se
   **mueve** a una función pura `monedaGuardadaDePrecio()` en `domains/moneda/precio-moneda.ts` y la usan las dos
   pantallas: no se duplica la regla. `monedaGuardada()` queda como envoltorio con la misma salida.
4. Con moneda conocida: `referenciaDePrecio(moneda, empresa)` → `<frc-importe>`, como Precios y el kiosco.
   Sin saberla: el número sin símbolo (`formatearCantidad`, con centavos si los tiene) y el chip «Moneda sin
   confirmar». Nunca ₲ por descarte.
5. Contra un central viejo (la lista de la sesión respondió `sinConsulta`): todo en la moneda de la empresa, como hoy.
   Es lo que pasa hoy en beta y prod: `PrecioPorSucursal.moneda` (V260.5) solo está en `develop` del central.
6. **Mientras la lista de la sesión no llegó** (`preciosMonedaListos` false: recarga o deep link a `/producto/:id`,
   `sesion.service.ts:97` la pide sin esperar) **no se sabe**, no «central viejo»: la función recibe `listos` y
   devuelve `undefined`. Hoy la regla de Precios cae ahí en `null` → ₲ por hasta 8 s. **Precios cambia igual**
   (mismo hueco): esa página no tiene spec, se prueba por pantalla.
7. La lectura por producto copia la guarda de Precios (`lecturaMonedas` + id actual, `precios.page.ts:679,684`) y
   reinicia el mapa al cambiar de id: el `effect` de la ficha recarga con el mismo componente.

El precio «suelto» (presentaciones sin lista) usa el id real de `precioPrincipal` (`graphql-query.ts:150`), no `-1`:
si ese principal está en USD, también tiene que salir en USD.

**Fuera de alcance**: la card del buscador (`shared/producto/producto-card.component.ts:159`) y el pesable
(`shared/producto/buscador-producto.component.ts:109,116`) también fijan ₲. Issue aparte.

**Descartado:** agregar `moneda` a `productoPorIdQuery` (un central viejo rechazaría la consulta entera y la ficha no
abriría); usar solo la lista de la sesión (no conoce los inactivos: un inactivo en USD seguiría saliendo en ₲).

## Fase única

- `precio-moneda.ts`: `monedaGuardadaDePrecio()`, con sus casos en `precio-moneda.spec.ts` (por producto, sesión,
  inactivo sin dato, central viejo, sin respuesta, lista todavía sin llegar).
- `precios.page.ts`: `monedaGuardada()` delega en la función.
- `producto-detalle.page.ts`: la lectura por producto, la referencia por precio y la plantilla.
- **Test** de la ficha (`producto-detalle.page.spec.ts`): un precio en USD sale «US$» y no «₲»; un central sin la
  consulta sale en ₲; sin respuesta sale sin símbolo. El primero falla con el código viejo.
- `docs/PLAN_TESTEO_MANUAL.md`: bloque 109 con sus casos y la fila en el resumen.

Datos nuevos: ninguno (se leen campos que el central ya da).

## Verificación

`npm test`, `npm run build` y por pantalla (`npm start`, 4300) contra un central con precios en USD: la ficha de un
producto con PROMOCION en USD, uno todo en ₲, uno con precio inactivo en USD, y la red cortada al abrir la ficha.

## Auditoría del plan

- **Eje A** (acepta con reservas): sin cambio de contrato; `monedaGuardada` solo la usa `precios.page.ts`; la ficha
  se abre solo por ruta con id. Hallazgos: ₲ antes de que llegue la lista (→ punto 6), id del precio suelto (→ arriba),
  card del buscador y pesable con ₲ fijo (→ fuera de alcance, issue aparte).
- **Eje B** (revisar): mismo hallazgo de la lista sin llegar (→ punto 6), respuestas fuera de orden (→ punto 7), id del
  suelto. Sin riesgo: la lectura de moneda no bloquea `cargando()`; GraphQL vs transporte ya los separa
  `esFalloDeTransporte`; se revierte con un commit, sin datos ni consultas nuevas.

## Sin verificar

El teléfono físico.
