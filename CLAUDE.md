# CLAUDE.md — frc-comercial/mobile-pwa

Guía para trabajar en este repositorio.

## Qué es

**PWA que reemplaza a `frc-mobile`** (la app Android empaquetada con Capacitor). Cliente web del ERP **Franco Systems**, marca comercial **Bodega Franco**.

- **Repo:** `GabFrank/frc-mobile-pwa` — **privado**
- **Reemplaza a:** `GabFrank/frc-mobile` (público, en modo mantenimiento durante la transición)
- **Backend:** `frc-comercial/central` vía GraphQL. **Nunca `frc-efact`.**

## Stack

| Capa | Versión |
|---|---|
| Angular | **21** (standalone, zoneless) |
| Angular Material | 21 |
| Apollo Client | 4 · `apollo-angular` 14 |
| Service Worker | `@angular/service-worker` 21 |
| Node | 20.20 |

> **No hay Ionic ni Capacitor.** Este repo es web puro. Si algo necesita una capacidad de dispositivo, se resuelve con una API del navegador detrás de un servicio en `core/`.

## Comandos

```bash
npm start          # ng serve → http://localhost:4300
npm run build      # build de producción — el gate real
npm test           # tests unitarios
```

> Los tres corren antes `scripts/sello-version.mjs`, que genera
> `src/app/core/sello-version.ts` con la versión, la fecha y el commit. Es un
> archivo **generado y en `.gitignore`**: si falta, es porque nunca se compiló
> en esa copia del repo. Ver [`docs/arquitectura/actualizaciones-app.md`](docs/arquitectura/actualizaciones-app.md).

> ⚠️ **`npm run build` y `npm test` matan al `npm start` que esté corriendo** (SIGTERM, salida 143): comparten `.angular/cache` y la salida de compilación. El síntoma engaña —la pantalla del navegador deja de responder y parece un bug de la app—, así que si estás probando a mano, terminá la prueba antes de compilar, o contá con relevantar el serve. Si el navegador se cuelga de golpe, chequeá primero que el 4300 siga vivo.

> **`localhost` es contexto seguro.** Cámara, geolocalización y service worker funcionan en desarrollo sin HTTPS. Para probar en un celular Android por USB: `adb reverse tcp:4300 tcp:4300`, y el teléfono lo ve como `localhost` — con las mismas APIs habilitadas.
>
> Si además la app tiene que hablar con un central local, hace falta el segundo túnel: `adb reverse tcp:8081 tcp:8081`. Sin eso el teléfono resuelve `localhost:8081` contra sí mismo y no hay backend.

## Documentación

**`docs/` es la especificación**, portada del repo anterior. Antes de reconstruir un módulo, leé su documento: contiene las reglas de negocio verificadas contra el código en producción.

| Ruta | Contenido |
|---|---|
| `docs/README.md` | Índice maestro |
| `docs/arquitectura/` | Apollo, auth, servidor, UI, actualizaciones |
| `docs/infraestructura/` | Servicios, utils, modelos, componentes |
| `docs/modulos/` | Un documento por módulo funcional |
| `docs/design-system/` | **Galería y pantallas aprobadas (Gate 1)** |
| `docs/analisis/` | Plan de migración y runbook de Cloudflare |
| `docs/TODO_TECNICO.md` | 59 hallazgos del repo anterior — **qué NO repetir** |

## Reglas del proyecto

### 1 · El alias `data:` en GraphQL

Toda operación aliasea su campo raíz a `data`. Es la convención heredada de los 296 documentos GraphQL que se portan verbatim.

```graphql
query ($id: Int) {
  data: miOperacion(id: $id) { id }
}
```

Sin el alias, el resultado llega `undefined` **sin error ni log**.

### 2 · Cero valores literales fuera de los tokens

`src/styles/_tokens.scss` es el único archivo que puede contener un hex, un valor de espaciado o un radio. Todo lo demás usa `var(--sp-4)`, `var(--brand)`, `var(--radius-md)`.

Esto existe porque el repo anterior acumuló 14 valores de espaciado, 8 radios y `#f44336` hardcodeado 50 veces.

**Relleno y texto son tokens distintos.** `--brand-fill` es el fondo de un botón y siempre lleva etiqueta blanca (`--on-tono`); `--brand-text` es el rojo para íconos y texto sobre la superficie, que en tema oscuro tiene que ser claro. Confundirlos da botones desteñidos o íconos ilegibles. Lo mismo para los cinco tonos semánticos.

### 3 · Componentes genéricos por regla de tres

Un componente se vuelve genérico cuando aparece en **3 o más pantallas de módulos distintos**, o cuando **encapsula una regla de negocio** que no debe duplicarse — como el importe en guaraníes, que no lleva decimales.

