# Módulos funcionales

Un documento por módulo. Cada uno cubre: propósito y reglas de negocio, rutas, páginas y componentes, servicios con su API pública, operaciones GraphQL contra el backend, modelos propios y gotchas.

## Estado de la documentación

**Cobertura completa.** Todos los módulos de `pages/` están documentados.


| Módulo | Ubicación | LOC aprox. | Doc |
|---|---|---|---|
| **operaciones** | `pages/operaciones/` | 17.663 | ✅ 6 docs |
| ├ pedidos (Recepción de Mercaderías) | `operaciones/pedidos/` | 5.025 | ✅ [operaciones-pedidos.md](operaciones-pedidos.md) |
| ├ solicitud-gastos | `operaciones/solicitud-gastos/` | 3.515 | ✅ [operaciones-solicitud-gastos.md](operaciones-solicitud-gastos.md) |
| ├ devolucion | `operaciones/devolucion/` | 2.667 | ✅ [operaciones-devolucion.md](operaciones-devolucion.md) |
| ├ caja | `operaciones/caja/` | 1.483 | ✅ [operaciones-caja.md](operaciones-caja.md) |
| ├ venta-tarjeta | `operaciones/venta-tarjeta/` | 1.265 | ✅ [operaciones-venta-tarjeta.md](operaciones-venta-tarjeta.md) |
| ├ conteo | `operaciones/conteo/` | 1.018 | ✅ en [operaciones-caja.md](operaciones-caja.md) |
| ├ solicitud-pago | `operaciones/solicitud-pago/` | 934 | ✅ [operaciones-pagos-y-varios.md](operaciones-pagos-y-varios.md) |
| ├ moneda | `operaciones/moneda/` | 481 | ✅ en [operaciones-caja.md](operaciones-caja.md) |
| ├ pago | `operaciones/pago/` | 330 | ✅ en [operaciones-pagos-y-varios.md](operaciones-pagos-y-varios.md) |
| ├ maletin | `operaciones/maletin/` | 325 | ✅ en [operaciones-caja.md](operaciones-caja.md) |
| ├ movimiento-stock | `operaciones/movimiento-stock/` | 250 | ✅ en [operaciones-pagos-y-varios.md](operaciones-pagos-y-varios.md) |
| ├ caja-info | `operaciones/caja-info/` | 221 | ✅ en [operaciones-caja.md](operaciones-caja.md) |
| └ list-operaciones | `operaciones/list-operaciones/` | 38 | ✅ en [operaciones-pagos-y-varios.md](operaciones-pagos-y-varios.md) |
| **inventario** | `pages/inventario/` | 4.229 | ✅ [inventario.md](inventario.md) |
| **transferencias** | `pages/transferencias/` | 4.166 | ✅ [transferencias.md](transferencias.md) |
| **producto** | `pages/producto/` | 3.233 | ✅ [producto.md](producto.md) |
| **notificaciones** | `pages/notificaciones/` | 1.792 | ✅ [notificaciones.md](notificaciones.md) |
| **marcacion** | `pages/marcacion/` | 1.763 | ✅ [marcacion.md](marcacion.md) |
| **funcionario** | `pages/funcionario/` | 550 | ✅ [personas-y-perfil.md](personas-y-perfil.md) |
| **informaciones-personales** | `pages/informaciones-personales/` | 477 | ✅ [personas-y-perfil.md](personas-y-perfil.md) |
| **personas** | `pages/personas/` | 403 | ✅ [personas-y-perfil.md](personas-y-perfil.md) |
| **mis-finanzas** | `pages/mis-finanzas/` | 310 | ✅ [mis-rrhh-y-finanzas.md](mis-rrhh-y-finanzas.md) |
| **home** | `pages/home/` | 251 | ✅ [home-y-configuracion.md](home-y-configuracion.md) |
| **mis-rrhh** | `pages/mis-rrhh/` | 236 | ✅ [mis-rrhh-y-finanzas.md](mis-rrhh-y-finanzas.md) |
| **codigo** | `pages/codigo/` | 204 | ✅ [personas-y-perfil.md](personas-y-perfil.md) |
| **configuracion** | `pages/configuracion/` | 68 | ✅ [home-y-configuracion.md](home-y-configuracion.md) |
| **financiero** | `pages/financiero/` | 27 | ✅ [mis-rrhh-y-finanzas.md](mis-rrhh-y-finanzas.md) |
| **salir** | `pages/salir/` | 38 | ✅ [home-y-configuracion.md](home-y-configuracion.md) |
| **general** | `pages/general/` | 8 | ✅ [home-y-configuracion.md](home-y-configuracion.md) |
| **venta** | `pages/venta/` | 0 | ✅ carpeta vacía — ver [home-y-configuracion.md](home-y-configuracion.md) |

## Antes de leer un módulo

Estos tres documentos aplican a **todos** los módulos y no se repiten en cada uno:

1. [`../arquitectura/apollo-graphql.md`](../arquitectura/apollo-graphql.md) — el alias `data:` y `GenericCrudService`
2. [`../infraestructura/services.md`](../infraestructura/services.md) — servicios transversales
3. [`../infraestructura/domains-modelos.md`](../infraestructura/domains-modelos.md) — patrón modelo/input/`toInput()`
