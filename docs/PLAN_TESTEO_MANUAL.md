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
13. **El detalle de inventario no abría contra el central real.** La consulta pedía tres campos que el central no expone —`producto` y `creadoEn` sobre `InventarioProducto`, `copiedFromItemId` sobre el ítem— y con uno solo que sobre, rechaza la consulta **entera**: la pantalla mostraba «No se pudieron cargar los datos» con el `FieldUndefined` crudo. `InventarioProducto` es **una zona**, no un producto: el central le sacó `producto_id` a esa tabla (migración `V61.1`) y el producto sale de `presentacion.producto`. `copiedFromItemId` nunca existió del lado del servidor: en `frc-mobile` es una marca de memoria del diálogo de edición que `toInput()` no manda.
14. **Bugs latentes en abrir/cerrar caja** (todavía sin pantalla): se mandaba `cajaInput` donde la mutation declara `$input`; el cierre omitía `$input` y mandaba un `sucursalId` no declarado; el resultado es un objeto `{ exito, cajaId }`, así que el aviso de éxito salía también con `exito: false`. Más un `$susId` inexistente en `cajasPorFecha` y un `imprimirBalance` sin alias `data:`.

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
- [ ] La instancia **alpha** del central accesible en **`https://alpha-api.frcsuite.com`**

> ⚠️ **La dirección cambió el 2026-08-14.** El alpha del central **no está** en
> `159.203.86.103:8083`: ahí había una instancia vieja que se apagó. El alpha
> real corre en `mauro` y se alcanza por `https://alpha-api.frcsuite.com`, que
> es un túnel de Cloudflare. Si alguna guía todavía dice la IP con puerto, está
> vieja.

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

## Bloque 5 — PWA — ⚠️ **6 de 7** (Android real, 2026-08-07)

> **Falta un solo caso: la segunda mitad de 5.5.** 5.1, 5.2, 5.3, 5.4, 5.6 y
> 5.7 pasaron contra el teléfono.

> Corrido en un Motorola edge 60 pro por adb, con el build de producción
> servido estático.
>
> **5.4 falló y se arregló el mismo día.** La causa era
> `registrationStrategy: 'registerWhenStable:30000'`: en una app zoneless el
> service worker quedaba registrado pero **sin adoptar nunca una versión**. Con
> `registerImmediately` adopta versión al arrancar, y encima se sumó el aviso
> con postergación y el control manual en Mi cuenta. Los casos 5.4 a 5.7
> describen el comportamiento nuevo.
>
> Queda abierto **5.2**: el ícono sigue siendo el de Angular.

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

✅ **Pasó** (2026-08-07), después de reemplazar los íconos: eran los del
andamiaje de Angular. Ahora salen de `resources/icon.png` de `frc-mobile` —el
mismo que usa la app Android en producción— redimensionados con `sips`.

> ⚠️ **Son dos familias, no una.** El logo llena el cuadro hasta los bordes, así
> que declararlo `maskable` haría que Android le corte las letras al aplicar la
> máscara circular. Por eso hay dos juegos:
> `icon-{n}.png` con `purpose: any` —el logo completo— e
> `icon-maskable-{n}.png` con el logo al **66 %** centrado sobre su propio rojo
> (`#b40000`), que es el margen que pide el recorte. Antes los ocho íconos
> estaban declarados `"maskable any"`, que es pedirle a la misma imagen dos
> cosas incompatibles.
>
> Verificado en el diálogo de instalación del teléfono: se lee **BODEGA
> FRANCO** entero, sin recorte.

### 5.3 · Orientación
1. Rotar el teléfono con la PWA instalada

**Esperado:** se mantiene en vertical (`orientation: portrait`).

✅ **Pasó.** Forzando la rotación del sistema a horizontal, la app siguió
vertical (`mLastNonFullscreenOrientation=1`).

### 5.4 · Actualización *(el que importa)*
1. Con la PWA instalada y abierta, compilar una versión nueva y servirla
2. Esperar, o entrar a **Mi cuenta → Aplicación** y tocar *Buscar*

**Esperado:** aparece un diálogo **«Hay una versión nueva»** que nombra la
versión y avisa que actualizar recarga la app, con dos salidas: **Actualizar** y
**Ahora no**.

3. Tocar *Actualizar*

**Esperado:** la app se recarga sola y queda en la versión nueva. En
*Mi cuenta → Aplicación*, **Versión** pasa a ser la que ofrecía el diálogo.

> ⚠️ **Cerrar y reabrir la app no alcanza y no es un fallo**: el WebAPK
> restaura la página en vez de re-navegar. Por eso existe el aviso.

✅ **Pasó** (2026-08-07). El diálogo apareció solo, sin forzar nada.

### 5.5 · Postergar, y que vuelva a preguntar
1. Con una versión esperando, tocar **Ahora no**
2. Seguir usando la app

**Esperado:** el diálogo se cierra y **no vuelve a molestar**. La app sigue
funcionando con la versión vieja, sin recargar nada.

3. Ir a *Mi cuenta → Aplicación*

**Esperado:** el botón dice **Actualizar a {{versión}}** — postergar no esconde
la actualización, la corre de lugar.

4. Dejar pasar **2 horas**, o compilar y servir **otra** versión

**Esperado:** vuelve a ofrecerla. Con una versión distinta pregunta enseguida,
sin esperar las 2 horas: postergar la de ayer no cubre la de hoy.

> Es el caso que motiva todo el diseño: el operador está en medio de una
> recepción y dice «ahora no». Si nadie le vuelve a preguntar, se queda en una
> versión vieja para siempre y no se entera.

✅ **Pasó lo verificable sin esperar:** el aviso aparece, *Ahora no* guarda la
postergación con su hash y su momento, una segunda consulta **dentro** de la
ventana no vuelve a molestar, y el botón queda en Mi cuenta.

❌ **Falta la reaparición pasada la espera**, y probarla necesita instrumentar,
porque nadie va a esperar dos horas mirando el teléfono. El procedimiento, que
ya se usó una vez y funciona:

```bash
# 1. Acortar los dos tiempos, que están en dos archivos distintos
#    ESPERA_MS  → src/app/core/actualizacion/actualizacion-reglas.ts
#    setInterval → src/app/core/actualizacion/actualizacion.service.ts
#    10 * 1000 y 15 * 1000 alcanzan.
npm run build
# 2. Aplicar esa build en el teléfono (el aviso la va a ofrecer sola).
# 3. Compilar otra versión cualquiera para tener algo pendiente.
# 4. Cuando aparezca el aviso: "Ahora no", y esperar ~30 segundos sin tocar nada.
```

**Esperado:** el aviso **reaparece solo**, sin que nadie toque nada.

⚠️ **Revertir los dos tiempos antes de commitear.** Y ojo con el atajo fácil:
recargar la página **aplica** la versión pendiente, así que un `location.reload()`
destruye el escenario en vez de probarlo.

### 5.6 · Actualizar a mano desde Mi cuenta
1. Sin ninguna versión esperando, ir a *Mi cuenta → Aplicación*

**Esperado:** el botón dice **Buscar**. Al tocarlo, si no hay nada, avisa
«Ya estás en la última versión».

2. Con una versión esperando, tocar **Actualizar a {{versión}}**

**Esperado:** aplica y recarga, igual que desde el diálogo.

✅ **Pasó** (2026-08-07).

### 5.7 · Qué versión estoy usando
1. *Mi cuenta → Aplicación*

**Esperado:** **Versión** y **Compilación**. Mientras el repo no tenga
versionado, la versión es la fecha de compilación **con la aclaración
«(sin versionar)»**, para que nadie lea una fecha creyendo que es una versión
publicada. Cuando `semantic-release` empiece a numerar, ahí va a decir
`v1.10.0-alpha.11` y la fecha se corre a *Compilación*.

⚠️ **Sin verificar en pantalla**: el cambio se hizo después de la última pasada.

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

### 19.2 · El detalle abre *(el que importa)*
1. Abrir cualquier inventario de la lista

**Esperado:** carga el resumen. **No** aparece «No se pudieron cargar los
datos» con un texto de `Validation error of type FieldUndefined`.

> Es la regresión de esta corrección: la consulta pedía `producto` y
> `creadoEn` sobre `InventarioProducto` y `copiedFromItemId` sobre el ítem,
> tres campos que el central no tiene. Con uno solo que sobre, el central
> rechaza la consulta **entera** y la pantalla no muestra nada.

### 19.3 · Resumen del conteo
1. Abrir uno con ítems contados

**Esperado:** zonas, concluidas, ítems contados, revisados, con diferencia y
**diferencia total con signo** — `+` sobrante, `−` faltante. Ya no hay línea
«Arrastrados»: el central no guarda de dónde se copió un ítem.

### 19.4 · Una card por zona
1. Mirar la lista de abajo

**Esperado:** el título de cada card es la **zona** y abajo el sector — no un
nombre de producto ni la palabra «Producto» repetida. Cada una con su
diferencia al costado, en rojo si es negativa, y al pie `N de M contados`.

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

---

## Bloque 22 — Crédito en Inicio *(nuevo)*

> **Sin ejecutar.** Necesita un usuario cuya persona esté registrada como
> cliente con convenio. Un usuario sin convenio prueba 22.4, que también hay
> que correr.

### 22.1 · Los valores arrancan tapados
1. Entrar a la app.

**Esperado:** arriba de los accesos rápidos hay una tarjeta *Crédito
disponible* que muestra `₲ ••••••` en los tres importes. **No** el saldo.

> Es a propósito: la pantalla se abre en el salón y el saldo de una persona no
> es para leerse por encima del hombro.

### 22.2 · Destapar y que quede destapado
1. Tocar el ojo de la tarjeta.
2. Cerrar la app por completo y volver a abrirla.

**Esperado:** al tocar aparecen disponible, gastado y límite. Al volver a
entrar siguen visibles: la preferencia se guarda.

### 22.3 · La barra sigue al gasto
1. Con los valores visibles, mirar la barra.

**Esperado:** verde mientras sobra crédito, ámbar a partir del 75 % gastado,
roja si el disponible quedó negativo. Con los valores tapados la barra queda
**vacía** — si no, filtraría de un vistazo lo que el ojo acaba de tapar.

### 22.4 · Sin convenio no hay tarjeta
1. Entrar con un usuario cuya persona no sea cliente.

**Esperado:** no aparece ninguna tarjeta de crédito. **No** una tarjeta en
cero: eso diría que agotó su crédito.

### 22.5 · Lleva al detalle
1. Tocar la tarjeta (no el ojo).

**Esperado:** abre *Mis finanzas*. Tocar el ojo **no** navega.

### 22.6 · Con el central caído
1. Apagar el central y entrar a la app.

**Esperado:** la tarjeta dice que no se pudo cargar y ofrece *Reintentar*. El
resto de Inicio se ve normal y **no** aparece un toast rojo tapando la
bienvenida.

