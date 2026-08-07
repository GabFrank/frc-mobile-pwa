# Plan de testeo manual

Para validar lo implementado hasta ahora en `frc-mobile-pwa`. **No arrancar hasta dar la orden de inicio.**

---

## Estado de la ejecución — 2026-08-04

Dos pasadas. La **primera automatizada**, sin navegador. La **segunda con la extensión de Chrome conectada y el central real en `http://localhost:8081`**, con sesión iniciada por el usuario.

### Verificado contra el central real (segunda pasada)

| Casos | Cómo se verificó | Resultado |
|---|---|---|
| 1.1 · Saludo con el nombre | Login real: "Hola, FRANCO" | ✅ |
| 1.2 · Accesos según rol | 4 accesos visibles para el usuario 1 | ✅ |
| 1.3 · **Sesión sobrevive a recargar** | Recarga completa, la sesión se restaura | ✅ |
| 2.1 · Barra inferior | 4 destinos, con el activo marcado | ✅ |
| 2.5 · Ruta inexistente | `/no-existe` redirige a `/inicio` | ✅ |
| 3.2 · Lista con cajas | 6 cajas abiertas reales, de 6 sucursales | ✅ |
| 3.4 · Detalle con datos | Caja 19 de SUC. CENTRAL, balance y diferencia | ✅ |
| 3.6 · La diferencia salta a la vista | −5.000 en rojo, con el aviso de verificación | ✅ |
| 3.7 · Volver | Vuelve a la lista sin apilar historial | ✅ |
| 4.1 · Tema oscuro y claro | Galería completa en ambos | ✅ |
| 4.7 · Diálogos | Confirmación destructiva: el foco arranca en "Cancelar" | ✅ |
| 4.8 · Buscador | Filtra y devuelve el elegido | ✅ |
| Cuenta | Usuario, persona y sucursal reales | ✅ |

### Verificado por test automatizado (primera pasada)

| Casos | Cómo se verificó | Resultado |
|---|---|---|
| 1.4 / 1.5 · Mensajes de credenciales vs. servidor caído | Test de `AuthService` | ✅ |
| 1.6 · Cambiar servidor invalida la sesión | Test de `ServerConfigService` | ✅ |
| 1.8 · Cerrar sesión borra las claves | Test | ✅ |
| 2.4 · Ruta protegida redirige al login | Test del guard | ✅ |
| 3.1 · Estado vacío de la lista | Test de integración | ✅ |
| 3.3 · Skeleton de carga | Test de integración | ✅ |
| 3.5 · Guaraníes sin decimales | Test de integración | ✅ |
| 3.8 · Error de red con reintento | Test de integración | ✅ |
| 4.4 / 4.5 · Formato y parseo de importes | 25 tests de `moneda.util` y del campo | ✅ |
| 5.1 · Service worker generado | Build de producción — 49 assets precacheados | ✅ |
| 5.2 · Marca en título y `theme-color` | Build de producción | ✅ |
| 5.4 · Update no bloqueante | `registerWhenStable` | ✅ |

### Fallos encontrados y corregidos

**Primera pasada:**

1. **`index.html` cargaba fuentes desde el CDN de Google.** El schematic de Angular Material insertó Roboto y Material Icons. Rompía la regla del proyecto y dejaba la app dependiendo de internet para tipografía e íconos, en un sistema pensado para operar en LAN. **Quitados**: la tipografía es `system-ui` y los íconos son SVG inline.
2. **El título de la página era `MobilePwa`** y el idioma `en`. Ahora `Bodega Franco` y `es-PY`.
3. **Faltaban `theme-color` y los metadatos de instalación en iOS.** Agregados, con variante para tema claro y oscuro.
4. **No había garantía contra scroll horizontal.** Agregada.

**Segunda pasada, contra el central real:**

5. **El login entraba pero no cargaba el usuario.** La query pedía `Usuario.sucursal`, un campo que el schema del central no tiene, y GraphQL rechazaba la operación entera. La sucursal viene de `inicioSesion.sucursal`. El error además se tragaba en silencio: ahora se muestra el motivo.
6. **Toda la app renderizaba a media pantalla**, comprimida contra la derecha. Dos causas apiladas en el shell: `router-outlet` es *hermano* de la pantalla ruteada y competía por el ancho como flex item; y la pantalla ruteada, creada por el router, no lleva el atributo de encapsulación del shell, así que la regla `.area > *` nunca la alcanzaba. Ahora estira el contenedor (grid de una celda) y el outlet sale del flujo.
7. **El balance de caja mostraba ₲ 0 en todo.** La pantalla leía seis totales que la query nunca pedía. La Caja 19 abrió con ₲ 1.000 y vendió ₲ 4.000.
8. **El detalle podía abrir la caja de otra sucursal.** El id de caja no es único: cada filial numera desde 1 y la lista mostraba cuatro "Caja 1". La sucursal ahora viaja en la URL.
9. **Los toasts nunca tomaban su color semántico.** Las reglas usaban tokens `--mdc-snackbar-*`, que Material 21 ya no lee; salían todos grises.
10. **Texto blanco sobre los tonos en tema oscuro.** 1,94:1 sobre `--warn` — un aviso prácticamente invisible sobre su propio fondo. Nuevo token `--on-tono`, que cambia con el tema, y el caso "tono como relleno" incorporado a la suite de contraste.
11. **El chip de estado de la lista mostraba un guión en cada fila.** La query no pedía `estado`, y en las cajas replicadas viejas viene null igual. Donde no hay estado, la card muestra la fecha de apertura.
12. **El buscador abría sin foco en el campo.** En el teléfono eso significa que no aparece el teclado, en un componente cuyo único propósito es escribir.
13. **Bugs latentes en abrir/cerrar caja** (todavía sin pantalla): se mandaba `cajaInput` donde la mutation declara `$input`; el cierre omitía `$input` y mandaba un `sucursalId` no declarado; el resultado es un objeto `{ exito, cajaId }`, así que el aviso de éxito salía también con `exito: false`. Más un `$susId` inexistente en `cajasPorFecha` y un `imprimirBalance` sin alias `data:`.

### Lo que queda para vos

- **1.7** · Mostrar/ocultar contraseña
- **2.2** · Riel lateral en tablet *(no se pudo: el navegador quedó fijo en emulación de teléfono)*
- **2.3** · Barra de progreso
- ~~**4.5 en el teléfono** · escribir `10.50` con el teclado del sistema~~ — ✅ validado el 2026-08-05
- **5.1 / 5.3** · Instalar la PWA y rotar
- **6.1 a 6.5** · Teclado, texto grande, pantalla angosta, doble toque, sesión caducada

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

## Bloque 5 — PWA — ⚠️ **3 de 4** (Android real, 2026-08-07)

> Corrido en un Motorola edge 60 pro por adb, con el build de producción
> servido estático. **5.1, 5.2 y 5.3 pasan. 5.4 no**, y el detalle está al pie
> del bloque: no es un problema del entorno de prueba.

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

✅ **Pasó.** Chrome ofrece *Instalar* —no solo «crear acceso directo»—, o sea
que cumple los criterios de instalabilidad. Queda como WebAPK
(`org.chromium.webapk.…`) y abre en modo standalone, sin barra de direcciones.
La sesión se comparte con Chrome: entró ya logueada.

