# Apollo / GraphQL

> ⚠️ **Documento histórico.** Describe `frc-mobile` (Ionic + Capacitor), no este repo. Se conserva porque explica reglas de negocio y decisiones que se heredaron. Para la implementación actual, ver [`../design-system.md`](../design-system.md) y [`capa-de-datos.md`](capa-de-datos.md).

Cómo la app habla con `frc-comercial/central`. **Es el documento más importante del repo** — casi todo el código de datos pasa por acá.

## Setup del cliente

Definido en `app.module.ts:139-192`.

```
uri  = http://{serverIp}:{serverPort}/graphql       ← queries y mutations
wUri = ws://{serverIp}:{serverPort}/subscriptions   ← subscriptions
```

El link es un `split` por tipo de operación (`app.module.ts:172-185`): las `subscription` van por WebSocket (`SubscriptionClient` con `reconnect: true`), todo lo demás por HTTP.

**Auth link** (`app.module.ts:147-159`): si existe `localStorage['token']`, agrega el header

```
Authorization: Token <token>
```

Si no hay token, no manda header (la request sale anónima y el backend la rechaza).

> ⚠️ **Gotcha crítico — la URL se calcula al cargar el módulo, no por request.** `uri` y `wUri` son `const` de nivel de módulo (`app.module.ts:70-75`), evaluadas una sola vez cuando se carga `app.module.ts`. **Cambiar `serverIp` en `localStorage` no tiene efecto hasta recargar la app entera.** Por eso el flujo de cambio de servidor termina en `window.location.reload()`. Ver [configuracion-servidor.md](configuracion-servidor.md).

> ⚠️ **Gotcha — el `errorLink` es un no-op.** `app.module.ts:77` registra `onError(({graphQLErrors, networkError}) => {})` con cuerpo vacío. No hay manejo global de errores de red ni de GraphQL: cada llamada se arregla sola (en la práctica, vía `GenericCrudService`).

### Estado de conexión

`ServerConnectionService` recibe los eventos del WebSocket. Como el `SubscriptionClient` se crea antes de que Angular exista, hay un puente explícito: `serverConnectionBridge` (`app.module.ts:84-91`), cableado por un `APP_INITIALIZER` (`app.module.ts:221-226`). Los eventos `onConnected` / `onDisconnected` / `onReconnected` del socket se traducen a `onWebSocketConnected()` / `onWebSocketDisconnected()`.

## ⚠️ La convención `data:` — regla no negociable

**Toda operación GraphQL debe aliasear su campo raíz a `data`.**

```ts
export const usuariosSearch = gql`
  query ($texto: String) {
    data: usuarioSearch(texto: $texto) {   // ← alias obligatorio
      id
      nickname
    }
  }
`;
```

Por qué: `GenericCrudService` lee **siempre** `res.data['data']` (por ejemplo `generic-crud.service.ts:36,69,99,125`). Si la query no aliasea a `data`, el resultado llega `undefined` **sin ningún error** — la pantalla queda vacía y no hay pista en consola.

Ese es el bug más fácil de introducir y el más difícil de diagnosticar en este repo.

La interfaz `Response` acompaña el alias:

```ts
export interface Response {
  data: Usuario;
}

@Injectable({ providedIn: 'root' })
export class UsuarioPorIdGQL extends Query<Response> {
  document = usuarioQuery;
}
```

## Organización de archivos GraphQL

Patrón por operación, repetido en todo el repo:

```
<modulo>/graphql/
├── graphql-query.ts        # los gql`...` (a veces varios por archivo)
├── usuarioPorId.ts         # clase Query/Mutation que envuelve un documento
├── saveUsuario.ts
└── ...
```

- `src/app/graphql/` — operaciones compartidas: `personas/usuario`, `personas/cliente`, `operaciones/venta`, `financiero/venta-credito`.
- `src/app/pages/<modulo>/graphql/` — operaciones propias del módulo. **Es donde vive la mayoría.**

Cada clase extiende `Query<Response>`, `Mutation<Response>` o `Subscription<Response>` de `apollo-angular` y se registra con `providedIn: 'root'`.

## GenericCrudService

`src/app/generic/generic-crud.service.ts` (540 líneas). Envuelve Apollo y agrega loading, toasts y valores por defecto. **Casi ningún servicio llama a Apollo directamente** — pasan por acá.

### API pública