---

## Bloque 23 — Escáner universal *(nuevo)*

> **Ruteo verificado** por carga manual contra alpha: transferencia, código de
> barras y QR de sucursal. **Falta con la cámara real** y falta el resto de
> los tipos, que necesitan un QR de cada uno.

### 23.1 · El botón está en todas partes
1. Recorrer Inicio, Operaciones, Buscar, Cuenta, una lista y un detalle.

**Esperado:** el botón redondo de escaneo está abajo a la derecha en todas.
En las pantallas con barra de acciones fija —guardar, finalizar— queda
**encima** de la barra, sin taparla.

### 23.2 · Lee un producto y lo abre
1. Tocar el botón y escanear el código de barras de un producto.

**Esperado:** cae en *Buscar* con el producto ya resuelto, sin pedir la cámara
de nuevo. La URL lleva `?codigo=…`, así que recargar lo vuelve a resolver.

### 23.3 · Lee un QR de transferencia
1. Escanear el QR que comparte una transferencia.

**Esperado:** abre esa transferencia.

### 23.4 · Lee un QR de inventario
1. Escanear el QR que comparte un inventario.

**Esperado:** abre ese inventario. ⚠️ El generador **no escribe `idOrigen`**
en este tipo: si abre el inventario equivocado o el número 0, es este caso.

### 23.5 · Lee un QR de recepción
1. Escanear el QR de una recepción de mercadería.

**Esperado:** abre esa recepción.

### 23.6 · El cupón de tarjeta sigue exigiendo la caja
1. Sin caja abierta, escanear un QR de venta con tarjeta desde **cualquier**
   pantalla.

**Esperado:** avisa que no hay caja abierta. **No** llega al formulario de
registro. El control tiene que ser el mismo que tocando *Escanear cupón*
dentro del módulo.

### 23.7 · El QR de sucursal explica en vez de fallar
1. Escanear el QR del cartel de un depósito.

**Esperado:** avisa que ese QR identifica una sucursal y hay que escanearlo
desde la pantalla donde se la necesita. No navega.

### 23.8 · Un QR ajeno
1. Escanear cualquier QR que no sea del sistema (una URL, un wifi).

**Esperado:** lo trata como código de producto y termina en *Buscar* sin
resultados. No rompe.

### 23.9 · En iPhone
1. Repetir 23.2 en Safari de iOS.

**Esperado:** la cámara abre igual (por ZXing) y el ruteo es el mismo.

---

## Bloque 24 — Configuración en Mi cuenta *(nuevo)*

### 24.1 · Los datos de la persona
1. Cuenta → *Mis datos*.

**Esperado:** documento, apodo, teléfono, email, nacimiento y ciudad, de solo
lectura. Los que no estén cargados dicen `—`.

> ⚠️ **Si el nacimiento dice `01/01/1970`, es un fallo.** El central manda la
> época cuando la fecha no está cargada y la app tiene que leerla como
> ausente.

### 24.2 · Tema con tres estados
1. Cuenta → *Preferencias* → Tema.

**Esperado:** ofrece *Del sistema*, *Claro* y *Oscuro*. Elegir *Del sistema* y
cambiar el tema del teléfono cambia la app sola.

### 24.3 · Cambiar de servidor avisa antes
1. Cuenta → *Aplicación* → tocar la URL del servidor.
2. Escribir otra y confirmar.

**Esperado:** primero pide la URL; después avisa que **va a cerrar la sesión**
y pide confirmar. Al aceptar, termina en el login.

### 24.4 · Cancelar no cambia nada
1. Repetir 24.3 y cancelar en el segundo diálogo.

**Esperado:** sigue con la sesión abierta y contra el servidor viejo.

### 24.5 · Preferencias de notificación
1. Cuenta → *Preferencias* → Notificaciones → *Configurar*.

**Esperado:** abre la pantalla de preferencias de notificaciones.

### 24.6 · El badge de no leídas
1. Con notificaciones sin leer, entrar a la app y mirar Inicio.

**Esperado:** el acceso *Notificaciones* muestra el número. Con más de 99 dice
`99+`. Al marcar todas como leídas, desaparece.

> El conteo se pide **al entrar**, no al abrir la bandeja: si solo aparece
> después de visitar Notificaciones, es un fallo.

---

## Bloque 25 — Productos vencidos *(nuevo)*

### 25.1 · Abre en lo ya vencido
1. Inicio → *Productos vencidos*.

**Esperado:** el filtro *Qué mostrar* está en **Ya vencidos** y las primeras
filas dicen *Vencido hace N días* en rojo.

> ⚠️ Si encabeza con *«1500 días restantes»*, el filtro no se aplicó. El
> central pagina con `ORDER BY vencimiento DESC` y sin acotar la ventana lo
> menos urgente queda arriba.

### 25.2 · Los próximos 30 días
1. Cambiar *Qué mostrar* a *Vencen en 30 días*.

**Esperado:** trae lo que vence dentro del mes. Vuelve a la primera página.

### 25.3 · Filtrar por sucursal
1. Elegir una sucursal.

**Esperado:** solo filas de esa sucursal, desde la página 1. En la lista
**no** aparecen SERVIDOR ni COMPRAS: no tienen depósito.

### 25.4 · De dónde salió la fecha
1. Mirar el pie de una fila.

**Esperado:** dice el origen — *Nota de compra #…*, *Transferencia #…* o
*Inventario #…* — con su fecha.

### 25.5 · Cuando el conteo contradice
1. Buscar una fila con la línea ámbar *Según inventario: …*

**Esperado:** aparece **solo** donde el inventario dice otra cosa que la
fuente elegida. Es la razón por la que alguien discute una fila.

---

## Bloque 26 — Modo kiosco *(nuevo)*

> **Corrido contra alpha** con un código real: autofoco, no encontrado y
> producto con precio. **Falta con un lector HID físico** y en una tablet.

### 26.1 · Abre listo para leer
1. Inicio → *Consultar precio*.

**Esperado:** pantalla completa, **sin** barra inferior y **sin** botón de
escaneo flotante. El campo ya tiene el foco sin tocar nada.

### 26.2 · El lector escribe y enter resuelve
1. Con un lector HID conectado, pasar un producto.

**Esperado:** aparece la descripción grande y el precio por presentación. El
campo queda vacío y enfocado para el siguiente.

### 26.3 · El foco vuelve solo
1. Tocar en cualquier parte de la pantalla.
2. Pasar otro producto por el lector.

**Esperado:** lo lee igual. **Es el caso más importante del bloque**: si el
foco se pierde, el kiosco queda mudo sin que nadie se dé cuenta.

### 26.4 · Marca la presentación del código
1. Pasar el código de la **caja** de un producto que también se vende por
   unidad.

**Esperado:** se muestran las dos presentaciones con su precio, y la de la
caja queda resaltada con borde rojo.

### 26.5 · Producto inexistente
1. Escribir un código cualquiera y enter.

**Esperado:** *Producto no encontrado*, campo vacío, foco conservado.

### 26.6 · El precio no se queda para siempre
1. Consultar un producto y esperar sin tocar nada.

**Esperado:** a los ~20 segundos vuelve a *Pasá el producto por el lector*.
Sin esto, el próximo cliente lee un precio que no es el suyo.

### 26.7 · El escáner de la cámara no pierde el foco
1. En el kiosco, tocar el ícono de cámara.
2. En el diálogo, tocar *Ingresar a mano* y escribir un código.

**Esperado:** el texto entra en el campo del diálogo. Si las teclas no
aparecen en ningún lado, el foco se lo llevó el campo del kiosco que quedó
detrás del overlay.

### 26.8 · Salir
1. Tocar la X.

**Esperado:** vuelve a Inicio con la sesión intacta.

---

## Bloque 27 — Ficha de producto *(nuevo)*

### 27.1 · Llegar a la ficha
1. Buscar un producto → menú `⋮` → *Ver ficha del producto*.

**Esperado:** abre la ficha con la descripción como título.

### 27.2 · Todos los precios, no solo el principal
1. Mirar una presentación con más de un tipo de precio.

**Esperado:** los lista todos, con el principal marcado y primero.

### 27.3 · Los códigos, incluidos los de baja
1. Mirar los códigos de una presentación.

**Esperado:** se ven todos. Los inactivos aparecen **tachados**, no ocultos:
siguen pegados a cajas viejas.

### 27.4 · Características
1. Abrir un producto de balanza y uno que controle vencimiento.

**Esperado:** chips *De balanza*, *Controla vencimiento (N días)*,
*Cambiable* o *Envase* según corresponda.

### 27.5 · Existencia por sucursal
1. Mirar la última sección.

**Esperado:** una línea por sucursal operable, con `0,00` donde no hay
movimientos.

> ⚠️ **Si dice *No se pudo consultar*, el central no tiene
> `stockPorSucursales`.** Es una consulta nueva; contra una instancia vieja
> —alpha, hoy— es lo esperado. Lo que **no** puede pasar es que muestre todas
> las sucursales en cero: eso afirmaría que no hay mercadería.

---

## Bloque 28 — Rendición de caja chica *(nuevo)*

> **Sin ejecutar.** Necesita una solicitud **autorizada y con el retiro ya
> confirmado**, cuya rendición esté pendiente.

### 28.1 · El botón aparece cuando corresponde
1. Abrir una solicitud con el retiro confirmado y sin rendir.

**Esperado:** al pie dice *Rendir gasto*. En una sin retirar aparece
*Confirmar retiro*; en una ya rendida, ninguno de los dos.

> Se mira `estadoRendicion`, que es una máquina **separada** de `estado`: una
> solicitud puede estar retirada con la rendición pendiente.

### 28.2 · Sin comprobante no se rinde
1. Escribir el monto y no adjuntar nada.

**Esperado:** *Registrar rendición* queda deshabilitado. Es regla del
negocio, no del formulario: sin comprobante no hay rendición.

### 28.3 · Sacar la foto con la cámara
1. Tocar *Agregar* en *Factura o comprobante*.

**Esperado:** el teléfono abre la cámara directamente. La foto queda como
miniatura con una X para quitarla.

### 28.4 · Elegir una foto de la galería
1. En el mismo selector, elegir una foto ya sacada.

**Esperado:** entra igual. Es el caso de quien rinde al día siguiente.

### 28.5 · La foto llega derecha
1. Sacar una foto **vertical** con un Android.

**Esperado:** la miniatura se ve vertical, no acostada. Si sale rotada, es la
orientación EXIF.

### 28.6 · Campos de combustible
1. Rendir un gasto cuyo tipo sea combustible o de vehículo.

**Esperado:** además del monto pide kilómetros, litros y precio por litro.

### 28.7 · Campos de alimentación
1. Rendir un gasto de alimentación.

**Esperado:** pide el establecimiento.

### 28.8 · Guardar
1. Con monto y al menos una factura, tocar *Registrar rendición*.

