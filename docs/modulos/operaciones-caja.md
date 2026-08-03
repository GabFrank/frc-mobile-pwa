# operaciones / caja — apertura, cierre y arqueo

Cubre cinco submódulos que forman un solo circuito: **`caja`** (1.483 LOC), **`conteo`** (1.018), **`moneda`** (481), **`maletin`** (325) y **`caja-info`** (221).

**Rutas:** `/operaciones/caja` y `/operaciones/caja/info` (ambas eager, declaradas en `operaciones-routing.module.ts`).

## Qué resuelve

El ciclo de vida de una **caja de punto de venta (PDV)**: se abre con un arqueo inicial de efectivo, opera durante el turno, y se cierra con un arqueo final. La diferencia entre lo contado y lo esperado es el faltante/sobrante del cajero.

```
Maletín (contenedor físico)
   └─ PdvCaja ── conteoApertura ─┐
                                 ├─ Conteo → ConteoMoneda[] → MonedaBillete
                └─ conteoCierre ─┘
                                 └─ CajaBalance (calculado por el backend)
```

## Control de acceso

El ítem "Caja" del menú aparece solo si `puedeAccederCaja` es `true`, que exige rol `ADMIN` o `VENTA_TOUCH` (`RoleService`). Ver [`../arquitectura/routing-navegacion.md`](../arquitectura/routing-navegacion.md).

## Modelo de datos

### `PdvCaja`

| Campo | Nota |
|---|---|
| `descripcion`, `sucursalId`, `sucursal` | Identificación |
| `activo` | Caja habilitada |
| `estado` | `PdvCajaEstado` |
| `tuvoProblema` | Marca de incidente en el turno |
| `fechaApertura` / `fechaCierre` | |
| `maletin` | Contenedor físico del efectivo |
| `conteoApertura` / `conteoCierre` | Arqueos |
| `balance` | `CajaBalance`, **calculado por el backend** |
| `observacion`, `usuario`, `creadoEn` | |

### `PdvCajaEstado`

```ts
export enum PdvCajaEstado {
  'En proceso' = 'EN_PROCESO',
  'Concluido' = 'CONCLUIDO',
  'Necesita verificacion' = 'NECESITA_VERIFICACION',
  'En verificacion' = 'EN_VERIFICACION',
  'Verificado y concluido sin problema' = 'VERIFICADO_CONCLUIDO_SIN_PROBLEMA',
  'Verificado y concluido con problema' = 'VERIFICADO_CONCLUIDO_CON_PROBLEMA'
}
```

Flujo típico:

```
EN_PROCESO ──> CONCLUIDO
     │
     └──> NECESITA_VERIFICACION ──> EN_VERIFICACION ──┬──> VERIFICADO_CONCLUIDO_SIN_PROBLEMA
                                                       └──> VERIFICADO_CONCLUIDO_CON_PROBLEMA
```

Una caja que cierra con diferencia va a verificación; un supervisor la revisa y determina si hubo problema real.

> ⚠️ **Gotcha — las claves del enum son etiquetas con espacios.** `PdvCajaEstado['En proceso']`, no `PdvCajaEstado.EN_PROCESO`. Es deliberado: la clave es el texto que se muestra al usuario. Rompe la convención del resto del repo, donde clave y valor coinciden.

### `CajaBalance` — 22 campos, todos calculados por el backend

Agrupados por moneda: **Gs** (guaraníes), **Rs** (reales), **Ds** (dólares).

| Grupo | Campos |
|---|---|
| Ventas | `totalVentaGs/Rs/Ds`, `totalTarjeta` |
| Retiros | `totalRetiroGs/Rs/Ds` |
| Gastos | `totalGastoGs/Rs/Ds` |
| Apertura | `totalAperGs/Rs/Ds` |
| Cierre | `totalCierreGs/Rs/Ds` |
| **Diferencias** | `diferenciaGs/Rs/Ds` |
| Ajustes | `totalDescuento`, `totalAumento`, `totalCanceladas` |

> **Regla clave — el balance nunca se calcula en el cliente.** `diferenciaGs` es el faltante/sobrante que define si el cajero responde por dinero. Recalcularlo en el mobile abriría la puerta a discrepancias con el backend en un dato con consecuencias laborales. Mostralo tal cual viene.

> ⚠️ **Gotcha — `totalTarjeta` no tiene desglose por moneda.** A diferencia de ventas, retiros y gastos, la tarjeta es un único total. La acreditación de tarjeta se maneja en el módulo `venta-tarjeta`.

### `Conteo` y `ConteoMoneda`

Un `Conteo` es un arqueo: `conteoMonedaList` con la cantidad de cada denominación, más los totales `totalGs`, `totalRs`, `totalDs`.

`ConteoMoneda` liga una cantidad a un `MonedaBillete` (una denominación concreta: billete de 50.000 Gs, moneda de 500 Gs, etc.).

Métodos:
- `Conteo.toInput(): ConteoInput` — cabecera
- `Conteo.toInpuList(): ConteoMonedaInput[]` — *(sic, typo)* mapea cada `ConteoMoneda` a su input

