# Edición de producto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poner la edición de un producto —datos generales, familia/subfamilia, presentaciones, códigos y precios— en la PWA, detrás del rol `EDITAR PRODUCTOS`, sin que ningún guardado borre campos que el formulario no muestra.

**Architecture:** Un hub en `/producto/:id/editar` lista las secciones; cada sección es su propia pantalla y guarda con una mutation completa al confirmar. Un servicio con signals es dueño del producto hidratado y arma el `ProductoInput` **completo** en cada guardado, porque `saveProducto` reemplaza la fila en vez de parchearla. Códigos y precios cuelgan de la presentación, no del producto, así que se alcanzan desde la pantalla de la presentación.

**Tech Stack:** Angular 21 standalone y zoneless · Material 21 · Apollo Client 4 / `apollo-angular` 14 (vía el shim `core/graphql/gql-base`) · vitest · Node 20.20.2

**Spec:** [`docs/superpowers/specs/2026-09-04-edicion-producto-pwa-design.md`](../specs/2026-09-04-edicion-producto-pwa-design.md)

## Global Constraints

Estas valen para **todas** las tareas. Están en `CLAUDE.md` y en la spec; se repiten acá porque un ejecutor ve solo su tarea.

- **Toda operación GraphQL aliasea su campo raíz a `data`.** Sin el alias el resultado llega `undefined` **sin error ni log**.
- **Cero valores literales fuera de `src/styles/_tokens.scss`.** Ni un hex, ni un px de espaciado, ni un radio. Se usa `var(--sp-4)`, `var(--brand)`, `var(--radius-md)`.
- **Nunca un token `--mdc-*`.** Material 21 renombró esa familia a `--mat-*` y los nombres viejos fallan en silencio. Hay un test que lo impide.
- **Nunca un backtick dentro de `template:` o `styles:`.** Rompe el literal y el error no señala la causa.
- **`Number('')` es `0`, no `NaN`.** Todo id que venga de la ruta necesita el guard completo: `if (!Number.isFinite(id) || id <= 0)`.
- **`input.required` rompe con parámetros de ruta** (`NG0950`). Va `input<string>()` + `effect`.
- **Un segmento literal siempre antes que `:id`** en las rutas.
- **El dinero lo calcula el backend.** El cliente muestra.
- **Tres estados por pantalla: cargando, vacío, error.** No está terminado sin los tres.
- **Los tests van en `src/app/pruebas/`**, no al lado del componente. Son 78 archivos y 988 tests hoy.
- **Las reglas de negocio van en un archivo `*.reglas.ts` sin Angular adentro**, para poder probarlas. Patrón: `pages/operaciones/gastos/gastos-solicitud.reglas.ts`.
- **`npm run build` es el gate.** `tsc --noEmit` no typechequea plantillas. ⚠️ `npm run build` y `npm test` matan cualquier `npm start` en curso (SIGTERM, salida 143): comparten `.angular/cache`.
- **Commits `feat` o `fix`, nunca `docs`/`chore`/`style`** — `semantic-release` corre el preset angular por defecto y solo esos dos publican.
- **Nada de push ni PR** hasta que el usuario pruebe en la app corriendo y lo autorice explícitamente.

**Rama:** `feat/edicion-producto`, ya creada desde `origin/develop`. Los dos commits de la spec ya están.

---

### Task 1: El rol correcto y sus áreas protegidas

`NUEVO-PRODUCTO` no existe en `personas.role`. Antes de escribir una pantalla hay que arreglar el modelo de roles, o el guard de la Task 5 deja entrar solo a ADMIN.

**Files:**
- Modify: `src/app/domains/personas/roles/roles.enum.ts`
- Modify: `src/app/domains/personas/roles/permisos.ts:30-110`
- Modify: `src/app/pages/producto/producto-detalle.page.ts:41-44` (solo el comentario)
- Modify: `docs/modulos/producto.md`
- Test: `src/app/pruebas/producto-edicion-permisos.spec.ts`

**Interfaces:**
- Consumes: `ROLES` de `roles.enum.ts`, `PERMISOS` y `AreaProtegida` de `permisos.ts`.
- Produces: `ROLES.EDITAR_PRODUCTOS`, `ROLES.EDITAR_PRECIOS`, y las áreas `'productoEdicion'` y `'productoPrecios'` en `PERMISOS`, usables como `rolGuard('productoEdicion')`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-edicion-permisos.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { PERMISOS } from '../domains/personas/roles/permisos';
import { ROLES } from '../domains/personas/roles/roles.enum';