**Esperado:** avisa que se registró y vuelve al detalle, donde la rendición
aparece en la lista con su monto.

### 28.9 · Una sola moneda
1. Mirar el formulario.

**Esperado:** pide **un** importe, no una lista con monedas.

> Es a propósito. `GastoRendicionInput.montoTotal` es un solo `Float` sin
> moneda: `frc-mobile` ofrecía varias filas y al guardar mandaba solo la de
> guaraníes, descartando el resto sin avisar.

---

## Bloque 29 — Carga del conteo de inventario *(nuevo)*

> **Sin ejecutar.** Necesita un inventario **abierto** con productos cargados.

### 29.1 · El botón solo en inventarios abiertos
1. Abrir un inventario abierto y uno concluido.

**Esperado:** en el abierto cada zona tiene *Contar*. En el concluido, no:
escribir encima cambiaría el resultado de una toma cerrada.

### 29.2 · Un renglón por presentación, con su producto
1. Entrar a contar una zona que tenga varios productos, alguno con unidad y
   caja.

**Esperado:** el título de la pantalla es la **zona**. Un bloque por
presentación, titulado con la **descripción del producto**, y adentro
`Cantidad: N · Sistema: …`, el campo *Contado*, vencimiento y estado.

> Si todos los bloques se llaman igual —«Producto», o solo `Cantidad: 1`— no
> se sabe qué se está contando: el producto se lee de `presentacion.producto`,
> no de `InventarioProducto`.

### 29.3 · La diferencia se calcula mientras escribís
1. Escribir una cantidad distinta a la del sistema.

**Esperado:** al lado aparece la diferencia con signo — roja si falta, ámbar
si sobra— y cambia con cada tecla.

### 29.4 · Lo del sistema no se pisa
1. Guardar y volver a entrar.

**Esperado:** *Sistema* sigue mostrando el número original y *Contado* el que
se cargó. **La diferencia entre los dos es el resultado del inventario**: si
al volver son iguales, se perdió.

### 29.5 · Guarda solo lo tocado
1. Editar dos presentaciones de cinco y guardar.

**Esperado:** el botón dice *Guardar conteo (2)* y al terminar avisa. Si
alguna falla, lo dice y recarga igual para que se vea lo que sí entró.

### 29.6 · Estado de la mercadería
1. Marcar una presentación como *Averiado* y guardar.

**Esperado:** queda guardado. Averiados y vencidos alimentan devoluciones.

---

---

## Bloque 30 — Permisos por rol *(nuevo)*

> **Ejecutado completo el 2026-08-14 contra el central local**, con un
> usuario `test.roles` creado para esto y siete pasadas sumando y sacando
> roles. **Los 6 casos: ✅.**
>
> | Pasada | Roles | Resultado |
> |---|---|---|
> | 1 | *(ninguno)* | Inicio sin Caja/Inventario/Transferencias; Operaciones con las 3 abiertas; **las 4 rutas rebotan** |
> | 2 | `VENTA TOUCH` | Aparecen Caja y Venta con tarjeta; `/operaciones/caja` entra |
> | 3 | `+ VER INVENTARIO` | Aparece Inventario; su ruta entra |
> | 4 | `+ VER TRANSFERENCIA` | Aparece Transferencias; su ruta entra |
> | 5 | `+ RECIBIR PEDIDOS` | Aparece Recepción; su ruta entra |
> | 6 | `+ RRHH APROBAR`, sin ADMIN | Aparece Aprobaciones en Mi trabajo — **con el código viejo, que pedía `DIRECTIVO`, no habría aparecido nunca** |
> | 7 | **solo** `ADMIN` | 12 accesos, 6 cards y las 5 rutas entran |
>
> En cada pasada, lo que **no** correspondía siguió rebotando a Inicio. Los
> accesos de autoservicio y consulta —Buscar, Vencidos, Consultar precio,
> Notificaciones, Marcación, Mi trabajo, Mis finanzas, Mi cuenta— estuvieron
> visibles en las cinco, que es lo esperado.

> ⚠️ **Los roles se toman al iniciar sesión.** Cambiarlos en la base no se
> refleja hasta recargar la app. Si al probar «no cambió nada», es esto.

> ⚠️ **Para asignar un rol por SQL: `usuario_role.user_id`, no
> `usuario_id`.** La tabla tiene **dos** FK a `usuario`: `user_id` es quien
> **tiene** el rol y `usuario_id` es la auditoría de quién lo asignó. Escribir
> en la segunda no da error y el rol simplemente no aplica.

> Para repetirlo hace falta un usuario **sin** `VER INVENTARIO`,
> `VER TRANSFERENCIA` ni `VENTA TOUCH`. Con un ADMIN este bloque no prueba
> nada: ADMIN entra a todo, que es lo correcto.

### 30.1 · El menú esconde lo que no corresponde
1. Entrar con el usuario restringido.

**Esperado:** en Inicio **no** aparecen Caja, Inventario ni Transferencias.
Sí aparecen Buscar, Productos vencidos, Consultar precio, Notificaciones,
Marcación, Mi trabajo, Mis finanzas y Mi cuenta.

### 30.2 · La URL escrita a mano tampoco entra
1. Con ese mismo usuario, escribir `/inventario` en la barra de direcciones.

**Esperado:** vuelve a Inicio y avisa *«No tenés permiso para entrar a esa
sección»*. **Es el caso que más importa del bloque**: si entra, esconder el
ítem del menú era decorativo.

2. Repetir con `/transferencias`, `/operaciones/caja` y
   `/operaciones/recepcion`.

### 30.3 · ADMIN entra a todo
1. Entrar con el usuario ADMIN.

**Esperado:** ve las 12 opciones y entra a todas. No es un permiso más: es con
el que soporte revisa cuando alguien reporta algo.

### 30.4 · Operaciones esconde sus cards
1. Con el usuario restringido, abrir **Operaciones**.

**Esperado:** no se ven Caja, Venta con tarjeta ni Recepción de mercadería. Sí
se ven Caja chica, Solicitudes de pago y Devoluciones — que quedan abiertas a
propósito, ver `permisos.ts`.

### 30.5 · Recepción de mercadería, el caso a mirar de cerca
1. Con un usuario de depósito que **no** sea ADMIN, abrir Operaciones.

**Esperado:** ve *Recepción de mercadería* **solo si tiene `RECIBIR PEDIDOS`**.

> ⚠️ **Al 2026-08-14 solo 2 usuarios de 404 tienen ese rol.** Es el rol
> correcto, pero está muy poco repartido. Si el personal de depósito reporta
> que la opción desapareció, el arreglo es **asignarles el rol**, no sacar el
> guard.

> 🐛 **La pasada 6 encontró un hueco y se arregló acá mismo.** Al sacar
> `RRHH APROBAR`, el botón de Aprobaciones desaparecía pero
> `/mi-trabajo/aprobaciones` **seguía entrando**: el área estaba declarada en
> `PERMISOS` y la ruta no tenía su `rolGuard`. Es exactamente el defecto que
> este bloque busca. Hoy las 6 áreas de `PERMISOS` tienen guard; **si se
> agrega una séptima, hay que poner las dos mitades**.

### 30.6 · Aprobaciones de RRHH
1. Entrar con un usuario con `RRHH APROBAR` y sin `ADMIN`, a Mi trabajo.

**Esperado:** ve el acceso a la bandeja de aprobaciones.

> Antes se pedía `DIRECTIVO`, **que no existe en la base**: el chequeo daba
> siempre falso y solo entraba ADMIN. Hoy `RRHH APROBAR` tampoco lo tiene
> nadie asignado, así que hasta que se reparta el comportamiento visible es el
> mismo — la diferencia es que ahora **se puede delegar**.

---

---

## Bloque 31 — Registro del rostro *(nuevo)*

> **Parcialmente ejecutado el 2026-08-14** contra el central local: la cámara
> abre, los modelos cargan y **una captura real pasó** los umbrales de calidad
> y de anti-spoofing. Falta completar las tres y guardar contra el central.

### 31.1 · Abre y prepara
1. Mi cuenta → **Mi rostro** → *Registrar*.

**Esperado:** pide permiso de cámara, se ve el video **espejado**, y mientras
carga dice que la primera vez descarga los modelos. Son ~10 MB: en una
conexión lenta tarda, y por eso lo avisa.

### 31.2 · Las cinco capturas
1. Tocar *Capturar* cinco veces, variando el ángulo según la sugerencia.

**Esperado:** cada captura enciende un punto y el contador avanza («3 de 5»).
El ángulo lo elige el usuario: la sugerencia orienta, no obliga.

> `frc-mobile` fuerza tres pasos en orden fijo; `frc-gourmet` deja capturar
> libremente hasta cinco. Se tomó el enfoque de gourmet con cinco
> obligatorias: más muestras hacen una galería mejor y es más rápido de
> completar que obedecer pasos.

### 31.3 · Rechaza una captura pobre
1. Taparse parte de la cara, alejarse mucho o buscar contraluz.

**Esperado:** avisa —«No se detectó un rostro» o «no quedó lo bastante
nítida»— y **no** avanza de paso.

> El umbral es `SCORE_MINIMO_GALERIA` (0,7) del sistema, no uno inventado
> acá: una captura pobre envenena la galería y hace fallar la marcación
> después, que es un problema mucho más difícil de diagnosticar.

### 31.4 · Rechaza una foto de una pantalla
1. Apuntar la cámara a una foto del rostro en otro teléfono.

**Esperado:** avisa que parece una foto de una pantalla. Es el anti-spoofing
de Human, activo igual que en `frc-mobile`.

### 31.5 · Guarda contra el central
1. Completar las tres capturas.

**Esperado:** avisa «Rostro registrado» y vuelve a Mi cuenta. En la base, el
usuario queda con su `embedding` y su `embeddingGaleriaJson`.

> ⚠️ **Verificar que la marcación por rostro siga reconociendo a alguien
> enrolado desde el Android.** El formato de galería se portó verbatim
> justamente para eso; es lo que hay que probar de punta a punta.

### 31.7 · Marcar con verificación facial
1. Marcación → *Marcar entrada* (o salida).

**Esperado:** antes de pedir la ubicación abre *Verificá tu rostro*, con la
cámara y tres indicadores de acierto. Al reconocerte, cierra solo y sigue con
el GPS.

> El orden es a propósito: **quién sos antes de dónde estás**. La cara puede
> fallar por decisión del usuario —cancelar, no tener rostro cargado— y no
> tiene sentido esperar el GPS para descubrirlo.

### 31.8 · No reconoce a cualquiera
1. Abrir la verificación y **no** ponerse frente a la cámara. Esperar.

**Esperado:** los tres indicadores quedan apagados y dice «Acercate y buscá
mejor luz». **Nunca** verifica solo. Verificado el 2026-08-14: cero aciertos
sin rostro.

2. Probar con la foto de la persona en otra pantalla.