### 5.2 · Marca
**Esperado:** el nombre es **"Bodega Franco"**. La barra de estado toma el color
del tema: **el rojo de marca en tema claro** y `#2a2523` en oscuro — son dos
`<meta name="theme-color">` con `prefers-color-scheme`, así que en oscuro **no**
tiene que verse roja.

⚠️ **Pasó a medias.** El nombre es correcto. **El ícono es el logo de Angular**:
`public/icons/` tiene los que vienen con el andamiaje del framework, no la
marca. Se ve en el diálogo de instalación y queda así en la pantalla de inicio
del teléfono.

### 5.3 · Orientación
1. Rotar el teléfono con la PWA instalada

**Esperado:** se mantiene en vertical (`orientation: portrait`).

✅ **Pasó.** Forzando la rotación del sistema a horizontal, la app siguió
vertical (`mLastNonFullscreenOrientation=1`).

### 5.4 · Actualización
1. Con la PWA instalada, cambiar algo visible en el código y recompilar
2. Cerrar y reabrir la app dos veces

**Esperado:** en algún momento aparece el cambio, **sin reinstalar y sin interrumpir lo que estabas haciendo**.

> Contraste con `frc-mobile`, donde el update era forzado y bloqueante cada 50 segundos.

❌ **No pasó, y no es del entorno de prueba.** Con un cambio visible compilado y
servido, **dos ciclos completos de cerrar y reabrir la app dejaron la versión
vieja**. Lo medido:
>
> - Reabrir el WebAPK desde el launcher **no re-navega**: restaura la página tal
>   como estaba. La app llegó a mostrar un chunk que ya **no existe** en el
>   servidor, así que venía de caché, no de la red.
> - El service worker está **registrado, activo y controlando** la página
>   —`navigator.serviceWorker.controller` no es nulo—, pero su propio
>   diagnóstico (`/ngsw/state`) reporta `Latest manifest hash: none` y
>   `Last update check: never`, incluso después de un `registration.update()`
>   explícito. Nunca adopta una versión.
> - No es el montaje: `ngsw.json` se sirve como JSON, coincide con el build, e
>   `index.html` va con `no-cache`.
> - **La app no tiene ningún manejo de `SwUpdate`**: nada consulta, aplica ni
>   anuncia una versión nueva.
>
> Consecuencia operativa: un usuario puede quedarse en una versión vieja por
> tiempo indefinido y nadie se entera. Hace falta trabajo de ingeniería, no
> repetir la prueba.
>
> Dos sospechosos para revisar: `registrationStrategy: 'registerWhenStable:30000'`
> en una app **zoneless** —`isStable` no se comporta igual— y la ausencia de una
> suscripción a `versionUpdates`.

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

## Bloque 7 — Abrir y cerrar caja *(nuevo, sin probar)*

⚠️ **Nada de este bloque se probó contra el central real.** La apertura se
proxea a la filial y necesita que la sucursal tenga IP configurada; si tu
sesión está en una sucursal sin filial detrás, el central va a rechazar la
operación. Ahora lo dice en vez de festejar un éxito falso.

### 7.1 · La pantalla carga
1. Operaciones → Caja → **Abrir caja**

**Esperado:** un tab por moneda, con las denominaciones que manda el servidor.
Las monedas inactivas o sin denominaciones **no** aparecen. El selector de
maletín solo ofrece los que no están en uso por otra caja.

### 7.2 · El campo de cantidad no se mueve
1. Escribir `2` en una denominación y `250` en otra

**Esperado:** los campos quedan alineados. El total de la moneda, arriba,
sube en vivo. Ningún campo se desplaza mientras escribís.

### 7.3 · Cantidades inválidas
1. Escribir `-2` en una denominación
2. Escribir `2.7` en otra

**Esperado:** `-2` no suma nada; `2.7` cuenta como 2. Una cantidad negativa
restaría del arqueo sin verse en el total.

### 7.4 · Abrir sin maletín
1. Sin elegir maletín, tocar **Abrir caja**

**Esperado:** avisa que falta el maletín. No llama al servidor.

### 7.5 · Abrir con arqueo en cero
1. Elegir maletín, no contar nada, **Abrir caja**

**Esperado:** pregunta si querés abrir sin efectivo. **No lo bloquea** —una
caja nueva sin fondo inicial es legítima—.

### 7.6 · **Apertura real**
1. Elegir maletín, cargar un arqueo, **Abrir caja**, confirmar

**Esperado:** aviso de éxito y vuelta a la lista, con la caja nueva. Si el
central rechaza, un aviso rojo con el motivo — **nunca** "Caja abierta" sobre
una operación fallida.

> Si falla, mirá los logs del central: busca `ABRIR CAJA`. Los motivos
> habituales son sucursal sin IP o filial inaccesible.

### 7.7 · El maletín queda tomado
1. Volver a **Abrir caja**

**Esperado:** el maletín recién usado **ya no aparece** en la lista.

### 7.8 · Cierre con diferencia
1. Detalle de la caja abierta → **Cerrar caja**
2. Cargar un arqueo distinto al esperado

**Esperado:** mientras cargás se ve **Esperado** y **Diferencia**, la
diferencia en rojo cuando no es cero. Al confirmar, la diferencia que queda
registrada es la del backend, no la de la pantalla.

### 7.9 · Cerrar sin cargar nada
1. En el cierre, tocar **Cerrar caja** sin contar

**Esperado:** avisa que falta el arqueo. A diferencia de la apertura, acá sí
se bloquea: cerrar sin contar haría la diferencia incalculable.

---

## Bloque 8 — Mi trabajo *(nuevo)*

### 8.1 · Las cuatro pestañas
1. Inicio → **Mi trabajo**

**Esperado:** el orden es Marcación · Vales · Recibos · Vacaciones, y abrir la
pantalla dispara **una** consulta, no cuatro: solo se carga la pestaña activa.
El resumen de arriba muestra saldo de vacaciones, vales pendientes y último
recibo.

### 8.2 · Cargar más
1. Ir a Marcación con un funcionario con más de 30 jornadas
2. Bajar hasta el final y tocar **Cargar más**

**Esperado:** se agregan filas al final, sin repetir las que ya estaban y sin
volver a cargar la lista desde arriba. Cuando ya no hay más, el botón
desaparece. Con menos filas que el tamaño de página el botón **no aparece**:
es lo correcto, no un bug.

### 8.3 · Solicitar un vale
1. Vales → **Solicitar vale** (ocupa todo el ancho)
2. Cargar monto y motivo, confirmar

**Esperado:** el vale aparece en la lista como **Solicitado**. El campo de
importe muestra `₲` sin pisar la etiqueta.

### 8.4 · Solicitar vacaciones
1. Vacaciones → **Solicitar vacaciones**, elegir un rango

**Esperado:** un rango invertido se rechaza **antes** de ir al servidor.

### 8.5 · Ver un recibo
1. Recibos → tocar un recibo pagado

**Esperado:** abre el PDF. Solo se listan los **pagados**.

---

## Bloque 9 — Mis finanzas *(nuevo)*

### 9.1 · El resumen de crédito
1. Inicio → **Mis finanzas**

