---
name: frc-mobile-pwa
description: Conocimiento profundo del repo frc-comercial/mobile-pwa — la PWA (Angular 21 standalone zoneless + Material 21 + Apollo 4) que reemplaza a la app Android frc-mobile como cliente móvil del ERP Franco Systems. Invocar al tocar cualquier pantalla, servicio, operación GraphQL, componente del sistema de diseño, escáner/QR, service worker o prueba de este repo; al portar una pantalla desde frc-mobile; o al decidir si algo va en el cliente o en el central.
---

# frc-mobile-pwa

Repo: `GabFrank/frc-mobile-pwa` — **privado**
Path local: `/Users/gabfranck/workspace/frc-sistemas-informaticos/frc-comercial/mobile-pwa/`
Stack: **Angular 21** standalone y **zoneless** · Material 21 · Apollo Client 4 / `apollo-angular` 14 · `@angular/service-worker` 21 · Node 20.20 · vitest

Reemplaza a `GabFrank/frc-mobile` (Ionic + Capacitor, en mantenimiento). Habla
contra **`frc-comercial/central`** por GraphQL. Nunca contra `frc-efact`.

## Lo primero

**La documentación del repo es la fuente, no esta skill.** Está viva, es
extensa y se actualiza con el código. Esta skill dice **qué leer, en qué orden
y qué cuesta caro no saber**.

| Necesidad | Documento |
|---|---|
| Reglas duras del proyecto | `CLAUDE.md` (raíz del repo) |
| **Cómo se escribe el código acá** | `docs/PATRONES.md` |
| Cómo se ve | `docs/design-system.md` + `src/styles/_tokens.scss` |
| Un módulo concreto | `docs/modulos/<modulo>.md` |
| Qué dicen los QR por dentro | `docs/arquitectura/qr-del-sistema.md` |
| Cómo se lee un código | `docs/arquitectura/escaner.md` |
| Capa de datos, alias `data:` | `docs/arquitectura/capa-de-datos.md` |
| Qué probar a mano | `docs/PLAN_TESTEO_MANUAL.md` |
| Qué NO repetir del repo viejo | `docs/TODO_TECNICO.md` |

**Antes de portar una pantalla, leé cómo la hace `frc-mobile`** (regla 5.1).
Los documentos de `docs/modulos/` describen el sistema anterior y son buenos,
pero no cubren todo. Si algo del repo viejo parece un error, verificalo antes
de «corregirlo»: suele codificar una regla que no está escrita en ningún lado.

## Comandos

```bash
npm start     # ng serve → http://localhost:4300
npm run build # EL GATE REAL
npm test      # vitest
```

⚠️ **`npm run build` y `npm test` matan al `npm start`** (SIGTERM, salida 143):
comparten `.angular/cache`. El síntoma engaña — la pantalla deja de responder y
parece un bug de la app.

⚠️ **`tsc --noEmit` NO alcanza como verificación.** No typechequea las
plantillas: un `p.ciudad.nombre` inexistente pasa limpio y lo caza el AOT.

## Las seis cosas que cuesta caro no saber

1. **El alias `data:`.** Toda operación GraphQL aliasea su campo raíz a `data`.
   Sin el alias el resultado llega `undefined` **sin error ni log**.

2. **`Number('')` es `0`, no `NaN`.** Cada id que llega de una URL, un QR o
   GraphQL necesita el guard completo, o la app navega al registro cero.

3. **«No hay» y «no pude preguntar» son respuestas distintas.** Un cero afirma
   algo que nadie dijo. Ver §6 de `docs/PATRONES.md`.

4. **`input.required` rompe con parámetros de ruta** (`NG0950`): el router los
   asigna después de construir. Va `input<string>()` + `effect`.

5. **Un segmento literal siempre antes que `:id`** en las rutas. Es el error
   más repetido del repo.

6. **Nunca un backtick dentro de `template:` o `styles:`.** Rompe el literal y
   el error no señala la causa. Se cae en esto escribiendo comentarios.

