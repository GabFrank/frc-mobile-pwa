# Visión general

## Qué es

`frc-app` es la aplicación **móvil Android/iOS** del ERP **Franco Systems** (retail / farmacia / supermercado, Paraguay). Se distribuye bajo la marca comercial **"Bodega Franco"**.

- **Repo:** `GabFrank/frc-mobile` (independiente)
- **`appId`:** `com.sistemasinformaticos.frc`
- **Versión:** `3.0.9` (`package.json`), alineada con los otros 3 componentes de `frc-comercial/`
- **Backend:** `frc-comercial/central` vía GraphQL. **No** habla con `frc-efact`.

Es uno de los 4 componentes del producto. Su app hermana es el **desktop** (Angular + Electron), que consume el mismo backend y está en producción — de ahí la regla crítica de [REGLAS_DESARROLLO.md](../REGLAS_DESARROLLO.md).

## Stack real

Verificado contra `package.json`:

| Capa | Versión |
|---|---|
| Angular | **15.2** |
| Ionic | **6** (`@ionic/angular ^6.0.0`) |
| Capacitor | **7** (`@capacitor/core ^7.6.7`) |
| Apollo Client | `3.6.9` + `apollo-angular ^4.2.1` |
| GraphQL | `^15.8.0` |
| RxJS | **6.6** |
| TypeScript | 4.8.4 |

> ⚠️ **Gotcha — Capacitor 7, no 5.** Documentación previa del proyecto decía Capacitor 5. La migración a 7 se hizo en `4394df9 fix(android): migra a capacitor 7 para cumplir android 15/16 en play store`. Cualquier referencia a Capacitor 5 está obsoleta.

### Capacidades no obvias del stack

- **Visión / AI facial:** `@vladmandic/human` + `@tensorflow/tfjs-backend-wasm` (reconocimiento facial on-device), `@capacitor-mlkit/face-detection`, Azure Cognitive Face y Google Cloud Vision.
- **Escaneo:** `@capacitor-mlkit/barcode-scanning` es el **único** scanner soportado. No usar ZXing ni plugins Cordova de barcode.
- **OCR:** `@pantrist/capacitor-plugin-ml-kit-text-recognition`.
- **Biometría:** `@capgo/capacitor-native-biometric` (y `@ionic-native/fingerprint-aio` legacy, aún provisto en `app.module.ts:132`).
- **Mapas:** Google Maps (`@capacitor/google-maps`) y Leaflet coexisten.
- **Push:** FCM vía `@capacitor-community/fcm` + `@capacitor/push-notifications`.

> ⚠️ **Gotcha — `--legacy-peer-deps` es obligatorio.** El árbol mezcla `@ionic-native/*` (v5, deprecado) con `@awesome-cordova-plugins/*` (v6). Sin la flag, `npm install` falla. Por eso `npm run clean-install` la incluye.

## Estructura de `src/app/`

```
src/app/
├── app.module.ts          # Apollo (HTTP+WS), locale es-PY, APP_INITIALIZERs
├── app.component.ts/html  # Menú lateral, flujo de auth, chequeo de update
├── app-routing.module.ts  # Rutas raíz
├── components/            # 8 componentes reutilizables
├── dialog/                # Login y cambio de contraseña (globales)
├── domains/               # 20 modelos de dominio + enums
├── generic/               # GenericCrudService + utils
├── graphql/               # Operaciones GQL compartidas entre módulos
├── pages/                 # Pantallas, un módulo Ionic por área funcional
├── services/              # 30+ servicios transversales
└── splash/                # Splash screen
```

**Volumen:** ~690 archivos `.ts`, ~45.500 líneas. El módulo `pages/operaciones/` concentra ~39% del código.

> ⚠️ **Gotcha — hay dos lugares para GraphQL.** `src/app/graphql/` guarda operaciones compartidas (usuario, cliente, venta, venta-crédito), pero **la mayoría de los módulos define sus propias queries en `pages/<modulo>/graphql/`**. Al buscar una operación, revisá ambos.

## Convenciones de idioma

- **Dominio en español:** entidades, campos, rutas, textos de UI (`Sucursal`, `funcionario`, `guardar`). No traducir al refactorizar.
- **Identificadores genéricos en inglés:** `GenericCrudService`, `onSave`, `page`, `size`.
- **Commits en inglés** con prefijos convencionales (`feat(modulo): ...`). Ver [`actualizaciones-app.md`](actualizaciones-app.md) y la skill `frc-cicd`.
- **Locale:** `es-PY` registrado globalmente (`app.module.ts:51,137`).

## Scripts

```bash
npm start                  # ng serve --port 4300 (preview web)
npm run build              # ng build → www/
npm run refresh            # build + cap sync + cap copy  ← usar antes de probar en device
npm run build:android:debug # build + cap sync android + gradlew assembleDebug
npm run clean-install      # borra node_modules + lock + cache, reinstala con --legacy-peer-deps
```

> ⚠️ **Gotcha — `npm run lint` y `npm test` están rotos.** Son scripts declarados pero no utilizables: `ng lint` falla por builder ausente (`@angular-eslint/builder:lint not found`) y `ng test` falla por un import con typo en `edit-transferenci-producto.component.spec.ts` (TS2724). Ambos son defectos preexistentes. **El gate real de CI es `npm run build`.** No los uses como criterio de aceptación hasta que se arreglen en un PR dedicado.

> ⚠️ **Gotcha — `npm run refresh`, no `npm run build`.** Después de tocar código Angular, para probar en device hay que correr `refresh`: `build` solo genera `www/` pero no copia el bundle a `android/app/src/main/assets/public` ni sincroniza plugins nativos.

## Documentos relacionados

- [routing-navegacion.md](routing-navegacion.md) — cómo se navega
- [apollo-graphql.md](apollo-graphql.md) — cómo se habla con el backend
- [../REGLAS_DESARROLLO.md](../REGLAS_DESARROLLO.md) — antes de tocar el backend
