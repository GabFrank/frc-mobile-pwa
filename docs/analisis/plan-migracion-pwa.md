# Plan de migración a PWA

> Complementa [`migracion-pwa.md`](migracion-pwa.md), que es el análisis de viabilidad. Este documento es el **cómo**.
> Estado: **propuesta**. Ninguna fase iniciada.

## Principios de trabajo

1. **La documentación de `docs/` es la especificación.** Cada módulo a reconstruir tiene su doc con las reglas de negocio verificadas. Si el código nuevo contradice el doc, uno de los dos está mal — resolverlo antes de seguir.
2. **La capa de datos se copia, no se reescribe.** 22.767 LOC probados en producción. Reescribirlos es introducir bugs sin ganar nada.
3. **El diseño se define antes de programar UI.** Fase 1 termina con un gate de aprobación. Nadie escribe una pantalla real hasta que el catálogo esté aprobado.
4. **Componentes genéricos solo por regla de tres.** Ver §2.5.
5. **La app vieja sigue en producción** hasta que se cumpla la condición de apagado. Nada de cortes forzados.
6. **Cada ola termina en producción**, no en una rama. Una ola sin usuarios reales no está validada.

---

# FASE 0 — Infraestructura HTTPS

**Se puede empezar hoy. No depende de ninguna decisión sobre la PWA, y hay que hacerla igual por seguridad.**

## 0.1 Relevamiento previo

- [ ] Confirmar qué instancias del central deben quedar accesibles: bodega (8081), farmacia (8082), alpha (8083)
- [ ] Confirmar que el dominio de Cloudflare puede alojar subdominios nuevos
- [ ] Verificar si alguna filial o dispositivo depende de acceso directo por IP sin pasar por internet

## 0.2 Configuración

> **Runbook paso a paso: [`runbook-cloudflare.md`](runbook-cloudflare.md).**

- [ ] Reverse proxy delante del central (Caddy o nginx). **No tocar Spring Boot.**
- [ ] Instalar certificado **Cloudflare Origin CA** en el proxy (gratis, 15 años, sin renovación)
- [ ] SSL/TLS mode en Cloudflare: **Full (strict)**. Nunca Flexible — dejaría el tramo Cloudflare→origen en texto plano
- [ ] Subdominios apuntando al origen. **El reverse proxy rutea por nombre de host, así que no hacen falta Origin Rules:**

```
bodega.<dominio>    → :443 → 159.203.86.103:8081
farmacia.<dominio>  → :443 → 159.203.86.103:8082
alpha.<dominio>     → :443 → 159.203.86.103:8083
```

- [ ] Habilitar WebSockets en el proxy y en Cloudflare
- [ ] Configurar **keepalive/ping** en el servidor GraphQL: Cloudflare corta WebSockets inactivos (~100 s)

## 0.3 Validación

- [ ] `curl https://bodega.<dominio>/graphql` responde
- [ ] `wscat` contra `wss://bodega.<dominio>/subscriptions` conecta y **sobrevive 3 minutos sin tráfico**
- [ ] Cadena de certificados válida en Android e iOS (no solo en el navegador de escritorio)
- [ ] Latencia medida contra la actual desde una sucursal real

## 0.4 Aprovechar el cambio

- [ ] La app **actual** puede pasar a HTTPS también, sin esperar la PWA. Cierra la vulnerabilidad de credenciales en texto plano para la flota existente.

> **Gate 0:** no se avanza a Fase 2 sin HTTPS + WSS funcionando y validado en device. Fase 1 (diseño) puede correr en paralelo.

---

# FASE 1 — Sistema de diseño

**El corazón de este plan.** Termina con un catálogo aprobado y una galería navegable. **Ninguna pantalla real se programa antes del Gate 1.**

## 1.1 El problema medido

Inconsistencias reales del repo actual, contadas:

