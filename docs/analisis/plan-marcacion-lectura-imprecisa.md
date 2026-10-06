# Plan — Marcación: lectura imprecisa y cambio de sucursal al marcar

Rama: `fix/marcacion-lectura-imprecisa-y-cambio-de-sucursal` (desde `develop`).
Solo `mobile-pwa`. No toca GraphQL, ni el central, ni persistencia.

## Qué pasó

Bodega, 06/10/2026, 08:00–08:01, usuario 410, iPhone con Safari, primer piso
del Depósito Aquario (sucursal 13):

1. Al abrir la pantalla, la sucursal detectada fue **Calle 10** (sucursal 6),
   a ~1,1 km del depósito según las coordenadas cargadas.
2. Tocó «Marcar entrada», pasó la verificación facial y **no se guardó nada**.
   La pantalla quedó mostrando el depósito.
3. Segundo intento: error del central en pantalla (fallo de serialización,
   SQLState 40001, a las 08:00:48). **Fuera de este plan**: es un fix del
   central, en rama y PR aparte.
4. Tercer intento: guardó (08:01:16, a 26 m, ±15 m).

## Causa

**1 — Se perdió el tope de precisión al portar el GPS.** El
`NativeLocationPlugin` de `frc-mobile` solo acumula lecturas con
`accuracy <= 80` (`NativeLocationPlugin.java:83`) y, si al agotarse el tiempo
no tiene ninguna, rechaza. `GeoService.posicionActual()` de la PWA, en cambio,
al agotarse los 6,3 s usa **cualquier** lectura que tenga
(`geo.service.ts:133-134`: `buenas.length > 0 ? buenas : lecturas`). Una
primera lectura por red, con cientos de metros de error, alcanza para que
`detectarSucursal` —que no mira la precisión— elija otra sucursal.

No confirmable con datos: la lectura de la apertura no se guarda. Lo que sí
hay: las cinco marcaciones guardadas de ese usuario tienen ±15 a ±23 m y caen
a 24–58 m del depósito, y ese camino del tiempo agotado es el único del código
que acepta una lectura capaz de errar por más de 550 m.

**2 — El corte por cambio de sucursal avisa con un cartel pasajero.**
`marcacion.page.ts:388`: si la más cercana cambió entre la apertura y el
toque, no se marca y se muestra un `notificacion.warn`. Llega **después** de
la verificación facial, se va solo, y el rostro ya verificado se descarta. Lo
mismo pasa cuando al marcar no hay posición (`marcacion.page.ts:378`).

## Evidencia para el tope

`administrativo.marcacion` de bodega, desde el 01/09/2026:

| Método | Filas con precisión | Peor | p95 | Peores que ±80 m |
|---|---|---|---|---|
| sin método (clientes anteriores) | 180 | ±46 m | ±31 m | 0 |
| `FACIAL_1A1` | 58 | ±42 m | ±29 m | 0 |
| `FACIAL_1AN_KIOSCO` | 22 | ±25 m | ±20 m | 0 |
| `MANUAL` | 12 | ±26 m | ±26 m | 0 |

Farmacia no tiene marcaciones en ese período.

⚠️ **El dato está censurado y hay que leerlo así.** Solo hay filas de lo que se
guardó, y la precisión guardada es la mejor de las lecturas usadas. Lo que
prueba es que **quien marcó consiguió siempre una lectura de ±46 m o mejor**;
no prueba que las malas no ocurran —el incidente es una—. Alguien que no
bajara nunca de ±80 m habría dejado filas con esa precisión, y no hay ninguna.

## Fase 1 — El tope de precisión vuelve a `GeoService`

- `geo.service.ts`: constante `PRECISION_DESCARTE_M = 80`. Una lectura peor
  **no se acumula** (igual que el plugin nativo). Su precisión se recuerda
  aparte, para poder decirla.
- **Una segunda ventana cuando solo hubo lecturas descartadas.** `frc-mobile`,
  ante el rechazo del plugin, hacía un segundo intento de 7 s
  (`geo-location.service.ts:59-66`). Acá: si al agotarse los 6,3 s no hay
  ninguna lectura usable pero sí descartadas, se espera **una** ventana más
  antes de rendirse. Con lecturas de hasta 80 m se devuelve la aproximada al
  primer tope, como hoy.
