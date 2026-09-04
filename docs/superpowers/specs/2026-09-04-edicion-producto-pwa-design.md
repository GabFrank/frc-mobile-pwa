# Edición de producto

**Fecha:** 2026-09-04
**Issue:** [#10 — Lo que falta de paridad con `frc-mobile`](https://github.com/GabFrank/frc-mobile-pwa/issues/10)
**Estado:** diseño aprobado, pendiente de plan de implementación

## Qué resuelve

Hoy la PWA **lee** un producto entero: la ficha (`/producto/:id`) muestra todos
los códigos de cada presentación —los inactivos tachados incluidos— y todos los
tipos de precio. Lo que no puede hacer es **corregir** nada. Una descripción mal
escrita, un código que falta, una presentación con la cantidad equivocada o un
precio desactualizado obligan a ir a una computadora.

Esta entrega pone la edición en el teléfono, detrás del rol `NUEVO-PRODUCTO`.

**No hay port posible.** `edit-producto` en `frc-mobile` es un scaffold vacío del
CLI: existe el directorio y nada más. La referencia es el formulario del
escritorio —`frc-sistemas-integrados-angular`,
`src/app/modules/productos/producto/edit-producto/`, **3.204 líneas** entre
`producto.component.ts` (1.423) y su HTML (1.775)—, con siete `FormGroup`:
familia, subfamilia, datos generales, imágenes, códigos, precios y
presentaciones.

## Qué NO entra

- **El alta.** Va en una segunda entrega, reusando las secciones ya probadas
  contra el central. La edición rinde valor antes y el alta hereda componentes
  verificados en vez de estrenarlos todos a la vez.
- **Vencimiento y lote como sección editable.** Los campos se **hidratan y se
  reenvían** (ver §1), pero no hay pantalla para cambiarlos.
- **La imagen del producto.** Sacar la foto, recortarla, redimensionarla y
  subirla por `saveImagenProducto` es la subfunción que más gana el teléfono
  contra el escritorio, y por eso merece su propia entrega con su camino en
  Safari (regla 7) y su bloque de testeo.
- **Ingredientes, combos y proveedores.** No están en la ficha ni los pidió
  nadie.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Alcance de precios | **Paridad completa**: el precio se edita | Decisión explícita del 2026-09-04. Ver «La objeción que queda sin mitigar». |
| Orden de entrega | **Edición primero, alta después** | Rinde valor antes; el alta hereda secciones ya probadas contra el central. |
| Forma de la pantalla | **Hub + subpantallas**, cada una guarda al confirmar | Mapea 1 a 1 con cómo guarda el central: cada confirmación es una mutation completa, así que nada queda a medias. Y es la forma del caso real —se entra a corregir una cosa, no a revisar treinta campos. |
| Sucursal del precio | **Solo la de la sesión** | Es lo que hace el escritorio, sin alternativa: `adicionar-precio-dialog.component.ts:265` fija `sucursalId = mainService.sucursalActual.id`. Escribir en todas serían ~18 mutations sin transacción, o una mutation nueva en el central. |
| Códigos y precios | **Dentro de la presentación**, no del producto | `CodigoInput` lleva `presentacionId` y `PrecioPorSucursalInput` lleva `presentacionId + tipoPrecioId + sucursalId`. Editarlos al nivel del producto mentiría sobre a qué presentación pertenecen. |
| `ProductoInput` | **Siempre completo**, aunque el formulario edite un subconjunto | `saveProducto` reemplaza, no parchea. Ver §1. |

---

## 1 · La regla que gobierna el módulo

**Hidratar completo, editar un subconjunto, mandar completo.**

`saveProducto` **no es un PATCH: es un reemplazo.** Verificado en
`franco-system-backend-servidor`,
`src/main/java/com/franco/dev/service/productos/ProductoService.java:297-325`:

```java
Producto e = m.map(entity, Producto.class);   // objeto NUEVO desde el input
...
p = repository.save(e);                        // reemplazo completo
```

Mapea el input a un `Producto` nuevo y lo guarda. **Todo campo que el input no
traiga se persiste en `null`.**

Es la misma trampa que `saveTransferenciaItem` antes del commit `8f29003f` del
central, la que quedó anotada en `CLAUDE.md`. Acá muerde justo donde el alcance
recorta: dejar «vencimiento y lote» fuera del formulario **no** los deja fuera
del input. Si la PWA manda un `ProductoInput` sin `vencimiento`,
`diasVencimiento` y `lote`, corregir una descripción mal escrita **apaga el
control de vencimiento del producto** —y con él la carga de lote y fecha en cada
recepción e inventario—, en silencio y con la mutation respondiendo OK.

### Qué hay que arreglar antes de escribir una pantalla

`productoPorIdQuery` (`src/app/graphql/productos/graphql-query.ts:84-132`) trae
hoy **9 campos de cabecera** de los **21** que acepta `ProductoInput`. Faltan:

| Campo faltante | Qué se pierde si no se manda |
|---|---|
| `descripcionFactura` | La descripción que sale en la factura electrónica |
| `iva` | La tasa; queda nula y el producto no factura bien |
| `garantia`, `tiempoGarantia` | El producto deja de tener garantía |
| `ingrediente`, `combo` | Se cae de las recetas y los combos |
| `stock` | Deja de controlar existencia |
| `promocion` | Sale de las promociones |
| `activo` | **Se desactiva el producto** |
| `subfamilia` | Se cae de su categoría y de los reportes por familia |
| `tipoConservacion` | Se pierde si es refrigerable o congelable |
| `observacion`, `unidadPorCaja`, `propagado` | Datos de cabecera |

Además, `precios` en esa query no pide `sucursal`, que hace falta para mostrar
los precios de las otras sucursales como solo lectura.

**Primer cambio del módulo: extender `productoPorIdQuery`.** Sin eso, la primera
edición de descripción borra la mitad de la ficha.

**Con un test que lo sostenga:** comparar las claves de `ProductoInput` contra
los campos que la query pide, de modo que agregar un campo al schema del central
sin traerlo acá falle en CI y no en producción.

---

## 2 · Rutas y estructura

```
/producto/:id           ficha (existe, solo lectura)
/producto/:id/editar    hub de secciones          ← nuevo
```

`editar` cuelga de `:id`, así que no compite con el segmento `vencidos` que ya
va primero en `producto.routes.ts`. Cuando llegue el alta, `/producto/nuevo`
tiene que ir **antes** de `:id`, como manda la regla del repo.

El hub no es una pantalla de formulario: es una lista de secciones con su
resumen. Cada sección abre su propia pantalla y guarda al confirmar.

```
  ←  ALGILEM GESIC 20 COMP.
  ┌──────────────────────────┐
  │ Datos generales        › │
  │ Descripción, IVA 10%     │
  ├──────────────────────────┤
  │ Familia y subfamilia   › │
  │ Medicamentos / Analgés.  │
  ├──────────────────────────┤
  │ Presentaciones      2  › │
  ├──────────────────────────┤
  │ Códigos             3  › │
  ├──────────────────────────┤
  │ Precios             4  › │
  └──────────────────────────┘
```

```
pages/producto/editar/
  producto-editar.page.ts            hub
  datos-generales.page.ts            → saveProducto
  familia-subfamilia.page.ts         → saveProducto
  presentaciones.page.ts             lista de presentaciones
  presentacion-editar.page.ts        → savePresentacion / deletePresentacion
  codigos.page.ts                    → saveCodigo / deleteCodigo
  precios.page.ts                    → savePrecioPorSucursal / delete
  producto-editar.service.ts         estado del producto hidratado
```

**Códigos y precios se alcanzan desde `presentacion-editar`**, no desde el hub.
El hub los **cuenta** —«Códigos 3», «Precios 4», sumando todas las
presentaciones— porque saber cuántos hay es útil de un vistazo; editarlos ahí
mentiría sobre a qué presentación pertenecen.

**`producto-editar.service.ts` es el dueño del producto hidratado.** Lo carga
una vez, cada sección lee de él y, al guardar, arma el `ProductoInput` completo
desde ese estado con solo los campos tocados cambiados. Es lo que hace
cumplible la regla de §1 sin repetirla en cada pantalla.

**Entrada:** menú `⋮` de la ficha, con guard de ruta por rol `NUEVO-PRODUCTO`
**además** de ocultar la acción. Ocultar el botón no es un control de acceso.

---

## 3 · Capa de datos

`src/app/graphql/productos/` tiene hoy nueve operaciones y **todas son de
lectura**. `docs/modulos/producto.md` afirma que `saveProducto.ts` está portado;
**no lo está**, y hay que corregir esa tabla.

Falta portar:

| Escritura | Lectura (catálogos de los selectores) |
|---|---|
| `saveProducto` | familias / búsqueda de familia |
| `savePresentacion` · `deletePresentacion` | subfamilias por familia |
| `saveCodigo` · `deleteCodigo` | tipos de presentación |
| `savePrecioPorSucursal` · `deletePrecioPorSucursal` | tipos de precio |
| | `generarCodigoInterno` |

Todas aliasean su campo raíz a `data`, como el resto del repo.

`generarCodigoInterno` ya existe en el central
(`productos/producto/codigo.graphqls`) y el escritorio la usa: devuelve el
próximo EAN-13 interno —prefijo `2199` + secuencia + dígito verificador— sin
persistirlo; lo guarda después `saveCodigo`. En el teléfono cierra el caso
«producto sin código de fábrica» sin que nadie invente números a mano.

### El backend no se toca

**No hace falta ningún método con sufijo `Mobile`** (regla 5 de `CLAUDE.md`).
Las mutations y queries necesarias existen todas en el esquema del central,
verificadas en `src/main/resources/graphql/productos/producto/`:
`productos.graphqls`, `presentacion.graphqls`, `codigo.graphqls`,
`precio-por-sucursal.graphqls`.

Es la primera entrega del repo que **no depende de promover el central**. No hay
advertencia de versión mínima que agregar a `CLAUDE.md`.

---

## 4 · Reglas de negocio a replicar

Salieron del código del escritorio, no de la documentación. Cada una va con su
test.

1. **Un solo precio principal por presentación.** Al marcar uno como principal,
   el escritorio **degrada el anterior** de esa presentación
   (`adicionar-precio-dialog.component.ts:226-244`). Sin esto quedan dos
   principales y cuál gana lo decide el orden de la lista.

2. **`isEnvase` apaga en cascada** balanza, garantía, ingrediente, alcohólico,
   promoción, vencimiento y lote (`producto.component.ts:287-297`). Un envase no
   tiene ninguna de esas propiedades.

3. **El precio se escribe en la sucursal de la sesión**, nunca en otra. Las
   demás se muestran de solo lectura, con su sucursal identificada.

4. **La descripción se guarda en mayúsculas.** Lo hace el central
   (`ProductoService.java:312`), no el cliente. La pantalla tiene que mostrar el
   valor **que volvió**, no el que se tipeó, o el operador ve una cosa y la base
   guarda otra.

5. **`descripcion` no puede ir nula.** Esa misma línea hace `.toUpperCase()` sin
   guard: un input sin descripción **revienta el servidor**. Validación
   obligatoria del lado del cliente, no solo por buenas maneras.

6. **El código escaneado identifica la presentación, no solo el producto.**
   Cargar un código con la cámara reusa el escáner compartido con
   `FORMATOS_PRODUCTO`, como el resto del repo.

---

## 5 · Verificación

- **Tres estados por pantalla** —carga, vacío, error—, regla 4 de `CLAUDE.md`.
  «No hay» y «no pude preguntar» son respuestas distintas.
- **Tests de vitest por cada regla de §4**, más el test de cobertura de campos
  de §1.
- **`npm run build` es el gate.** `tsc --noEmit` no typechequea plantillas.
- **Bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md`** con «Esperado» por caso y la
  tabla de totales actualizada (regla 4.1). El caso que no puede faltar:
  **editar solo la descripción de un producto con vencimiento y lote activos, y
  verificar en la ficha que ambos siguen activos.** Es la regresión de §1, y es
  silenciosa.
- **Actualizar `docs/modulos/producto.md`**: la tabla de operaciones GraphQL, el
  estado del módulo, y la fila «Edición y alta» de «Lo que falta».

---

## La objeción que queda sin mitigar

El issue #10 dice, sobre este mismo ítem:

> Es discutible que vaya acá: cambiar un precio desde el salón, sin costos ni
> márgenes a la vista, es de donde salen los precios mal cargados.

**La objeción es correcta y este diseño no la mitiga.** Se evaluaron tres
caminos —dejar los precios fuera de la PWA; habilitarlos solo con el rol
`VER PRECIO COSTO` (que ya existe en `roles.enum.ts:50`) mostrando costo y
margen junto al campo; o exigir autorización de un segundo usuario— y el
2026-09-04 se decidió **paridad completa**: el precio se edita desde el
teléfono, sin rol adicional y sin costo ni margen a la vista.

Queda escrito para que se lea como **una elección tomada con la objeción sobre
la mesa**, y no como algo que se pasó por alto. Si aparecen precios mal
cargados, el rol `VER PRECIO COSTO` es la palanca que ya está puesta: habilitar
la sección solo para quien lo tiene y mostrar el margen resultante no requiere
tocar el central.