**Esperado:** avisa que tiene que ser el rostro real. Es el anti-spoofing.

### 31.9 · Los aciertos tienen que ser consecutivos
1. Ponerse frente a la cámara, salir del cuadro a mitad de camino, volver.

**Esperado:** al salir, los indicadores vuelven a cero. No se acumulan
aciertos sueltos: si se pudiera, alcanzaría con insistir un rato con la foto
de otro.

### 31.10 · Sin rostro registrado se puede marcar igual
1. Con un usuario sin enrolar, marcar.

**Esperado:** dice que no hay rostro registrado y ofrece *Marcar igual*. Al
aceptar, la marcación se registra.

> No se bloquea a quien no enroló: hacerlo obligatorio de golpe dejaría sin
> marcar a casi todos. Cuando el enrolamiento esté repartido, esto pasa a
> exigirse.

### 31.11 · La galería mejora con el uso
1. Marcar con verificación facial varias veces.

**Esperado:** cada marcación verificada manda su embedding al central
(`incorporarEmbeddingMarcacion`), que decide si lo suma. **No** avisa nada al
usuario: la marcación ya quedó registrada y esto es una mejora, no un paso.

> Es lo que evita que el reconocimiento se quede con las cinco fotos del día
> del enrolamiento mientras la persona cambia de peinado, anteojos o luz.

---

### 31.6 · Funciona sin internet
1. Registrar una vez con internet. Después cortar la salida a internet
   —dejando el central accesible— y volver a entrar a la pantalla.

**Esperado:** funciona igual. Los modelos quedaron cacheados por el service
worker.

> Es la diferencia con `frc-mobile`, que los baja de `cdn.jsdelivr.net`: allá,
> una sucursal sin salida a internet **no puede usar reconocimiento facial**.

---

---

## Bloque 32 — Compartir por QR *(nuevo)*

> **Verificado el 2026-08-14** en recepción: el QR se dibuja y el escáner de
> la app lo lee y abre el registro correcto. Falta probarlo **entre dos
> teléfonos**, que es el caso real.

### 32.1 · Compartir una recepción
1. Abrir una recepción → botón de código en la barra superior.

**Esperado:** un QR sobre **fondo claro**, con «Recepción #N» debajo.

> El fondo es claro en los dos temas y tiene token propio: un QR sobre fondo
> oscuro no lo lee ningún lector.

### 32.2 · El otro lo escanea y llega al mismo lugar
1. Con **otro teléfono**, tocar el botón flotante y escanear ese QR.

**Esperado:** abre la misma recepción. **Es el caso que importa**: la
generación y la lectura tienen que coincidir campo por campo.

### 32.3 · Lo mismo con inventario y transferencia
1. Repetir desde el detalle de un inventario y de una transferencia.

**Esperado:** cada uno abre el suyo.

> ⚠️ **El id no va en el mismo campo para los tres.** Inventario lo pone en
> `idCentral` y no escribe `idOrigen`; transferencia usa los dos. Si un QR
> abre el registro equivocado —o el número 0— es esto. Ver
> `docs/arquitectura/qr-del-sistema.md`.

### 32.4 · Copiar el código
1. Tocar *Copiar código* y pegarlo en la carga manual del escáner del otro.

**Esperado:** llega al mismo lugar que escaneando. Sirve cuando no se puede
apuntar la cámara — dos personas por teléfono, o una pantalla rota.

---

---

## Bloque 33 — Instalar la app y filtros por URL *(nuevo)*

### 33.1 · Ofrece instalar en Android
1. Abrir la app en Chrome de Android, sin tenerla instalada.
2. Mi cuenta → *Aplicación*.

**Esperado:** aparece *Instalar la app*. Al tocarlo sale el diálogo del
navegador; si se acepta, la opción desaparece.

> El botón solo aparece si el navegador avisó que se puede instalar. No se
> muestra uno «por las dudas»: un botón que no hace nada es peor que ninguno.

### 33.2 · En iPhone explica, no ofrece
1. Abrir en Safari de iOS y mirar la misma sección.

**Esperado:** dice *Compartir → Añadir a inicio*. **No** hay botón: iOS no
tiene prompt de instalación y no hay forma de dispararlo.

> ⚠️ Si esa instrucción aparece en **Chrome de escritorio**, es la detección
> de iPadOS dando falso positivo — pasa con la emulación de dispositivo
> activada, que también reporta pantalla táctil.

### 33.3 · Instalada, no ofrece nada
1. Abrir la app ya instalada.

**Esperado:** la fila de instalar no está.

### 33.4 · Transferencias acotadas por URL
1. Abrir `/transferencias?etapa=TRANSPORTE_EN_CAMINO`.

**Esperado:** solo transferencias en esa etapa, con el aviso «Lista acotada
por el filtro con el que llegaste».

2. Probar `/transferencias?sucursal=3` y las dos juntas.

**Esperado:** acota por sucursal de **destino** — el caso es «qué viene en
camino para acá».

### 33.5 · Una etapa inventada no rompe
1. Abrir `/transferencias?etapa=CUALQUIERA`.

**Esperado:** trae la lista completa, sin error. La etapa se valida contra el
enum antes de mandarla; una cadena libre haría que el central rechace la
consulta entera.

---

---

## Bloque 34 — Control de inventario *(nuevo)*

> **Verificado el 2026-08-14** contra el central local: «Saldo negativo» sin
> filtrar devolvió 16.263 productos y la lista paginó.

### 34.1 · Los tres reportes
1. Inicio → *Control inventario*. Cambiar *Qué mirar* entre las tres opciones.

**Esperado:**

| Reporte | Qué trae |
|---|---|
| Saldo negativo | se sacó más de lo que había — casi siempre falta cargar una entrada |
| Saldo positivo | sobra contra el sistema |
| Sin movimiento | no se movió en los últimos 30 días |

> `frc-mobile` los esconde detrás de un menú de acciones. Acá son un selector,
> porque cuál está activo **es** la pregunta de la pantalla.

### 34.2 · «Sin movimiento» exige sucursal
1. Elegir *Sin movimiento* sin sucursal.

**Esperado:** pide elegir una y explica que se calcula sobre los últimos 30
días de una sucursal. Los otros dos reportes sí aceptan «Todas».

> No es un capricho: un faltante solo significa algo dentro de un período,
> mientras que un saldo es un estado actual. El schema del central lo refleja
> — `productosFaltantes` declara sucursal y fechas obligatorias.

### 34.3 · El saldo se lee de un vistazo
1. Mirar la columna derecha.

**Esperado:** los negativos en rojo con signo, los positivos en ámbar con `+`.

### 34.4 · Lleva a la ficha
1. Tocar un producto.

**Esperado:** abre su ficha, que es la pregunta que sigue: qué códigos y qué
precios tiene el producto cuyo saldo no cierra.

### 34.5 · Solo sucursales operables
1. Abrir el selector de sucursal.

**Esperado:** no aparecen SERVIDOR ni COMPRAS: sin depósito no hay saldo que
controlar.

---

## Qué no está implementado todavía

Para que no se reporte como falla:

| Área | Estado |
|---|---|
| Operaciones | De caja chica, **el alta** de la solicitud. La rendición ya está (bloque 28) |
| Pagos | El **pago** en sí: alta, cuotas y autorización son del sistema de escritorio. Acá solo se lee el pago de una solicitud |
| Solicitud de pago: editar, reabrir, cancelar y borrar | No portados. Crear, enviar a pagos y consultar sí. Reabrir —volver de Solicitado a borrador— y editar son del escritorio |
| Inventario: agregar un producto que la toma no incluye | No portado. Abrir la toma (bloque 39), agregarle zonas (bloque 40), contar (bloque 29), revisar (35) y finalizar sí. Sumar a una zona una presentación que no está necesita el buscador paginado y el alta de ítem |
| Histórico de recepción | **No hace falta**: la lista de recepciones de la PWA ya usa la misma consulta que el histórico del Android (`delUsuario`), paginada y con todos los estados |
| Producto: **edición y alta** | No portados. Detalle, modo kiosco y vencidos ya están (bloques 25 a 27) |
| Kiosco: selector de moneda | No portado **a propósito**: `frc-mobile` convertía multiplicando en el cliente, y acá el dinero lo calcula el backend. Necesita que el central mande el precio convertido |
| Recibir push (FCM) | No portado — la bandeja sí |
| Aprobar vales desde la bandeja | El mobile nunca tuvo la mutation |
| Escáner de códigos | Implementado — falta probarlo en dispositivos de sucursal |
| Suscripciones GraphQL | Falta configurar el transporte WebSocket |
| Reconocimiento facial | No portado |
| Versionado | `package.json` está en `0.0.0` y no hay tags. La app muestra la fecha de compilación **con la aclaración «(sin versionar)»** hasta que `semantic-release` empiece a numerar |

---

## Bloque 35 — Revisión de inventario *(nuevo)*

> **Verificado el 2026-08-14** contra el central local: el inventario 6579
> mostró su único ítem con estado `Modificado`, sistema 80 · contado 82,
> anterior 82 y diferencia `+2` — que es exactamente lo que tiene la base.

### 35.1 · Se llega desde el inventario
1. Operaciones → *Inventario* → abrir uno → botón **Revisar**.

**Esperado:** abre «Revisión de inventario» con los ítems de esa toma.

> El botón está también con el inventario **cerrado**: revisar es leer lo que
> quedó, y esa pregunta no caduca al finalizarlo.

### 35.2 · El selector ordena, no filtra
1. Cambiar *Orden* a «Modificados primero».

**Esperado:** los modificados suben al principio, y **el resto sigue en la
lista**. El total no cambia.

> ⚠️ Acá `frc-mobile` confunde: al cambiar el criterio avisa «no se
> encontraron productos con el criterio seleccionado», que hace leer como
> filtro algo que el central resuelve con un `ORDER BY CASE`. Si en esta
> pantalla la lista se recorta al cambiar el orden, **eso es el bug**.

### 35.3 · Los tres estados dicen cosas distintas
1. Mirar el chip de cada ítem.

**Esperado:**

| Chip | Qué pasó |
|---|---|
| Cantidad exacta | se contó y coincidió con el sistema |
| Modificado | se contó y hubo que corregirlo |
| Sin revisar | nadie lo tocó todavía |

> No son una escalera de tres pasos: `verificado` y `revisado` son dos
> resultados del **mismo** paso, y nunca vienen los dos juntos.

### 35.4 · La diferencia solo aparece si se contó
1. Buscar un ítem sin contar.

**Esperado:** dice «sin contar» y **no** muestra diferencia. Un cero real y un
«nadie lo miró» no son lo mismo.

### 35.5 · Paginado
1. Abrir un inventario con más de 15 ítems y tocar *Cargar más*.

**Esperado:** agrega la página siguiente sin perder lo ya cargado ni repetir.

### 35.6 · El selector no queda en blanco
1. Entrar a la pantalla sin tocar nada.

