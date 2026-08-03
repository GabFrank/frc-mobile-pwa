# Documentación — frc-mobile

Documentación técnica del repo `GabFrank/frc-mobile` (`frc-app`, marca comercial **Bodega Franco**), app móvil Android/iOS del ERP **Franco Systems**.

Esta carpeta es la **fuente de verdad** de cómo funciona el repo. Vive junto al código y se versiona con él: si cambiás comportamiento, actualizá el `.md` en el mismo PR.

## Cómo está organizado

| Carpeta | Qué contiene |
|---|---|
| [`arquitectura/`](arquitectura/) | Cómo está armada la app: stack, ruteo, Apollo, autenticación, configuración de servidor, capa nativa, actualizaciones |
| [`infraestructura/`](infraestructura/) | Código transversal que usan todos los módulos: servicios, utilidades, modelos de dominio, componentes reutilizables |
| [`modulos/`](modulos/) | Un documento por módulo funcional: reglas de negocio, rutas, páginas, servicios y operaciones GraphQL |
| [`manuales-refactor/`](manuales-refactor/) | Histórico de refactors puntuales. No es documentación viva |
| [`REGLAS_DESARROLLO.md`](REGLAS_DESARROLLO.md) | Regla crítica para modificar el backend `central` sin romper el desktop |
| [`TODO_TECNICO.md`](TODO_TECNICO.md) | Irregularidades detectadas al documentar, pendientes de corrección |
| [`analisis/`](analisis/) | Documentos de investigación para decisiones técnicas |

## Por dónde empezar

1. [`arquitectura/vision-general.md`](arquitectura/vision-general.md) — qué es la app, stack real, estructura de carpetas
2. [`arquitectura/apollo-graphql.md`](arquitectura/apollo-graphql.md) — **la convención más importante del repo**: el alias `data:` y `GenericCrudService`
3. [`arquitectura/configuracion-servidor.md`](arquitectura/configuracion-servidor.md) — cómo la app decide contra qué servidor hablar, y por qué cambiarlo exige recargar
4. [`REGLAS_DESARROLLO.md`](REGLAS_DESARROLLO.md) — antes de tocar el backend

## Índice de arquitectura

| Documento | Tema |
|---|---|
| [vision-general.md](arquitectura/vision-general.md) | Stack, versiones reales, estructura, convenciones de idioma |
| [routing-navegacion.md](arquitectura/routing-navegacion.md) | Rutas raíz, lazy loading, menú lateral, módulos eager |
| [apollo-graphql.md](arquitectura/apollo-graphql.md) | Setup Apollo HTTP+WS, alias `data:`, `GenericCrudService`, política de caché |
| [autenticacion-sesion.md](arquitectura/autenticacion-sesion.md) | Login REST, token, biometría, `InicioSesion`, logout |
| [configuracion-servidor.md](arquitectura/configuracion-servidor.md) | `serverIp`/`serverPort`, `conectionConfig.ts`, cambio de servidor |
| [capacitor-nativo.md](arquitectura/capacitor-nativo.md) | Capacitor 7, plugins, permisos, `cap sync` |
| [actualizaciones-app.md](arquitectura/actualizaciones-app.md) | Cómo se actualiza la app realmente (Play Store in-app update) y canales |
| [ui-ionic.md](arquitectura/ui-ionic.md) | Convenciones de UI: servicios wrapper, colores, ciclo de vida Ionic, formularios |

## Índice de infraestructura

| Documento | Tema |
|---|---|
| [services.md](infraestructura/services.md) | Catálogo de `src/app/services/` con API pública |
| [generic-utils.md](infraestructura/generic-utils.md) | `src/app/generic/utils/` — helpers de códigos de barra, números, fechas, QR |
| [domains-modelos.md](infraestructura/domains-modelos.md) | Modelos de dominio, patrón `toInput()`, enums |
| [components-dialogos.md](infraestructura/components-dialogos.md) | Componentes reutilizables y diálogos globales |

## Índice de módulos

Ver [`modulos/README.md`](modulos/README.md).

## Convenciones de esta documentación

- **Idioma:** español (igual que el dominio del producto).
- **Todo lo afirmado está verificado contra el código**, con referencia `archivo:línea` cuando el detalle es puntual.
- Los problemas conocidos se marcan como **⚠️ Gotcha** (comportamiento contraintuitivo que hay que respetar) o **🐛 Bug conocido** (defecto real, no imitar).
- No se documentan helpers privados triviales. Sí se documenta toda función pública, regla de negocio y efecto colateral no obvio.
