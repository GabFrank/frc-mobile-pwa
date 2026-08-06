# operaciones / solicitud-pago, pago, movimiento-stock y varios

Agrupa los submódulos restantes de `operaciones`: **`solicitud-pago`** (934 LOC), **`pago`** (330), **`movimiento-stock`** (250) y **`list-operaciones`** (38).

> ## Qué se portó a la PWA
>
> **`solicitud-pago`: sí.** Lista, alta y constancia en PDF, más un detalle que
> el repo anterior no tenía. Vive en `src/app/pages/operaciones/solicitud-pago/`.
>
> **`pago`: no, y es una decisión, no un pendiente.** Es tesorería de
> escritorio: alta de pagos, cuotas, cajas con clave compuesta y autorización
> por un segundo usuario. En `frc-mobile` su `PagoService` estaba declarado y
> **ningún componente lo inyectaba** — código muerto portado del desktop por
> completitud. De la relación solo se **lee** `solicitudPago.pago` para poder
> decir si ya se pagó y quién lo autorizó. Ver la sección `pago` más abajo,
> corregida contra el código actual del central.
>
> **`movimiento-stock` y `list-operaciones`: no.** El primero es una capa que
> alimentan otros módulos; el segundo es el menú, que en la PWA es
> `operaciones.page.ts`.

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
| `pago` | El pago asociado (tipado `any` en `frc-mobile`; en la PWA se tipa `PagoResumen`) |
| `montoPagado` | Cuánto se pagó ya. **Existe en el esquema y `frc-mobile` no lo pedía** |

### `SolicitudPagoNotaRecepcion` — la tabla puente

Liga una solicitud con una nota **y guarda `montoIncluido`**.

> **Regla clave — se puede incluir un monto parcial de una nota.** `montoIncluido` no tiene por qué ser el total de la nota: una factura grande puede pagarse en varias solicitudes. Por eso existe el estado `PARCIAL`. No asumas que la suma de las notas es el total de la nota.

### `SolicitudPagoEstado`

> ⚠️ **Cambió en el central y cambia el significado de `PENDIENTE`.** La
> migración `V194.5` sumó **`SOLICITADO`**:
>
> ```
> PENDIENTE ──solicitar──> SOLICITADO ──pago parcial──> PARCIAL ──> CONCLUIDO
>      ^                        │
>      └───────reabrir──────────┘         (cualquiera puede ir a CANCELADO)
> ```
>
> - **`PENDIENTE` es un borrador y NO es pagable.** Se puede editar.
> - **`SOLICITADO` es lo que antes significaba `PENDIENTE`** para quien mira la
>   lista: validada y esperando cobro.
>
> Lo decisivo está en `PagoProveedorService.listarPendientes`, que es lo que
> alimenta el diálogo con el que tesorería paga:
>
> ```java
> .findByEstadoIn(List.of(SolicitudPagoEstado.SOLICITADO, SolicitudPagoEstado.PARCIAL));
> ```
>
> **Una solicitud que se queda en `PENDIENTE` no la ve nadie del otro lado.**
> Y `crearSolicitudPago` crea siempre en `PENDIENTE`, así que el alta sin un
> segundo paso deja un documento fantasma. Ver «Qué cambió en la PWA».

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

### Precisiones verificadas contra el central

Cuatro cosas que el código del central deja claras y no estaban acá:

- **Elegible es solo `RECEPCION_COMPLETA`.** `SolicitudPagoService.ESTADOS_ELEGIBLES_PAGO` tiene un único valor, y su comentario avisa que `CONCILIADA` **no** alcanza: significa ítems verificados, no mercadería recibida. Además la nota no puede estar marcada como pagada ni pertenecer ya a otra solicitud (`isNotaIncludedInSolicitud`).
- **El backend devuelve `null` para cuatro causas distintas** —no existe, no está completa, ya está pagada, ya está en otra solicitud— y no dice cuál. Cualquier aviso al operador tiene que nombrarlas a todas.
- **Qué precarga exactamente `datosIniciales…`:** notas elegibles de esa recepción, moneda —si las notas difieren, **guaraníes**—, forma de pago —si difieren, **efectivo**— y fecha propuesta —hoy más el **plazo de crédito más largo** entre los pedidos—.
- **Lo que genera el backend al guardar:** `numeroSolicitud` con formato `SP-000001`, `fechaSolicitud`, `creadoEn` y `estado = PENDIENTE`. Mandarlos desde el cliente no sirve de nada.

