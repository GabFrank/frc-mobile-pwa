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
| **[`PATRONES.md`](PATRONES.md)** | **Cómo se escribe el código de este repo**: forma de una pantalla, estado con señales, servicios, errores, pruebas. El compañero del sistema de diseño |
| [`REGLAS_DESARROLLO.md`](REGLAS_DESARROLLO.md) | Regla crítica para modificar el backend `central` sin romper el desktop |
| [`TODO_TECNICO.md`](TODO_TECNICO.md) | Los 61 hallazgos: los defectos de `frc-mobile`, cuáles ya están resueltos acá, y los propios de este repo |
| [`PLAN_TESTEO_MANUAL.md`](PLAN_TESTEO_MANUAL.md) | **328 casos de prueba manual** para validar lo implementado, con el estado de ejecución de cada bloque |
| [`analisis/`](analisis/) | Investigación y plan de la migración a PWA |
| [`design-system.md`](design-system.md) | **Sistema de diseño de este repo** |
| [`design-system/`](design-system/) | Galería y pantallas aprobadas en el Gate 1 |

## Por dónde empezar

1. [`PATRONES.md`](PATRONES.md) — **la forma que ya tiene el código.** Antes de escribir una pantalla nueva
2. [`arquitectura/vision-general.md`](arquitectura/vision-general.md) — qué es la app, stack real, estructura de carpetas
3. [`arquitectura/capa-de-datos.md`](arquitectura/capa-de-datos.md) — **la convención más importante del repo**: el alias `data:`
4. [`arquitectura/configuracion-servidor.md`](arquitectura/configuracion-servidor.md) — cómo la app decide contra qué servidor hablar
5. [`REGLAS_DESARROLLO.md`](REGLAS_DESARROLLO.md) — antes de tocar el backend

## Índice de arquitectura

| Documento | Tema |
|---|---|
| [vision-general.md](arquitectura/vision-general.md) | Stack, versiones reales, estructura, convenciones de idioma |
| [routing-navegacion.md](arquitectura/routing-navegacion.md) | Rutas raíz, lazy loading, menú lateral, módulos eager |
| **[capa-de-datos.md](arquitectura/capa-de-datos.md)** | **Vigente.** Shim de Apollo, `DatosService`, alias `data:` |
| [apollo-graphql.md](arquitectura/apollo-graphql.md) | Histórico: cómo era en `frc-mobile` |
| [autenticacion-sesion.md](arquitectura/autenticacion-sesion.md) | Login REST, token, biometría, `InicioSesion`, logout |
| [configuracion-servidor.md](arquitectura/configuracion-servidor.md) | `serverIp`/`serverPort`, `conectionConfig.ts`, cambio de servidor |
| **[escaner.md](arquitectura/escaner.md)** | **Vigente.** Lectura de códigos con la cámara: `BarcodeDetector`, ZXing para iOS, carga manual, linterna |
| **[pdf.md](arquitectura/pdf.md)** | **Vigente.** Abrir PDFs en base64, con un camino por plataforma |
| [capacitor-nativo.md](arquitectura/capacitor-nativo.md) | Histórico: Capacitor 7, plugins, permisos, `cap sync` |
| [actualizaciones-app.md](arquitectura/actualizaciones-app.md) | Cómo se actualiza la app realmente (Play Store in-app update) y canales |
| [ui-ionic.md](arquitectura/ui-ionic.md) | Convenciones de UI: servicios wrapper, colores, ciclo de vida Ionic, formularios |
| **[web-push.md](arquitectura/web-push.md)** | **Vigente.** Avisos con la app cerrada: token de FCM, la sesión del dispositivo, y a qué pantalla lleva cada notificación |

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
