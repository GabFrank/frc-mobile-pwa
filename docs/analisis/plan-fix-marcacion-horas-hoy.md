# Plan — fix: horas de la tarjeta «Hoy» en Marcación

Rama: `fix/marcacion-horas-almuerzo` (desde `develop` @ `9a5f5f3`). Pieza: **mobile-pwa**, sola.

## El bug

Probando en iPhone contra alpha (2026-09-25, usuario 410, jornadas 25 y 27): la tarjeta «Hoy»
muestra «—» en la hora de «Salió a almorzar».

**Causa, verificada en la base `alpha`:** la PWA no manda ninguna fecha en `saveMarcacion`, y
`MarcacionService.prepararMarcacion()` del central, cuando las dos vienen nulas, completa
**`fechaEntrada = now()` sin importar el tipo**. Una SALIDA hecha desde la PWA queda con la hora en
`fecha_entrada` y `fecha_salida` nula. La plantilla lee `marcacionSalidaAlmuerzo.fechaSalida` y
`marcacionSalida.fechaSalida` → `null` → «—».

| Origen | SALIDA con solo `fecha_salida` | SALIDA con solo `fecha_entrada` | Con las dos |
|---|---|---|---|
| alpha, todas las marcaciones | 14 (frc-mobile, antes del 2026-08-15) | 12 (PWA) | 0 |

`frc-mobile` mandaba `fechaSalida` (reloj del dispositivo) en cada salida
(`identificacion-marcacion.component.ts:368-373`); la PWA no.

## La decisión: leer como lee el resto del sistema, no cambiar lo que se escribe

La regla de lectura del sistema ya es **«`fechaSalida` si existe, si no `fechaEntrada`»**. La
aplican en el central `HorasTrabajadasCalculator.java:149`, `TardanzaCalculator.java:57`,
`ImpresionService:1223` (→ `marcaciones.jrxml`) y `MarcacionRepository:28,34`; en el filial
`MarcacionService:329`; y en el desktop `list-marcacion.component.html:198,251-252`. Por eso las
horas trabajadas, la tardanza y el reporte de las jornadas de la PWA salen bien.

**No la aplican** (auditoría eje A, verificado):

- la tarjeta «Hoy» de la PWA — **este fix**;
- desktop `marcar-horario.component.ts:373` — `m.fechaEntrada && !m.fechaSalida` toma una SALIDA de
  la PWA como entrada;
- desktop `resumen-marcaciones.component.html:40` — «En Curso» cuando falta `fechaSalida`;
- frc-mobile `tipo-marcacion.component.ts:134` — en mantenimiento.

Se descarta mandar `fechaSalida` desde el cliente: sería la hora del reloj del teléfono, que el
funcionario controla (en alpha las salidas de frc-mobile de las jornadas 7, 9, 11 y 13 quedaron ~1 h
**antes** que su entrada por eso). La alternativa que arregla a todos los lectores es que el
**central** complete `fecha_salida = now()` en las SALIDA que llegan sin fecha
(`MarcacionService.prepararMarcacion()`): es otro repo y otro PR — **decisión del usuario**.

## Fase única (un commit, un push)

1. `src/app/domains/marcacion/marcacion.model.ts`: `momentoDeMarcacion(m)` →
   `m?.fechaSalida ?? m?.fechaEntrada`, con el porqué en el comentario (mismo orden que
   `HorasTrabajadasCalculator`).
2. `src/app/pages/marcacion/marcacion.page.ts`: las **cuatro** filas (Entrada, Salió a almorzar,
   Volvió, Salida) usan `momentoDeMarcacion`. Las cuatro, no solo las dos rotas: es la misma regla y
   así nadie vuelve a elegir campo por fila.
3. Tests en `src/app/pruebas/marcacion.spec.ts`:
   - la función: solo `fechaEntrada`, solo `fechaSalida`, las dos (gana `fechaSalida`), ninguna,
     `undefined`;
   - la página: una jornada con las cuatro marcaciones **como las escribe la PWA** (todas con solo
     `fechaEntrada`, **una hora distinta por fila**) muestra el texto exacto de cada fila; y una
     salida vieja con solo `fechaSalida` se muestra (que se vea, no que la hora sea correcta).
   - **Revertir el fix y comprobar que fallan «Salió a almorzar» y «Salida».**
4. Docs: bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md` + fila y total en «Resumen para completar»;
   gotcha en `docs/modulos/marcacion.md` (dónde está la hora de una salida, y la hora corrida de las
   filas viejas de frc-mobile).

Build: `npm run build` leído del log; `npm test`.

## Datos nuevos

`N/A para mobile-pwa porque [ev: el diff no crea campo, columna ni clave; solo cambia qué campo
existente se lee]`. Migraciones: N/A, no hay persistencia.

## Qué queda sin verificar

- **La fila «Volvió».** El reporte dice que también salía «—», pero en la base la marcación de
  retorno (ENTRADA) tiene `fecha_entrada`, que es lo que la plantilla lee; no es caché
  (`fetchPolicy: 'no-cache'`, `app.config.ts:78`), y si faltara la marcación el `@if` ocultaría la
  fila. Con el fix las cuatro filas usan la misma regla. Re-prueba en el iPhone anotando la versión
  (Mi cuenta) y, si vuelve a salir «—», capturando la respuesta de `estadoMarcacionUsuario`.
- Las 12 filas ya escritas no se tocan: con la regla de lectura se muestran bien en la PWA.

## Auditoría (paso 5)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| A | Desktop (`marcar-horario:373`, `resumen-marcaciones:40`) y frc-mobile leen `fechaSalida` sin fallback: las salidas de la PWA salen «En Curso» o vacías, y el desktop puede tomarlas como entrada | Verificado. Plan corregido; **decisión al usuario**: solo PWA, o además el central |
| A | Dos órdenes de precedencia (central `obtenerFechaReferencia` prioriza entrada; los calculadores, salida) | Hoy 0 filas con las dos; se sigue a `HorasTrabajadasCalculator` y el test lo documenta |
| A + B | «`sucursal_salida_id` queda vacía» era falso: `MarcacionGraphQL.java:102-106` la completa | Observación quitada |
| B | Test «ningún —» poco discriminante («Trabajadas» también puede dar «—») | Horas distintas por fila y texto exacto |
| B | Filas viejas de frc-mobile con la salida ~1 h antes de la entrada (reloj del dispositivo) | Gotcha en `docs/modulos/marcacion.md`; el test no promete la hora |
| B | «Volvió = —» sin explicación en datos ni caché | Queda sin verificar; re-prueba con versión anotada |
| B | Sin migración, sin datos tocados, query igual: revertible con `git revert`; convivencia de 2 h sin daño | N/A justificado |
