# Plan — espaciado lateral de los diálogos, global

Rama: `fix/inventario-dialogo-crear-lote-espaciado` (desde `develop` @
`6497c46`). Pieza: **mobile-pwa**, sola. Pedido de Franco (2026-09-22): el
diálogo «Crear nuevo lote» no tiene espacio a los costados; mejor que sea un
ajuste global.

## Qué pasa hoy

Medido en el navegador: en «Crear nuevo lote», `.mat-mdc-dialog-surface` y la
`.caja` del componente tienen **padding 0**, y el contenido toca el borde. No
hay ningún estilo global de diálogos en `styles.scss` salvo el del escáner.

Los diálogos que usan `mat-dialog-content` (14) reciben de Material su padding
lateral. Los que arman su propia `.caja` sin él (9) no tienen ninguno:

| Diálogo | Archivo |
|---|---|
| Crear lote | `pages/inventario/crear-lote-dialog.component.ts` |
| Buscar lote | `pages/inventario/buscador-lote-dialog.component.ts` |
| Zona | `pages/inventario/zona-dialog.component.ts` |
| Lugar | `pages/inventario/lugar-dialog.component.ts` |
| Seleccionar lote | `pages/transferencias/seleccionar-lote-dialog.component.ts` |
| Configuración del kiosco | `pages/producto/kiosco-config-dialog.component.ts` |
| QR | `shared/qr/qr-dialog.component.ts` |
| Escáner | `core/dispositivo/escaner-dialog.component.ts` — pantalla completa, a propósito |
| Verificación facial | `pages/marcacion/verificacion-facial-dialog.component.ts` |

## Cambio

Una regla global en `styles.scss`, junto a la del escáner:

```scss
.cdk-overlay-pane:not(.frc-escaner-panel)
  .mat-mdc-dialog-surface:not(:has(.mat-mdc-dialog-content)) {
  padding: var(--sp-3);
}
```

- **Solo a los que no usan `mat-dialog-content`**: los 14 que lo usan lo
  tienen siempre en la raíz de la plantilla (sin `@if`), así que `:has` los
  excluye siempre y no reciben el doble.
- **El escáner queda afuera por el selector**, no por el orden: su
  `panelClass` (`escaner.service.ts:55`) queda en el `.cdk-overlay-pane`, y
  las dos reglas tienen la misma especificidad. Sin la exclusión, el video a
  pantalla completa quedaba con dos franjas negras de 12 px (eje A y B).
- `--sp-3` (12 px) y no 10 px: la regla 2 del repo no admite literales fuera
  de `_tokens.scss`. Decisión de Franco.
- **Los cuatro lados** (medido: arriba, abajo y a los costados el contenido
  está a 0 px del borde). Confirmado por Franco, aunque lo pedido fueron
  los costados.
- Ninguno de los 9 tiene margen propio en su contenedor (auditado uno por
  uno): nada queda duplicado. El `padding` de las `.opcion` de las listas y el
  `.marco` del QR son internos y siguen igual.
- El surface es `box-sizing: border-box` con `max-width: inherit`: el padding
  no agranda el diálogo más allá de 420 px / 95 vw. Las listas se achican
  24 px, sin scroll horizontal. El QR (264 px) entra en 320 px; en 280 px
  (Galaxy Fold) aparece scroll horizontal: caso marginal, anotado.
- `:has()` lo conserva el build (ya se usa en `acciones:has(>div:empty)`);
  Chrome 105+ y Safari 15.4+. Sin soporte, la regla no se aplica: como hoy.
- Se corrige el comentario de `styles.scss:224` («la superficie trae
  padding»), que ya no es cierto en Material 21.
- `docs/design-system.md` («Avisos y diálogos») suma una línea: un diálogo con
  caja propia recibe el margen de `styles.scss`; no agregar padding en la caja.

## Tests

El entorno de tests es jsdom y **no carga `styles.scss`** (solo se inyecta en
modo navegador), y el soporte de `:has()` en jsdom es parcial. Un test con
`getComputedStyle` fallaría por el motivo equivocado. En su lugar: un test que
lee `styles.scss` y verifica que la regla existe, usa `--sp-3`, excluye el
escáner y se limita a los diálogos sin `mat-dialog-content`. La verificación
visual va en el navegador (medición del padding en crear lote, un diálogo con
`mat-dialog-content` sin cambios, y el escáner sin franjas).

## Datos nuevos

Ninguno.

## Sin verificar

Teléfono real e iOS.

## Auditoría del plan (paso 5)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| A y B | El selector del plan no excluía el escáner (misma especificidad; franjas negras) | Exclusión por `.cdk-overlay-pane:not(.frc-escaner-panel)` |
| A | Ninguno de los 9 tiene margen propio; los 14 con content lo tienen siempre en la raíz | Sin duplicados |
| B | El surface no crece: `border-box` + `max-width: inherit`; QR con scroll en 280 px | Anotado |
| B | vitest corre en jsdom sin `styles.scss` | Test sobre el texto de la hoja; verificación visual en navegador |
| A | Arriba y abajo también a 0 px | Los cuatro lados, confirmado por Franco |

## Auditoría del diff (paso 8)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| Fijo 1 y 2 | Solo estilos y docs; los diálogos sensibles solo ganan margen | Sin acción |
| Fijo 1 | ¿El recorte del rostro depende del ancho del video? | No: `drawImage` usa las medidas de la imagen (`core/dispositivo/imagen.ts:43`) |
| Fijo 2 | Choque con el PR #56 en la tabla del plan de testeo (bloques 70 y 71, total 628 vs 625) | Al mergear el segundo: bloque 70 antes que 71, **total 631** |
| Fijo 3 | Los 5 `dialog.open` directos usan `mat-dialog-content`; el escáner queda excluido | Sin acción |
| Fijo 3 | En el runner, `import.meta.glob(…?raw)` devuelve los `.scss` vacíos: `tokens-de-material.spec.ts` nunca revisó `styles.scss` ni `_tokens.scss` (los `.ts` sí: 578 archivos con contenido, verificado) | Fuera de alcance; el test nuevo lee con `node:fs`. Anotado para Franco |