- Sin ninguna usable tras la segunda ventana: `null`, con «La ubicación es
  poco precisa (±N m). Revisá que «Ubicación precisa» esté activada para el
  navegador, probá cerca de una ventana y volvé a intentar.» Sin N si no se
  llegó a informar ninguna.
- **El error del `watchPosition` deja de decir siempre «revisá el permiso».**
  Solo `PERMISSION_DENIED` cierra con ese mensaje. `TIMEOUT` y
  `POSITION_UNAVAILABLE` no cierran: decide el reloj propio, que sabe si hubo
  lecturas descartadas.
- `PRECISION_MAXIMA_M` (33 m), calentamiento y lecturas mínimas no cambian.
- `kiosco-marcacion.page.ts`: el detalle de `sin-posicion` muestra el mensaje
  del `GeoService`, con el texto actual como respaldo.
- No hay estado nuevo de detección: cae en `sin-posicion`, que ya deshabilita
  los botones en las dos pantallas.

Tests (`src/app/pruebas/geo-precision.spec.ts`, nuevo, con
`navigator.geolocation` falso y reloj falso; las lecturas se emiten **después**
del calentamiento, o el código viejo también daría `null`):

- solo una lectura de ±900 m → `null` tras la segunda ventana, mensaje con el
  ±900. **Falla con el código viejo.**
- ±900 m y después ±60 m → devuelve la de ±60 m, con `lecturas: 1` y su
  latitud (la precisión sola no distingue del código viejo).
- ±900 m en la primera ventana y ±15 m dos veces en la segunda → posición
  buena. **Falla con el código viejo** (cerraba con la mala).
- ±60 m sola → aproximada al primer tope, sin esperar la segunda ventana.
- dos de ±15 m → termina antes del tope.
- `TIMEOUT` del watch después de lecturas descartadas → mensaje de poca
  precisión, no de permiso. `PERMISSION_DENIED` → mensaje de permiso.
- una lectura mala solo durante el calentamiento → `null`, mensaje sin N.

En `marcacion-kiosco.spec.ts`: sin posición, el kiosco muestra el mensaje del
servicio, y el de respaldo si no hay.

## Fase 2 — Al marcar, lo que falla se dice en un diálogo y no se pierde el rostro

En `MarcacionPage.marcar()`, después de la verificación facial. Las señales
`marcando` y `enCurso` se apagan en un `finally`, no a mano en cada salida.

- **No hay posición al marcar** → diálogo con el mensaje del `GeoService` y
  «Reintentar», que vuelve a tomar la posición **sin repetir el rostro**.
  Hasta **3 tomas**; después, o cancelando, no se marca. Si lo que falta son
  las coordenadas de las sucursales (`sin-coordenadas`), no se ofrece
  reintentar: se avisa y se corta.
- **Cambió la sucursal más cercana y la nueva queda cerca** (no `estaLejos`)
  → diálogo: «Al abrir la pantalla figurabas en A. Ahora la ubicación da B, a
  N m (±P m).» Botón «Marcar en B». Confirmando se marca contra **B** con la
  posición del momento. El nombre de A sale de lo detectado al abrir, no de la
  señal, que ya cambió.
- **Cambió y la nueva queda lejos** → diálogo informativo y **no se marca**,
  como hoy. Dos confirmaciones encadenadas guardarían con dos toques una
  sucursal dudosa.
- **El rostro verificado vale 2 minutos.** Si entre reintentos y diálogos pasa
  más, se corta y hay que empezar de nuevo: la marcación no puede quedar como
  facial con una cara tomada mucho antes.
- La sucursal sigue saliendo solo del GPS del momento. Nunca se marca contra A.

Tests (`marcacion-sucursal-gps.spec.ts`; el falso de diálogos pasa a responder
por título y la verificación lleva contador):

- cambia a una cercana y se confirma → guarda con el `sucursalId` nuevo, la
  posición del momento y `FACIAL_1A1`; rostro pedido una vez. **Falla con el
  código viejo.**
