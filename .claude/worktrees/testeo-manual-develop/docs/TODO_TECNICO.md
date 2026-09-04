# TODO técnico — irregularidades detectadas

> ⚠️ **Este archivo cataloga los defectos de `frc-mobile`**, el repo anterior. Se conserva como memoria de qué NO repetir.
>
> **Ya resueltos en `frc-mobile-pwa`** (no hay que volver a hacerlos): **#1** fecha por defecto de `porFecha` · **#2** observables que no completaban ni propagaban errores · **#3** update forzado (desaparece con el service worker) · **#4** la cadena `"null"` en `localStorage` · **#7** módulos lazy y eager a la vez · **#9** roles con strings inline · **#11** `descodificarQr` sin validar · **#12** `comparatorLike` sin escapar el regex · **#16-19** código muerto y archivos `" copy"` (no se portaron) · **#24** `errorLink` vacío · **#26** `totalRs` sin tipo · **#34** typos `delele`/`toInpuList`/`ZonaesSearchGQL` · **#32** `SolicitudPago.pago` tipado `any` · **#38** `pais.model.ts` vacío · **#46** carpeta `venta/` vacía · **#48** `pages/financiero` y `pages/general` movidos a `domains/` · **#56** dos sets de íconos.
>
> **Siguen abiertos y aplican al repo nuevo:** **#5** `ProductoInput.tiempoGarantia` tipado `boolean` · **#6** `toInput()` que pierde campos · **#8** lectura de `Preferences` (ya no aplica: no hay Capacitor) · **#13** lint y tests (resuelto: vitest corre) · **#25** campos comentados en `Producto` · **#40** `RrhhMobileService` sin tipos · **#41** guard de aprobaciones RRHH · **#52** modelos faciales desde CDN · **#53** credenciales de terceros en el código.
>
> **Además**, la revisión con agentes del repo nuevo encontró 14 defectos propios, ya corregidos. Ver el commit `fix: corregir los 14 hallazgos de la revision con agentes`.

Hallazgos encontrados durante la documentación completa del repo (Olas 1-4). **Nada de esto está arreglado**: se documentó el comportamiento tal como es y se difirió la corrección para después de cerrar la documentación.

Cada ítem indica dónde está, qué pasa, por qué importa y el riesgo de tocarlo.

**Leyenda de severidad:**
- 🔴 **Alta** — puede causar pérdida de datos, error silencioso en producción o bloqueo de usuario
- 🟡 **Media** — bug real con impacto acotado, o deuda que causa errores recurrentes de desarrollo
- 🟢 **Baja** — limpieza, consistencia, código muerto

---

## 🔴 Alta

### 1. `onGetByFecha` calcula mal la fecha por defecto

**Dónde:** `src/app/generic/generic-crud.service.ts:401-402`

```ts
let hoy = new Date();
let ayer = new Date(hoy.getDay() - 1);   // getDay() = día de la SEMANA (0-6)
```

`getDay()` devuelve el día de la semana, no el del mes. `new Date(0..6)` produce una fecha de **1970**. Solo afecta al caso `inicio == null && fin == null`.

**Riesgo de tocarlo:** hay que revisar todos los llamadores. Si alguna pantalla depende hoy del rango degenerado (que en la práctica trae "todo el histórico"), corregirlo cambia lo que muestra. Auditar antes de arreglar.

**Fix propuesto:** `const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1); ayer.setHours(0,0,0,0);`

---

### 2. Los observables de `GenericCrudService` no completan ni propagan errores

**Dónde:** `src/app/generic/generic-crud.service.ts`, todos los métodos salvo `onCustomSave`

Ningún método llama `obs.complete()`. En caso de error, muestran el toast genérico "Ups!! Algo salió mal" y **no emiten nada** — ni `next` ni `error`.

**Consecuencias:**
- `.toPromise()`, `firstValueFrom()` o `await` sobre esas llamadas **quedan colgados para siempre** si el backend falla.
- Toda suscripción queda viva hasta que el componente se destruya; sin `untilDestroyed` hay fuga.
- El llamador no puede distinguir "sin resultados" de "falló".

**Riesgo de tocarlo:** alto por volumen. Agregar `complete()` es seguro; agregar `obs.error()` cambia el flujo de control de decenas de pantallas que hoy no tienen `error` handler y empezarían a romper con excepciones no capturadas.

**Fix propuesto:** por etapas. Primero `complete()` en todos. Después, migrar pantalla por pantalla a un método nuevo que sí propague error, sin tocar los existentes.

---

### 3. El update in-app es forzado y corre cada 50 segundos

**Dónde:** `src/app/app.component.ts:128-129,135-146`

```ts
this.searchUpdate();
this.intervalID = setInterval(this.searchUpdate, 50000); // comentario dice "5 seconds", real: 50s
```

Si Play Store reporta una versión nueva, dispara `performImmediateUpdate()` — el flujo **bloqueante** — sin preguntar. Puede interrumpir al usuario en medio de una venta, un conteo de inventario o un cierre de caja.

**Fix propuesto:** usar `startFlexibleUpdate()` (descarga en segundo plano) y ofrecer `completeFlexibleUpdate()` cuando el usuario esté en una pantalla segura. Alternativamente, mantener el inmediato pero suprimirlo mientras haya una operación abierta. Corregir además el comentario.

---

### 4. `logOut()` persiste el string `"null"` en vez de limpiar las claves

