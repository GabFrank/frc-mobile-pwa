# Componentes reutilizables y diálogos

> ⚠️ **Documento histórico.** Describe `frc-mobile` (Ionic + Capacitor), no este repo. Se conserva porque explica reglas de negocio y decisiones que se heredaron. Para la implementación actual, ver [`../design-system.md`](../design-system.md) y [`../arquitectura/capa-de-datos.md`](../arquitectura/capa-de-datos.md).

## `ComponentsModule`

`src/app/components/components.module.ts`. Para usar cualquiera de estos componentes, importá `ComponentsModule` en el módulo de tu página.

Declara 8 componentes + `EnumToStringPipe`, pero **exporta solo 6**:

| Componente | Selector | ¿Exportado? |
|---|---|---|
| `SelectorGenericoComponent` | `app-selector-generico` | ✅ |
| `BuscadorModalComponent` | `app-buscador-modal` | ✅ |
| `PaginacionComponent` | `app-paginacion` | ✅ |
| `SeccionAccordionComponent` | `app-seccion-accordion` | ✅ |
| `QrGeneratorComponent` | `app-qr-generator` | ✅ |
| `EnumToStringPipe` | pipe `enumToString` | ✅ |
| `GenericListDialogComponent` | `app-generic-list-dialog` | ❌ solo modal |
| `ChangeServerIpDialogComponent` | `app-change-server-ip-dialog` | ❌ solo modal |
| `ImagePopoverComponent` | `app-image-popover` | ❌ solo popover |

Los tres no exportados se usan **exclusivamente** vía `ModalService.openModal(...)` / `PopOverService.open(...)`, que los instancian dinámicamente. No los pongas en un template.

`ComponentsModule` también reexporta `NgxPaginationModule`, así que importarlo alcanza para usar la paginación de `ngx-pagination`.

---

## `SelectorGenericoComponent`

Select uniforme sobre `ion-select`. Usa `ChangeDetectionStrategy.OnPush`.

| Input | Tipo | Default |
|---|---|---|
| `etiqueta` | `string` | `''` |
| `placeholder` | `string` | `''` |
| `opciones` | `OpcionSeleccion[]` | `[]` |
| `valor` | `unknown` | `null` |
| `interfaz` | `'action-sheet' \| 'alert' \| 'popover'` | `'action-sheet'` |

Output: `valorChange: EventEmitter<unknown>`.

```ts
export interface OpcionSeleccion {
  valor: unknown;
  texto: string;
}
```

> ⚠️ **Gotcha — la comparación de valores es por `String(a) === String(b)`.** El comparador convierte ambos lados a string, así que el número `5` y la cadena `'5'` se consideran iguales. Está hecho a propósito (los ids llegan a veces como string desde GraphQL), pero significa que **no podés usar objetos como `valor`**: todos colapsarían a `[object Object]` y se seleccionarían entre sí. Usá ids primitivos.

---

## `BuscadorModalComponent`

Modal de búsqueda genérico, tipado (`BuscadorModalComponent<T>`), con `OnPush`. **Es el componente estándar para "elegir una entidad de una lista".**

| Input | Tipo |
|---|---|
| `abierto` | `boolean` |
| `config` | `BuscadorModalConfig<T> \| null` |
| `valorSeleccionadoId` | `unknown` |

Outputs: `seleccionar: EventEmitter<T>`, `cerrar: EventEmitter<void>`.

Dos modos, discriminados por `modo`:

**`'local'`** — la lista completa ya está en memoria:
```ts
{
  modo: 'local',
  titulo, placeholder, icono,
  items: T[],
  campoTexto: (item) => string,
  campoId: (item) => unknown,
  campoSubtexto?: (item) => string,
}
```

**`'paginado'`** — con infinite scroll contra el backend:
```ts
{
  modo: 'paginado',
  titulo, placeholder, icono,
  cargarPagina: (texto, pagina) => Promise<{ items: T[]; hayMas: boolean }>,
  campoTexto, campoId, campoSubtexto?,
  tamPagina?, debounceMs?,
}
```

