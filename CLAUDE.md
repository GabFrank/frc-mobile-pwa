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

## Dónde corre

La app se sirve desde **Cloudflare Pages**, un proyecto por canal, y habla con
el central por HTTPS. **El backend por defecto sale del hostname**, no del
build: una sola compilación sirve todas las puertas.

| Canal | Puerta | API por defecto |
|---|---|---|
| alpha | `alpha.app.frcsuite.com` — detrás de **Cloudflare Access** | `alpha-api.frcsuite.com` → `mauro`, por túnel |
| beta | `beta.app.frcsuite.com` | `farmacia-api.frcsuite.com` |
| prod | `farmacia.app.frcsuite.com` · `bodega.app.frcsuite.com` | `farmacia-api` · `bodega-api` |

> ⚠️ **El alpha del central vive en `mauro`, no en `159.203.86.103`.** En esa VM
> había una instancia vieja en el puerto 8083 que se apagó el 2026-08-14. Si
> algún documento todavía manda ahí, está viejo.

El plan completo del pipeline —canales, aprobaciones, caché del service worker y
los gotchas— está en `frc-cicd/plan-cicd-mobile-pwa.md`.

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
| `docs/TODO_TECNICO.md` | 61 hallazgos — **qué NO repetir** |

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

Implementado: capa de datos completa (~450 archivos portados), sistema de diseño, autenticación con «recordar usuario» y «mantenerme conectado», shell responsivo, **módulo de caja completo** (lista, detalle, apertura y cierre con arqueo), **«Mi trabajo»** (autoservicio de RRHH: marcación, vales, recibos, vacaciones y solicitudes), **«Mis finanzas»** (compras a crédito por convenio), **escáner de códigos** (`BarcodeDetector` + ZXing para Safari) **búsqueda de productos** por texto, código y balanza, con card expandible y stock por sucursal, **devoluciones** (carga, historial y separado) **venta con tarjeta** (registro del cupón por escaneo) **marcación** con validación de ubicación **notificaciones** con hilo de comentarios y preferencias, **caja chica** (consulta y retiro con QR) **transferencias** (lista, detalle con las cuatro etapas y **el avance de etapa completo hasta recepción concluida**, con la verificación ítem por ítem) e **inventario** (resumen del conteo y finalización), **recepción de mercadería** (abrir con las notas del proveedor, verificar producto por producto **con su número de lote, vencimiento y fecha de retiro**, deshacer, finalizar y reabrir), **solicitud de pago a proveedor** (lista, alta desde el menú o desde una recepción finalizada, envío a la cola de pagos, detalle y constancia en PDF), galería viva en `/design-system`.

Sumado en la tanda de paridad con `frc-mobile`: **crédito por convenio en Inicio**, **escáner universal** en un botón flotante que lee cualquier código y decide el destino, **configuración dentro de la app** (servidor, tema con sus tres estados, datos de la persona), **badge de no leídas**, **productos vencidos**, **modo kiosco** de consulta de precios, **ficha de producto**, **rendición de caja chica** con fotos, y **carga del conteo** de inventario.

Sumado en la segunda tanda de paridad: **revisión del supervisor** y **control de inventario**, **lugares del depósito** (sectores y zonas), **configuración del kiosco** (lector o cámara), **registro del rostro y marcación facial**, **compartir por QR** —incluido **mandarlo por WhatsApp**, con la hoja del sistema y la imagen adjunta, como hacía `frc-mobile` con `@capacitor/share`—, **instalar la PWA** y **notificaciones push** con su destino por pantalla.

Sumado en la tercera: **abrir una toma de inventario** (`/inventario/nuevo`, con rol `CREAR INVENTARIO` y el chequeo de toma abierta que `frc-mobile` tiene escrito y nunca ejecuta), **agregar zonas a la toma** desde el detalle —creando la zona y su sector al paso si faltan—, y **sumar un producto al conteo** con el buscador de siempre: descripción, código, cámara y códigos de balanza. El **vencimiento viene sugerido** de lo que el central conoce —compra, transferencia o el último inventario, con el ranking que ya resuelve `productosVencidos`—, y el detalle **avisa si hay transferencias sin recibir** en esa sucursal, que es lo que produce diferencias que no son diferencias. Con eso el ciclo entero —abrir, definir el alcance, contar, finalizar— ocurre en el teléfono.