**Esperado:** Límite, Utilizado y Disponible. `Disponible = Límite −
Utilizado`, y si es negativo sale en rojo. **Utilizado** es la suma de los
convenios **abiertos**, no de la página que se está viendo.

### 9.2 · Páginas numeradas
1. Con más de 10 convenios abiertos, ir al pie de la lista

**Esperado:** `1 / N · X items` y las flechas. Avanzar trae convenios
distintos; la flecha de atrás está deshabilitada en la primera página.

### 9.3 · Historial
1. Tocar la pestaña **Historial**

**Esperado:** aparecen **todos** los convenios, no solo los abiertos —también
finalizados y cancelados—, y la paginación vuelve a la página 1.

> ⚠️ Requiere el central con el fix de `estado` nulo en
> `ventaCreditoPorClientePage`. Sin él, el Historial sale vacío.

### 9.4 · Detalle de la venta
1. En cualquier convenio, **Ver detalle**

**Esperado:** los ítems de la venta con cantidad, precio y total. Abre la
venta de **esa** sucursal: el id de venta se repite entre filiales.

### 9.5 · Confirmar por QR — **en el teléfono**
1. `adb reverse tcp:4300 tcp:4300`, abrir `http://localhost:4300` en el Android
2. Mis finanzas → **Confirmar compra por QR**, dar permiso a la cámara
3. Que alguien genere el QR del convenio desde el desktop y apuntar

**Esperado:** marco de guía, botón de linterna si el teléfono la tiene, y al
leer el código la pantalla vuelve con «Compra confirmada». En el desktop la
venta se cierra sola.

Probar también los rechazos: escanear el código de barras de un producto
(«no es de esta aplicación»), y el QR generado para otra persona («fue
generado para otra persona»). **Ninguno de los dos debe llamar al servidor.**

> Sin `adb reverse` no funciona: `getUserMedia` exige HTTPS o `localhost`.
> Servir por IP de red no alcanza.

### 9.6 · Cargar el código a mano
1. En el escáner, tocar **Ingresar a mano**

**Esperado:** el campo abre **con el teclado desplegado**. El código escrito
pasa por las mismas validaciones que el escaneado.

### 9.7 · Funcionario sin convenio
1. Entrar con un usuario cuya persona no sea cliente

**Esperado:** «No tenés convenio» explicando por qué, no un error ni una
lista en blanco.

---

## Bloque 10 — Escáner: la vía de ZXing — ✅ **PASÓ** (Safari en Mac, 2026-08-05)

> Los 6 casos en verde. **Queda verificado que ZXing carga, arranca y lee en un
> navegador sin `BarcodeDetector`** — que era el riesgo abierto del soporte de
> iOS. Lo que resta es lo propio del dispositivo: bloque 11.

**Safari de escritorio tampoco tiene `BarcodeDetector`.** Es el mismo motor de
render que iOS y toma exactamente la misma rama del código. Así que la vía que
en Android nunca corre —la única sin verificar en un navegador real— **se
puede ejercitar sin un iPhone**.

Lo que esto **sí** cubre: que ZXing cargue, que arranque, que lea un código
real, que corte bien al cerrar, y que la Mac **no** se confunda con iOS.
Lo que **no** cubre: nada de lo específico de iOS —pantalla táctil, cámara
trasera, PWA instalada sin barra de direcciones, visor de PDF de iOS—. Eso es
el bloque 11 y queda pendiente.

Con `npm start` andando, abrir `http://localhost:4300` **en Safari**.

### 10.1 · ZXing arranca y lee
1. Mis finanzas → **Confirmar compra por QR**
2. Dar permiso a la cámara de la Mac
3. Mostrarle un QR de convenio a la webcam — sirve el generado desde el
   desktop, o la pantalla del teléfono con el QR

**Esperado:** se ve la imagen de la webcam con el marco de guía, y al mostrar
el código **lo lee**.

> Si queda en «Abriendo la cámara…» o cae en la carga manual, **la vía de
> ZXing no arrancó** y ningún iPhone va a poder escanear. Es el fallo que más
> importa encontrar de todo el bloque, y por eso vale hacerlo hoy.

### 10.2 · La cámara se suelta
1. Después de leer el código, mirar el led verde de la webcam

**Esperado:** se apaga solo. Si queda prendido, ZXing sigue leyendo con el
diálogo ya cerrado.

### 10.3 · Sin linterna, sin botón
1. Volver a abrir el escáner y mirar la barra de arriba

**Esperado:** **no** hay ícono de linterna. Una webcam no tiene flash: el
botón tiene que no existir, no aparecer apagado ni sin efecto.

### 10.4 · Los rechazos del QR
1. En el escáner, **Ingresar a mano**
2. Escribir `7840001234567` y confirmar
3. Repetir con `frc-3-VENTA_CREDITO-99-0--clave-1770000000000`

**Esperado:** «Ese código no es de esta aplicación» y «Ese QR fue generado
para otra persona». *(Verificado ya en Chrome; acá se confirma que el camino
manual de Safari llega al mismo lugar.)*

### 10.5 · La Mac no es iOS
1. En Mi trabajo → Recibos, abrir un recibo pagado

**Esperado:** abre en **pestaña nueva**, como en Chrome. Si en cambio navega
en la misma pestaña, la Mac se está detectando como iOS y el `maxTouchPoints`
que distingue un iPad de un Mac no está funcionando.

### 10.6 · Que no se haya roto Chrome
1. Repetir 10.1 y 10.5 en Chrome

**Esperado:** igual que siempre. Chrome usa `BarcodeDetector`, no ZXing: es el
caso de regresión de todo este cambio.

---

## Bloque 11 — iOS real *(pendiente: hace falta un iPhone o iPad)*

Requiere el dispositivo y la app por **HTTPS** — `adb reverse` es solo
Android—. Sirve un túnel: `cloudflared tunnel --url http://localhost:4300`.

### 11.1 · Escanear en Safari de iOS
Igual que 10.1, en el iPhone.
**Esperado:** además de leer, usa la **cámara trasera**, no la frontal.

### 11.2 · Escanear con la PWA instalada
1. **Compartir → Añadir a inicio**, abrir desde el ícono, repetir 11.1

**Esperado:** igual. La app instalada es el caso más restrictivo: si algo se
rompe, se rompe acá.

### 11.3 · Un recibo en PDF desde la PWA instalada
1. Mi trabajo → Recibos → tocar un recibo pagado

**Esperado:** el PDF abre **dentro de la app**, no salta a Safari, y el gesto
de volver regresa a la lista.

> Es el caso que motivó todo el camino aparte del PDF. Si salta a Safari y
> deja la app, o si al volver la app arranca de cero, hay que ir a un visor
> propio con el PDF embebido: reportalo así.

### 11.4 · El mismo recibo en Safari de iOS sin instalar
**Esperado:** pestaña nueva. Si Safari bloquea el popup, navega en la misma
con un aviso, y el botón de atrás vuelve.

### 11.5 · Linterna
1. Con poca luz, tocar el ícono del rayo

**Esperado:** prende el flash y el ícono queda marcado.

### 11.6 · Códigos de balanza *(el que decide si el escaneo por cámara sirve)*
1. Apuntar a una **etiqueta térmica de balanza** de prefijo `20`, de las
   gastadas que están en circulación

