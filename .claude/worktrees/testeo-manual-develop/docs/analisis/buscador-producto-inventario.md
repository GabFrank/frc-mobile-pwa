# Buscador de producto — inventario de usos en `frc-mobile`

Relevamiento de **todos** los lugares donde se usa `SearchProductoDialogComponent`
y qué necesita cada uno, para decidir qué tiene que saber hacer el buscador de
la PWA.

Fecha del relevamiento: **2026-08-05**, contra `frc-comercial/mobile/`.

---

## 1. Los nueve usos

Ocho abren el diálogo; el noveno es la misma pantalla como ruta.

| # | Quién lo abre | Archivo | Qué le pasa | Qué espera de vuelta |
|---|---|---|---|---|
| 1 | **Dashboard de producto** | `producto-dashboard.component.ts:26` | `mostrarPrecio: true`, `abrirCamara: false` | `{producto, presentacion}` — **lo descarta**: es consulta pura |
| 2 | **Devolución nueva** | `devolucion.component.ts:149` | `mostrarPrecio: false`, `sucursalId` | `{producto, presentacion}` → abre el diálogo de ítem |
| 3 | **Detalle de devolución** | `detalle-devolucion.component.ts:127` | `mostrarPrecio: false`, `sucursalId` | ídem |
| 4 | **Inventario · consultar stock** | `edit-inventario.component.ts:298` | `sucursalId`, `isInventario: false` | **nada** — se usa solo para mirar |
| 5 | **Inventario · agregar producto** | `edit-inventario.component.ts:311` | `isInventario: true`, `invPro`, `sucursal` | **`InventarioProductoItemInput`** — otra forma por completo |
| 6 | **Control de inventario · filtro** | `control-inventario.component.ts:291` | `sucursalId`, `abrirCamara: false` | `{producto}` — solo el producto, para filtrar |
| 7 | **Productos vencidos · filtro** | `productos-vencidos.component.ts:604` | `sucursalId`, `abrirCamara: false` | `{producto}` — ídem |
| 8 | **Ruta `/producto/buscar/:mostrarPrecio`** | `producto-routing.module.ts:19` | `mostrarPrecio` por parámetro de ruta | nada: el back navega |
| 9 | **Transferencias · lista de productos** | `transaferencia-list-productos.component.ts` | — | **no es el mismo componente: es una copia** |

> ⚠️ **El #9 es una copia, no un uso.** `TransaferenciaListProductosComponent`
> reimplementa la misma pantalla —mismo buscador, mismo acordeón, mismo
> «Cargar más», mismo `ProductoBusquedaService`— para agregarle stock de
> **origen y destino** a la vez. Es la señal más clara de que el componente
> original no era extensible: cuando hizo falta una columna más, se lo copió.

---

## 2. Los cinco modos que conviven en un componente

Los usos anteriores se agrupan en cinco comportamientos que el componente
resuelve con banderas (`mostrarPrecio`, `isInventario`, `sucursalId`,
`abrirCamara`):

### A · Elegir una presentación → **usos 1, 2, 3, 8**
Es el modo base. Se toca una presentación y el diálogo cierra devolviendo
`{producto, presentacion, peso?}`.

### B · Elegir un producto para filtrar → **usos 6, 7**
No interesa la presentación: se quiere el producto para acotar un reporte.
Hoy igual hay que abrir el acordeón y tocar una presentación, y el llamador
descarta esa parte.

### C · Consultar stock, sin elegir nada → **uso 4**
Se abre, se mira, se cierra. El resultado se ignora.

### D · Cargar un ítem de inventario → **uso 5**
**Deja de ser un selector y pasa a ser un formulario.** Cada presentación se
expande en cantidad, vencimiento y estado, con la lista de vencimientos de
inventarios anteriores, que se pueden editar o quitar. Devuelve un
`InventarioProductoItemInput`, no un producto.

### E · Transferencia → **uso 9**
Igual que A pero con stock de dos sucursales. Vive en un archivo aparte.

---

## 3. Funciones que el buscador tiene que saber hacer

Extraídas de `search-producto-dialog.component.{ts,html}` (442 + 204 líneas).

### Búsqueda

