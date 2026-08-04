# Plan de testeo manual

Para validar lo implementado hasta ahora en `frc-mobile-pwa`. **No arrancar hasta dar la orden de inicio.**

---

## Estado de la ejecución — 2026-08-04

Se ejecutó una **primera pasada automatizada**. La extensión de Chrome no estaba conectada, así que los casos que dependen de percepción visual o de dispositivo físico quedan para vos.

### Ya verificado, no hace falta repetirlo

| Casos | Cómo se verificó | Resultado |
|---|---|---|
| 1.1 · Saludo con el nombre | Test de integración | ✅ |
| 1.2 · Accesos según rol | Test de integración, con y sin rol | ✅ |
| 1.4 / 1.5 · Mensajes de credenciales vs. servidor caído | Test de `AuthService` | ✅ |
| 1.6 · Cambiar servidor invalida la sesión | Test de `ServerConfigService` | ✅ |
| 1.8 · Cerrar sesión borra las claves | Test | ✅ |
| 2.4 · Ruta protegida redirige al login | Test del guard | ✅ |
| 3.1 · Estado vacío de la lista | Test de integración | ✅ |
| 3.2 · Cards con chip de estado | Test de integración | ✅ |
| 3.3 · Skeleton de carga | Test de integración | ✅ |
| 3.4 · **Detalle de caja abre con datos** | Test de integración | ✅ |
| 3.5 · Guaraníes sin decimales | Test de integración | ✅ |
| 3.6 · Diferencia marcada, sin `-0` | Test de integración | ✅ |
| 3.8 · Error de red con reintento | Test de integración | ✅ |
| 4.4 / 4.5 · Formato y parseo de importes | 25 tests de `moneda.util` y del campo | ✅ |
| 5.1 · Service worker generado | Build de producción — 49 assets precacheados | ✅ |
| 5.2 · Marca en título y `theme-color` | Build de producción | ✅ |
| 5.4 · Update no bloqueante | `registerWhenStable` | ✅ |

### Fallos encontrados y corregidos en esta pasada

1. **`index.html` cargaba fuentes desde el CDN de Google.** El schematic de Angular Material insertó Roboto y Material Icons. Rompía la regla del proyecto y dejaba la app dependiendo de internet para tipografía e íconos, en un sistema pensado para operar en LAN. **Quitados**: la tipografía es `system-ui` y los íconos son SVG inline.
2. **El título de la página era `MobilePwa`** y el idioma `en`. Ahora `Bodega Franco` y `es-PY`.
3. **Faltaban `theme-color` y los metadatos de instalación en iOS.** Agregados, con variante para tema claro y oscuro.
4. **No había garantía contra scroll horizontal.** Agregada.

### Lo que queda para vos

Requieren navegador con extensión conectada, credenciales reales o teléfono físico:

- **1.3** · Recargar mantiene la sesión *(el código está testeado; falta verlo end-to-end contra el central)*
- **1.7** · Mostrar/ocultar contraseña
- **2.1 / 2.2** · Barra inferior en teléfono y riel en tablet
- **2.3** · Barra de progreso
- **3.7** · Volver desde el detalle
- **4.1** · Tema oscuro — que nada quede ilegible
- **4.2 / 4.3 / 4.6 / 4.7 / 4.8 / 4.9 / 4.10** · Todo lo visual de la galería
- **4.5 en el teléfono** · ⚠️ El caso más importante que queda: escribir `10.50` con el **teclado del sistema**, idealmente con el teléfono en inglés
- **5.1 / 5.3** · Instalar la PWA y rotar
- **6.1 a 6.5** · Teclado, texto grande, pantalla angosta, doble toque, sesión caducada

Y todo el **Bloque 3 contra datos reales**, que necesita un usuario del central con cajas.

---

## Antes de empezar

### Qué necesitás

- [ ] Node 20.19+ y el repo clonado en `frc-comercial/mobile-pwa`
- [ ] `npm install` corrido
- [ ] Un usuario válido del central con roles conocidos (idealmente uno con `ADMIN` o `VENTA_TOUCH`, y otro sin ellos)
- [ ] Un celular Android con cable USB, para las pruebas en dispositivo
- [ ] La instancia **alpha** del central accesible (`159.203.86.103:8083`)

### Qué NO hace falta

- Cloudflare ni HTTPS. `localhost` es contexto seguro: todo funciona en desarrollo sin tocar infraestructura.
- Ningún cambio en el central. Solo se leen datos, salvo donde se indique.

