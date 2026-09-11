# Procedimiento: Reabrir Recepciones, Deshacer Verificaciones y Finalizar con Pendientes

## Resumen Ejecutivo

Este documento describe el procedimiento completo para **reabrir recepciones finalizadas**, **deshacer verificaciones de items ya verificados** y **finalizar recepciones con items pendientes marcándolos como rechazados**, incluyendo todas las validaciones, restricciones y lo que se puede y no se puede hacer.

---

## 1. REABRIR RECEPCIÓN

### 1.1 ¿Qué hace?

Cambia el estado de una recepción de `FINALIZADA` a `EN_PROCESO`, permitiendo realizar correcciones o modificaciones.

### 1.2 Procedimiento

1. **Usuario hace click en "Reabrir Recepción"** (solo visible cuando `estado == 'FINALIZADA'`)
2. **Frontend muestra diálogo de confirmación**: "¿Realmente desea reabrir esta recepción?"
3. **Si acepta**, se llama a `reabrirRecepcionMercaderia(recepcionId)`
4. **Backend valida**:
   - Que el `recepcionId` no sea null
   - Que la recepción exista
   - Que el estado actual sea `FINALIZADA` (no se puede reabrir si está `EN_PROCESO` o `CANCELADA`)
5. **Backend cambia el estado** de `FINALIZADA` a `EN_PROCESO`
6. **Frontend actualiza** la recepción con el nuevo estado

### 1.3 Validaciones

#### ✅ Se puede reabrir si:
- La recepción existe
- El estado es `FINALIZADA`
- **NO hay validación de tiempo** (el método `reabrirRecepcionMercaderia` NO valida las 24 horas)

#### ❌ No se puede reabrir si:
- El `recepcionId` es null
- La recepción no existe
- El estado NO es `FINALIZADA` (debe ser exactamente `FINALIZADA`)

### 1.4 Limitaciones Importantes

⚠️ **CRÍTICO**: El método `reabrirRecepcionMercaderia` **NO revierte movimientos de stock ni costos**. Solo cambia el estado.

- Los movimientos de stock generados al finalizar **permanecen intactos**
- Los costos calculados **no se revierten**
- Solo permite **modificar items** o **agregar nuevos items**

### 1.5 Código de Referencia

**Frontend**: `recepcion-producto.component.ts` - método `onReabrirRecepcion()` (línea 219)
**Backend**: `RecepcionMercaderiaGraphQL.java` - método `reabrirRecepcionMercaderia()` (línea 693)

---

## 2. DESHACER VERIFICACIÓN DE ITEMS

### 2.1 ¿Qué hace?

Elimina completamente la verificación de un producto en una recepción, incluyendo:
- Todos los `RecepcionMercaderiaItem` del producto
- Todas las variaciones asociadas (cascade delete)
- Todos los movimientos de stock generados (TipoMovimiento.COMPRA)
- La recepción se mantiene aunque quede vacía

### 2.2 Procedimiento

1. **Usuario hace click en botón "Deshacer"** (icono undo) en un item con estado `RECIBIDO` o `RECIBIDO_PARCIALMENTE`
2. **Frontend valida**:
   - Que el item tenga estado `RECIBIDO` o `RECIBIDO_PARCIALMENTE`
   - Que la recepción no esté `CANCELADA`
3. **Frontend muestra diálogo de confirmación**: "¿Realmente desea deshacer la verificación de este producto? Esta acción eliminará todos los items de recepción asociados a este producto."
4. **Si acepta**, se llama a `deshacerVerificacionPorProducto(recepcionMercaderiaId, productoId)`
5. **Backend ejecuta**:
   - Verifica que existe la recepción
   - **Si la recepción está FINALIZADA**:
     - Valida que no hayan pasado más de 24 horas desde la finalización
     - Si pasa la validación, **reabre automáticamente** la recepción (cambia a `EN_PROCESO`)
   - Busca todos los `RecepcionMercaderiaItem` del producto en la recepción
   - Para cada item:
     - Busca y elimina movimientos de stock (TipoMovimiento.COMPRA)
     - **Resetea el item a pendiente** (cantidadRecibida=0, cantidadRechazada=0, motivoRechazo=null, estadoVerificacion=PENDIENTE, limpia variaciones) — **no elimina el item**, para permitir re-verificar o finalizar marcando como rechazado
   - La recepción se mantiene aunque quede vacía
