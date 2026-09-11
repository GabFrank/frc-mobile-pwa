# Configuración de servidor

La app no tiene un backend fijo: apunta a la instancia del central que el usuario elija. Este documento explica cómo se resuelve esa dirección y por qué cambiarla exige recargar la app.

## Dónde vive la dirección

**`localStorage['serverIp']` y `localStorage['serverPort']`** son la única fuente de verdad en runtime.

Se siembran al arrancar en `app.module.ts:53-68`: si `serverIp` es `null`, `''` o la cadena `'null'`, se completa con los valores por defecto de `serverAdress` (`src/environments/environment.ts`), que a su vez salen de `src/environments/conectionConfig.ts`:

```ts
export const port = '8081'
export const ipAddress = '159.203.86.103'   // servidor central
```

> ⚠️ **Gotcha — los tres estados inválidos.** El chequeo contempla `null`, `''` **y el string `'null'`** porque otras partes del código hacen `localStorage.setItem(clave, null)`, que persiste la cadena `"null"`. Cualquier código nuevo que lea estas claves debe contemplar los tres.

## Instancias conocidas

El diálogo de cambio de servidor (`components/change-server-ip-dialog/`) ofrece dos atajos con valores hardcodeados:

| Atajo | IP | Puerto | Instancia |
|---|---|---|---|
| Bodega | `159.203.86.103` | `8081` | central — bodega |
| Farmacia | `159.203.86.103` | `8082` | central — farmacia |

Más la opción manual, con campos libres de IP y puerto.

Los puertos siguen la convención de instancias del central: `8081` bodega/stable, `8082` farmacia/beta, `8083` alpha. Ver la skill `frc-cicd` para el inventario completo de hosts.

## Cómo se usa la dirección

Dos consumidores, con comportamiento distinto:

**1. Apollo (GraphQL)** — `app.module.ts:70-75`

```ts
const uri  = `http://${localStorage.getItem('serverIp')}:${localStorage.getItem('serverPort')}/graphql`;
const wUri = `ws://${localStorage.getItem('serverIp')}:${localStorage.getItem('serverPort')}/subscriptions`;
```

Son constantes de nivel de módulo: **se evalúan una sola vez, al cargar el módulo**.

**2. REST de login** — `login.service.ts:165,261,304`

Leen `localStorage` **en cada llamada**, así que ven el valor actual sin recargar.

> ⚠️ **Gotcha central — por eso hay que recargar.** Cambiar `serverIp` afecta al login inmediatamente pero **no a Apollo**, que sigue apuntando al servidor viejo hasta que se recargue el bundle. El resultado sería una app que loguea contra un servidor y consulta datos de otro. Por eso **todos** los caminos de cambio de servidor terminan en `window.location.reload()` (`change-server-ip-dialog.component.ts`, 3 ocurrencias).
>
> Si agregás otra forma de cambiar el servidor, **tiene que recargar**. No es opcional.

## Qué hace el diálogo al guardar

En los tres caminos (`onGuardar`, `onBodegaClick`, `onFarmaciaClick`) el orden es el mismo:

1. Escribe `serverIp` y `serverPort` en `localStorage`
2. **Invalida la sesión**: `usuarioId` y `token` a `null` — el token del servidor viejo no sirve en el nuevo
3. Duplica ambos valores en `Preferences` de Capacitor (`@capacitor/preferences`)
4. `window.location.reload()`

> ⚠️ **Gotcha — `Preferences` se escribe pero no se lee.** El diálogo persiste `serverIp`/`serverPort` también en `Preferences`, pero ningún código los lee de ahí: `app.module.ts` y `login.service.ts` leen exclusivamente de `localStorage`. La escritura existe para sobrevivir a limpiezas del WebView que borran `localStorage` pero no el storage nativo — el paso de lectura correspondiente **no está implementado**. Si `localStorage` se limpia, la app vuelve al default de `conectionConfig.ts` en vez de recuperar la IP guardada.

## Transporte

`capacitor.config.ts` fuerza HTTP plano:

```ts
server: {
  cleartext: true,
  androidScheme: 'http'
}
```

Es necesario porque las instancias del central se exponen sin TLS. Consecuencia: **todo el tráfico de la app —credenciales incluidas— viaja sin cifrar.** Ver [autenticacion-sesion.md](autenticacion-sesion.md) y el reporte de vulnerabilidades del workspace.

## Estado de conexión en la UI

`ServerConnectionService` (`services/server-connection.service.ts`) expone `serverReachable$: Observable<boolean | null>` (`null` = todavía sin primer evento) para la toolbar y el diálogo de conexión.

No hace polling: traduce los eventos del WebSocket de suscripciones. Su trabajo real es **evitar falsos "servidor offline"**, con tres supresiones:

| Situación | Mecanismo |
|---|---|
| Scanner nativo abierto | `setNativeScannerActive(true)` suprime el estado offline — el WebView pierde el socket al abrir la cámara |
| App en segundo plano | Listener de `appStateChange` marca `appInBackground` |
| Recién vuelve a foreground | `RESUME_GRACE_MS = 2000` de gracia antes de creerle a una desconexión |

Además, toda desconexión pasa por un debounce de `OFFLINE_DEBOUNCE_MS = 2500` antes de publicarse: solo se muestra "offline" si a los 2,5 s sigue caído.

> ⚠️ **Gotcha — si abrís la cámara nativa, avisá al servicio.** Todo código que lance el scanner debe llamar `setNativeScannerActive(true)` antes y `(false)` después. Si no, el usuario ve un cartel de "servidor no disponible" espurio cada vez que escanea.