**Esperado:** lee el EAN-13 completo. La lógica de peso (`barcodeUtils.ts`) no
cambió; lo que se prueba es que el motor lea la etiqueta real.

> Probarlo en un **equipo viejo de sucursal**, no en un teléfono bueno. Si no
> rinde, la salida conocida son los lectores Bluetooth HID, que se comportan
> como teclado y funcionan igual en el navegador.

### 11.7 · Regresión en Android
1. Repetir 11.3 y 11.4 en el Android

**Esperado:** igual que antes — pestaña nueva, descarga si está bloqueada.

---

## Bloque 12 — Buscar producto — ⚠️ **REPASAR**

> Los 6 casos pasaron en Android el 2026-08-05, **pero la pantalla cambió
> después**: la lista ahora usa cards expandibles con menú `⋮`, el stock sale
> de una sola consulta y la presentación se rotula `Cantidad: N (Nombre)`.
> Hay que correr 12.1 a 12.6 de nuevo, más 12.7 a 12.9.

Verificado por mí contra tu base: búsqueda por texto (10 resultados de
«coca»), por código (`7840058000750` → un solo resultado), paginación
(10 → 20 sin repetidos), stock, y un pesable real
(`2010007015003` → CHORTI PUNTA DE PECHO, 1,500 kg × ₲ 67.000 = ₲ 100.500).
Lo que sigue es lo que no pude cubrir.

### 12.1 · Escanear un producto de verdad
1. En el Android con `adb reverse tcp:4300 tcp:4300`, ir a **Buscar**
2. Tocar el ícono de escanear y apuntar a un código de barras real

**Esperado:** encuentra el producto y lo muestra solo. El texto del campo
queda con el código escaneado.

### 12.2 · Escanear una etiqueta de balanza
1. Escanear una etiqueta térmica de balanza (prefijo `20`)

**Esperado:** aparece el panel **Producto pesado** con el peso en kilos, el
precio por kilo y el total. El peso lleva **coma** decimal —`1,500 kg`—, no
punto.

> Si el producto no aparece, fijate si el código interno de 5 dígitos está
> cargado en el sistema: el código completo de balanza casi nunca lo está, y
> la búsqueda cae al interno.

### 12.3 · Un código que no existe
1. Escribir un código inventado, por ejemplo `9999999999999`, y buscar

**Esperado:** «Sin resultados» diciendo qué se buscó — no una lista vacía ni
un error.

### 12.4 · Buscar por descripción con varias palabras
1. Escribir algo como `coca 2l` y buscar

**Esperado:** trae resultados por descripción. Un texto con espacios **no** se
trata como código.

### 12.5 · Cargar más
1. Buscar algo con muchos resultados y bajar al final

**Esperado:** el botón trae 10 más, sin repetir los de arriba y sin volver al
principio de la lista. Con menos de 10 resultados el botón **no aparece**.

### 12.6 · Expandir un producto
1. Tocar la card de un resultado

**Esperado:** se abre mostrando sus presentaciones, cada una como
**`Cantidad: 1 (UNIDAD)`** con su código y su precio. El chevron gira. Las
presentaciones se piden recién al abrir, no antes.

### 12.7 · Stock por sucursal *(nuevo)*
1. Tocar el `⋮` de cualquier producto → **Ver stock por sucursal**

**Esperado:** la lista de sucursales con su existencia, **de una sola vez**.
`SERVIDOR` **no** aparece: no es un local. Una sucursal sin movimientos sale
en `0`. Las negativas van en rojo — así están en la base, no es un error.

### 12.8 · El stock en la card *(necesita un usuario de sucursal real)*
1. Entrar con un usuario cuya sesión **no** esté en el SERVIDOR
2. Buscar y expandir un producto

**Esperado:** la card muestra `Stock N` de esa sucursal, y cada presentación
el suyo convertido —una caja de 12 muestra la doceava parte—. Con el usuario
de siempre, que está en el SERVIDOR, **no debe aparecer stock en ningún
lado**.

> Es el caso que no pude verificar: mi sesión está en la sucursal `0`.

### 12.9 · Buscar mientras carga *(nuevo)*
1. Buscar algo, y **antes de que termine**, escribir otra cosa y buscar

**Esperado:** gana la última búsqueda. La primera no debe pisar los
resultados aunque conteste después.

---

## Bloque 13 — Devoluciones *(nuevo)*

### 13.1 · Cargar una devolución
1. Operaciones → **Devoluciones** → *Nueva devolución*
2. Elegir la sucursal de origen
3. **Agregar producto**, buscar uno, expandirlo y tocar una presentación
4. Cargar cantidad y motivo, **Agregar**

**Esperado:** la fila aparece con su cantidad y su motivo. El resumen de
arriba suma productos y unidades.

> El selector de sucursal **no ofrece SERVIDOR ni COMPRAS**: no tienen
> depósito. Tampoco las sucursales cerradas.

### 13.2 · El motivo dice a dónde va la pérdida
1. En el diálogo del ítem, cambiar entre motivos

**Esperado:** debajo del selector cambia el texto entre «se le puede reclamar
al proveedor» y «la pérdida es de la empresa», según el motivo.

### 13.3 · Escanear en vez de buscar
1. En **Agregar producto**, tocar el ícono de escanear y leer un código

**Esperado:** encuentra el producto. Con una **etiqueta de balanza**, la
cantidad viene cargada con el peso y no hay que escribirla.

### 13.4 · Salir sin guardar
1. Con productos cargados, tocar el botón de volver

**Esperado:** pregunta antes de salir. Sin productos, sale directo.

### 13.5 · Guardar
1. **Guardar**

**Esperado:** aviso de éxito y va al detalle de la devolución recién creada,
en estado **Pendiente**. Volver desde ahí **no** debe regresar al formulario.

### 13.6 · Separar e imprimir etiqueta
1. En el detalle de una devolución **Pendiente**, *Separar e imprimir etiqueta*
2. Confirmar

**Esperado:** pasa a **Separado** y se abre el PDF de etiquetas. Si el PDF
falla, la devolución igual quedó separada y se avisa aparte.

> El botón **solo aparece en Pendiente**. En cualquier otro estado no está:
> el resto de las transiciones las hacen otras pantallas que no están
> portadas.

### 13.7 · Historial y filtros
1. Volver a Devoluciones y recorrer las pestañas Pendientes / Separadas / Todas

**Esperado:** cada una trae lo suyo, con «Cargar más» de a 10. Tocar una
abre su detalle.

---

## Bloque 14 — Venta con tarjeta *(nuevo)*

> Requiere la función **habilitada en el central** y una **caja abierta**.
> Sin caja, la pantalla lo dice y no deja escanear.

### 14.1 · El guard
1. Operaciones → **Venta con tarjeta**

**Esperado:** entra. Volver y entrar de nuevo debe ser **instantáneo** — el
flag queda cacheado 5 minutos.

### 14.2 · Sin caja abierta
1. Entrar sin tener caja abierta

**Esperado:** «Sin caja abierta» explicando por qué, y **no** aparece el
botón de escanear.

### 14.3 · Escanear el cupón
1. Con caja abierta, **Escanear cupón** y leer el QR del punto de venta

**Esperado:** va al registro con la venta y el monto ya cargados.

