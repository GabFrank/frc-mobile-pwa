# Plan — el botón flotante de escaneo solo en pantallas de navegación

> Plan de trabajo. Se borra en el PR final (ciclo, paso 11); lo que sobrevive
> va a `docs/arquitectura/qr-del-sistema.md` y al plan de testeo manual.

## Qué resuelve

`frc-pagina` monta el botón flotante de escaneo con `conEscaner = true` por
defecto. El botón **siempre navega**: un QR del sistema abre su registro y un
código de barras lleva a Buscar (`EscanerUniversalService.escanearYNavegar`).
Eso estorba en tres clases de pantalla:

1. **Formularios con datos sin guardar.** No hay ningún `canDeactivate` en la
   app. En Nueva devolución el botón de volver pregunta «Salir sin guardar»,
   pero el flotante navega sin preguntar y lo cargado se pierde.
2. **Pantallas con su propio escanear.** Dos botones con el mismo ícono y
   comportamiento distinto: el de la pantalla actúa sobre el registro, el
   flotante saca de la pantalla. Mismo argumento que el bloque 53 (Buscar).
3. **Kiosco de marcación.** La tablet de la puerta: un toque saca a cualquiera
   de la pantalla de marcar. El comentario de `frc-pagina` ya decía que en modo
   kiosco se apaga; esta pantalla había quedado encendida.

## Decisión

El valor por defecto **no cambia** (`conEscaner = true`): el comentario de
`frc-pagina` lo defiende a propósito. Se apaga con `[conEscaner]="false"`,
pantalla por pantalla, igual que ya hacen las siete que lo tienen apagado.

## Auditoría del plan (paso 5) — qué cambió

Dos auditores, sin verse. Hallazgos verificados contra el código:

| Hallazgo | Qué se hizo |
|---|---|
| **Detalle de transferencia**: el flotante es el único camino para tomar una transferencia ajena parado en ella. `motivoDeBloqueo` pide «pedile el QR o el código y escanealo» y los tres escaneos propios leen sucursal y producto (`transferencia-detalle.page.ts`) | **Se saca de la lista: queda encendido.** Son 18, no 19 |
| El fix de formularios es **parcial**: la barra del shell (`shell.component.ts`) navega sin preguntar y no hay `canDeactivate`; 8 de los 11 ni interceptan volver | No se amplía el alcance. Se dice en el comentario de `frc-pagina` y queda como caso 80.7 (deuda conocida) |
| El kiosco de marcación cuelga del shell y tiene volver: apagar el flotante no lo vuelve un kiosco sin salida | Se apaga igual; se corrige el comentario que decía «no tiene navegación» |
| `<frc-pagina` como prefijo matchea `<frc-paginacion` | La prueba usa lookahead y mira el atributo dentro de la etiqueta de apertura |
| `comentarios.page.ts` tiene un campo sin enviar y queda encendida | Sin cambio: un comentario a medio escribir no es un formulario; fuera de alcance |

## Pantallas que se apagan (18 — la tabla lista las 19 del plan original)

> **Transferencia (detalle) no se apaga**: ver la auditoría de arriba.

| Clase | Pantalla | Archivo (`src/app/pages/…`) |
|---|---|---|
| Formulario | Abrir caja | `operaciones/caja/caja-abrir.page.ts` |
| Formulario | Cerrar caja | `operaciones/caja/caja-cerrar.page.ts` |
| Formulario | Nueva devolución | `operaciones/devolucion/devolucion-nueva.page.ts` |
| Formulario | Nueva solicitud de pago | `operaciones/solicitud-pago/solicitud-pago-nueva.page.ts` |
| Formulario | Nueva solicitud de gasto | `operaciones/gastos/gastos-solicitud-nueva.page.ts` |
| Formulario | Registrar cupón | `operaciones/venta-tarjeta/venta-tarjeta-registro.page.ts` |
| Formulario | Nuevo producto | `producto/editar/producto-nuevo.page.ts` |
| Formulario | Datos generales | `producto/editar/datos-generales.page.ts` |
| Formulario | Familia y subfamilia | `producto/editar/categoria.page.ts` |
| Formulario | Presentación | `producto/editar/presentacion-editar.page.ts` |
| Formulario | Precios | `producto/editar/precios.page.ts` |
| Escáner propio | Códigos | `producto/editar/codigos.page.ts` |
| Escáner propio | Recepción (detalle) | `operaciones/recepcion/recepcion-detalle.page.ts` |
| Escáner propio | Nueva recepción | `operaciones/recepcion/recepcion-nueva.page.ts` |
| Escáner propio | Transferencia (detalle) | `transferencias/transferencia-detalle.page.ts` |
| Escáner propio | Caja chica (lista) | `operaciones/gastos/gastos-lista.page.ts` |
| Escáner propio | Venta con tarjeta (lista) | `operaciones/venta-tarjeta/venta-tarjeta-lista.page.ts` |
| Escáner propio | Mis finanzas | `mis-finanzas/mis-finanzas.page.ts` |
| Kiosco | Marcación (kiosco) | `marcacion/kiosco-marcacion.page.ts` |

**Siguen encendidas:** Inicio, Operaciones, Mi trabajo, Cuenta, las listas sin
escáner propio, los detalles de solo lectura, el menú de edición de producto
(`producto-editar`) y la lista de presentaciones.

## Lo que se pierde, a propósito

Parado en una de esas 19 ya no se lee un QR del sistema de otro tipo (por
ejemplo, abrir una transferencia desde el detalle de otra). Se vuelve a una
lista o a Inicio con un toque. Es el mismo intercambio aceptado en el bloque 53.

## Fases

**Fase única** (commit + push):

1. `[conEscaner]="false"` en las 19 plantillas.
2. Comentario de `conEscaner` en `pagina.component.ts`: nombrar las tres clases.
3. Prueba `src/app/pruebas/pantallas-sin-fab.spec.ts`: lee el fuente de cada
   página con `<frc-pagina` y compara contra la lista explícita de apagadas.
   Una pantalla nueva nace encendida (default) y no rompe la prueba; lo que
   rompe es que una de la lista vuelva a encenderse o que el archivo se mude.
   Montar las 19 pantallas con sus dobles sería 19 fixtures de Apollo para
   verificar un atributo; `buscar-sin-fab.spec.ts` ya cubre que el atributo
   efectivamente quita el botón del DOM.
4. Verificación de bug: revertir una pantalla y ver la prueba en rojo.
5. Docs: bloque nuevo en `PLAN_TESTEO_MANUAL.md` + tabla de totales; corregir
   23.1 («el botón está en todas partes») y la lista del bloque 53; una línea
   en `qr-del-sistema.md` §«El ruteo universal».

## Datos nuevos

Ninguno. No hay campo, columna, clave ni operación GraphQL nueva. No toca el
central.

## Qué queda sin verificar

- En teléfono real: que ninguna de las 19 quede con la franja vacía al pie
  (la reserva `con-fab` se va con el botón) y que el flujo de escaneo propio
  de cada una siga igual. Se verifica con el bloque nuevo del plan de testeo.