**Esperado:** *Orden* muestra «Los últimos primero», no un campo vacío.

> ⚠️ Esto se rompió una vez y vale para **toda** la app: `mat-select` trata un
> valor `null` como «sin selección» y deja el campo en blanco aunque la opción
> exista y esté elegida. Lo mismo pasaba en *Control de inventario* con «Todas
> las sucursales». Si aparece un selector vacío que igual está consultando,
> el sospechoso es una opción cuyo valor es `null`.

---

## Bloque 36 — Lugares del depósito: sectores y zonas *(nuevo)*

> **Verificado el 2026-08-14** contra el central local: se creó la zona
> «ZONA DE PRUEBA PWA» en el sector 41 (quedó en la base con id 234,
> `activo = true`, `usuario_id` del que la creó) y se la eliminó desde la
> misma pantalla; la base volvió a cero filas.

### 36.1 · Se llega desde Inicio, con su propio rol
1. Entrar con un usuario que tenga `VER INVENTARIO` pero **no** `CREAR
   INVENTARIO`.

**Esperado:** *Lugares del depósito* **no** aparece en Inicio, y escribir
`/inventario/lugares` a mano tampoco entra.

> Es más restrictivo que el resto de inventario a propósito: acá se borra la
> geografía sobre la que se cuenta. `frc-mobile` no pide ningún rol —la
> pantalla cuelga de la toma, y cualquiera que llegue al inventario puede
> borrar zonas—.

### 36.2 · Solo sucursales operables
1. Abrir el selector de sucursal.

**Esperado:** no están SERVIDOR ni COMPRAS. Arranca en la sucursal propia.

### 36.3 · Alta de una zona
1. Abrir un sector → *Nueva zona* → escribir un nombre en minúsculas →
   *Guardar*.

**Esperado:** la lista suma una zona y el contador del encabezado sube. En la
base el nombre quedó **en mayúsculas**.

> Mayúsculas al guardar, titlecase al mostrar: es el par que usa
> `frc-mobile`, y hay que tomarlo entero. En la base conviven 35 sectores en
> minúscula con 6 en mayúscula; mostrar el texto crudo dejaría la lista
> pareciendo dos cargas distintas.

### 36.4 · Baja de una zona
1. Tocar una zona recién creada → *Eliminar* → confirmar.

**Esperado:** desaparece de la lista **y de la base**.

> ⚠️ Mirar las dos cosas. Antes de este bloque, `deleteZona` no aliaseaba su
> campo raíz a `data`, así que la baja se ejecutaba en el central y la app la
> reportaba como fallida. Si el cartel dice «el central no eliminó la zona»
> pero la fila ya no está, es exactamente ese bug de vuelta.

### 36.5 · Una zona con conteo encima no se borra
1. Intentar eliminar una zona que ya participó de un inventario.

**Esperado:** el central rechaza la baja y la app muestra el error. La salida
es **desactivarla**, no borrarla.

### 36.6 · Desactivar en vez de borrar
1. Editar una zona y apagar *Activo* → *Guardar*.

**Esperado:** queda en la lista con el chip *Inactiva*, y el diálogo avisa que
no se va a poder asignar en un conteo nuevo.

### 36.7 · Un sector con zonas no se borra
1. Abrir un sector con zonas → *Editar sector* → *Eliminar*.

**Esperado:** la confirmación **dice cuántas zonas tiene** y sugiere
desactivarlo. Si se confirma igual, el central rechaza la baja por integridad
referencial.

---

## Bloque 37 — Configuración del kiosco *(nuevo)*

> **Verificado el 2026-08-14** en Chrome: se cambió a *Cámara*, la preferencia
> quedó en `localStorage` (`frc.kioscoModo`), el escáner abrió solo al cerrar
> la configuración, y al cancelarlo volvió a abrirse a los 2,5 s. Salir del
> kiosco cortó el rearme: tres segundos y medio después, en Inicio, no había
> ningún diálogo abierto.

### 37.1 · Modo lector (el de las góndolas)
1. Kiosco → ícono de engranaje → *Lector*.

**Esperado:** el campo queda enfocado, **no** sale el teclado en pantalla y el
texto de espera dice «pasá el producto por el lector». Pasar un código con el
lector muestra el precio sin tocar nada.

### 37.2 · Modo cámara
1. Elegir *Cámara* y cerrar la configuración.

**Esperado:** el escáner se abre **solo**. El texto de espera y el placeholder
cambian a la versión de cámara.

> `frc-mobile` abre el escáner una única vez, al entrar en modo `cam`, y
> después queda mudo hasta que alguien toque. En un kiosco eso no alcanza: la
> pantalla la mira un cliente.

### 37.3 · La cámara se vuelve a armar sola
1. En modo cámara, cerrar el escáner sin leer nada. Esperar.

**Esperado:** vuelve a abrirse a los pocos segundos. **No** se abren dos
escáneres encima: el rearme se encadena al cierre del anterior.

### 37.4 · Salir corta el rearme
1. En modo cámara, cerrar el escáner y tocar la X del kiosco.

**Esperado:** vuelve a Inicio y la cámara **no** se reabre encima.

### 37.5 · La preferencia es del dispositivo
1. Configurar *Cámara*, cerrar la app y volver a entrar. Después entrar con el
   mismo usuario desde otro dispositivo.

**Esperado:** la tablet sigue en cámara; el otro dispositivo arranca en
*Lector*. Es configuración de la tablet de la góndola, no del usuario.

### 37.6 · Sin cámara, no se puede elegir cámara
1. Abrir la configuración en un equipo sin cámara.

**Esperado:** la opción está deshabilitada y explica por qué. Elegirla dejaría
el kiosco mudo: sin lector no entra nada por el campo.

### 37.7 · El servidor se muestra, no se edita
1. Mirar la sección *Servidor*.

**Esperado:** dice contra qué instancia está hablando y remite a *Mi cuenta →
Servidor*.

> `frc-mobile` repite acá el formulario de IP y puerto, con la IP de
> producción escrita a mano en el componente. Cambiar de servidor cierra la
> sesión, así que no es algo que se haga con un kiosco abierto.

---

## Bloque 38 — Notificaciones push *(nuevo)*

> **Verificado el 2026-08-14** contra el central local, sobre un build servido
> en `localhost:4400`: la sesión del dispositivo quedó registrada (fila 15981,
> `WEB_MOBILE`), el token de FCM se acuñó con la VAPID del proyecto y quedó
> escrito **en esa misma fila**, dejando intacta la sesión `IOS` del mismo
> usuario.
>
> **38.4 también se ejecutó**: se disparó
> `enviarNotificacionPersonalizada` desde el central local y el aviso apareció
> con su título y su cuerpo. El central lo registró como «enviada
> exitosamente, Destinatarios: 1» y ningún token se tocó.
>
> Quedan sin ejecutar **38.6/38.7** (iPhone) y el caso nuevo **38.8**, que
> falla hoy.
>
> ⚠️ **`ng serve` no sirve para este bloque.** El service worker está en
> `enabled: !isDevMode()`, y sin service worker no hay dónde recibir el aviso.
> Hay que servir un build; el detalle está en
> [`docs/arquitectura/web-push.md`](arquitectura/web-push.md).

### 38.1 · La sesión del dispositivo se registra al entrar
1. Entrar y mirar `configuraciones.inicio_sesion` para el `frc.idDispositivo`
   que está en `localStorage`.

**Esperado:** hay una fila con ese id y `tipo_dispositivo` `WEB` o
`WEB_MOBILE`.

> ⚠️ **Este caso va primero y no es opcional.** El central escribe el token
> buscando la sesión activa por `(usuario, idDispositivo)`; si no la
> encuentra **no falla**, escribe el token en *la primera sesión abierta del
> usuario, sea del dispositivo que sea*. Sin esta fila, el token de esta
> computadora se escribe sobre la sesión de otro aparato — y si esa sesión es
> la del iPhone de la persona, el iPhone deja de recibir avisos.

### 38.2 · Activar
1. Con las claves cargadas, tocar *Activar*.

**Esperado:** el navegador pide permiso; al conceder, la fila pasa a
«Activados en este dispositivo».

### 38.3 · El token llega, y a la fila correcta
1. Después de activar, mirar todas las sesiones abiertas del usuario.

**Esperado:** el token quedó en la fila **de este dispositivo**, y las demás
—en particular una `IOS`— conservan el suyo.

> ⚠️ Verificar **esto**, no solo que la mutación devuelva `true`. Dos cosas
> se ven en verde y no entregan nada: un `PushSubscription` guardado donde va
> un token de FCM, y un token correcto escrito en la sesión de otro aparato.

### 38.4 · Llega con la app cerrada
1. Cerrar la app por completo y disparar una notificación desde el central.

**Esperado:** aparece en la bandeja del sistema. Tocarla abre la app.

### 38.8 · Tocar la notificación abre la pantalla del aviso
1. Con la app **cerrada**, tocar un aviso de inventario.
2. Repetir con la app abierta en otra pantalla.

**Esperado:** abre —o lleva— a la pantalla de ese inventario. Con la app ya
abierta **reusa la pestaña**, no abre otra.

> Necesitó las dos mitades. El central ahora manda el destino **dentro** del
> `notification` como `onActionClick`, además del `data` del mensaje: el
> service worker arma la notificación copiando campos de
> `payload.notification`, y el `data` del mensaje es **hermano** de
> `notification`, no hijo. Sin eso la notificación aparecía y tocarla no hacía
> nada — con la app cerrada, ni la abría.

### 38.9 · El destino se traduce a rutas de esta app
1. Provocar avisos de distinto tipo y tocarlos.

**Esperado:**

| El central manda | Abre |
|---|---|
| `/inventario/6579` | el inventario 6579 |
| `/operaciones/transferencias/431` | `/transferencias/431` |
| `/productos/1234` | la ficha `/producto/1234` |
| `/financiero/gastos/9` | caja chica |
| `/mis-compras/credito/…` | Mis finanzas |
| `/configuracion/seguridad` | Mi cuenta |
| `/operaciones/ventas/…`, `list-cotizacion` | la lista de notificaciones |

> ⚠️ **Los destinos del central son rutas del escritorio**, no de la PWA, y
> viajan sin cambios a los tres clientes. Traducirlos acá y no allá es
> deliberado: hacer que el central conozca las rutas de cada cliente lo obliga
> a cambiar cada vez que uno mueve una pantalla.
>
> Lo que no tiene equivalente cae en **la lista de notificaciones**, no en
> Inicio: el toque vino de un aviso, y su lista es lo único que dice algo
> sobre él.
>
> ⚠️ Si aparece un **bucle de redirección**, el sospechoso es la lista de
> rutas propias de `destino-notificacion.ts`: si acepta por prefijo en vez de
> exacto, devuelve una ruta que no existe y el comodín la vuelve a atrapar.

### 38.5 · Permiso denegado
1. Denegar el permiso y volver a Mi cuenta.

