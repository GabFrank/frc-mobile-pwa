# Patrones del repo

> **Qué es esto.** El [`design-system.md`](design-system.md) fija cómo se ve la
> app. Este documento fija **cómo se escribe**: la forma que ya tienen las
> pantallas, los servicios y las pruebas de este repo, para que la siguiente
> se parezca a las que hay y no haya que decidir de nuevo lo que ya se decidió.
>
> Las reglas duras —el alias `data:`, los tokens, la regla de tres— están en
> [`../CLAUDE.md`](../CLAUDE.md) y no se repiten acá. Esto es la capa de
> abajo: **patrones**, con el motivo de cada uno.
>
> Todo lo que sigue está tomado de código que existe hoy en el repo. Si al
> escribir algo nuevo te encontrás peleando con un patrón de acá, puede que el
> patrón esté mal — pero decilo y cambialo en este archivo, no lo esquives en
> silencio en una pantalla.

---

## 1 · Anatomía de una pantalla

Toda pantalla es un componente `standalone`, `OnPush`, con `template` y
`styles` inline y el selector prefijado `frc-`.

```ts
@Component({
  selector: 'frc-productos-vencidos',
  standalone: true,
  imports: [PaginaComponent, SeccionComponent, /* … */],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `…`,
  styles: `…`,
})
export class ProductosVencidosPage { }
```

El esqueleto del template es siempre el mismo:

```html
<frc-pagina titulo="…" [conVolver]="true">
  <div acciones>…</div>          <!-- barra fija al pie, opcional -->

  @if (cargando()) {
    <frc-skeleton [cantidad]="4" />
  } @else if (error()) {
    <frc-estado-error [detalle]="error()!" (reintentar)="cargar()" />
  } @else if (filas().length === 0) {
    <frc-estado-vacio titulo="…" detalle="…" icono="…" />
  } @else {
    …contenido…
  }
</frc-pagina>
```

**Los tres estados no son opcionales** (regla 4 del proyecto). El orden
importa: cargando gana sobre error, y error sobre vacío. Una lista vacía
mientras carga se lee como «no hay nada» durante medio segundo, y eso alcanza
para que alguien cierre la pantalla.

**El estado vacío dice qué falta, no que está vacío.** *«Buscá un producto —
escribí el código o parte de la descripción»* contra *«Sin resultados»*: el
primero es una invitación, el segundo una respuesta. Distinguirlos exige
saber si el usuario ya pidió algo, y por eso existe la señal `buscado()` en
el buscador.

### Nombres de archivo

| Qué | Cómo se llama |
|---|---|
| Pantalla ruteada | `algo.page.ts` → `AlgoPage` |
| Componente reutilizable | `algo.component.ts` → `AlgoComponent` |
| Servicio de un módulo | `algo.service.ts` |
| Reglas puras de un módulo | `algo.reglas.ts` o `algo-qr.ts` |
| Rutas de un módulo | `algo.routes.ts` → `rutasAlgo` |

---

## 2 · Estado: señales, y nada más

```ts
readonly filas = signal<ProductoVencido[]>([]);
readonly cargando = signal(true);
readonly error = signal<string | null>(null);

readonly hayFilas = computed(() => this.filas().length > 0);
```

- **`signal()` para lo que se escribe**, `computed()` para lo que se deriva.
  Nunca un campo que se recalcula a mano en tres lugares.
- **`readonly` en la propiedad**, aunque la señal sea escribible: lo que no
  cambia es la referencia.
- **`cargando` arranca en `true`** cuando la pantalla consulta al construirse.
  Arrancar en `false` muestra el estado vacío por un instante.
- **Sin `RxJS` para estado de pantalla.** Los observables entran por el
  servicio y mueren en el `subscribe`; lo que queda es señal.

⚠️ **La app es zoneless.** Un valor que cambia fuera de una señal no repinta.
Si algo «no se actualiza», el primer sospechoso es un campo común donde tenía
que haber una señal.

