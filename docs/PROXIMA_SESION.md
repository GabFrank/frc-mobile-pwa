# Dónde retomar

> **Al 2026-08-15.** Rama `feat/paridad-mobile-android`, PR **#2** abierta
> contra `feature/solicitud-pago`. Todo commiteado y pusheado.
>
> Este archivo es un **traspaso, no una hoja de ruta**: dice qué quedó a medio
> camino y con qué hay que tener cuidado. Cuando las PR se cierren y los
> bloques nuevos se corran, borralo — un traspaso viejo miente más que un
> archivo que no existe.

## Lo que se hizo

**Paridad con `frc-mobile`, cerrada.** Las dos tandas están en la PR #2:
crédito en Inicio, escáner universal, configuración en la app, badge de no
leídas, productos vencidos, kiosco, ficha de producto, rendición de caja chica,
carga del conteo — y después revisión del supervisor, control de inventario,
lugares del depósito, configuración del kiosco, rostro, compartir por QR,
instalar la PWA y notificaciones push.

Lo que **no** se portó, y por qué, está en los documentos de cada módulo:
`adicionar-sector` y `edit-producto` de `frc-mobile` son scaffolds vacíos del
CLI, y el histórico de recepción ya lo cubre la lista existente con la misma
consulta.

## ⚠️ Hay un cambio del central **sin commitear**

En `frc-comercial/central`, `FCMService.getWebpushConfig` manda el destino de
la notificación **dentro** del `notification`, como `onActionClick`. Sin eso, el
aviso llega, se muestra, y **tocarlo no hace nada**: con la app cerrada ni
siquiera la abre.

Está compilado y probado corriendo, pero **no commiteado**: esta sesión venía
tocando solo el repo de la PWA. Hay que decidir por dónde sale.

El porqué —y por qué no se puede resolver del lado del cliente— está en
[`arquitectura/web-push.md`](arquitectura/web-push.md).

## Las PR están encadenadas

**La #1 (`feature/solicitud-pago` → `develop`) sigue abierta.** La #2 sale de
esa rama a propósito, para que su diff muestre solo lo nuevo.

**Mergear en orden.** Y hay dos PR más, de otra sesión: **#3** de convenciones
y patrones, y **#4** del pipeline de CI/CD.

### Cómo se evitó chocar con la #4

La #4 **borra `environment.prod.ts`** y reescribe `environment.ts`, porque el
backend de cada canal pasa a salir del hostname. La configuración de Firebase
había quedado en esos dos archivos y se movió a
**`core/notificaciones/firebase.config.ts`**, que además es su lugar correcto:
el proyecto de Firebase es **uno solo** para los tres canales, así que no es
configuración de entorno.

Los dos archivos de entorno volvieron a ser idénticos a `develop`. La #4 puede
borrarlos y reescribirlos sin pelearse con nada.

### Lo que sí va a chocar

`docs/PLAN_TESTEO_MANUAL.md` lo tocan tres ramas. El conflicto es la **fila de
totales** y el orden de los bloques; el contenido no se pisa. Al resolver, sumar
y seguir.

`docs/PATRONES.md` **no existe en esta rama**: lo crea la #3. Las trampas de
esta tanda están en
[`arquitectura/trampas-de-angular.md`](arquitectura/trampas-de-angular.md),
escrito aparte por eso mismo. **Al mergear la #3, fusionarlo ahí y borrar el
archivo suelto.**

## Lo que falta, en orden

### 1 · Correr el plan de testeo

284 casos. De lo nuevo quedó sin correr:

| Bloque | Qué necesita |
|---|---|
| 7 · Apertura y cierre de caja | nunca se corrió: la apertura se proxea a la filial |
| 11 · iOS real | un iPhone. **No hay ninguno en la flota** |
| 31 · Rostro | un teléfono de verdad; acá se probó con la cámara del Mac |
| 37.1 · Kiosco en modo lector | un lector HID conectado |
| 38.4 y 38.8 · Push | recibir el aviso y **tocarlo**: eso es UI del sistema, fuera del navegador |
| 38.6 / 38.7 · Push en iPhone | además, con la PWA **instalada**: sin instalar no aparece ni el botón |

### 2 · Lo que queda de paridad

- **Alta de solicitud de caja chica** — el formulario más grande que queda.
- **Agregar a la toma un producto que no estaba** — necesita portar
  `saveInventarioProducto`.
- **Edición y alta de producto**, con rol `NUEVO-PRODUCTO`.
- **Transporte WebSocket** para suscripciones.

### 3 · Una deuda técnica, sin urgencia

El **bundle inicial pesa 644 kB** contra un presupuesto de 500. No viene de
esta tanda: Firebase quedó entero en chunks lazy y lo único que suma al
arranque son unos 900 bytes de configuración. Hay que decidir si se sube el
límite o se mira qué entró al chunk de arranque.

## Trampas del entorno

**El central local necesita la variable de Firebase.** El service account se
busca en `file:/opt/frc-backend-central/…`, que en un Mac de desarrollo no
existe, y `FCMInitializer` **no tiene fallback a classpath**. Sin ella, Firebase
nunca inicializa, el push falla en silencio y `/actuator/health` queda en
`DOWN` — que es exactamente lo que estuvo pasando sin que nadie lo mirara.

```bash
APP_FIREBASE_CONFIGURATION_FILE=file:$PWD/src/main/resources/bodega-franco-frc-18e8c6ef35cf.json \
  ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

**`ng serve` no sirve para probar push.** El service worker está en
`enabled: !isDevMode()`. Hay que servir un build:

```bash
npm run build
cd dist/mobile-pwa/browser && python3 -m http.server 4400 --bind 127.0.0.1
```

Ese servidor **no hace fallback de SPA**: recargar una ruta profunda sin el
service worker activo da 404. Entrar por `/`.
