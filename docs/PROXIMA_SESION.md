# Dónde retomar

> **Al 2026-08-07.** Rama `feature/solicitud-pago`, PR #1 abierta contra
> `develop`. Todo lo hecho está commiteado y pusheado.
>
> Este archivo es un **traspaso, no una hoja de ruta**: dice qué quedó a medio
> camino y con qué hay que tener cuidado al retomarlo. Cuando la PR se cierre y
> el bloque 5 termine, borrarlo — un traspaso viejo miente más que un archivo
> que no existe.

## Lo que se hizo

**`solicitud-pago`** — lista, alta desde el menú o desde una recepción
finalizada, envío a la cola de pagos, detalle y constancia en PDF. Cierra la
Ola A. `pago` **no se porta**, y es una decisión: ver
[`modulos/operaciones-pagos-y-varios.md`](modulos/operaciones-pagos-y-varios.md).

**Actualización de la app instalada** — el service worker no adoptaba nunca una
versión y la app no se actualizaba jamás. Arreglado y con aviso que se puede
postergar. Ver [`arquitectura/actualizaciones-app.md`](arquitectura/actualizaciones-app.md).

**Íconos de la PWA, barra de acciones y varios arreglos** salidos de probar en
un teléfono real.

## Lo que falta, en orden

### 1 · Terminar el bloque 5 — un solo caso

La segunda mitad de **5.5**: que el aviso de actualización **reaparezca solo**
después de postergarlo. El procedimiento completo está en el bloque 5 del
[plan de testeo](PLAN_TESTEO_MANUAL.md). Necesita:

- El teléfono conectado por USB con los túneles armados.
- El central arriba **y sesión iniciada** en la app: sin backend, cualquier
  recarga termina en el login y no hay forma de ver el diálogo.

### 2 · Los dos casos de `solicitud-pago` que quedaron sin datos

- **21.10, monedas mezcladas** — hoy las 12 notas elegibles están todas en
  guaraníes. Hace falta una nota en otra moneda.
- **21.16, con pago vigente** — el único pago que existe está cancelado. Uno
  nuevo se crea desde el escritorio.

### 3 · El grueso del plan de testeo

Bloques **12, 13, 16, 17, 18 y 19** —buscar producto, devoluciones,
notificaciones, caja chica, transferencias e inventario—: implementados y sin
ejecutar. El **12** está marcado ⚠️ REPASAR, así que conviene empezar por ahí.

**Bloqueados, y no por la app:**

| Bloque | Qué falta |
|---|---|
| 7 · Abrir y cerrar caja | Una filial de desarrollo. La apertura se proxea a la filial |
| 11 · iOS real | Un iPhone o iPad |
| Escáner contra códigos reales | Manos: se puede abrir la cámara por adb, no apuntarla a un producto |

## Cosas que van a morder si no se saben

**El backend del central se cae con SIGTERM.** Pasó varias veces, con la misma
firma que se lleva puesto al dev server. El síntoma en el teléfono es un mensaje
de que el servidor rechazó el login, que hace pensar en un problema de
credenciales cuando en realidad no hay backend. **Antes de debuggear un login,
chequear que el 8081 responda.**

**Los túneles de adb no sobreviven a que se desconecte el cable**, y no se
rearman solos. Sin `adb reverse tcp:8081` la app no llega al central y el
síntoma es idéntico al anterior. Si el cable se desconecta seguido, conviene
`adb tcpip 5555` y trabajar por wifi.

**La sesión de la app expira seguido durante una sesión larga de pruebas.**
`SesionService.restaurar()` cierra sesión cuando el central rechaza la
credencial, así que aparece el login sin que nadie lo haya pedido.

**`npm run build` y `npm test` matan al `npm start`.** Ya está en el
[CLAUDE.md](../CLAUDE.md); se repite acá porque cuesta media hora la primera vez
que pasa.

## Deudas que dejó esta tanda

- **La PR #1 sigue abierta.** 10 commits. Nadie la revisó.
- **`solicitud-pago` exige un central con la migración `V194.5`.** El cambio del
  backend que agrega `SOLICITADO` **estaba sin commitear** en el árbol de
  trabajo del central. Antes de publicar, confirmar que está liberado.
- **`gestion-pago-dialog` del desktop quedó desactualizado**: ofrece los cuatro
  estados viejos, sin `SOLICITADO`. No es este repo, pero es el mismo cambio.
- **Las secuencias de `id` de Postgres se desfasan** y rompen los `insert`. Se
  arreglaron siete en la base de prueba; **producción no se miró**.
- **No hay versionado.** `package.json` está en `0.0.0`, así que la app muestra
  la fecha de compilación rotulada «(sin versionar)». En cuanto
  `semantic-release` numere, la pantalla lo toma sola.