### 14.4 · El QR de otra caja se rechaza *(el más importante)*
1. Escanear un QR generado desde **otra** caja

**Esperado:** «Este QR pertenece a otra caja…» y **no** navega. Es lo que
impide que un cupón se impute a la caja equivocada y descuadre dos arqueos.

### 14.5 · Registrar
1. Cargar código de autorización y número de boleta, **Guardar**

**Esperado:** vuelve a la lista y el cupón figura como **Registrado**. El
contador de «Sin registrar» baja en uno. El monto **no se puede editar**.

### 14.6 · Los dos campos son obligatorios
1. Dejar uno vacío

**Esperado:** el botón de guardar queda deshabilitado.

---

## Bloque 15 — Marcación *(nuevo)*

> Necesita **HTTPS o `localhost`**: sin contexto seguro no hay GPS. En
> Android, `adb reverse tcp:4300 tcp:4300`.

### 15.1 · Estado del día
1. Inicio → **Marcación**

**Esperado:** muestra si estás en jornada y **un solo botón**, el de la
acción que corresponde. Nunca entrada y salida a la vez.

### 15.2 · Permiso de ubicación
1. Tocar el botón de marcar y aceptar el permiso

**Esperado:** el panel de ubicación muestra el avance y la precisión
(`±N m`). Si negás el permiso, ofrece marcar igual avisando que queda sin
GPS.

### 15.3 · Marcar entrada
1. Estando **en la sucursal**, marcar

**Esperado:** se registra, aparece la hora de entrada y el botón pasa a la
siguiente acción.

### 15.4 · Marcar lejos *(el caso a calibrar)*
1. Marcar desde lejos de la sucursal

**Esperado:** avisa la distancia y la precisión y **pide confirmación** — no
bloquea. Al confirmar, queda registrado con esos datos.

> Anotá qué distancia y qué precisión te dio: son los números con los que hay
> que decidir si el umbral de ±33 m sirve o hay que cambiarlo.

### 15.5 · La sucursal se recuerda
1. Elegir otra sucursal, salir de la pantalla y volver

**Esperado:** queda la última elegida.

### 15.6 · Y se borra al cerrar sesión
1. Cerrar sesión, entrar con **otro usuario** e ir a Marcación

**Esperado:** **no** aparece la sucursal del usuario anterior.

### 15.7 · Salida de almuerzo
1. Con la jornada abierta, marcar la salida de almuerzo y después el retorno

**Esperado:** la jornada **no se cierra** con la salida de almuerzo; las
horas trabajadas siguen contando bien al volver.

---

## Bloque 16 — Notificaciones *(nuevo)*

> Para que haya algo que ver hace falta un evento real: un retiro, una venta
> con stock negativo, una diferencia de maletín, o una solicitud de RRHH —
> esas ya notifican a los aprobadores.

### 16.1 · Bandeja
1. Inicio → **Notificaciones**

**Esperado:** arranca en **Sin leer**. Cada fila muestra el mensaje y la
fecha, y las no leídas están marcadas.

### 16.2 · Abrir marca como leída
1. Tocar una notificación sin leer

**Esperado:** abre el hilo de comentarios y, al volver, esa fila ya no está
en «Sin leer».

### 16.3 · Comentar
1. En el hilo, escribir un comentario y **Enviar**

**Esperado:** aparece en la lista con tu nombre y la hora.

### 16.4 · Responder
1. Tocar **Responder** en un comentario, escribir y enviar

**Esperado:** la respuesta queda **indentada bajo ese comentario**.

2. Responder a una respuesta

**Esperado:** queda al mismo nivel que la anterior, **no más adentro**.

### 16.5 · Marcar todas
1. Volver a la bandeja y **Marcar todas como leídas**

**Esperado:** «Sin leer» queda vacío.

### 16.6 · Preferencias
1. **Preferencias** desde la barra superior

**Esperado:** una fila por tipo. Las obligatorias —diferencia de maletín, por
ejemplo— aparecen **con el interruptor deshabilitado** y el texto «Siempre se
envía». No están escondidas.

### 16.7 · Apagar una opcional
1. Apagar un tipo opcional, salir y volver

**Esperado:** queda apagado. Si el servidor rechaza el cambio, el interruptor
vuelve a su posición y avisa.

---

## Bloque 17 — Caja chica *(nuevo)*

> Las solicitudes se crean hoy desde el desktop: la PWA todavía no las da de
> alta. Para probar hace falta al menos una solicitud existente.

### 17.1 · Lista
1. Operaciones → **Caja chica**

**Esperado:** las solicitudes con su monto y su estado. La etiqueta y el color
del estado los manda el backend — si ves un estado que la app no conoce, está
bien que se muestre igual.

### 17.2 · Detalle
1. Tocar una solicitud

**Esperado:** montos solicitado, retirado, rendido y **a devolver**. Si tiene
rendición, aparece su propio estado aparte del estado de la solicitud.

### 17.3 · Escanear una solicitud
1. **Escanear solicitud** y leer el QR que muestra el funcionario

**Esperado:** abre el detalle de esa solicitud.

### 17.4 · Confirmar retiro *(el que mueve plata)*
1. En una solicitud sin retiro confirmado, **Confirmar retiro** y aceptar

**Esperado:** queda registrado con la fecha de retiro y el botón desaparece.

> El botón **solo aparece** si la solicitud no tiene retiro confirmado y hay
> token. Sin token no se puede confirmar: es lo que ata el retiro a esa
> solicitud y no a otra.

### 17.5 · Un código que no es de la app
1. En **Escanear solicitud**, cargar a mano `123456`

**Esperado:** «Ese código no es de esta aplicación», sin navegar.

---

## Bloque 18 — Transferencias *(nuevo)*

> Necesita el rol **`VER TRANSFERENCIA`** y transferencias existentes: la PWA
> todavía no las crea.

### 18.1 · Los tres puntos de vista
1. Inicio → **Transferencias**

**Esperado:** pestañas **Salen · Llegan · Todas**. «Salen» trae aquellas donde
tu sucursal es el origen; «Llegan», donde es el destino.

### 18.2 · Detalle con las cuatro etapas *(lo que importa)*
1. Abrir una transferencia que ya haya avanzado

**Esperado:** por cada producto, una línea por etapa: **Pedido · Preparado ·
Despachado · Recibido**, con su cantidad.

> Si se pidieron 10 y llegaron 7, tenés que poder ver **en qué etapa** se
> perdieron. Si ves una sola cifra, el port perdió la trazabilidad y hay que
> reportarlo.

### 18.3 · Las etapas que no pasaron no aparecen
1. Abrir una transferencia recién creada

**Esperado:** solo la línea **Pedido**. Las otras tres **no** deben figurar
en cero: todavía no ocurrieron.

### 18.4 · La presentación de cada etapa
1. Buscar un ítem pedido en cajas y despachado en unidades

**Esperado:** cada línea muestra su propio `× N`. Sin eso, 2 cajas y 24
unidades parecen una diferencia y no lo son.

### 18.5 · Tu rol
1. Mirar «Tu rol» en el detalle

**Esperado:** dice si estás en origen, en destino, en los dos, o si es solo
consulta — y coincide con lo que la transferencia realmente es para tu
sucursal.

---

## Bloque 19 — Inventario *(nuevo)*

