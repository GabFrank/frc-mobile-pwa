# Los QR del sistema

> **Vigente.** Cómo están hechos los QR internos de Franco Systems, quién los
> emite y adónde lleva cada uno.
>
> Para **cómo se leen** —cámara, ZXing, carga manual— ver
> [`escaner.md`](escaner.md). Esto es lo que dice el código adentro.

**Dónde vive:** `src/app/generic/utils/qrUtils.ts` (formato),
`src/app/core/dispositivo/escaneo-ruteo.ts` (ruteo).

---

## El formato

Un QR del sistema es una cadena con campos separados por guion, con prefijo
`frc`:

```
frc-{sucursalId}-{tipoEntidad}-{idOrigen}-{idCentral}-{componentToOpen}-{data}-{timestamp}
```

`descodificarQr()` devuelve `null` si no empieza con `frc-` o si tiene menos
campos de los mínimos. Nunca devuelve un objeto a medias: en `frc-mobile` sí
lo hacía, con `undefined` en cada campo, y eso convertía cualquier texto
escaneado en un QR aparentemente válido.

### ⚠️ Son siete campos mínimos, no ocho

`codificarQr()` siempre emite ocho, pero **el central emite una variante
corta de siete** que no pasa por este archivo:

```java
// PreGastoService.construirQrRetiro() — central
"frc-" + sucursalCajaId + "-PRE_GASTO_RETIRO-" + preGastoId + "-"
       + sucursalId + "-" + qrToken + "-" + timestamp
```

El timestamp cae en la posición de `data` y `timestamp` queda vacío.

Cuando el decodificador exigía ocho, **el escaneo de retiro de caja chica
dejó de funcionar del todo**: el QR que imprime el cajero se rechazaba con
«Ese código no es de esta aplicación», y como el bloque de caja chica del
plan de testeo estaba escrito y sin correr, nadie lo vio.

Moraleja para cualquier validación nueva sobre este formato: **el sistema
emite más de una variante, y no todas salen de este repo.**

### ⚠️ El separador es el guion, y no hay escape

Un campo que contenga un guion desplaza todo lo que sigue. Es una limitación
conocida del formato (ítem 11 del [`../TODO_TECNICO.md`](../TODO_TECNICO.md))
que **no se puede arreglar**: los QR ya impresos —los de los carteles de
depósito, los de las planillas— no se pueden reemitir.

Por eso los `qrToken` que genera el central son los primeros 8 caracteres de
un UUID: hexadecimal, sin guiones. Si alguien cambia esa generación, esto se
rompe en silencio.

---

## Dónde cae el id en cada tipo

**El id no está en el mismo campo para todos los tipos.** No es un descuido
que convenga normalizar: cada pantalla de `frc-mobile` que genera un QR
eligió su posición por su cuenta, y los QR impresos no se pueden reemitir.

Verificado generador por generador:

| `tipoEntidad` | Quién lo emite | Dónde está el id | Otros campos |
|---|---|---|---|
| `TRF` transferencia | `info-transferencia.component.ts:745` | `idOrigen` **y** `idCentral`, con el mismo valor | — |
| `INV` inventario | `edit-inventario.component.ts:530` | `idCentral` — **no escribe `idOrigen`** | `sucursalId` |
| `REC_MERC` recepción | `historico-nota-recepcion.component.ts:77` | `idCentral` e `idOrigen`, iguales | `sucursalId` |
| `VT` venta con tarjeta | el punto de venta (desktop) | `idOrigen` = venta | `componentToOpen` = `RegistroVentaTarjetaComponent`; `data` = `cajaId\|monto\|ventaTarjetaId` |
| `PRE_GASTO_RETIRO` | **el central**, `PreGastoService.java:500` | `idOrigen` = preGasto | `sucursalId` = sucursal de la **caja**; `idCentral` = sucursal del **gasto**; `componentToOpen` = `qrToken` |
| `VENTA_CREDITO` | el desktop, al armar el convenio | `idOrigen` = **persona** | `sucursalId`; `data` = clave de un solo uso; `timestamp` |
| `SUC` sucursal | cartel del depósito | `sucursalId` | — |