6. **Frontend recarga** la lista de items y la recepción

### 2.3 Validaciones

#### ✅ Se puede deshacer verificación si:
- El item tiene estado `RECIBIDO` o `RECIBIDO_PARCIALMENTE`
- La recepción existe
- La recepción no está `CANCELADA`
- **Si la recepción está FINALIZADA**: No han pasado más de 24 horas desde la finalización

#### ❌ No se puede deshacer verificación si:
- El item tiene estado `PENDIENTE`
- La recepción está `CANCELADA`
- La recepción no existe
- **Si la recepción está FINALIZADA**: Han pasado más de 24 horas desde la finalización

### 2.4 Validación de 24 Horas (CRÍTICA)

La validación de 24 horas se calcula así:

1. **Obtiene la fecha de finalización**:
   - Busca todos los movimientos de stock (TipoMovimiento.COMPRA) asociados a los items de la recepción
   - Toma la fecha más reciente (`creadoEn`) de esos movimientos
   - Si no hay movimientos de stock, retorna `null` (permite continuar)

2. **Calcula horas transcurridas**:
   - `horasTranscurridas = HORAS_ACTUALES - fechaFinalizacion`

3. **Valida**:
   - Si `horasTranscurridas > 24`: **LANZA EXCEPCIÓN** - No se puede deshacer
   - Si `horasTranscurridas <= 24`: **PERMITE CONTINUAR**

### 2.5 Efectos Secundarios

Cuando se deshace una verificación:

1. **Elimina movimientos de stock**: Los movimientos de tipo `COMPRA` asociados al item se eliminan
2. **Elimina items de recepción**: Los `RecepcionMercaderiaItem` se eliminan (cascade elimina variaciones)
3. **Reabre recepción automáticamente**: Si estaba `FINALIZADA`, cambia a `EN_PROCESO` (si pasa validación de 24h)
4. **Mantiene la recepción**: La recepción se conserva aunque quede vacía, permitiendo agregar más items sin crear una nueva

### 2.6 Código de Referencia

**Frontend**: `recepcion-producto.component.ts` - método `onDeshacerVerificacion()` (línea 247)
**Backend**: `RecepcionMercaderiaItemService.java` - método `deshacerVerificacionPorProducto()` (línea 611)
**Backend**: `RecepcionMercaderiaItemService.java` - método `validarTiempoDesdeFinalizacion()` (línea 486)
**Backend**: `RecepcionMercaderiaItemService.java` - método `obtenerFechaFinalizacion()` (línea 449)

---

## 3. COMPARACIÓN: REABRIR vs DESHACER VERIFICACIÓN

| Aspecto | Reabrir Recepción | Deshacer Verificación |
|---------|-------------------|----------------------|
| **Qué cambia** | Solo el estado (`FINALIZADA` → `EN_PROCESO`) | Elimina items, variaciones y movimientos de stock |
| **Movimientos de stock** | ❌ NO se eliminan | ✅ SÍ se eliminan |
| **Validación de 24h** | ❌ NO valida | ✅ SÍ valida (si está FINALIZADA) |
| **Reabre automáticamente** | ❌ No aplica | ✅ SÍ (si está FINALIZADA y pasa validación) |
| **Elimina recepción vacía** | ❌ No aplica | ❌ No (se mantiene para agregar más items) |
| **Cuándo usar** | Para permitir modificaciones sin eliminar datos | Para corregir errores eliminando verificaciones incorrectas |

---

## 4. FLUJO COMPLETO DE ESTADOS