---

## 3 · Servicios de datos

Un servicio por módulo, `providedIn: 'root'`, que **solo transporta**: recibe
parámetros, arma variables, devuelve `Observable`. No guarda estado de
pantalla y no decide nada de negocio.

```ts
@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly datos = inject(DatosService);
  private readonly vencidosGQL = inject(ProductosVencidosGQL);

  vencidos(filtros: FiltrosVencidos = {}): Observable<PageInfo<ProductoVencido>> {
    return this.datos.consultar<PageInfo<ProductoVencido>>(this.vencidosGQL, {
      startDate: filtros.desde ?? null,
      // …
    });
  }
}
```

**Todo parámetro va explícito, con `?? null`.** El central distingue «sin
filtro» de una lista vacía, y omitir la variable no es lo mismo que mandarla
nula.

**Un filtro que se arma en dos pantallas se declara como interfaz** en el
servicio (`FiltrosVencidos`, `FiltrosPreGasto`), no como parámetros sueltos.

### Cuándo el servicio hace más que transportar

Cuando encadenar dos consultas es la única forma de responder una pregunta, y
esa pregunta la hacen dos pantallas. `MisFinanzasService.resumenCredito()`
encadena cliente → convenios porque el `id` de la segunda sale de la primera:
dejar esa dependencia en cada pantalla la hace escribirse dos veces y
desincronizarse a la tercera.

---

## 4 · Parámetros de ruta

```ts
readonly id = input<string>();          // NO input.required
readonly sucursalId = input<string>();

constructor() {
  effect(() => {
    if (this.id() !== undefined) {
      this.cargar();
    }
  });
}
```

⚠️ **`input<string>()` y no `input.required`.** El router asigna los inputs
**después** de construir el componente: con `required`, leerlo en el
constructor tira `NG0950`. Por eso el efecto chequea `!== undefined`.

⚠️ **Los parámetros llegan como `string`.** Siempre `Number(...)` con
`Number.isFinite`, y ver el punto 7 sobre el cero.

Para que `input()` reciba parámetros de ruta y query hace falta
`withComponentInputBinding()`, que ya está en `app.config.ts`.

### Orden de las rutas

```ts
export const rutasProducto: Routes = [
  { path: 'vencidos', /* … */ },   // ← literales primero
  { path: ':id',      /* … */ },
];
```

⚠️ **Un segmento literal siempre antes que el paramétrico.** Con el orden
invertido, `/producto/vencidos` resuelve `vencidos` como id y la pantalla
carga el producto `NaN`. Ya pasó en recepción, en solicitud de pago, en
gastos y en producto: es el error más repetido del repo, y por eso cada
`*.routes.ts` que lo tiene lo dice en un comentario.

### Qué va fuera del shell

Casi todo cuelga del shell y hereda barra de navegación, FAB y guard. Salen
del shell las pantallas que **no son de navegación**: el login, y el modo
kiosco —que la mira un cliente, no un empleado—. Sacarla del shell es la
forma correcta; la alternativa, esconder la barra por lista de rutas, obliga
a acordarse de actualizar esa lista para siempre.

---

## 5 · Reglas de negocio: funciones puras con su prueba

Cuando una decisión se puede equivocar en silencio —interpretar un código,
elegir a qué pantalla ir, decidir si algo es válido— **no vive en el
componente**. Vive en una función pura, en su archivo, con su `.spec.ts`.

```
venta-tarjeta-qr.ts   → interpretarQrVenta()    + venta-tarjeta.spec.ts
gasto-retiro-qr.ts    → interpretarQrRetiro()   + gasto-retiro-qr.spec.ts
escaneo-ruteo.ts      → rutearEscaneo()         + escaneo-ruteo.spec.ts
tipo-gasto.reglas.ts  → requiereEnteActivo()…   + tipo-gasto-reglas.spec.ts
```