> 🐛 **Bug de tipado en `Conteo` y `ConteoInput`:**
> ```ts
> totalGs: number;
> totalRs; number;    // ← punto y coma en vez de dos puntos
> totalDs: number;
> ```
> `totalRs;` queda declarada **sin tipo** (`any` implícito) y además se crea una propiedad espuria llamada `number`. Está en ambas clases (`conteo.model.ts`). No rompe en runtime porque `any` acepta todo, pero elimina el chequeo de tipos justo en un campo de dinero. Anotado en [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

### `Maletin`

`descripcion`, `activo`, `abierto`, `creadoEn`, `usuario`. Es el contenedor físico del efectivo; `abierto` indica si está en uso por alguna caja.

`BuscarMaletinDialogComponent` permite elegirlo al abrir caja.

### `Moneda` y `MonedaBillete`

`Moneda`: `denominacion`, `simbolo`, `pais`, **`cambio`** (cotización), `imagen`, `monedaBilleteList`.

> ⚠️ **Gotcha — `Moneda.toInput()` descarta `cambio`.** El input solo lleva `denominacion`, `simbolo`, `paisId` y `usuarioId`. La cotización se actualiza por otra vía. Guardar una moneda editada no persiste el cambio de cotización.

## Servicio — `CajaService`

### Apertura y cierre

```ts
onAbrirCaja(cajaInput, conteoInput, conteoMonedaInputList)
onCerrarCaja(cajaId, sucursalId, conteoInput, conteoMonedaInputList)
```

> **Regla clave — la caja y su arqueo se guardan en una sola operación.** Ambas mutations reciben la cabecera del conteo **y** la lista de denominaciones. No se abre la caja primero y se cuenta después: sería posible tener una caja abierta sin arqueo inicial, y entonces la diferencia al cierre no sería calculable.

> ⚠️ **Gotcha — `onCerrarCaja` exige `sucursalId` explícito**, mientras que `onAbrirCaja` no. El cierre puede ejecutarse sobre una caja de otra sucursal (ver multi-sucursal abajo).

### Consulta de cajas abiertas — cuatro variantes

| Método | Alcance |
|---|---|
| `onGetByUsuarioIdAndAbierto(id)` | Cajas abiertas del usuario |
| `onGetByUsuarioIdAndAbiertoLocal(id)` | **Solo del servidor local** |
| `onGetByUsuarioIdAndAbiertoDesdeFiliales(id)` | **Consultando las filiales** |
| `onGetByUsuarioIdAndAbiertoPorSucursal(id, sucId)` | De una sucursal puntual |

> ⚠️ **Gotcha — la variante `Local` existe por una razón concreta.** El commit `871ef6f fix(caja): resolver caja abierta con la query local del central en venta tarjeta` y el PR #86 (*"caja abierta por query local del central — adiós proxy multi-filial"*) reemplazaron la consulta multi-filial por la local en el flujo de venta con tarjeta: el proxy a filiales era lento y frágil. **Para código nuevo preferí la variante local** salvo que necesites explícitamente ver cajas de otras sucursales.

### Resto de la API

| Método | Qué hace |
|---|---|
| `onSave(input, sucId)` / `onSavePorSucursal(input, sucId)` | Alta/edición |
| `onGetById(id, sucId?)` | Detalle |
| `onGetByIdFromFilial(id, sucursalId)` | Detalle desde una filial |
| `onGetByUsuarioId(id, offset)` | Histórico del usuario |
| `onGetBalanceByDate(inicio?, fin?)` | Balance por rango |
| `onDelete(id, showDialog?)` | Baja |
| `onImprimirBalance(id, sucursalId?, mostrarNotificacion?)` | Impresión del balance |

> ⚠️ **Gotcha — `onGetBalanceByDate` acepta fechas opcionales.** Si se llama sin fechas cae en el camino de `onGetByFecha` de `GenericCrudService`, que tiene el bug de fecha por defecto (rango que arranca en 1970). **Pasá siempre ambas fechas.** Ver [`../arquitectura/apollo-graphql.md`](../arquitectura/apollo-graphql.md).

## Operaciones GraphQL

`caja/graphql/` — 18 archivos.

**Mutations:** `abrirCaja`, `cerrarCaja`, `saveCaja`, `saveCajaPorSucursal`, `deleleCaja` *(sic)*, `imprimirBalance`.

**Queries:** `cajaPorId`, `allCajas`, `cajasPorFecha`, `cajasPorUsuario`, `cajaPorUsuarioIdAndAbierto`, `cajaPorUsuarioIdAndAbiertoPorSucursal`, `cajaAbiertoPorUsuarioIdLocal`, `cajasAbiertasDesdeFiliales`, `pdvCajaDesdeFilial`, `balancePorFecha`.

Conteo aporta `saveConteo`, `deleleConteo` *(sic)*, `saveConteoMoneda`, `deleleConteoMoneda`.

> ⚠️ **Typo repetido: `delele` en vez de `delete`** en cuatro archivos (`deleleCaja.ts`, `deleleConteo.ts`, `deleleConteoMoneda.ts`). El nombre del archivo y la clase lo arrastran. **Verificá si el nombre de la operación GraphQL también está mal escrito antes de renombrar**: si el backend expone `deleleCaja`, corregir el cliente rompe la llamada.

## Diálogos

| Componente | Para qué |
|---|---|
| `AdicionarConteoDialogComponent` | Carga del arqueo de apertura |
| `AdicionarConteoCierreDialogComponent` | Carga del arqueo de cierre |
| `BuscarMaletinDialogComponent` | Selección de maletín |

Hay dos diálogos de conteo separados porque el de cierre muestra además lo esperado según el balance, para que el cajero vea la diferencia mientras cuenta.

## `caja-info`

`CajaInfoComponent` (221 LOC) en `/operaciones/caja/info`: vista de solo lectura del estado y balance de la caja actual.

## Al trabajar en este módulo

1. **Nunca calcules el balance ni las diferencias en el cliente.**
2. Apertura y cierre van con su arqueo en la misma llamada.
3. Para saber si el usuario tiene caja abierta, usá la variante **local** salvo que necesites cobertura multi-sucursal.
4. `onGetBalanceByDate` siempre con ambas fechas.
5. El enum `PdvCajaEstado` se indexa por etiqueta con espacios, no por constante.
