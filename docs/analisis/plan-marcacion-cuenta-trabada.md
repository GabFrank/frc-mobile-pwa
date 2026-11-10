# Plan — la cuenta regresiva de la verificación facial se traba en el «1»

Rama: `fix/marcacion-cuenta-facial-trabada` (desde `develop`). Solo PWA.

## Síntoma

A veces, al marcar, la cuenta 3-2-1 se queda en el «1» y no pasa nada. La
única salida es *Cancelar* y marcar sin verificación. Intermitente.

## Causa (leída en el código, no reproducida)

1. **La GPU se prepara en la primera foto, no al cargar.** `ReconocimientoFacialService`
   crea Human con `warmup: 'none'`; en Human 3.3.6 `warmup()` con `'none'` vuelve
   sin hacer nada (`human.esm-nobundle.js`, función del warmup: `config.warmup==="none" ? ...`).
   La compilación de los shaders de WebGL cae en el primer `human.detect`, que
   corre justo al terminar la cuenta: en un teléfono lento el hilo queda bloqueado
   y la pantalla se ve congelada en el «1».
2. **La detección no tiene límite.** Si la GPU se cuelga (contexto WebGL perdido,
   memoria) `human.detect` no resuelve nunca, o rechaza. En el diálogo,
   `sacarFoto()` no atrapa nada: queda en fase `capturando` sin «Tomar otra foto»
   y sin contar el intento. Solo queda *Cancelar*.

## A quién le llega

| Llamador | Hoy, si la detección se cuelga | Después |
|---|---|---|
| `verificacion-facial-dialog` (`capturarTanda`) | trabado, solo *Cancelar* | la foto falla como intento: «Tomar otra foto»; al tercero cede a «sin verificación» como ya hace |
| `kiosco-marcacion` (`capturarTanda`) | trabado | «No te reconocimos…», reintento como ya hace |
| `enroll-facial` (`detectar` suelto) | botón *Capturar* deshabilitado para siempre (`ocupado`) | aviso y se puede volver a capturar |

## Fase 1 — un commit

`core/dispositivo/reconocimiento-facial.service.ts`
- Después de `human.load()`, precalentar con `human.warmup({ warmup: 'face' })`
  acotado a 15 s. Si falla o se pasa, se sigue: es optimización, no requisito
  (el `warmup` de Human es un executor async sin `try`: si adentro algo tira, la
  promesa no resuelve nunca). `warmup` queda guardado en la config pero solo lo
  leen las funciones de warmup: no toca `face.description` ni el embedding, y con
  `cacheSensitivity: 0` no deja frames cacheados.
- `detectar()`: **solo** `human.detect` acotado (no el `cargar()` que hace antes).
  Límite de 5 s con el modelo precalentado, 15 s si el precalentamiento no
  terminó: el primer detect frío puede tardar legítimamente. El timer se limpia
  al ganar la detección. Si se pasa, **lanza** `DeteccionFallidaError`: «no hay cara» (`null`) y «no se pudo
  analizar» son cosas distintas (PATRONES §6).
- Un `error` con el que Human resuelve (video sin frame todavía,
  `readyState <= 2`) sigue volviendo `null`: se pierde ese frame, no la tanda.
  El kiosco arranca la cuenta sin esperar la cámara, y lanzar ahí le haría
  perder la tanda entera a una cámara lenta. El precalentamiento que resuelve
  con `error` no cuenta como precalentado.

`pages/marcacion/captura-facial.component.ts`
- `capturarTanda`: si un frame lanza, **devuelve `[]`** (no lo que tenga): una
  tanda cortada con 1-2 frames caería en «Tiene que ser tu rostro real, no una
  foto», y acusaría de suplantación por un cuelgue de la GPU. Con `[]` los dos
  llamadores dicen «No se detectó tu rostro…» / «No te reconocimos…» y cuentan
  el intento.
- La tanda se corta si el componente se destruyó (bandera en `detener()`, no la
  ausencia de `stream`: en el kiosco la cuenta no espera a la cámara).