```
PENDIENTE (sin usuario)
    ↓
EN_PROCESO (con usuario, items verificándose)
    ↓
FINALIZADA (todos los items verificados, movimientos de stock creados)
    ↓
[Reabrir] → EN_PROCESO (permite modificar, pero NO revierte stock)
    ↓
[Deshacer verificación] → Elimina items y stock, puede volver a EN_PROCESO
```

---

## 5. CASOS DE USO

### Caso 1: Recepción finalizada hace 2 horas - Error en un producto
**Solución**: 
- Click en "Deshacer verificación" del producto incorrecto
- El sistema valida que pasaron menos de 24 horas ✅
- Reabre automáticamente la recepción
- Elimina el item y sus movimientos de stock
- Usuario puede verificar nuevamente el producto correctamente

### Caso 2: Recepción finalizada hace 30 horas - Error en un producto
**Solución**: 
- Click en "Deshacer verificación" del producto incorrecto
- El sistema valida que pasaron más de 24 horas ❌
- **LANZA EXCEPCIÓN**: "No se puede reabrir una recepción finalizada hace más de 24 horas"
- **NO se puede deshacer la verificación**

### Caso 3: Recepción finalizada - Necesito agregar más items
**Solución**: 
- Click en "Reabrir Recepción"
- El sistema cambia el estado a `EN_PROCESO`
- Usuario puede agregar nuevos items
- **Los movimientos de stock existentes NO se eliminan**

### Caso 4: Recepción finalizada - Error en múltiples productos de la misma nota
**Solución**: 
- Click en "Deshacer verificación" de cada producto incorrecto
- Cada deshacer elimina los items y movimientos de stock
- La recepción se mantiene aunque no queden items, permitiendo agregar más

---

## 6. RECOMENDACIONES

1. **Usar "Reabrir Recepción"** cuando:
   - Solo necesitas agregar nuevos items
   - No necesitas eliminar items existentes
   - Los movimientos de stock están correctos

2. **Usar "Deshacer Verificación"** cuando:
   - Hay errores en la verificación de un producto
   - Necesitas corregir cantidades o variaciones
   - Quieres eliminar completamente la verificación de un producto

3. **Consideraciones de tiempo**:
   - Las recepciones finalizadas hace más de 24 horas **NO pueden tener verificaciones deshechas**
   - Esto protege la integridad de los datos históricos
   - Si necesitas corregir después de 24 horas, deberás crear una nueva recepción o ajuste de inventario

---

## 3. FINALIZAR CON ITEMS PENDIENTES COMO RECHAZADOS

### 3.1 ¿Qué hace?

Cuando existen items pendientes (cantidad a recibir > cantidad recibida + cantidad rechazada) y el usuario desea finalizar la recepción, esos items pendientes se marcan como rechazados con un motivo general. Esto evita finalizar una recepción dejando cantidades "a medias" que no generan stock.

### 3.2 Procedimiento

1. **Usuario hace click en "Finalizar Recepción"**
2. **Frontend obtiene items pendientes** (cantidadPendiente > 0)
3. **Si hay items pendientes**:
   - Muestra diálogo: "Hay X item(s) pendiente(s) que serán marcados como rechazados: [lista]. ¿Desea continuar?"
   - Usuario puede **Cancelar** (no hace nada) o **Continuar**
4. **Si continúa**:
   - Muestra ActionSheet con opciones de **Motivo de rechazo** (PRODUCTO_DANADO, PRODUCTO_VENCIDO, CANTIDAD_INCORRECTA, PRODUCTO_DIFERENTE, EMBALAJE_DANADO, OTRO)
   - Usuario selecciona motivo
5. **Backend ejecuta** (operación atómica):
   - Para cada `RecepcionMercaderiaItem` con cantidad pendiente > 0: actualiza `cantidadRechazada` y `motivoRechazo`
   - Genera movimientos de stock para items con cantidadRecibida > 0
   - Marca recepción como FINALIZADA
6. **Si no hay items pendientes**: Flujo normal de confirmación y finalización.

### 3.3 Validaciones