describe('Permisos de la edición de producto', () => {
  it('el módulo pide EDITAR PRODUCTOS', () => {
    expect(PERMISOS.productoEdicion).toContain(ROLES.EDITAR_PRODUCTOS);
  });

  it('los precios piden EDITAR PRECIOS', () => {
    expect(PERMISOS.productoPrecios).toContain(ROLES.EDITAR_PRECIOS);
  });

  it('ADMIN entra a las dos, como a todas', () => {
    // No es un permiso más: es el que usa soporte para entrar a mirar.
    expect(PERMISOS.productoEdicion).toContain(ROLES.ADMIN);
    expect(PERMISOS.productoPrecios).toContain(ROLES.ADMIN);
  });

  it('los nombres de rol son los que existen en la base', () => {
    // Consultado el 2026-09-04 contra `bodega`, 492 usuarios:
    // EDITAR PRODUCTOS (32), EDITAR PRECIOS (26). NUEVO-PRODUCTO no existe.
    expect(ROLES.EDITAR_PRODUCTOS).toBe('EDITAR PRODUCTOS');
    expect(ROLES.EDITAR_PRECIOS).toBe('EDITAR PRECIOS');
  });

  it('editar precios es más restrictivo que editar el producto', () => {
    // 26 personas contra 32: son conjuntos distintos a propósito.
    expect(PERMISOS.productoPrecios).not.toEqual(PERMISOS.productoEdicion);
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-edicion-permisos.spec.ts`
Expected: FAIL — `Property 'productoEdicion' does not exist` y `Property 'EDITAR_PRODUCTOS' does not exist`.

- [ ] **Step 3: Agregar los dos roles al enum**

En `src/app/domains/personas/roles/roles.enum.ts`, junto a `VER_PRODUCTOS` (línea 51):

```ts
  VER_PRODUCTOS = 'VER PRODUCTOS',
  EDITAR_PRODUCTOS = 'EDITAR PRODUCTOS',
  EDITAR_PRECIOS = 'EDITAR PRECIOS',
```

- [ ] **Step 4: Agregar las dos áreas a `PERMISOS`**

En `src/app/domains/personas/roles/permisos.ts`, antes del cierre `} as const satisfies …`:

```ts
  /**
   * Editar un producto: descripción, categoría, presentaciones y códigos.
   *
   * ⚠️ **El rol NO es `NUEVO-PRODUCTO`.** Ese nombre solo existe en el texto
   * del issue #10, de donde lo copiaron `docs/modulos/producto.md` y el
   * comentario de la ficha. `personas.role` no lo tiene —consultado el
   * 2026-09-04 contra `bodega`, 492 usuarios—, así que guardar con ese
   * nombre dejaría entrar solo a ADMIN: el mismo caso `DIRECTIVO` de
   * `aprobacionesRrhh`, unas líneas más arriba.
   *
   * `EDITAR PRODUCTOS` (32 usuarios) sí existe, y es el que el escritorio ya
   * usa para habilitar el alta (`list-producto.component.ts:494`).
   */
  productoEdicion: [ROLES.ADMIN, ROLES.EDITAR_PRODUCTOS],

  /**
   * Editar el precio de una presentación.
   *
   * ⚠️ **Más restrictivo que `productoEdicion`, a propósito.** El modelo de
   * roles del sistema ya separa editar un producto (32 usuarios) de editar su
   * precio (26): son conjuntos distintos, y la diferencia es exactamente la
   * gente a la que la empresa no le confió los precios.
   *
   * El escritorio declara `EDITAR PRECIOS` en su enum y en el menú lateral, y
   * **no lo aplica en ningún lado** del módulo de productos — el mismo patrón
   * que `CREAR TRANSFERENCIA` en `frc-mobile`. Acá se aplica.
   *
   * Esto atiende la mitad «desde el salón» de la objeción del issue #10. La
   * otra mitad —costo y margen a la vista, para los 24 usuarios con
   * `VER PRECIO COSTO`— quedó fuera de esta entrega por decisión del
   * 2026-09-04. Ver la spec.
   */
  productoPrecios: [ROLES.ADMIN, ROLES.EDITAR_PRECIOS],
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/app/pruebas/producto-edicion-permisos.spec.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Corregir las tres copias del rol inexistente**

En `src/app/pages/producto/producto-detalle.page.ts`, reemplazar el párrafo de las líneas 41-44:

```ts
 * Es **de solo lectura**. La edición vive en `/producto/:id/editar` y exige
 * el rol `EDITAR PRODUCTOS`; la sección de precios, además, `EDITAR PRECIOS`.
```

En `docs/modulos/producto.md`, reemplazar las dos apariciones de `NUEVO-PRODUCTO`:

- En «Permisos»: `EDITAR PRODUCTOS` habilita la edición; `EDITAR PRECIOS`, la sección de precios. `NUEVO-PRODUCTO`, que este documento nombraba, **no existe en `personas.role`**.
- En la tabla «Lo que falta, y cuándo se hace», la fila «Edición y alta»: cambiar el rol y sacar la frase «Es del escritorio», que ya no es cierta.

- [ ] **Step 7: Commit**

```bash
git add src/app/domains/personas/roles/roles.enum.ts \
        src/app/domains/personas/roles/permisos.ts \
        src/app/pages/producto/producto-detalle.page.ts \
        src/app/pruebas/producto-edicion-permisos.spec.ts \
        docs/modulos/producto.md
git commit -m "fix(producto): use the roles that exist for product editing"
```

---

### Task 2: El `ProductoInput` completo, que es lo que evita el borrado silencioso

La tarea más importante del plan. `saveProducto` mapea el input a un `Producto` nuevo y lo guarda (`ProductoService.java:297-325`): **todo campo ausente se persiste en `null`**. Un formulario que edita la descripción y manda tres campos apaga el control de vencimiento del producto.

**Files:**
- Modify: `src/app/graphql/productos/graphql-query.ts:84-132`
- Modify: `src/app/domains/productos/producto.model.ts` (la clase `ProductoInput`, al final)
- Create: `src/app/pages/producto/editar/producto-editar.reglas.ts`
- Test: `src/app/pruebas/producto-input-completo.spec.ts`

**Interfaces:**
- Consumes: `Producto` y `ProductoInput` de `domains/productos/producto.model.ts`.
- Produces:
  - `CAMPOS_PRODUCTO_INPUT: readonly string[]` — los 25 campos que acepta `ProductoInput` del central.
  - `construirProductoInput(producto: Producto, cambios: Partial<ProductoInput>): ProductoInput` — hidrata desde el producto leído y aplica los cambios encima.
  - `productoPorIdQuery` extendida (mismo nombre, más campos).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-input-completo.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { productoPorIdQuery } from '../graphql/productos/graphql-query';
import type { Producto } from '../domains/productos/producto.model';
import {
  CAMPOS_PRODUCTO_INPUT,
  construirProductoInput,
} from '../pages/producto/editar/producto-editar.reglas';

/** Un producto con TODO cargado, como el que devuelve el central. */
const completo = (): Producto => ({
  id: 51,
  descripcion: 'ALGILEM GESIC 20 COMPRIMIDOS',
  descripcionFactura: 'ALGILEM GESIC',
  iva: 10,
  unidadPorCaja: 12,
  unidadPorCajaSecundaria: 144,
  balanza: false,
  stock: true,
  garantia: true,
  tiempoGarantia: 6,
  ingrediente: false,
  combo: false,
  promocion: false,
  vencimiento: true,
  diasVencimiento: 30,
  lote: true,
  cambiable: true,
  activo: true,
  propagado: true,
  tipoConservacion: 'NO_ENFRIABLE',
  subfamilia: { id: 7, descripcion: 'ANALGESICOS' },
  isEnvase: false,
  envase: undefined,
});

describe('El ProductoInput viaja completo', () => {
  it('trae los 25 campos aunque solo se cambie la descripción', () => {
    const input = construirProductoInput(completo(), {
      descripcion: 'ALGILEM GESIC 20 COMP.',
    });

    for (const campo of CAMPOS_PRODUCTO_INPUT) {
      expect(input, `falta el campo ${campo}`).toHaveProperty(campo);
    }
  });

  it('no apaga vencimiento ni lote al corregir la descripción', () => {
    // La regresión que este módulo existe para evitar: `saveProducto`
    // reemplaza la fila, así que un campo ausente se guarda en null y el
    // producto deja de pedir lote y fecha en cada recepción e inventario.
    const input = construirProductoInput(completo(), {
      descripcion: 'OTRA COSA',
    });

    expect(input.vencimiento).toBe(true);
    expect(input.diasVencimiento).toBe(30);
    expect(input.lote).toBe(true);
  });

  it('no desactiva el producto', () => {
    const input = construirProductoInput(completo(), { iva: 5 });
    expect(input.activo).toBe(true);
  });

  it('aplana subfamilia y envase a sus ids', () => {
    const input = construirProductoInput(completo(), {});
    expect(input.subfamiliaId).toBe(7);
    expect(input.envaseId).toBeNull();
  });

  it('los cambios pisan al producto hidratado', () => {
    const input = construirProductoInput(completo(), { iva: 5, balanza: true });
    expect(input.iva).toBe(5);
    expect(input.balanza).toBe(true);
  });

  it('la query pide todos los campos que el input puede pisar', () => {
    // Sin esto, agregar un campo al schema del central y no traerlo acá
    // borra ese campo en cada guardado, en silencio.
    const cuerpo = productoPorIdQuery.loc!.source.body;

    const sinEquivalenteEnLaQuery = ['id', 'usuarioId', 'imagenes'];
    const porNombreDistinto: Record<string, string> = {
      subfamiliaId: 'subfamilia',
      envaseId: 'envase',
    };

    for (const campo of CAMPOS_PRODUCTO_INPUT) {
      if (sinEquivalenteEnLaQuery.includes(campo)) continue;
      const buscado = porNombreDistinto[campo] ?? campo;
      expect(cuerpo, `la query no pide ${buscado}`).toMatch(
        new RegExp(`\\b${buscado}\\b`),
      );
    }
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-input-completo.spec.ts`
Expected: FAIL — no existe el módulo `producto-editar.reglas`.

- [ ] **Step 3: Corregir la clase `ProductoInput`**

En `src/app/domains/productos/producto.model.ts`, reemplazar la clase `ProductoInput` entera. Está mal tipada y nunca se usó: `tiempoGarantia` es `boolean` cuando el schema dice `Int`, `ingredientes` no existe —el campo es `ingrediente`— y faltan `activo`, `lote` y `propagado`.

```ts
/**
 * Lo que acepta `saveProducto` del central.
 *
 * ⚠️ **Se manda SIEMPRE completo.** `saveProducto` no parchea: mapea el input
 * a un `Producto` nuevo y lo guarda (`ProductoService.java:297-325`), así que
 * todo campo ausente se persiste en `null`. Armalo con
 * `construirProductoInput()`, nunca a mano.
 *
 * ⚠️ **`observacion` y `creadoEn` no están acá y no es un olvido**: el schema
 * del central no los acepta, así que cada guardado los deja en `null` y no hay
 * forma de evitarlo desde el cliente. Ya le pasa al escritorio, que llama la
 * misma mutation. Anotado en `docs/TODO_TECNICO.md`.
 */
export class ProductoInput {
  id?: number | null;
  propagado?: boolean | null;
  descripcion?: string | null;
  descripcionFactura?: string | null;
  iva?: number | null;
  unidadPorCaja?: number | null;
  unidadPorCajaSecundaria?: number | null;
  balanza?: boolean | null;
  garantia?: boolean | null;
  tiempoGarantia?: number | null;
  ingrediente?: boolean | null;
  combo?: boolean | null;
  stock?: boolean | null;
  promocion?: boolean | null;
  vencimiento?: boolean | null;
  diasVencimiento?: number | null;
  cambiable?: boolean | null;
  usuarioId?: number | null;
  imagenes?: string | null;
  subfamiliaId?: number | null;
  tipoConservacion?: string | null;
  isEnvase?: boolean | null;
  envaseId?: number | null;
  activo?: boolean | null;
  lote?: boolean | null;
}
```

En la misma clase `Producto`, agregar los campos que la ficha no traía y el input sí necesita. Descomentar/agregar:

```ts
  activo?: boolean;
  propagado?: boolean;
  subfamilia?: { id?: number; descripcion?: string; familia?: { id?: number; descripcion?: string } };
```

- [ ] **Step 4: Extender la query**

En `src/app/graphql/productos/graphql-query.ts`, reemplazar el bloque de cabecera de `productoPorIdQuery` (líneas 86-100) por:

```graphql
    data: producto(id: $id) {
      id
      propagado
      descripcion
      descripcionFactura
      iva
      unidadPorCaja
      unidadPorCajaSecundaria
      balanza
      garantia
      tiempoGarantia
      ingrediente
      combo
      stock
      promocion
      vencimiento
      diasVencimiento
      lote
      cambiable
      activo
      tipoConservacion
      imagenPrincipal
      codigoPrincipal
      isEnvase
      subfamilia {
        id
        descripcion
        familia {
          id
          descripcion
        }
      }
      envase {
        id
        descripcion
      }
```

Y dentro de `presentaciones { … precios { … } }`, agregar `sucursal` —hace falta para mostrar los precios de las otras sucursales como solo lectura— y `descripcion`/`activo` de la presentación:

```graphql
      presentaciones {
        id
        descripcion
        activo
        principal
        cantidad
        codigos {
          id
          codigo
          principal
          activo
        }
        tipoPresentacion {
          id
          descripcion
        }
        precioPrincipal {
          id
          precio
        }
        precios {
          id
          precio
          principal
          activo
          sucursal {
            id
            nombre
          }
          tipoPrecio {
            id
            descripcion
          }
        }
      }
```

Encima de `export const productoPorIdQuery`, dejar escrito por qué es tan larga:

```ts
/**
 * Ficha del producto, y la fuente de hidratación de la edición.
 *
 * ⚠️ **Pide más campos de los que la ficha muestra, a propósito.** La edición
 * arma el `ProductoInput` desde este resultado, y `saveProducto` reemplaza la
 * fila en vez de parchearla: un campo que esta query no traiga se guarda en
 * `null` la próxima vez que alguien corrija una descripción. `iva`, `activo`,
 * `garantia` y `stock` están acá por eso, no porque se dibujen.
 *
 * `producto-input-completo.spec.ts` falla si el input acepta un campo que
 * esta query no pide.
 */
```

- [ ] **Step 5: Escribir las reglas**

Crear `src/app/pages/producto/editar/producto-editar.reglas.ts`:

```ts
import type { Producto, ProductoInput } from 'src/app/domains/productos/producto.model';

/**
 * Los campos que acepta `ProductoInput` del central.
 *
 * Es el contrato con `productos.graphqls`. `producto-input-completo.spec.ts`
 * verifica que `construirProductoInput` los emita todos y que
 * `productoPorIdQuery` los pida: sin las dos mitades, agregar un campo al
 * schema del central lo convierte en un borrado silencioso acá.
 */
export const CAMPOS_PRODUCTO_INPUT = [
  'id',
  'propagado',
  'descripcion',
  'descripcionFactura',
  'iva',
  'unidadPorCaja',
  'unidadPorCajaSecundaria',
  'balanza',
  'garantia',
  'tiempoGarantia',
  'ingrediente',
  'combo',
  'stock',
  'promocion',
  'vencimiento',
  'diasVencimiento',
  'cambiable',
  'usuarioId',
  'imagenes',
  'subfamiliaId',
  'tipoConservacion',
  'isEnvase',
  'envaseId',
  'activo',
  'lote',
] as const;

/**
 * Arma el input de `saveProducto` a partir del producto leído del central,
 * con `cambios` aplicado encima.
 *
 * ⚠️ **Nunca armes el input a mano.** `saveProducto` mapea el input a un
 * `Producto` nuevo y lo guarda (`ProductoService.java:297-325`): todo campo
 * ausente se persiste en `null`. Un input con solo `{id, descripcion}` apaga
 * el control de vencimiento, el de lote, el IVA y el flag `activo` — y la
 * mutation responde OK.
 *
 * `usuarioId` se deja fuera a propósito: lo completa `DatosService.guardar()`
 * con el usuario en sesión.
 */
export function construirProductoInput(
  producto: Producto,
  cambios: Partial<ProductoInput>,
): ProductoInput {
  const base: ProductoInput = {
    id: producto.id ?? null,
    propagado: producto.propagado ?? null,
    descripcion: producto.descripcion ?? null,
    descripcionFactura: producto.descripcionFactura ?? null,
    iva: producto.iva ?? null,
    unidadPorCaja: producto.unidadPorCaja ?? null,
    unidadPorCajaSecundaria: producto.unidadPorCajaSecundaria ?? null,
    balanza: producto.balanza ?? null,
    garantia: producto.garantia ?? null,
    tiempoGarantia: producto.tiempoGarantia ?? null,
    ingrediente: producto.ingrediente ?? null,
    combo: producto.combo ?? null,
    stock: producto.stock ?? null,
    promocion: producto.promocion ?? null,
    vencimiento: producto.vencimiento ?? null,
    diasVencimiento: producto.diasVencimiento ?? null,
    cambiable: producto.cambiable ?? null,
    usuarioId: null,
    imagenes: null,
    subfamiliaId: producto.subfamilia?.id ?? null,
    tipoConservacion: producto.tipoConservacion ?? null,
    isEnvase: producto.isEnvase ?? null,
    envaseId: producto.envase?.id ?? null,
    activo: producto.activo ?? null,
    lote: producto.lote ?? null,
  };

  return { ...base, ...cambios };
}
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `npx vitest run src/app/pruebas/producto-input-completo.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/graphql/productos/graphql-query.ts \
        src/app/domains/productos/producto.model.ts \
        src/app/pages/producto/editar/producto-editar.reglas.ts \
        src/app/pruebas/producto-input-completo.spec.ts
git commit -m "fix(producto): send the whole ProductoInput so saving stops wiping fields"
```

---

### Task 3: Las reglas de negocio del escritorio, en un archivo sin Angular

Cuatro reglas que el escritorio codifica y ninguna documentación menciona. Se escriben antes que las pantallas para que las pantallas las usen y no las reinventen.

**Files:**
- Modify: `src/app/pages/producto/editar/producto-editar.reglas.ts`
- Test: `src/app/pruebas/producto-editar-reglas.spec.ts`

**Interfaces:**
- Consumes: `CAMPOS_PRODUCTO_INPUT`, `construirProductoInput` de la Task 2.
- Produces:
  - `aplicarCascadaEnvase(cambios: Partial<ProductoInput>): Partial<ProductoInput>`
  - `faltaParaGuardarProducto(input: ProductoInput): string | null`
  - `preciosADegradar(precios: PrecioPorSucursal[], nuevoPrincipalId: number | null): PrecioPorSucursal[]`
  - `codigosADegradar(codigos: Codigo[], nuevoPrincipalId: number | null): Codigo[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-editar-reglas.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { Codigo } from '../domains/productos/codigo.model';
import type { PrecioPorSucursal } from '../domains/productos/precio-por-sucursal.model';
import {
  aplicarCascadaEnvase,
  codigosADegradar,
  faltaParaGuardarProducto,
  preciosADegradar,
} from '../pages/producto/editar/producto-editar.reglas';

describe('Un envase no tiene propiedades de mercadería', () => {
  it('apaga las seis banderas al marcar isEnvase', () => {
    // producto.component.ts:291-297 del escritorio.
    const r = aplicarCascadaEnvase({ isEnvase: true, balanza: true, lote: true });

    expect(r.balanza).toBe(false);
    expect(r.garantia).toBe(false);
    expect(r.ingrediente).toBe(false);
    expect(r.promocion).toBe(false);
    expect(r.vencimiento).toBe(false);
    expect(r.lote).toBe(false);
  });

  it('no toca combo', () => {
    // El escritorio NO lo apaga. Un combo-envase será raro, pero apagarlo
    // sería inventar una regla que nadie escribió.
    const r = aplicarCascadaEnvase({ isEnvase: true, combo: true });
    expect(r.combo).toBe(true);
  });

  it('no toca nada si isEnvase no se está marcando', () => {
    const r = aplicarCascadaEnvase({ isEnvase: false, balanza: true, lote: true });
    expect(r.balanza).toBe(true);
    expect(r.lote).toBe(true);
  });
});

describe('Qué falta para poder guardar el producto', () => {
  it('no falta nada con descripción', () => {
    expect(faltaParaGuardarProducto({ id: 1, descripcion: 'ALGO' })).toBeNull();
  });

  it('exige descripción', () => {
    // El central hace `e.getDescripcion().toUpperCase()` sin guard
    // (ProductoService.java:312): sin descripción, revienta el servidor.
    expect(faltaParaGuardarProducto({ id: 1, descripcion: null })).toBe(
      'La descripción es obligatoria',
    );
  });

  it('no acepta una descripción de solo espacios', () => {
    expect(faltaParaGuardarProducto({ id: 1, descripcion: '   ' })).toBe(
      'La descripción es obligatoria',
    );
  });
});

describe('Un solo principal por presentación', () => {
  const precios = (): PrecioPorSucursal[] => [
    { id: 1, precio: 12000, principal: true },
    { id: 2, precio: 11000, principal: false },
    { id: 3, precio: 10000, principal: true },
  ];

  it('devuelve los principales anteriores, sin el nuevo', () => {
    // adicionar-precio-dialog.component.ts:226-244 del escritorio. Sin esto
    // quedan dos principales y cuál gana lo decide el orden de la lista.
    expect(preciosADegradar(precios(), 3).map((p) => p.id)).toEqual([1]);
  });

  it('devuelve todos los principales cuando el nuevo es uno recién creado', () => {
    expect(preciosADegradar(precios(), null).map((p) => p.id)).toEqual([1, 3]);
  });

  it('no devuelve nada si no había ningún principal', () => {
    expect(preciosADegradar([{ id: 9, precio: 1, principal: false }], 9)).toEqual([]);
  });

  it('la misma regla vale para los códigos', () => {
    const codigos: Codigo[] = [
      { id: 4, codigo: '779', principal: true },
      { id: 5, codigo: '780', principal: false },
    ];
    expect(codigosADegradar(codigos, 5).map((c) => c.id)).toEqual([4]);
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-editar-reglas.spec.ts`
Expected: FAIL — las cuatro funciones no existen.

- [ ] **Step 3: Escribir las cuatro reglas**

Los dos `import type` van **arriba del archivo**, fusionados con la línea de import que ya dejó la Task 2 — no al final, aunque el resto del bloque sí se agregue al final:

```ts
import type { Codigo } from 'src/app/domains/productos/codigo.model';
import type { PrecioPorSucursal } from 'src/app/domains/productos/precio-por-sucursal.model';
```

Y el resto, al final de `src/app/pages/producto/editar/producto-editar.reglas.ts`:

```ts
/**
 * Un envase no tiene propiedades de mercadería.
 *
 * Marcar `isEnvase` apaga balanza, garantía, ingrediente, promoción,
 * vencimiento y lote. Lo hace el escritorio en `producto.component.ts:291-297`,
 * y no está escrito en ninguna documentación: una botella retornable no vence,
 * no se pesa y no lleva lote.
 *
 * ⚠️ **Son seis, no siete.** El escritorio apaga además `esAlcoholico`, que no
 * existe ni en `ProductoInput` ni en la entidad `Producto` del central: es un
 * control de su formulario que no viaja a ningún lado, como `observacion`. Y
 * **no** apaga `combo`, así que acá tampoco — apagarlo sería inventar una regla
 * de negocio que nadie escribió.
 */
export function aplicarCascadaEnvase(
  cambios: Partial<ProductoInput>,
): Partial<ProductoInput> {
  if (cambios.isEnvase !== true) {
    return cambios;
  }

  return {
    ...cambios,
    balanza: false,
    garantia: false,
    ingrediente: false,
    promocion: false,
    vencimiento: false,
    lote: false,
  };
}

/**
 * Lo que falta para poder guardar, o `null` si está todo.
 *
 * ⚠️ **La descripción no es opcional aunque el schema la declare `String`.**
 * `ProductoService.java:312` hace `e.getDescripcion().toUpperCase()` sin
 * guard: un input sin descripción no da un error de validación, tira un
 * `NullPointerException` en el central.
 */
export function faltaParaGuardarProducto(input: ProductoInput): string | null {
  if (input.descripcion == null || input.descripcion.trim() === '') {
    return 'La descripción es obligatoria';
  }
  return null;
}

/**
 * Los precios que hay que degradar para que quede uno solo principal.
 *
 * El escritorio lo hace en `adicionar-precio-dialog.component.ts:226-244`:
 * antes de guardar el nuevo principal, apaga el `principal` de los demás de
 * esa presentación. Sin esto quedan dos y cuál gana lo decide el orden en que
 * el central devuelva la lista, que no está garantizado.
 *
 * `nuevoPrincipalId` es `null` cuando el que se está marcando todavía no
 * existe en la base.
 */
export function preciosADegradar(
  precios: PrecioPorSucursal[],
  nuevoPrincipalId: number | null,
): PrecioPorSucursal[] {
  return precios.filter((p) => p.principal === true && p.id !== nuevoPrincipalId);
}

/** La misma regla, para el código principal de una presentación. */
export function codigosADegradar(
  codigos: Codigo[],
  nuevoPrincipalId: number | null,
): Codigo[] {
  return codigos.filter((c) => c.principal === true && c.id !== nuevoPrincipalId);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/app/pruebas/producto-editar-reglas.spec.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/producto/editar/producto-editar.reglas.ts \
        src/app/pruebas/producto-editar-reglas.spec.ts
git commit -m "feat(producto): port the desktop's product editing business rules"
```

---

### Task 4: La capa de datos de escritura y los catálogos

Trece operaciones GraphQL. Todas existen en el central: **no hace falta promover nada ni agregar ningún método con sufijo `Mobile`.**

**Files:**
- Modify: `src/app/graphql/productos/graphql-query.ts` (agregar los documentos al final)
- Create: `src/app/graphql/productos/saveProducto.ts`
- Create: `src/app/graphql/productos/savePresentacion.ts`
- Create: `src/app/graphql/productos/deletePresentacion.ts`
- Create: `src/app/graphql/productos/saveCodigo.ts`
- Create: `src/app/graphql/productos/deleteCodigo.ts`
- Create: `src/app/graphql/productos/savePrecioPorSucursal.ts`
- Create: `src/app/graphql/productos/deletePrecioPorSucursal.ts`
- Create: `src/app/graphql/productos/generarCodigoInterno.ts`
- Create: `src/app/graphql/productos/familiaSearch.ts`
- Create: `src/app/graphql/productos/subfamiliaSearch.ts`
- Create: `src/app/graphql/productos/tiposPresentacion.ts`
- Create: `src/app/graphql/productos/tipoPrecios.ts`
- Test: `src/app/pruebas/producto-escritura-operaciones.spec.ts`

**Interfaces:**
- Consumes: `Query`, `Mutation` de `src/app/core/graphql/gql-base`.
- Produces, todas `@Injectable({ providedIn: 'root' })`:
  `SaveProductoGQL`, `SavePresentacionGQL`, `DeletePresentacionGQL`, `SaveCodigoGQL`, `DeleteCodigoGQL`, `SavePrecioPorSucursalGQL`, `DeletePrecioPorSucursalGQL`, `GenerarCodigoInternoGQL`, `FamiliaSearchGQL`, `SubfamiliaSearchGQL`, `TiposPresentacionGQL`, `TipoPreciosGQL`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-escritura-operaciones.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import * as docs from '../graphql/productos/graphql-query';

const NUEVOS = [
  'saveProductoMutation',
  'savePresentacionMutation',
  'deletePresentacionMutation',
  'saveCodigoMutation',
  'deleteCodigoMutation',
  'savePrecioPorSucursalMutation',
  'deletePrecioPorSucursalMutation',
  'generarCodigoInternoQuery',
  'familiaSearchQuery',
  'subfamiliaSearchQuery',
  'tiposPresentacionQuery',
  'tipoPreciosQuery',
] as const;

describe('Las operaciones de escritura de producto', () => {
  it.each(NUEVOS)('%s existe', (nombre) => {
    expect(docs[nombre]).toBeDefined();
  });

  it.each(NUEVOS)('%s aliasea su campo raíz a data', (nombre) => {
    // Sin el alias el resultado llega `undefined` sin error ni log.
    const cuerpo = (docs[nombre] as { loc: { source: { body: string } } }).loc.source.body;
    expect(cuerpo).toMatch(/\bdata:\s*\w+/);
  });

  it('saveProducto manda el input bajo la variable entity', () => {
    // Es lo que arma `DatosService.guardar()`, que además completa usuarioId.
    const cuerpo = docs.saveProductoMutation.loc!.source.body;
    expect(cuerpo).toMatch(/\$entity:\s*ProductoInput!/);
    expect(cuerpo).toMatch(/producto:\s*\$entity/);
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-escritura-operaciones.spec.ts`
Expected: FAIL — los 12 documentos son `undefined`.

- [ ] **Step 3: Agregar los documentos**

Al final de `src/app/graphql/productos/graphql-query.ts`:

```ts
/**
 * Alta y edición de la cabecera del producto.
 *
 * ⚠️ **Reemplaza, no parchea.** El central mapea el input a un `Producto`
 * nuevo y lo guarda (`ProductoService.java:297-325`), así que todo campo
 * ausente se persiste en `null`. El input se arma con
 * `construirProductoInput()`, nunca a mano. Ver
 * `pages/producto/editar/producto-editar.reglas.ts`.
 *
 * ⚠️ **La descripción vuelve en mayúsculas**, porque el central la convierte
 * (`ProductoService.java:312`). La pantalla muestra lo que volvió, no lo que
 * se tipeó, o el operador ve una cosa y la base guarda otra.
 */
export const saveProductoMutation = gql`
  mutation saveProducto($entity: ProductoInput!) {
    data: saveProducto(producto: $entity) {
      id
      descripcion
    }
  }
`;

/** Alta y edición de una presentación. Cuelga del producto. */
export const savePresentacionMutation = gql`
  mutation savePresentacion($entity: PresentacionInput!) {
    data: savePresentacion(presentacion: $entity) {
      id
      descripcion
      cantidad
      principal
      activo
    }
  }
`;

export const deletePresentacionMutation = gql`
  mutation deletePresentacion($id: ID!) {
    data: deletePresentacion(id: $id)
  }
`;

/**
 * Alta y edición de un código.
 *
 * ⚠️ **El código cuelga de la PRESENTACIÓN, no del producto.** `CodigoInput`
 * lleva `presentacionId`: un mismo producto tiene códigos distintos para la
 * unidad y para la caja, y es el código el que determina qué precio y qué
 * cantidad corresponden.
 */
export const saveCodigoMutation = gql`
  mutation saveCodigo($entity: CodigoInput!) {
    data: saveCodigo(codigo: $entity) {
      id
      codigo
      principal
      activo
    }
  }
`;

export const deleteCodigoMutation = gql`
  mutation deleteCodigo($id: ID!) {
    data: deleteCodigo(id: $id)
  }
`;

/**
 * Alta y edición de un precio.
 *
 * ⚠️ **Un precio es la terna presentación × tipo de precio × sucursal**, y se
 * escribe **una** por llamada. La app escribe siempre en la sucursal de la
 * sesión, igual que el escritorio (`adicionar-precio-dialog.component.ts:265`
 * fija `sucursalId = sucursalActual.id` sin alternativa). Los precios de las
 * otras sucursales se muestran de solo lectura.
 */
export const savePrecioPorSucursalMutation = gql`
  mutation savePrecioPorSucursal($entity: PrecioPorSucursalInput!) {
    data: savePrecioPorSucursal(precioPorSucursal: $entity) {
      id
      precio
      principal
      activo
    }
  }
`;

export const deletePrecioPorSucursalMutation = gql`
  mutation deletePrecioPorSucursal($id: ID!) {
    data: deletePrecioPorSucursal(id: $id)
  }
`;

/**
 * El próximo EAN-13 interno: prefijo `2199` + secuencia + dígito verificador.
 *
 * **No lo persiste**: lo devuelve y lo guarda después `saveCodigo`. Es lo que
 * cierra el caso «producto sin código de fábrica» sin que nadie invente
 * números a mano.
 */
export const generarCodigoInternoQuery = gql`
  query {
    data: generarCodigoInterno
  }
`;

/** Familias, para el primer paso de la categoría. Devuelve una página. */
export const familiaSearchQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: familiaSearch(texto: $texto, page: $page, size: $size) {
      getContent {
        id
        descripcion
      }
      hasNext
    }
  }
`;

/**
 * Subfamilias de una familia.
 *
 * ⚠️ **`familiaId` es obligatorio en la práctica.** Sin él la consulta
 * devuelve las subfamilias de todas las familias, que en esta base son cientos
 * y no significan nada fuera de su familia.
 */
export const subfamiliaSearchQuery = gql`
  query ($familiaId: ID, $texto: String, $page: Int, $size: Int) {
    data: subfamiliaSearch(familiaId: $familiaId, texto: $texto, page: $page, size: $size) {
      getContent {
        id
        descripcion
        familia {
          id
          descripcion
        }
      }
      hasNext
    }
  }
`;

/** Tipos de presentación: UNIDAD, CAJA, etc. Son pocos y no se paginan. */
export const tiposPresentacionQuery = gql`
  query ($page: Int, $size: Int) {
    data: tiposPresentacion(page: $page, size: $size) {
      id
      descripcion
    }
  }
`;

/** Tipos de precio: contado, crédito, mayorista. */
export const tipoPreciosQuery = gql`
  query ($page: Int, $size: Int) {
    data: tipoPrecios(page: $page, size: $size) {
      id
      descripcion
      activo
    }
  }
`;
```

- [ ] **Step 4: Crear las doce clases**

Cada archivo sigue el patrón de `src/app/graphql/transferencias/saveTransferenciaItem.ts`. Ejemplo completo, `src/app/graphql/productos/saveProducto.ts`:

```ts
import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { Producto } from 'src/app/domains/productos/producto.model';

import { saveProductoMutation } from './graphql-query';

export interface Response {
  data?: Producto;
}

@Injectable({ providedIn: 'root' })
export class SaveProductoGQL extends Mutation<Response> {
  document = saveProductoMutation;
}
```

Los once restantes, con el mismo molde:

| Archivo | Clase | Documento | `data?` |
|---|---|---|---|
| `savePresentacion.ts` | `SavePresentacionGQL` (Mutation) | `savePresentacionMutation` | `Presentacion` |
| `deletePresentacion.ts` | `DeletePresentacionGQL` (Mutation) | `deletePresentacionMutation` | `boolean` |
| `saveCodigo.ts` | `SaveCodigoGQL` (Mutation) | `saveCodigoMutation` | `Codigo` |
| `deleteCodigo.ts` | `DeleteCodigoGQL` (Mutation) | `deleteCodigoMutation` | `boolean` |
| `savePrecioPorSucursal.ts` | `SavePrecioPorSucursalGQL` (Mutation) | `savePrecioPorSucursalMutation` | `PrecioPorSucursal` |
| `deletePrecioPorSucursal.ts` | `DeletePrecioPorSucursalGQL` (Mutation) | `deletePrecioPorSucursalMutation` | `boolean` |
| `generarCodigoInterno.ts` | `GenerarCodigoInternoGQL` (Query) | `generarCodigoInternoQuery` | `string` |
| `familiaSearch.ts` | `FamiliaSearchGQL` (Query) | `familiaSearchQuery` | `{ getContent?: Familia[]; hasNext?: boolean }` |
| `subfamiliaSearch.ts` | `SubfamiliaSearchGQL` (Query) | `subfamiliaSearchQuery` | `{ getContent?: Subfamilia[]; hasNext?: boolean }` |
| `tiposPresentacion.ts` | `TiposPresentacionGQL` (Query) | `tiposPresentacionQuery` | `TipoPresentacion[]` |
| `tipoPrecios.ts` | `TipoPreciosGQL` (Query) | `tipoPreciosQuery` | `TipoPrecio[]` |

`Familia` y `Subfamilia` no existen todavía como modelos. Crear `src/app/domains/productos/familia.model.ts`:

```ts
export class Familia {
  id?: number;
  descripcion?: string;
  activo?: boolean;
}

export class Subfamilia {
  id?: number;
  descripcion?: string;
  familia?: Familia;
  activo?: boolean;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/app/pruebas/producto-escritura-operaciones.spec.ts`
Expected: PASS, 25 tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/graphql/productos/ src/app/domains/productos/familia.model.ts \
        src/app/pruebas/producto-escritura-operaciones.spec.ts
git commit -m "feat(producto): port the product write operations and catalogs"
```

---

### Task 5: El servicio dueño del producto hidratado

Una sola carga, un solo lugar donde se arma el input, y las secciones leyendo de ahí. Es lo que hace cumplible la regla de la Task 2 sin repetirla en cada pantalla.

**Files:**
- Create: `src/app/pages/producto/editar/producto-editar.service.ts`
- Test: `src/app/pruebas/producto-editar-servicio.spec.ts`

**Interfaces:**
- Consumes: `ProductoPorIdGQL`, `SaveProductoGQL`, `DatosService`, `construirProductoInput`, `aplicarCascadaEnvase`, `faltaParaGuardarProducto`.
- Produces `ProductoEditarService` (`providedIn: 'root'`) con:
  - `producto: Signal<Producto | null>`
  - `cargando: Signal<boolean>` · `error: Signal<string | null>`
  - `cargar(id: number): void`
  - `guardarCabecera(cambios: Partial<ProductoInput>): Observable<Producto>`
  - `totalCodigos: Signal<number>` · `totalPrecios: Signal<number>`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-editar-servicio.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from '../core/graphql/datos.service';
import type { Producto } from '../domains/productos/producto.model';
import { ProductoEditarService } from '../pages/producto/editar/producto-editar.service';

const producto = (): Producto => ({
  id: 51,
  descripcion: 'ALGILEM GESIC',
  iva: 10,
  activo: true,
  vencimiento: true,
  diasVencimiento: 30,
  lote: true,
  presentaciones: [
    {
      id: 1,
      cantidad: 1,
      codigos: [{ id: 10, codigo: '779' }, { id: 11, codigo: '780' }],
      precios: [{ id: 20, precio: 12000 }],
    },
    { id: 2, cantidad: 12, codigos: [{ id: 12, codigo: '781' }], precios: [] },
  ],
});

describe('ProductoEditarService', () => {
  let datos: { porId: ReturnType<typeof vi.fn>; guardar: ReturnType<typeof vi.fn> };
  let servicio: ProductoEditarService;

  beforeEach(() => {
    datos = {
      porId: vi.fn().mockReturnValue(of(producto())),
      guardar: vi.fn().mockReturnValue(of({ id: 51, descripcion: 'OTRA' })),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: DatosService, useValue: datos }],
    });
    servicio = TestBed.inject(ProductoEditarService);
  });

  it('cuenta los códigos y los precios de todas las presentaciones', () => {
    servicio.cargar(51);
    expect(servicio.totalCodigos()).toBe(3);
    expect(servicio.totalPrecios()).toBe(1);
  });

  it('rechaza un id inválido sin llamar al central', () => {
    // `Number('')` es 0, no NaN: sin este guard la app pide el producto cero.
    servicio.cargar(0);
    expect(datos.porId).not.toHaveBeenCalled();
    expect(servicio.error()).toBe('No se entiende qué producto abrir.');
  });

  it('manda el input completo al guardar solo la descripción', () => {
    servicio.cargar(51);
    servicio.guardarCabecera({ descripcion: 'OTRA' }).subscribe();

    const input = datos.guardar.mock.calls[0][1];
    expect(input.vencimiento).toBe(true);
    expect(input.diasVencimiento).toBe(30);
    expect(input.lote).toBe(true);
    expect(input.activo).toBe(true);
    expect(input.iva).toBe(10);
  });

  it('aplica la cascada del envase antes de guardar', () => {
    servicio.cargar(51);
    servicio.guardarCabecera({ isEnvase: true }).subscribe();

    const input = datos.guardar.mock.calls[0][1];
    expect(input.vencimiento).toBe(false);
    expect(input.lote).toBe(false);
  });

  it('no llama al central si falta la descripción', () => {
    servicio.cargar(51);
    servicio.guardarCabecera({ descripcion: '  ' }).subscribe({ error: () => undefined });
    expect(datos.guardar).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-editar-servicio.spec.ts`
Expected: FAIL — no existe `producto-editar.service`.

- [ ] **Step 3: Escribir el servicio**

Crear `src/app/pages/producto/editar/producto-editar.service.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';

import { DatosService } from 'src/app/core/graphql/datos.service';
import { ProductoPorIdGQL } from 'src/app/graphql/productos/productoPorId';
import { SaveProductoGQL } from 'src/app/graphql/productos/saveProducto';
import type { Producto, ProductoInput } from 'src/app/domains/productos/producto.model';

import {
  aplicarCascadaEnvase,
  construirProductoInput,
  faltaParaGuardarProducto,
} from './producto-editar.reglas';

/**
 * Dueño del producto que se está editando.
 *
 * Lo carga una vez y las seis pantallas de la edición leen de acá. Existe por
 * una razón concreta: `saveProducto` reemplaza la fila, así que el input tiene
 * que salir **completo** en cada guardado. Con cada pantalla armando el suyo,
 * alcanzaba con que una olvidara un campo para que corregir una descripción
 * apagara el control de vencimiento. Acá se arma en un solo lugar.
 */
@Injectable({ providedIn: 'root' })
export class ProductoEditarService {
  private readonly datos = inject(DatosService);
  private readonly productoPorId = inject(ProductoPorIdGQL);
  private readonly saveProducto = inject(SaveProductoGQL);

  private readonly _producto = signal<Producto | null>(null);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly producto = this._producto.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly error = this._error.asReadonly();

  readonly presentaciones = computed(() => this._producto()?.presentaciones ?? []);

  readonly totalCodigos = computed(() =>
    this.presentaciones().reduce((n, p) => n + (p.codigos?.length ?? 0), 0),
  );

  readonly totalPrecios = computed(() =>
    this.presentaciones().reduce((n, p) => n + (p.precios?.length ?? 0), 0),
  );

  cargar(id: number): void {
    // `Number('')` es 0, no NaN: sin el guard completo la app pediría el
    // producto cero y mostraría una ficha vacía como si existiera.
    if (!Number.isFinite(id) || id <= 0) {
      this._error.set('No se entiende qué producto abrir.');
      this._cargando.set(false);
      return;
    }

    this._cargando.set(true);
    this._error.set(null);

    this.datos.porId<Producto>(this.productoPorId, id).subscribe({
      next: (p) => {
        this._producto.set(p);
        this._cargando.set(false);
      },
      error: (e: Error) => {
        this._error.set(e.message);
        this._cargando.set(false);
      },
    });
  }

  /**
   * Guarda la cabecera con `cambios` aplicado encima del producto hidratado.
   *
   * El input sale completo siempre. La respuesta se vuelve a poner en el
   * estado porque el central **devuelve la descripción en mayúsculas**
   * (`ProductoService.java:312`): mostrar lo que se tipeó dejaría al operador
   * viendo una cosa distinta de la que quedó guardada.
   */
  guardarCabecera(cambios: Partial<ProductoInput>): Observable<Producto> {
    const actual = this._producto();
    if (actual == null) {
      return throwError(() => new Error('No hay producto cargado.'));
    }

    const input = construirProductoInput(actual, aplicarCascadaEnvase(cambios));

    const falta = faltaParaGuardarProducto(input);
    if (falta != null) {
      return throwError(() => new Error(falta));
    }

    return this.datos
      .guardar<Producto>(this.saveProducto, input as unknown as Record<string, unknown>)
      .pipe(
        tap((guardado) => {
          this._producto.set({ ...actual, ...cambios, ...guardado });
        }),
      );
  }

  /** Vuelve a pedir el producto al central. Lo usan las subpantallas al volver. */
  recargar(): void {
    const id = this._producto()?.id;
    if (id != null) {
      this.cargar(id);
    }
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/app/pruebas/producto-editar-servicio.spec.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/producto/editar/producto-editar.service.ts \
        src/app/pruebas/producto-editar-servicio.spec.ts
git commit -m "feat(producto): add the service that owns the hydrated product"
```

---

### Task 6: El hub, la ruta guardada y la entrada desde la ficha

**Files:**
- Create: `src/app/pages/producto/editar/producto-editar.page.ts`
- Modify: `src/app/pages/producto/producto.routes.ts`
- Modify: `src/app/pages/producto/producto-detalle.page.ts` (botón «Editar»)
- Test: `src/app/pruebas/producto-editar-hub.spec.ts`

**Interfaces:**
- Consumes: `ProductoEditarService` (Task 5), `rolGuard('productoEdicion')` y `rolGuard('productoPrecios')` (Task 1), `PaginaComponent`, `SeccionComponent`, `SkeletonComponent`, `EstadoErrorComponent`.
- Produces: la ruta `/producto/:id/editar` y el componente `ProductoEditarPage`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-editar-hub.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { rutasProducto } from '../pages/producto/producto.routes';

describe('Rutas de la edición de producto', () => {
  const ruta = (path: string) => rutasProducto.find((r) => r.path === path);

  it('la edición cuelga de :id', () => {
    expect(ruta(':id/editar')).toBeDefined();
  });

  it('la edición está guardada por rol', () => {
    expect(ruta(':id/editar')?.canActivate).toBeDefined();
  });

  it('los precios tienen su propio guard', () => {
    expect(ruta(':id/editar/presentacion/:presentacionId/precios')?.canActivate)
      .toBeDefined();
  });

  it('vencidos sigue antes que :id', () => {
    // Con el orden invertido el router resuelve «vencidos» como identificador
    // y el detalle intenta cargar el producto NaN.
    const iVencidos = rutasProducto.findIndex((r) => r.path === 'vencidos');
    const iId = rutasProducto.findIndex((r) => r.path === ':id');
    expect(iVencidos).toBeLessThan(iId);
  });

  it(':id/editar va antes que :id', () => {
    // Angular resuelve por orden y `:id` no matchea dos segmentos, pero el
    // orden explícito deja el archivo legible y a prueba de un `**` futuro.
    const iEditar = rutasProducto.findIndex((r) => r.path === ':id/editar');
    const iId = rutasProducto.findIndex((r) => r.path === ':id');
    expect(iEditar).toBeLessThan(iId);
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-editar-hub.spec.ts`
Expected: FAIL — las rutas nuevas no existen.

- [ ] **Step 3: Escribir el hub**

Crear `src/app/pages/producto/editar/producto-editar.page.ts`. Es una lista de secciones con su resumen; no dibuja campos.

```ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/core/auth/auth.service';
import { PERMISOS } from 'src/app/domains/personas/roles/permisos';
import { RoleService } from 'src/app/domains/personas/roles/role.service';
import { EstadoErrorComponent } from 'src/app/shared/estados-ui/estado-error.component';
import { SkeletonComponent } from 'src/app/shared/estados-ui/skeleton.component';
import { PaginaComponent } from 'src/app/shared/layout/pagina.component';
import { SeccionComponent } from 'src/app/shared/layout/seccion.component';

import { ProductoEditarService } from './producto-editar.service';

/** Una fila del hub. */
interface Seccion {
  clave: string;
  etiqueta: string;
  detalle: string;
  ruta: string;
  habilitada: boolean;
  motivo?: string;
}

/**
 * Hub de la edición.
 *
 * No es un formulario: es la lista de secciones. Cada una abre su pantalla y
 * guarda al confirmar, que es lo que mapea 1 a 1 con cómo guarda el central
 * —cabecera, presentaciones, códigos y precios son mutations distintas y no
 * hay transacción—. Un único botón «Guardar todo» dispararía N mutations
 * sueltas: si la tercera falla, el producto queda mitad nuevo y mitad viejo.
 */
@Component({
  selector: 'frc-producto-editar',
  standalone: true,
  imports: [PaginaComponent, SeccionComponent, SkeletonComponent, EstadoErrorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <frc-pagina [titulo]="titulo()" [conVolver]="true">
      @if (estado.cargando()) {
        <frc-skeleton [cantidad]="5" />
      } @else if (estado.error()) {
        <frc-estado-error [detalle]="estado.error()!" (reintentar)="recargar()" />
      } @else if (estado.producto()) {
        <frc-seccion [panel]="true">
          @for (s of secciones(); track s.clave) {
            <button
              type="button"
              class="fila"
              [disabled]="!s.habilitada"
              (click)="abrir(s)"
            >
              <span class="etiquetas">
                <span class="titulo">{{ s.etiqueta }}</span>
                <span class="detalle">{{ s.habilitada ? s.detalle : s.motivo }}</span>
              </span>
              <span class="chevron" aria-hidden="true">›</span>
            </button>
          }
        </frc-seccion>
      }
    </frc-pagina>
  `,
  styles: [
    `
      .fila {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: var(--sp-4);
        border: none;
        background: transparent;
        color: var(--on-surface);
        text-align: left;
        cursor: pointer;
      }
      .fila:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .etiquetas {
        display: flex;
        flex-direction: column;
        gap: var(--sp-1);
      }
      .titulo {
        font-weight: 600;
      }
      .detalle {
        color: var(--on-surface-variant);
        font-size: var(--text-sm);
      }
      .chevron {
        color: var(--on-surface-variant);
      }
    `,
  ],
})
export class ProductoEditarPage {
  readonly id = input<string>();

  protected readonly estado = inject(ProductoEditarService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(RoleService);

  readonly titulo = computed(() => this.estado.producto()?.descripcion ?? 'Editar producto');

  private readonly puedePrecios = computed(() =>
    this.roles.tieneAlgunRol(this.auth.roles(), PERMISOS.productoPrecios),
  );

  readonly secciones = computed<Seccion[]>(() => {
    const p = this.estado.producto();
    if (p == null) return [];

    const categoria = p.subfamilia
      ? `${p.subfamilia.familia?.descripcion ?? '—'} / ${p.subfamilia.descripcion ?? '—'}`
      : 'Sin categoría';

    return [
      {
        clave: 'generales',
        etiqueta: 'Datos generales',
        detalle: `${p.descripcion ?? '—'} · IVA ${p.iva ?? '—'}%`,
        ruta: 'generales',
        habilitada: true,
      },
      {
        clave: 'categoria',
        etiqueta: 'Familia y subfamilia',
        detalle: categoria,
        ruta: 'categoria',
        habilitada: true,
      },
      {
        clave: 'presentaciones',
        etiqueta: 'Presentaciones',
        detalle: `${this.estado.presentaciones().length}`,
        ruta: 'presentaciones',
        habilitada: true,
      },
      {
        clave: 'codigos',
        etiqueta: 'Códigos',
        // Se cuentan acá pero se editan dentro de la presentación: un código
        // cuelga de la presentación, y editarlo al nivel del producto mentiría
        // sobre a cuál pertenece.
        detalle: `${this.estado.totalCodigos()} · se editan en cada presentación`,
        ruta: 'presentaciones',
        habilitada: true,
      },
      {
        clave: 'precios',
        etiqueta: 'Precios',
        detalle: `${this.estado.totalPrecios()} · se editan en cada presentación`,
        ruta: 'presentaciones',
        habilitada: this.puedePrecios(),
        motivo: `${this.estado.totalPrecios()} · necesitás el permiso EDITAR PRECIOS`,
      },
    ];
  });

  constructor() {
    // `input.required` rompe con parámetros de ruta (NG0950): el router los
    // asigna después de construir el componente.
    effect(() => {
      if (this.id() !== undefined) {
        this.estado.cargar(Number(this.id()));
      }
    });
  }

  abrir(s: Seccion): void {
    if (!s.habilitada) return;
    this.router.navigate(['/producto', this.id(), 'editar', s.ruta]);
  }

  recargar(): void {
    this.estado.cargar(Number(this.id()));
  }
}
```

- [ ] **Step 4: Declarar las rutas**

Reemplazar `src/app/pages/producto/producto.routes.ts`:

```ts
import { Routes } from '@angular/router';
import { rolGuard } from 'src/app/core/auth/rol.guard';

/**
 * Producto.
 *
 * La **búsqueda** no vive acá: es la pestaña `/buscar` de la barra inferior.
 */
/**
 * ⚠️ `vencidos` va **antes** que `:id`: con el orden invertido, el router
 * resolvería «vencidos» como identificador y el detalle intentaría cargar el
 * producto NaN. Mismo orden que en recepción y solicitud de pago. Cuando
 * llegue el alta, `nuevo` va en ese mismo primer bloque.
 */
export const rutasProducto: Routes = [
  {
    path: 'vencidos',
    loadComponent: () =>
      import('./productos-vencidos.page').then((m) => m.ProductosVencidosPage),
  },
  {
    path: ':id/editar',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/producto-editar.page').then((m) => m.ProductoEditarPage),
  },
  {
    path: ':id/editar/generales',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/datos-generales.page').then((m) => m.DatosGeneralesPage),
  },
  {
    path: ':id/editar/categoria',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/categoria.page').then((m) => m.CategoriaPage),
  },
  {
    path: ':id/editar/presentaciones',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/presentaciones.page').then((m) => m.PresentacionesPage),
  },
  {
    path: ':id/editar/presentacion/:presentacionId',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/presentacion-editar.page').then((m) => m.PresentacionEditarPage),
  },
  {
    path: ':id/editar/presentacion/:presentacionId/codigos',
    canActivate: [rolGuard('productoEdicion')],
    loadComponent: () =>
      import('./editar/codigos.page').then((m) => m.CodigosPage),
  },
  {
    /**
     * ⚠️ **Guard propio.** Editar el precio es un permiso distinto de editar
     * el producto: 26 usuarios contra 32. Sin este guard, escribir la URL a
     * mano saltearía la fila deshabilitada del hub.
     */
    path: ':id/editar/presentacion/:presentacionId/precios',
    canActivate: [rolGuard('productoPrecios')],
    loadComponent: () =>
      import('./editar/precios.page').then((m) => m.PreciosPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./producto-detalle.page').then((m) => m.ProductoDetallePage),
  },
];
```

> ⚠️ Las cinco pantallas que este archivo importa se crean en las Tasks 7 a 9. **Hasta entonces el build falla.** Si se ejecuta este plan tarea por tarea con build verde en cada commit, crear en esta tarea los cinco archivos como componentes mínimos —`template: '<frc-pagina titulo="…" [conVolver]="true"></frc-pagina>'`— y completarlos después.

- [ ] **Step 5: Agregar la entrada desde la ficha**

En `src/app/pages/producto/producto-detalle.page.ts`, dentro del `<frc-pagina>` y después de la sección «Producto», agregar el botón. Va condicionado al rol **y** protegido por el guard de ruta: esconder el botón no es un control de acceso.

```html
        @if (puedeEditar()) {
          <button type="button" class="editar" (click)="editar()">Editar producto</button>
        }
```

Y en la clase:

```ts
  private readonly roles = inject(RoleService);
  private readonly router = inject(Router);

  readonly puedeEditar = computed(() =>
    this.roles.tieneAlgunRol(this.auth.roles(), PERMISOS.productoEdicion),
  );

  editar(): void {
    this.router.navigate(['/producto', this.id(), 'editar']);
  }
```

- [ ] **Step 6: Correr los tests y el build**

Run: `npx vitest run src/app/pruebas/producto-editar-hub.spec.ts`
Expected: PASS, 5 tests.

Run: `npm run build`
Expected: build de producción en verde. ⚠️ Mata cualquier `npm start` en curso.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/producto/ src/app/pruebas/producto-editar-hub.spec.ts
git commit -m "feat(producto): add the editing hub behind the EDITAR PRODUCTOS role"
```

---

### Task 7: Datos generales y categoría

Las dos pantallas que guardan con `saveProducto`. Las dos usan `guardarCabecera()`, así que ninguna arma el input por su cuenta.

**Files:**
- Create: `src/app/pages/producto/editar/datos-generales.page.ts`
- Create: `src/app/pages/producto/editar/categoria.page.ts`
- Test: `src/app/pruebas/producto-datos-generales.spec.ts`

**Interfaces:**
- Consumes: `ProductoEditarService.guardarCabecera()`, `FamiliaSearchGQL`, `SubfamiliaSearchGQL`.
- Produces: `DatosGeneralesPage`, `CategoriaPage`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-datos-generales.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { aplicarCascadaEnvase } from '../pages/producto/editar/producto-editar.reglas';
import { camposDeshabilitadosPorEnvase } from '../pages/producto/editar/datos-generales.page';

describe('Datos generales', () => {
  it('deshabilita las seis banderas cuando el producto es envase', () => {
    // Que el formulario las apague no alcanza: si siguen tocables, el
    // operador las prende y el guardado las vuelve a apagar sin decir nada.
    expect(camposDeshabilitadosPorEnvase(true)).toEqual([
      'balanza',
      'garantia',
      'ingrediente',
      'promocion',
      'vencimiento',
      'lote',
    ]);
  });

  it('no deshabilita nada cuando no es envase', () => {
    expect(camposDeshabilitadosPorEnvase(false)).toEqual([]);
  });

  it('la cascada y los campos deshabilitados coinciden', () => {
    // Si se agrega una bandera a una y no a la otra, el formulario muestra un
    // control editable cuyo valor el guardado descarta.
    const cascada = aplicarCascadaEnvase({ isEnvase: true });
    const apagados = Object.entries(cascada)
      .filter(([k, v]) => v === false && k !== 'isEnvase')
      .map(([k]) => k)
      .sort();

    expect(apagados).toEqual([...camposDeshabilitadosPorEnvase(true)].sort());
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-datos-generales.spec.ts`
Expected: FAIL — no existe `camposDeshabilitadosPorEnvase`.

- [ ] **Step 3: Escribir `datos-generales.page.ts`**

El formulario con signals, no `FormGroup` — es el patrón de las pantallas de alta del repo (`gastos-solicitud-nueva.page.ts`). Campos: descripción, descripción de factura, IVA, `activo`, `isEnvase`, tipo de conservación, y las siete banderas.

Exportar, junto al componente:

```ts
/**
 * Las banderas que un envase no puede tener.
 *
 * Es la contracara en pantalla de `aplicarCascadaEnvase()`: un control que se
 * puede tocar pero cuyo valor el guardado descarta es peor que un control
 * deshabilitado. Un test verifica que las dos listas coincidan.
 */
export function camposDeshabilitadosPorEnvase(esEnvase: boolean): string[] {
  return esEnvase
    ? ['balanza', 'garantia', 'ingrediente', 'promocion', 'vencimiento', 'lote']
    : [];
}
```

Al confirmar:

```ts
  guardar(): void {
    this.estado
      .guardarCabecera({
        descripcion: this.descripcion(),
        descripcionFactura: this.descripcionFactura(),
        iva: this.iva(),
        activo: this.activo(),
        isEnvase: this.isEnvase(),
        tipoConservacion: this.tipoConservacion(),
        balanza: this.balanza(),
        garantia: this.garantia(),
        tiempoGarantia: this.tiempoGarantia(),
        ingrediente: this.ingrediente(),
        combo: this.combo(),
        stock: this.stock(),
        promocion: this.promocion(),
        cambiable: this.cambiable(),
      })
      .subscribe({
        // El central devuelve la descripción en mayúsculas; el servicio ya
        // reemplazó el estado con lo que volvió, así que basta con volver.
        next: () => this.router.navigate(['/producto', this.id(), 'editar']),
        error: () => undefined, // el toast ya lo mostró DatosService
      });
  }
```

⚠️ **`vencimiento`, `diasVencimiento` y `lote` no van en ese objeto**: esta entrega no los edita. No hace falta pasarlos — `construirProductoInput()` los hidrata del producto cargado. Ese es exactamente el punto de la Task 2.

- [ ] **Step 4: Escribir `categoria.page.ts`**

Dos pasos: elegir familia (`FamiliaSearchGQL`, con buscador por texto) y después subfamilia (`SubfamiliaSearchGQL` con `familiaId`). Al confirmar:

```ts
    this.estado.guardarCabecera({ subfamiliaId: this.subfamiliaId() }).subscribe({
      next: () => this.router.navigate(['/producto', this.id(), 'editar']),
      error: () => undefined,
    });
```

Los tres estados: `frc-skeleton` mientras carga el catálogo, un vacío con texto propio —«Esa familia no tiene subfamilias cargadas»— y `frc-estado-error` con reintentar. **Un catálogo vacío y un catálogo que no se pudo consultar no se muestran igual.**

- [ ] **Step 5: Correr el test y el build**

Run: `npx vitest run src/app/pruebas/producto-datos-generales.spec.ts`
Expected: PASS, 3 tests.

Run: `npm run build`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/producto/editar/ src/app/pruebas/producto-datos-generales.spec.ts
git commit -m "feat(producto): edit general data and category from the phone"
```

---

### Task 8: Presentaciones y sus códigos

**Files:**
- Create: `src/app/pages/producto/editar/presentaciones.page.ts`
- Create: `src/app/pages/producto/editar/presentacion-editar.page.ts`
- Create: `src/app/pages/producto/editar/codigos.page.ts`
- Test: `src/app/pruebas/producto-codigos.spec.ts`

**Interfaces:**
- Consumes: `SavePresentacionGQL`, `DeletePresentacionGQL`, `SaveCodigoGQL`, `DeleteCodigoGQL`, `GenerarCodigoInternoGQL`, `TiposPresentacionGQL`, `codigosADegradar` (Task 3), el escáner compartido con `FORMATOS_PRODUCTO`.
- Produces: `PresentacionesPage`, `PresentacionEditarPage`, `CodigosPage`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-codigos.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { codigosADegradar } from '../pages/producto/editar/producto-editar.reglas';
import { construirCodigoInput } from '../pages/producto/editar/codigos.page';

describe('Guardar un código', () => {
  it('lo cuelga de la presentación, no del producto', () => {
    // Un mismo producto tiene un código para la unidad y otro para la caja:
    // es el código el que determina qué precio y qué cantidad corresponden.
    const input = construirCodigoInput(
      { id: null, codigo: '7790001', principal: false, activo: true },
      88,
    );
    expect(input.presentacionId).toBe(88);
  });

  it('manda null como id cuando el código es nuevo', () => {
    const input = construirCodigoInput(
      { id: null, codigo: '7790001', principal: false, activo: true },
      88,
    );
    expect(input.id).toBeNull();
  });

  it('degrada el principal anterior al marcar uno nuevo', () => {
    const codigos = [
      { id: 1, codigo: '779', principal: true },
      { id: 2, codigo: '780', principal: false },
    ];
    expect(codigosADegradar(codigos, 2).map((c) => c.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-codigos.spec.ts`
Expected: FAIL — no existe `construirCodigoInput`.

- [ ] **Step 3: `presentaciones.page.ts`**

Lista de las presentaciones del producto, con su cantidad, tipo y la marca de principal. Cada fila abre `presentacion/:presentacionId`. Un botón «Agregar presentación» navega a la misma pantalla con `presentacionId = nueva`.

**Regla de la lista:** la cantidad lidera —`12 (Caja)`—, no el nombre. Es lo que decide el precio y lo que se compara entre filas; es la misma decisión que ya tomó `frc-producto-card`.

- [ ] **Step 4: `presentacion-editar.page.ts`**

Descripción, cantidad, tipo de presentación (`TiposPresentacionGQL`), principal y activo. Guarda con:

```ts
    this.datos
      .guardar<Presentacion>(this.savePresentacion, {
        id: this.presentacionId(),
        descripcion: this.descripcion(),
        cantidad: this.cantidad(),
        tipoPresentacionId: this.tipoPresentacionId(),
        principal: this.principal(),
        activo: this.activo(),
        productoId: Number(this.id()),
      })
      .subscribe({ next: () => this.volverYRecargar(), error: () => undefined });
```

Dos accesos al pie: **Códigos** y **Precios** de esa presentación. El de precios se deshabilita sin `EDITAR PRECIOS`, con el motivo escrito.

Eliminar una presentación pide confirmación por `DialogoService` —nunca `confirm()` nativo, hay un test que lo impide (`sin-dialogos-nativos.spec.ts`)—.

- [ ] **Step 5: `codigos.page.ts`**

Lista los códigos de la presentación, los inactivos tachados —siguen pegados a cajas viejas—. Alta con tres caminos: tipear, **escanear** con el escáner compartido y `FORMATOS_PRODUCTO`, o **generar** el EAN-13 interno con `GenerarCodigoInternoGQL`.

Exportar:

```ts
/** El input de `saveCodigo` para un código de esta presentación. */
export function construirCodigoInput(
  codigo: { id: number | null; codigo: string; principal: boolean; activo: boolean },
  presentacionId: number,
) {
  return {
    id: codigo.id,
    codigo: codigo.codigo,
    principal: codigo.principal,
    activo: codigo.activo,
    presentacionId,
  };
}
```

Al marcar un código como principal, primero se degradan los que devuelve `codigosADegradar()` y recién después se guarda el nuevo. Encadenado con `concatMap`, no en paralelo: si el nuevo se guarda antes de que el viejo se degrade, hay un instante con dos principales y el resultado depende de cuál conteste último.

- [ ] **Step 6: Correr el test y el build**

Run: `npx vitest run src/app/pruebas/producto-codigos.spec.ts`
Expected: PASS, 3 tests.

Run: `npm run build`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/producto/editar/ src/app/pruebas/producto-codigos.spec.ts
git commit -m "feat(producto): edit presentations and their codes"
```

---

### Task 9: Precios

La sección detrás de `EDITAR PRECIOS`. Sin costo ni margen a la vista — decisión del 2026-09-04, registrada en la spec.

**Files:**
- Create: `src/app/pages/producto/editar/precios.page.ts`
- Test: `src/app/pruebas/producto-precios.spec.ts`

**Interfaces:**
- Consumes: `SavePrecioPorSucursalGQL`, `DeletePrecioPorSucursalGQL`, `TipoPreciosGQL`, `preciosADegradar` (Task 3), `AuthService` (para la sucursal de la sesión).
- Produces: `PreciosPage`, `construirPrecioInput`, `esPrecioEditable`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/app/pruebas/producto-precios.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { preciosADegradar } from '../pages/producto/editar/producto-editar.reglas';
import { construirPrecioInput, esPrecioEditable } from '../pages/producto/editar/precios.page';

describe('Editar un precio', () => {
  it('lo escribe en la sucursal de la sesión', () => {
    // El escritorio hace exactamente esto y no ofrece elegir:
    // adicionar-precio-dialog.component.ts:265.
    const input = construirPrecioInput(
      { id: null, precio: 12000, tipoPrecioId: 1, principal: true, activo: true },
      88,
      3,
    );
    expect(input.sucursalId).toBe(3);
    expect(input.presentacionId).toBe(88);
  });

  it('solo es editable el precio de la sucursal de la sesión', () => {
    expect(esPrecioEditable({ sucursal: { id: 3 } }, 3)).toBe(true);
    expect(esPrecioEditable({ sucursal: { id: 7 } }, 3)).toBe(false);
  });

  it('un precio sin sucursal no es editable', () => {
    // «No sé de qué sucursal es» no es «es de la mía».
    expect(esPrecioEditable({ sucursal: undefined }, 3)).toBe(false);
  });

  it('degrada el principal anterior de esa presentación', () => {
    const precios = [
      { id: 1, precio: 12000, principal: true },
      { id: 2, precio: 11000, principal: false },
    ];
    expect(preciosADegradar(precios, 2).map((p) => p.id)).toEqual([1]);
  });
});
```

- [ ] **Step 2: Correrlo y verificar que falla**

Run: `npx vitest run src/app/pruebas/producto-precios.spec.ts`
Expected: FAIL — no existe `precios.page`.

- [ ] **Step 3: Escribir la pantalla**

Lista los precios de la presentación agrupados por sucursal. **El de la sucursal de la sesión es el único editable**; los demás se muestran con su sucursal identificada y en solo lectura. El importe usa `frc-importe`, que ya sabe que el guaraní no lleva decimales.

Exportar:

```ts
/**
 * El input de `savePrecioPorSucursal`.
 *
 * ⚠️ **`sucursalId` sale siempre de la sesión.** El escritorio hace lo mismo
 * y no ofrece alternativa (`adicionar-precio-dialog.component.ts:265`).
 * Escribir en todas las sucursales serían ~18 mutations sueltas sin
 * transacción: si la novena falla, quedan nueve locales con el precio nuevo y
 * nueve con el viejo, y nada lo revierte.
 */
export function construirPrecioInput(
  precio: {
    id: number | null;
    precio: number;
    tipoPrecioId: number;
    principal: boolean;
    activo: boolean;
  },
  presentacionId: number,
  sucursalId: number,
) {
  return {
    id: precio.id,
    precio: precio.precio,
    tipoPrecioId: precio.tipoPrecioId,
    principal: precio.principal,
    activo: precio.activo,
    presentacionId,
    sucursalId,
  };
}

/**
 * Si este precio se puede editar desde acá.
 *
 * Un precio sin sucursal identificada **no** es editable: no saber de qué
 * sucursal es no equivale a que sea de la propia.
 */
export function esPrecioEditable(
  precio: { sucursal?: { id?: number } },
  sucursalSesionId: number,
): boolean {
  return precio.sucursal?.id != null && precio.sucursal.id === sucursalSesionId;
}
```

Al marcar principal, mismo encadenado que en códigos: degradar primero los de `preciosADegradar()`, guardar después, con `concatMap`.

- [ ] **Step 4: Correr el test y el build**

Run: `npx vitest run src/app/pruebas/producto-precios.spec.ts`
Expected: PASS, 4 tests.

Run: `npm run build`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/producto/editar/precios.page.ts src/app/pruebas/producto-precios.spec.ts
git commit -m "feat(producto): edit prices behind the EDITAR PRECIOS role"
```

---

### Task 10: La documentación y el plan de prueba manual

Regla 4.1: **una implementación no está terminada sin su bloque de testeo manual.** Y hay tres documentos que hoy afirman cosas falsas sobre este módulo.

**Files:**
- Modify: `docs/modulos/producto.md`
- Modify: `docs/PLAN_TESTEO_MANUAL.md`
- Modify: `docs/TODO_TECNICO.md`
- Modify: `CLAUDE.md` (la línea de «Pendiente» en «Estado»)

- [ ] **Step 1: Corregir `docs/modulos/producto.md`**

- Tabla «Operaciones GraphQL»: sumar las doce nuevas. Sacar la afirmación de que `saveProducto.ts` estaba portado — no lo estaba.
- Encabezado «Qué cambió en la PWA»: la edición pasa de «Falta» a implementada, con el alta como lo que queda.
- Tabla «Lo que falta, y cuándo se hace»: tachar la fila «Edición y alta» y dejar solo el alta.
- Sección nueva **«La edición»**, con las cuatro cosas que cuesta caro no saber: que `saveProducto` reemplaza, que códigos y precios cuelgan de la presentación, que el precio va a la sucursal de la sesión, y que el rol es `EDITAR PRODUCTOS` y no `NUEVO-PRODUCTO`.

- [ ] **Step 2: Anotar los dos defectos heredados en `docs/TODO_TECNICO.md`**

Como hallazgo nuevo:

> **`saveProducto` pierde `observacion` y `creadoEn` en cada guardado.** El
> central mapea el input a un `Producto` nuevo y lo guarda
> (`ProductoService.java:297-325`), y `ProductoInput` no acepta esos dos
> campos —`creadoEn` figura como `String` contra un `LocalDateTime`, y la
> entidad no tiene `@PrePersist`—. **Afecta también al escritorio**, que llama
> la misma mutation y hasta tiene un control `observacion` en su formulario
> (`producto.component.ts:443`). El arreglo va en el central: agregar los dos
> campos al input. No se hizo acá porque el diseño de la edición decidió no
> tocar el backend.

- [ ] **Step 3: Escribir el bloque de testeo manual**

En `docs/PLAN_TESTEO_MANUAL.md`, bloque nuevo, con «Esperado» por caso y la tabla de totales actualizada. Los casos que no pueden faltar:

1. **La regresión silenciosa.** Abrir un producto **con vencimiento y lote activos**, editar **solo la descripción**, guardar, volver a la ficha. *Esperado:* la descripción cambió **y** el producto sigue mostrando vencimiento y lote. *Por qué:* es la falla que este módulo existe para evitar, y no avisa — la mutation responde OK.
2. **La descripción vuelve en mayúsculas.** Escribir en minúsculas y guardar. *Esperado:* la pantalla muestra el texto en mayúsculas, igual que la ficha.
3. **Descripción vacía.** Borrar la descripción e intentar guardar. *Esperado:* mensaje «La descripción es obligatoria» y **ninguna llamada al central**. *Por qué:* sin este guard el central tira `NullPointerException`.
4. **Cascada del envase.** Marcar «es envase» en un producto con vencimiento. *Esperado:* las siete banderas se apagan y quedan deshabilitadas.
5. **Un solo principal.** En una presentación con dos precios, marcar como principal el que no lo era. *Esperado:* el anterior deja de serlo. Volver a entrar y confirmar que sigue habiendo **uno solo**.
6. **El precio va a la sucursal propia.** Editar un precio y verificar en la ficha que cambió el de la sucursal de la sesión y **ninguno de los otros**.
7. **Sin `EDITAR PRECIOS`.** Con un usuario que tenga `EDITAR PRODUCTOS` y no `EDITAR PRECIOS`: la fila «Precios» del hub aparece deshabilitada con el motivo, y **escribir la URL a mano tampoco entra**.
8. **Sin `EDITAR PRODUCTOS`.** El botón «Editar producto» no aparece en la ficha, y la URL escrita a mano rebota a Inicio con el aviso.
9. **Código por escaneo y código interno.** Agregar un código escaneando con la cámara, y otro con «Generar código interno». *Esperado:* el generado empieza con `2199` y tiene 13 dígitos.
10. **Los tres estados** en cada una de las seis pantallas: con datos, sin datos, y con el central caído (apagarlo, o cambiar a un servidor inexistente).

**Marcar qué queda sin verificar:** el alta de producto (no entra en esta entrega), la imagen del producto, y el comportamiento en Safari/iOS del escaneo dentro de la pantalla de códigos.

- [ ] **Step 4: Actualizar `CLAUDE.md`**

En «Estado», la línea de pendientes dice hoy: *«de **producto**, la edición y el alta con rol `NUEVO-PRODUCTO`»*. Reemplazar por: *«de **producto**, el **alta** con rol `EDITAR PRODUCTOS` — la edición ya está»*, y sumar la edición al párrafo de lo implementado.

- [ ] **Step 5: Correr la suite entera y el build**

```bash
npm test
npm run build
```

Expected: los 988 tests previos más los ~55 nuevos, todos en verde. AOT sin errores.

- [ ] **Step 6: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "feat(producto): document product editing and its manual test block"
```

---

## Cierre — antes de cualquier push

**No hay `git push` ni `gh pr create` hasta que Franco pruebe en la app corriendo y lo autorice.** Compilar no es probar, y los 988 tests en verde tampoco lo son.

El cierre real:

1. Levantar `npm start` (:4300). La app apunta por defecto a **alpha**, que ya tiene todo lo que este módulo necesita: no hace falta central local ni promover nada.
2. Decirle **dónde probar**: pantalla, pasos, y un producto que exista de verdad en su base — **elegido consultando la base**, no inventado. Hace falta uno con vencimiento y lote activos y con dos precios en la misma presentación, o el caso 1 y el caso 5 no se pueden ejercitar.
3. Esperar su aprobación explícita.
4. **Preguntar si se pushea**, en una pregunta que trate solo del push.
5. Recién ahí, `git push` y PR.