> Necesita el rol **`VER INVENTARIO`** y una toma existente: la PWA todavía
> no crea inventarios.

### 19.1 · Lista
1. Inicio → **Inventario**

**Esperado:** tus inventarios, del más reciente al más viejo, con su estado.

### 19.2 · Resumen del conteo
1. Abrir uno con productos contados

**Esperado:** productos, concluidos, ítems contados, revisados, con
diferencia y **diferencia total con signo** — `+` sobrante, `−` faltante.

### 19.3 · Lo arrastrado se muestra aparte *(el que importa)*
1. Abrir un inventario donde se hayan copiado conteos de una toma anterior

**Esperado:** aparece una línea **«Arrastrados»** separada de «Ítems
contados», y esos ítems **no** suman a la diferencia.

> Si los arrastrados aparecen como contados, la cobertura del conteo miente:
> diría que se recorrió mercadería que nadie tocó.

### 19.4 · Diferencia por producto
1. Mirar la lista de productos

**Esperado:** cada uno con su diferencia al costado, en rojo si es negativa,
y abajo cuántos ítems se contaron.

### 19.5 · Finalizar
1. En un inventario **Abierto**, *Finalizar inventario*

**Esperado:** la confirmación **dice cuántos ítems tienen diferencia y cuánto
suma** antes de aplicar. Al confirmar, el inventario pasa a Concluido.

> Finalizar **aplica las diferencias al stock**. Lo que quedó sin contar entra
> como diferencia: no es solo cerrar la toma.

---

## Bloque 20 — Recepción de mercadería *(nuevo)*

> Necesita una **nota de recepción cargada desde el desktop** para un
> proveedor, y una sucursal **con depósito**. Sin nota no hay nada que
> recibir: la PWA no crea notas.

### 20.1 · Sucursal por escaneo
1. Operaciones → **Recepción de mercadería** → *Nueva recepción*
2. *Escanear el cartel* y leer el QR de una sucursal

**Esperado:** queda elegida esa sucursal. Con un QR que no sea del sistema
avisa que no es de una sucursal.

### 20.2 · Una sucursal sin depósito se rechaza
1. Abrir el selector *O elegila de la lista*

**Esperado:** **no aparecen** `SERVIDOR` ni `COMPRAS`. Si se escanea el QR de
una virtual, avisa que no tiene depósito y no la toma.

### 20.3 · Nota ya recibida *(el que importa)*
1. Elegir sucursal y proveedor
2. Cargar el número de una nota **ya recibida y finalizada** en esa sucursal

**Esperado:** avisa que ya se recibió, **con el número de recepción**, y dice
que hay que reabrir esa en vez de crear otra. La nota **no** se agrega.

> Crear una segunda recepción de la misma nota duplica movimientos de stock y
> costos. Es el chequeo más caro de este circuito.

### 20.4 · La misma nota dos veces
1. Agregar una nota válida y volver a cargar el mismo número

**Esperado:** avisa que ya está en la lista y no la duplica.

### 20.5 · Moneda y cotización
1. Con las notas cargadas, mirar la sección **Moneda**

**Esperado:** viene la moneda de la nota. Si es **guaraníes**, no pide
cotización. Si se elige una moneda extranjera, **aparece el campo cotización y
el botón de iniciar queda deshabilitado** hasta completarlo.

> En la app Android esto era `1.0` fijo y sin preguntar: una nota en dólares
> se cargaba como si fueran guaraníes.

### 20.6 · Iniciar
1. *Iniciar recepción* y confirmar

**Esperado:** dice cuántas notas y en qué sucursal, y al confirmar abre el
detalle con los productos a verificar.

### 20.7 · Verificar un producto completo
1. Tocar un producto → cargar la cantidad esperada → *Agregar* → *Guardar*

**Esperado:** el resumen de arriba muestra **A recibir / Recibido / Rechazado
/ Falta** en la presentación elegida. Al guardar, el producto queda
**Recibido**.

### 20.8 · Cambiar de presentación
1. En el diálogo, cambiar la presentación

**Esperado:** los cuatro números se recalculan. Con **caja x12**, 48 unidades
se ven como **4**.

### 20.9 · Recibir de menos sin rechazar *(el que importa)*
1. Cargar **menos** de lo pendiente y *Guardar* sin agregar rechazo

**Esperado:** **no deja guardar**. Avisa cuánto falta y que hay que agregar un
rechazo por la diferencia.

> Es lo que sostiene el reclamo al proveedor: sin rechazo, la falta desaparece
> del sistema.

### 20.10 · Rechazar con motivo
1. Cargar lo recibido, activar *Esta cantidad se rechaza*, elegir motivo,
   *Agregar* → *Guardar*

**Esperado:** la línea rechazada se ve con borde rojo y su motivo. Al guardar,
el producto queda **Parcial**.

### 20.11 · Producto en varias notas *(el que importa)*
1. Rechazar un producto que venga en **más de una nota** de la recepción

**Esperado:** antes de guardar pregunta **a qué nota se imputa el rechazo**,
mostrando cuánto queda pendiente en cada una. Las notas que no alcanzan
aparecen **deshabilitadas**.

> Sin esa línea el backend responde éxito y **no registra el rechazo**. Si
> este diálogo no aparece, el rechazo se está perdiendo.

### 20.12 · Pasarse de lo pendiente
1. Cargar más de lo que falta

**Esperado:** avisa que la suma de recibido y rechazado no puede superar lo
pendiente, y no agrega la línea.

### 20.13 · Verificar escaneando
1. En el detalle, *Escanear* y leer el código de un producto de la recepción

**Esperado:** abre el diálogo de ese producto directamente. Con un producto
que **no** está en la recepción, avisa.

### 20.14 · Deshacer con la recepción en proceso
1. En un producto ya verificado, *Deshacer*

**Esperado:** confirma avisando que se borran las cantidades **en todas las
notas**, y al aceptar el producto vuelve a Pendiente.

### 20.15 · Filtros
1. Alternar Todos / Pendientes / Recibidos / Parciales

**Esperado:** la lista responde a cada filtro.

### 20.16 · Finalizar con pendientes *(el que importa)*
1. Con productos sin verificar, *Finalizar*

**Esperado:** dice **cuántos productos se van a rechazar** y los nombra, y
**exige un motivo** antes de dejar finalizar.

> Finalizar no deja lo pendiente pendiente: lo rechaza.

### 20.17 · Finalizar completo
1. Con todo verificado, *Finalizar*

**Esperado:** confirma que las cantidades entran al stock. La recepción queda
**Finalizada**.

### 20.18 · Reabrir
1. En una recepción finalizada, *Reabrir*

**Esperado:** vuelve a **En proceso** y se pueden corregir cantidades. En una
que ya está en proceso, el botón no aparece.

### 20.19 · Constancia en PDF
1. En una recepción finalizada, *Constancia*

**Esperado:** se abre el PDF. En iPhone con la PWA instalada se abre **dentro**
de la app y el gesto de volver regresa.

### 20.20 · La barra de acciones cambia con el estado
1. Abrir una recepción **en proceso** y mirar la barra de arriba
2. Abrir una **finalizada** y mirar la misma barra