- Los items pendientes se identifican por: `cantidadEsperada - cantidadRecibida - cantidadRechazada > 0`
- La cantidad esperada viene de `NotaRecepcionItemDistribucion.cantidad` o `NotaRecepcionItem.cantidadEnNota`
- El motivo de rechazo es obligatorio cuando hay pendientes

### 3.4 Código de Referencia

**Frontend**: `recepcion-producto.component.ts` - métodos `onFinalizarRecepcion()`, `obtenerItemsPendientes()`, `mostrarDialogoMotivoYFinalizar()`
**Backend**: `RecepcionMercaderiaService.finalizarRecepcion(recepcionId, motivoRechazoPendientes)`, `aplicarRechazoPendientes()`
**GraphQL**: `finalizarRecepcionMercaderia(recepcionId, rechazoPendientes: RechazoPendientesInput)`

---

## 7. PREGUNTAS FRECUENTES

**P: ¿Por qué no se puede deshacer verificación después de 24 horas?**
R: Para proteger la integridad de los datos históricos y evitar que se modifiquen movimientos de stock antiguos que pueden haber afectado otros procesos (ventas, transferencias, etc.).

**P: ¿Qué pasa si deshago la verificación de todos los productos?**
R: La recepción se mantiene aunque no queden items, permitiendo agregar más productos sin crear una nueva recepción.

**P: ¿Los movimientos de stock se eliminan físicamente o se marcan como eliminados?**
R: Se eliminan físicamente usando `movimientoStockService.delete()`, lo que también actualiza el stock en tiempo real.

**P: ¿Puedo reabrir una recepción cancelada?**
R: No. Solo se pueden reabrir recepciones con estado `FINALIZADA`. Las recepciones `CANCELADAS` no se pueden reabrir.

---

## 8. VERIFICACIÓN PARCIAL CON RECHAZOS Y MÚLTIPLES NOTAS

### 8.1 Problema

Cuando un mismo producto está en varias notas (p. ej. producto 5567 en notas 50, 51 y 52 con 10, 2 y 3 unidades) y el usuario hace verificación parcial con rechazos (12 recibidos, 3 rechazados) eligiendo una nota para el rechazo, **debe mantenerse la trazabilidad por nota**: el rechazo se registra solo en la nota seleccionada; lo recibido se reparte entre todas las notas según su cantidad pendiente.

### 8.2 Lógica correcta

Si el usuario elige la nota con 10 unidades para el rechazo (3 unidades):
- **Nota 10 uds**: 7 recibidas + 3 rechazadas = 10
- **Nota 2 uds**: 2 recibidas
- **Nota 3 uds**: 3 recibidas  
- **Total**: 12 recibidas + 3 rechazadas ✓

### 8.3 Implementación (Frontend Mobile)

- **Archivo**: `recepcion-producto-verificacion-dialog.component.ts`
- **Método**: `distribuirCantidadConRechazo()` – distribuye recibido y rechazado por nota
- **Flujo**: Al guardar con rechazos y múltiples notas:
  1. Se solicita al usuario que seleccione en qué nota va el rechazo (selector de NotaRecepcionItem)
  2. Se calcula la distribución: rechazo solo en la nota seleccionada; lo recibido se reparte (incluyendo la nota seleccionada hasta su capacidad restante)
  3. Se llama `saveRecepcionMercaderiaItem` una vez por cada nota afectada (varias llamadas en secuencia)

### 8.4 Validaciones

- La nota seleccionada debe tener `cantidadPendiente >= cantidadRechazadaTotal`
- Si no hay espacio suficiente, se muestra: "La nota seleccionada no tiene cantidad pendiente suficiente para el rechazo indicado"

---

## 9. NOTAS TÉCNICAS

- Todos los métodos son `@Transactional` para garantizar consistencia
- Los movimientos de stock se buscan por `TipoMovimiento.COMPRA` y `referencia = item.id`
- La eliminación de items usa cascade delete para eliminar variaciones automáticamente
- El frontend valida el estado antes de mostrar el botón de deshacer
- El backend valida el estado antes de ejecutar cualquier operación