Elegí `local` para catálogos chicos y estables (sucursales, formas de pago) y `paginado` para todo lo que crezca (productos, clientes). En modo paginado, `cargarPagina` debe devolver `hayMas: false` cuando se acaba, o el scroll infinito sigue pidiendo páginas vacías para siempre.

---

## `PaginacionComponent`

Controles de paginación sobre el modelo de página del backend.

| Input | Tipo |
|---|---|
| `pageData` | `PageInfo<any>` |
| `pageIndex` | `number` |

Outputs: `pageChange: EventEmitter<number>`, `currentPageEmitter: EventEmitter<number>`.

`PageInfo<T>` está definido en **`app.component.ts:47`** (no en `domains/`) y refleja el `Page` de Spring Data:

```ts
getTotalPages, getTotalElements, getNumberOfElements,
isFirst, isLast, hasNext, hasPrevious, getPageable
```

> ⚠️ **Gotcha — los nombres de campo tienen el prefijo `get`.** No es un error de copia: el backend serializa los getters de Spring `Page` tal cual, así que las queries GraphQL deben pedir `getTotalPages`, no `totalPages`.

> ⚠️ **Gotcha — al destruirse oculta la paginación global.** `ngOnDestroy` llama `paginationStateService.setPaginationVisible(false)`. Si tenés dos `app-paginacion` en la misma pantalla, destruir uno oculta el estado del otro.

---

## `SeccionAccordionComponent`

Sección colapsable con encabezado.

| Input | Tipo |
|---|---|
| `valor` | `string` — id del acordeón |
| `icono` | `string` |
| `titulo` | `string` |
| `subtitulo` | `string` |

---

## `QrGeneratorComponent`

Renderiza un QR con `@techiediaries/ngx-qrcode` a partir de un `@Input() data`. Para el formato de los QR internos ver [`generic-utils.md`](generic-utils.md#qrutilsts--qr-internos-de-la-app).

---

## Componentes de modal / popover

### `GenericListDialogComponent`

Lista genérica con búsqueda opcional y paginación opcional, configurable por datos. Se abre con `ModalService.openModal(GenericListDialogComponent, data)`.

```ts
export interface GenericListDialogData {
  titulo: string;
  tableData: TableData[];   // columnas a mostrar
  search?: boolean;         // habilita el buscador
  inicialSearch?: boolean;  // busca al abrir
  inicialData?: any;        // datos precargados
  texto?: string;           // texto inicial del buscador
  query?: Query;            // query Apollo para buscar
  paginator?: boolean;      // activa paginación
}
```

Si recibe `query`, la ejecuta con `GenericCrudService.onCustomGet`. **La query debe respetar el alias `data:`** — ver [`../arquitectura/apollo-graphql.md`](../arquitectura/apollo-graphql.md).

Con `inicialData` funciona sin backend, mostrando una lista ya cargada.

### `ChangeServerIpDialogComponent`

Cambio de servidor. Documentado en [`../arquitectura/configuracion-servidor.md`](../arquitectura/configuracion-servidor.md). Toda ruta de guardado termina en `window.location.reload()`.

### `ImagePopoverComponent`

Muestra una imagen ampliada en popover.

---

## Diálogos globales — `src/app/dialog/`

Fuera de `components/`, declarados directamente en `AppModule` (`app.module.ts:105-111`) porque se usan durante el arranque, antes de que haya un módulo de página cargado:

| Componente | Cuándo aparece |
|---|---|
| `LoginComponent` | Pantalla/diálogo de inicio de sesión |
| `CambiarContrasenhaDialogComponent` | Forzado cuando el usuario entra con la contraseña por defecto `'123'` (`login.service.ts:193`) |

También se declara ahí `StockPorSucursalDialogComponent`, que vive en `pages/operaciones/movimiento-stock/` pero se necesita globalmente.
