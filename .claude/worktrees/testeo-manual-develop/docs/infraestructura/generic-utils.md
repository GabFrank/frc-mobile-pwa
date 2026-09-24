# Utilidades genéricas

`src/app/generic/utils/`. Funciones puras compartidas. Salvo `CustomValidatorsService`, no son servicios inyectables: se importan directo.

---

## `barcodeUtils.ts` — interpretación de escaneos

**La pieza más cargada de reglas de negocio de todo `generic/`.** Convierte lo que devuelve el scanner en candidatos de código para buscar el producto.

### `codigosParaBuscar(text): string[]`

Devuelve **candidatos en orden de prioridad**, no un único código. El llamador prueba uno por uno contra `productoPorCodigo` hasta encontrar producto.

Existe porque un mismo escaneo puede corresponder a varias representaciones válidas: un GS1 trae el GTIN embebido, un EAN-14 con cero inicial es el mismo producto que su EAN-13, un Code128 interno puede ser alfanumérico.

Orden de acumulación:

1. Si es **código pesable** → el texto completo
2. **Prefijo numérico** de 6 a 14 dígitos
3. **GTIN de GS1** `(01)` — y si tiene 14 dígitos y empieza con `0`, también la versión de 13
4. **Token alfanumérico** (4-32 chars, `A-Z0-9-._`), si difiere del numérico
5. El **texto completo** si es un token único sin espacios
6. El texto completo si es un **código numérico** de 6 a 14 dígitos

Duplicados descartados; todo se normaliza con `normalizarCodigo` (trim + mayúsculas).

### Códigos pesables — regla de balanza

```ts
esCodigoPesable(text)   // largo 13 y empieza con '20'
parseCodigoPesable(text) // → { codigoInterno, peso }
```

Formato de la etiqueta que imprime la balanza:

```
20 XXXXX PPPPP C
│  │     │     └── dígito verificador (ignorado)
│  │     └──────── peso en gramos (posiciones 7-12) → se divide por 1000 para kg
│  └────────────── código interno del producto (posiciones 2-7)
└───────────────── prefijo fijo '20' = pesable
```

> ⚠️ **Gotcha — el peso viene en gramos.** `parseCodigoPesable` divide por 1000 y devuelve **kilos**. Si mostrás el valor crudo del código, la cantidad sale 1000× más grande.

> ⚠️ **Gotcha — el prefijo `20` es una convención local.** Está hardcodeado. Si una sucursal configura sus balanzas con otro prefijo, ningún código pesable se reconoce y el escaneo cae al camino de código normal, buscando un producto que no existe.

### Otras funciones

- `normalizarCodigo(codigo)` — trim + mayúsculas. Toda comparación de códigos debería pasar por acá.
- `pareceBusquedaPorCodigo(text)` — `true` si hay al menos un candidato. Sirve para decidir entre buscar por código o por descripción.
- `extractCodigoBarra(text)` — **`@deprecated`**. Devuelve solo el primer candidato. Se mantiene por compatibilidad; en código nuevo usá `codigosParaBuscar`.

---

## `qrUtils.ts` — QR internos de la app

Formato propio, delimitado por guiones:

```
frc-{sucursalId}-{tipoEntidad}-{idOrigen}-{idCentral}-{componentToOpen}-{data}-{timestamp}
```

- `codificarQr(data: QrData): string`
- `descodificarQr(codigo: string): QrData`

`componentToOpen` permite que un QR abra una pantalla concreta — así funciona el escaneo de venta desde el home, por ejemplo.

> ⚠️ **Gotcha — el formato se rompe si algún campo contiene un guion.** El decodificador hace `split('-')` y toma posiciones fijas. Un `data` con guion desplaza todos los campos siguientes. No hay escapado ni validación del prefijo `frc`: `descodificarQr` acepta cualquier cadena y devuelve un objeto con `undefined` donde falten partes.

> ⚠️ **Gotcha — no hay validación de `timestamp`.** El campo se transporta pero nadie chequea antigüedad: un QR viejo sigue siendo válido indefinidamente.

---

## `numbersUtils.ts`

| Export | Uso |
|---|---|
| `NumberUtils` | Clase con helpers numéricos |
| `CurrencyMask` | Máscara de moneda para `ngx-currency` |
| `isInt(n)` | Chequeo de entero |
| `stringToInteger`, `stringToDecimal`, `stringToCantidad`, `stringToUnknown` | Parseo desde inputs de texto |
| `updateDataSource`, `updateDataSourceWithId` | Reemplazo de un elemento dentro de un array (patrón para refrescar listas tras guardar) |

Los `stringTo*` existen porque los inputs con máscara de moneda devuelven strings con separadores de miles y coma decimal (formato `es-PY`), que `parseFloat` no interpreta bien.

---

## `dateUtils.ts`

- `dateToString(date)` → `'yyyy-MM-dd HH:mm'`.
- `convertMsToTime(ms)` → `'HH:MM:SS'`. **Las horas no se limitan a 24**: 36 horas dan `36:15:31`, no `12:15:31`. Es intencional (duraciones acumuladas, no hora del día).

---

## `string-utils.ts`

- **`comparatorLike(str1, str2)`** — búsqueda difusa: convierte `str1` en un regex intercalando `.*` entre sus caracteres (ignorando espacios) y lo matchea contra `str2`. Así `"cocacola"` matchea `"Coca Cola 2L"`.

  > ⚠️ **Gotcha — no escapa caracteres especiales.** Si `str1` trae `(`, `[`, `*` o similares, el `new RegExp` puede lanzar excepción. Usalo solo con entrada de búsqueda saneada.

- **`generateUUID()`** — UUID v4 con `Math.random()`. Sirve para el `deviceId`; **no lo uses como fuente de aleatoriedad segura**.

---

## Resto

| Archivo | Exports | Notas |
|---|---|---|
| `arraysUtil.ts` | `orderByIdAsc`, `orderByIdDesc`, `replaceObject` | Ordenamiento y reemplazo en arrays |
| `objectUtils.ts` | `toObjectInput`, `objToJson`, `jsonToObj` | Conversión modelo → input GraphQL |
| `enumUtils.ts` | `enumToArray`, `getEnumValueByValue` | Poblar selects desde enums |
| `custom-validators.service.ts` | `CustomValidatorsService` | Validadores de formularios reactivos (**sí es inyectable**) |
| `regex.ts` | `emailregex` | Único regex compartido |
| `imageUtils.ts` | — | Helpers de imagen |
| `pipes/enum-to-string.ts` | `EnumToStringPipe` | Pipe para mostrar enums en templates |