**Esperado:** dice que están bloqueados por el navegador y que se habilitan
desde sus ajustes de sitio. **No** vuelve a mostrar el botón: el navegador ya
no va a preguntar.

### 38.6 · iPhone sin instalar
1. Abrir la app en Safari de iPhone, sin instalarla.

**Esperado:** dice que hace falta instalar la app primero. No hay botón.

> No es una limitación de la app: Safari expone `PushManager` recién cuando la
> PWA corre desde la pantalla de inicio (iOS 16.4+).

### 38.7 · iPhone instalado
1. Instalar la PWA desde Compartir → Añadir a inicio y repetir 38.2 a 38.4.

**Esperado:** funciona igual que en Android.

---

## Bloque 39 — Abrir una toma de inventario *(nuevo)*

**Necesita:** un usuario con rol `CREAR INVENTARIO` (o `ADMIN`) y **una sucursal
sin ninguna toma abierta**. Si todas las que ves tienen una abierta, finalizá o
cancelá esa primero desde el escritorio.

### 39.1 · El botón aparece solo con el rol

1. Entrá con un usuario **sin** `CREAR INVENTARIO` pero **con** `VER INVENTARIO`.
2. Andá a Inicio → Inventario.
3. Escribí a mano `/inventario/nuevo` en la barra del navegador.

**Esperado:** en el paso 2 **no** hay botón *Nuevo inventario*. En el paso 3 la
app avisa «No tenés permiso para entrar a esa sección» y vuelve a Inicio. Que el
botón no esté no alcanza: la URL escrita a mano tiene que rebotar igual.

### 39.2 · Con el rol, el botón lleva al alta

1. Entrá con un usuario **con** `CREAR INVENTARIO`.
2. Inicio → Inventario → *Nuevo inventario*.

**Esperado:** pantalla «Nuevo inventario» con el selector de sucursal ya puesto
en **tu** sucursal, tu nombre en *Responsable*, tipo *Por zona*, y el aviso
sobre sectores y zonas.

### 39.3 · Solo sucursales que pueden contar

1. Abrí el selector de sucursal.

**Esperado:** **no** están `SERVIDOR` ni `COMPRAS`. Son sucursales sin depósito:
no mueven stock, así que no hay nada que inventariar. Tampoco están las
inactivas.

### 39.4 · Las tomas abiertas se listan todas

1. Elegí una sucursal que ya tenga inventarios abiertos — `SUC. CENTRAL` tiene
   **24** en la base de bodega.

**Esperado:** «Tomas abiertas en esta sucursal (N)» con **todas**, cada una con
su número, quién la abrió y **hace cuántos días está abierta**. Arriba, una
línea que dice cuántas son y cuál es la más vieja. **El botón *Iniciar
inventario* sigue disponible.**

⚠️ Lo que no puede pasar es que muestre una sola: con 24 abiertas, ver una hace
pensar «la cierro y sigo».

### 39.4b · Cancelar una toma abandonada

1. En una toma vieja de la lista, tocá **Cancelar** y confirmá.
2. Verificá que desaparece de la lista.
3. Consultá el stock de algún producto que esa toma tuviera contado.

**Esperado:** desaparece de las abiertas y **el stock no se movió**. Cancelar
pone la toma en `CANCELADO` y desactiva sus ajustes; no aplica nada.

⚠️ Tocar *Cancelar* **no** tiene que abrir el detalle de la toma: la card
entera navega, y el botón tiene que frenar ese click.

### 39.4c · Iniciar igual, avisado

1. Con tomas abiertas en la lista, tocá *Iniciar inventario*.

**Esperado:** la confirmación **dice cuántas tomas abiertas hay** y cuál es la
más vieja, antes de preguntar. Confirmando, la toma nueva se crea igual.

### 39.5 · Cancelar la confirmación no crea nada

1. Elegí una sucursal libre y tocá *Iniciar inventario*.
2. En el diálogo, tocá **Cancelar**.
3. Volvé a la lista de inventarios y refrescá.

**Esperado:** no se creó ninguna toma. En `frc-mobile` sí se crea — su
confirmación compara mal y siempre sigue de largo.

### 39.6 · Iniciar de verdad

1. Elegí una sucursal libre, tocá *Iniciar inventario* y confirmá.

**Esperado:** aparece el detalle del inventario recién creado, con estado
**ABIERTO**, tu nombre, tipo `ZONA`, y **«Sin zonas»** con el texto «Agregá la
primera para empezar». El botón *Volver* no debería regresar al formulario de
alta.

### 39.7 · El aviso push le llega a los demás

1. Con otro dispositivo o usuario que tenga rol de inventario y las
   notificaciones activadas, mirá si llega el aviso de «inventario iniciado».

**Esperado:** llega. Lo manda el central al detectar que es un alta. Si no
llega, revisá primero las notificaciones push (bloque 38) antes de culpar a esta
pantalla.

### 39.8 · Sin conexión al central, no deja crear a ciegas

1. Elegí una sucursal y, antes de que responda, cortá la conexión (modo avión o
   apagando el túnel al central).
2. Cambiá de sucursal en el selector.

**Esperado:** un aviso de que **no se pudo verificar** si hay tomas abiertas.
La lista queda vacía pero **sin decir que no hay ninguna**: eso sería afirmar
algo que nadie comprobó.

---

## Bloque 40 — Zonas de la toma *(nuevo)*

**Necesita:** el inventario abierto del bloque 39 y una sucursal con sectores y
zonas cargadas (si no hay, creálas en Lugares del depósito — bloque 36).

### 40.1 · Agregar la primera zona

1. En el detalle del inventario abierto, tocá *Agregar zona*.
2. Elegí una zona de la lista.

**Esperado:** el diálogo lista las zonas con su sector abajo y tiene un campo
para buscar por nombre. Al elegir una, el detalle recarga y muestra una card de
esa zona, con «0 de 0 contados».

### 40.2 · Una zona ya agregada no se vuelve a ofrecer

1. Tocá *Agregar zona* de nuevo.

**Esperado:** la zona del paso anterior **no está** en la lista. Si apareciera y
la eligieras, el central rechazaría el duplicado con un error.

### 40.3 · Las zonas inactivas tampoco

1. Desactivá una zona desde Lugares del depósito (bloque 36).
2. Volvé al inventario y tocá *Agregar zona*.

**Esperado:** esa zona no aparece. Desactivar es exactamente eso: sacarla de las
tomas nuevas sin tocar el histórico de las viejas.

### 40.4 · Buscar por nombre

1. Con varias zonas disponibles, escribí parte del nombre de una en el campo de
   búsqueda.

**Esperado:** la lista se recorta. Buscando por el nombre del **sector** también
filtra. Con un texto que no coincide con nada, dice «Ninguna zona coincide con
eso» en vez de quedar en blanco.

### 40.5 · Sin zonas para agregar

1. Agregá **todas** las zonas de la sucursal a la toma y tocá *Agregar zona*.

**Esperado:** el diálogo explica que no quedan zonas y ofrece **Crear una
zona**. No un diálogo vacío.

### 40.5b · Crear la zona que falta, en un sector que ya existe

1. En *Agregar zona*, tocá **No está la zona**.
2. Elegí un sector, escribí el nombre de la zona y tocá **Crear**.

**Esperado:** la zona se crea y **queda agregada a la toma en un solo paso**,
sin volver a la lista a elegirla. Aparece su card en el detalle.

**Verificá también** que en Lugares del depósito la zona nueva figura dentro
del sector elegido, **en mayúsculas** en la base y mostrada con inicial
mayúscula en pantalla.

### 40.5c · Crear también el sector

1. En el formulario de zona nueva, tocá **El sector tampoco está**.
2. Escribí el nombre del sector y el de la zona, y tocá **Crear**.

**Esperado:** se crean los dos y la zona entra a la toma. En Lugares del
depósito aparece el sector nuevo con esa única zona.

### 40.5d · Si la zona falla, el sector no se pierde

1. Repetí 40.5b usando el nombre de una zona **que ya exista en ese sector**.

**Esperado:** avisa el error del central. Al volver a abrir *Agregar zona* →
*No está la zona*, el sector que hayas creado **sigue estando en el selector**:
no hay que crearlo de nuevo.

### 40.6 · Concluir una zona

1. En la card de una zona, tocá *Concluir* y confirmá.

**Esperado:** la card queda marcada «Concluido» y el botón pasa a *Reabrir*. El
contador «Concluidas» del resumen sube en uno.

### 40.7 · Una sola zona abierta a la vez

1. Con una zona **sin concluir**, tocá *Reabrir* en otra que sí está concluida.

**Esperado:** avisa «Ya tenés otra zona abierta. Concluila antes de reabrir
esta» y **no** la reabre. Concluí la abierta y repetí: ahora sí reabre.

### 40.8 · Con la toma cerrada no se tocan las zonas

1. Finalizá el inventario y volvé al detalle.

**Esperado:** desaparecen *Agregar zona*, *Concluir*, *Reabrir* y *Contar*. Solo
queda *Revisar*: un conteo cerrado es un hecho histórico.

---

## Bloque 42 — Agregar un producto al conteo *(nuevo)*

**Necesita:** una toma abierta con al menos una zona, y productos con código de
barras a mano.

### 42.1 · El botón está incluso con la zona vacía

1. Agregá una zona nueva a la toma y tocá *Contar*.

**Esperado:** la pantalla dice que la zona todavía no tiene productos e invita
a agregar el primero. El botón **Agregar producto** está en la barra de abajo.

### 42.2 · Buscar por descripción

1. Tocá *Agregar producto* y escribí parte del nombre de un producto.
2. Elegí una presentación.

**Esperado:** el ítem aparece en la lista con **Sistema** ya cargado con el
stock de esa sucursal y el campo **Contado en blanco**. Escribí una cantidad y
guardá.

### 42.3 · Buscar por código de barras

1. Tocá *Agregar producto* y escribí el código de barras completo.

**Esperado:** encuentra el producto igual que por descripción.

### 42.4 · Escanear con la cámara

1. Tocá *Agregar producto* y después el ícono de la cámara.
2. Escaneá un producto de la góndola.

**Esperado:** lo encuentra y lo suma al conteo. **Probalo en el teléfono
real**, no solo en Chrome.

### 42.5 · Un código de balanza trae el peso como conteo

1. Pesá un producto en la balanza, y escaneá la etiqueta que imprime.

**Esperado:** el ítem entra con **Contado ya cargado con los kilos** del
código, y *Sistema* con el stock. La diferencia se ve enseguida.

### 42.6 · No se duplica una presentación

1. Agregá un producto y, sin salir, volvé a *Agregar producto* y elegí **la
   misma presentación**.

**Esperado:** avisa que ya está en esta zona y **no la agrega de nuevo**. Dos
renglones de lo mismo se suman los dos al finalizar.

### 42.7 · Otra presentación del mismo producto sí entra

