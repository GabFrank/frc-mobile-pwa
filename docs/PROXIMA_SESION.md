# Dónde retomar

> **Al 2026-08-14.** Rama `feat/paridad-mobile-android`, PR **#2** abierta
> contra `feature/solicitud-pago`. Todo commiteado y pusheado.
>
> Este archivo es un **traspaso, no una hoja de ruta**: dice qué quedó a medio
> camino y con qué hay que tener cuidado. Cuando las PR se cierren y los
> bloques nuevos se corran, borralo — un traspaso viejo miente más que un
> archivo que no existe.

## Lo que se hizo

Una tanda de **paridad con `frc-mobile`**: crédito por convenio en Inicio,
escáner universal en un botón flotante, configuración dentro de la app, badge
de no leídas, productos vencidos, modo kiosco, ficha de producto, rendición de
caja chica e ingreso del conteo de inventario. Detalle en la PR #2.

Cuatro defectos que aparecieron portando, con su arreglo: el QR de retiro de
caja chica que **no se podía escanear nunca**, el nacimiento en 1970, el
`Number('')` que navegaba a `/inventario/0` y el kiosco robándole el foco al
diálogo del escáner.

## Las dos PR están encadenadas

**La #1 (`feature/solicitud-pago` → `develop`) sigue abierta y sin revisar.**
La #2 sale de esa rama a propósito, para que su diff muestre solo la tanda
nueva. Al mergear la #1, GitHub reapunta la #2 a `develop` sola.

**Mergear en orden: primero la #1.** Al revés no se puede.

## Lo que falta, en orden

### 1 · Correr los bloques 22 a 29 del plan de testeo

55 casos nuevos. Contra alpha ya corrieron el ruteo del escáner, el kiosco con
un código real, vencidos y la ficha. **Sin correr, y son los que más importan:**

| Bloque | Qué necesita |
|---|---|
| 28 · Rendición de caja chica | Una solicitud **autorizada y ya retirada**, con la rendición pendiente |
| 29 · Carga del conteo | Un inventario **abierto** con productos cargados |
| 26.3 y 26.7 · Kiosco | Un lector HID físico. Es donde el modo se rompe sin que nadie lo note |
| 23.9 · Escáner en iPhone | Un iPhone |

### 2 · Lo que no se portó

| Qué | Tamaño |
|---|---|
| **Alta de solicitud de caja chica** | El formulario más grande que queda: tipo de gasto, activo imputado con su buscador paginado por tipo, beneficiario persona o proveedor, y detalle financiero con una moneda por fila sin repetir |
| **Inventario: zonas y sectores** | Y agregar a la toma un producto que no estaba: necesita `saveInventarioProducto`, que no está portado |
| **Producto: edición y alta** | Rol `NUEVO-PRODUCTO` |
| **Web Push** en lugar de FCM | Necesita backend. En iOS solo con la PWA instalada (16.4+) |
| **Transporte WebSocket** | Para suscripciones GraphQL |
| **Reconocimiento facial** | Los modelos hoy salen de un CDN — ver TODO_TECNICO #52 |

### 3 · Los dos cambios que necesita el central

Ninguno se puede hacer desde este repo, y los dos tocan al desktop, así que
van con sufijo `Mobile` (regla 5).

- **`productosVencidos` no acepta orden** y pagina con `ORDER BY vencimiento
  DESC`: para el teléfono, lo menos urgente queda arriba. Mitigado acotando la
  ventana desde el cliente, pero es una mitigación.
- **El precio convertido para el kiosco.** Sin eso, el selector de moneda no
  se puede portar sin calcular dinero en el cliente.

## Cosas que van a morder si no se saben

**Alpha está más viejo que esta rama.** No tiene `stockPorSucursales`, así que
la ficha de producto dice «No se pudo consultar» en la existencia — es lo
esperado, no un fallo. Para probar eso hace falta un central local o esperar a
que alpha reciba el cambio.

**El central espera `Authorization: Token <t>`, no `Bearer`.** Cuesta media
hora si se prueba una query a mano contra el backend y devuelve 401.

**Las fotos de la rendición viajan como data URI dentro de la mutation.** No
hay endpoint de subida: el central guarda la cadena tal cual. Por eso la
pantalla reduce la imagen antes de codificarla; si alguien saca esa reducción,
un request se vuelve de varios megabytes.

**`npm run build` y `npm test` matan al `npm start`.** Ya está en el
[CLAUDE.md](../CLAUDE.md); se repite porque cuesta media hora la primera vez.

**El build es el gate real, no `tsc --noEmit`.** `tsc` no typechequea las
plantillas: un `p.ciudad.nombre` inexistente pasa limpio y lo caza el AOT.

## Deudas que dejó esta tanda

- **Los bloques 22 a 29 están escritos y sin correr.** 55 casos.
- **`frc-buscador-producto` no distingue las acciones que declara el
  llamador**: todas emiten `seleccion` con el producto y nada más. Hoy no lo
  usa nadie, pero el primero que pase dos acciones se va a encontrar con esto.
  Por eso «Ver ficha» se agregó como acción propia del buscador.
- **Sigue sin versionado.** `package.json` en `0.0.0` y la app muestra la fecha
  de compilación con la aclaración «(sin versionar)».
