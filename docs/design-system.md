# Sistema de diseño

Aprobado en el Gate 1. La referencia visual estática está en [`design-system/galeria.html`](design-system/galeria.html) y [`design-system/pantallas.html`](design-system/pantallas.html); la **galería viva** corre en la app en `/design-system` (solo en desarrollo).

## La regla que sostiene todo

> **`src/styles/_tokens.scss` es el único archivo del proyecto que puede contener un valor literal de color, espaciado, radio o tipografía.**

Todo lo demás usa `var(--sp-4)`, `var(--brand)`, `var(--radius-md)`.

Esto existe porque el repo anterior acumuló, sin que nadie lo decidiera: 14 valores de espaciado, 8 radios de borde, dos sistemas paralelos de color de botón, y `#f44336` escrito a mano 50 veces.

## Tokens

| Grupo | Valores |
|---|---|
| Espaciado | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-6` 24 · `--sp-8` 32 · `--sp-12` 48 |
| Radios | `--radius-sm` 8 · `--radius-md` 12 · `--radius-full` 999 |
| Marca | `--brand` `#db392e` · `--brand-accent` `#f57c00` |
| Estado | `--ok` · `--warn` · `--danger` · `--info` · `--neutral` (+ sus `-bg`) |
| Superficies | `--bg` · `--surface` · `--surface-sunken` · `--border` · `--border-light` |
| Texto | `--text` · `--text-soft` · `--text-mute` |
| Tipografía | `--font-ui` · `--font-num` · `--fs-display/title/body/label/caption` |
| Elevación | `--elev-0/1/2` |

**El rojo de marca identifica, no comunica estado.** Se usa en la acción principal y en la navegación activa, nunca para decir "error" — para eso está `--danger`.

**Tema oscuro incluido desde el día uno.** `prefers-color-scheme` como señal por defecto, y `data-theme` en `:root` cuando el usuario elige explícitamente.

## Regla para crear componentes genéricos

> Se crea un genérico cuando el patrón aparece en **3 o más pantallas de módulos distintos**, o cuando **encapsula una regla de negocio** que no debe duplicarse.

Fuera de eso, no. Las cards por módulo, los formularios por entidad y los layouts de pantalla se resuelven con lo que ya existe.

## Catálogo

Todo se exporta desde `src/app/shared/index.ts`.

### Estructura

| Componente | Uso |
|---|---|
| `<frc-pagina>` | Layout canónico: barra superior, contenido, barra de acciones opcional al pie. Slots: `[accionBarra]`, `[acciones]` |
| `<frc-seccion>` | Bloque con título. `[panel]="true"` lo envuelve en superficie elevada |
| `<frc-dato>` | Par etiqueta-valor. Unidad de las pantallas de detalle |

`<frc-pagina>` con `[conVolver]="true"` usa `Location.back()`. Si escuchás `(atras)`, **reemplazás** ese comportamiento — es lo que permite preguntar "¿salir sin guardar?".

### Datos

| Componente | Uso |
|---|---|
| `<frc-card>` | Card de entidad. El más usado. Slots: `[pie]`, `[aparte]` |
| `<frc-estado-chip>` | Estado, resuelto del registro central |
| `<frc-importe>` | Importe con la precisión de su moneda |
| `\| importe` | Pipe equivalente para interpolaciones |

`<frc-card>` se anuncia como botón **solo si alguien escucha `(abrir)`** o si se pasa `[clickable]="true"`. Los clicks originados en controles de sus slots no la abren.

### Entrada

| Componente | Uso |
|---|---|
| `<frc-selector>` | Select. Implementa `ControlValueAccessor` |
| `<frc-campo-importe>` | Campo de importe. Implementa `ControlValueAccessor` |
| `BuscadorComponent` | Diálogo de búsqueda de entidad. Modo `local` o `paginado` |

Ambos campos respetan `formControl.disable()`.

> ⚠️ **`<frc-selector>` compara valores con `String(a) === String(b)`**, porque los ids llegan a veces como número y a veces como string desde GraphQL. Por eso **no se pueden usar objetos como valor**: todos colapsarían a `[object Object]`. Usá ids primitivos.

### Estados

