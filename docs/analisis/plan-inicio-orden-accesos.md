# Plan · Orden de los accesos rápidos de Inicio

Pedido de Franco (2026-11-03): que los primeros accesos rápidos de Inicio sean
Marcación, Transferencias, Inventario, Mis finanzas, Caja y Operaciones.

## Alcance

Solo el orden del arreglo `TODOS` de `src/app/pages/inicio/inicio.page.ts`. El
filtro por rol (`accesos`) no cambia: un usuario sin el rol de Transferencias,
Inventario o Caja simplemente no ve ese botón y el siguiente sube un lugar.

Orden nuevo (los seis primeros son los pedidos; el resto conserva el orden
relativo que ya tenía):

| # | Acceso | Rol |
|---|---|---|
| 1 | Marcación | — |
| 2 | Transferencias | `PERMISOS.transferencias` |
| 3 | Inventario | `PERMISOS.inventario` |
| 4 | Mis finanzas | — |
| 5 | Caja | `PERMISOS.caja` |
| 6 | Operaciones | — |
| 7 | Buscar producto | — |
| 8 | Productos vencidos | — |
| 9 | Consultar precio | — |
| 10 | Control inventario | `PERMISOS.inventario` |
| 11 | Lugares del depósito | `PERMISOS.lugares` |
| 12 | Notificaciones | — (con contador) |
| 13 | Kiosco de marcación | `PERMISOS.kioscoMarcacion` |
| 14 | Mi trabajo | — |
| 15 | Mi cuenta | — |

## Fases

**Fase 1** (única) — reordenar `TODOS`, sin tocar etiquetas, rutas, íconos ni
roles. Tests en `src/app/pruebas/sesion-y-roles.spec.ts`, con `toEqual` sobre
`slice(0, 6)` / `slice(0, 3)` (un `toContain` no fija orden):

- `ADMIN` (está en caja, inventario y transferencias): los seis pedidos, en orden.
- usuario con `['OTRO']`: Marcación, Mis finanzas, Operaciones.

Bloque nuevo en `docs/PLAN_TESTEO_MANUAL.md` con el orden esperado, aparte del
1.2 (que no habla de orden y no se toca).

## Auditoría del plan (paso 5)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| A · propagación | `TODOS` solo se usa en Inicio; `track` es por ruta; la grilla `auto-fill` no usa posiciones; los tests actuales usan `toContain` | nada que cambiar |
| A · propagación | un test con `toContain` no fijaría el orden | tests con `toEqual` sobre el corte |
| B · reversibilidad | nada persiste el orden; el service worker muestra la versión vieja o la nueva, no mezcla; se revierte con un `git revert` | nada que cambiar |
| B · reversibilidad | falta fijar el orden para un usuario sin roles | segundo caso de test con `['OTRO']` |

## Datos nuevos

N/A: no nace ningún campo, columna ni clave.

## Migraciones, central, réplica

N/A para central, filial, desktop y mobile: el orden vive solo en el cliente PWA.

## Verificación

- `npm test` y `npm run build` (el gate real).
- Por pantalla: `npm start`, entrar con un usuario con todos los roles (orden
  completo) y con uno sin roles (Marcación, Mis finanzas, Operaciones primeros).

## Sin verificar

Cómo se ve en un iPhone real: no hay uno en la flota; se mira en el emulador
de Chrome con ancho de teléfono.
