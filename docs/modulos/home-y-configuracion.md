# home, configuracion, salir, general y venta

Módulos pequeños: **`home`** (251 LOC), **`configuracion`** (68), **`salir`** (38), **`general`** (8) y **`venta`** (vacío).

---

# home

**Ubicación:** `src/app/pages/home/home/`
**Ruta:** `''` — **componente eager**, declarado directamente en `AppModule`.

## Qué resuelve

Pantalla inicial: **accesos rápidos filtrados por rol** y el estado del crédito por convenio del funcionario.

## Quick actions

`allQuickActions` define 7 accesos, cada uno con etiqueta, ruta, ícono, tono de color y —opcionalmente— roles requeridos:

| Acceso | Ruta | Roles |
|---|---|---|
| Ver Producto | `/producto/buscar/true` | — |
| Consultar Precio | `/producto/consultar-precio` | — |
| Control Inventario | `/inventario/control-inventario` | `VER_INVENTARIO` |
| Productos Vencidos | `/producto/productos-vencidos` | — |
| Mis RRHH | `/mis-rrhh` | — |
| Aprobaciones RRHH | `/mis-rrhh/aprobaciones` | `DIRECTIVO`, `ADMIN` |
| Devoluciones | `/operaciones/devolucion` | — |

El filtro es: sin `roles` → visible para todos; con `roles` → visible si el usuario tiene **alguno** (`RoleService.tieneAlgunRol`).