## Convenciones que no se negocian

- **Idioma:** dominio y comentarios en español; identificadores en inglés;
  commits convencionales en inglés.
- **Cero valores literales fuera de `_tokens.scss`** — ni un hex, ni un px de
  espaciado, ni un radio.
- **Nunca un token `--mdc-*`**: Material 21 renombró esa familia a `--mat-*` y
  los nombres viejos **fallan en silencio**. Hay un test que lo impide.
- **El dinero lo calcula el backend.** El cliente muestra. Restar dos totales
  que el backend ya emitió, para mostrarlos juntos, sí se puede.
- **Tres estados o no está terminado**: cargando, vacío, error.
- **Ni terminado sin su bloque** en `docs/PLAN_TESTEO_MANUAL.md`, con
  «Esperado» por caso y la tabla de totales actualizada.
- **No hay Ionic ni Capacitor**, y no se agregan. Toda capacidad de dispositivo
  va detrás de un servicio en `core/`.
- **Push directo a `master` o `develop`: nunca.** Siempre por PR.

## iOS no es un caso futuro

Soportar iPhone es **uno de los motivos por los que este repo existe**: la APK
no podía darlo. Que hoy no haya un iPhone en la flota no cambia nada.

Toda capacidad de dispositivo necesita su camino en **Safari**, y lo que se
carga solo para Safari va en un chunk aparte por `import()` dinámico: el peso
no lo paga Android.

Ya pasó una vez que el escáner se escribió sin fallback «porque hoy no hay
iOS». Eso invierte el orden.

## Antes de tocar el central

**Verificá si lo usa el desktop.** Si lo usa, va un método paralelo con sufijo
`Mobile`: el desktop es producto en producción en farmacias y bodegas
(`docs/REGLAS_DESARROLLO.md`).

Y **alpha solo recibe cambios del central por PR**: para probar algo que
necesita backend nuevo hace falta un central local.

⚠️ **Alpha puede estar más viejo que la rama.** Hoy no tiene
`stockPorSucursales`, así que la ficha de producto muestra «No se pudo
consultar» en existencias — es lo esperado, no un fallo.

## Probar contra un central real

Por defecto la app apunta a alpha (`environment.ts`). El servidor se cambia
desde el login o desde **Mi cuenta → Servidor**, y cambiarlo **cierra la
sesión**: el token de una instancia no vale en otra.

⚠️ **El central espera `Authorization: Token <t>`, no `Bearer`.** Cuesta media
hora si se prueba una query a mano y devuelve 401.

Credenciales del usuario dev: `frc-comercial/dev_user_cred.txt`. Nunca volcar
su contenido a chat ni a commits.

Para probar en un Android por USB:
```bash
adb reverse tcp:4300 tcp:4300   # la app
adb reverse tcp:8081 tcp:8081   # y el central local, si hace falta
```
`localhost` es contexto seguro: cámara, GPS y service worker funcionan sin
HTTPS. Servir por IP de red **no** funciona.

## Estado y deudas

**Los pendientes viven en las issues del repo**, no en un archivo. Hubo un
`docs/PROXIMA_SESION.md` que hacía de traspaso y se borró: un traspaso deja de
ser cierto sin que nadie lo note, y entonces miente con toda la autoridad de
estar versionado.

Lo que queda anotado ahí: correr el plan de testeo manual, endurecer el
pipeline antes de la primera promoción a beta, lo que falta de paridad con
`frc-mobile`, y el presupuesto del bundle.

## Cómo actualizar esta skill

**Solo procedimiento durable.** Versiones, PRs abiertas y pendientes van en
las issues del repo, no acá.

Cuando aprendas algo a golpes —una API que miente, un campo que no está donde
su nombre sugiere, una validación que rompe un caso real— el lugar natural es
`docs/PATRONES.md` o el documento del módulo. Acá solo si vale para todo el
repo y alguien lo necesita **antes** de abrir un archivo.