Fuera de eso, no. Las cards por módulo, los formularios por entidad y los layouts de pantalla se resuelven con los genéricos existentes.

### 4 · Ningún módulo está listo sin sus tres estados

Carga, vacío y error. Es parte de la definición de terminado, no una mejora posterior.

### 4.1 · Ni sin su guía de prueba manual

Toda implementación termina con **dos entregas**, las dos:

1. Un bloque numerado en [`docs/PLAN_TESTEO_MANUAL.md`](docs/PLAN_TESTEO_MANUAL.md), con «Esperado» por caso, y la tabla de totales actualizada.
2. **Los pasos escritos en la respuesta**, no un link al archivo.

Haber validado en Chrome no reemplaza esto. Esa validación corre contra un estado de datos puntual, no puede tocar diálogos del navegador —permisos de cámara, descargas—, no usa el teléfono real y no conoce el flujo operativo.

Marcar siempre **qué quedó sin verificar**: eso es justamente lo que hay que probar a mano.

### 5 · Antes de tocar el backend, verificá si lo usa el desktop

Si lo usa, se crea un método paralelo con sufijo `Mobile`. El desktop es producto en producción en farmacias y bodegas. Ver `docs/REGLAS_DESARROLLO.md`.

### 5.1 · Antes de portar una pantalla, leé cómo la hace `frc-mobile`

Los documentos de `docs/modulos/` son buenos pero **no cubren todo**. Si algo del repo viejo parece un error, verificalo antes de «corregirlo»: suele codificar una regla del negocio que no está escrita en ningún lado.

Dos cosas que costó aprender así:

- **No existe «entrar a una sucursal».** La app está **siempre conectada al central**. La sucursal del usuario viene de `inicioSesion.sucursal` y sirve como valor por defecto; las pantallas que necesitan una la **seleccionan**.
- **Qué sucursal puede operar lo dice `deposito`.** Con depósito mueve stock; sin depósito es virtual —`SERVIDOR` y `COMPRAS`— y no participa de devoluciones, inventarios ni transferencias. Se filtra con `soloOperables()` / `esSucursalOperable()`, que además exigen `activo`. `frc-mobile` las descarta por nombre en seis pantallas; filtrar por `deposito` deja afuera sola a cualquier virtual nueva. Ver [`docs/infraestructura/domains-modelos.md`](docs/infraestructura/domains-modelos.md).

### 6 · El dinero lo calcula el backend

Balances de caja, diferencias de arqueo, distribución de cantidades entre notas de recepción. El cliente muestra, no calcula.

### 7 · iOS es un objetivo, no un caso futuro

**Soportar iPhone es uno de los motivos de esta migración.** La APK no podía darlo; la PWA sí. Que hoy no haya un solo iPhone en la flota no cambia nada: es la razón por la que el repo existe.

En la práctica, toda capacidad de dispositivo necesita su camino en **Safari**, no solo en Chromium:

| Capacidad | Chromium | Safari / iOS |
|---|---|---|
| Lectura de códigos | `BarcodeDetector` | **ZXing** por `import()` dinámico |
| Cámara | `getUserMedia` | `getUserMedia` + `playsinline` y `muted` obligatorios en el `<video>` |
| Notificaciones push | Web Push | Solo con la PWA **instalada** (iOS 16.4+) |
| Instalación | Prompt del navegador | Solo desde «Compartir → Añadir a inicio»; no hay prompt |

Lo que se carga solo para Safari va en un **chunk aparte**: el peso no lo paga Android. Es la diferencia entre «no lo agrego porque pesa» y «lo agrego donde no cuesta».

> ⚠️ Ya pasó una vez: el escáner se escribió sin fallback «porque hoy no hay iOS». Eso invierte el orden — el soporte de iOS es el requisito, no una consecuencia de tener usuarios de iOS.

## Estructura

```
src/
├── app/
│   ├── core/              # config de servidor, auth, capacidades de dispositivo
│   ├── shared/            # componentes del sistema de diseño
│   ├── domains/           # modelos y enums (portados verbatim)
│   ├── graphql/           # operaciones compartidas (portadas verbatim)
│   └── pages/             # módulos funcionales
├── styles/
│   └── _tokens.scss       # ← único archivo con valores literales
└── environments/
```

## Estado

**Fase 2 del plan de migración, con la Ola A cerrada.**