La forma del resultado es siempre la misma: **nunca una excepción para un
rechazo esperado**, sino un objeto que dice qué pasó.

```ts
export interface ResultadoQrRetiro {
  ok: boolean;
  motivo?: 'qr-invalido' | 'no-es-retiro' | 'datos-incompletos';
  mensaje?: string;      // listo para mostrarle al usuario
  datos?: DatosQrRetiro; // solo si ok
}
```

El `motivo` es para el test —que asegura *por qué* se rechazó, no solo que se
rechazó— y el `mensaje` es para la pantalla. Sin el motivo, un test pasa
igual cuando el rechazo ocurre por la razón equivocada.

**Por qué importa que sea pura:** se prueba sin montar Angular, sin backend y
sin navegador. Los tres bugs del QR de retiro de caja chica se veían
leyendo un test de seis líneas y no se veían leyendo la pantalla.

---

## 6 · Errores: qué se avisa y qué se calla

`DatosService` avisa por toast y propaga por el canal de error. Eso es lo
correcto **para la consulta principal de una pantalla**. Para una consulta
secundaria, no:

```ts
this.busqueda.stockPorSucursales(id, { notificarError: false }).subscribe({
  next: (mapa) => { /* … */ },
  error: () => this.stockFallo.set(true),
});
```

| Situación | Qué hacer |
|---|---|
| Consulta principal | Estado de error en la pantalla, con *Reintentar* |
| Consulta secundaria de la misma pantalla | `notificarError: false` y un estado propio de esa sección. La pantalla sigue sirviendo |
| Consulta de fondo (conteos, badges) | `mostrarCarga: false` y `notificarError: false`. Nadie la pidió |

### La regla que más cuesta y más importa

**«No hay» y «no pude preguntar» son respuestas distintas, y no se pueden
mostrar igual.**

Un cero afirma. Si la consulta de existencias falla y la pantalla lista todas
las sucursales en `0,00`, le está diciendo al usuario que no hay mercadería —
una afirmación que nadie hizo. Lo mismo con un resumen de crédito en cero
cuando la persona no es cliente: dice que agotó su crédito.

En los dos casos el patrón es el mismo: una señal aparte que distingue el
fallo del vacío, y un texto que no afirma nada.

```ts
readonly cargandoStock = signal(true);
readonly stockFallo = signal(false);   // ← distingue las dos cosas
```

---

## 7 · Números que vienen de afuera

```ts
function aId(valor: unknown): number | null {
  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}
```

⚠️ **`Number('')` devuelve `0`, no `NaN`.** Es la trampa que hay que cubrir
cada vez que un id llega de una URL, de un QR o de GraphQL. Con un
`Number.isFinite()` a secas, un campo vacío pasa la validación y la app
navega a `/inventario/0` — una pantalla de detalle pidiendo el registro cero,
que da un error del servidor donde tenía que haber un aviso claro.

Lo mismo con `Number(null)` → `0` y `Number(' ')` → `0`.

---

## 8 · Dinero

**El backend calcula, el cliente muestra** (regla 6). Lo que sí se hace acá:

- **Mostrar** con `<frc-importe [valor]="…" moneda="Guaraní" simbolo="₲" />`,
  que sabe que el guaraní no lleva decimales y pinta los negativos en rojo.
- **Restar dos totales que el backend ya emitió** para poder mostrarlos
  juntos. `resumirCredito()` hace `limite − utilizado`, y eso no es calcular
  dinero: es presentar dos números que ya existen.

Lo que **no** se hace: convertir monedas multiplicando por un tipo de cambio,
prorratear, calcular impuestos. Si hace falta, lo manda el central.

⚠️ **Cuidado con un formulario que recoge lo que la mutation no puede
llevar.** `GastoRendicionInput.montoTotal` es un solo `Float` sin moneda:
`frc-mobile` ofrecía varias filas con su moneda y al guardar mandaba **solo
la de guaraníes**, descartando el resto sin avisar. Antes de portar un
formulario, mirar qué acepta el input.