**Dónde:** `src/app/services/login.service.ts:240-241`

```ts
localStorage.setItem('token', null);      // guarda la cadena "null"
localStorage.setItem('usuarioId', null);
```

Todo lector debe comparar contra `null` **y** contra `'null'`. El mismo patrón obliga al triple chequeo de `app.module.ts:53-67` para `serverIp`. `ChangeServerIpDialogComponent` repite el error.

**Fix propuesto:** `localStorage.removeItem(...)` en ambos lugares, y simplificar los chequeos defensivos una vez que no queden escrituras de `"null"`.

---

## 🟡 Media

### 5. `ProductoInput.tiempoGarantia` tipado como `boolean`

**Dónde:** `src/app/domains/productos/producto.model.ts`

`Producto.tiempoGarantia` es `number` (días de garantía) pero `ProductoInput.tiempoGarantia` está declarado `boolean`. TypeScript no ayuda a detectar el error en el punto de uso.

**Fix propuesto:** cambiar a `number`. Verificar antes qué manda hoy el formulario de producto.

---

### 6. `toInput()` pierde campos silenciosamente

**Dónde:** patrón general en `src/app/domains/`, ejemplo claro en `personas/usuario.model.ts:15-23`

`Usuario.toInput()` no propaga `email`, `avatar`, `roles` ni `creadoEn`. Si el backend interpreta la ausencia como borrado, una edición parcial destruye datos.

**Fix propuesto:** auditar cada `toInput()` contra el input real que espera el backend. Documentar en cada modelo qué campos quedan fuera a propósito.

---

### 7. Cuatro módulos son lazy y eager al mismo tiempo

**Dónde:** `src/app/app.module.ts:120-125` vs `src/app/app-routing.module.ts`

`InventarioModule`, `TransferenciasModule`, `ProductoModule` y `FuncionarioModule` están declarados con `loadChildren` en el router **y** importados en `AppModule`. La importación eager gana: entran al bundle inicial y el lazy loading no aporta nada.

**Causa:** `AppModule` declara componentes que dependen de piezas de esos módulos (`StockPorSucursalDialogComponent`, `HomeComponent`).

**Fix propuesto:** extraer las dependencias compartidas a un módulo común y sacar los cuatro del `imports`. Medir el tamaño del bundle inicial antes y después.

---

### 8. `@capacitor/preferences` se escribe pero nunca se lee

**Dónde:** `src/app/components/change-server-ip-dialog/change-server-ip-dialog.component.ts`

El diálogo guarda `serverIp`/`serverPort` en `Preferences` (storage nativo) además de `localStorage`, pero **ningún código lee de `Preferences`**. La intención era sobrevivir a limpiezas del WebView que borran `localStorage`; el paso de lectura nunca se implementó.

**Efecto:** si el WebView limpia `localStorage`, la app vuelve al default de `conectionConfig.ts` en vez de recuperar la IP configurada.

**Fix propuesto:** implementar la lectura en el arranque, antes de que `app.module.ts` calcule las URIs. Requiere cuidado: hoy esas URIs se calculan en carga de módulo, que es síncrona, y `Preferences` es asíncrono.

---

### 9. Dos estilos de chequeo de rol conviviendo, con strings inconsistentes

**Dónde:** templates varios vs `src/app/domains/personas/roles/role.service.ts`

Algunos templates hacen `roles?.includes('VER INVENTARIO')` inline. Los strings usados hoy son `'NUEVO-PRODUCTO'`, `'VER INVENTARIO'` y `'VER TRANSFERENCIA'` — formatos inconsistentes entre sí (guion vs. espacio).

**Fix propuesto:** migrar todo a `RoleService` + enum `ROLES`. Normalizar los nombres exige coordinar con el backend, que es quien los emite.

---

### 10. `marcacionRoute` detecta admin por nickname literal

**Dónde:** `src/app/app.component.ts:399`

```ts
const isAdmin = this.mainService.usuarioActual?.nickname?.toUpperCase() === 'ADMIN';
```

Un usuario con rol de administrador pero otro nickname no obtiene la ruta de admin.

**Fix propuesto:** usar `roleService.tieneRol(roles, ROLES.ADMIN)`.

---

### 11. `descodificarQr` no valida nada

**Dónde:** `src/app/generic/utils/qrUtils.ts`

Hace `split('-')` y asigna posiciones fijas. No verifica el prefijo `frc`, no escapa guiones dentro de los campos (un `data` con guion desplaza todo lo siguiente) y no valida el `timestamp` — un QR viejo es válido para siempre.

**Fix propuesto:** validar prefijo, usar un separador que no aparezca en los datos (o codificar en base64/JSON) y decidir una política de expiración. Cambiar el formato rompe compatibilidad con QR ya impresos: necesita soportar ambos formatos durante una transición.

---

### 12. `comparatorLike` no escapa caracteres especiales

**Dónde:** `src/app/generic/utils/string-utils.ts`

Construye un `RegExp` con la entrada del usuario sin escapar. Un `(`, `[` o `*` puede lanzar excepción.

**Fix propuesto:** escapar la entrada antes de construir el regex.

---

### 13. `npm run lint` y `npm test` están rotos

**Dónde:** `package.json:15-16`

- `ng lint` → `@angular-eslint/builder:lint not found`
- `ng test` → TS2724 por import con typo en `edit-transferenci-producto.component.spec.ts`

**Efecto:** no hay linting ni tests unitarios corriendo en el repo. El único gate es `npm run build`.

