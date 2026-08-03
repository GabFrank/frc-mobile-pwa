# operaciones / solicitud-pago, pago, movimiento-stock y varios

Agrupa los submódulos restantes de `operaciones`: **`solicitud-pago`** (934 LOC), **`pago`** (330), **`movimiento-stock`** (250) y **`list-operaciones`** (38).

---

# solicitud-pago

**Ubicación:** `src/app/pages/operaciones/solicitud-pago/`
**Ruta:** `/operaciones/solicitud-pago`

## Qué resuelve

Solicitar el **pago a un proveedor** agrupando una o más notas de recepción ya recibidas. Es la continuación natural del circuito de [`operaciones-pedidos`](operaciones-pedidos.md): primero se recibe la mercadería, después se pide autorización para pagarla.

```
NotaRecepcion (recibida) ──┐
NotaRecepcion (recibida) ──┼──> SolicitudPago ──> Pago ──> PagoDetalle
NotaRecepcion (recibida) ──┘
```

## Modelo

### `SolicitudPago`

| Campo | Nota |
|---|---|
| `proveedor` | A quién se paga |
| `numeroSolicitud` | Identificador |
| `fechaSolicitud` / `fechaPagoPropuesta` | **La propuesta es una fecha sugerida, no comprometida** |
| `montoTotal`, `moneda`, `formaPago` | |
| `estado` | `SolicitudPagoEstado` |
| `notasRecepcion` | `SolicitudPagoNotaRecepcion[]` |
| `pago` | El pago asociado (tipado `any`) |

### `SolicitudPagoNotaRecepcion` — la tabla puente

Liga una solicitud con una nota **y guarda `montoIncluido`**.

> **Regla clave — se puede incluir un monto parcial de una nota.** `montoIncluido` no tiene por qué ser el total de la nota: una factura grande puede pagarse en varias solicitudes. Por eso existe el estado `PARCIAL`. No asumas que la suma de las notas es el total de la nota.

### `SolicitudPagoEstado`

`PENDIENTE` → `PARCIAL` → `CONCLUIDO`, o `CANCELADO`.

> ⚠️ **Gotcha — `SolicitudPago.pago` está tipado `any`.** Se perdió el tipo en la relación con `Pago`. Si accedés a sus campos, no hay ayuda del compilador.

## Servicio — `SolicitudPagoService`

| Método | Qué hace |
|---|---|
| `onGetSolicitudPago(id)` | Detalle |
| `onSolicitudesPagoPaginated(...)` | Lista paginada |
| `onNotaRecepcionDisponibleParaPagoPorNumero(...)` | **Busca una nota que todavía admita pago** |
| `onDatosInicialesSolicitudPagoPorRecepcion(...)` | Precarga el formulario desde una recepción |
| `onSaveSolicitudPago(input)` | Alta/edición |
| `onImprimirSolicitudPagoPDF(id)` | PDF en base64 |

> **Regla clave — la disponibilidad la decide el backend.** `onNotaRecepcionDisponibleParaPagoPorNumero` no devuelve cualquier nota: devuelve las que aún admiten pago (no canceladas, no totalmente pagadas). **No filtres del lado del cliente** — el cálculo de saldo pendiente vive en el backend.

`onDatosInicialesSolicitudPagoPorRecepcion` precarga proveedor, moneda y notas a partir de una recepción, para no rearmar todo a mano.

## Componentes

| Componente | Rol |
|---|---|
| `SolicitudPagoListComponent` | Lista paginada |
| `SolicitudPagoCreateComponent` | Alta |
| `SolicitudPagoPdfDialogComponent` | Muestra el PDF |

## GraphQL

`saveSolicitudPago`, `solicitudPago`, `solicitudesPagoPaginated`, `notaRecepcionDisponibleParaPagoPorNumero`, `datosInicialesSolicitudPagoPorRecepcion`, `formasPago`, `imprimirSolicitudPagoPDF`.

---

# pago

**Ubicación:** `src/app/pages/operaciones/pago/`
**Sin rutas propias** — es una capa de modelo y servicio que consumen otros módulos.

## Modelo

### `Pago`