---

## 9 · Fechas

Todo pasa por `fechaLegible()`. Nunca `new Date(string)`: el central manda
`yyyy-MM-dd HH:mm` —con espacio, no con la `T` de ISO—, que Chrome interpreta
como hora local y Safari como `Invalid Date`.

```ts
fechaLegible(valor)                      // 14/08/2026 09:30
fechaLegible(valor, { conHora: false })  // 14/08/2026
```

**Sin hora para lo que ocurre en un día**: un nacimiento, un vencimiento, una
jornada. Con hora para lo que ocurre en un momento.

⚠️ **La época Unix no es una fecha, es una fecha ausente.** El central
serializa un `Date` nulo como `1970-01-01 00:00`, así que una persona sin
fecha de nacimiento cargada aparecía nacida el año nuevo del 70 a medianoche.
`fechaLegible` la lee como ausente.

---

## 10 · Capacidades de dispositivo

Viven en `core/dispositivo/`, **detrás de una interfaz propia**, nunca
apoyadas directamente en la API del navegador desde una pantalla. Es lo que
permite cambiar de motor tocando un archivo y no doce pantallas.

**Toda capacidad necesita su camino en Safari** (regla 7), y lo que se carga
solo para Safari va en un chunk aparte por `import()` dinámico: el peso no lo
paga Android.

| Capacidad | Chromium | Safari / iOS |
|---|---|---|
| Códigos | `BarcodeDetector` | ZXing por `import()` |
| Foto | `<input type="file" capture>` | igual |
| Cámara en vivo | `getUserMedia` | `getUserMedia` + `playsinline` y `muted` |

⚠️ **Para sacar una foto, `<input type="file" capture="environment">`, no
`getUserMedia`.** Abre la cámara directo, funciona igual en iOS, y además
deja elegir una foto ya sacada — que es lo que pasa cuando alguien rinde un
gasto al día siguiente. `getUserMedia` queda para lo que necesita ver el
video en vivo, como el escáner.

---

## 11 · Presentación que calcula el backend

Algunos módulos reciben del central campos ya resueltos para mostrar:
`estadoEtiqueta`, `estadoColor`, `estadoIcono` en caja chica;
`diasVencimientoTexto` y la clasificación en vencidos.

**Ese patrón es correcto y no hay que romperlo**: si el central agrega un
estado, la UI lo refleja sola.

Lo que sí se traduce es el **vocabulario visual**: el central manda
`vencimientoColor` como hex y `diasVencimientoClase` como clase CSS del
sistema viejo. El hex no se usa —viola la regla 2 y además ignora el tema
oscuro—; se lee la **clasificación** (`vencido` / `por-vencer` / `vigente`) y
se mapea a los cinco tonos del sistema de diseño.

Beneficio lateral: el umbral de «por vencer» —hoy siete días— queda en el
backend. Si mañana pasa a diez, la app lo sigue sin tocar nada.

---

## 12 · Pruebas

`vitest`. Tres clases, y cada cosa se prueba en la más barata que alcance:

| Qué | Cómo |
|---|---|
| Regla pura | Llamar la función. Sin TestBed |
| Componente con datos | `TestBed` + doble del servicio (`vi.fn()` que devuelve `of(...)`) |
| Pantalla que arrastra Apollo sin ser el tema | `imports: APOLLO_DE_PRUEBA` |

```ts
TestBed.configureTestingModule({
  imports: APOLLO_DE_PRUEBA,          // ver src/app/pruebas/apollo-de-prueba.ts
  providers: [
    provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
    { provide: MisFinanzasService, useValue: { resumenCredito: () => of(null) } },
  ],
});
```