Sumado en la cuarta: **crear una transferencia** (`/transferencias/nueva`, con rol `CREAR TRANSFERENCIA` — el que `frc-mobile` declara y nunca usa) y **cargarle los productos** en `/transferencias/:id/borrador`, con el buscador mostrando **las dos existencias**, la de origen y la de destino, que es el modo que el componente ya soportaba y no usaba nadie. El borrador vive en el central desde el primer paso —el input de la cabecera no acepta ítems anidados— y cada ítem se guarda al agregarlo, así que una carga de cuarenta renglones no se pierde si el service worker se actualiza en el medio. Con eso el documento **nace** en el teléfono y sigue por las etapas que ya estaban. Sumado después: **de qué lote sale cada renglón**, elegido a mano al cargarlo, con el saldo por lote que el central convierte a la presentación con la que carga el operador. Es opcional —sin elegir, el desglose sigue saliendo por FEFO, que es lo que hicieron siempre todos los clientes— y **no necesita promover el central**: `lotesAsignados` está desde `v4.7.0-beta.2` y `v4.8.0`, así que farmacia y bodega ya lo tienen.

Sumado en la quinta: de **caja chica**, el **alta** de la solicitud
(`/operaciones/gastos/nueva`, sin guard de rol) — el formulario más grande
del módulo: responsable de solo lectura, beneficiario, tipo de gasto, activo
imputado con su buscador paginado y la tarjeta de resumen financiero,
detalle financiero multi-moneda y los datos del retiro. Con esto,
`frc-buscador` en modo **paginado** tiene su primer consumidor real fuera de
la galería del sistema de diseño, y sus primeros tests — antes un fallo de
red en ese modo se presentaba igual que «Sin resultados».

Sumado en la sexta: de **producto**, la **edición** (`/producto/:id/editar`,
rol `EDITAR PRODUCTOS`) — un hub con una fila por sección (datos generales,
familia/subfamilia, presentaciones, códigos y precios), cada una con su
propia pantalla que guarda al confirmar. **Códigos y precios cuelgan de la
presentación**, no del producto, así que se editan desde ahí; la sección de
**precios** pide además `EDITAR PRECIOS`, con su propio guard de ruta, y solo
escribe en la sucursal de la sesión. La regla que gobierna todo el módulo:
`saveProducto` **reemplaza el registro entero**, no lo parchea
(`ProductoService.java:297-325`), así que la pantalla siempre manda un
`ProductoInput` completo —hidratado y con solo los campos tocados
cambiados— aunque el formulario visible edite un subconjunto; sin eso,
corregir una descripción apagaría en silencio el control de vencimiento y
lote del producto, con la mutation respondiendo OK. Ver
[`docs/modulos/producto.md`](docs/modulos/producto.md), sección «La edición».
**Es la primera entrega de este repo que no depende de promover el
central** — todas las mutations y queries ya existían en el schema.

Pendiente: de **inventario**, arrastrar el conteo de una toma anterior; de **producto**, el **alta** con rol `EDITAR PRODUCTOS` — la edición ya está; y el **transporte WebSocket** para suscripciones.

La lista operativa de esto, escrita para que nadie lo reporte como falla durante una prueba, está en «Qué no está implementado todavía» de [`docs/PLAN_TESTEO_MANUAL.md`](docs/PLAN_TESTEO_MANUAL.md).

**`pago` no se porta, y es una decisión.** En `frc-mobile` es código muerto —`PagoService` declarado y nunca inyectado— y el pago real es tesorería de escritorio: cuotas, cajas con clave compuesta y autorización por un segundo usuario. En la PWA solo se **lee** el pago asociado a una solicitud. Ver [`docs/modulos/operaciones-pagos-y-varios.md`](docs/modulos/operaciones-pagos-y-varios.md).

**La app instalada se actualiza sola, con permiso.** El service worker consulta al arrancar y cada 30 minutos; cuando hay versión nueva, un diálogo ofrece aplicarla o postergarla, y en «Mi cuenta → Aplicación» están la versión instalada y el botón para actualizar a mano. Esto **no venía gratis**: el testeo en un Android real encontró que con la estrategia de registro por defecto el service worker nunca adoptaba una versión y la app no se actualizaba jamás. Ver [`docs/arquitectura/actualizaciones-app.md`](docs/arquitectura/actualizaciones-app.md).

**Falta el test manual de apertura y cierre de caja** — bloque 7 del plan. Es lo único implementado de la primera tanda que no se ejecutó contra el central real, porque la apertura se proxea a la filial.