| Dimensión | Estado hoy |
|---|---|
| **Patrones de lista** | 4 conviviendo: `ion-list` (42 archivos), `ion-card` (38), `ion-grid` (18), `.card` propio (12) |
| **Botones** | `fill="clear"` ×68, `expand="block"` ×61, `fill="outline"` ×9, `fill="solid"` ×1 — más 6 colores distintos |
| **Sistemas de color de botón** | 2 en paralelo: `color="success"` de Ionic y `class="btn-success"` propio (98 usos) |
| **Escala de espaciado** | **14 valores distintos**: 2, 4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 40 px + `1rem` |
| **Radios de borde** | **8 valores distintos**: 4, 5%, 8, 10, 12, 16, 20 px, 50% |
| **Colores hardcodeados** | `#f44336` ×50, `#43a047` ×14, `#4caf50` ×7 — Material escrito a mano, fuera del tema |
| **Estados de carga** | 4 enfoques: `ion-spinner` (21), `CargandoService` (12), `isLoading` (6), `ion-skeleton-text` (2) |
| **Estados vacíos** | 8 mensajes distintos escritos a mano, sin componente común |

**Ninguna de estas decisiones fue tomada: se acumularon.** El objetivo de la Fase 1 es que en el repo nuevo cada una de ellas tenga exactamente una respuesta.

## 1.2 Tokens de diseño

Primer entregable. Un solo archivo, `_tokens.scss`, del que sale todo lo demás.

### Espaciado — escala de 4

```scss
--sp-1: 4px;    --sp-2: 8px;    --sp-3: 12px;
--sp-4: 16px;   --sp-6: 24px;   --sp-8: 32px;   --sp-12: 48px;
```

**Regla: ningún `.scss` de componente escribe un valor de espaciado literal.** Los 14 valores actuales colapsan a 7.

### Radios

```scss
--radius-sm: 8px;      // chips, inputs
--radius-md: 12px;     // cards, diálogos
--radius-full: 999px;  // avatares, FAB, pills
```

Tres valores. Los 8 actuales colapsan a estos.

### Color — semántico, nunca literal

```scss
// Marca
--brand: #db392e;           // rojo FRC (alineado con gourmet y desktop)
--brand-accent: #f57c00;

// Semántica de estado — el único vocabulario permitido
--ok / --warn / --danger / --info / --neutral

// Superficies y texto (light/dark)
--surface / --surface-variant / --card-bg
--text-primary / --text-secondary / --text-disabled
--border / --border-light
```

**Regla: cero hex literales fuera de `_tokens.scss`.** Un lint rule lo hace cumplir.

### Tipografía

```scss
--fs-display: 24px/600    // título de pantalla
--fs-title:   18px/600    // título de card o sección
--fs-body:    15px/400    // texto
--fs-label:   13px/500    // etiquetas de campo
--fs-caption: 12px/400    // metadatos, timestamps
--fs-mono:    15px/500    // importes y códigos ← tabular-nums
```

> **`--fs-mono` con `font-variant-numeric: tabular-nums` es requisito, no adorno:** en una lista de importes, las cifras tienen que alinearse verticalmente para poder compararlas de un vistazo.

### Elevación

```scss
--elev-0: none;                              // plano
--elev-1: 0 1px 3px var(--shadow-color);     // card
--elev-2: 0 4px 12px var(--shadow-color);    // diálogo, FAB
```

Tres niveles. Nada más.

### Tema claro/oscuro

Adoptar el esquema de gourmet (`theme-variables.scss`): variables CSS redefinidas bajo `body.dark-theme`, más `prefers-color-scheme` como default. **Ambos temas se definen en Fase 1, no se agrega el oscuro después.**

## 1.3 Catálogo de componentes

Segundo entregable. **Cada ítem se define visualmente —en Figma, en HTML estático o en la galería— y se aprueba antes de programar pantallas.**

### A. Estructura de pantalla

| # | Componente | Definir |
|---|---|---|
| A1 | **Shell** | Toolbar + navegación responsive: nav-rail en tablet, bottom-nav en teléfono (patrón gourmet). Qué entra en la navegación primaria y qué en el menú |
| A2 | **Encabezado de página** | Título, back, acciones. Altura y comportamiento al hacer scroll |
| A3 | **Página de lista** | Layout canónico: filtros → contenido → FAB |
| A4 | **Página de formulario** | Full-screen, toolbar con back + guardar (patrón gourmet) |
| A5 | **Página de detalle** | Encabezado con datos clave + secciones |

