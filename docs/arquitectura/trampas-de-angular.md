# Trampas de Angular y Material

Cosas que **no fallan**: no tiran error, no ensucian la consola, y hacen algo
razonable que no es lo que se pidió. Todas se encontraron usando la app, no
leyendo el código, y por eso están acá con su síntoma primero.

> **Este archivo se va a fusionar.** Cuando entre la PR de convenciones,
> `docs/PATRONES.md` es el lugar natural para varias de estas. Se escribió
> aparte para no chocar con una rama que todavía no está mergeada; al fusionar,
> lo que sobra es este archivo, no el contenido.

---

## 1 · `mat-select` trata `null` como «sin elegir»

**Síntoma:** un selector aparece **vacío** aunque la opción exista y esté
seleccionada, y la pantalla ya esté consultando con ese valor.

Pasaba en *Control de inventario*: el selector de sucursal se veía en blanco
mientras la consulta traía todas las sucursales. Se veía como un bug de carga y
no lo era.

`mat-select` interpreta un valor `null` como ausencia de selección, así que no
dibuja nada en el trigger. No importa que exista un `<mat-option [value]="null">`
ni que `compareWith` los considere iguales.

**Qué hacer.** Para el caso «sin filtro», un texto centinela, y la traducción a
`null` recién al armar las variables de la consulta:

```ts
const TODAS = 'todas';
readonly sucursalId = signal<unknown>(TODAS);

readonly sucursalElegida = computed<number | null>(() => {
  const valor = this.sucursalId();
  return valor == null || valor === TODAS ? null : Number(valor);
});
```

Está documentado en `shared/selector/selector.component.ts`, que es donde va a
mirar quien lo sufra.

---

## 2 · Un bloque de control de flujo con más de un nodo raíz no proyecta

**Síntoma:** los botones de la barra de acciones aparecen **en el cuerpo de la
pantalla**, no en la barra fija de abajo.

```html
<!-- ❌ el botón cae en el slot por defecto -->
@if (cargando()) {
  <frc-skeleton />
} @else {
  <div class="lista">…</div>
  <div acciones>
    <button matButton="filled">Guardar</button>
  </div>
}
```

El AOT lo avisa con **NG8011**, pero es un *warning*: el build pasa en verde y
nadie lo mira. Tres pantallas llegaron así a estar terminadas.

**Qué hacer.** La barra va **fuera** del bloque, con su propio `@if` de un solo
nodo:

```html
@if (cargando()) {
  <frc-skeleton />
} @else {
  <div class="lista">…</div>
}

@if (!cargando() && !error()) {
  <div acciones>
    <button matButton="filled">Guardar</button>
  </div>
}
```

> **Leer los warnings del AOT.** `npm run build` termina en verde con NG8011 y
> con NG8113 (import declarado y no usado). El primero significa que algo no se
> está renderizando donde se cree.

---

## 3 · `navigator.serviceWorker.ready` no se rechaza nunca

**Síntoma:** un botón queda en «Activando…» **para siempre**. Sin error, sin
log, sin nada en la consola.

`ready` es una promesa que resuelve cuando hay un service worker activo. Si no
hay ninguno registrado, **no rechaza: espera**. Y en `ng serve` no hay ninguno,
porque `provideServiceWorker` está en `enabled: !isDevMode()`.

**Qué hacer.** `getRegistration()`, que sí devuelve `undefined`:

```ts
const registration = await navigator.serviceWorker.getRegistration();
if (!registration) {
  throw new Error(
    'No hay service worker activo… En desarrollo está deshabilitado: ' +
      'probalo sobre un build.',
  );
}
```

La regla general: **una promesa que solo resuelve no sirve como control de
flujo**. Si el camino de error importa, hay que buscar la API que lo tenga.

---

## 4 · Aceptar rutas por prefijo puede dar un bucle de redirección

**Síntoma:** la app navega en círculos, o se queda en una URL sin pintar nada.

El comodín `**` traduce destinos de notificación. La primera versión aceptaba
«ya es una ruta de esta app» comparando por prefijo:

```ts
// ❌
if (RUTAS.some((base) => ruta.startsWith(base + '/'))) return ruta;
```

`/operaciones/ventas/45/2` empieza con `/operaciones`, así que pasaba derecho.
Pero esa ruta **no existe** acá: el comodín la volvía a atrapar, el traductor la
devolvía igual, y así.

**Qué hacer.** Coincidencia exacta contra un conjunto que se sostiene a mano:

```ts
const RUTAS_PROPIAS: ReadonlySet<string> = new Set(['/inicio', '/operaciones/caja', …]);
return RUTAS_PROPIAS.has(ruta) ? ruta : DESTINO_POR_DEFECTO;
```

Lo atajó el spec antes de llegar al navegador, y por eso el caso quedó escrito
como prueba y no como anécdota.

> **Al agregar una pantalla, agregarla a esa lista.** Si falta, un destino
> válido termina en la lista de notificaciones: no se rompe nada, pero el toque
> deja de llevar donde llevaba.

---

## 5 · Cuidado al medir una navegación con rutas perezosas

Probando el traductor, `/operaciones/transferencias/431` parecía **no**
traducirse. No era cierto: Angular necesita **cargar el chunk** de
`operaciones` para descartar que la ruta esté ahí adentro y recién entonces
caer en el comodín. Con 800 ms de espera el resultado se leía antes de tiempo;
con 1600 ms daba bien.

Vale para cualquier verificación por DOM: **una ruta perezosa tarda más en
resolver que una ansiosa**, y medir temprano da un falso negativo que se lee
como bug.

---

## 6 · Un archivo generado no dice lo que no le toca decir

`android/app/google-services.json` del repo `frc-mobile` lista **solo clientes
Android**. Que no aparezca una app Web ahí **no significa** que no exista: ese
archivo nunca las lista.

Esa lectura al revés costó dar por bloqueado el push cuando la app Web ya
estaba registrada.

La regla: antes de concluir «esto no está configurado» a partir de un archivo
generado, confirmar que ese archivo **puede** contener lo que se busca.

---

## Cómo se encontró cada una

Ninguna salió de leer código:

| Trampa | Cómo apareció |
|---|---|
| `mat-select` con `null` | mirando una captura de la pantalla |
| NG8011 | leyendo los warnings del AOT al final |
| `serviceWorker.ready` | un botón que no volvía |
| Bucle por prefijo | un test que escribí para otra cosa |
| Ruta perezosa | un resultado que no cerraba, medido de nuevo |
| `google-services.json` | el usuario dijo que la app Web ya existía |

Es el argumento a favor de **probar lo implementado en el navegador** y de
**escribir el spec antes de dar algo por terminado**: las seis son invisibles
para `tsc`, y cuatro de las seis también para el build.
