# Plan — el test de tokens de Material revisa también las hojas globales

Rama: `fix/pwa-test-tokens-hojas-globales` (desde `develop` @ `eaee816`).
Pieza: **mobile-pwa**, solo tests. Pedido de Franco (2026-09-22), a partir del
hallazgo del PR #57.

## Qué pasa hoy

`tokens-de-material.spec.ts` busca declaraciones `--mdc-*:` —letra muerta en
Material 21— con `import.meta.glob('../../**/*.{scss,ts}', { query: '?raw' })`.
En el runner de tests (`@angular/build:unit-test` + vitest), **los `.scss`
llegan vacíos**: el builder los intercepta. Verificado: de los 2 `.scss` del
glob (`src/styles.scss` y `src/styles/_tokens.scss`), 0 tienen contenido; los
`.ts` sí llegan (578 archivos). Los estilos de los componentes viven dentro de
los `.ts`, así que esos se revisan; **las dos hojas globales nunca**.

Hoy no hay ningún `--mdc-*:` en ellas (solo menciones en comentarios, que el
test ignora), así que el test pasa por la razón equivocada, no esconde un
defecto.

`sin-dialogos-nativos.spec.ts` usa el mismo patrón sobre `.ts` —que llegan
bien—, con una guarda que cuenta archivos pero no que tengan contenido; y su
comentario «no tiene los tipos de Node» ya no es cierto (`node:fs` compila:
`dialogos-margen.spec.ts` del PR #57).

## Cambio

- `tokens-de-material.spec.ts`: el glob sigue descubriendo los archivos; el
  **contenido de los `.scss` se lee del disco** (`readFileSync`), porque el
  del glob llega vacío.
- **Guarda de contenido** en los dos specs: si algún archivo que el test dice
  revisar llega vacío, el test falla. Es lo que habría detectado esto: una
  guarda que cuenta archivos no ve que están vacíos.
- En los `.scss`, **los comentarios se sacan como comentarios de SCSS**: los
  bloques `/* … */` antes de partir en líneas, y las líneas que empiezan con
  `//`. El filtro actual de líneas que empiezan con `*` es para el JSDoc de los
  `.ts`; aplicado a una hoja descarta el selector universal (`*, *::before…`,
  `styles.scss:32-34`), y un `--mdc-*` escrito ahí pasaría sin aviso (eje B).
- Un caso explícito en el de tokens: `src/styles.scss` y
  `src/styles/_tokens.scss` están entre los revisados y tienen contenido. La
  guarda de contenido sola no alcanza: si el glob dejara de encontrarlas (el
  spec o las hojas se mueven), no habría nada vacío que detectar.
- La guarda nombra en su falla el archivo vacío.
- Las claves del glob se resuelven a disco con
  `resolve(process.cwd(), 'src/app/pruebas', clave)`, no con
  `import.meta.url` (el builder sirve el bundle; puede no ser `file:`). El CI
  corre `npm test` desde la raíz.
- `tsconfig.spec.json` declara `"node"` en `types`: hoy los tipos de Node
  entran de rebote por una referencia de vite, y se romperían sin aviso si
  dejaran de hacerlo.
- Se corrige el comentario de `sin-dialogos-nativos.spec.ts`.

Queda afuera: `src/app/domains/configuracion/enums/tipo-dispositivo.model 2.ts`,
un duplicado versionado con espacio en el nombre (copia de macOS). Los dos
tests lo revisan, no rompe nada; se avisa a Franco.

## Tests

Mutación: agregar una declaración `--mdc-*:` en `styles.scss` y ver que el
test falla (hoy no falla); vaciar la lectura y ver fallar la guarda.

## Datos nuevos

Ninguno. No cambia código de la app.

## Auditoría del plan (paso 5)

| Eje | Hallazgo | Qué se hizo |
|---|---|---|
| A | CI corre desde la raíz; `import.meta.url` puede no ser `file:` | Resolver con `process.cwd()` |
| A | Tipos de Node de rebote por vite | `"node"` en `tsconfig.spec.json` |
| B | El filtro de `*` descarta el selector universal en SCSS: falso negativo | Comentarios de SCSS quitados como tales |
| B | Si el glob deja de ver las hojas, la guarda de contenido no lo detecta | Afirmar las dos rutas |
| A y B | Sin archivos vacíos hoy; duplicado `tipo-dispositivo.model 2.ts` | La guarda nombra el archivo; el duplicado se avisa |