**Fix propuesto:** PR dedicado. Instalar el builder de eslint y corregir el spec. Evaluar cuántos specs más fallan una vez que `ng test` arranque.

---

### 14. `ModalService` y `PopOverService` guardan una sola referencia

**Dónde:** `src/app/services/modal.service.ts`, `src/app/services/pop-over.service.ts`

Ambos guardan `currentModal` / `currentPopover` como valor único. Anidar dos modales hace que `closeModal()` cierre el equivocado.

**Fix propuesto:** usar una pila, o devolver siempre la referencia y que el llamador cierre la suya.

---

### 15. `CargandoService.close()` tiene un `setTimeout` de 500 ms

**Dónde:** `src/app/services/cargando.service.ts`

El loading no se cierra al instante. Abrir y cerrar dos loadings seguidos los pisa visualmente. Además `open()` no lleva registro: si se pierde la referencia, el loading queda colgado.

**Fix propuesto:** evaluar por qué está el delay (probablemente evita un parpadeo) y llevar registro de loadings activos para poder cerrarlos todos.

---

## 🟢 Baja

### 16. `src/app/app-update/` es código muerto

**Dónde:** `src/app/app-update/`

`app-update.component.ts:16` hace `throw new Error('Method not implemented.')` en `ngOnInit`. El componente no está declarado en ningún módulo — solo lo referencia su propio `.spec`. Es un resto de la integración con CapacitorUpdater.

**Fix propuesto:** borrar la carpeta completa (componente + spec).

---

### 17. Configuración muerta de `CapacitorUpdater` en `capacitor.config.ts`

**Dónde:** `capacitor.config.ts:12-14`

```ts
CapacitorUpdater: { autoUpdate: true }
```

El plugin `@capgo/capacitor-updater` no está instalado. La config no hace nada y confunde a quien lee el archivo — de hecho fue la causa de que la documentación afirmara durante meses que existía un canal OTA.

**Fix propuesto:** eliminar el bloque. Cambiar `capacitor.config.ts` requiere `cap sync` y release nativo, así que conviene agruparlo con otro cambio nativo.

---

### 18. Código de CapacitorUpdater comentado en `main.ts`

**Dónde:** `src/main.ts:4,9,52,61`

Bloques comentados de la integración OTA descartada.

**Fix propuesto:** borrar. El historial de git conserva la implementación si alguna vez se quiere volver.

---

### 19. Archivo duplicado con nombre de copia

**Dónde:** `src/app/graphql/financiero/venta-credito/count-by-cliente-id copy.ts`

Nombre con `" copy"` — resto de un duplicado accidental.

**Fix propuesto:** verificar si algo lo importa y borrarlo.

---

### 20. `solicitud-gastos` ruteado dos veces

**Dónde:** `src/app/app-routing.module.ts:12` y `src/app/pages/operaciones/operaciones-routing.module.ts`

El mismo módulo se carga desde `/solicitud-gastos` (raíz) y `/operaciones/solicitud-gastos`. El menú usa la ruta hija.

**Fix propuesto:** eliminar la ruta raíz y verificar que ningún deep link ni QR la use.

---

### 21. `MainService.load()` está vacío

**Dónde:** `src/app/services/main.service.ts:25-27`

Se invoca vía `APP_INITIALIZER` pero no hace nada.

**Fix propuesto:** dejarlo como punto de extensión documentado, o quitar el `APP_INITIALIZER` hasta que haga falta.

---

### 22. `MainService.authenticationSub` arranca en `null`

**Dónde:** `src/app/services/main.service.ts`

`BehaviorSubject<boolean>(null)` — el primer valor no es booleano. Los suscriptores que asumen booleano reciben `null`.

**Fix propuesto:** tipar como `BehaviorSubject<boolean | null>` para que TypeScript obligue a manejar el caso, o inicializar en `false` si nadie depende de distinguir "todavía no sé".

---

### 23. `extractCodigoBarra` marcada `@deprecated` pero aún en uso

**Dónde:** `src/app/generic/utils/barcodeUtils.ts:70-74`

**Fix propuesto:** migrar los llamadores a `codigosParaBuscar` y borrarla.

---

### 24. `errorLink` de Apollo es un no-op

**Dónde:** `src/app/app.module.ts:77`

```ts
const errorLink = onError(({ graphQLErrors, networkError }) => { });
```

Cuerpo vacío. No hay manejo global de errores de red ni GraphQL.

**Fix propuesto:** al menos loguear. Idealmente, detectar 401 para forzar re-login y errores de red para alimentar `ServerConnectionService`.

---

### 25. Campos comentados en `Producto` que el input sí acepta

**Dónde:** `src/app/domains/productos/producto.model.ts`

`subfamilia`, `sucursales`, `productoUltimasCompras` y `costo` están comentados en el modelo, pero `ProductoInput` declara `subfamiliaId`. Se puede enviar la subfamilia pero no leerla con tipo.

**Fix propuesto:** completar el modelo con los tipos reales o borrar los comentarios si esos campos ya no existen en el backend.

---

---

# Ola 2 — módulo `operaciones`

## 🔴 Alta

### 26. `Conteo` y `ConteoInput` declaran mal un campo de dinero

**Dónde:** `src/app/pages/operaciones/conteo/conteo.model.ts`

```ts
totalGs: number;
totalRs; number;    // ← punto y coma en vez de dos puntos
totalDs: number;
```