1. Con un producto que tenga «unidad» y «caja», agregá las dos.

**Esperado:** entran las dos como ítems separados. Es correcto: el conteo es
por presentación.

### 42.8 · Con la toma cerrada no aparece

1. Finalizá o cancelá la toma y entrá a una zona.

**Esperado:** no está el botón *Agregar producto*. El alcance de una toma
cerrada ya es un hecho histórico.

### 42.9 · Sin conexión no agrega con un cero inventado

1. Cortá la conexión y tocá *Agregar producto*, eligiendo algo.

**Esperado:** avisa el error y **no crea el ítem**. Lo que no puede pasar es
que lo agregue con Sistema en 0: eso afirmaría que no hay stock de ese
producto.

---

## Bloque 43 — Vencimiento sugerido y transferencias pendientes *(nuevo)*

### 43.1 · El vencimiento viene cargado

1. Entrá a contar una zona con productos que hayan entrado por compra o
   transferencia.

**Esperado:** el campo *Vencimiento* llega **con fecha**, y debajo dice de
dónde salió: «Sugerido de Nota de compra #…», «Sugerido de el último
inventario», «Sugerido de una transferencia».

### 43.2 · Es el más próximo a vencer

1. Buscá un producto que tenga **dos lotes** con vencimientos distintos
   (mirá Control de inventario → productos vencidos para encontrar uno).

**Esperado:** el campo trae **el que vence primero**, no el más lejano ni el
último que entró.

### 43.3 · Una fecha ya vencida se avisa

1. Buscá una presentación cuyo único vencimiento conocido ya pasó.

**Esperado:** trae esa fecha igual, pero la pista dice **«ya vencido»** y se ve
en rojo. Lo que no puede pasar es que aparezca una fecha pasada sin ninguna
señal.

### 43.4 · Lo cargado a mano no se pisa

1. Contá un ítem, escribile un vencimiento y guardá.
2. Salí de la pantalla y volvé a entrar.

**Esperado:** conserva **tu** fecha, sin la pista de «sugerido». Una sugerencia
no corrige lo que alguien escribió mirando el envase.

### 43.5 · La sugerencia se guarda con el conteo

1. En un ítem con fecha sugerida, escribí solo la cantidad y guardá.
2. Volvé a entrar.

**Esperado:** el vencimiento quedó guardado junto con el conteo.

### 43.6 · Si no se puede consultar, lo dice

1. Cortá la conexión y entrá a contar una zona.

**Esperado:** los campos quedan vacíos **y aparece el aviso** de que no se
pudieron traer los vencimientos. Un campo vacío en silencio diría que no hay
vencimiento conocido, que es otra cosa.

### 43.7 · Aviso de transferencias sin recibir

1. Dejá una transferencia en camino a la sucursal de la toma, sin recibir.
2. Abrí el detalle del inventario.

**Esperado:** franja de aviso arriba con cuántas hay y por qué importa. Tocarla
lleva a transferencias.

### 43.8 · También ve las que ya llegaron

1. Avanzá esa transferencia hasta que esté **en destino**, sin recibirla.

**Esperado:** el aviso **sigue apareciendo**. ⚠️ Es el caso que `frc-mobile` no
cubre: filtra solo `TRANSPORTE_EN_CAMINO` y no ve las que están en destino
esperando recepción.

### 43.9 · Con la toma cerrada no aparece

1. Finalizá o cancelá la toma y volvé al detalle.

**Esperado:** sin aviso. El conteo ya ocurrió; avisarlo ahora no sirve de nada.

---

## Bloque 41 — Lo contado llega al stock *(nuevo, crítico)*

**Por qué está acá:** la app escribía el conteo en un campo que el central
**no mira** al finalizar el inventario, así que el ajuste de stock salía de un
número que nadie había contado. Es un defecto que no se puede ver mirando la
pantalla — hay que mirar el stock después de finalizar.

**Necesita:** un producto de prueba con stock conocido y permiso para consultar
el stock desde el escritorio o la ficha de producto.

### 41.1 · La diferencia en pantalla tiene el signo correcto

1. Abrí una toma, agregá una zona con productos y entrá a *Contar*.
2. En un ítem que el sistema dice **10**, escribí **7**.

**Esperado:** la diferencia se muestra **−3** (faltante) mientras escribís, no
+3. Con **12** tiene que decir **+3**.

### 41.2 · El stock queda como lo contado

1. Anotá el stock del sistema de un producto antes de empezar: **S**.
2. Contá ese producto con un número distinto: **C**.
3. Guardá el conteo, concluí la zona y **finalizá** el inventario.
4. Consultá el stock de ese producto.

**Esperado:** el stock pasa a ser **C**, lo contado. Si quedó en **S** —sin
moverse— el conteo no llegó al cálculo, que es exactamente el bug que este
bloque cuida.

### 41.3 · Lo que coincide queda «cantidad exacta»; lo que no, «modificado»

1. En una zona, contá un ítem **igual** al sistema y otro **distinto**.
2. Guardá y andá a *Revisar*.

**Esperado:** el que coincidió aparece con el chip **Cantidad exacta**; el que
no, con **Modificado**. Antes todos salían «Cantidad exacta», incluidos los que
tenían diferencia — que son justo los que el supervisor busca.

### 41.4 · Sin contar no es contado en cero

1. Dejá un ítem de la zona **sin escribir nada**.
2. Mirá el resumen del detalle y la pantalla de revisión.

**Esperado:** ese ítem cuenta como **no contado** —no suma a «Ítems contados» ni
a «Con diferencia»— y en revisión dice «sin contar», no «0».

⚠️ **Al finalizar sí entra como diferencia contra el stock.** Eso es
intencional y es lo que hace el central; por eso la confirmación de *Finalizar*
dice cuántos ítems tienen diferencia.

### 41.5 · Finalizar una toma vieja avisa lo que va a hacer

1. Abrí una toma con más de 180 días (las de 2023 de `SUC. CENTRAL` sirven) y
   tocá *Finalizar*.

**Esperado:** la confirmación dice **cuántos días lleva abierta** y que va a
ajustar el stock de **hoy** con lo que se contó entonces, y sugiere cancelarla.
El botón de confirmar se ve como destructivo.

⚠️ **No la finalices en producción para probar esto** — mirá el diálogo y
cancelá. Si la toma tiene ítems contados, finalizarla mueve stock de verdad.

### 41.6 · Cancelar desde el detalle

1. En una toma abierta, tocá *Cancelar toma* y confirmá.

**Esperado:** el estado pasa a **CANCELADO**, desaparece de las tomas abiertas
de la sucursal, y el stock queda igual.

---

## Bloque 44 — La lista del conteo y el campo de fecha *(nuevo)*

**Por qué está acá:** la pantalla de conteo pasó de tener los tres campos de
cada ítem siempre abiertos a una lista desplegable, y el vencimiento pasó de un
`<input type="date">` a un calendario propio. Lo que hay que probar es
justamente lo que un test no alcanza: que en el teléfono, de pie frente a la
góndola, no se pierda nada al colapsar y que el calendario se pueda usar con
el pulgar.

**Necesita:** una toma **abierta** con una zona de al menos **cinco** ítems, y
uno de ellos con vencimiento ya cargado de una compra o transferencia. El
teléfono real: en el escritorio el calendario se toca con el mouse y eso no
prueba nada del tamaño de los objetivos.

### 44.1 · La zona entra colapsada y se lee entera

1. Entrá a *Contar* en una zona con cinco o más ítems.

**Esperado:** los cinco productos se ven **sin scrollear** o casi, cada uno en
un renglón con su presentación, el stock del sistema y la diferencia. Ningún
campo de texto abierto. Arriba, la barra de avance con «0 de 5 contados».

### 44.2 · Se despliega uno a la vez

1. Tocá el primer renglón. Tocá el tercero.

**Esperado:** al abrir el tercero, el primero **se cierra solo**. Nunca hay dos
formularios abiertos.

### 44.3 · Lo escrito sobrevive al colapso

1. Abrí un ítem, escribí una cantidad y elegí un estado.
2. **Cerralo** tocando su cabecera. Abrí otro. Volvé al primero.

**Esperado:** la cantidad y el estado siguen ahí. El botón *Guardar conteo (n)*
sigue contando ese ítem.

⚠️ Es el caso que más importa del bloque: si esto falla, se pierde trabajo ya
hecho en medio de un pasillo y sin ningún aviso.

### 44.4 · La cabecera dice si vale la pena abrir

1. Contá un ítem con un número **mayor** al del sistema y otro **menor**.
   Dejá un tercero sin tocar.

**Esperado:** en las cabeceras colapsadas, el primero muestra la diferencia en
**+** (naranja), el segundo en **−** (rojo) y el tercero un **guion**. Los dos
contados muestran el **tilde** en la miniatura; el tercero, el ícono de
producto.

### 44.5 · El avance se mueve mientras se cuenta

1. Con la zona a medio contar, mirá la barra de arriba.

**Esperado:** dice cuántos de cuántos van y cuántos tienen diferencia, y cambia
**al escribir**, sin necesidad de guardar.

### 44.6 · El calendario se abre y se usa con el pulgar

1. Abrí un ítem y tocá el ícono de almanaque del campo *Vencimiento*.

**Esperado:** se abre el calendario de la app —**no** el selector del sistema
operativo—, los días son objetivos cómodos de tocar, y elegir uno lo escribe en
el campo como `dd/mm/aaaa`. El formulario **queda abierto** después de cerrar
el calendario.

### 44.7 · La fecha se puede escribir a mano

1. En el campo *Vencimiento*, escribí `15/03/2027` con el teclado.
2. Sacá el foco del campo y guardá.

**Esperado:** lo toma. Guardado y recargada la pantalla, sigue diciendo
`15/03/2027`.

⚠️ Escribí también algo que no es una fecha (`aaa`, `31/02/2027`) y salí del
campo: tiene que quedar **vacío**, no con la fecha anterior.

### 44.8 · El vencimiento anterior se ve y se puede copiar

1. Abrí el ítem que ya tenía vencimiento cargado.

**Esperado:** debajo del campo dice **«Anterior dd/mm/aaaa»** con la fuente
—«Nota de compra #123», «una transferencia», «el último inventario»— y un
botón **usar**. Tocarlo copia esa fecha al campo.

⚠️ Si el anterior **ya venció**, la línea se ve en rojo y aclara «ya vencido».

### 44.9 · Un vencimiento vencido se marca en la cabecera

1. Cargá en un ítem una fecha anterior a hoy y cerrá la tarjeta.

**Esperado:** en la cabecera colapsada aparece el ícono de vencido, en rojo,
al lado del nombre del producto.

### 44.10 · Dos renglones de la misma presentación reciben lotes distintos

1. En una zona con **dos renglones de la misma presentación** —dos lotes—,
   abrí los dos y mirá el campo *Vencimiento*.

