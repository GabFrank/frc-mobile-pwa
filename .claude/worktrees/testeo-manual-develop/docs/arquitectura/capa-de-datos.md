# Capa de datos

Reemplaza a [`apollo-graphql.md`](apollo-graphql.md), que describe cómo funcionaba en `frc-mobile`. Ese documento se conserva porque explica el porqué de varias decisiones que se heredaron.

## Panorama

```
Componente
   └─ Servicio del módulo (CajaService, …)
        └─ DatosService            ← loading, toasts, errores, alias data:
             └─ Query / Mutation   ← shim sobre Apollo (core/graphql/gql-base.ts)
                  └─ Apollo Client 4
                       └─ https://{instancia}/graphql
```

## El shim `gql-base.ts`

`apollo-angular` v14 **eliminó** las clases base `Query`, `Mutation` y `Subscription`; solo quedan `Apollo`, `ApolloBase` y `QueryRef`.

Los ~296 documentos GraphQL portados de `frc-mobile` las extienden, así que `core/graphql/gql-base.ts` las reimplementa sobre `Apollo` con la misma forma. El port es mecánico: cambia el import, no el contenido.

```ts
// antes (frc-mobile)
import { Query } from 'apollo-angular';

// ahora
import { Query } from 'src/app/core/graphql/gql-base';
```

Los defaults de toda operación son `fetchPolicy: 'no-cache'` y `errorPolicy: 'all'`. Una pantalla puede pedir otra política por operación.

> **Por qué sin caché:** el backend es la fuente de verdad de saldos, stock y estados. Mostrar un dato viejo en una pantalla de arqueo o de existencias tiene consecuencias operativas. Si algún día un catálogo estable justifica cachear, se pide explícitamente en esa operación.

## La convención `data:` — sigue vigente

**Toda operación GraphQL aliasea su campo raíz a `data`.**

```graphql
query ($id: Int) {
  data: miOperacion(id: $id) { id }
}
```

Se mantuvo la convención heredada porque cambiarla obligaba a tocar los 296 documentos sin ganar nada.

**Lo que sí cambió:** en `frc-mobile`, una operación sin el alias devolvía `undefined` en silencio y la pantalla quedaba vacía sin ninguna pista. Ahora `DatosService` lo detecta y lanza un error que nombra el problema y apunta a esta documentación.

### Tipado de las clases GQL

Toda clase declara el **tipo envoltorio**, no el payload:

```ts
export interface Response { data?: Sector[]; }

@Injectable({ providedIn: 'root' })
export class SectoresGQL extends Query<Response> { … }
```

El repo anterior mezclaba ambos estilos —157 usaban el envoltorio y unas 40 el payload directo—; se normalizaron todas al portarlas.

## `DatosService`

`core/graphql/datos.service.ts`. Reemplaza a `GenericCrudService`.

### API

| Método | Variables que envía |
|---|---|
| `consultar(gql, variables?, opciones?)` | las que se pasen |
| `porId(gql, id, extra?, opciones?)` | `{ id, page, size, sucId }` |
| `paginado(gql, page, size, extra?, opciones?)` | `{ page, size, … }` |
| `porTexto(gql, texto, sucId?, opciones?)` | `{ texto, sucId? }` |
| `porFecha(gql, inicio?, fin?, opciones?)` | `{ inicio, fin }` |
| `guardar(gql, input, sucId?, opciones?)` | `{ entity, sucId }` |
| `guardarConDetalle(gql, entity, detalleList, opciones?)` | `{ entity, detalleList }` |
| `mutar(gql, variables?, opciones?)` | las que se pasen |
| `eliminar(gql, id, opciones?)` | `{ id }` |
| `suscribir(gql, variables?, opciones?)` | las que se pasen |

`opciones`: `mostrarCarga` (default `true`), `notificarError` (default `true`), `mensajeExito`, `gql` (política de caché puntual).

### Qué cambió respecto de `GenericCrudService`

| Antes | Ahora |
|---|---|
| Ningún método completaba (salvo uno) | **Todos completan** — `firstValueFrom` funciona |
| Los errores morían en un toast genérico | **Se propagan** por el canal de error |
| Devolvía `Promise<Observable<T>>` | Devuelve `Observable<T>` |
| `porFecha` sin fechas daba un rango desde 1970 | Calcula el día anterior correctamente |
| `onDelete` abría el diálogo de confirmación | La confirmación es de la pantalla, vía `DialogoService` |
| El toast de éxito salía siempre | Solo si el backend devolvió algo afirmativo |

> **Sobre el borrado:** mezclar confirmación y transporte hacía imposible eliminar sin preguntar. Ahora la pantalla confirma y después llama a `eliminar`.

### Inyección de `usuarioId`

`guardar` y `guardarConDetalle` completan `usuarioId` desde la sesión si el input no lo trae. No pises el valor salvo que quieras atribuir la operación a otro usuario. El input que recibís **no se muta**.

## Uso desde un servicio de módulo

```ts
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly datos = inject(DatosService);
  private readonly porIdGQL = inject(CajaPorIdGQL);

  porId(id: number, sucId?: number): Observable<PdvCaja> {
    return this.datos.porId<PdvCaja>(this.porIdGQL, id, { sucId });
  }
}
```

Y desde una pantalla:

```ts
this.cajaService.porId(id).subscribe({
  next: (caja) => { this.caja.set(caja); this.cargando.set(false); },
  error: (err: Error) => { this.error.set(err.message); this.cargando.set(false); },
});
```

> **El handler de `error` no es opcional.** A diferencia del repo anterior, los errores llegan de verdad. Sin handler, quedan como excepción no capturada y la pantalla se queda en estado de carga.

## Verificá el contrato real antes de tipar

Al portar `CajaService` apareció que el central no devuelve lo que uno supondría:

- `abrirCaja` y `cerrarCaja` devuelven **`boolean`**, no la caja.
- `imprimirBalance` es **query**, no mutation.
- `saveZona` y `saveSector` devuelven **`boolean`**, no la entidad.

Mirá el `Response` del archivo GraphQL antes de escribir la firma del servicio.

## Suscripciones

`suscribir()` existe y pasa por el mismo manejo de errores que las lecturas.

> ⚠️ **El transporte WebSocket todavía no está configurado.** `ServerConfigService.subscriptionsUrl` está listo, pero `app.config.ts` no arma aún el `split()` que enruta las operaciones de tipo `subscription` hacia `wss://`. Ninguna pantalla usa suscripciones por ahora; **antes de adoptar la primera hay que agregar ese link**, o Apollo intentará mandarla por HTTP y fallará.

## Configuración del servidor

`ServerConfigService` resuelve la instancia destino. **Apollo evalúa la URI en cada operación**, así que cambiar de servidor no obliga a recargar la app — a diferencia de `frc-mobile`, donde la URI se calculaba una vez al cargar el módulo.

`cambiarServidor()` **invalida la sesión**: el token de una instancia no vale en otra, y seguir mandándolo produce 401 que parecen credenciales incorrectas.