- cambia a una cercana y se cancela → no guarda.
- cambia a una lejana → no guarda ni ofrece marcar.
- se pierde la posición, «Reintentar», la segunda toma sale bien → guarda con
  `FACIAL_1A1`; rostro pedido una vez. **Falla con el código viejo.**
- se pierde tres veces → no guarda y deja de ofrecer.
- se pierde y se cancela → no guarda.
- pasan más de 2 minutos desde el rostro → no guarda.
- sin coordenadas al marcar → no ofrece reintentar.
- en cada salida sin guardar: `marcando() === false` y `enCurso() === null`.
- Se reescriben los tests actuales de las líneas 459 y 469, que afirman el
  cartel.

## Fase 3 — Documentación

- `docs/modulos/marcacion.md`: «El GPS se reimplementó» (el tope de 80 m, la
  segunda ventana y de dónde salen), «La posición se toma dos veces» (los
  diálogos), y los tres lugares que hoy afirman que la precisión nunca impide
  marcar (líneas 167-171, 225 y 236-239). Lo mismo en los comentarios de
  `geo.service.ts` y `deteccion-sucursal.util.ts`.
- `docs/PLAN_TESTEO_MANUAL.md`: bloque nuevo con «Esperado» por caso y la
  tabla de totales. Los pasos van también escritos en la respuesta (regla 4.1).
- Se borra este plan al terminar, como los anteriores.

## Datos nuevos

Ninguno. No nace campo, columna ni clave: `precisionGps` y
`distanciaSucursalMetros` ya viajan y no cambian de significado.

## Qué queda sin verificar

- **Que el tope arregle el caso real.** No se puede reproducir una lectura por
  red a pedido. Antes del PR se prueba en el iPhone con el build de producción
  de la rama servido por túnel contra alpha (como el bloque 72), anotando la
  versión instalada; después, abriendo la pantalla en frío varias mañanas en
  el depósito.
- **Quien no baje de ±80 m no puede marcar desde la PWA**, y ese rechazo no
  queda registrado: no hay dónde guardarlo sin tocar el central. Su salida es
  la marcación cargada por RRHH. Los datos dicen que hoy no le pasa a nadie;
  si pasa, el número a revisar es `PRECISION_DESCARTE_M`, y cambiarlo exige
  publicar una versión nueva.
- Safari en iPhone real y Chrome en Android real: los diálogos nuevos.

## Hallazgos de la auditoría del plan

Dos auditores, por separado (contrato y propagación; reversibilidad y estado).

| Hallazgo | Qué se hizo |
|---|---|
| El kiosco puede quedar sin marcar con el tope | Medido: kiosco peor ±25 m en 22 filas. Tabla arriba |
| El dato de ±46 m está censurado | Reescrita la evidencia con ese límite dicho |
| La app vieja tenía un segundo intento | Segunda ventana en la fase 1 |
| El error del watch pisa el mensaje nuevo | Ramificado por código de error, con test |
| El mensaje no nombra «Ubicación precisa» | Agregado al texto |
| «Reintentar» sin tope cuelga los tests y al usuario | Tope de 3 tomas |
| Dos confirmaciones encadenadas (cambió + lejos) | Si la nueva queda lejos, no se ofrece marcar |
| El rostro verificado no vence | Vale 2 minutos |
| Señales colgadas, nombre de A, sin-coordenadas | `finally`, nombre desde la apertura, sin reintento |
| Los textos que dicen «la precisión no bloquea» | Listados en la fase 3 |
| Los rechazos no quedan registrados | No se hace: necesita el central. Anotado arriba |
| Dos operables a menos de 100 m entre sí | Descartado: la 500 y la 501 tienen `localizacion` «0» y no compiten; la operable más cercana a la 13 está a más de 600 m |
| El tope llega antes a farmacia que a bodega | Farmacia no tiene marcaciones: no afecta a nadie hoy |

## Fuera de alcance

- El fallo de serialización de `MarcacionService.save` en el central (una
  ocurrencia en el log del 01 al 06/10). Rama y PR propios en el central.
- Reintentar solo la detección al abrir la pantalla.
