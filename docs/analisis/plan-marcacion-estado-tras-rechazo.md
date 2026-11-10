# Plan — la pantalla de marcación queda con el estado viejo

Rama: `fix/marcacion-estado-tras-rechazo` (desde `develop`). Solo PWA.

## Síntoma (28/10, iPhone 11, bodega)

A las 08:06 la pantalla de Marcación mostraba «Fuera de jornada», la jornada
del 27/10 y el botón «Marcar entrada». Al tocarlo, el central respondió «Ya
registró entrada en la jornada del día…». Hubo que cerrar la app y reabrirla
para ver que la entrada ya estaba.

## Lo que dicen los datos (bodega, solo lectura)

- Marcación 6867, ENTRADA, **2026-10-28 08:04:07**, `MANUAL`, device iPhone OS
  18_7: la hizo esta misma PWA dos minutos antes de la captura.
- Jornada 2501 (28/10) quedó INCOMPLETO con esa entrada. El rechazo de las 08:06
  es correcto.
- El botón decía «Marcar entrada», no «Marcando…»: el pedido de las 08:04
  **terminó**, y la app no lo tomó como éxito (si no, habría mostrado
  «Marcación registrada» y recargado). O se perdió la respuesta, o el central
  devolvió error después de guardar. No se pudo distinguir (haría falta el log
  del central de ese momento).

## Causa en la PWA

`MarcacionPage.enviar()`: ante error muestra el aviso y **no recarga el estado**.
Si el guardado en realidad entró, la pantalla sigue ofreciendo la misma acción
y el siguiente toque choca con el central. Y la pantalla carga el estado una
sola vez, al montarse: si iOS la deja viva en segundo plano, al volver muestra
lo de cuando se abrió (no hay `visibilitychange` en todo `src/app`).

## Fase 1 — un commit

`pages/marcacion/marcacion.page.ts`
- `enviar()`, rama de error: después del aviso, `this.cargar()`. Si el central
  guardó, la pantalla pasa a «En jornada · falta salida»; si no, muestra lo
  mismo que antes. El aviso no cambia.
- Al volver la app al frente (`document.visibilitychange` → `visible`):
  `cargar()` y `det.detectar()`. **No** si hay una marcación en curso
  (`enCurso() != null` o `marcando()`): `detectar()` borra `posicion` al
  empezar, y `marcar()` la lee después de su propio `detectar()` — una
  detección cruzada le dejaría la marcación sin posición. El listener se quita
  con `DestroyRef`.

- **Las recargas automáticas son silenciosas** (`cargar({ silenciosa: true })`):
  `estado()` con `{ notificarError: false, mostrarCarga: false }`, sin tocar
  `cargando` ni `error`; si fallan, queda el estado anterior. Sin esto, volver
  al frente con la red todavía caída (habitual en iOS) cambiaba una pantalla
  que funcionaba por la de error, con un aviso rojo, y tras un rechazo el aviso
  de la recarga tapaba «Ya registró entrada…» (MatSnackBar muestra uno solo).
  `MarcacionService.estado` pasa a aceptar `OpcionesOperacion`.
- **Solo vale la última respuesta del estado** (contador de pedido): una
  recarga vieja no pisa a una nueva.
- Al volver al frente tampoco se relanza la detección si ya hay una en curso
  (`det.estado() === 'buscando'`): apiladas, una vieja que termina sin
  posición después de una nueva dejaba «sin ubicación» con la sucursal puesta.

No se toca el central: sus dos reglas (estado y validación de entrada) se
comportaron bien. No se toca el kiosco: no muestra estado del usuario.

### Tests (vitest, `marcacion.spec.ts`)

- Guardado que vuelve con error → el estado se vuelve a pedir y la pantalla
  muestra el estado nuevo (con el código viejo: se pide una sola vez).
- `visibilitychange` a `visible` → se pide el estado y se vuelve a detectar.
- `visibilitychange` con una marcación en curso → no se pide nada.
- Al destruir la pantalla, un `visibilitychange` no hace nada.
- Volver al frente con la recarga fallando → sigue el estado anterior, sin
  aviso ni pantalla de error.
- Los casos «en curso» y «destruida» pasan también sin listener: se validan
  quitando la guarda y el `removeEventListener` y viendo que fallan.

### Datos nuevos

Ninguno.

## Prueba de runtime

Chromium (Playwright) contra el central alpha local:
- Interceptar `saveMarcacion` para que responda error **después** de dejarlo
  pasar al central (o simular «guardó pero respondió error»): la pantalla debe
  pasar al estado nuevo sin recargar la app. Se cancela la marcación real al
  final si queda alguna en alpha.
- Simular el paso a segundo plano (`visibilitychange` con `visibilityState`
  forzado) y ver que el estado y la ubicación se vuelven a pedir.
- iPhone: dejar la app en Marcación, ir a otra app, volver: el estado se
  refresca. Con modo avión al volver: la pantalla sigue usable, sin avisos.
  Alternar apps 5 veces seguidas: sin avisos ni detecciones colgadas.

## Hallazgos de la auditoría (paso 5)

| # | Eje | Hallazgo | Qué se hizo |
|---|---|---|---|
| 1 | A y B | Recarga automática que falla: pantalla de error, aviso rojo, tapa el aviso del central | Recargas silenciosas; si fallan, queda el estado anterior |
| 2 | B | Detecciones apiladas al alternar apps | No se relanza si hay una en curso |
| 3 | A y B | Respuestas de `cargar()` fuera de orden | Contador de pedido |
| 4 | B | `puedeMarcar` no espera la recarga | **No se hace**: el central rechaza y la recarga posterior corrige. Anotado |
| 5 | B | Dos tests nacen verdes | Se validan quitando la guarda y el listener |
| 6 | A | El aviso del guardado sale dos veces (`DatosService` + la pantalla) | **No se hace**: existía antes y no es este bug |
| 7 | B | Volver al frente con un diálogo abierto y cancelar: no se refresca hasta la próxima vuelta | Aceptado |
| 8 | A y B | iOS con ubicación «Preguntar»: ¿reaparece el permiso en cada vuelta? | A ver en el iPhone |

## Sin verificar

- Por qué el guardado de las 08:04 volvió como no exitoso (red o error del
  central después de guardar).

## Documentación

- `docs/PLAN_TESTEO_MANUAL.md`: caso nuevo en el bloque de marcación y totales.
- `docs/modulos/marcacion.md`: el estado se recarga tras un rechazo y al volver.
- El plan se borra en el PR final.
