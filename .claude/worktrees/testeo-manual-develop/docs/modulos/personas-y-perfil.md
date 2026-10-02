# funcionario, personas, informaciones-personales y codigo

Cuatro módulos chicos relacionados con personas y datos personales: **`funcionario`** (550 LOC), **`informaciones-personales`** (477), **`personas`** (403) y **`codigo`** (204).

---

# funcionario — pre-registro

**Ubicación:** `src/app/pages/funcionario/`
**Ruta:** `/pre-registro`

## Qué resuelve

**Alta preliminar de un aspirante a funcionario.** No crea un empleado en el sistema: junta sus datos para que RRHH complete el proceso después. De ahí el nombre "pre-registro".

## Modelo — `PreRegistroFuncionario`

| Grupo | Campos |
|---|---|
| Identidad | `nombreCompleto`, `apodo`, `documento`, `fechaNacimiento` |
| Contacto | `telefonoPersonal`, `email`, `ciudad`, `direccion` |
| **Emergencia** | `telefonoEmergencia`, `nombreContactoEmergencia` |
| Laboral | `sucursal`, `fechaIngreso`, `habilidades`, `nivelEducacion`, `registroConducir` |
| Otros | `observacion`, `creadoEn` |

> ⚠️ **Gotcha — `registroConducir` está tipado `Boolean`** (mayúscula, el objeto wrapper) en vez de `boolean`. No rompe nada pero es incorrecto en TypeScript.

> **Nota — `apodo` es un campo de negocio real**, no decorativo: en el ambiente de sucursal el personal se identifica por apodo, y aparece en varias pantallas.

## Servicio y GraphQL

`FuncionarioService` sobre: `savePreRegistroFuncionario`, `deletePreRegistroFuncionario`, `preRegistroFuncionarioById`, `preRegistroFuncionarioSearch`, `preRegistroFuncionariosQuery`.

> ⚠️ **`FuncionarioModule` se importa eager en `AppModule`** (`app.module.ts:125`) además de estar declarado lazy en el router. Ver ítem 7 del [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

---

# informaciones-personales — perfil del usuario

**Ubicación:** `src/app/pages/informaciones-personales/`
**Ruta base:** `/informaciones-personales`

## Rutas

| Ruta | Componente |
|---|---|
| `''` | `InformacionesPersonalesDashboardComponent` |
| `huella-digital` | `HuellaDigitalComponent` |

**`CapturaPerfilFacialComponent` no tiene ruta**: se abre como modal desde el dashboard (`informaciones-personales-dashboard.component.ts:58`).

Ambas pantallas se alcanzan desde el acordeón "Mi cuenta" del menú lateral.

## Qué resuelve

Configuración de las **credenciales biométricas del usuario**:

- **`HuellaDigitalComponent`** — registro de huella. Alimenta el login biométrico (`LoginService.biometricLogin`), que está atado al **dispositivo**: el backend asocia `idDispositivo` con un usuario. Ver [`../arquitectura/autenticacion-sesion.md`](../arquitectura/autenticacion-sesion.md).
- **`CapturaPerfilFacialComponent`** — captura del rostro para la galería facial usada en [marcación](marcacion.md).

> **Regla clave — huella y rostro sirven para cosas distintas.** La huella autentica **al usuario contra la app** (login). El rostro identifica **a la persona en la marcación** (control de asistencia). No son intercambiables: un usuario puede tener una y no la otra.

> ⚠️ **Gotcha — la captura facial exige calidad mínima.** Solo entran a la galería las capturas con score ≥ `SCORE_MINIMO_GALERIA` (0.7). Una captura rechazada no es un error de la app: es la protección contra envenenar la galería con imágenes malas, que después harían fallar la marcación.

---

# personas — proveedor y vendedor

**Ubicación:** `src/app/pages/personas/`
**Sin rutas propias.** Es una capa de modelo y servicio.

## Contenido

| Entidad | Archivos |
|---|---|
| `Proveedor` | modelo, servicio, 5 operaciones GraphQL |
| `Vendedor` | solo modelo |

`ProveedorService` expone: `proveedorById`, `proveedorPorPersona`, `proveedorSearchByPersona`, `proveedorSearchByPersonaPage`, `saveProveedor`.

## Quién lo consume

`Proveedor` es transversal: lo usan [`operaciones/pedidos`](operaciones-pedidos.md), [`operaciones/devolucion`](operaciones-devolucion.md), [`operaciones/solicitud-pago`](operaciones-pagos-y-varios.md) y [`operaciones/solicitud-gastos`](operaciones-solicitud-gastos.md).

> ⚠️ **Gotcha — un proveedor es una `Persona` con rol de proveedor.** Por eso las búsquedas se llaman `porPersona`: se busca la persona y se resuelve su proveedor. Buscar directo por id de proveedor cuando tenés un id de persona no funciona.

> ⚠️ **Gotcha — `proveedorSearchByPersonaPage` está duplicado.** Existe acá y en `solicitud-gastos/graphql/`. Ver ítem 33 del [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

> ⚠️ **`Vendedor` tiene modelo pero ningún servicio ni query.** Parece una entidad preparada y nunca terminada. Verificá antes de usarla.

---

# codigo — códigos de barra

**Ubicación:** `src/app/pages/codigo/`
**Sin rutas propias.**

## Qué resuelve

ABM de los **códigos de barra asociados a una presentación** de producto.

`CodigoService` sobre: `codigoPorCodigo`, `codigoPorPresentacionId`, `saveCodigo`, `deleteCodigo`.

> **Regla clave — el código pertenece a la presentación, no al producto.** Un producto con "unidad" y "caja x12" tiene códigos distintos para cada una. Por eso la query es `codigoPorPresentacionId`. Esto es lo que permite que escanear resuelva simultáneamente producto, presentación, precio y cantidad. Ver [`producto.md`](producto.md) y [`../infraestructura/generic-utils.md`](../infraestructura/generic-utils.md).

> ⚠️ **Gotcha — `codigoPorCodigo` busca el código exacto.** No aplica la normalización ni la lista de candidatos de `codigosParaBuscar`. Para resolver un escaneo usá `ProductoBusquedaService`; `codigoPorCodigo` es para ABM, donde el valor ya es exacto.