### B. Datos

| # | Componente | Definir |
|---|---|---|
| B1 | **Card de entidad** | **El más importante.** Un solo formato: thumbnail opcional, título, subtítulo, chip de estado, acción overflow. Reemplaza los 4 patrones de lista actuales |
| B2 | **Fila compacta** | Para listas densas (items de un pedido). Cuándo se usa en vez de B1 |
| B3 | **Chip de estado** | Ver §1.4 — el caso más claro de componente genérico necesario |
| B4 | **Importe** | Formato por moneda. **Guaraní sin decimales**, tabular-nums, alineado a la derecha |
| B5 | **Fecha/hora** | Formatos: relativo ("hace 2 h"), corto, completo. Cuál en qué contexto |
| B6 | **Par etiqueta-valor** | Unidad de los detalles |
| B7 | **Sección colapsable** | Reemplazo de `app-seccion-accordion` |

### C. Entrada

| # | Componente | Definir |
|---|---|---|
| C1 | **Campo de texto** | Estados: normal, foco, error, deshabilitado, con hint |
| C2 | **Campo de importe** | Máscara por moneda, teclado numérico, precisión según moneda |
| C3 | **Selector** | Reemplazo de `app-selector-generico`. Cuándo action-sheet, cuándo alert, cuándo popover |
| C4 | **Buscador de entidad** | Reemplazo de `app-buscador-modal`. Modo local y modo paginado con scroll infinito |
| C5 | **Selector de fecha** | Uno solo para toda la app |
| C6 | **Cantidad** | Con +/-, para conteos y recepción |
| C7 | **Captura de foto** | Preview, retomar, múltiples |

### D. Acciones

| # | Componente | Definir |
|---|---|---|
| D1 | **Botón** | **Solo 3 variantes**: primaria (llena), secundaria (contorno), terciaria (texto). Más tamaños sm/md/lg. Los 68 `fill="clear"` + 61 `expand="block"` colapsan acá |
| D2 | **Botón destructivo** | Variante propia de primaria/secundaria, no un color suelto |
| D3 | **FAB** | Posición, cuándo extendido, comportamiento al scrollear |
| D4 | **Menú overflow** | Acciones secundarias de una card |
| D5 | **Barra de acciones** | Fija al pie en formularios |

### E. Retroalimentación — **la deuda más grande**

| # | Componente | Definir |
|---|---|---|
| E1 | **Estado de carga** | **Uno solo.** Skeleton para listas, spinner para acciones puntuales. Cuál en qué caso |
| E2 | **Estado vacío** | Ícono + mensaje + acción sugerida. Reemplaza los 8 mensajes sueltos |
| E3 | **Estado de error** | Mensaje + reintentar |
| E4 | **Toast** | 4 tonos, duración fija por tono |
| E5 | **Diálogo de confirmación** | Uno solo, con variante destructiva |
| E6 | **Bottom sheet** | Reemplazo de popover/action-sheet |
| E7 | **Badge de contador** | Notificaciones, pendientes |

### F. Específicos del dominio

| # | Componente | Definir |
|---|---|---|
| F1 | **Escáner** | Pantalla completa con guía visual, linterna, entrada manual. Portado de gourmet |
| F2 | **Card de producto** | Aparece en 6 módulos. Con o sin precio, con o sin stock |
| F3 | **Paginación** | Reemplazo de `app-paginacion`. **Decidir: paginación numérica o scroll infinito** — hoy conviven ambos |
| F4 | **Indicador de conexión** | Estado del servidor en la toolbar |
| F5 | **Visor de PDF** | Un solo camino para recibos, remitos, constancias |

**Total: 33 componentes a definir antes de programar.**

## 1.4 Chip de estado — el caso claro

El sistema tiene **más de 20 máquinas de estado**: `PedidoEstado` (12 valores), `EtapaTransferencia` (9), `EstadoDevolucion` (8), `TransferenciaEstado` (8), `PdvCajaEstado` (6), `CompraEstado` (6), `PagoEstado` (5), `InventarioEstado` (3)…

Hoy cada pantalla decide su propio color, y por eso `#f44336` aparece 50 veces a mano.

**Propuesta: un registro central de estados.**