`totalRs` queda **sin tipo** (`any` implícito) y se crea una propiedad espuria llamada `number`. Está en **ambas clases**. No rompe en runtime, pero elimina el chequeo de tipos justo en el total de reales de un arqueo de caja — un valor con consecuencias laborales para el cajero.

**Fix propuesto:** `totalRs: number;` en las dos clases. Verificar que nada dependa de la propiedad `number` espuria.

---

### 27. N+1 de queries al buscar items por producto en una recepción

**Dónde:** `src/app/pages/operaciones/pedidos/recepcion-mercaderia/recepcion-mercaderia.service.ts:182-232`

`onBuscarNotaRecepcionItemsPorProductoYRecepcion` trae la recepción y después hace **una query por cada nota**, en serie dentro de un `for`. Una recepción con 15 notas dispara 16 requests secuenciales.

**Efecto:** verificación de productos lenta en recepciones grandes, justo el caso en que más se usa.

**Fix propuesto:** query de backend que traiga los items filtrados por producto y recepción en una sola llamada. Requiere método nuevo en el central con sufijo `Mobile`.

---

## 🟡 Media

### 28. `NotaRecepcionAgrupada` está deprecada pero sigue viva

**Dónde:** `src/app/pages/operaciones/pedidos/nota-recepcion/nota-recepcion-agrupada/` + 4 referencias externas

El backend la reemplazó por `RecepcionMercaderia`, pero la entidad conserva modelo, servicio y 11 archivos GraphQL. La siguen usando `nota-recepcion.model.ts`, `nota-recepcion.service.ts`, `graphql/notaRecepcionPorNotaRecepcionAgrupadaId.ts` y —lo más relevante— **`solicitar-pago-nota-recepcion.component.ts`**, que quedó sin migrar.

**Fix propuesto:** migrar la solicitud de pago a `RecepcionMercaderia` y después borrar la entidad. Coordinar con el backend: hay que confirmar que `solicitarPagoNotaRecepcionAgrupada` tiene equivalente.

> ✅ **Resuelto en la PWA, y el equivalente existe.** La solicitud de pago se
> abre desde una `RecepcionMercaderia` con
> `datosInicialesSolicitudPagoPorRecepcion(recepcionMercaderiaId)`. En la PWA
> no hay ni rastro de `NotaRecepcionAgrupada`: la capa portada usa
> `RecepcionMercaderia` en todo el circuito.
>
> Queda abierto **en `frc-mobile`**, que sigue en mantenimiento.

---

### 29. `Moneda.toInput()` descarta la cotización

**Dónde:** `src/app/pages/operaciones/moneda/moneda.model.ts`

El input lleva `denominacion`, `simbolo`, `paisId` y `usuarioId`, pero **no `cambio`**. Guardar una moneda editada no persiste el cambio de cotización.

**Fix propuesto:** confirmar si es deliberado (la cotización se actualiza por otra vía) y, si lo es, documentarlo en el modelo. Si no, agregar el campo.

---

### 30. `MovimientoStock.estado` es `boolean` en vez de enum

**Dónde:** `src/app/pages/operaciones/movimiento-stock/movimiento-stock.model.ts`

`true` = vigente, `false` = anulado. Rompe la convención del repo, donde los estados son enums string, y no deja lugar a estados intermedios.

**Fix propuesto:** requiere cambio de backend. Bajo salvo que se necesite un tercer estado.

---

### 31. `MovimientoStock.referencia` es un id sin tipo ni FK

**Dónde:** ídem

Apunta al documento origen, pero a qué entidad depende de `tipoMovimiento`. No hay forma tipada de resolverlo.

**Fix propuesto:** documentar el mapeo tipo→entidad (hecho en [`modulos/operaciones-pagos-y-varios.md`](modulos/operaciones-pagos-y-varios.md)) y evaluar un union type en el cliente.

---

### 32. `SolicitudPago.pago` tipado `any`

**Dónde:** `src/app/pages/operaciones/solicitud-pago/solicitud-pago.model.ts`

**Fix propuesto:** tipar como `Pago`. Cuidado con la referencia circular: `Pago` ya importa `SolicitudPago`.

> ✅ **Resuelto en la PWA.** `domains/pedidos/solicitud-pago.model.ts` lo tipa
> como `PagoResumen`: solo los campos que la app lee. La circularidad
> desaparece porque el resumen no vuelve a apuntar a la solicitud — y no hace
> falta, porque **el pago es de solo lectura acá**.
>
> Al tiparlo apareció que el modelo del repo anterior también estaba mal en la
> cardinalidad: `Pago` tiene `List<SolicitudPago>`, no una sola. Ver
> [`modulos/operaciones-pagos-y-varios.md`](modulos/operaciones-pagos-y-varios.md).

---

### 33. Archivos GraphQL duplicados

**Dónde:**
- `remitoRetiroProveedor.ts` existe en `devolucion/graphql/` **y** en `devolucion/retiro-proveedor/graphql/`
- `enteFinancialSummary.ts` y `getEnteFinancialSummary.ts` en `solicitud-gastos/graphql/` cubren el mismo concepto

**Fix propuesto:** verificar cuál usa el código, borrar el otro.

---

## 🟢 Baja

### 34. Typos en nombres de archivos, métodos y claves de enum

Ninguno rompe nada; todos dificultan buscar y autocompletar.

