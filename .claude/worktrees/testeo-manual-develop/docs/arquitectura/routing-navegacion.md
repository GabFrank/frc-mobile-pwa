# Ruteo y navegación

> ⚠️ **Documento histórico.** Describe `frc-mobile` (Ionic + Capacitor), no este repo. Se conserva porque explica reglas de negocio y decisiones que se heredaron. Para la implementación actual, ver [`../design-system.md`](../design-system.md) y [`capa-de-datos.md`](capa-de-datos.md).

## Modelo de navegación

**No hay tabs.** La app navega por **menú lateral** (`ion-menu` en `app.component.html`) + Angular Router con lazy loading por módulo.

Estrategias configuradas:
- `RouteReuseStrategy` → `IonicRouteStrategy` (`app.module.ts:138`), para que Ionic maneje el stack de vistas y las animaciones.
- `preloadingStrategy: PreloadAllModules` (`app-routing.module.ts:66`): los módulos son lazy pero se **precargan todos** apenas termina el arranque. El lazy loading acá reduce el tiempo hasta la primera pantalla, no el peso total descargado.

## Rutas raíz

`src/app/app-routing.module.ts`:

| Ruta | Destino | Carga |
|---|---|---|
| `''` | `HomeComponent` | eager |
| `salir` | `SalirComponent` | eager |
| `solicitud-gastos` | `SolicitudGastosModule` | lazy |
| `inventario` | `InventarioModule` | lazy |
| `producto` | `ProductoModule` | lazy |
| `pre-registro` | `FuncionarioModule` | lazy |
| `notificacion` | `NotificacionModule` | lazy |
| `comentarios` | `NotificacionModule` | lazy |
| `marcacion` | `MarcacionModule` | lazy |
| `transferencias` | `TransferenciasModule` | lazy |
| `splash` | `SplashPageModule` | lazy |
| `operaciones` | `OperacionesModule` | lazy |
| `informaciones-personales` | `InformacionesPersonalesModule` | lazy |
| `mis-finanzas` | `MisFinanzasModule` | lazy |

> ⚠️ **Gotcha — `solicitud-gastos` está ruteado dos veces.** Existe como ruta raíz `/solicitud-gastos` (`app-routing.module.ts:12`) **y** como hija `/operaciones/solicitud-gastos`. Ambas cargan el mismo `SolicitudGastosModule`. El menú lateral usa la ruta hija. Al agregar navegación hacia ese módulo, usá `/operaciones/solicitud-gastos` para ser consistente.

> ⚠️ **Gotcha — `comentarios` y `notificacion` son la misma cosa.** Ambas rutas cargan `NotificacionModule`. No es un módulo separado.

> ⚠️ **Gotcha — no hay guard de autenticación a nivel de ruta.** Ninguna ruta raíz declara `canActivate`. El control de acceso lo hace `AppComponent` mostrando u ocultando el menú y redirigiendo. Navegar por URL directa a una ruta protegida no está bloqueado por el router: la pantalla carga y falla al pedir datos sin token.

## Rutas de `operaciones`

`src/app/pages/operaciones/operaciones-routing.module.ts`:

| Ruta | Destino |
|---|---|
| `''` | `ListOperacionesComponent` |
| `caja` | `CajaComponent` |
| `caja/info` | `CajaInfoComponent` |
| `pedidos` | `PedidosModule` (lazy) |
| `solicitud-pago` | `SolicitudPagoModule` (lazy) |
| `solicitud-gastos` | `SolicitudGastosModule` (lazy) |
| `venta-tarjeta` | `VentaTarjetaModule` (lazy) |

> ⚠️ **Gotcha — "Pedidos" en la UI significa "Recepción de Mercaderías".** La ruta y el módulo se llaman `pedidos`, pero la etiqueta del menú es *Recepción de Mercaderías* (`app.component.html:81`). No los confundas al buscar código por el texto que ve el usuario.

## Módulos importados eager en `AppModule`

`app.module.ts:120-125` importa cuatro módulos de páginas directamente:

```
InventarioModule, TransferenciasModule, ProductoModule, FuncionarioModule
```