### Levantar la app

```bash
cd frc-comercial/mobile-pwa
npm start
# → http://localhost:4300
```

Para probar en un Android real, con el teléfono conectado por USB y depuración activada:

```bash
adb reverse tcp:4300 tcp:4300
```

Y abrir `http://localhost:4300` **en el teléfono**. Así el navegador lo trata como origen seguro y habilita cámara, GPS y service worker.

### Cómo reportar

Para cada caso: ✅ pasa · ⚠️ pasa con observaciones · ❌ falla.
En ❌ y ⚠️, anotá **qué esperabas**, **qué pasó** y **cómo reproducirlo**.

---

## Bloque 1 — Arranque y sesión

Lo más importante de esta ronda: la revisión encontró que la sesión no cargaba el usuario, y se corrigió. **Estos casos verifican esa corrección.**

### 1.1 · Login correcto
1. Abrir `http://localhost:4300`
2. Verificar que redirige a `/login`
3. Comprobar que abajo del título se ve la URL del servidor
4. Ingresar usuario y contraseña válidos
5. Entrar

**Esperado:** entra a Inicio. El título dice **"Hola, {tu nombre}"**, no "Bodega Franco".

> Si dice "Bodega Franco", el usuario no se cargó y el bug volvió.

### 1.2 · Los accesos rápidos respetan el rol
1. Con un usuario que tenga `ADMIN` o `VENTA_TOUCH`, mirar los accesos de Inicio

**Esperado:** aparece **Caja**.

2. Cerrar sesión, entrar con un usuario sin esos roles

**Esperado:** **no** aparece Caja. Los demás accesos sí.

> Ambos casos importan: si Caja no aparece nunca, los roles no llegan; si aparece siempre, no se filtran.

### 1.3 · Restauración de sesión al recargar
1. Ya logueado, apretar F5 (o recargar en el teléfono)

**Esperado:** sigue adentro, **sin volver al login**, y el saludo sigue mostrando tu nombre.

> Esto valida el `provideAppInitializer`. Antes de la corrección, recargar dejaba pasar pero sin identidad ni roles.

### 1.4 · Credenciales incorrectas
1. Cerrar sesión. Ingresar usuario válido con contraseña incorrecta

**Esperado:** mensaje **"Usuario o contraseña incorrectos…"** debajo del formulario. No un error genérico.

### 1.5 · Servidor inaccesible
1. Cerrar sesión
2. Tocar "Configuración del servidor" y poner `http://10.255.255.1:9999`
3. Intentar entrar

**Esperado:** **"No se pudo conectar con el servidor…"** — distinto del mensaje de credenciales.

> La distinción importa: en sucursal, una lleva a revisar la clave y la otra a avisar a sistemas.

### 1.6 · Cambiar de servidor invalida la sesión
1. Entrar normalmente
2. Cerrar sesión, ir a "Configuración del servidor" y cambiar la URL
3. Abrir DevTools → Application → Local Storage

**Esperado:** `frc.token` y `frc.usuarioId` **ya no están**.

### 1.7 · Mostrar/ocultar contraseña
1. En login, escribir algo en Contraseña y tocar el ojo

**Esperado:** alterna entre puntos y texto. El ícono cambia.

### 1.8 · Cerrar sesión
1. Ir a Cuenta → Cerrar sesión
2. Confirmar en el diálogo

**Esperado:** vuelve al login. Recargar **no** te devuelve adentro.

3. Repetir y cancelar el diálogo → **sigue la sesión**.

---

## Bloque 2 — Navegación y shell

### 2.1 · Barra inferior en teléfono
1. En una ventana angosta (o en el celular), mirar abajo

**Esperado:** cuatro destinos — Inicio, Operaciones, Buscar, Cuenta. El activo en rojo.

### 2.2 · Riel lateral en tablet
1. Ensanchar la ventana a más de 960 px (o rotar la tablet)

**Esperado:** la barra inferior desaparece y aparece un riel a la izquierda, con los mismos destinos. **Sin recargar.**

### 2.3 · Barra de progreso
1. Entrar a Operaciones → Caja y observar la parte superior

**Esperado:** una barra naranja fina mientras carga, que desaparece al terminar.

### 2.4 · Ruta protegida sin sesión
1. Cerrar sesión
2. Pegar `http://localhost:4300/operaciones/caja` en la barra de direcciones

**Esperado:** redirige a `/login`. **No** muestra la pantalla.

> En `frc-mobile` esto no estaba bloqueado.