| Typo | Dónde | Correcto |
|---|---|---|
| `deleleCaja.ts` | `operaciones/caja/graphql/` | `deleteCaja` |
| `deleleConteo.ts` | `operaciones/conteo/graphql/` | `deleteConteo` |
| `deleleConteoMoneda.ts` | `operaciones/conteo/conteo-moneda/graphql/` | `deleteConteoMoneda` |
| `getNotaRecepcionPorOriveedorAndNumero.ts` | `pedidos/nota-recepcion/graphql/` | `PorProveedor` |
| `onSearchProveeodr()` | `recepcion-notas.component.ts` | `onSearchProveedor` |
| `toInpuList()` | `conteo.model.ts` | `toInputList` |
| `SIN_MODIFICACIONN` (clave) | `compra-enums.ts` | `SIN_MODIFICACION` — el **valor** ya es correcto |

> ⚠️ **Antes de renombrar los archivos `delele*`: verificar si el nombre de la operación GraphQL en el backend también está mal escrito.** Si el central expone `deleleCaja`, corregir el cliente rompe la llamada. El renombre seguro es solo del archivo y la clase, dejando el `gql` intacto.

---

### 35. `PedidoEstado.VERFICADO_*` mal escrito — **NO corregir del lado del cliente**

**Dónde:** `src/app/pages/operaciones/pedidos/pedido-item/pedido-enums.ts`

`VERFICADO_SIN_MODIFICACION` y `VERFICADO_CON_MODIFICACION` (falta la `I`). **El valor viaja así al backend**, así que el string tiene que coincidir exactamente.

**Fix propuesto:** solo se puede corregir coordinando backend + desktop + mobile en el mismo release. No vale la pena por sí solo; aprovechar si alguna vez se toca ese enum por otro motivo.

---

### 36. `PdvCajaEstado` usa claves con espacios

**Dónde:** `src/app/pages/operaciones/caja/caja.model.ts`

```ts
'En proceso' = 'EN_PROCESO',
```

Se indexa `PdvCajaEstado['En proceso']`. Es deliberado (la clave es la etiqueta de UI) pero rompe la convención del repo y no autocompleta.

**Fix propuesto:** separar en enum de constantes + mapa de etiquetas. Toca todos los consumidores; hacerlo solo si se refactoriza el módulo.

---

### 37. `VentaTarjeta` usa `interface` sin `toInput()`

**Dónde:** `src/app/pages/operaciones/venta-tarjeta/venta-tarjeta.model.ts`

Rompe el patrón modelo/input/`toInput()` del resto del repo: el input se arma a mano.

**Fix propuesto:** decidir cuál es el estándar. El enfoque de `venta-tarjeta` es más simple y evita el problema de hidratación de instancias (ítem 6); podría ser el patrón a adoptar en vez de la excepción a corregir.

---

---

# Ola 3 — resto de `pages`

## 🟡 Media

### 38. `domains/general/pais.model.ts` está vacío (0 bytes)

**Dónde:** `src/app/domains/general/pais.model.ts`

El archivo existe pero no tiene contenido. El `Pais` real vive en `src/app/pages/general/pais/pais.model.ts` (164 bytes) y es el que importa `moneda.model.ts`.

**Efecto:** un `import { Pais } from 'src/app/domains/general/pais.model'` falla sin razón aparente. Contrasta con `domains/general/ciudad.model.ts`, que sí tiene contenido — o sea, `Ciudad` está en `domains/` y `Pais` en `pages/`, sin criterio.

**Fix propuesto:** mover el contenido a `domains/general/pais.model.ts`, actualizar el import de `moneda.model.ts` y borrar `pages/general/`.

---

### 39. Aprobación de vales no implementada en mobile

**Dónde:** `src/app/graphql/rrhh/rrhh-mobile.service.ts`

`AprobacionesRrhhComponent` tiene un segmento de vales que lista pendientes (`onGetValesPendientes`), pero **no existe `onAprobarVale`** ni la mutation correspondiente. Solo vacaciones se puede aprobar.

**Fix propuesto:** agregar `AprobarValeMobile` en el central (con sufijo `Mobile`) y el método en el servicio. Confirmar antes con RRHH si la aprobación de vales debe ser posible desde mobile.

---

### 40. `RrhhMobileService` devuelve `any` en todos sus métodos

**Dónde:** `src/app/graphql/rrhh/rrhh-mobile.service.ts` y `pages/mis-rrhh/`

No hay modelos tipados para recibos, vales, vacaciones ni marcaciones: los componentes usan `any[]`. Es el módulo con menos tipado del repo, y toca datos de liquidación.

**Fix propuesto:** crear los modelos en `domains/rrhh/` a partir del schema del central.

---

### 41. `/mis-rrhh/aprobaciones` sin guard

**Dónde:** `src/app/pages/mis-rrhh/mis-rrhh-routing.module.ts`

La bandeja de aprobaciones del directivo no declara `canActivate`. Cualquier usuario puede navegar a la URL. El home sí filtra el acceso por rol (`DIRECTIVO`, `ADMIN`), pero eso es solo ocultar el botón.

**Fix propuesto:** guard de rol análogo a `VentaTarjetaHabilitadaGuard`. **La protección real depende del backend** — ver el issue de roles en GraphQL del central.

---

### 42. `NotificacionPushService` usa `onCustomGet` para una mutation

**Dónde:** `src/app/pages/configuracion/notificacion-push/notificacion-push.service.ts`

