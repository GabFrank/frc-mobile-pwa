# Capacitor y capa nativa

## Configuración

`capacitor.config.ts`:

| Clave | Valor | Nota |
|---|---|---|
| `appId` | `com.sistemasinformaticos.frc` | **Nunca cambiar** — rompe el upgrade path en Play Store |
| `appName` | `Bodega Franco` | Marca comercial |
| `webDir` | `www` | Salida de `ng build` |
| `server.androidScheme` | `http` | Necesario: el central se expone sin TLS |
| `server.cleartext` | `true` | Ídem |

Plugins configurados:

- **Camera**: `androidSource: 'both'` — el picker ofrece cámara y galería.
- **Filesystem**: `androidStorage: 'external'`.
- **PushNotifications**: `presentationOptions: ['badge', 'sound', 'alert']`.
- **SplashScreen**: fondo `#b40000` (rojo de marca), `CENTER_CROP`, fullscreen e inmersivo, sin spinner, `launchAutoHide: true`.
- **CapacitorUpdater**: `autoUpdate: true` — ⚠️ **configuración muerta**, el plugin no está instalado. Ver [actualizaciones-app.md](actualizaciones-app.md).

## Proyecto Android

`android/variables.gradle` y `android/app/build.gradle`:

| Parámetro | Valor |
|---|---|
| `minSdkVersion` | 23 (Android 6.0) |
| `compileSdkVersion` / `targetSdkVersion` | 35 (Android 15) |
| `namespace` / `applicationId` | `com.sistemasinformaticos.frc` |
| `versionCode` | 8 |
| `versionName` | 3.0.9 |

`targetSdkVersion 35` es requisito de Play Store para Android 15/16; se alcanzó con la migración a Capacitor 7 (`4394df9`).

> ⚠️ **Gotcha — `versionCode` y `versionName` viven en `build.gradle`, no en `package.json`.** Son valores independientes. El chequeo de update in-app compara **`versionCode`** (numérico, incremental): si sube `versionName` pero no `versionCode`, Play Store no reconoce la versión como nueva.

### Firma

`android/app/build.gradle:38` define `signingConfigs` y el build de release lo aplica. **Las claves no están en este repo** — viven en el workspace padre:

```
frc-sistemas-informaticos/frontend/mobile/key              # keystore Android
frc-sistemas-informaticos/frontend/mobile/private_key.pepk # Google Play upload key (PEPK)
```

Están fuera de `frc-comercial/` a propósito, y su reubicación es un TODO pendiente del workspace. **No commitear estas claves a este repo bajo ninguna circunstancia**, ni imprimir su contenido.

### Permisos declarados

`android/app/src/main/AndroidManifest.xml`:

| Permiso | Para qué |
|---|---|
| `INTERNET` | GraphQL, REST, WebSocket |
| `CAMERA` | Escaneo de códigos, fotos, reconocimiento facial |
| `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | Grabación de audio (`AudioRecordingService`) |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | Geolocalización en marcación |
| `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` | Galería en Android 13+ |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Galería y archivos en Android ≤12 |
| `USE_BIOMETRIC`, `USE_FINGERPRINT` | Login biométrico |

> ⚠️ **Gotcha — agregar un permiso exige release nativo.** El manifest se compila dentro del APK. Un permiso nuevo no llega a los usuarios hasta subir un AAB nuevo a Play Store.

## Plugins instalados

Registrados en `android/app/src/main/assets/capacitor.plugins.json` (lo genera `cap sync`, no se edita a mano):

| Plugin | Uso en la app |
|---|---|
| `@capacitor-mlkit/barcode-scanning` | **Único** scanner de códigos soportado (`BarcodeScannerService`) |
| `@capacitor-mlkit/face-detection` | Detección facial |
| `@pantrist/capacitor-plugin-ml-kit-text-recognition` | OCR |
| `@capacitor-community/fcm` | Push (topics FCM) |
| `@capacitor-community/file-opener` | Abrir PDFs y archivos descargados |
| `@capacitor/app` | Ciclo de vida (`appStateChange`) |
| `@capacitor/browser` | Custom Tabs — opt-in de canal en Play Store |
| `@capacitor/camera` | Fotos |
| `@capacitor/filesystem` | Guardar archivos |
| `@capacitor/geolocation` | Ubicación |
| `@capacitor/google-maps` | Mapas |
| `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar`, `@capacitor/splash-screen` | UI nativa |
| `@capacitor/preferences` | Storage nativo (ver gotcha en [configuracion-servidor.md](configuracion-servidor.md)) |
| `@capacitor/push-notifications` | Notificaciones |
| `@capacitor/share` | Compartir |
| `@capawesome/capacitor-app-update` | Update in-app de Play Store |
| `@capgo/capacitor-native-biometric` | Huella / rostro para login |

**Cordova legacy que sigue vivo:** `cordova-plugin-app-version` y `cordova-plugin-globalization`, consumidos vía `@awesome-cordova-plugins/*`. `AppVersion` se usa en `app.component.ts:121` para mostrar la versión instalada.

> ⚠️ **Gotcha — hay dos generaciones de wrappers Cordova conviviendo.** `@ionic-native/*` (v5, deprecado — `FingerprintAIO` en `app.module.ts:132`) y `@awesome-cordova-plugins/*` (v6). Esa mezcla es la causa de que `--legacy-peer-deps` sea obligatorio. No agregues plugins de `@ionic-native/*`: si necesitás uno nuevo, buscá el equivalente Capacitor.

## Flujo de sincronización nativa

```bash
npm run refresh    # ng build && npx cap sync && npx cap copy
```

- **`ng build`** genera `www/`.
- **`cap sync`** instala/actualiza plugins nativos, regenera `capacitor.plugins.json`, `capacitor.build.gradle` y `capacitor.settings.gradle`.
- **`cap copy`** copia el bundle web a `android/app/src/main/assets/public`.

Cuándo alcanza con qué:

| Cambiaste | Comando |
|---|---|
| Solo código Angular, y probás en navegador | `npm start` |
| Solo código Angular, probás en device | `npm run refresh` |
| Agregaste/quitaste un plugin, o tocaste `capacitor.config.ts` | `npm install` + `npx cap sync android` |
| Querés un APK de prueba | `npm run build:android:debug` |

> ⚠️ **Gotcha — un `cap sync` olvidado compila igual.** Si agregás un plugin y no sincronizás, el APK se arma **sin** el código nativo. No hay error de compilación: el fallo aparece en runtime como "método no implementado" en el device. Ante un plugin que "no existe" en el device pero sí en el código, lo primero es correr `cap sync`.

> ⚠️ **Gotcha — `cap sync` modifica archivos versionados.** Toca `android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle` y `capacitor.plugins.json`. Esos cambios **van commiteados** — son parte del estado del proyecto nativo, no ruido local.
