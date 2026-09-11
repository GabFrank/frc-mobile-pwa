# Migración: Histórico Recepción Mercadería

## Resumen

Este documento describe la migración del componente `historico-nota-recepcion` de usar la entidad `NotaRecepcionAgrupada` (deprecada) a `RecepcionMercaderia` (nueva entidad del backend refactorizado).

## Contexto

El backend fue refactorizado para reemplazar `NotaRecepcionAgrupada` con `RecepcionMercaderia`, que modela de forma más precisa un evento de recepción física de una o más notas. El frontend mobile necesitaba ser adaptado para sincronizar con este cambio.

## Cambios Realizados

### 1. Modelo de Datos

**Archivo**: `src/app/pages/operaciones/pedidos/recepcion-mercaderia/recepcion-mercaderia.model.ts`

**Cambios**:
- Creado nuevo modelo `RecepcionMercaderia` con los siguientes campos:
  - `id`: number
  - `proveedor`: Proveedor
  - `sucursalRecepcion`: Sucursal (cambió de `sucursal` a `sucursalRecepcion`)
  - `fecha`: Date (cambió de `creadoEn` a `fecha`)
  - `moneda`: Moneda (nuevo campo)
  - `cotizacion`: number (nuevo campo)
  - `estado`: RecepcionMercaderiaEstado
  - `usuario`: Usuario
  - `cantNotas`: number (campo calculado)
  - `notas`: NotaRecepcionSimple[] (para calcular cantNotas)

- Creado enum `RecepcionMercaderiaEstado`:
  - `PENDIENTE`
  - `EN_PROCESO`
  - `FINALIZADA`
  - `CANCELADA`

### 2. Mapeo de Estados

| Estado Antiguo (NotaRecepcionAgrupada) | Estado Nuevo (RecepcionMercaderia) |
|----------------------------------------|-------------------------------------|
| `EN_RECEPCION`                         | `EN_PROCESO`                        |
| `CONCLUIDO`                            | `FINALIZADA`                        |
| `CANCELADO`                            | `CANCELADA`                         |

### 3. Query GraphQL

**Archivo**: `src/app/pages/operaciones/pedidos/recepcion-mercaderia/graphql/recepcionMercaderiaConFiltros.ts`

**Cambios**:
- Creada nueva query `recepcionMercaderiaConFiltros` que reemplaza `notaRecepcionListPorUsuarioId`
- La query acepta filtros: `usuarioId`, `page`, `size`
- Incluye campo `notas { id }` para calcular `cantNotas` en el frontend

**Query GraphQL**:
```graphql
query recepcionMercaderiaConFiltros(
  $usuarioId: ID,
  $page: Int,
  $size: Int
) {
  data: recepcionMercaderiaConFiltros(
    usuarioId: $usuarioId,
    page: $page,
    size: $size
  ) {
    getTotalPages
    getTotalElements
    getNumberOfElements
    isFirst
    isLast
    hasNext
    hasPrevious
    getContent {
      id
      proveedor { ... }
      sucursalRecepcion { ... }
      fecha
      estado
      usuario { ... }
      notas { id }
    }
  }
}
```

### 4. Servicio

**Archivo**: `src/app/pages/operaciones/pedidos/recepcion-mercaderia/recepcion-mercaderia.service.ts`

**Cambios**:
- Creado nuevo servicio `RecepcionMercaderiaService`
- Método `onGetRecepcionMercaderiaListPorUsuarioId(id, page, size)` que usa `recepcionMercaderiaConFiltros`
- Utiliza `GenericCrudService.onCustomGet()` siguiendo el patrón del proyecto

### 5. Componente Histórico

#### TypeScript
**Archivo**: `src/app/pages/operaciones/pedidos/nota-recepcion/historico-nota-recepcion/historico-nota-recepcion.component.ts`

**Cambios**:
- Import cambiado de `NotaRecepcionAgrupada` a `RecepcionMercaderia`
- Servicio cambiado de `NotaRecepcionAgrupadaService` a `RecepcionMercaderiaService`
- Propiedades actualizadas:
  - `notaRecepcionAgrupadaList` → `recepcionMercaderiaList`
  - `PageInfo<NotaRecepcionAgrupada>` → `PageInfo<RecepcionMercaderia>`
- Método `onSearchNotaRecepcionAgrupada()` → `onSearchRecepcionMercaderia()`
- Cálculo de `cantNotas` desde `notas.length` en el subscribe

#### HTML
**Archivo**: `src/app/pages/operaciones/pedidos/nota-recepcion/historico-nota-recepcion/historico-nota-recepcion.component.html`