`sendNotificacionPush` llama `genericCrudService.onCustomGet(...)`, el método de **lectura**, para lo que parece una mutation.

**Fix propuesto:** verificar en el schema del central si `requestPushNotification` es query o mutation, y usar `onCustomSave` si corresponde.

---

### 43. Modelos `Usuario` y `Persona` duplicados en notificaciones

**Dónde:** `src/app/pages/notificaciones/models/usuario.model.ts` y `persona.model.ts`

Versiones locales, distintas de las de `domains/personas/`. No son asignables entre sí.

**Fix propuesto:** unificar contra `domains/`, o documentar por qué el módulo necesita una vista reducida.

---

### 44. IP del servidor hardcodeada en dos lugares

**Dónde:** `src/app/components/change-server-ip-dialog/change-server-ip-dialog.component.ts` y `src/app/pages/producto/precio-config/precio-config.component.ts:35-36`

`159.203.86.103` con puertos `8081`/`8082` aparece en ambos. Un cambio de infraestructura obliga a tocar los dos.

**Fix propuesto:** constante compartida en `environments/conectionConfig.ts`, donde ya vive el default.

---

## 🟢 Baja

### 45. `home` hace poll con `setInterval` en vez de suscribirse

**Dónde:** `src/app/pages/home/home/home.component.ts:121-128`

Poll cada segundo esperando que aparezca `mainService.usuarioActual`, **pese a que el mismo componente ya se suscribe a `authenticationSub` unas líneas arriba**. Se limpia correctamente, así que no fuga, pero si el login nunca ocurre queda latiendo.

**Fix propuesto:** reemplazar por la suscripción existente.

---

### 46. `src/app/pages/venta/` es una carpeta vacía

**Dónde:** `src/app/pages/venta/`

Sin archivos desde mayo 2025. Las operaciones de venta viven en `src/app/graphql/operaciones/venta/`.

**Fix propuesto:** borrar.

---

### 47. Archivos con `" copy"` en el nombre — uno está EN USO

**Dónde:**
- `src/app/pages/inventario/graphql/reabrir-inventario copy.ts` — **lo importa `inventario.service.ts`**: no es un duplicado muerto, es el archivo real con nombre de copia
- `src/app/pages/inventario/graphql/getInventarioProductoItemPorInventarioProducto copy.ts` — verificar
- `src/app/graphql/financiero/venta-credito/count-by-cliente-id copy.ts` — verificar (ítem 19)

**Fix propuesto:** renombrar el que está en uso y actualizar el import; borrar los otros dos si nadie los referencia. Los espacios en nombres de archivo complican scripts y tooling.

---

### 48. `pages/financiero/` y `pages/general/` no son módulos de páginas

**Dónde:** ambas carpetas

Contienen un único modelo cada una, sin rutas, módulo ni servicio. Están bajo `pages/` por razones históricas.

**Fix propuesto:** mover a `domains/` junto con el ítem 38.

---

### 49. `PreRegistroFuncionario.registroConducir` tipado `Boolean`

**Dónde:** `src/app/pages/funcionario/funcionario.model.ts`

Usa el objeto wrapper `Boolean` en vez del primitivo `boolean`.

**Fix propuesto:** cambiar a `boolean`.

---

### 50. `Vendedor` tiene modelo pero ningún uso

**Dónde:** `src/app/pages/personas/vendedor/vendedor.model.ts`

Sin servicio ni queries. Entidad preparada y nunca terminada.

**Fix propuesto:** borrar si no está en el roadmap.

---

### 51. Comentario de desarrollo commiteado en el routing

**Dónde:** `src/app/pages/transferencias/transferencias-routing.module.ts`

```ts
path: 'gestion-productos', // ← AGREGAR ESTA RUTA
```

**Fix propuesto:** borrar el comentario.

---

---

# Ola 4 — auditoría transversal

## 🔴 Alta

### 52. El reconocimiento facial descarga los modelos desde un CDN de internet

**Dónde:** `src/app/services/face-recognition.service.ts:39`

```ts
modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/',
```

**El motor facial no funciona sin internet.** La app está diseñada para hablar con un servidor **en LAN** (`androidScheme: 'http'`, IPs locales); una sucursal con la red interna operativa pero sin salida a internet —o con jsDelivr bloqueado o caído— **no puede marcar asistencia por rostro**.

Además implica que cada dispositivo descarga los modelos de un tercero en cada arranque frío, con el costo de datos y latencia asociados.

**Fix propuesto:** empaquetar los modelos en `assets/` y apuntar `modelBasePath` ahí. Aumenta el tamaño del APK pero elimina la dependencia externa. Verificar la licencia de los modelos antes de redistribuirlos.

---

### 53. Credenciales de terceros en el código fuente

**Dónde:**
- `src/app/services/face-ai.service.ts:8` — `apiKey = '21a3bffecdcd4ae091b63bbf8c1270d8'` (Azure Cognitive Face)
- `android/app/src/main/AndroidManifest.xml:47` — `com.google.android.geo.API_KEY` (Google Maps)

Ambas viajan dentro del APK y son extraíbles con herramientas estándar. La de Azure ya figura en [`REPORTE_VULNERABILIDADES.md`](../../../REPORTE_VULNERABILIDADES.md).

**Fix propuesto:** rotar ambas claves (están comprometidas desde que se publicó el APK), moverlas a configuración del backend y proxyar las llamadas a Azure por el central. La de Maps se puede restringir por `appId` + huella de firma en Google Cloud Console, que es la mitigación estándar cuando la clave tiene que estar en el cliente.

