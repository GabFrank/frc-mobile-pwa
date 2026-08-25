# mis-rrhh, mis-finanzas y financiero

Módulos de **autoservicio del funcionario**: consultar lo suyo y hacer solicitudes sin pasar por administración.

> **Estado en `frc-mobile-pwa`:** `mis-rrhh` implementado como **«Mi trabajo»** (`/mi-trabajo`) y `mis-finanzas` implementado (`/mis-finanzas`). Los dos con paginación en el servidor. Ver [«Qué cambió en la PWA»](#qué-cambió-en-la-pwa) al final.

---

# mis-rrhh

**Ubicación:** `src/app/pages/mis-rrhh/` + `src/app/graphql/rrhh/`
**Tamaño:** 4 archivos TS (~236 LOC) + 13 en `graphql/rrhh/`
**Ruta base:** `/mis-rrhh`

## Qué resuelve

Portal de **autoservicio de Recursos Humanos**: el funcionario ve sus recibos, vales, vacaciones y marcaciones, y solicita vales y vacaciones desde el celular. Los directivos aprueban desde la bandeja.

Es la contraparte mobile del módulo RRHH del backend `central` (ver la skill `rrhh-expert` para las reglas completas de liquidación).

## Rutas

| Ruta | Componente |
|---|---|
| `''` | `MisRrhhDashboardComponent` |
| `aprobaciones` | `AprobacionesRrhhComponent` |

## Dashboard — cuatro segmentos

`MisRrhhDashboardComponent` usa un `ion-segment` con carga perezosa: **solo consulta el segmento activo**.

| Segmento | Carga | Acción |
|---|---|---|
| `recibos` | `onGetRecibos(usuarioId)` | Ver recibo en PDF |
| `vales` | `onGetVales(usuarioId)` | Solicitar vale |
| `vacaciones` | `onGetVacaciones(usuarioId)` | Solicitar vacaciones |
| `marcaciones` | `onGetMarcaciones(usuarioId)` | Solo consulta |

> **Patrón útil — carga por segmento, no todo junto.** `cargarSegmento()` despacha según `this.segmento`. Evita cuatro queries al abrir la pantalla. Copialo en dashboards con pestañas.

### Recibos en PDF

`verRecibo(recibo)` → `onImprimirRecibo(id)` devuelve base64, se limpia el prefijo y se abre con `PdfViewerService` como `recibo-{periodo}.pdf`.

> ⚠️ **Gotcha — hay que limpiar el prefijo del base64.** El componente hace `limpio` antes de pasar el string a `openPdfFromBase64`, que espera el contenido **sin** `data:application/pdf;base64,`. Ver [`../infraestructura/services.md`](../infraestructura/services.md).

## Solicitudes

| Método | Parámetros |
|---|---|
| `onSolicitarVale(usuarioId, monto, esAdelanto, motivoId?)` | |
| `onSolicitarVacacion(usuarioId, desde, hasta)` | |

> **Regla clave — `esAdelanto` distingue dos cosas distintas.** Un **adelanto** es dinero del sueldo del mes en curso; un **vale** común es un préstamo que se descuenta en cuotas. El tratamiento en la liquidación es diferente. El flag es obligatorio, no un detalle de UI.

## Bandeja de aprobaciones

`AprobacionesRrhhComponent`, dos segmentos: `vacaciones` y `vales`.

| Método | Qué hace |
|---|---|
| `onGetVacacionesPendientes()` | Pendientes de aprobación |
| `onGetValesPendientes()` | Ídem |
| `onAprobarVacacion(periodoId, aprobadorUsuarioId)` | Aprueba |

> ⚠️ **Gotcha — se aprueba por `periodoId`, no por id de solicitud.** Las vacaciones se aprueban a nivel del **período vacacional**, no de la solicitud individual.

> ⚠️ **Gotcha — hay `onAprobarVacacion` pero no `onAprobarVale`.** El segmento de vales lista pendientes pero **no tiene mutation de aprobación** en el servicio. La aprobación de vales no está implementada en mobile. Anotado en [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

> ⚠️ **Seguridad — no hay guard en la bandeja de aprobaciones.** La ruta `/mis-rrhh/aprobaciones` no declara `canActivate`. El control real depende del backend. Ver el issue de roles en GraphQL del proyecto (`RrhhSecurityService` en el central).

## Operaciones GraphQL

Todas en `src/app/graphql/rrhh/`, **con sufijo `Mobile`** — la regla del proyecto para no tocar métodos que usa el desktop (ver [`../REGLAS_DESARROLLO.md`](../REGLAS_DESARROLLO.md)):

`MiResumenRrhhMobile` · `MisRecibosMobile` · `MisValesMobile` · `MisVacacionesMobile` · `MisMarcacionesMobile` · `SolicitarValeMobile` · `SolicitarVacacionMobile` · `ValesPendientesAprobacionMobile` · `VacacionesPendientesAprobacionMobile` · `AprobarVacacionMobile` · `ImprimirReciboLiquidacion`

> ⚠️ **Gotcha — `RrhhMobileService` devuelve `any` en todos sus métodos.** No hay modelos tipados para recibos, vales ni vacaciones: los componentes usan `any[]`. Es el módulo con menos tipado del repo. Anotado en el TODO.

## Estado

Desarrollado el **2026-07-08**, integrado vía PR #89. Testing manual pendiente.

---

# mis-finanzas

**Ubicación:** `src/app/pages/mis-finanzas/`
**Tamaño:** 6 archivos TS, ~310 LOC
**Ruta base:** `/mis-finanzas`

| Ruta | Componente |
|---|---|
| `''` | `MisFinanzasDashboardComponent` |
| `list-convenio` | `ListConvenioComponent` |
| `list-convenio/:id/:sucId` | `ListConvenioComponent` |

## Qué resuelve

**Compras a crédito del funcionario por convenio**: el empleado compra en la empresa y se le descuenta de la liquidación mensual.

`ListConvenioComponent` está registrado con y sin parámetros: sirve como lista general y como detalle de un convenio en una sucursal.

> **Conexión con RRHH — el crédito por convenio se cobra en la liquidación.** Lo que se ve acá termina descontado del sueldo mensual o del finiquito. La lógica de cobro vive en el backend `central` (módulo RRHH).

> ⚠️ **Gotcha — `list-convenio` necesita `sucId` además de `id`.** El convenio se resuelve por convenio **y** sucursal, igual que `PreGasto` en [solicitud de gastos](operaciones-solicitud-gastos.md).

Se accede desde "Mi cuenta → Mis finanzas" en el menú lateral.

---

# financiero

**Ubicación:** `src/app/pages/financiero/`
**Tamaño:** 1 archivo, 27 LOC. **Sin rutas, sin módulo, sin servicio.**

Contiene solo `documento/documento.model.ts`, el modelo `Documento` que consume [`operaciones/pedidos`](operaciones-pedidos.md) (`NotaRecepcion.documento`).

> ⚠️ **Gotcha — `pages/financiero/` no es un módulo de páginas.** Es una carpeta con un solo modelo, ubicada bajo `pages/` por razones históricas. No busques pantallas ahí. Su lugar natural sería `domains/`. Anotado en el TODO.

---

# Qué cambió en la PWA

## Pantallas

| Ruta | Componente | Estado |
|---|---|---|
| `/mi-trabajo` | `MiTrabajoPage` | ✅ |
| `/mi-trabajo/aprobaciones` | `AprobacionesPage` | ⚠️ el backend no dice de quién es la solicitud |
| `/mis-finanzas` | `MisFinanzasPage` | ✅ |

**«Mis RRHH» pasó a llamarse «Mi trabajo».** El nombre viejo era la sigla del
módulo del backend, no algo que el empleado reconozca como suyo.

**El dashboard de dos tarjetas de `mis-finanzas` desapareció.** Una de las dos
llevaba a la lista de convenios y la otra abría el escáner; con el escáner
todavía sin portar, quedaba una pantalla intermedia con un solo destino. La
lista **es** la pantalla.

## La pestaña de Marcación **es** el historial

Es donde el funcionario ve a qué hora fichó, y el botón **Historial** de
`/marcacion` lleva ahí con `?tab=marcaciones`. No hay una segunda lista en el
módulo de marcación, y es una decisión: sería la misma consulta mostrando lo
mismo. Ver [`marcacion.md`](marcacion.md).

Hasta acá la pestaña mostraba **solo los minutos trabajados** del día. Ahora
la consulta trae también los cuatro fichajes de la jornada y cada día muestra
sus horas.

⚠️ **La hora sale de la marcación, no de la jornada.** `jornada.fecha` es el
día; el momento de cada fichaje vive en la marcación, en `fechaEntrada` **o**
en `fechaSalida` según el tipo. La regla está en
`domains/marcacion/jornada.util.ts`, con su spec, y no se reescribe por
pantalla.

⚠️ **La página siguiente tiene que pedir los mismos campos.** Es el caso que
rompería sin avisar: filas nuevas sin horarios abajo de filas que sí los
tienen. Acá no pasa porque «Cargar más» reusa la misma operación.

## Todo lo que crece se pagina en el servidor

Las cuatro listas del repo anterior traían la tabla entera. La de marcaciones
crece una fila por día trabajado para siempre: abrir la pestaña costaba más
cuanta más antigüedad tuviera el empleado.

| Lista | Página | Por qué ese tamaño |
|---|---|---|
| Marcación | 30 | Un mes son ~22 jornadas |
| Recibos | 12 | Un año son 12 sueldos |
| Vales | 10 | |
| Convenios | 10 | |

El tamaño se elige para que **el caso habitual entre en la primera página** y
nadie tenga que pedir más.

Las tres listas de RRHH usan un botón **«Cargar más»** y los convenios,
**páginas numeradas**. No es inconsistencia: `ventaCreditoPorClientePage`
devuelve una `Page` de Spring con el total de elementos, y las operaciones
`*Mobile` de RRHH devuelven una lista pelada. Sin total no se puede dibujar
«3 / 12», así que se muestra lo único que se sabe: si vino una página
completa, puede haber más.

> ⚠️ **Filtrar después de paginar es un bug silencioso.** `misRecibos` traía
> todas las liquidaciones y filtraba las `PAGADA` en Java. Paginar así
> devuelve páginas de menos de `size` filas —o vacías— sin que el cliente
> pueda distinguirlo del fin de la lista. El filtro se movió **a la
> consulta**.

## Operaciones nuevas en el central

Todas con parámetros **opcionales**: sin `page`/`size` se comportan como
antes, así que el desktop y cualquier cliente viejo siguen andando.

`misRecibosMobile(page, size)` · `misValesMobile(page, size)` · `misMarcacionesMobile(page, size)`

## Bugs corregidos al portar

| Qué | Consecuencia |
|---|---|
| `ventaCreditoPorClientePage` se tipaba `VentaCredito[]` | Devuelve una `Page`. El tipo decía array donde llega un objeto: cualquier `.map()` reventaba en runtime sin que el compilador avisara |
| `ventaCreditoPorClientePage` con `estado` nulo devolvía cero filas | La consulta derivada `…AndEstado…` traduce el nulo a `estado IS NULL`. El schema declara el argumento opcional, pero esa opcionalidad no existía. Se agregó la variante sin estado en el repositorio |
| `vacacionesPendientesAprobacionMobile` pedía el campo `vacacion` | `VacacionPeriodo` no lo expone: la query entera fallaba y la bandeja de aprobaciones **nunca pudo haber funcionado** |
| `fechaLegible` exigía hora | Las fechas sin hora —vales, jornadas— mostraban «Sin fecha» |
| `countByClienteIdAndEstado` no existe en el schema del central | El `CountVentaCreditoByClienteAndEstadoGQL` del repo anterior no podía resolver. No se portó |

## Confirmar la compra por QR

El botón de acción de `/mis-finanzas` abre el
[escáner](../arquitectura/escaner.md), lee el QR que muestra la caja y llama a
`ventaCreditoQrAuth`. El central publica la autorización por suscripción y el
desktop, que está esperando, cierra la venta.

El QR lo genera el desktop al armar el convenio
(`add-venta-credito-dialog.component.ts`) y lleva la persona del cliente, la
sucursal, una clave de un solo uso y el momento en que se creó.

> ⚠️ **En `frc-mobile` el resultado terminaba en un `console.log`.** El
> empleado escaneaba y la pantalla no decía nada, ni al salir bien ni al salir
> mal. Tampoco se validaba el contenido: escanear el QR de otra persona —o el
> código de barras de un producto— disparaba igual una llamada al servidor que
> no podía prosperar.

Ahora se valida antes de llamar: que sea un QR de esta app, que su
`tipoEntidad` sea `VENTA_CREDITO`, que el `idOrigen` sea la persona en sesión
y que traiga sucursal. Cada rechazo dice cuál falló. Un `false` del central
—QR vencido o ya usado— también se avisa.

## Lo que falta

- **La bandeja de aprobaciones no puede decir de quién es la solicitud.**
  `rrhh.vacacion_periodo.vacacion_id` existe en la base; falta exponerlo en
  el tipo `VacacionPeriodo`. Es un campo de schema.