```ts
// estado-registry.ts
export const ESTADOS: Record<string, EstadoVisual> = {
  'EstadoDevolucion.PENDIENTE':  { label: 'Pendiente',  tono: 'warn',    icono: 'schedule' },
  'EstadoDevolucion.RETIRADO':   { label: 'Retirado',   tono: 'info',    icono: 'local_shipping' },
  'EstadoDevolucion.ACREDITADO': { label: 'Acreditado', tono: 'ok',      icono: 'check_circle' },
  'EstadoDevolucion.DESCARTADO': { label: 'Descartado', tono: 'danger',  icono: 'delete' },
  // …
};
```

```html
<frc-estado-chip [enum]="'EstadoDevolucion'" [valor]="devolucion.estado"></frc-estado-chip>
```

Ventajas:
- Un estado se ve igual en todas las pantallas
- Agregar un estado en el backend es una línea acá
- La traducción a etiqueta legible deja de duplicarse
- Resuelve de paso el problema de `PdvCajaEstado`, cuyas claves son etiquetas con espacios

> **Excepción documentada:** algunos módulos ya reciben `estadoEtiqueta`/`estadoColor`/`estadoIcono` **calculados por el backend** (`PreGasto` en solicitud-gastos). Ahí el chip debe **aceptar esos valores directamente** en vez de consultar el registro. Es el patrón correcto y hay que preservarlo.

## 1.5 Regla para crear componentes genéricos

El usuario pidió crear genéricos **solo si es necesario**. La regla:

> **Se crea un componente genérico cuando el mismo patrón visual aparece en 3 o más pantallas de módulos distintos, o cuando encapsula una regla de negocio que no debe duplicarse.**

Aplicando la regla al catálogo:

| Se crea genérico | Justificación |
|---|---|
| B1 card de entidad | Aparece en los 14 módulos |
| B3 chip de estado | >20 máquinas de estado |
| B4 importe | **Regla de negocio**: guaraní sin decimales. Duplicarla es garantizar divergencia |
| C2 campo de importe | Ídem |
| C3 selector, C4 buscador | Ya son genéricos hoy y funcionan |
| D1 botón | 3 variantes contra las ~10 combinaciones actuales |
| E1 carga, E2 vacío, E3 error | 4 enfoques y 8 mensajes hoy |
| E5 confirmación | Ya existe vía `DialogoService` |
| F1 escáner | Regla de negocio: candidatos de código, pesables |
| F3 paginación | Ya es genérico |
| F5 visor PDF | Ya es genérico |

| **No** se crea genérico | Por qué |
|---|---|
| Cards específicas por módulo | B1 con slots alcanza |
| Formularios por entidad | Cada uno tiene su forma; genéricos = configuración ilegible |
| Layouts por pantalla | A3/A4/A5 son plantillas, no componentes |

**11 componentes genéricos nuevos o portados. No más.**

## 1.6 Entregables y gate

- [ ] `_tokens.scss` completo, light + dark
- [ ] Los 33 componentes definidos visualmente
- [ ] **Galería navegable** (`/design-system`, solo en dev): cada componente con todas sus variantes y estados
- [ ] Documento `docs/design-system.md`: cuándo usar cada componente y cuándo no
- [ ] Lint rule que prohíbe hex literales y valores de espaciado sueltos fuera de `_tokens.scss`

> **Gate 1 — aprobación explícita del usuario sobre la galería.** Sin esto no arranca ninguna pantalla real. Es el punto del plan donde se corrige el problema de fondo: hoy las inconsistencias existen porque nadie definió esto antes de programar.

---

# FASE 2 — Esqueleto y capa de datos

## 2.1 Repo

- [ ] Repo nuevo `GabFrank/frc-mobile-pwa`
- [ ] Angular (última LTS) + Angular Material + componentes standalone
- [ ] `@angular/pwa`: service worker + manifest
- [ ] Mismo modelo de ramas y `semantic-release` que los otros repos (ver skill `frc-cicd`)
- [ ] Copiar `docs/` completo del repo actual — es la especificación

## 2.2 Capa de datos — copiar, no reescribir