**Cambios**:
- Variable `notaRecepcionAgrupada` → `recepcionMercaderia`
- Campo `creadoEn` → `fecha`
- Clases CSS de estado actualizadas:
  - `en_recepcion` → `en_proceso`
  - `concluido` → `finalizada`
  - `cancelado` → `cancelada`

#### SCSS
**Archivo**: `src/app/pages/operaciones/pedidos/nota-recepcion/historico-nota-recepcion/historico-nota-recepcion.component.scss`

**Cambios**:
- Agregado estilo `.en_proceso` (color verde #43a047)
- Agregado estilo `.finalizada` (color azul #2196f3)
- Mantenido estilo `.cancelada` (color rojo #f44336)

## Cálculo de cantNotas

El campo `cantNotas` no está disponible directamente en el backend. Se calcula en el frontend desde el array `notas`:

```typescript
this.recepcionMercaderiaList = res.getContent.map(rm => {
  rm.cantNotas = rm.notas?.length || 0;
  return rm;
});
```

**Nota**: Si el backend no expone el campo `notas` en el resolver, será necesario agregarlo en `RecepcionMercaderiaResolver.java`:

```java
@Autowired
private RecepcionMercaderiaNotaService recepcionMercaderiaNotaService;

public List<NotaRecepcion> notas(RecepcionMercaderia recepcion) {
    return recepcionMercaderiaNotaService.findByRecepcionMercaderiaId(recepcion.getId())
        .stream()
        .map(RecepcionMercaderiaNota::getNotaRecepcion)
        .collect(Collectors.toList());
}
```

Y agregar el campo en el schema GraphQL:
```graphql
type RecepcionMercaderia {
    ...
    notas: [NotaRecepcion]
}
```

## Estructura de Archivos

### Archivos Creados
- `src/app/pages/operaciones/pedidos/recepcion-mercaderia/recepcion-mercaderia.model.ts`
- `src/app/pages/operaciones/pedidos/recepcion-mercaderia/recepcion-mercaderia.service.ts`
- `src/app/pages/operaciones/pedidos/recepcion-mercaderia/graphql/recepcionMercaderiaConFiltros.ts`
- `src/app/pages/operaciones/pedidos/recepcion-mercaderia/graphql/graphql-query.ts`
- `src/app/docs/manuales_de_refactor/historico-recepcion-mercaderia.md`

### Archivos Modificados
- `src/app/pages/operaciones/pedidos/nota-recepcion/historico-nota-recepcion/historico-nota-recepcion.component.ts`
- `src/app/pages/operaciones/pedidos/nota-recepcion/historico-nota-recepcion/historico-nota-recepcion.component.html`
- `src/app/pages/operaciones/pedidos/nota-recepcion/historico-nota-recepcion/historico-nota-recepcion.component.scss`

## Consideraciones Importantes

1. **Backend no afecta Desktop**: El método `recepcionMercaderiaConFiltros` es nuevo y no se usa en desktop, por lo que se puede usar directamente sin afectar funcionalidad existente.

2. **Compatibilidad de rutas**: La navegación a `/operaciones/pedidos/recepcion-producto/:id` se mantiene temporalmente. Se adaptará en la siguiente fase de migración.

3. **Estados**: Los estados antiguos se mapean a los nuevos. El pipe `enumToString` sigue funcionando correctamente.

4. **Paginación**: La paginación se mantiene igual, usando `PageInfo<T>`.

## Verificación

- [x] Query GraphQL creada correctamente
- [x] Modelo RecepcionMercaderia creado
- [x] Servicio RecepcionMercaderiaService creado
- [x] Componente histórico adaptado (TS, HTML, SCSS)
- [x] Documentación creada
- [ ] Verificar que el backend expone el campo `notas` en el resolver
- [ ] Probar funcionalidad completa en la aplicación

## Próximos Pasos

1. Verificar si el backend expone el campo `notas` en el resolver. Si no, agregarlo.
2. Probar la funcionalidad completa en la aplicación móvil.
3. Continuar con la migración de otros componentes que usan `NotaRecepcionAgrupada`:
   - `recepcion-producto.component.ts`
   - `recepcion-notas.component.ts`
   - `solicitar-pago-nota-recepcion.component.ts`
   - Otros componentes relacionados

## Referencias

- Backend refactor documentation: `BACKEND_REFACTOR_SCHEMA_DETALLADO.md`
- Backend entity: `RecepcionMercaderia.java`
- Backend GraphQL resolver: `RecepcionMercaderiaGraphQL.java`
- Backend GraphQL schema: `recepcion-mercaderia.graphqls`