**Esperado:** en proceso hay exactamente dos botones, *Escanear* y *Finalizar*;
finalizada, *Reabrir* y *Constancia*. Siempre dos, **mitad y mitad del ancho**,
sin menú ⋮. Los botones se ven **en la barra de arriba**, nunca sueltos sobre
el contenido de la pantalla.

Con la recepción **finalizada** aparece además, más abajo en la pantalla, el
bloque **«Pago al proveedor»** con el botón *Solicitar pago*. En proceso ese
bloque no está.

> La constancia de una recepción a medio verificar no dice nada: por eso no
> está mientras está en proceso. Y el pago tampoco: el servidor solo acepta
> notas ya recibidas por completo.
>
> El botón de pago va abajo y no en la barra porque tres botones en una fila
> no entran en la pantalla de un teléfono.

### 20.21 · Deshacer sobre una recepción finalizada *(el que importa)*
1. En una recepción **recién finalizada**, *Deshacer* en un producto verificado
2. Leer el texto de la confirmación **antes** de aceptar
3. Aceptar

**Esperado:** el aviso dice, además de las cantidades, que la recepción **vuelve
a quedar en proceso**, que se **revierte el stock** que entró por ese producto,
y que el servidor solo lo permite **dentro de las 24 horas** de finalizada. Al
aceptar, el estado de la cabecera pasa a **En proceso** solo (sin recargar a
mano) y la barra de arriba cambia a *Escanear* / *Finalizar*.

4. Repetir sobre una recepción finalizada hace **más de 24 horas**

**Esperado:** el servidor la rechaza y sale el error; nada cambia.

> Deshacer no es solo borrar un número: mueve stock. Si el aviso se quedó en
> «se borran las cantidades», el operador está aceptando algo que no leyó.

---

## Bloque 21 — Solicitud de pago a proveedor *(nuevo)*

> **Estado de ejecución: 18 de 20 corridos** contra el central real. 21.17 se
> corrió en un Android real, con el toque de verdad.
>
> **Faltan dos, los dos por falta de datos, no por la app:**
>
> - **21.10, monedas mezcladas** — las 12 notas elegibles están todas en
>   guaraníes.
> - **21.16, con pago vigente** — el único pago que existe está cancelado, y
>   uno nuevo se crea desde el escritorio.
>
> Sobre **21.9**: el descuento por rechazos está verificado contra la base —el
> backend guardó 1.014.720 en una nota que vale 1.159.680 en bruto— pero no en
> pantalla, porque la única nota con rechazos que queda libre está rechazada al
> 100% y crear esa solicitud dejaría un documento en cero.
>
> ⚠️ **Ojo al verificar 21.9 contra solicitudes viejas:** las anteriores al
> 25/02/2026 guardaron el bruto, porque la lógica de rechazos entró en el
> central entre el 23 y el 25. Ahí estimado y definitivo dan iguales y no es
> un fallo.

> Necesita **una recepción finalizada** cuyas notas no estén ya en otra
> solicitud. Lo más cómodo es encadenarlo con el bloque 20: finalizar una
> recepción y seguir de ahí.
>
> El **pago** en sí no se prueba acá: no se carga desde esta app. Lo único que
> se verifica del pago es que el detalle lo muestre cuando existe.

### 21.1 · Entrar desde el menú
1. Operaciones → **Solicitudes de pago**

**Esperado:** la lista abre con los filtros *Todas / Borradores / Solicitadas /
Parciales / Concluidas / Canceladas* y el botón *Nueva solicitud* a lo ancho.

> Dice **Borradores**, no «Pendientes». `PENDIENTE` dejó de significar
> «esperando el pago» cuando el central sumó `SOLICITADO`. Cada tarjeta
muestra proveedor, número `SP-…`, fecha, cantidad de notas, forma de pago, el
chip de estado y el monto a la derecha.

### 21.2 · Los tres estados de la lista
1. Abrirla con la red cortada
2. Reconectar y reintentar
3. Filtrar por un estado sin ninguna solicitud

**Esperado:** primero el esqueleto de carga, después el error con *Reintentar*
—que funciona—, y con el filtro sin resultados el vacío «Sin solicitudes».

### 21.3 · Filtrar por estado
1. Alternar entre los cinco filtros

**Esperado:** la lista se recarga desde la página 0 en cada cambio. Tocar el
filtro que ya está activo no dispara otra consulta.

### 21.4 · Crear desde una recepción *(el que importa)*
1. Abrir una recepción **finalizada** → bloque *Pago al proveedor* → *Solicitar pago*

**Esperado:** se abre *Nueva solicitud de pago* con el proveedor **ya puesto y
con su nombre** —no un id—, las notas de esa recepción cargadas, y moneda,
forma de pago y fecha propuesta completas. Debajo del proveedor dice de qué
recepción viene. **No pregunta nada antes de abrir el formulario**: todavía no
se creó nada.

> El proveedor no se puede cambiar en este camino: las notas ya cargadas son
> suyas y el servidor rechaza la solicitud si se mezclan proveedores.

### 21.5 · Recepción sin notas pendientes de pago
1. Repetir 21.4 sobre una recepción **cuyas notas ya estén en otra solicitud**

**Esperado:** el formulario abre **vacío de notas** y avisa que no hay notas
pendientes de pago: o ya están en otra solicitud, o no quedaron recibidas por
completo. No se queda cargando ni muestra un error rojo.

> ⚠️ **Hay que entrar navegando desde la recepción**, no pegando la URL en la
> barra ni recargando la página. Con recarga dura el aviso no llegó a verse en
> las pruebas; el texto de ayuda del bloque de notas sí queda, así que la
> pantalla no miente, pero el toast se pierde. Si vas a verificar este caso,
> hacelo por el camino del operador.

### 21.6 · Crear desde cero
1. *Nueva solicitud* → buscar un proveedor por nombre → elegirlo
2. Cargar el **número** de una nota recibida por completo → *Agregar nota*

**Esperado:** la nota aparece con fecha, moneda, valor y estado. Al agregar la
primera, la moneda de la solicitud se completa con la de la nota.

### 21.7 · Nota que no se puede pagar *(el que importa)*
1. Probar con: un número que no existe; una nota **a medio recibir**; una nota
   ya incluida en otra solicitud

**Esperado:** en los tres casos el mismo aviso, que nombra las cuatro causas
posibles —no existe, no está recibida por completo, ya está pagada, o ya
pertenece a otra solicitud—. La nota **no** se agrega.

> El servidor devuelve vacío sin decir cuál de las cuatro es. Un aviso que
> afirme una sola causa estaría adivinando.

### 21.8 · Nota repetida
1. Agregar dos veces el mismo número

**Esperado:** avisa que ya está en la lista y no la duplica.

### 21.9 · El total es una estimación *(el que importa)*
1. Cargar notas y mirar el pie del bloque de notas

**Esperado:** dice **«Total estimado»**, no «Total», y debajo aclara que el
monto definitivo lo calcula el servidor descontando lo rechazado en la
recepción.

2. Usar una recepción **con rechazos** y comparar ese estimado con el monto que
   queda en el detalle después de guardar

**Esperado:** el del detalle es **menor**. Esa diferencia es exactamente lo
rechazado, y es la razón por la que el número de la pantalla anterior se
rotula «estimado».