Implementado: capa de datos completa (~450 archivos portados), sistema de diseño, autenticación con «recordar usuario» y «mantenerme conectado», shell responsivo, **módulo de caja completo** (lista, detalle, apertura y cierre con arqueo), **«Mi trabajo»** (autoservicio de RRHH: marcación, vales, recibos, vacaciones y solicitudes), **«Mis finanzas»** (compras a crédito por convenio), **escáner de códigos** (`BarcodeDetector` + ZXing para Safari) **búsqueda de productos** por texto, código y balanza, con card expandible y stock por sucursal, **devoluciones** (carga, historial y separado) **venta con tarjeta** (registro del cupón por escaneo) **marcación** con validación de ubicación **notificaciones** con hilo de comentarios y preferencias, **caja chica** (consulta y retiro con QR) **transferencias** (lista y detalle con las cuatro etapas) e **inventario** (resumen del conteo y finalización), **recepción de mercadería** (abrir con las notas del proveedor, verificar producto por producto, deshacer, finalizar y reabrir), **solicitud de pago a proveedor** (lista, alta desde el menú o desde una recepción finalizada, envío a la cola de pagos, detalle y constancia en PDF), galería viva en `/design-system`.

Pendiente, por partes —las olas B a D están empezadas, no intactas—: de **inventario**, la carga del conteo y las zonas; de **caja chica**, el alta y la rendición; **producto**, su detalle, su edición y el modo kiosco; el módulo de **pedidos**; el **reconocimiento facial**; **Web Push** en lugar de FCM; el **transporte WebSocket** para suscripciones; y la Ola E entera (`personas`, `funcionario`, `codigo`, `configuracion`).

La lista operativa de esto, escrita para que nadie lo reporte como falla durante una prueba, está en «Qué no está implementado todavía» de [`docs/PLAN_TESTEO_MANUAL.md`](docs/PLAN_TESTEO_MANUAL.md).

**`pago` no se porta, y es una decisión.** En `frc-mobile` es código muerto —`PagoService` declarado y nunca inyectado— y el pago real es tesorería de escritorio: cuotas, cajas con clave compuesta y autorización por un segundo usuario. En la PWA solo se **lee** el pago asociado a una solicitud. Ver [`docs/modulos/operaciones-pagos-y-varios.md`](docs/modulos/operaciones-pagos-y-varios.md).

**La app instalada se actualiza sola, con permiso.** El service worker consulta al arrancar y cada 30 minutos; cuando hay versión nueva, un diálogo ofrece aplicarla o postergarla, y en «Mi cuenta → Aplicación» están la versión instalada y el botón para actualizar a mano. Esto **no venía gratis**: el testeo en un Android real encontró que con la estrategia de registro por defecto el service worker nunca adoptaba una versión y la app no se actualizaba jamás. Ver [`docs/arquitectura/actualizaciones-app.md`](docs/arquitectura/actualizaciones-app.md).

**Falta el test manual de apertura y cierre de caja** — bloque 7 del plan. Es lo único implementado que no se ejecutó contra el central real, porque la apertura se proxea a la filial.

⚠️ **La solicitud de pago exige un central con la migración `V194.5`.** Al crearla, la pantalla la envía a la cola de pagos con el estado `SOLICITADO`; contra un central que no lo tenga, ese paso falla y la solicitud queda como borrador —que es justamente el documento que nadie ve—. Antes de publicar hay que confirmar que la instancia de destino tiene la migración **y** que el flujo `PENDIENTE → SOLICITADO` está liberado en el central, no solo en el árbol de trabajo de alguien.

Verificación: **468 tests**, cero errores de tipos, AOT en verde, y pasadas manuales contra el central real (ver el estado de ejecución en el plan de testeo).

Antes de probar a mano: [`docs/PLAN_TESTEO_MANUAL.md`](docs/PLAN_TESTEO_MANUAL.md).

Ver `docs/analisis/plan-migracion-pwa.md` para el plan completo.

## Lo que nunca se hace

1. Escribir un color o espaciado literal fuera de `_tokens.scss`
2. Commitear secretos — este repo es privado, pero una clave commiteada hay que rotarla igual
3. Agregar Capacitor o Ionic
4. Calcular dinero en el cliente
5. Push directo a `master` o `develop` — siempre vía PR
6. Dar por terminado un módulo sin sus estados de carga, vacío y error
7. Escribir un token `--mdc-*`: Material 21 renombró toda esa familia a `--mat-*` y los nombres viejos **fallan en silencio** — la regla se aplica, la variable queda definida y el componente sigue con su valor por defecto. Hay un test que lo impide
8. Escribir un backtick dentro de `template:` o `styles:` de un componente: rompe el literal y el error que sale no señala la causa
9. Dejar una capacidad de dispositivo sin camino en Safari «porque hoy no hay iOS» — ver la regla 7