| # | Función | Detalle |
|---|---|---|
| 1 | Buscar por texto | Con **debounce de 1 s** (`setTimeout` en `onSearchProducto`) |
| 2 | Buscar por código | Candidatos en orden vía `ProductoBusquedaService` |
| 3 | **Pesable** | Si el texto es código de balanza, **cierra solo** devolviendo presentación + peso. No muestra lista |
| 4 | Escanear con cámara | Ícono en el campo. Con `abrirCamara !== false` se abre **automáticamente al entrar**, salvo en web |
| 5 | Cargar más | Offset = cantidad actual de la lista |
| 6 | Aviso de vacío | `notificacionService.warn('Producto no encontrado')` |
| 7 | Foco automático en el campo | `setFocus()` con `setTimeout(100)` |

### Sobre cada producto

| # | Función | Detalle |
|---|---|---|
| 8 | Expandir → **cargar presentaciones** | Perezoso: la búsqueda por texto no las trae. `getProducto(id)` al abrir |
| 9 | Expandir → **cargar stock** | Solo si vino `sucursalId`. Con spinner por fila |
| 10 | **Ver stock por sucursal** | Abre `StockPorSucursalDialogComponent`. Con `sucursalId` muestra una sola; sin él, todas |
| 11 | Ver imagen ampliada | `PhotoViewer` sobre la miniatura de la presentación |

### Sobre cada presentación

| # | Función | Detalle |
|---|---|---|
| 12 | Elegir | Cierra el diálogo con `{producto, presentacion}` |
| 13 | Mostrar precio | Solo si `mostrarPrecio` — es **una línea** de todo el componente |
| 14 | Mostrar stock de la presentación | `stockPorProducto / presentacion.cantidad` |
| 15 | Código de barra principal | |

### Solo en modo inventario (D)

| # | Función |
|---|---|
| 16 | Cantidad, vencimiento y estado por presentación |
| 17 | Listar vencimientos de inventarios anteriores |
| 18 | Editar un vencimiento anterior → lo copia al inventario actual |
| 19 | Quitar un vencimiento |
| 20 | Guardar: compara la cantidad con el stock y marca `verificado` o `revisado` |

### Navegación

| # | Función |
|---|---|
| 21 | FAB «subir» que aparece al scrollear más de 10 px |
| 22 | Volver: si vino por ruta navega, si vino por diálogo cierra |

---

## 4. Qué se lleva a la PWA y qué no

### Se lleva

Los modos **A, B, C y E**. Son el mismo selector con distinto contexto: cambia
qué se muestra al costado y qué devuelve al elegir.

### No se lleva al buscador

El modo **D** (cargar ítem de inventario). Es un formulario de carga, no un
selector: tiene su propio guardado, su propia lista y su propio tipo de
retorno. Meterlo en el buscador es lo que llevó el componente a 442 líneas y
lo que obligó a la copia de transferencias. **Va en el módulo de inventario,
reutilizando el buscador para elegir el producto y siguiendo en su pantalla.**

### Se corrige

| Qué | Por qué |
|---|---|
| El modo B obliga a elegir presentación y después la descarta | Si lo que se quiere es el producto, tocarlo tiene que alcanzar |
| El debounce de 1 s no cancela la búsqueda anterior en vuelo | Solo cancela el timer. Dos búsquedas rápidas pueden llegar desordenadas y gana la que conteste última |
| `abrirCamara` abre la cámara **antes** de que el usuario pida nada | En web no lo hace, así que el comportamiento ya difiere por plataforma |

---

## 5. Diseño propuesto para la card

Reemplaza al acordeón de Ionic manteniendo lo que funciona —expandir para ver
presentaciones— y agregando un menú contextual.

```
┌────────────────────────────────────────────────┐
│ ▣  COCA COLA 2LTS                          ⋮   │  ← menú contextual
│    7840058000750 · Balanza                     │
│                                          ▾     │  ← toca para expandir
├────────────────────────────────────────────────┤
│    Unidad          7840058000750               │
│    ₲ 12.000                    Stock 24        │  ← al tocar: elegir
│    Caja x12        7840058000751               │
│    ₲ 138.000                   Stock 2         │
└────────────────────────────────────────────────┘
```

**El menú `⋮` se arma según el contexto**, no es fijo:

| Opción | Aparece cuando |
|---|---|
| Ver stock por sucursal | siempre |
| Ver detalle | siempre |
| Elegir producto | el llamador quiere el producto, no la presentación (modo B) |
| Ajustar stock | el llamador lo habilita y el usuario tiene el rol |