> ⚠️ **Gotcha — esos cuatro módulos son lazy y eager a la vez.** Están declarados como `loadChildren` en el router **y** importados en `AppModule`. La importación eager gana: su código entra en el bundle inicial. El `loadChildren` no aporta nada para ellos.
>
> El motivo es que `AppModule` declara componentes que dependen de piezas de esos módulos (`StockPorSucursalDialogComponent`, `HomeComponent`). **No los saques del `imports` sin verificar qué se rompe**, y no asumas que agregar `loadChildren` a un módulo alcanza para hacerlo lazy.

## Menú lateral

Estructura en `app.component.html`, con tres acordeones y varios ítems sueltos:

```
[avatar del usuario]              → onAvatarClick()
▸ Mi cuenta
    Informaciones personales      → /informaciones-personales
    Mis finanzas                  → /mis-finanzas
    Configurar huella             → /informaciones-personales/huella-digital
  Producto                        → /producto
  Inventario                      → /inventario          [rol VER INVENTARIO]
  Transferencia                   → /transferencias      [rol VER TRANSFERENCIA]
▸ Operaciones
    Caja                          → /operaciones/caja    [puedeAccederCaja]
    Recepción de Mercaderías      → /operaciones/pedidos
    Solicitud de Gastos           → /operaciones/solicitud-gastos
▸ Configuración
    Configuración del servidor    → onIpChange()
    Canal de actualizaciones      → openChannelSelector()
  Marcar horario                  → marcacionRoute (dinámico)
  Notificaciones                  → /notificacion
  Salir                           → onSalir()
```

### Rutas dinámicas y condicionales

**`marcacionRoute`** (`app.component.ts:398-401`) cambia según el usuario:

```ts
const isAdmin = this.mainService.usuarioActual?.nickname?.toUpperCase() === 'ADMIN';
this.marcacionRoute = isAdmin ? ['/marcacion/ingreso-persona'] : ['/marcacion'];
```

> ⚠️ **Gotcha — "admin" se detecta por el nickname literal, no por rol.** La comparación es contra la cadena `'ADMIN'` en mayúsculas. Un usuario con rol de administrador pero otro nickname va a la ruta común. Es una excepción al modelo de roles, no el patrón a seguir.

**`puedeAccederCaja`** (`app.component.ts:403-407`) sí usa el modelo de roles, vía `RoleService`.

## Permisos de UI

`src/app/domains/personas/roles/role.service.ts`:

| Método | Uso |
|---|---|
| `puedeAccederCaja(roles)` | `true` si el usuario tiene `ADMIN` o `VENTA_TOUCH` |
| `tieneAlgunRol(roles, requeridos)` | `true` si hay intersección |
| `tieneRol(roles, rol)` | chequeo puntual |

Los roles llegan como `string[]` en `usuarioActual.roles`. El catálogo está en `domains/personas/roles/roles.enum.ts`.

> ⚠️ **Gotcha — hay dos estilos de chequeo de rol conviviendo.** Algunos templates hacen el chequeo inline con string mágico:
> ```html
> *ngIf="loginService.usuarioActual?.roles?.includes('VER INVENTARIO')"
> ```
> Los strings inline usados hoy son `'NUEVO-PRODUCTO'`, `'VER INVENTARIO'` y `'VER TRANSFERENCIA'` — con formatos inconsistentes entre sí (guion vs. espacio). **Para código nuevo usá `RoleService` + el enum `ROLES`**, no strings inline.

> ⚠️ **Seguridad — estos permisos son solo de UI.** Ocultar un ítem del menú no impide llamar la operación GraphQL correspondiente. El control real depende del backend, que hoy no valida roles de forma uniforme. No trates el chequeo de rol del cliente como una barrera de seguridad.

## FAB y footer contextuales

`AppComponent` reacciona a cada `NavigationEnd` (`app.component.ts:245`) para:

- **`updateFabPosition(url)`** — reposiciona el FAB flotante y lo cierra al navegar.
- **`showFooter`** — se oculta en `/producto/mostrar-precio` y `/producto/precio-config` (`app.component.ts:392-394`), pantallas pensadas para modo kiosco.

Si agregás una pantalla de tipo kiosco, sumala a esa condición.