---

## 🟡 Media

### 54. Colores de Material hardcodeados en los `.scss`

**Dónde:** `src/app/**/*.scss`

`#f44336` aparece **50 veces**, `#43a047` 14 y `#4caf50` 7 — la paleta de Material Design escrita a mano, no las variables de Ionic. Cambiar el tema no las afecta.

**Fix propuesto:** reemplazar por `var(--ion-color-danger)` / `var(--ion-color-success)`. Mecánico pero extenso; hacerlo módulo por módulo.

---

### 55. Dos sistemas de color de botón conviviendo

**Dónde:** templates

`color="success"` (atributo de Ionic) y `class="btn-success"` (clase propia, **98 usos**).

**Fix propuesto:** elegir uno. Las clases propias permiten estilos que el atributo no, así que probablemente convenga conservarlas y documentar cuándo usar cada una.

---

### 56. Dos sets de iconos

**Dónde:** templates y `home.component.ts`

Ionicons (`<ion-icon name="...">`) y Material Symbols (`icon: 'barcode_scanner'` en las quick actions).

**Fix propuesto:** unificar, o documentar que las quick actions usan Material a propósito.

---

## 🟢 Baja

### 57. 84 `console.log` en el código de producción

**Dónde:** `src/app/**/*.ts`

Incluye volcados de respuestas completas del backend (`GenericCrudService` loguea `res` y `res.errors` en varios métodos), visibles en el log del dispositivo.

**Fix propuesto:** reemplazar por un servicio de logging que se silencie según `isDevMode()`. Revisar primero cuáles vuelcan datos sensibles.

---

### 58. 11 `TODO` / `FIXME` sin seguimiento

**Dónde:** `src/app/**/*.ts`

**Fix propuesto:** revisarlos, convertir en issues los que sigan vigentes y borrar los obsoletos.

---

### 59. Documentación del workspace menciona un `postinstall` que ya no existe

**Dónde:** `frc-sistemas-informaticos/CLAUDE.md` (raíz del workspace)

Afirma que el `postinstall` de mobile parchea el Gradle de `phonegap-plugin-barcodescanner` (`compile(` → `implementation(`). **`package.json` no tiene script `postinstall`** y el escaneo migró a `@capacitor-mlkit/barcode-scanning`.

**Fix propuesto:** corregir el CLAUDE.md raíz. Queda fuera de este repo — es un cambio en `frc-sistemas-informaticos/`.

---

### 60. 🔴 La documentación del inventario tenía `cantidad` y `cantidadFisica` al revés

**Dónde:** este mismo repo — `docs/modulos/inventario.md`, `domains/inventario/inventario.model.ts`, `pages/inventario/inventario-conteo.ts`, `inventario-carga.page.ts`.

Lo contado va en **`cantidad`** y el stock del sistema en **`cantidadFisica`**, al revés de lo que sugieren los nombres y de lo que este repo documentaba. Lo fija el central: `InventarioGraphQL.finalizarInventarioEnSucursal()` suma `ipi.getCantidad() * ipi.getPresentacion().getCantidad()` y le resta el saldo de `movimiento_stock`.

**Por qué no se veía:** la PWA escribía el conteo en `cantidadFisica` y devolvía `cantidad` intacta, así que finalizar ajustaba el stock contra un número que nadie había contado. Hasta que la PWA no pudo **abrir** una toma, el circuito no se cerraba dentro de la app y ninguna prueba manual podía llegar al síntoma.

**Estado:** corregido, con `inventario-conteo.spec.ts` citando el cálculo del central. Queda como recordatorio de que **un documento portado puede estar equivocado sobre el sistema que describe**: la regla se verificó contra el java del central y contra el diálogo de conteo de `frc-mobile`, no contra el nombre del campo.

---

### 61. 🟡 `frc-mobile` muta el array del servicio al filtrar zonas

**Dónde:** `frc-mobile` — `edit-inventario.component.ts`, `onAddZona()`.

Descuenta las zonas ya usadas con `s.zonaList = s.zonaList.filter(...)` sobre los sectores que devolvió el servicio, así que el segundo intento en la misma pantalla arranca con la lista ya recortada.

**Estado:** no se porta. `zonasDisponibles()` devuelve una lista nueva y no toca la entrada.

---

### 62. 🟢 Quedan cuatro `<input type="date">` sin migrar a `<frc-campo-fecha>`

**Dónde:** este mismo repo — `mi-trabajo/solicitud-dialog.component.ts` (dos), `operaciones/solicitud-pago/solicitud-pago-nueva.page.ts`, `operaciones/devolucion/devolucion-item-dialog.component.ts`.

El campo de fecha del sistema de diseño se creó al rediseñar la carga del conteo, y ahí es el único lugar donde se usa. Los otros cuatro siguen con el input nativo: en Chrome de escritorio muestran un `dd/mm/aaaa` gris que se lee como un campo roto, en Android abren el diálogo del sistema y en Safari de iOS una ruedita — tres controles distintos para el mismo campo.

**Por qué no se hizo de una:** migrarlos estaba fuera de lo pedido, y dos de ellos —`desde`/`hasta` de una solicitud— tienen validación cruzada de rango que hay que probar aparte, no arrastrar en un cambio de otra pantalla.

