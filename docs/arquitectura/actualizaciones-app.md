# Actualizaciones de la app

> ⚠️ **Documento histórico.** Describe `frc-mobile` (Ionic + Capacitor), no este repo. Se conserva porque explica reglas de negocio y decisiones que se heredaron. Para la implementación actual, ver [`../design-system.md`](../design-system.md) y [`capa-de-datos.md`](capa-de-datos.md).

## ⚠️ No existe canal OTA

**Todo cambio de esta app —incluso si solo toca código Angular— requiere una versión nueva publicada en Play Store.** No hay actualización del bundle web por fuera de la tienda.

Esto contradice documentación vieja del proyecto. El estado real, verificable:

| Evidencia | Dónde |
|---|---|
| `@capgo/capacitor-updater` **no está instalado** | `package.json` — no figura en `dependencies` |
| El código de `CapacitorUpdater` está comentado | `src/main.ts:4,9,52,61` |
| Queda un bloque de config para el plugin ausente | `capacitor.config.ts:12-14` — **configuración muerta** |
| `src/app/app-update/` es código muerto | `app-update.component.ts:16` hace `throw new Error('Method not implemented.')`; el componente no está declarado en ningún módulo |

La decisión de descartar Capgo/OTA se tomó el **2026-04-22**: el CI ya sube AABs por canal automáticamente y los ~15 minutos de propagación de Play Store no son un problema operacional para el tamaño del proyecto. Menos deuda, menos vendor lock-in.

> **Implicancia práctica:** un `fix:` de una línea en un `.ts` **no llega a los usuarios** hasta que se ejecute el workflow manual de deploy a Play Store. Al describir un PR, no prometas propagación automática.

## El mecanismo real: in-app update de Play Store

`src/app/services/update-service.service.ts`, sobre `@capawesome/capacitor-app-update`.

| Función | Qué hace |
|---|---|
| `getCurrentAppVersion()` | `versionCode` instalado |
| `getAvailableAppVersion()` | `versionCode` disponible en Play Store |
| `performImmediateUpdate()` | Update bloqueante: Play Store toma la pantalla, descarga e instala |
| `startFlexibleUpdate()` | Update en segundo plano, el usuario sigue usando la app |
| `completeFlexibleUpdate()` | Aplica un update flexible ya descargado (reinicia) |
| `openAppStore()` | Abre la ficha de la app |

Ambos `perform*` chequean `updateAvailability === UPDATE_AVAILABLE` y el flag de permitido (`immediateUpdateAllowed` / `flexibleUpdateAllowed`) antes de actuar; si no se cumple, salen en silencio.

> ⚠️ **Gotcha — se compara `versionCode`, no `versionName`.** En Capacitor 7 el plugin separó nombre y código de versión. Estas funciones devuelven el **código** (numérico, incremental), porque el consumidor compara con `+current < +latest`. Si alguna vez devolvés `versionName` (`"3.0.9-alpha.2"`), la comparación numérica da `NaN` y el chequeo deja de funcionar sin error visible.

### Chequeo automático

`app.component.ts:128-129`:

```ts
this.searchUpdate();
this.intervalID = setInterval(this.searchUpdate, 50000);
```

Al arrancar y luego **cada 50 segundos**. Si `versionCode` instalado < disponible, dispara `performImmediateUpdate()` — el update **bloqueante** — y al volver muestra el toast "Nueva version instalada".

> ⚠️ **Gotcha — el update es forzado, no consultado.** El usuario no acepta nada: apenas Play Store reporta versión nueva, la app entra en el flujo inmediato. En medio de una operación (una venta a medias, un conteo de inventario) eso interrumpe al usuario. Es intencional para mantener la flota alineada, pero considéralo al planificar un release en horario comercial.
>
> El comentario del código dice `// 5000 milliseconds = 5 seconds`; el valor real es `50000` = **50 segundos**. El comentario está mal, el valor es el que manda.

## Canales

`src/app/services/channel.service.ts`. Tres canales, mapeados a tracks de Play Console:

| Canal | Branch git | Track Play Console | Cómo entra el usuario |
|---|---|---|---|
| `alpha` | `develop` | Internal testing | Invitación por email (máx. 100 cuentas) |
| `beta` | `release/beta` | Open testing | Abierto a cualquier cuenta Google |
| `stable` | `master` | Production | Ficha pública |

### API

- **`detectCurrentChannel(versionName)`** — deduce el canal por regex sobre el `versionName`: `-alpha.` → `alpha`, `-beta.` → `beta`, cualquier otro (incluido vacío/nulo) → `stable`.
- **`getChannelLabel(channel)`** — etiqueta para UI.
- **`openPlayStoreOptIn(target)`** — abre la URL de opt-in del canal en un Custom Tab (`@capacitor/browser`).

URLs de opt-in (hardcodeadas en el servicio):

```
alpha  → https://play.google.com/apps/internaltest/4701535382290616522
beta   → https://play.google.com/apps/testing/com.sistemasinformaticos.frc
stable → https://play.google.com/store/apps/details?id=com.sistemasinformaticos.frc
```

> ⚠️ **Gotcha — el cambio de canal lo hace Play Store, no la app.** `openPlayStoreOptIn` solo abre una página; el opt-in ocurre fuera de la app y **no hay forma programática de hacerlo**. Tras aceptar, Play Store baja el AAB del track nuevo en ~5-15 minutos (si el auto-update está activo). El aviso al usuario está en `app.component.ts:158`.

> ⚠️ **Gotcha — `stable` y `beta` comparten dominio de URL a propósito.** Para volver a stable se abre la ficha pública; Play Store detecta que el usuario está en un programa de prueba y ofrece el botón "Abandonar". No hay URL específica de "salir del beta".

> ⚠️ **Gotcha — si se recrea la app en Play Console, el ID numérico del track internal cambia.** Está hardcodeado en `ALPHA_OPT_IN_URL`. Hay que actualizarlo a mano en `channel.service.ts`.

## Qué exige un deploy nativo

Como no hay OTA, **todo** exige subir un AAB. Pero además, estos cambios exigen `npm install` + `npx cap sync android` antes de compilar, porque tocan el proyecto nativo:

- Alta o baja de un plugin de Capacitor / Cordova
- Bump de versión de Capacitor
- Cambios en `capacitor.config.ts` (permisos, `appId`, splash)
- Cambios en `android/app/build.gradle` o `ios/App/Podfile`

Si te salteás el `cap sync`, el APK compila pero **sin el plugin nuevo**, y el fallo aparece en runtime como un método que no existe.

## Publicación

El deploy es un workflow manual de GitHub Actions (`.github/workflows/deploy-playstore.yml`):

```bash
gh workflow run "Deploy to Play Store" --ref develop -f version=<tag> -f track=internal
```

Valores de `track`: `internal` (alpha), `alpha` (closed testing, poco usado), `beta` (open testing), `production` (stable). Si se deja `version` vacío, el workflow resuelve el último tag del canal.

**Nunca automático**: aunque `semantic-release` genere un tag nuevo en cada merge, la subida a Play Store requiere disparo y aprobación manual. Detalle completo del flujo de ramas y releases en la skill `frc-cicd`; no se duplica acá.
