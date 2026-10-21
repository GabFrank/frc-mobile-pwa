# Compras: la factura del proveedor desde el celular

**Ruta:** `/operaciones/compras` · **Rol:** los mismos del menú «Compras» del
desktop (`PERMISOS.compras`), que el central vuelve a exigir.
**Central:** `compras-mobile.graphqls` + `ComprasMobileService` (rama
`feat/compras-mobile-kude`, migración `V253.3`). **No es** la recepción de
mercadería: esto es la etapa anterior, la **Recepción documental**
(`RECEPCION_NOTA`) de Gestión de compras.

## Qué hace

El comprador tiene el pedido planificado y la factura electrónica del
proveedor en la mano:

1. Abre el pedido (o escanea directo: el CDC dice de qué proveedor es).
2. Escanea el **QR del KuDE** —o escribe los 44 dígitos del CDC—.
3. El central consulta la factura en SIFEN (`siConsDE`, código `0422`) y la
   guarda: un CDC se consulta una sola vez.
4. El central cruza cada renglón con el pedido y devuelve:
   - 🟢 **coincide**;
   - 🟡 **diferencia** (cantidad, precio, presentación o bonificación) o
     **no estaba en el pedido** → pide observación, como el desktop;
   - 🔴 **producto no reconocido** → vincular con uno nuestro (con
     sugerencias por código parecido y descripción parecida) o darlo de alta.
5. **Confirmar** crea la nota de recepción con sus ítems y el reparto por
   sucursal, en una sola transacción.
6. **Finalizar** cierra la etapa y el pedido pasa a recepción de mercadería.

## Reglas que conviene saber

- **Precios con IVA incluido**, como los cargan hoy los compradores en el
  desktop (verificado contra las notas anteriores de MARVI) y como los trae la
  factura. Si el precio de la factura es justo el del pedido más el 5 o el
  10 %, el central avisa que el pedido parece cargado sin IVA. También avisa si
  el producto tiene en el sistema un IVA distinto al de la factura.
- **Unidades base.** Cantidad de la nota = cantidad facturada × factor;
  precio = precio facturado ÷ factor. El factor sale de la presentación del
  código de barras o del vínculo aprendido.
- **Lo aprendido.** Un vínculo a mano con «Recordar» queda en
  `productos.proveedor_codigo_producto` (proveedor + código del proveedor →
  presentación + factor). Al confirmar, el central también aprende los que
  reconoció por código de barras.
- **Bloquea:** factura de otro proveedor, a nombre de otro RUC, ya cargada,
  cancelada en SIFEN, en una moneda que no existe, o el mismo número ya
  cargado en ese pedido.
- **El reparto por sucursal** sigue al del ítem del pedido y suma justo la
  cantidad de la factura (enteros si la cantidad es entera). Un producto fuera
  del pedido se reparte solo si el pedido entrega en una sola sucursal; si no,
  queda sin distribuir y la pantalla avisa que se termina en el desktop.

## Qué queda en el desktop

Dividir un ítem entre notas, rechazar ítems, editar a mano el reparto por
sucursal y la nota de un proveedor **sin factura electrónica**.

## Archivos

| Qué | Dónde |
|---|---|
| Pantallas | `pages/operaciones/compras/*.page.ts` |
| Vincular un renglón | `vincular-renglon-dialog.component.ts` |
| Escanear (lista, pedido y botón universal) | `escanear-factura.service.ts` |
| Reglas de presentación + spec | `compras-reglas.ts` |
| Operaciones | `graphql/operaciones/compras/` |
| Tipos | `domains/compras/compras.model.ts` |

El botón universal reconoce un KuDE (`esKude`) antes de mandar el código al
buscador de productos: `escaneo-ruteo.ts`.