> `frc-mobile` mostraba esta suma como si fuera el total. Es la regla 6 del
> repo: el dinero lo calcula el backend.

### 21.10 · Notas en monedas distintas
1. Cargar dos notas de monedas diferentes, si hay

**Esperado:** además de la aclaración de siempre, avisa que las notas no están
todas en la misma moneda y que el servidor las convierte a la de la solicitud.

### 21.11 · Cambiar de proveedor con notas cargadas
1. Con notas ya agregadas, *Cambiar* en el proveedor

**Esperado:** pregunta antes, avisando que las notas se van a quitar. Al
aceptar, la lista queda vacía.

> Sin esto el servidor rechaza la solicitud entera: todas las notas tienen que
> ser del mismo proveedor.

### 21.12 · Lo que falta para guardar
1. Intentar *Crear solicitud* sin proveedor, después sin notas, después sin
   moneda y sin forma de pago

**Esperado:** un aviso distinto por cada faltante, y el primero que reclama es
el proveedor.

### 21.13 · Crear
1. Con todo cargado, *Crear solicitud* → confirmar

**Esperado:** el diálogo dice cuántas notas y de qué proveedor, y aclara que el
monto final lo calcula el servidor. Al aceptar, avisa **«creada y enviada a
pagos»** con el número `SP-…` que asignó el backend, y abre el detalle.

El detalle tiene que quedar en **Solicitado**, no en Borrador.

> Son dos llamadas al servidor: crear y solicitar. Si la segunda falla, el
> aviso lo dice —«se creó, pero quedó como borrador»— y hay que entrar y tocar
> *Solicitar*. Lo que **no** puede pasar es que diga que se creó y quede en
> borrador sin avisar: eso es un pago que nadie va a ver.

### 21.14 · Detalle
1. Mirar el detalle recién creado

**Esperado:** estado *Solicitado*, número, proveedor, fechas, forma de pago,
monto —el del servidor—, quién la cargó, y la lista de notas incluidas **con
el monto de cada una**. Al pie aclara que ese monto es el valor de la nota
menos lo rechazado, convertido.

### 21.15 · Sin pago asociado
1. En una solicitud recién creada, mirar el bloque *Pago*

**Esperado:** dice que todavía no hay pago asociado y que se registra desde el
sistema de escritorio, autorizado por un usuario distinto del que lo carga. No
aparece como error ni como pendiente de la solicitud.

### 21.16 · Con pago asociado
1. Abrir una solicitud que **ya tenga pago** (hay que crearlo desde el desktop)

**Esperado:** el bloque *Pago* muestra el número, su estado, si es programado y
quién lo autorizó.

> Es lo único que esta app sabe del pago: se lee, no se toca.

### 21.17 · Constancia en PDF
1. En el detalle, *Constancia*

**Esperado:** el botón pasa a «Generando…» y después se abre el PDF. En iPhone
con la PWA instalada se abre **dentro** de la app y el gesto de volver regresa.

### 21.18 · Paginación
1. Con más de 10 solicitudes, *Cargar más*

**Esperado:** suma la página siguiente sin perder las anteriores, y el botón
desaparece al llegar al final.

### 21.19 · Un borrador se reconoce y se puede enviar *(el que importa)*
1. Abrir una solicitud en estado **Borrador** —filtro *Borradores*—

**Esperado:** el chip dice **Borrador** en gris, aparece un bloque **«Todavía es
un borrador»** avisando que **no la ve quien paga**, el bloque de pago dice que
no puede haber pago mientras lo sea, y la barra de abajo tiene **dos** botones:
*Solicitar* y *Constancia*.

2. Tocar *Solicitar* y leer la confirmación

**Esperado:** avisa que pasa a la cola de pagos y que **deja de ser corregible
desde el teléfono**. Al aceptar: «Enviada a pagos», el chip pasa a
**Solicitado**, desaparece el bloque de borrador y la barra queda solo con
*Constancia*.

> Es la diferencia entre pedir un pago y no pedirlo. El diálogo con el que
> tesorería paga solo mira `SOLICITADO` y `PARCIAL`.

### 21.20 · Una solicitada no se puede volver a solicitar
1. En una solicitud ya **Solicitada**, mirar la barra

**Esperado:** *Solicitar* no está. Solo *Constancia*.

> Reabrir —volver a borrador— es del sistema de escritorio, no de acá.

---

## Qué no está implementado todavía

Para que no se reporte como falla:

| Área | Estado |
|---|---|
| Operaciones | De caja chica, el alta y la rendición |
| Pagos | El **pago** en sí: alta, cuotas y autorización son del sistema de escritorio. Acá solo se lee el pago de una solicitud |
| Solicitud de pago: editar, reabrir, cancelar y borrar | No portados. Crear, enviar a pagos y consultar sí. Reabrir —volver de Solicitado a borrador— y editar son del escritorio |
| Inventario: carga del conteo y zonas | No portado — la consulta sí |
| Producto: detalle, edición, modo kiosco | No portados — la búsqueda sí |
| Recibir push (FCM) | No portado — la bandeja sí |
| Aprobar vales desde la bandeja | El mobile nunca tuvo la mutation |
| Escáner de códigos | Implementado — falta probarlo en dispositivos de sucursal |
| Suscripciones GraphQL | Falta configurar el transporte WebSocket |
| Reconocimiento facial | No portado |
| Actualización de la app instalada | **No funciona todavía** — el service worker no adopta una versión y no hay manejo de `SwUpdate`. Ver bloque 5.4 |
| Ícono de la PWA | Es el de Angular, no la marca |

---

## Resumen para completar

| Bloque | Casos | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| 1 · Arranque y sesión | 8 | | | |
| 2 · Navegación y shell | 5 | | | |
| 3 · Caja | 8 | | | |
| 4 · Sistema de diseño | 10 | | | |
| 5 · PWA | 4 | 3 | 1 | |
| 6 · Accesibilidad | 5 | | | |
| 7 · Abrir y cerrar caja | 9 | | | |
| 8 · Mi trabajo | 5 | | | |
| 9 · Mis finanzas | 7 | | | |
| 10 · Escáner, vía ZXing (Safari en Mac) | 6 | 6 | | |
| 11 · iOS real *(necesita dispositivo)* | 7 | | | |
| 12 · Buscar producto | 9 | | | |
| 13 · Devoluciones | 7 | | | |
| 14 · Venta con tarjeta | 6 | | | |
| 15 · Marcación | 7 | | | |
| 16 · Notificaciones | 7 | | | |
| 17 · Caja chica | 5 | | | |
| 18 · Transferencias | 5 | | | |
| 19 · Inventario | 5 | | | |
| 20 · Recepción de mercadería | 21 | | | |
| 21 · Solicitud de pago | 20 | 18 | | |
| **Total** | **166** | | | |

### Los cinco que más importan

Si el tiempo es corto, empezá por estos: son los que verifican las correcciones de bugs críticos.

1. **1.1 y 1.2** — el saludo con tu nombre y el acceso a Caja según rol
2. **1.3** — recargar mantiene la sesión
3. **3.4** — el detalle de caja abre con datos
4. **4.5** — `10.50` se interpreta como diez con cincuenta, **probado en el teléfono**
5. **3.6** — la diferencia de arqueo en rojo, y sin `-0`