| Método | Firma | Qué hace |
|---|---|---|
| `onGetCustom` | `(gql: Query, data)` | Fetch simple. Sin loading. Toast solo en error |
| `onCustomGet` | `(gql, data, errorOnEmpty?, showLoading = true)` | Fetch con loading. Toast "Item encontrado" en éxito, "Item no encontrado" si `errorOnEmpty` y viene vacío |
| `onCustomSub` | `(gql: Subscription, data)` | Suscripción con loading |
| `onGetAll` | `(gql, page?, size?)` | Fetch paginado; manda `{page, size}` |
| `onGetById<T>` | `(gql, id, page?, size?, sucId?, showLoading = true)` | Fetch por id; manda `{id, page, size, sucId}` |
| `onGet<T>` | `(gql, data, showLoading = true)` | Fetch genérico con variables libres |
| `onGetByTexto` | `(gql, texto)` | Búsqueda por texto; manda `{texto}` |
| `onGetByTextoPorSucursal` | `(gql, texto, sucId)` | Ídem, filtrado por sucursal |
| `onGetByFecha` | `(gql, inicio: Date, fin: Date)` | Fetch por rango; **ver bug abajo** |
| `onSave<T>` | `(gql: Mutation, input, sucId?)` | Mutation; manda `{entity: input, sucId}` |
| `onSaveConDetalle` | `(gql, entity, detalleList, info?)` | Mutation cabecera + detalle; manda `{entity, detalleList}` |
| `onCustomSave` | `(gql, data, showLoading = true)` | Mutation con variables libres. **El único que propaga errores** |
| `onDelete` | `(gql, id, titulo?, data?, showDialog?)` | Mutation de borrado; con `showDialog !== false` pide confirmación primero |

### Comportamiento transversal

**Sin caché.** Todas las operaciones usan `fetchPolicy: 'no-cache'` y `errorPolicy: 'all'`. El `InMemoryCache` de `app.module.ts:188` existe pero nunca se usa para lectura: cada pantalla golpea el servidor. No busques invalidación de caché — no hay.

**Inyección automática de `usuarioId`:**
- `onSave` (`generic-crud.service.ts:279-281`): si `input.usuarioId == null`, lo completa con `+localStorage['usuarioId']`.
- `onSaveConDetalle` (`:448`): **siempre** pisa `entity.usuarioId` con `mainService.usuarioActual?.id`.

No mandes `usuarioId` a mano salvo que quieras un valor distinto al del usuario logueado.

**Toasts automáticos.** Éxito → "Guardado con éxito" / "Eliminado con éxito". Error → "Ups!! Algo salió mal". Si tu pantalla quiere su propio mensaje, pasá `showLoading: false` en los métodos que lo aceptan (suprime también el toast) o usá Apollo directo.

**Confirmación de borrado.** `onDelete` con `showDialog` distinto de `false` abre un `DialogoService` con "Realmente desea eliminar este item: {data}?" y solo ejecuta si el rol de respuesta es `aceptar`.

### ⚠️ Gotchas de GenericCrudService

1. **Los observables casi nunca completan.** Salvo `onCustomSave`, ningún método llama `obs.complete()`. Un `.toPromise()` o un `last()` sobre ellos **nunca resuelve**. Suscribite y desuscribite manualmente (o usá `untilDestroyed`).

2. **Los errores no se propagan.** En error, la mayoría de los métodos muestra el toast genérico y **no emite nada** — el `next` nunca llega. Un `await` sobre esa suscripción queda colgado para siempre. Si necesitás manejar el error, usá `onCustomSave`, que sí hace `obs.error(...)`.

3. **`onCustomGet` es ruidoso.** Emite un toast verde "Item encontrado" en **cada** fetch exitoso, incluso en pantallas que cargan solas. Si no lo querés, pasá otro método.

4. **🐛 Bug conocido en `onGetByFecha`** (`generic-crud.service.ts:401-402`):
   ```ts
   let hoy = new Date();
   let ayer = new Date(hoy.getDay() - 1);   // getDay() = día de la semana (0-6), no del mes
   ```
   `getDay()` devuelve el día de la semana, así que `ayer` termina siendo una fecha de **1970**. Solo afecta al caso en que se llama con `inicio == null && fin == null`. Si vas a usar `onGetByFecha`, **pasá siempre ambas fechas**. Corregirlo requiere revisar los llamadores que hoy dependen del rango degenerado.

## Cambios de schema en el backend

1. **Agregar campos no rompe** — Apollo solo pide lo que la query declara.
2. **Borrar o renombrar un campo que el mobile pide rompe la app en runtime**, no en compilación. No hay codegen ni validación contra el schema: el error aparece recién al abrir la pantalla.
3. Si el cambio existe para soportar al mobile, aplicá la **regla del sufijo `Mobile`** — ver [../REGLAS_DESARROLLO.md](../REGLAS_DESARROLLO.md).
4. No hay `graphql-codegen` en este repo. Los tipos TypeScript de `domains/` se mantienen **a mano** y pueden divergir del schema real sin que nada avise.

## Seguridad — estado conocido

- El transporte es **HTTP plano** (`androidScheme: 'http'`, `cleartext: true`), necesario porque los servidores central/filial corren en LAN sin TLS.
- El token va en `localStorage`, accesible desde cualquier JS del bundle.
- Varias queries de usuario piden el campo `password` (ej. `graphql/personas/usuario/graphql/graphql-query.ts`), que el backend devuelve en texto plano.

Esto es deuda conocida y auditada: ver [`../../REPORTE_VULNERABILIDADES.md`](../../../../REPORTE_VULNERABILIDADES.md). **No lo empeores** agregando nuevas queries que pidan `password`.