### 2.5 · Ruta inexistente
1. Ir a `http://localhost:4300/no-existe`

**Esperado:** redirige a Inicio, sin pantalla en blanco ni error.

---

## Bloque 3 — Caja

### 3.1 · Lista sin cajas abiertas
1. Con un usuario sin cajas abiertas, ir a Operaciones → Caja

**Esperado:** estado vacío: **"No tenés cajas abiertas"** con una explicación. **No** una lista en blanco ni un spinner infinito.

### 3.2 · Lista con cajas
1. Con un usuario que tenga al menos una caja abierta

**Esperado:** una card por caja, con descripción, sucursal y **chip de estado con color** (naranja "En proceso", verde "Concluido", rojo "Necesita verificación").

### 3.3 · Skeleton de carga
1. DevTools → Network → throttling "Slow 3G"
2. Recargar la lista

**Esperado:** cards grises con animación, **con la forma de las cards reales**. No un spinner suelto.

### 3.4 · Detalle de caja
1. Tocar una caja de la lista

**Esperado:** abre el detalle **con los datos de esa caja**.

> ⚠️ **Caso crítico.** Antes de la corrección, esta pantalla mostraba siempre "La caja indicada no es válida". Si ves ese mensaje, el bug volvió.

### 3.5 · Los importes se leen en columna
1. En el detalle, mirar la sección de balance

**Esperado:**
- Guaraníes **sin decimales** y con puntos de miles (`₲ 1.500.000`)
- Todas las cifras **alineadas a la derecha y verticalmente**, comparables de un vistazo
- Reales y dólares **con dos decimales**

### 3.6 · La diferencia salta a la vista
1. Buscar una caja cerrada con diferencia

**Esperado:** el importe de la diferencia **en rojo, con signo**, y debajo el aviso de que la resuelve un supervisor. Si la diferencia es cero, **no** debe verse `-0`.

### 3.7 · Volver
1. Desde el detalle, tocar la flecha de la barra superior

**Esperado:** vuelve a la lista. El botón del navegador también funciona.

### 3.8 · Error de red
1. Con el detalle abierto, cortar la red (DevTools → Network → Offline)
2. Recargar la página

**Esperado:** pantalla de error con **"Reintentar"**. Al restablecer la red y tocar Reintentar, carga.

> No debe quedarse cargando para siempre ni mostrar "Ups!! Algo salió mal".

---

## Bloque 4 — Sistema de diseño

Todo este bloque en `http://localhost:4300/design-system` (solo en desarrollo).

### 4.1 · Tema oscuro
1. Tocar "Cambiar a oscuro"

**Esperado:** toda la galería cambia. **Ningún texto queda ilegible** ni ningún elemento invisible. Los chips de estado siguen distinguiéndose entre sí.

2. Recargar → **conserva** el tema elegido.
3. Cambiar el tema del sistema operativo con la app en modo "sistema" → la app acompaña.

### 4.2 · Botones
**Esperado:** primaria roja llena, secundaria contorneada, terciaria solo texto, destructiva roja. El deshabilitado se ve claramente deshabilitado.

### 4.3 · Chips de estado
**Esperado:** los ocho de devolución y los seis de caja, cada uno con su color. Pendiente/Separado naranja, Colectado/Retirado azul, Canjeado/Acreditado verde, Descartado/Cancelada rojo.

### 4.4 · Importes
**Esperado:** guaraníes sin decimales, dólares con dos, la diferencia negativa en rojo, todo alineado.

### 4.5 · Campo de importe — **el caso más importante**
1. Escribir `1234,56` y salir del campo (tocar afuera)

**Esperado:** se redondea a `1.235` — el guaraní no lleva decimales.

2. Escribir `10.50` y salir

**Esperado:** se interpreta como **diez con cincuenta**, no como mil cincuenta.

> ⚠️ **Probalo también en el teléfono**, con el teclado numérico del sistema. Es donde el bug aparecía: los teclados insertan `.` según el idioma del sistema, no el de la app. **Si el teléfono está en inglés, mejor** — es el caso que fallaba.

### 4.6 · Estados de lista
**Esperado:** skeleton animado con forma de card; vacío con ícono, explicación y botón; error en rojo con Reintentar. Los botones responden.

### 4.7 · Avisos y diálogos
1. Tocar cada botón de la sección

**Esperado:** los toasts salen abajo con el color de su tono y duran distinto (el error, más). El diálogo de confirmación abre **con el foco puesto en un botón** — verificalo apretando Tab y Enter sin usar el mouse.

