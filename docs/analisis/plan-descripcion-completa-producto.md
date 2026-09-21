# Plan — La descripción completa del producto en la lista

Rama: `fix/productos-descripcion-completa` (desde `develop` @ `57f8708`).

## Qué pasa

En la lista de productos (pestaña **Buscar**, y todo lo que reusa el buscador:
diálogo de búsqueda de transferencias, devoluciones, inventario, vencidos) una
descripción larga se corta en una sola línea con «…». El usuario no puede
distinguir dos productos que comparten el principio del nombre
(«COCA COLA 500ML…» / «COCA COLA 500ML ZERO…»).

Causa: `.titulo` de `shared/producto/producto-card.component.ts` tiene
`white-space: nowrap` + `text-overflow: ellipsis` + `overflow: hidden`.

## Qué se cambia

La misma regla CSS en las dos listas que muestran la descripción del producto:
`shared/producto/producto-card.component.ts` (buscador y todo lo que lo reusa) y
`pages/inventario/inventario-item-card.component.ts` (lista del conteo de
inventario, que tiene su propio `.titulo` con el mismo truncado):

```css
.titulo {
  font-weight: var(--fw-medium);
  overflow-wrap: anywhere;   /* un código sin espacios tampoco desborda */
}
```

- Sin `nowrap` ni `ellipsis`: el título baja a las líneas que necesite.
- `overflow-wrap: anywhere` para palabras sin espacios (códigos, «X12UNIDADESX500ML»):
  sin él, con `min-width: 0` en `.datos`, se saldrían de la card.
- **No** se toca `.sub` ni `.stock` (código y existencias son cortos; truncarlos
  sigue siendo razonable) ni `shared/card/card.component.ts` (la card genérica
  la usan otras pantallas con títulos que no son de producto: fuera de alcance).
- `.principal` ya usa `align-items: center`: con varias líneas la foto queda
  centrada verticalmente contra el bloque de texto, y el chevron también.

Datos nuevos: **ninguno**. N/A la tabla escritor/lector porque no nace ningún
campo, columna ni clave.

## Fases

**Fase 1** — `fix(buscador): mostrar la descripción completa del producto en la card`
- CSS de `.titulo` en `producto-card`.
- CSS de `.titulo` en `inventario-item-card`.
- Test `src/app/shared/producto/producto-card.component.spec.ts`: renderiza la
  card con TestBed y una descripción larga, y exige que el `getComputedStyle`
  de `.titulo` no tenga `white-space: nowrap` ni `text-overflow: ellipsis`.
  Mira el estilo aplicado, no el texto de la fuente. Se verifica que falla con
  el CSS viejo (paso 7: revertir el fix y ver el rojo).
- Bloque 65 en `docs/PLAN_TESTEO_MANUAL.md` + fila en el resumen, total
  recalculado sumando la columna.
- Este plan se borra en el mismo PR (paso 11: el plan muere al cierre).

## Auditoría del plan (paso 5)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| A | Sin alto fijo ni virtual scroll en ningún consumidor de la card (el diálogo del buscador tiene `min-height: 60vh`, que es piso) | Nada: confirma el plan |
| A | `inventario-item-card` trunca la descripción del producto con su propio `.titulo` | **Aplicado**: entra al alcance |
| A | `stock-sucursales-dialog` trunca `.nombre` | **Descartado**: es el nombre de la sucursal, no del producto |
| A | `transferencia-item-dialog`, `seleccionar-lote-dialog`, `buscador-lote-dialog` truncan | Fuera de alcance: truncan datos de lote, no la descripción |
| B | Sin estado persistido, foco ni ARIA afectados; rollback = revertir el commit; convivencia de versiones durante las 2 h de postergación es solo visual | Nada: confirma el plan |
| B | Con descripciones muy largas el thumb queda centrado contra un bloque alto | Se acepta: centrado es coherente con el chevron y el menú; se revisa en la prueba manual |
| B | Test por fuente frágil; propone medir `getBoundingClientRect().height` | **Mitad aplicado**: el test pasa a mirar el estilo computado. Medir altura se descarta: los tests corren en jsdom, que no hace layout y devuelve 0 siempre — ese test nunca fallaría |

## Ejes del ciclo que no aplican

- Migraciones / espejo filial: N/A para mobile-pwa porque no hay persistencia.
- Contrato GraphQL: N/A porque no cambia ninguna operación.
- Permisos / rolGuard: N/A porque no hay ruta nueva.
- Safari: CSS estándar (`overflow-wrap: anywhere` soportado desde Safari 15.4).

## Qué queda sin verificar

- iOS real (no hay iPhone en la flota): se cubre con Chrome en viewport móvil.
- Rendimiento de una lista con muchas filas de alto variable: no hay
  virtual scroll en el buscador (tandas de 10 + «Cargar más»), así que no
  hay supuesto de alto fijo que romper. Se verifica mirando el buscador.