| Qué | Archivos | LOC | Cómo |
|---|---|---|---|
| `graphql/` (documentos y clases GQL) | 296 | 11.568 | **Verbatim** |
| `domains/` (modelos, enums) | 65+ | 2.912 | **Verbatim** |
| `generic/utils/` | 5 | 515 | **Verbatim** |
| Servicios sin APIs nativas | ~71 | ~6.500 | Verbatim |
| Servicios con APIs nativas | 8 | ~1.200 | Reimplementar (§2.4) |

## 2.3 Arreglar los 🔴 al copiar

**Momento barato, ya diagnosticados en `TODO_TECNICO.md`:**

- [ ] **#1** `onGetByFecha` — fecha por defecto de 1970 (`getDay()` en vez de `getDate()`)
- [ ] **#2** Observables que no completan ni propagan errores — rediseñar `GenericCrudService` de una vez, ahora que no hay 60 pantallas dependiendo del comportamiento actual
- [ ] **#4** `logOut()` guardando el string `"null"` → `removeItem`
- [ ] **#3** Update forzado — **desaparece solo** con el service worker
- [ ] **#52** Modelos faciales desde CDN → servirlos desde el propio origen
- [ ] **#26** `totalRs; number;` en `Conteo` — campo de dinero sin tipar
- [ ] **#38** `pais.model.ts` vacío en `domains/`

> **La convención del alias `data:` se mantiene.** Cambiarla obligaría a tocar los 296 archivos GraphQL. Se documenta y se agrega un test que falle si una operación no la respeta.

## 2.4 Reimplementar las 8 capacidades de dispositivo

Cada una detrás de su interfaz actual, para que las pantallas no cambien:

| Servicio | Reemplazo | Riesgo |
|---|---|---|
| `BarcodeScannerService` | `BarcodeDetector` + ZXing + manual (**portar de gourmet**) | 🟢 validado |
| `CamaraService` | `getUserMedia` | 🟢 |
| `PdfViewerService` | Blob URL | 🟢 se simplifica |
| `PushNotificationsService` | Web Push (firebase-js-sdk) | 🟡 |
| `FaceRecognitionService` | Igual, con modelos locales | 🟢 ya es web |
| `GeoLocationService` | `watchPosition` + promediado en JS | 🔴 recalibrar umbral |
| `FingerprintAuthService` | WebAuthn | 🔴 cambia el endpoint |
| `ChannelService`, update | **Se eliminan** | 🟢 |

## 2.5 Auth y shell

- [ ] Login contra `https://<subdominio>/login`
- [ ] Selección de instancia por subdominio (adiós IPs hardcodeadas)
- [ ] Apollo con `https://` + `wss://`. **Resolver la URI en runtime**, no en carga de módulo — así cambiar de servidor deja de exigir reload
- [ ] Shell con nav-rail/bottom-nav según el diseño aprobado
- [ ] Service worker: estrategia de caché explícita, versionado, aviso de "hay versión nueva"

> **Gate 2:** login + una pantalla trivial funcionando en un celular real, instalada como PWA, contra el central de alpha.

---

# FASE 3+ — Olas de módulos

**Orden por riesgo creciente.** Cada ola llega a producción antes de empezar la siguiente.

### Ola A — Sin dependencia nativa (~10.000 LOC)

`caja` · `conteo` · `moneda` · `maletin` · `caja-info` · `solicitud-pago` · `pago` · `mis-rrhh` · `mis-finanzas` · `home`

**Por qué primero:** cero APIs de dispositivo, uso diario, y ejercita el catálogo completo (listas, formularios, importes, chips de estado, PDFs). Si el sistema de diseño tiene huecos, aparecen acá.

**Empezar por `caja`:** de uso diario, valida la infra con usuarios reales rápido, y su regla crítica —el balance lo calcula el backend— hace que no haya lógica de negocio riesgosa que portar.

### Ola B — Listas y formularios grandes (~8.400 LOC)

`inventario` · `transferencias`

Escaneo puntual. Volumen alto, riesgo bajo. Valida el catálogo a escala.

### Ola C — Cámara intensiva (~11.200 LOC)

`producto` · `operaciones/pedidos` · `operaciones/devolucion` · `operaciones/solicitud-gastos`