**Los tests de este repo prueban el motivo, no la forma.** El nombre de un
test dice qué tiene que ser verdad para el usuario —*«sin cliente asociado
explica que no hay convenio, no muestra un error»*— y no qué método se llamó.
Cuando el test cubre una regresión, el comentario dice qué se rompía.

**Los datos del test se eligen para que no coincidan.** En
`gasto-retiro-qr.spec.ts` ninguna pareja de campos tiene el mismo valor: si
la función leyera un campo por otro, el test lo delata en vez de pasar de
casualidad.

---

## 13 · Comentarios

El repo comenta **por qué**, nunca **qué**. Un comentario que repite el
código en castellano es ruido; uno que explica una decisión evita que la
próxima persona la deshaga.

Se comenta:

- **Lo contraintuitivo**, con `⚠️` — un campo que no está donde su nombre
  sugiere, un orden que importa, una API que miente.
- **Lo que se decidió no hacer**, con el motivo. «El selector de moneda no se
  porta, y es una decisión» vale más que su ausencia.
- **Las regresiones**: qué se rompía antes de esta línea.

⚠️ **Nunca un backtick dentro de `template:` o `styles:`.** Rompe el literal
y el error que sale no señala la causa. Es la regla 8 del proyecto y se cae
en ella escribiendo comentarios en el template — donde uno naturalmente
querría escribir `` `frc-mobile` ``.

---

## 14 · Commits

Convencionales, en inglés, con el cuerpo explicando **qué problema resuelve**
y no qué archivos toca. Un commit por decisión: si el mensaje necesita un
«además», probablemente son dos.

```
fix(caja-chica): the withdrawal QR could never be scanned

Scanning the QR the cashier prints always answered "Ese codigo no es de
esta aplicacion". Three defects stacked on the same path:
…
```

---

## 15 · Antes de dar algo por terminado

1. Los tres estados: cargando, vacío, error.
2. `npm run build` en verde — **es el gate real**. `tsc --noEmit` no
   typechequea las plantillas: un `p.ciudad.nombre` inexistente pasa limpio.
3. `npm test` en verde.
4. Su bloque en [`PLAN_TESTEO_MANUAL.md`](PLAN_TESTEO_MANUAL.md), con
   «Esperado» por caso y la tabla de totales actualizada.
5. Qué quedó **sin** verificar, dicho explícitamente.

---

## 16 · Trampas del framework

Cosas que **no fallan**: no tiran error, no ensucian la consola, y hacen algo
razonable que no es lo que se pidió. Todas se encontraron usando la app, no
leyendo el código, y por eso están acá con su síntoma primero.

### `mat-select` trata `null` como «sin elegir»

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

### Un bloque de control de flujo con más de un nodo raíz no proyecta

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

### `navigator.serviceWorker.ready` no se rechaza nunca

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

### Aceptar rutas por prefijo puede dar un bucle de redirección

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

### Cuidado al medir una navegación con rutas perezosas

Probando el traductor, `/operaciones/transferencias/431` parecía **no**
traducirse. No era cierto: Angular necesita **cargar el chunk** de
`operaciones` para descartar que la ruta esté ahí adentro y recién entonces
caer en el comodín. Con 800 ms de espera el resultado se leía antes de tiempo;
con 1600 ms daba bien.

Vale para cualquier verificación por DOM: **una ruta perezosa tarda más en
resolver que una ansiosa**, y medir temprano da un falso negativo que se lee
como bug.

---

### Un archivo generado no dice lo que no le toca decir

`android/app/google-services.json` del repo `frc-mobile` lista **solo clientes
Android**. Que no aparezca una app Web ahí **no significa** que no exista: ese
archivo nunca las lista.

Esa lectura al revés costó dar por bloqueado el push cuando la app Web ya
estaba registrada.

La regla: antes de concluir «esto no está configurado» a partir de un archivo
generado, confirmar que ese archivo **puede** contener lo que se busca.

---

### Cómo se encontró cada una

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