### El caso que más engaña

`PRE_GASTO_RETIRO` tiene tres campos en posiciones que su nombre no
anticipa. Leerlos por el nombre daba:

- la sucursal de la **caja** donde iba la del **gasto** — se notaba solo
  cuando la caja que paga es de otra sucursal, que es justamente para lo que
  existe `sucursalCaja`;
- el **timestamp** donde iba el **token** — el central respondía «código
  inválido o expirado».

Por eso interpretarlo vive en `interpretarQrRetiro()`, con sus tests, y no en
la pantalla. Lo mismo `interpretarQrVenta()` para el cupón.

⚠️ **`PRE_GASTO_RETIRO` no está en el enum `TipoEntidad`.** El central lo
escribe como cadena literal. Se declara como constante en
`gasto-retiro-qr.ts`; agregarlo al enum sería inventar un miembro que el
backend no conoce.

---

## El ruteo universal

El botón flotante lee cualquier código y decide el destino. La tabla vive en
`rutearEscaneo()` — función pura, con tests.

```
texto escaneado
   ├── ¿empieza con "frc-" y tiene ≥7 campos?
   │      ├── sí → según tipoEntidad
   │      └── no → código de barras de producto → /buscar?codigo=…
```

**El orden importa.** Primero se intenta leer como QR del sistema; recién si
no lo es se trata como código de producto. Al revés, un QR interno terminaría
buscándose como si fuera un EAN.

| Tipo | Destino |
|---|---|
| `TRF` | `/transferencias/:id` |
| `INV` | `/inventario/:id` |
| `REC_MERC` | `/operaciones/recepcion/:id` |
| `SOLPAG` | `/operaciones/solicitud-pago/:id` |
| `PRE_GASTO_RETIRO` | `/operaciones/gastos/:id/:sucursal?token=…` |
| `VT` | `/operaciones/venta-tarjeta?qr=…` — **entero** |
| `VENTA_CREDITO` | `/mis-finanzas?qr=…` — **entero** |
| `SUC` | Ninguno. Explica que se escanea desde adentro de un flujo |
| cualquier otro | Aviso de que no abre ninguna pantalla |

### Por qué tres viajan enteros

`VT`, `VENTA_CREDITO` y —parcialmente— el retiro **no se resuelven en el
ruteador**: necesitan contexto que el ruteador no tiene.

- El cupón de tarjeta solo lo puede registrar **el cajero de turno**, y eso
  se valida contra la caja abierta.
- La compra a crédito se autoriza contra **la persona en sesión**.
- El retiro se confirma contra su **token**.

El QR viaja entero por la URL y la pantalla de destino lo valida con la misma
función que usa su propio botón de escanear. **Es la parte que no se puede
duplicar**: si el camino del FAB hiciera su propia validación, podría
saltearse un control que el otro camino hace. Por eso `procesarQr()` está
separado de `escanear()` en esas pantallas, y los dos caminos lo llaman.

### Por qué por la URL y no por estado de navegación

Para que sobreviva a una recarga. El operador escanea, el service worker
adopta una versión nueva, la app se recarga — y el cupón no se puede perder
en el camino.

---

## Al agregar un tipo nuevo

1. **Mirá cómo lo emite quien lo emite**, no cómo se llama el campo. La tabla
   de arriba existe porque tres tipos no coinciden entre sí.
2. Si resuelve a un id, entra en `REGLAS` de `escaneo-ruteo.ts` declarando de
   qué campo sale su id. **No** uses `idCentral ?? idOrigen`: hoy funciona de
   casualidad y se rompe con el primer tipo que no siga esa forma.
3. Si necesita contexto de pantalla, va como caso aparte y viaja entero.
4. Usá `idDeRegistro()` para el id: `Number('')` es `0` y sin eso un QR
   incompleto navega al registro cero.
5. Sumá el caso a `escaneo-ruteo.spec.ts` con valores que **no coincidan
   entre sí**, para que leer un campo por otro haga fallar el test.