### 4.8 · Buscador
1. Tocar "Buscador"
2. Escribir "lact"

**Esperado:** filtra a "Lácteos del Sur". Elegirlo cierra el diálogo y avisa. "Cancelar" no elige nada.

3. Escribir algo sin resultados → estado vacío, no lista en blanco.

### 4.9 · Cards
**Esperado:** las dos primeras responden al toque; la de la persona **no** (no tiene acción). Con Tab, solo las interactivas reciben foco.

### 4.10 · Íconos
**Esperado:** todos se ven. **Ninguno vacío ni cortado.**

---

## Bloque 5 — PWA

### 5.1 · Instalación
1. Compilar y servir producción:
```bash
npm run build
npx http-server dist/mobile-pwa/browser -p 4300
```
2. Abrir `http://localhost:4300` en Chrome
3. Menú → "Instalar aplicación"

**Esperado:** se instala. El ícono aparece en el sistema. Al abrirla, **sin barra de direcciones**.

> El service worker solo se activa en producción, no con `npm start`.

### 5.2 · Marca
**Esperado:** el nombre es **"Bodega Franco"**. En Android, la barra de estado toma el rojo de marca.

### 5.3 · Orientación
1. Rotar el teléfono con la PWA instalada

**Esperado:** se mantiene en vertical (`orientation: portrait`).

### 5.4 · Actualización
1. Con la PWA instalada, cambiar algo visible en el código y recompilar
2. Cerrar y reabrir la app dos veces

**Esperado:** en algún momento aparece el cambio, **sin reinstalar y sin interrumpir lo que estabas haciendo**.

> Contraste con `frc-mobile`, donde el update era forzado y bloqueante cada 50 segundos.

---

## Bloque 6 — Accesibilidad y robustez

### 6.1 · Navegación por teclado
1. Desde el login, recorrer toda la app **solo con Tab, Enter y Espacio**

**Esperado:** todo lo interactivo se alcanza y **muestra un contorno rojo visible** al recibir foco. Nada queda inalcanzable ni atrapado.

### 6.2 · Texto grande
1. Poner el zoom del navegador en 200% (o el tamaño de fuente del sistema al máximo)

**Esperado:** nada se corta ni se superpone. **La página no scrollea horizontalmente.**

### 6.3 · Pantalla angosta
1. DevTools → dispositivo de 320 px de ancho

**Esperado:** todo legible, la barra inferior entra completa, sin scroll horizontal.

### 6.4 · Doble toque
1. Tocar dos veces rápido "Entrar" en el login, y "Guardar" donde haya

**Esperado:** una sola petición. El botón se deshabilita mientras trabaja.

### 6.5 · Sesión caducada
1. Logueado, borrar `frc.token` desde DevTools → Application → Local Storage
2. Navegar a otra pantalla

**Esperado:** el backend rechaza, se ve un error claro. **No** una pantalla en blanco ni un spinner infinito.

---

## Qué no está implementado todavía

Para que no se reporte como falla:

| Área | Estado |
|---|---|
| Buscar (pestaña) | Placeholder — llega con la ola de producto |
| Operaciones | Solo Caja. Faltan pedidos, devoluciones, solicitud de gastos, venta-tarjeta |
| Inventario, transferencias, producto | No portados |
| Marcación, mis-RRHH, notificaciones | No portados |
| Abrir y cerrar caja | El servicio existe; falta la pantalla |
| Escáner de códigos | No implementado (llega con producto) |
| Suscripciones GraphQL | Falta configurar el transporte WebSocket |
| Cámara, GPS, biometría | No implementados |

---

## Resumen para completar

| Bloque | Casos | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| 1 · Arranque y sesión | 8 | | | |
| 2 · Navegación y shell | 5 | | | |
| 3 · Caja | 8 | | | |
| 4 · Sistema de diseño | 10 | | | |
| 5 · PWA | 4 | | | |
| 6 · Accesibilidad | 5 | | | |
| **Total** | **40** | | | |

### Los cinco que más importan

Si el tiempo es corto, empezá por estos: son los que verifican las correcciones de bugs críticos.

1. **1.1 y 1.2** — el saludo con tu nombre y el acceso a Caja según rol
2. **1.3** — recargar mantiene la sesión
3. **3.4** — el detalle de caja abre con datos
4. **4.5** — `10.50` se interpreta como diez con cincuenta, **probado en el teléfono**
5. **3.6** — la diferencia de arqueo en rojo, y sin `-0`