> ### ⚠️ Regla clave — el `montoTotal` que manda el cliente se descarta
>
> El esquema lo exige (`montoTotal: Float!`) pero `crearSolicitudPago` **lo recalcula**:
>
> ```java
> Double montoTotal = notas.stream()
>     .mapToDouble(n -> calcularMontoNotaEnMoneda(n, moneda))
>     .sum();
> ```
>
> Y `calcularMontoNota` usa `valorTotalConRechazos`: **descuenta lo rechazado en la recepción**. Encima convierte cada nota a la moneda de la cabecera con su propia cotización.
>
> Consecuencia práctica: la suma de los `valorTotal` que se ven en pantalla **no es** el monto de la solicitud en cuanto haya un rechazo o una nota en otra moneda. `frc-mobile` mostraba esa suma cruda como si fuera el total. La PWA la rotula **«Total estimado»** y avisa que el definitivo lo calcula el servidor. Es la regla 6 del repo.
>
> El `montoTotal` enviado solo se usa como valor del detalle de pago cuando no se mandan `detalles` — algo que esta app no hace.

> **Validación que corta el guardado:** todas las notas tienen que ser del mismo proveedor. El central tira `"Todas las notas deben pertenecer al mismo proveedor"`. Por eso cambiar de proveedor en el formulario vacía la lista de notas.

> ### ⚠️ Gotcha del entorno — la secuencia de `id` se desfasa y el alta revienta
>
> Al probar el alta contra el central real apareció esto:
>
> ```
> ConstraintViolationException: llave duplicada viola restricción "solicitud_pago_pk"
>   Detail: Ya existe la llave (id)=(10).
> ```
>
> **No es del cliente.** `AssignedIdentityGenerator` respeta el id cuando la
> entidad ya lo trae:
>
> ```java
> Serializable id = identifiable.getId();
> if (id != null) return id;      // no pasa por la secuencia
> return super.generate(s, obj);  // sí pasa
> ```
>
> Todo lo que entra con id explícito —replicación desde filial, cargas
> masivas— deja la secuencia atrás. Cuando después algo inserta **sin** id,
> Postgres entrega un número ya usado y el insert falla. Le pasa igual al
> desktop: la mutation es la misma.
>
> Diagnóstico y arreglo, por tabla:
>
> ```sql
> -- ¿está atrasada?
> SELECT last_value FROM operaciones.solicitud_pago_id_seq;
> SELECT MAX(id) FROM operaciones.solicitud_pago;
>
> -- destrabar
> SELECT setval('operaciones.solicitud_pago_id_seq',
>               (SELECT MAX(id) FROM operaciones.solicitud_pago));
> ```
>
> En la base de prueba había **siete** tablas así, entre ellas
> `financiero.factura_legal` con la secuencia en 107 contra un máximo de
> 332.331. **Si un alta falla con violación de clave primaria, mirá la
> secuencia antes de buscar el bug en la pantalla.**

## Componentes

| `frc-mobile` | PWA | Nota |
|---|---|---|
| `SolicitudPagoListComponent` | `solicitudes-pago-lista.page.ts` | Con filtro por estado |
| `SolicitudPagoCreateComponent` | `solicitud-pago-nueva.page.ts` | Dos entradas: menú y recepción |
| `SolicitudPagoPdfDialogComponent` | `PdfService` | Sin diálogo propio: el visor de PDF ya es genérico y tiene camino en iOS |
| — | `solicitud-pago-detalle.page.ts` | **Nuevo.** Notas con su `montoIncluido` y el estado del pago |

> El diálogo de PDF del repo anterior escribía el archivo con `@capacitor/filesystem` en `Directory.Documents`. En la PWA eso no existe ni hace falta: `PdfService.abrirBase64` arma un `Blob` y elige el camino según la plataforma —en iOS instalada, navegación en la misma vista para que el visor quede **dentro** de la app—.

## GraphQL

`saveSolicitudPago`, `solicitudPago`, `solicitudesPagoPaginated`, `notaRecepcionDisponibleParaPagoPorNumero`, `datosInicialesSolicitudPagoPorRecepcion`, `formasPago`, `imprimirSolicitudPagoPDF`.

En la PWA viven en `src/app/graphql/operaciones/solicitud-pago/`. Se sumó `proveedor(id)` en `graphql/personas/proveedor/`, para nombrar al proveedor que llega como id en la URL.