⚠️ **La ficha de producto necesita un central con `stockPorSucursales`.** Verificado el 2026-08-15: **alpha ya la tiene** desde `4.7.0-alpha.40`, así que ahí la existencia se puede probar de verdad. **Beta y producción todavía no** —farmacia corre `4.7.0-beta.2` y bodega `4.8.0`, y la consulta solo está en `develop` del central—, así que ahí la sección dice «No se pudo consultar» hasta que el central se promueva. Lo que no puede pasar en ningún caso es que muestre las sucursales en cero: eso afirmaría que no hay mercadería.

⚠️ **Crear un lote desde el conteo necesita un central con `crearLoteProducto`.** La mutation se llamaba `crearLote` y ese nombre ya lo ocupaba SIFEN —el lote de documentos electrónicos, sin argumentos—; GraphQL fusiona los `extend type Mutation` por nombre de campo, así que ganaba el de SIFEN, el central arrancaba sin quejarse y la app recibía `Unknown field argument productoId @ 'crearLote'`. Se renombró en las dos mitades el 2026-08-27 y **se publican juntas**: contra un central sin el renombre, «Crear nuevo lote» falla. El central tiene ahora un test que hace fallar el CI si dos archivos declaran el mismo campo con firmas distintas.

⚠️ **El número de lote en la recepción necesita un central con la migración `V202.5`** y con `verificarProductoMobile` extendido. Contra un central viejo la mutation falla porque no conoce los argumentos `lote`, `vencimientoRecibido` y `fechaRetiro`: **la verificación de productos deja de funcionar entera**, no solo para los que llevan lote. Las dos mitades se publican juntas. Ver [`docs/modulos/operaciones-pedidos.md`](docs/modulos/operaciones-pedidos.md).

⚠️ **Avanzar de etapa una transferencia exige un central con `desconfirmarTransferenciaItem`** — commit `8f29003f` del central, presente desde `v4.7.0-alpha.42`, `v4.8.0-beta.3` y `v4.10.0`. **No alcanza con que la mutation falte:** ese mismo commit convirtió `saveTransferenciaItem` en un PATCH que preserva los campos ausentes. Contra un central anterior el save es un **reemplazo completo**, así que un input que trae solo los campos de la etapa en curso **borra las otras tres** — y las cuatro cifras por etapa son justamente lo que el módulo existe para conservar. El daño es silencioso: la operación responde OK.

Al 2026-08-15, farmacia corría `4.7.0-beta.2` y bodega `4.8.0`: **ninguna de las dos lo tiene**. Antes de publicar la PWA en esas puertas hay que promover el central. Alpha sí lo tiene. Las dos mitades se publican juntas.

⚠️ **La solicitud de pago exige un central con la migración `V194.5`.** Al crearla, la pantalla la envía a la cola de pagos con el estado `SOLICITADO`; contra un central que no lo tenga, ese paso falla y la solicitud queda como borrador —que es justamente el documento que nadie ve—. Antes de publicar hay que confirmar que la instancia de destino tiene la migración **y** que el flujo `PENDIENTE → SOLICITADO` está liberado en el central, no solo en el árbol de trabajo de alguien.

Verificación: **88 archivos de test, 1.067 tests**, cero errores de tipos, AOT en verde, y pasadas manuales contra el central real (ver el estado de ejecución en el plan de testeo).

⚠️ **`cantidad` es lo contado y `cantidadFisica` lo que dice el sistema**, al revés de lo que sugieren los nombres y de lo que `docs/modulos/inventario.md` afirmó hasta ahora. Lo fija `finalizarInventarioEnSucursal()` en el central, que suma `cantidad`. La app las tuvo al derecho y la consecuencia era muda: lo contado desde el teléfono no entraba en el ajuste de stock. Corregido con test; ver el hallazgo #60 de [`docs/TODO_TECNICO.md`](docs/TODO_TECNICO.md).

⚠️ **Las notificaciones push necesitan las dos mitades.** El cliente acuña un token de FCM —no una suscripción cruda— y lo ata al `idDispositivo` de **su** sesión; sin esa fila, el central escribe el token en la primera sesión abierta del usuario, que puede ser la de otro aparato. Y el destino del aviso viaja **dentro** del `notification`, no en el `data` del mensaje, o tocarlo no abre nada. Ver [`docs/arquitectura/web-push.md`](docs/arquitectura/web-push.md).

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