**Estado:** pendiente. `<frc-campo-fecha>` ya acepta `[minimo]` y `[maximo]` en el mismo `yyyy-MM-dd` que el valor, que es lo que ese par necesita.

---

### 63. ✅ El central rechazaba dos ítems del mismo producto sin vencimiento

**Dónde:** `central` — `InventarioProductoItemService.save()`.

La unicidad era `(inventario, producto, vencimiento)` con `Objects.equals`, así que dos vencimientos nulos contaban como iguales. Rechazaba tres cosas legítimas: el mismo producto contado en dos zonas —el caso normal de un inventario por zona—, «unidad» y «caja x12» del mismo producto, y cualquier segundo renglón sin fecha. Y no solo al agregar: el chequeo corre en cada `save`, así que también hacía fallar **Guardar conteo** en cuanto el vencimiento sugerido ponía la misma fecha en dos zonas.

**Estado:** corregido en el central. La clave pasó a `(inventario_producto, presentacion, vencimiento)` —la zona, no el inventario— con siete tests en `InventarioProductoItemServiceDuplicadoTest`.

**Se tocó el método único, no un `saveMobile()` paralelo, y es una decisión.** El escritorio usa el mismo camino y estaba **igual de roto**: su vencimiento también es opcional (`add-producto-dialog.component.ts:47`), así que hoy tampoco podía agregar dos productos sin fecha a una toma. Además el cambio es una **relajación demostrable**: todo lo que la clave nueva rechaza ya lo rechazaba la anterior —una zona está dentro de su inventario, una presentación pertenece a su producto—, así que ningún flujo que funcionaba dejó de funcionar. Un método paralelo habría dejado al escritorio con el bug para siempre y dos caminos de guardado para desincronizar.

**Lo que se sacó del cliente:** `presentacionYaEnLaZona()` y `rechazoAlAgregar()`. La regla vive en un solo lado.

---

### 64. ✅ El reporte de vencidos se anclaba a una toma abierta, y por eso no sugería nada al contar

**Dónde:** `central` — `ProductosVencidosService.construirSqlBase()`.

El CTE `ultimo_inv` usaba `MAX(inv.id)` **sin mirar el estado**, así que una toma `ABIERTO` o `CANCELADO` se tomaba como si fuera un inventario hecho. Como las cinco fuentes se anclan ahí, abrir una toma dejaba el reporte de esa sucursal en blanco. En `bodega3` pasaba en **5 de 26 sucursales** (3 abiertas, 2 canceladas).

Sobre eso, la carga del conteo usaba ese mismo reporte para proponer el vencimiento — y ahí el ancla es fatal por diseño, porque **la toma que se está contando es el último inventario**. COCA COLA 500ML tiene 81 vencimientos conocidos de su caja x 6 y devolvía cero.

**Estado:** corregido. `ultimo_inv` solo cuenta inventarios `CONCLUIDO`, con `COALESCE` a 1900 para que ninguna sucursal desaparezca del reporte por no tener ninguno. Y se agregó `vencimientosConocidos`, una consulta **sin ancla** para la carga del conteo, con su recorte por presentación. `productosVencidos` conserva su ancla: sigue siendo «qué entró desde el último inventario», que es lo que ese reporte tiene que responder.

**Compatibilidad:** el reporte del escritorio recibe **más** filas que antes, nunca menos.

### 65. ✅ Ninguna toma con un ítem sin contar se podía finalizar

**Dónde:** `central` — `InventarioGraphQL.finalizarInventarioEnSucursal()`, línea 220.

`cantidad` —lo contado— es nullable, y un ítem que se sumó a la toma y que nadie fue a contar la tiene en `null`. Al finalizar se hacía `ipi.getCantidad() * ipi.getPresentacion().getCantidad()` sin mirar, así que reventaba con un `NullPointerException` al desempaquetar el `Double`.

**Estado:** corregido. Los ítems sin contar se **saltean**, no se toman como cero: si se tomaran como cero y un producto tuviera todos sus ítems sin contar, el ajuste le llevaría el stock **a cero** sin que nadie hubiera contado nada. Es la misma distinción que ya hacía `fueContadoEnEstaToma()` en el cliente —cero cuenta, `null` no—.

De paso, un inventario inexistente tiraba otro `NullPointerException` en la línea siguiente; ahora dice cuál es el id que no encontró.

⚠️ **`PLAN_TESTEO_MANUAL.md` decía lo contrario** en el caso 41.4: «al finalizar sí entra como diferencia contra el stock, eso es intencional y es lo que hace el central». Nunca fue cierto — el central reventaba. Corregido.

Del lado del cliente, la confirmación de *Finalizar* ahora dice cuántos ítems quedan sin contar y que a esos no se les toca el stock. Es la última oportunidad de volver a contarlos.

---

## Cómo usar este archivo

Al arrancar la fase de corrección: convertir cada ítem en un issue, empezando por los 🔴. Los ítems 16-19, 46-48 y 50-51 son borrado o movimiento puro y pueden agruparse en un solo PR de limpieza — pero el 17 toca `capacitor.config.ts` y por lo tanto exige release nativo, y el 47 requiere actualizar un import.

Los ítems 34-36 son cosméticos **con riesgo de contrato**: antes de renombrar cualquier cosa que viaje al backend, verificá el schema del central.

**Resumen:** 65 hallazgos — 6 🔴, 27 🟡, 28 🟢, 3 ✅. El #60 y el #62 son deuda **de este repo**; el #63 era del **central** y ya está corregido allá.