**Esperado:** las fechas sugeridas son **distintas**. Si el central conoce dos
lotes, cada renglón se lleva uno; si conoce uno solo, el segundo queda
**vacío** en vez de repetir el del primero.

⚠️ Es el defecto que reportó el operador: la sugerencia se pedía solo por
presentación, así que los dos renglones recibían la misma fecha y al guardar
quedaba escrita en los dos — «le puse la fecha a uno y me la puso en los dos».

### 44.11 · Cargarle la fecha a un renglón no toca la del otro

1. Con dos renglones de la misma presentación, escribí una fecha en uno.
2. Guardá y volvé a entrar.

**Esperado:** solo ese renglón cambió. El otro conserva la suya, y el central
no rechaza el guardado por renglón duplicado.

### 44.12 · Borrar la fecha la deja borrada

1. Borrá el contenido del campo *Vencimiento* de un renglón.

**Esperado:** queda **vacío**. No se vuelve a prellenar solo con la sugerencia
— borrar es una decisión, no un campo sin tocar.

### 44.13 · Guardar sigue guardando lo mismo

1. Contá tres ítems, guardá.
2. Volvé a entrar a la zona.

**Esperado:** los tres conservan cantidad, vencimiento y estado, y el toast dice
«Conteo guardado». La diferencia de cada uno coincide con la que se veía antes
de guardar.

### 44.14 · Zona vacía y sin conexión

1. Entrá a una zona **sin ítems**.
2. Con la zona cargada, cortá la conexión y tocá *Reintentar* del estado de
   error (o entrá con el central caído).

**Esperado:** la zona vacía invita a agregar el primer producto; el error dice
qué pasó y ofrece reintentar. En ninguno de los dos casos aparece una lista a
medio dibujar.

### 44.15 · Tema oscuro y tema claro

1. Cambiá el tema en *Mi cuenta → Aplicación* y volvé a la pantalla.

**Esperado:** en los dos temas se leen el título del producto, el stock del
sistema, la línea de «Anterior» y el calendario abierto. El tilde de contado y
la barra de avance se distinguen del fondo.

---

## Bloque 45 — Renglones repetidos en el conteo *(nuevo)*

**Por qué está acá:** la regla de qué es un renglón duplicado cambió **en el
central**, y pasó de `(inventario, producto, vencimiento)` a
`(zona, presentación, vencimiento)`. Es una relajación —nada que funcionaba
dejó de funcionar—, pero cuatro casos que antes fallaban ahora tienen que
entrar, y uno solo tiene que seguir fallando. La app ya no chequea nada de
esto: muestra lo que el central conteste.

**Necesita:** una toma **abierta** con **dos zonas**, y un producto con al
menos dos presentaciones («unidad» y «caja x12» o equivalente).

⚠️ **Probalo también desde el escritorio.** El cambio es del central y le llega
a los dos frentes; el escritorio estaba igual de roto y tiene que haber
mejorado igual.

### 45.1 · El mismo producto en dos zonas — antes fallaba

1. Contá un producto en la zona A y guardá.
2. Entrá a la zona B, *Agregar producto*, elegí **el mismo producto**.

**Esperado:** se agrega. Es el caso normal de un inventario por zona: hay stock
en góndola y en depósito, y los conteos se suman.

### 45.2 · Unidad y caja x12 del mismo producto — antes fallaba

1. En una zona, agregá «unidad» de un producto **sin cargarle vencimiento**.
2. Agregá «caja x12» del mismo producto.

**Esperado:** entran las dos. Son dos presentaciones y dos renglones.

### 45.3 · Guardar el mismo producto contado en dos zonas — antes fallaba

1. Contá el mismo producto en la zona A y en la zona B, dejando en las dos el
   **vencimiento sugerido** (que es la misma fecha, porque sale del mismo lote).
2. Guardá el conteo de las dos.

**Esperado:** guardan las dos. Antes el segundo fallaba, y era el caso más
probable de todos porque la sugerencia propone siempre la misma fecha.

### 45.4 · Dos lotes de la misma presentación — antes fallaba

1. En una zona, agregá «unidad» con vencimiento 20/11/2026.
2. Agregá «unidad» otra vez, con vencimiento 05/01/2027.

**Esperado:** entran las dos. Son dos lotes.

### 45.5 · El mismo renglón repetido — tiene que seguir fallando

1. En una zona, agregá «unidad» de un producto y **no le cargues vencimiento**.
2. Agregá «unidad» del mismo producto otra vez, también sin fecha.

**Esperado:** se rechaza, y el mensaje **nombra la zona** y dice que le cargues
la fecha a la que ya está o que las cuentes juntas en ese renglón. Nunca un
texto en inglés ni nombres de clases de Java.

⚠️ Es el único caso que produce un dato sin sentido: el central suma los dos
renglones al finalizar y el conteo sale doble.

### 45.6 · El mismo renglón con la misma fecha — también sigue fallando

1. Repetí 45.5 pero con la **misma fecha** cargada en los dos.

**Esperado:** se rechaza, y el mensaje dice que un lote distinto va con otra
fecha y que el mismo lote se cuenta en un solo renglón. Es un texto distinto
al de 45.5, porque el problema es otro.

---

## Bloque 46 — Vencimiento sugerido de verdad, y quitar un producto *(nuevo)*

**Por qué está acá:** el campo *Vencimiento* llegaba siempre vacío. No era que
faltaran datos: la consulta los descartaba. Se anclaba al último inventario de
la sucursal, y la toma que se está contando **es** el último inventario. Ahora
hay una consulta aparte, sin ancla. Y se agregó poder sacar un renglón del
conteo.

**Necesita:** una toma **abierta** en una sucursal con historial —compras o
transferencias recibidas de meses anteriores— y un producto que se haya
comprado alguna vez con vencimiento. El teléfono real.

⚠️ **El punto 46.3 conviene mirarlo también desde el escritorio**: el arreglo
del ancla es del central y le llega a los dos frentes.

### 46.1 · El campo llega con una fecha propuesta

1. Abrí una zona y desplegá un producto que se compre con vencimiento.

**Esperado:** el campo *Vencimiento* trae una fecha, y debajo dice de dónde
salió: «Sugerido de Nota de compra #…», «de una transferencia», «de el último
inventario». Antes llegaba vacío siempre.

⚠️ Si la fecha propuesta ya venció, lo dice y se ve en rojo. Eso es correcto:
puede haber mercadería caduca en la góndola.

### 46.2 · Un producto que el central no conoce no inventa nada

1. Desplegá un producto sin historial de compras con vencimiento.

**Esperado:** el campo queda **vacío**, sin cartel de «Sugerido de…». Vacío es
«no hay dato», y es distinto de una fecha inventada.

### 46.3 · El reporte de productos vencidos con una toma abierta

1. En una sucursal que tenga una toma **abierta**, entrá a *Productos vencidos*.

**Esperado:** muestra filas. Antes quedaba en blanco mientras hubiera una toma
abierta o cancelada como última de esa sucursal.

### 46.4 · Quitar un producto agregado por error

1. Agregá un producto a la zona. Tocá el menú `⋮` de su renglón.
2. Elegí *Quitar del conteo* y confirmá.

**Esperado:** el aviso nombra el producto **y su presentación** —«unidad»,
«caja x 6»—, porque dos renglones pueden ser del mismo producto. Al confirmar,
el renglón desaparece y el avance de arriba se recalcula.

### 46.5 · Cancelar no borra

1. Repetí 46.4 pero tocá *Cancelar*.

**Esperado:** no pasa nada. El renglón sigue con su cantidad y su fecha.

### 46.6 · Quitar un renglón con conteo escrito y sin guardar

1. Escribí una cantidad en un renglón, **sin guardar**.
2. Quitá ese mismo renglón.

**Esperado:** desaparece, y el contador de *Guardar conteo (n)* **baja**. Si
quedara contándolo, guardar fallaría contra un renglón que ya no existe.

⚠️ Lo contado en ese renglón se pierde: el borrado es de verdad. Por eso
confirma.

### 46.7 · Con la toma cerrada no se puede quitar

1. Entrá a contar una zona de una toma **concluida** o **cancelada**.

**Esperado:** el menú `⋮` **no aparece** en ningún renglón, igual que no
aparece *Agregar producto*.

### 46.8 · Sin conexión al quitar

1. Cortá la conexión y quitá un renglón.

**Esperado:** dice qué pasó y el renglón **sigue ahí**. No puede desaparecer de
la pantalla algo que el central no borró.

---

## Resumen para completar

| Bloque | Casos | ✅ | ⚠️ | ❌ |
|---|---|---|---|---|
| 1 · Arranque y sesión | 8 | | | |
| 2 · Navegación y shell | 5 | | | |
| 3 · Caja | 8 | | | |
| 4 · Sistema de diseño | 10 | | | |
| 5 · PWA | 7 | 6 | 1 | |
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
| 22 · Crédito en Inicio | 6 | | | |
| 23 · Escáner universal | 9 | 3 | | |
| 24 · Configuración en Mi cuenta | 6 | | | |
| 25 · Productos vencidos | 5 | 2 | | |
| 26 · Modo kiosco | 8 | 3 | | |
| 27 · Ficha de producto | 5 | 2 | | |
| 28 · Rendición de caja chica | 9 | | | |
| 29 · Carga del conteo | 6 | | | |
| 30 · Permisos por rol | 6 | | | |
| 31 · Rostro: registro y marcación | 11 | | | |
| 32 · Compartir por QR | 4 | 2 | | |
| 33 · Instalar y filtros por URL | 5 | 2 | | |
| 34 · Control de inventario | 5 | 1 | | |
| 35 · Revisión de inventario | 6 | 3 | | |
| 36 · Lugares del depósito | 7 | 4 | | |
| 37 · Configuración del kiosco | 7 | 4 | | |
| 38 · Notificaciones push | 9 | 6 | | |
| 39 · Abrir una toma de inventario | 10 | | | |
| 40 · Zonas de la toma | 11 | | | |
| 41 · Lo contado llega al stock | 6 | | | |
| 42 · Agregar un producto al conteo | 9 | | | |
| 43 · Vencimiento sugerido y transferencias | 9 | | | |
| 44 · Lista del conteo y campo de fecha | 15 | | | |
| 45 · Renglones repetidos en el conteo | 6 | | | |
| 46 · Vencimiento sugerido y quitar producto | 8 | | | |
| **Total** | **357** | | | |

### Los cinco que más importan

Si el tiempo es corto, empezá por estos: son los que verifican las correcciones de bugs críticos.

1. **1.1 y 1.2** — el saludo con tu nombre y el acceso a Caja según rol
2. **1.3** — recargar mantiene la sesión
3. **3.4** — el detalle de caja abre con datos
4. **4.5** — `10.50` se interpreta como diez con cincuenta, **probado en el teléfono**
5. **3.6** — la diferencia de arqueo en rojo, y sin `-0`