| Campo | Nota |
|---|---|
| `solicitudPago` | La solicitud que lo origina |
| `usuario` | Quién lo registra |
| `autorizadoPor` | **Quién lo autoriza — usuario distinto** |
| `estado` | `PagoEstado` |
| `programado` | Si es un pago agendado |

> **Regla clave — `usuario` y `autorizadoPor` están separados a propósito.** Quien carga el pago no es necesariamente quien lo autoriza: es un control de doble intervención sobre la salida de dinero. No los colapses en un solo campo.

### `PagoEstado`

`ABIERTO` · `PENDIENTE` · `PARCIAL` · `CONCLUIDO` · `CANCELADO`

> ⚠️ **Gotcha — `PagoEstado` tiene `ABIERTO` y `SolicitudPagoEstado` no.** Son enums parecidos pero **no intercambiables**: cinco valores contra cuatro. No reutilices uno por el otro.

### `PagoDetalle`

Cada movimiento concreto de un pago (`pago-detalle/`). Un pago con estado `PARCIAL` tiene varios detalles.

## Servicios

`PagoService` (`pago`, `savePago`) y `PagoDetalleService` (`pagoDetalle`, `savePagoDetalle`).

---

# movimiento-stock

**Ubicación:** `src/app/pages/operaciones/movimiento-stock/`
**Sin rutas propias.** Aporta un servicio y un diálogo global.

## Qué resuelve

Registro de **todo movimiento de existencias** y consulta de stock por sucursal.

## `TipoMovimiento` — 9 valores

| Valor | Origen |
|---|---|
| `COMPRA` | Recepción de mercadería |
| `VENTA` | Venta |
| `DEVOLUCION` | Devolución |
| `DESCARTE` | Baja sin recupero |
| `AJUSTE` | Corrección manual de inventario |
| `TRANSFERENCIA` | Movimiento entre sucursales |
| `CALCULO` | Recálculo del sistema |
| `ENTRADA` / `SALIDA` | Genéricos |

> ⚠️ **Gotcha — `ENTRADA` y `SALIDA` se superponen con los tipos específicos.** Una compra es conceptualmente una entrada, pero tiene su propio tipo. Usá siempre el **tipo específico** cuando exista; `ENTRADA`/`SALIDA` son para movimientos que no encajan en ninguna categoría.

## `MovimientoStock`

| Campo | Nota |
|---|---|
| `producto`, `sucursal`, `sucursalId`, `cantidad` | |
| `tipoMovimiento` | `TipoMovimiento` |
| `referencia` | **Id del documento que originó el movimiento** |
| `estado` | `boolean` — activo/anulado |
| `data` | `any` — carga libre |

> ⚠️ **Gotcha — `referencia` es un id sin tipo.** Apunta al documento origen (una venta, una recepción, una transferencia), pero **qué entidad es depende de `tipoMovimiento`**. No hay foreign key tipada: para resolverla hay que mirar primero el tipo.

> ⚠️ **Gotcha — `estado` es booleano, no un enum.** `true` = vigente, `false` = anulado. Rompe la convención del resto del repo, donde los estados son enums string.

## `StockPorSucursalDialogComponent`

Muestra el stock de un producto en todas las sucursales.

> ⚠️ **Gotcha — está declarado en `AppModule`, no en un módulo de página** (`app.module.ts:109`). Vive en `pages/operaciones/movimiento-stock/` pero se necesita globalmente. Si movés el archivo, actualizá `AppModule`.

## GraphQL

`saveMovimientoStock`, `getStockPorProducto`.

---

# list-operaciones

`ListOperacionesComponent` es la pantalla de `/operaciones`. **38 líneas, sin lógica**: `ngOnInit` vacío y todo el contenido en el template. Es un menú estático de accesos al resto del módulo.

---

# Relación entre submódulos

```
pedidos ──> NotaRecepcion ──> solicitud-pago ──> pago ──> pago-detalle
   │                                │
   │                                └──> imprimirSolicitudPagoPDF
   └──> movimiento-stock (COMPRA)

devolucion ──> movimiento-stock (DEVOLUCION / DESCARTE)
transferencias ──> movimiento-stock (TRANSFERENCIA)
caja ──> venta-tarjeta (conciliación de totalTarjeta)
```

**`movimiento-stock` es el punto de convergencia**: casi todo submódulo que mueva mercadería termina generando un registro ahí.
