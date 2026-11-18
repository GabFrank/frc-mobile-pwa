# Plan: el buscador muestra cada precio en su moneda (#152)

Issue #152 (encontrada al auditar el plan de #148). Rama: `fix/producto-buscador-moneda-precio` (desde `develop`
0336241, con #151 mergeado). Pieza: **mobile-pwa**. Sin backend.

## Problema

- `shared/producto/producto-card.component.ts:159` fija `moneda="Guaraní" simbolo="₲"` en el precio de cada
  presentación: PROMOCION 5,85 USD sale «₲ 6».
- `shared/producto/buscador-producto.component.ts:109,116`: el precio por kilo y el total del pesable, igual. Además
  el total hace `Math.round(precio × peso)`: en USD perdería los centavos.

## Enfoque

1. Una función `monedaDePrecioEscogido(presentacion, estado)` en `shared/producto/presentacion.util.ts`: toma
   `precioEscogido()` (el mismo precio que muestran la card, el pesable y el kiosco) y delega en
   `monedaGuardadaDePrecio()` (#148) con la lista de la sesión. **Sin consulta por producto**: la card vive en una
   lista y la sesión ya conoce los activos en otra moneda; un principal inactivo en otra moneda queda «sin
   confirmar», nunca ₲.
2. ⚠️ `precioPrincipal.id` es **el id de la presentación** (#142). Si el precio escogido no salió de `precios`
   (ids reales) el id no sirve: se trata como un precio sin id → «no se sabe» con un central que maneja monedas,
   la de la empresa con un central viejo. Nunca se busca la moneda con el id de la presentación.
3. El pesable: `codigoPorCodigoQuery` suma `precios { id precio principal activo }`. Son campos que todo central
   ya tiene (`productoPorCodigoQuery` los pide); su único llamador es `ProductoBusquedaService.pesable`. Sin eso
   el precio del pesable no tiene id real y saldría siempre «sin confirmar».
4. Card y pesable: con moneda conocida, `referenciaDePrecio()` → `<frc-importe>`; sin saberla, el número sin
   símbolo y el chip «Moneda sin confirmar», como la ficha.
5. El total del pesable deja de redondear a entero: `frc-importe` ya formatea con los decimales de la moneda (el
   guaraní sigue sin decimales, mismo redondeo de `Intl`).
6. El buscador llama `PrecioMonedaService.listo()` al buscar: si la lista de la sesión quedó sin respuesta, la
   vuelve a pedir (lo mismo que hace la ficha). Sin respuesta, el precio queda «sin confirmar».
7. **El kiosco** (`kiosco.page.ts:801`) buscaba la moneda con `precioEscogido(p)?.id`, que puede ser el id de la
   presentación: pasa a `precioConIdEscogido()`, la misma que usa la función del punto 1 (hallazgo del eje A).

Con un central viejo (beta y prod hoy, sin V260.5) todo sigue en ₲ **una vez que la lista de la sesión respondió**
(error de GraphQL, menos de un segundo). Mientras no respondió, o si no responde por red, la card y el pesable
muestran el número con «Moneda sin confirmar», como la ficha (#148): es el criterio, no ₲ por descarte.

**Descartado:** la consulta por producto (`MonedaDePreciosDeProducto`) al expandir la card: una consulta más por
fila abierta para cubrir solo un principal inactivo en otra moneda, que igual queda «sin confirmar», no en ₲.

## Fase única

- `presentacion.util.ts`: `monedaDePrecioEscogido()`, con sus casos en un spec (id real, `precioPrincipal`
  solo, central viejo, sin respuesta).
- `producto-card.component.ts`: la referencia por presentación y la plantilla.
- `buscador-producto.component.ts`: el pesable y `listo()`.
- `graphql-query.ts`: `precios` en `codigoPorCodigoQuery`.
- Test en `pruebas/buscar-producto.spec.ts`: la card de un precio en USD sale «US$» y no «₲»; el pesable en USD
  con centavos. Falla con el código viejo.
- `docs/PLAN_TESTEO_MANUAL.md`: bloque 110.

## Verificación

`npm test`, `npm run build` y por pantalla contra el alpha local (COCA COLA 1.5 L en USD, ACTOCEF en ₲; un pesable
en USD si alpha tiene uno, si no forzado).

## Auditoría del plan

- **Eje A** (acepta con reservas): la card con precio solo la usa `buscar.page.ts`; el pesable se ve además en los
  diálogos de inventario, transferencia, devolución y compras (se prueban por pantalla); `codigoPorCodigoQuery` solo
  la usa el respaldo del pesable y los campos ya los pide `productoPorCodigoQuery`. MAYOR aplicado: el kiosco
  (punto 7). Sin otros ₲ fijos de precios de producto. Abierto: `precioEscogido` iguala el principal por importe
  (dos principales del mismo importe en monedas distintas), ya existía.
- **Eje B** (acepta con reservas): sin camino a ₲ por descarte. Aplicado: `listo()` sin rastrear (el effect de
  `codigoInicial` llega a `buscar`/`buscarPesable`); el chip en beta/prod durante la ventana de arranque queda
  escrito arriba; caso de spec «sin id y lista sin llegar». Quitar `Math.round` no cambia ₲ (`Intl` redondea igual)
  y el total no se emite.

## Auditoría del diff

Fijo 1 y Fijo 2: N/A para mobile-pwa, sin backend, `.graphqls` ni migración. Fijo 3 (contrato y versiones):
`precios` en `codigoPorCodigoQuery` no rompe un central viejo (los mismos campos ya los piden `productoPorCodigo` y
`productoPorId`, sin `moneda`); contra beta y prod, ₲ una vez que respondió la lista. Sin HIGH. Aplicado: casos de spec
del inactivo en USD y del pesable sin moneda. Sin aplicar, ya existían: la caché de Apollo sin `keyFields` para
`PrecioPorSucursal` (`precioPrincipal` comparte entrada con el precio real del mismo id); el kiosco, con un precio
escogido sin id, cae en la moneda de la empresa (sus consultas traen `precios`, así que no pasa); `sinMoneda`
escribe 3 USD como «3», como la ficha.

## Sin verificar

El teléfono físico y un pesable real con precio en USD (alpha no tiene ninguno; se forzó por XHR).