`pages/cuenta/enroll-facial.page.ts`
- `capturar()`: `catch` que avisa «No se pudo analizar la imagen. Probá de nuevo.».

No se toca: la regla de aceptación (`FRAMES_MINIMOS_VERIFICACION` es absoluto:
una tanda más corta nunca pasa algo que antes no pasaba), los umbrales ni la
configuración del modelo.

### Tests (vitest)

- `marcacion-captura-facial.spec.ts`: el frame 1 trae rostro y el 2 lanza →
  el diálogo cae en «Tomar otra foto» con el mensaje de «no se detectó», no el de
  foto falsa (con el código viejo: trabado en `capturando`).
- `reconocimiento-facial.spec.ts` (nuevo, Human mockeado con `vi.mock`, timers
  falsos):
  - `cargar()` llama a `warmup` con `'face'` y resuelve aunque `warmup` no
    resuelva nunca.
  - `detectar()` lanza `DeteccionFallidaError` (`toBeInstanceOf`) si `detect` no
    resuelve en el límite; 15 s de margen si no hubo precalentamiento (o salió
    con error); `null` si Human resuelve con `error`.
  - Revertir el fix y comprobar que fallan (y que el mock de un `import()`
    dinámico aplica de verdad).

## Hallazgos de la auditoría (paso 5)

| # | Eje | Hallazgo | Qué se hizo |
|---|---|---|---|
| 1 | A y B | Tanda cortada acusa de foto falsa | `capturarTanda` devuelve `[]` |
| 2 | B | **El timeout no rescata un bloqueo sincrónico** del hilo: el «1» congelado lo arregla el precalentamiento; el timeout cubre el detect pendiente para siempre (que se ve como «Verificando…» sin fin) | Documentado; límite mayor para el primer detect frío |
| 3 | A | Human resuelve con `error` en vez de rechazar | Se intentó tratarlo como fallo; la revisión del diff mostró que ese `error` es el «video sin frame» y que en el kiosco hacía perder la tanda entera. Vuelve `null`, como antes |
| 4 | A y B | Carrera `liberar()` / carga, y tanda que sigue tras cancelar | Corte por destrucción. **Contador de generación descartado**: Human guarda modelos y backend a nivel de módulo, así que soltar la instancia no libera GPU, y el contador abría otra carrera (dos diálogos seguidos compartiendo la promesa de carga) |
| 5 | A | Límite ambiguo y timer sin limpiar | Solo `human.detect`, `clearTimeout` |
| 6 | B | Contexto WebGL perdido: falla hasta recargar la app (kiosco encendido todo el día) | **No se hace**: el diálogo cede a «sin verificación» al tercer intento; el kiosco reintenta. Queda anotado |
| 7 | B | El detect colgado sigue en la GPU tras el timeout (~4 MB por cuelgue, sin lock en Human) | Aceptado: acotado |
| 8 | B | Tests que pasaban con el código viejo | Reescritos arriba |

### Datos nuevos

Ninguno: no hay campo, columna ni clave nueva.

## Prueba de runtime

- `npm start` (4300) contra un central local o alpha, Chrome con cámara real:
  verificación facial completa (pasa), reintento, kiosco, registrar rostro.
- Cuelgue forzado: parchear en la consola `human.detect` para que no resuelva
  (o devtools → *Rendering* no lo permite; se usa el parche) y ver que a los 5 s
  aparece «Tomar otra foto».
- Teléfono físico: `adb reverse` y abrir la marcación varias veces.

## Sin verificar

- La causa raíz exacta en el teléfono donde pasa (no hay log del dispositivo).
  Se mitiga en los dos frentes; si vuelve a pasar con esto, el próximo paso es
  `chrome://inspect` sobre el teléfono.
- iOS/Safari: no hay iPhone para probar el precalentamiento.

## Documentación

- `docs/PLAN_TESTEO_MANUAL.md`: caso nuevo en el bloque 31 (cuelgue de la
  detección) y tabla de totales.
- El plan se borra en el PR final.