El escáner en uso real y sostenido. Modo kiosco de `mostrar-precio` — **mejora respecto de hoy**.

### Ola D — Lo difícil (~3.000 LOC)

`marcacion` · `venta-tarjeta` · `informaciones-personales` · `notificaciones`

Requiere trabajo previo de backend:
- [ ] **OCR de cupones en el servidor** (la imagen ya se sube)
- [ ] **Endpoint WebAuthn** (challenge/response)
- [ ] **Web Push** en lugar de FCM nativo
- [ ] **Modelos faciales servidos desde el origen**

Y en campo:
- [ ] **Recalibrar el umbral de GPS** con mediciones reales en sucursal

### Ola E — Cierre

`personas` · `funcionario` · `codigo` · `configuracion` · resto

---

# FASE 5 — Convivencia y apagado

## Durante la convivencia

- Repo actual **congelado**: solo hotfixes. Ninguna feature nueva — habría que hacerla dos veces
- Cambios de backend que sirvan a ambos, o con sufijo distinto para no romper la app vieja
- **Condición de apagado escrita antes de empezar la Fase 3.** Propuesta:

> *Se deja de publicar el APK cuando las olas A-D estén en producción, con 4 semanas sin incidentes bloqueantes y con ≥80% de los usuarios activos usando la PWA.*

## Apagado

- [ ] Dejar de publicar en Play Store (la app instalada sigue funcionando)
- [ ] Aviso in-app en la versión vieja apuntando a la PWA
- [ ] Repo actual a archivado
- [ ] Retirar la ficha de Play Store cuando el uso llegue a cero
- [ ] **Reubicar keystore y `.pepk`** — cierra el TODO pendiente del workspace

---

# Definición de "listo" por módulo

Un módulo no está terminado hasta que:

- [ ] Todas sus pantallas usan **solo** componentes del catálogo
- [ ] Cero hex literales y cero valores de espaciado sueltos (lo verifica el lint)
- [ ] Estados de carga, vacío y error implementados en **todas** las listas
- [ ] Las reglas de negocio del doc de `docs/modulos/` están respetadas y verificadas a mano
- [ ] Funciona en Android Chrome y en iOS Safari
- [ ] Probado en un dispositivo real de sucursal, no solo en escritorio
- [ ] El doc del módulo actualizado si algo cambió
- [ ] En producción, con usuarios reales

---

# Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| **La Fase 1 se estira** | Timeboxear. Si un componente no se define, va con la versión de gourmet y se ajusta después |
| **El diseño se degrada al implementar** | El lint y la revisión de PR contra el catálogo. Un PR que agrega un color literal no se mergea |
| **GPS impreciso invalida marcaciones** | Medir en campo **antes** de la Ola D. Umbral configurable desde el backend |
| **La migración se estanca** | Condición de apagado escrita antes de empezar; cada ola en producción |
| **Divergencia entre las dos apps** | Repo viejo congelado. Sin excepciones |
| **Se necesita una feature urgente durante la migración** | Decidir caso por caso: si el módulo ya migró, va solo en la PWA |
| **iOS sin push si no instalan la PWA** | Instructivo de instalación + banner; medir adopción |

---

# Lo que NO se migra

- `android/`, `capacitor.config.ts`, Gradle, keystore, `.pepk`
- `app-update/` (código muerto), `pages/venta/` (vacío), archivos `" copy"`
- `ChannelService` y el opt-in de Play Store
- `@ionic-native/*` y `@awesome-cordova-plugins/*` — con ellos se va `--legacy-peer-deps`
- `pages/financiero/` y `pages/general/` como carpetas de páginas: sus modelos van a `domains/`
- Los 59 ítems del `TODO_TECNICO.md` que sean código muerto

---

# Primeros tres pasos concretos

1. **Cloudflare** (Fase 0). No depende de nada más y arregla una vulnerabilidad abierta desde abril.
2. **Tokens + los 10 componentes más usados** (A1, A3, B1, B3, B4, D1, E1, E2, E3, C1) en una galería. Es el 80% del uso real.
3. **Gate 1 con el usuario**: revisar la galería, ajustar, aprobar. Recién ahí empieza la Ola A.