| Componente | Uso |
|---|---|
| `<frc-skeleton>` | Carga. Con la forma de lo que va a llegar |
| `<frc-estado-vacio>` | Vacío. Explica por qué y ofrece salida |
| `<frc-estado-error>` | Error. Qué pasó y cómo seguir |

> **Ningún módulo está terminado sin los tres.** Es parte de la definición de listo, no una mejora posterior.

### Otros

| Componente | Uso |
|---|---|
| `<frc-paginacion>` | Sobre el modelo `Page` de Spring Data |
| `<frc-icono>` | SVG inline. Ver abajo |

## Chip de estado y registro central

`src/app/shared/estado/estado-registry.ts` mapea `NombreDelEnum.VALOR` → `{etiqueta, tono, icono}` para más de veinte máquinas de estado.

```html
<frc-estado-chip enumerado="EstadoDevolucion" [valor]="dev.estado" />
```

Un estado que el backend agregue y no esté registrado **no rompe la pantalla**: se muestra humanizado en tono neutro. Pero conviene sumarlo al archivo.

⚠️ Los valores son los strings que emite el central. Varios están mal escritos ahí (`CONLCUIDA`, `VERFICADO_*`) y **no se corrigen** en el cliente: el string debe coincidir exactamente.

**Excepción a preservar:** solicitud-gastos recibe `estadoEtiqueta`, `estadoColor` y `estadoIcono` ya calculados por el backend. Ahí el chip acepta esos valores directamente:

```html
<frc-estado-chip [etiqueta]="p.estadoEtiqueta" tono="warn" />
```

## Importes

`src/app/generic/utils/moneda.util.ts` encapsula la regla: **el guaraní no lleva decimales**.

- `formatearImporte(valor, moneda?, simbolo?)`
- `parsearImporte(texto)`
- `redondearAMoneda(valor, moneda?)`

Tres detalles que costaron un bug cada uno:

1. **El punto puede ser decimal.** Los teclados numéricos de Android e iOS insertan `.` según el idioma del sistema, no el de la app. Si el texto no tiene coma y termina en punto seguido de 1-2 dígitos, ese punto es decimal. Sin esta regla, `"10.50"` se leía como `1050`.
2. **El redondeo es simétrico.** `Math.round` lleva los `.5` hacia +∞: un sobrante y un faltante de la misma magnitud redondeaban distinto.
3. **No se muestra `-0`.** En un arqueo, donde el rojo del negativo llama la atención, un resultado balanceado no debe leerse como faltante.

`<frc-campo-importe>` redondea al perder el foco, así que nunca sale un guaraní con decimales hacia el backend.

## Íconos

`<frc-icono [nombre]="'camion'" />`. Los trazos SVG están inline en `src/app/shared/icono/icono.component.ts`.

**No se usa una fuente de íconos desde CDN**, por la misma razón por la que el motor de reconocimiento facial no debe depender de jsDelivr: una sucursal con la LAN operativa pero sin salida a internet tiene que seguir funcionando.

Para agregar un ícono, sumá su `path` al mapa del componente.

## Avisos y diálogos

| Servicio | Para |
|---|---|
| `NotificacionService` | Toasts. `ok` / `warn` / `danger` / `neutral` / `conAccion` |
| `DialogoService` | `confirmar` / `confirmarEliminacion` / `abrir` |
| `CargandoService` | Contador reactivo de operaciones en curso |

La duración del toast la fija el tono, no el llamador: un error necesita más tiempo de lectura que un éxito.

`CargandoService` alimenta la barra de progreso del shell. **No abre un overlay bloqueante**: las listas muestran skeleton, que es el patrón aprobado.

## Convenciones de componente

- **Standalone**, siempre.
- **`ChangeDetectionStrategy.OnPush`**, siempre.
- **Signals** (`input()`, `output()`, `computed()`, `signal()`) para el estado.
- Excepción documentada: `<frc-card>` y `<frc-pagina>` usan `@Output() EventEmitter` porque necesitan `.observed` para saber si hay quien escuche — la API de signals no lo expone.
- Los estilos van inline en el componente, usando tokens.
- Todo lo interactivo tiene estado de foco visible.