> **Nota de calidad — el home usa el enum `ROLES`, no strings inline.** `ROLES.VER_INVENTARIO`, `ROLES.DIRECTIVO`, `ROLES.ADMIN`. **Es el patrón correcto**, a diferencia de los templates que hacen `roles?.includes('VER INVENTARIO')`. Ver ítem 9 del [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

`quickActionsOddCount` ajusta el layout cuando la cantidad visible es impar, para que la grilla no quede con un hueco.

## Crédito por convenio

Muestra `totalAbiertos`, `creditoDisponible` y `porcentajeGastado` del funcionario, con barra de progreso.

**`mostrarCredito` permite ocultar los valores** (`iconoVisibilidadCredito`, `etiquetaVisibilidadCredito`): son datos sensibles y la pantalla se ve en el salón. La preferencia persiste.

Ver [`mis-rrhh-y-finanzas.md`](mis-rrhh-y-finanzas.md) para el circuito completo del convenio.

## ⚠️ El `setInterval` de arranque

```ts
this.intervalId = setInterval(() => {
  if (this.mainService.usuarioActual) {
    clearInterval(this.intervalId!);
    this.intervalId = null;
    this.cargarDatosConvenio();
  }
}, 1000);
```

**Poll cada segundo esperando que aparezca el usuario en `MainService`.** El home es eager y se monta antes de que termine la autenticación, así que espera activamente en vez de suscribirse.

> ⚠️ **Gotcha — es un patrón frágil.** `MainService.authenticationSub` ya es un `BehaviorSubject` al que el componente **también** se suscribe, unas líneas arriba. El intervalo es redundante y podría reemplazarse por la suscripción. Se limpia en cuanto encuentra usuario y en `ngOnDestroy`, así que no fuga, pero si el login nunca ocurre queda latiendo. Anotado en el TODO.

`ionViewWillEnter` recarga los datos al volver a la pantalla, con guarda para no duplicar si el intervalo sigue vivo.

## FAB

El FAB flotante lo maneja `AppComponent`, no el home: incluye "Escanear venta" (condicional a [venta-tarjeta](operaciones-venta-tarjeta.md) habilitada) y "Solicitud" (→ [solicitud de gastos](operaciones-solicitud-gastos.md)). Ver [`../arquitectura/routing-navegacion.md`](../arquitectura/routing-navegacion.md).

---

# configuracion

**Ubicación:** `src/app/pages/configuracion/`
**Sin rutas propias.**

Contiene únicamente `notificacion-push/`: modelo, servicio y la mutation `requestPushNotification`.

`NotificacionPushService.sendNotificacionPush(input)` dispara una push desde la app.

> ⚠️ **Gotcha — el nombre del módulo engaña.** La configuración que ve el usuario ("Configuración del servidor", "Canal de actualizaciones") **no está acá**: son acciones del menú lateral resueltas por `AppComponent` (`onIpChange()`, `openChannelSelector()`). Este módulo es solo el envío de push.

> ⚠️ **Gotcha — usa `onCustomGet` para una mutation.** `sendNotificacionPush` llama `genericCrudService.onCustomGet(...)`, que es el método de **lectura**. Funciona porque `onCustomGet` solo hace `fetch` sobre lo que reciba, pero si `requestPushNotification` es una mutation en el schema, debería ir por `onCustomSave`. Verificar contra el backend.

---

# salir

`SalirComponent`, 38 líneas, ruta `/salir`, **eager en `AppModule`**. Sin lógica: `ngOnInit` vacío, todo en el template.

> El logout real lo ejecuta `AppComponent.onSalir()` desde el menú lateral, que llama `LoginService.logOut()`. Esta ruta es una pantalla de confirmación/despedida.

---

# general

`pais/pais.model.ts` — el modelo `Pais`, importado por `Moneda` (ver [`operaciones-caja.md`](operaciones-caja.md)).

> ⚠️ **Igual que `pages/financiero/`, no es un módulo de páginas**: es un modelo suelto bajo `pages/`.

> 🐛 **`src/app/domains/general/pais.model.ts` existe y está VACÍO (0 bytes).** El `Pais` real es el de `pages/general/pais/pais.model.ts` (164 bytes), que es el que importa `moneda.model.ts`. El archivo vacío en `domains/` es una trampa: quien lo abra buscando el modelo va a creer que está sin implementar, y un `import { Pais } from 'domains/general/pais.model'` falla sin razón aparente.
>
> Contrastá con `domains/general/ciudad.model.ts`, que **sí** tiene contenido y es el que usan `Persona`, `Sucursal` y `PreRegistroFuncionario`. O sea: `Ciudad` vive en `domains/` y `Pais` en `pages/`, sin razón. Anotado en el TODO.

---

# venta

**Carpeta vacía.** `src/app/pages/venta/` no tiene archivos (fecha de creación: mayo 2025).

Las operaciones de venta viven en `src/app/graphql/operaciones/venta/`, no acá.

> **Fix:** borrar la carpeta. Anotado en el TODO.


---

# Qué cambió en la PWA

## Inicio

Los accesos rápidos se filtran por rol igual que antes, con el enum `ROLES`.
Se sumaron **Productos vencidos** y **Consultar precio** (el kiosco), y el
acceso a Notificaciones lleva **badge de no leídas**.

> ⚠️ **El conteo se pide al entrar al área con sesión**, desde el shell, no
> desde la bandeja. Pedirlo solo en la pantalla de notificaciones —como
> estaba— significa que el badge marca cero hasta que alguien va a mirar, que
> es justo lo contrario de para qué existe un badge.

El **crédito por convenio** volvió, con el mismo comportamiento que en
`frc-mobile`: arranca tapado y la preferencia persiste, porque la pantalla se
abre en el salón. Lo que cambió es que **el `setInterval` que esperaba al
usuario no se portó**: era un poll cada segundo, redundante con la señal de
sesión a la que el componente ya reacciona.

## Configuración

El módulo `configuracion` de `frc-mobile` engañaba: la configuración que veía
el usuario no estaba ahí, sino repartida en acciones del menú lateral. Acá
está toda en **Mi cuenta**:

| Qué | Nota |
|---|---|
| Cambiar de servidor | **Antes solo se alcanzaba desde el login.** Con la sesión abierta no había forma de llegar, y quien no lo sabía creía que la app estaba clavada en un servidor. Avisa que va a cerrar la sesión, porque la cierra |
| Tema | Los **tres** estados de `TemaService`: sistema, claro y oscuro. La UI ofrecía dos, y «del sistema» solo se alcanzaba no habiendo tocado nunca el toggle |
| Preferencias de notificación | Acceso a la pantalla que ya existía |
| Datos de la persona | **De solo lectura.** `frc-mobile` mostraba campos editables cuyo botón «Actualizar» solo cambiaba la foto de perfil |
| Versión y actualización | Ver [`../arquitectura/actualizaciones-app.md`](../arquitectura/actualizaciones-app.md) |

> ⚠️ **El canal de actualizaciones no aplica.** Era una elección entre canales
> de Play Store; una PWA se actualiza por su service worker.