**La expansión carga en el momento**: presentaciones y stock se piden al
abrir, igual que hoy, no en la búsqueda.

**Tocar una presentación elige** y cierra, como hoy.

### Forma que tendría

```ts
// Lo que el llamador declara
export interface OpcionesBuscador {
  /** Qué devuelve al elegir. */
  devuelve: 'presentacion' | 'producto';
  /** Acota el stock a una sucursal; sin esto no se muestra stock. */
  sucursalId?: number;
  mostrarPrecio?: boolean;
  /** Acciones extra del menú, además de las fijas. */
  acciones?: AccionProducto[];
}
```

El componente de card sería genérico por la [regla de tres](../../CLAUDE.md):
aparece en buscar, devolución, inventario, transferencias y productos
vencidos — cinco pantallas de módulos distintos.

---

## 6. Estado de implementación — 2026-08-05

### Modos

| Modo | Estado |
|---|---|
| **A** · Elegir presentación | ✅ |
| **B** · Elegir producto | ✅ implementado, **sin consumidor todavía** |
| **C** · Solo consultar | ✅ es la pestaña Buscar |
| **D** · Cargar ítem de inventario | ⏸ va en el módulo de inventario, no acá |
| **E** · Transferencia | ⏸ necesita stock de origen **y** destino |

### Las 22 funciones

| # | Función | Estado |
|---|---|---|
| 1 | Buscar por texto | ✅ |
| 2 | Buscar por código | ✅ |
| 3 | Pesable | ✅ |
| 4 | Escanear con cámara | ✅ |
| 5 | Cargar más | ✅ |
| 6 | Aviso de vacío | ✅ como estado vacío, no como toast |
| 7 | **Foco automático en el campo** | ⏸ |
| 8 | Expandir → presentaciones | ✅ |
| 9 | Expandir → stock | ✅ |
| 10 | Ver stock por sucursal | ✅ una sola consulta |
| 11 | **Ver imagen ampliada** | ⏸ |
| 12 | Elegir presentación | ✅ |
| 13 | Mostrar precio | ✅ |
| 14 | Stock de la presentación | ✅ |
| 15 | Código de barra | ✅ |
| 16–20 | Modo inventario | ⏸ va en inventario |
| 21 | **FAB «subir»** | ⏸ |
| 22 | Volver: ruta vs diálogo | ➖ la pestaña no vuelve a ningún lado |

---

## 7. Lo que falta y cuándo se hace

Nada de esto está olvidado: **se implementa cuando aparezca el consumidor que
lo necesita**, no antes. Adelantarlo sería adivinar la forma sin el caso de
uso, que es exactamente lo que llevó al componente original a 442 líneas.

| Qué | Cuándo | Por qué esperar |
|---|---|---|
| **Abrirlo como diálogo selector** | Con devolución, el primer consumidor real | `(seleccion)` ya emite; falta el `DialogoService.abrir()` que lo envuelva y devuelva. Sin un llamador no se sabe qué ancho ni qué título necesita |
| **Foco automático en el campo** (7) | Con el modo diálogo y con el kiosco | En una pestaña que se abre por navegación, robar el foco levanta el teclado sin que nadie lo pida. En un diálogo de selección **sí** corresponde |
| **Ver imagen ampliada** (11) | Con el detalle de producto | Hoy la card muestra un ícono genérico. `imagenPrincipal` viene en la query pero no se usa |
| **FAB «subir»** (21) | Si las listas se vuelven largas | Con 10 por tanda no hace falta. Aparece cuando alguien se queje de scrollear |
| **Stock de dos sucursales** (modo E) | Con transferencias | La card recibe un `stock`. Para origen y destino hay que decidir si son dos inputs o una lista de pares — con la pantalla real delante |
| **Modo inventario** (D, 16–20) | Con el módulo de inventario | Es un formulario de carga, no un selector. Ver §4 |
| **Detalle de producto** | Con la ola de producto | Presentaciones, precios por tipo y stock por sucursal en su propia pantalla |
| **Modo kiosco** (`mostrar-precio`) | Con la ola de producto | Necesita foco permanente. Con un lector HID es el caso más rentable del módulo |
