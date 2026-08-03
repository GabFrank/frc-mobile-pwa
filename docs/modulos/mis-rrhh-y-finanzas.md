# mis-rrhh, mis-finanzas y financiero

Módulos de **autoservicio del funcionario**: consultar lo suyo y hacer solicitudes sin pasar por administración.

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
