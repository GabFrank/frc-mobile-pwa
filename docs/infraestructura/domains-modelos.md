# Modelos de dominio

`src/app/domains/`. Espejo TypeScript de las entidades del backend `central`.

## El patrón: modelo + input + `toInput()`

Cada entidad se define dos veces:

```ts
export class Usuario {
  id: number;
  persona: Persona;      // objeto anidado completo
  nickname: string;
  roles: string[];

  toInput(): UsuarioInput {
    let input = new UsuarioInput;
    input.id = this.id;
    input.personaId = this.persona?.id;   // ← objeto colapsa a id
    input.nickname = this.nickname;
    input.usuarioId = this.usuario?.id;
    return input;
  }
}

export class UsuarioInput {
  id: number;
  personaId: number;     // ← plano
  nickname: string;
  usuarioId: number;
}
```

- **`XxxModel`** — lo que devuelven las queries: grafo con relaciones anidadas.
- **`XxxInput`** — lo que aceptan las mutations: plano, con `<relacion>Id` en vez del objeto.
- **`toInput()`** — hace la conversión. Es un método de instancia del modelo.

**Siempre mandá `entity.toInput()` a una mutation, nunca el modelo crudo.** El backend rechaza objetos anidados donde espera un id.

> ⚠️ **Gotcha — `toInput()` no copia todos los campos.** Copia solo lo que el input declara. `Usuario.toInput()`, por ejemplo, **no** propaga `email`, `avatar`, `roles` ni `creadoEn`: guardar un usuario recuperado y modificado pierde esos campos si el backend interpreta la ausencia como borrado. Antes de usar `toInput()` para una edición parcial, leé qué campos incluye.

> ⚠️ **Gotcha — `toInput()` solo existe si el objeto es una instancia de la clase.** Lo que devuelve Apollo son **objetos planos**, no instancias: no tienen el método. Hay que hidratarlos (`Object.assign(new Usuario(), res)`) o construir el input a mano. Un `res.toInput is not a function` en runtime siempre es esto.

## Catálogo

| Área | Modelo | Archivo |
|---|---|---|
| Personas | `Usuario`, `UsuarioInput` | `personas/usuario.model.ts` |
| | `Persona` | `personas/persona.model.ts` |
| | `RoleService`, `ROLES` | `personas/roles/` |
| Configuración | `InicioSesion` | `configuracion/inicio-sesion.model.ts` |
| | `TipoDispositivo` (`IOS` \| `ANDROID`) | `configuracion/enums/tipo-dispositivo.model.ts` |
| Empresarial | `Sucursal` + servicio y queries | `empresarial/sucursal/` |
| Productos | `Producto`, `ProductoInput` | `productos/producto.model.ts` |
| | `Codigo` | `productos/codigo.model.ts` |
| | `Presentacion`, `TipoPresentacion` | `productos/presentacion.model.ts` |
| | `PrecioPorSucursal`, `TipoPrecio` | `productos/precio-por-sucursal.model.ts` |
| Comercial | `Cliente` | `cliente/cliente.model.ts` |
| | `Venta` | `venta/venta.model.ts` |
| | `VentaCredito` | `venta-credito/venta-credito.model.ts` |
| | `Cobro` | `cobro/cobro.model.ts` |
| | `FormaPago` | `forma-pago/forma-pago.model.ts` |
| Geografía | `Pais`, `Ciudad` | `general/` |
| | `Zona`, `Sector` (+ queries) | `zona/`, `sector/` |

Total: 20 modelos.

## `Producto` — el modelo central

Es el más grande y el que más flags de negocio concentra:

| Campo | Significado |
|---|---|
| `idCentral` | Id en el servidor central (distinto del `id` local en escenarios de filial) |
| `balanza` | Se vende por peso → habilita el flujo de código pesable |
| `stock` | Controla existencias |
| `vencimiento` + `diasVencimiento` | Control de vencimiento |
| `garantia` + `tiempoGarantia` | Producto con garantía |
| `combo`, `promocion`, `ingrediente` | Tipo de producto |
| `cambiable` | Admite cambio/devolución |
| `isEnvase` + `envase: Producto` | Producto retornable y su envase asociado (auto-referencia) |
| `codigos: [Codigo]` | Todos los códigos de barra del producto |
| `codigoPrincipal` | Código preferido para mostrar |
| `presentaciones: Presentacion[]` | Unidad, caja, pack… cada una con su precio |

> ⚠️ **Gotcha — `Producto` tiene campos comentados en el modelo.** `subfamilia`, `sucursales`, `productoUltimasCompras` y `costo` están comentados en `producto.model.ts`, pero `ProductoInput` **sí** declara `subfamiliaId`. O sea: se puede enviar la subfamilia pero no leerla desde el modelo tipado. Si necesitás ese dato, la query debe pedirlo y hay que acceder sin tipo.

> ⚠️ **Gotcha — `ProductoInput.tiempoGarantia` está tipado `boolean`** (`producto.model.ts`), mientras que `Producto.tiempoGarantia` es `number`. Es un error de tipado en el input: el valor real que espera el backend es numérico. TypeScript no te va a ayudar acá.

## Divergencia con el backend

**No hay generación de código.** Estos modelos se escriben y mantienen a mano contra el schema GraphQL de `central`:

- Un campo agregado en el backend no aparece acá hasta que alguien lo sume.
- Un campo renombrado o borrado en el backend **no genera error de compilación** — la app compila y falla en runtime al pedirlo.
- Los modelos también existen, por separado y con otra forma, en el repo `desktop`. **No están sincronizados entre sí.** No asumas que un modelo del desktop es válido acá.

Al agregar un campo: actualizá el modelo, el input, el `toInput()` **y** la query GraphQL que lo trae. Los cuatro lugares.