**No se portan:** `actualizarSolicitudPago`, `deleteSolicitudPago`, `actualizarEstadoSolicitudPago`, `agregarNotaASolicitudPago`, `removerNotaDeSolicitudPago` ni las de `SolicitudPagoDetalle`. Editar solo vale en estado `PENDIENTE` y es trabajo de escritorio.

---

# pago

**Ubicación en `frc-mobile`:** `src/app/pages/operaciones/pago/`
**Sin rutas propias.**

> ## ⚠️ En `frc-mobile` esto es código muerto
>
> `PagoService` está declarado y **ningún componente lo inyecta**. `PagoEstado`
> no se usa fuera de su propio archivo. No hay pantalla, ni diálogo, ni ruta.
> Se portó del desktop por completitud y nunca se conectó a nada.
>
> **El pago de verdad vive en el desktop:** `modules/operaciones/pago/` —
> `list-pago`, `edit-pago` + `pago-detalle-dialog`, `pago-general`,
> `pago-general-list`, `pago-detalle`, `pago-detalle-cuota` +
> `modificar-sucursal-pago-detalle`. Del lado de la solicitud está
> `gestion-pago-dialog`, que hoy solo cambia el estado y lleva un TODO propio:
> «registro de pago, adjuntar comprobante» sin implementar.
>
> **En la PWA se lee, no se escribe.** Solo `solicitudPago.pago` en el detalle,
> tipado como `PagoResumen`.

## Modelo, corregido contra el central

### `Pago` (`operaciones.pago`)

| Campo | Nota |
|---|---|
| `solicitudesPago` | **`List<SolicitudPago>`, no una sola.** Ver abajo |
| `usuario` | Quién lo registra |
| `autorizadoPor` | **Quién lo autoriza — usuario distinto** |
| `estado` | `PagoEstado`. Lo fija el central en `ABIERTO` al crear |
| `programado` | Si es un pago agendado |
| `creadoEn` | Lo pone el central |

> ### ⚠️ Corrección — un pago cubre *varias* solicitudes
>
> Este documento decía `solicitudPago` en singular, copiado del modelo de
> `frc-mobile`. El central tiene:
>
> ```java
> @OneToMany(mappedBy = "pago", fetch = FetchType.LAZY)
> private List<SolicitudPago> solicitudesPago;
> ```
>
> Y `PagoService.java` conserva el rastro del cambio:
> `"This method is removed because we now use many-to-many relationship"`.
> El modelo de `frc-mobile` quedó viejo respecto del backend: portarlo verbatim
> era portar el error. Desde la solicitud se ve **un** pago porque ella es el
> lado dueño (`solicitud_pago.pago_id`).

> **Regla clave — `usuario` y `autorizadoPor` están separados a propósito.** Quien carga el pago no es necesariamente quien lo autoriza: es un control de doble intervención sobre la salida de dinero. No los colapses en un solo campo.

### `PagoEstado`

`ABIERTO` · `PENDIENTE` · `PARCIAL` · `CONCLUIDO` · `CANCELADO`

> ⚠️ **Gotcha — `PagoEstado` tiene `ABIERTO` y `SolicitudPagoEstado` no.** Son enums parecidos pero **no intercambiables**: cinco valores contra cuatro. No reutilices uno por el otro. En la PWA están registrados por separado en `estado-registry.ts` y hay un test que lo fija.

### `PagoDetalle` (`operaciones.pago_detalle`)

Cada movimiento concreto de un pago. Un pago `PARCIAL` tiene varios.

| Campo | Nota |
|---|---|
| `moneda`, `formaPago`, `total` | |
| `caja` | `PdvCaja` con **clave compuesta** (`caja_id` + `sucursal_id`), no un id simple |
| `fechaProgramado` | |
| `plazo`, `cuotas` | **No están en el modelo de `frc-mobile`** |
| `estado` | `PagoDetalleEstado`, por defecto `ABIERTO`. **Tampoco está en `frc-mobile`** |
| `activo` | |

### `PagoDetalleCuota` (`operaciones.pago_detalle_cuota`)

**No figura en `frc-mobile` ni figuraba en este documento.** Si el detalle es a plazo (`plazo = true`, `cuotas = N`), cada cuota lleva `numeroCuota`, `fechaVencimiento`, `totalPagado`, `totalFinal` y su propio `estado`.

Es una de las razones por las que el pago no es una pantalla de teléfono.

## Servicios

