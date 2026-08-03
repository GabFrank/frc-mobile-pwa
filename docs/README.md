# Documentación — frc-mobile-pwa

Documentación técnica de la **PWA** que reemplaza a `frc-mobile`.

> **Cómo leer esta carpeta.** Hay dos clases de documento acá:
>
> - **Los de este repo** describen la implementación actual: [`arquitectura/capa-de-datos.md`](arquitectura/capa-de-datos.md), [`design-system.md`](design-system.md), [`arquitectura/autenticacion-sesion.md`](arquitectura/autenticacion-sesion.md).
> - **Los portados de `frc-mobile`** describen el sistema anterior y siguen siendo la **especificación de las reglas de negocio** a reconstruir: todo `modulos/`, `REGLAS_DESARROLLO.md`, `TODO_TECNICO.md`. Las reglas de negocio valen; los detalles de implementación (Ionic, Capacitor, `GenericCrudService`) ya no.
>
> Cada documento portado que describa implementación vieja lleva un aviso al inicio.

## Cómo está organizado

| Carpeta | Qué contiene |
|---|---|
| [`arquitectura/`](arquitectura/) | Cómo está armada la app: stack, ruteo, Apollo, autenticación, configuración de servidor, capa nativa, actualizaciones |
| [`infraestructura/`](infraestructura/) | Código transversal que usan todos los módulos: servicios, utilidades, modelos de dominio, componentes reutilizables |
| [`modulos/`](modulos/) | Un documento por módulo funcional: reglas de negocio, rutas, páginas, servicios y operaciones GraphQL |
| [`manuales-refactor/`](manuales-refactor/) | Histórico de refactors puntuales. No es documentación viva |
| [`REGLAS_DESARROLLO.md`](REGLAS_DESARROLLO.md) | Regla crítica para modificar el backend `central` sin romper el desktop |
| [`TODO_TECNICO.md`](TODO_TECNICO.md) | Los 59 defectos de `frc-mobile`, con cuáles ya están resueltos acá |
| [`PLAN_TESTEO_MANUAL.md`](PLAN_TESTEO_MANUAL.md) | **40 casos de prueba manual** para validar lo implementado |
| [`analisis/`](analisis/) | Investigación y plan de la migración a PWA |
| [`design-system.md`](design-system.md) | **Sistema de diseño de este repo** |
| [`design-system/`](design-system/) | Galería y pantallas aprobadas en el Gate 1 |

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
| **[capa-de-datos.md](arquitectura/capa-de-datos.md)** | **Vigente.** Shim de Apollo, `DatosService`, alias `data:` |
| [apollo-graphql.md](arquitectura/apollo-graphql.md) | Histórico: cómo era en `frc-mobile` |
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
