# Reglas de Desarrollo - Proyecto FRC Sistemas Informáticos

## Estructura del Proyecto

- **Backend**: `/Users/gabfranck/workspace/frc-sistemas-informaticos/backend/central/frc-central-server/`
- **Front Desktop**: `/Users/gabfranck/workspace/frc-sistemas-informaticos/frontend/desktop/frc-sistemas-informaticos/`
- **Front Mobile**: `/Users/gabfranck/workspace/frc-sistemas-informaticos/frontend/mobile/frc-app/`

## Reglas Críticas para Modificaciones en Backend

### ⚠️ IMPORTANTE: Protección del Front Desktop

El desarrollo del **Front Desktop está completo** y funcional. Cualquier modificación en el backend debe ser cuidadosamente analizada para evitar romper funcionalidad existente.

### Proceso de Análisis Antes de Modificar Backend

1. **Análisis Previo Obligatorio**:
   - Antes de modificar cualquier método en el backend, analizar cuidadosamente si afectará al front desktop
   - Verificar si el método es utilizado por el front desktop
   - Revisar llamadas GraphQL, servicios y endpoints relacionados

2. **Estrategia de Modificación**:
   
   **Caso 1: El método ES utilizado por Desktop**
   - ✅ **Solución**: Crear métodos dedicados separados para cada front
   - Ejemplo: `metodoOriginal()` → mantener para desktop
   - Ejemplo: `metodoOriginalMobile()` → nuevo método para mobile
   - Esto garantiza que desktop siga funcionando sin cambios

   **Caso 2: El método NO es utilizado por Desktop**
   - ✅ **Solución**: Se puede modificar directamente sin problema
   - No hay riesgo de afectar funcionalidad existente

3. **Documentación Obligatoria en Métodos**:
   - **REQUERIDO**: En cada método del backend, añadir comentarios que incluyan información sobre su utilización
   - Formato sugerido:
     ```java
     /**
      * Descripción del método
      * 
      * Usado en:
      * - Desktop: Sí/No (descripción breve si aplica)
      * - Mobile: Sí/No (descripción breve si aplica)
      */
     ```
   - Ejemplo:
     ```java
     /**
      * Obtiene lista de pedidos paginados
      * 
      * Usado en:
      * - Desktop: Sí (módulo de compras, lista principal)
      * - Mobile: No
      */
     public Page<Pedido> getPedidosPaginated(...) { ... }
     ```

### Checklist Antes de Modificar Backend

- [ ] Verificar si el método/endpoint es usado por front desktop
- [ ] Si es usado: crear método separado para mobile
- [ ] Si no es usado: proceder con la modificación
- [ ] Agregar comentarios de uso (Desktop/Mobile) en el método
- [ ] Probar que desktop sigue funcionando (si aplica)
- [ ] Probar que mobile funciona correctamente

### Ejemplos de Implementación

#### Ejemplo 1: Método usado en Desktop - Crear versión Mobile
```java
// Método original - mantener para desktop
/**
 * Obtiene recepción de mercadería por ID
 * 
 * Usado en:
 * - Desktop: Sí (pantalla de recepción de mercaderías)
 * - Mobile: No
 */
public RecepcionMercaderia getRecepcionMercaderia(Long id) {
    // Implementación original
}

// Nuevo método para mobile
/**
 * Obtiene recepción de mercadería por ID (versión mobile)
 * Incluye datos adicionales optimizados para mobile
 * 
 * Usado en:
 * - Desktop: No
 * - Mobile: Sí (pantalla de recepción mobile)
 */
public RecepcionMercaderiaMobileDTO getRecepcionMercaderiaMobile(Long id) {
    // Implementación optimizada para mobile
}
```

#### Ejemplo 2: Método no usado en Desktop - Modificar directamente
```java
/**
 * Guarda recepción de mercadería item
 * 
 * Usado en:
 * - Desktop: No
 * - Mobile: Sí (formulario de recepción mobile)
 */
public RecepcionMercaderiaItem saveRecepcionMercaderiaItem(...) {
    // Se puede modificar directamente
}
```

---

**Última actualización**: 2025-01-29
**Creado para**: Desarrollo de módulo de compras/recepción de mercaderías en mobile
