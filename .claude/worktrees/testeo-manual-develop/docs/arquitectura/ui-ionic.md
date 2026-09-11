# Convenciones de UI

> ⚠️ **Documento histórico.** Describe `frc-mobile` (Ionic + Capacitor), no este repo. Se conserva porque explica reglas de negocio y decisiones que se heredaron. Para la implementación actual, ver [`../design-system.md`](../design-system.md) y [`capa-de-datos.md`](capa-de-datos.md).

**Ionic exclusivamente.** No hay Angular Material en este repo — a diferencia del `desktop`, que sí lo usa. No importes componentes de Material aunque encuentres patrones parecidos en el repo hermano.

## Servicios de UI, no controllers directos

Toda interacción con el usuario pasa por un servicio propio que envuelve el controller de Ionic:

| Necesidad | Usar | No usar directo |
|---|---|---|
| Aviso breve | `NotificacionService` | `ToastController` |
| Spinner de carga | `CargandoService` | `LoadingController` |
| Confirmación / alerta | `DialogoService` | `AlertController` |
| Modal | `ModalService` | `ModalController` |
| Popover | `PopOverService` | `PopoverController` |
| Menú de acciones | `MenuActionService` | `ActionSheetController` |

API completa en [`../infraestructura/services.md`](../infraestructura/services.md).

> **Por qué importa:** los wrappers aplican tamaños, clases CSS y duraciones consistentes. Llamar al controller directo produce un modal que se ve distinto al resto de la app.

## Colores

### Paleta de Ionic

`src/theme/variables.scss` define los colores estándar. `--ion-color-primary` es `#3880ff`, **el azul por defecto de Ionic — no un color de marca**.

Uso real de `color=` en templates:

| Color | Usos | Semántica |
|---|---|---|
| `success` | 24 | Confirmar, guardar |
| `primary` | 22 | Acción principal |
| `danger` | 16 | Eliminar, revertir, error |
| `medium` | 8 | Secundario / deshabilitado |
| `warning` | 4 | Advertencia |

> ⚠️ **Gotcha — la app no usa el azul primary como color de marca.** El color de marca es el rojo `#b40000` del splash (`capacitor.config.ts`). Las toolbars van sin `color` y los botones se pintan por semántica (`success` / `warning` / `danger`), no por identidad visual.

### Clases propias

Existen `btn-success`, `btn-warn` y `btn-danger` — **98 usos** en templates y estilos. Conviven con el atributo `color=` de Ionic.

> ⚠️ **Gotcha — hay dos sistemas de color de botón conviviendo.** `color="success"` (Ionic) y `class="btn-success"` (propio). Antes de agregar un botón, mirá qué usa la pantalla donde estás y seguí eso.

### Colores hardcodeados

Hay hex literales en los `.scss`, con `#f44336` (rojo Material) apareciendo **50 veces** y `#43a047` / `#4caf50` (verdes Material) 21 veces entre ambos.

> ⚠️ **No son los colores del tema.** Son valores de la paleta de Material Design escritos a mano, que no responden a `variables.scss`. Cambiar el tema no los afecta. Para código nuevo usá las variables CSS de Ionic. Anotado en [`../TODO_TECNICO.md`](../TODO_TECNICO.md).

## Ciclo de vida — Ionic vs Angular

**Es la fuente de bugs más común en pantallas de este repo.**

| Hook | Cuándo corre |
|---|---|
| `ngOnInit` | **Una sola vez**, al crear el componente |
| `ionViewWillEnter` | **Cada vez** que la vista se muestra |
| `ionViewWillLeave` | Cada vez que se oculta |
| `ngOnDestroy` | Al destruir el componente |

Con `IonicRouteStrategy` (`app.module.ts:138`), Ionic **mantiene las vistas en un stack**: volver atrás no recrea el componente, así que `ngOnInit` no vuelve a correr.

> **Regla — datos que deben refrescarse al volver van en `ionViewWillEnter`, no en `ngOnInit`.** Ejemplos en el repo: `RecepcionNotasComponent` limpia su estado ahí para que volver desde "Nueva Recepción" no arrastre notas viejas; `HomeComponent` recarga el crédito por convenio.

## Suscripciones

El repo usa `@ngneat/until-destroy`:

```ts
@UntilDestroy()
@Component({...})
export class MiComponent {
  ngOnInit() {
    this.servicio.datos$.pipe(untilDestroyed(this)).subscribe(...);
  }
}
```

> **Regla — usá `untilDestroyed` siempre.** Los observables de `GenericCrudService` **nunca completan** (ver [`apollo-graphql.md`](apollo-graphql.md)): sin `untilDestroyed`, cada suscripción queda viva para siempre. Es especialmente grave con `HoraServidorService.horaActual$`, que emite una vez por segundo.

`@UntilDestroy({ checkProperties: true })` (usado en `GenericCrudService`) limpia además las suscripciones guardadas en propiedades.

## Estructura típica de página

```html
<ion-header>
  <ion-toolbar>
    <ion-buttons slot="start"><ion-back-button></ion-back-button></ion-buttons>
    <ion-title>Título</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content>
  <!-- contenido -->
</ion-content>
```

Toolbars **sin atributo `color`**.

> **Navegación hacia atrás:** preferí `Location.back()` sobre `router.navigate([...])` cuando el objetivo es volver, para no apilar entradas en el historial. Varios flujos del repo terminan con "volver sin stack" precisamente por esto (ej. `feat(devolucion): fab en historiales y volver sin stack al terminar`).

## Formularios

Reactive Forms (`ReactiveFormsModule`), con `UntypedFormControl` / `FormGroup` — el repo no migró a los tipados de Angular 14+.

- **Montos:** `ngx-currency` con `CurrencyMask` de `numbersUtils`. Los inputs devuelven string con separadores `es-PY`; convertí con `stringToDecimal` / `stringToCantidad`, no con `parseFloat`.
- **Precisión por moneda:** el guaraní no lleva decimales. Ver `monto-moneda.util.ts` en [`../modulos/operaciones-solicitud-gastos.md`](../modulos/operaciones-solicitud-gastos.md).
- **Validadores propios:** `CustomValidatorsService`.

## Componentes reutilizables

Antes de escribir un selector, buscador o paginador, mirá [`../infraestructura/components-dialogos.md`](../infraestructura/components-dialogos.md):

- `app-selector-generico` — selects
- `app-buscador-modal` — elegir una entidad (modo local o paginado con scroll infinito)
- `app-paginacion` — paginación sobre `PageInfo`
- `app-seccion-accordion` — secciones colapsables

Importá `ComponentsModule` en el módulo de tu página.

## PDFs

Todos los PDFs (recibos, remitos, constancias, etiquetas) llegan del backend en **base64** y se abren con `PdfViewerService.openPdfFromBase64(base64, nombreArchivo)`.

> ⚠️ **Quitá el prefijo `data:application/pdf;base64,` antes de pasarlo.** El servicio espera el contenido crudo.

## Escaneo

`BarcodeScannerService` es el único camino. **No uses `Platform.is('capacitor')`** para detectar plataforma nativa: devuelve `false` en esta app. Usá `Capacitor.isNativePlatform()`. Ver [`../infraestructura/services.md`](../infraestructura/services.md).

Al abrir la cámara, avisá a `ServerConnectionService.setNativeScannerActive(true/false)` o el usuario ve un falso "servidor offline".

## Iconos

Ionicons vía `<ion-icon name="...">`, y **Material Symbols** en las quick actions del home (`icon: 'barcode_scanner'`, `'inventory_2'`). Dos sets conviviendo: fijate cuál usa la pantalla.