`PagoService` (`pago`, `savePago`) y `PagoDetalleService` (`pagoDetalle`, `savePagoDetalle`). **Ninguno se porta.**

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

---

# Qué cambió en la PWA

> **Estado:** portado **`solicitud-pago`** —lista, alta, detalle y constancia—.
> **`pago`, `movimiento-stock` y `list-operaciones` no**, y en el caso de
> `pago` es una decisión, no un pendiente: ver el bloque del principio.

| Ruta | Componente |
|---|---|
| `/operaciones/solicitud-pago` | `SolicitudesPagoListaPage` |
| `/operaciones/solicitud-pago/nueva` | `SolicitudPagoNuevaPage` |
| `/operaciones/solicitud-pago/:id` | `SolicitudPagoDetallePage` |

`nueva` va **antes** que `:id` en `solicitud-pago.routes.ts`. Con el orden
invertido el router resolvería «nueva» como identificador.

## El detalle es nuevo

`frc-mobile` tenía lista y alta, y el PDF en un diálogo. No tenía dónde ver
**qué notas** entraron ni **por cuánto** entró cada una. Esa pantalla es la
única que muestra `montoIncluido`, que es donde se ve el efecto de los
rechazos, y es donde se lee el pago asociado.

## El total del alta es una estimación, y lo dice

La pantalla de alta rotula la suma como **«Total estimado»** y aclara que el
definitivo lo calcula el servidor. Es la corrección del comportamiento
anterior, que mostraba la suma cruda de `valorTotal` como si fuera el monto de
la solicitud. Ver la regla clave más arriba.

Las reglas puras viven en `solicitud-pago-reglas.ts`, con tests:

- **`totalEstimado`** — suma tolerante a notas sin valor.
- **`faltaParaGuardar`** — reclama el proveedor **antes** que las notas: las
  notas se buscan por proveedor, pedirlas primero sería pedir algo que
  todavía no se puede hacer.
- **`yaEstaEnLaLista`** — compara ids como texto, porque GraphQL los manda
  número o string según la operación.
- **`hayMonedasMezcladas`** — las notas sin moneda no cuentan como una moneda
  más; si no, cualquiera dispararía el aviso de conversión.
- **`esEditable`** — solo `PENDIENTE`, que es lo único que acepta el central.
- **`fechaParaBackend`** — siempre en la forma de 16 caracteres.

## Crear no alcanza: hay que solicitar

El central crea siempre en `PENDIENTE`, que es un **borrador que tesorería no
ve**. Si el alta terminara ahí, el operador tocaría «Solicitar pago», recibiría
su número, y del otro lado no aparecería nadie a cobrar.

Por eso el alta encadena dos mutations: `saveSolicitudPago` y después
`actualizarEstadoSolicitudPago(id, SOLICITADO)` —la misma que usa el botón
«Solicitar» del desktop—. No hay una sola operación que haga las dos cosas:
`saveSolicitudPago` ignora el estado que se le mande.

⚠️ **Si la segunda falla, la solicitud existe igual, como borrador.** No se
puede deshacer la primera —el central no expone un borrado desde acá— así que
la pantalla lo dice con todas las letras y lleva al detalle, donde el botón
**Solicitar** permite reintentar. Ese botón además cubre los borradores que
hayan quedado de antes o de otro camino.

El detalle de un borrador lo avisa en un bloque propio y aclara que **no puede
haber pago** mientras lo sea.

## Dos entradas, un solo formulario

Desde el menú se elige proveedor y se cargan notas por número. Desde una
recepción **finalizada**, el botón *Solicitar pago* abre el mismo formulario
con `?recepcionId=&proveedorId=` y el backend precarga todo.

El botón vive en un bloque propio dentro del detalle de recepción y no en la
barra de acciones: serían tres botones en una fila y en un teléfono la
etiqueta no entra.

> `frc-mobile` preguntaba «¿Realmente desea solicitar el pago?» **antes de
> navegar**. Confirmaba algo que no estaba por ocurrir: lo que se abre es un
> formulario que el operador todavía puede abandonar. Acá se pregunta al
> crear, que es cuando algo pasa de verdad.

## El PDF no necesita diálogo propio

`SolicitudPagoPdfDialogComponent` escribía el archivo con
`@capacitor/filesystem` en `Directory.Documents`. Acá se usa `PdfService`, que
arma un `Blob` y elige el camino según la plataforma — en iOS instalada,
navegación en la misma vista para que el visor quede **dentro** de la app.
