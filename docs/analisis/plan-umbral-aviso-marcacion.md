# Plan — umbral propio para el aviso «Estás lejos de la sucursal»

Rama: `fix/marcacion-umbral-aviso-distancia` (desde `develop`). Pieza: solo **mobile-pwa**.

## Problema

Al marcar, la PWA avisa «Estás lejos de la sucursal» cuando la distancia a la
sucursal detectada supera `PRECISION_MAXIMA_M` (33 m). Esa constante es el
filtro de **precisión** de las lecturas del GPS (`geo.service.ts`); la pantalla
la reutiliza como radio de **distancia** (`marcacion.page.ts:390`). Son dos
preguntas distintas con el mismo número por casualidad.

Con datos de producción (bodega, 81 marcaciones de la PWA del 02 al 05/10/2026):

- En el depósito Aquario (13), 18 de 46 marcaciones desde iPhone superan los
  33 m; ninguna de las 29 de Android pasa de 25 m.
- Las 18 declaran buena precisión (±9,5 a ±21 m): el filtro de precisión no las
  puede descartar.
- La coordenada se repite al metro entre días para el mismo usuario (58–59 m,
  95–96 m): es posicionamiento por Wi-Fi desde la oficina del segundo piso, no
  GPS.
- La máxima vista en cualquier sucursal es 100 m.

El aviso salta siempre a gente que está dentro del edificio, y un aviso que
salta siempre deja de leerse.

## Decisión (Franco, 05/10/2026)

Umbral del aviso: **110 m**, general. Se descartó 150 m por holgado. El aviso
sigue sin bloquear y la distancia real se sigue guardando.

## Fase única

1. `src/app/pages/marcacion/deteccion-sucursal.util.ts`: constante
   `DISTANCIA_AVISO_M = 110` y función pura `estaLejos(metros)`.
2. `src/app/pages/marcacion/marcacion.page.ts`: el aviso usa `estaLejos()`;
   deja de importar `PRECISION_MAXIMA_M`. Se corrige el comentario de la clase.
3. `PRECISION_MAXIMA_M` no se toca: el filtro de lecturas sigue en ±33 m.

No cambia ninguna operación GraphQL, ni el central, ni el kiosco (que no avisa
por distancia). No hay datos nuevos: nada que escribir ni leer.

### Tests (`src/app/pruebas/marcacion-sucursal-gps.spec.ts`)

- `estaLejos`: 110 m no es lejos, 111 m sí; 110,4 m tampoco (se compara lo que
  se guarda, que va redondeado).
- Pantalla: a ~59 m marca **sin** pedir la confirmación de «lejos» y guarda la
  distancia real.
- Pantalla: a ~150 m pide la confirmación y, al aceptar, guarda.
- Pantalla: a ~150 m, si se rechaza la confirmación, no se guarda nada.
- El arnés espía `confirmar` y se afirma por el título del diálogo: responde
  que sí a todo, y sin eso los tres casos pasan también con el umbral viejo.
- Verificación del test de bug: con el umbral viejo (33) el caso de 59 m tiene
  que fallar.

### Documentación

- `docs/modulos/marcacion.md`: separar «precisión de lectura ±33 m» de «aviso
  de distancia 110 m», con los datos que lo calibraron.
- `docs/PLAN_TESTEO_MANUAL.md` 15.4 y 59.7: el umbral nuevo y el caso «segundo
  piso con iPhone no avisa».
- Comentarios que hablan del umbral: `deteccion-sucursal.util.ts`,
  `geo.service.ts` y el de la clase `MarcacionPage`.

## Qué queda sin verificar

- El umbral se calibró con **un solo edificio**: fuera de Aquario hay 6
  marcaciones, todas de Android. Revisar la distribución cuando más sucursales
  marquen con iPhone.
- No se prueba en un iPhone real antes del PR: la prueba es de Franco, marcando
  desde el segundo piso con la build de alpha o local.
- El aviso no es un control antifraude: el central no valida la distancia y el
  desktop no la muestra. Queda fuera de este fix.

## Auditoría del plan (paso 5)

Dos auditores, sin verse. Ninguno encontró riesgo de contrato, de canal ni de
reversibilidad: no cambia ningún input GraphQL ni lo que se guarda, el central
copia la distancia sin validarla, y revertir el commit alcanza.

| Hallazgo | Eje | Qué se hizo |
|---|---|---|
| Los tests de pantalla no distinguían el aviso de «lejos» de la confirmación de rostro: pasaban con el umbral viejo | B | Espía sobre `confirmar` y afirmación por título; se suma el caso de rechazo |
| A 110,4 m avisaría «110 m» y guardaría 110: el veredicto no se reproduce desde el dato | A | `estaLejos` compara la distancia redondeada, la misma que se guarda |
| `deteccion-sucursal.util.ts` dice «no aplica ningún radio» y pasa a tener el umbral | A y B | Se aclara que `detectarSucursal` sigue sin cortar y que el umbral es solo del aviso |
| El caso 59.7 del testeo manual dice «a más de 33 m» | A | Se actualiza junto con 15.4 |
| `frc-mobile` tiene su propio radio de 33 m y manda distancia 0 | A | Se anota en `docs/modulos/marcacion.md`; no se toca el repo viejo |
| Un test existente (posición a ~55 m) deja de pasar por el aviso y sigue verde | B | Sin cambio: no afirma nada sobre el aviso |
