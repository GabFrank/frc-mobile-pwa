# Alta de solicitud de caja chica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un funcionario pueda crear una solicitud de caja chica desde el teléfono, con su tipo de gasto, activo imputado, beneficiario y detalle financiero multi-moneda.

**Architecture:** Página standalone y zoneless con signals, siguiendo el patrón de `solicitud-pago-nueva.page.ts`. Toda la lógica de decisión —qué activo pide cada tipo de gasto, qué falta para poder guardar, cómo se lee el resumen financiero del activo— vive en funciones puras con tests en `src/app/pruebas/`. El acceso a datos pasa por `GastosService` sobre `DatosService`. No se toca el backend.

**Tech Stack:** Angular 21 standalone/zoneless · Material 21 · Apollo Client 4 con el shim `src/app/core/graphql/gql-base` · vitest · Node 20.20.2

**Spec:** [`docs/superpowers/specs/2026-09-03-alta-solicitud-caja-chica-design.md`](../specs/2026-09-03-alta-solicitud-caja-chica-design.md)

## Global Constraints

Aplican a **todas** las tareas. Salen de `CLAUDE.md` y del skill del repo.

- **Alias `data:` en toda operación GraphQL.** Sin él el resultado llega `undefined` **sin error ni log**.
- **Cero valores literales fuera de `src/styles/_tokens.scss`** — ni un hex, ni un px de espaciado, ni un radio. Se usa `var(--sp-4)`, `var(--brand-text)`, `var(--radius-md)`.
- **Nunca un token `--mdc-*`.** Material 21 renombró esa familia a `--mat-*` y los viejos fallan en silencio. Hay un test que lo impide.
- **Nunca un backtick dentro de `template:` o `styles:`** de un componente: rompe el literal y el error no señala la causa.
- **Un segmento literal siempre antes que `:id`** en las rutas.
- **`input.required` rompe con parámetros de ruta** (`NG0950`). Va `input<string>()` + `effect`.
- **`Number('')` es `0`, no `NaN`.** Todo id que venga de una URL o de GraphQL necesita el guard completo.
- **«No hay» y «no pude preguntar» son respuestas distintas.** Un cero afirma algo que nadie dijo.
- **El dinero lo calcula el backend.** El cliente formatea y muestra.
- **Idioma:** dominio, comentarios y textos de UI en español; identificadores en inglés; **mensajes de commit convencionales en inglés**.
- **Tipo de commit: solo `feat` o `fix`.** `style`, `chore` y `docs` no versionan — semantic-release los ignora.
- **Los tests van en `src/app/pruebas/`**, no junto al archivo. Es la convención del repo (49 archivos).
- **`npm run build` es el gate real.** `tsc --noEmit` no typechequea plantillas.
- **`npm run build` y `npm test` matan cualquier `npm start` en curso** (SIGTERM, salida 143): comparten `.angular/cache`.
- **Nunca `git push` ni `gh pr create`** sin que el usuario haya probado la app y aprobado explícitamente.

---

## File Structure

**Se crean:**

| Archivo | Responsabilidad |
|---|---|
| `src/app/domains/gastos/ente.model.ts` | `Ente`, `TipoEnte`, los cuatro activos y `ActivoBusqueda` |
| `src/app/domains/gastos/ente-financiero.reglas.ts` | Vista del resumen financiero del activo. Puro |
| `src/app/graphql/operaciones/gastos/tipoGastos.ts` | Query del catálogo de tipos de gasto |
| `src/app/graphql/operaciones/gastos/savePreGasto.ts` | Mutation del alta |
| `src/app/graphql/operaciones/gastos/enteByReferenciaId.ts` | Query de resolución de ente |
| `src/app/graphql/operaciones/gastos/saveEnte.ts` | Mutation de alta de ente |
| `src/app/graphql/operaciones/gastos/enteFinancialSummary.ts` | Query del campo `getEnteFinancialSummary` |
| `src/app/graphql/operaciones/gastos/activosSearchPage.ts` | Las cuatro queries de activo, en un archivo |
| `src/app/graphql/personas/persona/personaSearchPage.ts` | Query paginada de personas |
| `src/app/graphql/personas/persona/graphql-query.ts` | Su documento |
| `src/app/pages/operaciones/gastos/gastos-solicitud.reglas.ts` | Qué falta para poder guardar. Puro |
| `src/app/pages/operaciones/gastos/gastos-solicitud-nueva.page.ts` | La pantalla |
| `src/app/pruebas/buscador-paginado.spec.ts` | El modo paginado del buscador |
| `src/app/pruebas/gastos-solicitud-reglas.spec.ts` | Las reglas de validación |
| `src/app/pruebas/ente-financiero-reglas.spec.ts` | El resumen y el autocompletado |
| `src/app/pruebas/gastos-solicitud-nueva.spec.ts` | La pantalla |

**Se modifican:**

| Archivo | Cambio |
|---|---|
| `src/app/shared/buscador/buscador.component.ts` | Estado de error propio en modo paginado |
| `src/app/domains/gastos/pre-gasto.model.ts` | `tipoNaturaleza`, `esPagoCuotaActivo`, `PreGastoInput` |
| `src/app/graphql/operaciones/gastos/graphql-query.ts` | Los documentos nuevos |
| `src/app/pages/operaciones/gastos/gastos.service.ts` | Catálogo, buscadores, ente, resumen y alta |
| `src/app/pages/operaciones/gastos/gastos.routes.ts` | Ruta `nueva`, antes de `:id/:sucursalId` |
| `src/app/pages/operaciones/gastos/gastos-lista.page.ts` | Botón de alta |
| `docs/PLAN_TESTEO_MANUAL.md` | Bloque 52 y tabla de totales |
| `docs/modulos/operaciones-solicitud-gastos.md` | Estado del módulo y las correcciones halladas |
| `CLAUDE.md` | Sale de «Pendiente», entra en «Estado» |

---

### Task 1: El buscador paginado distingue «no hay» de «no pude preguntar»

Esta pantalla es el **primer consumidor real** de `frc-buscador` en modo `paginado`: hoy la única llamada viva está en `design-system/galeria.page.ts`, en modo `local`, y el componente no tiene tests. Su `.catch()` presenta un fallo de red como «Sin resultados», que es exactamente lo que la regla del repo prohíbe. Se arregla antes de apoyar cinco buscadores encima.

**Files:**
- Modify: `src/app/shared/buscador/buscador.component.ts`
- Test: `src/app/pruebas/buscador-paginado.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ConfigBuscadorPaginado<T>` con `cargarPagina: (texto: string, pagina: number) => Promise<{ items: T[]; hayMas: boolean }>`, sin cambios en la firma. El componente pasa a exponer `readonly error = signal(false)`.

- [ ] **Step 1: Write the failing test**

Crear `src/app/pruebas/buscador-paginado.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BuscadorComponent,
  ConfigBuscadorPaginado,
} from '../shared/buscador/buscador.component';

interface Fila {
  id: number;
  nombre: string;
}

function montar(config: ConfigBuscadorPaginado<Fila>) {
  TestBed.configureTestingModule({
    imports: [BuscadorComponent, NoopAnimationsModule],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: config },
      { provide: MatDialogRef, useValue: { close: vi.fn() } },
    ],
  });
  return TestBed.createComponent(BuscadorComponent<Fila>);
}

const base = (
  cargarPagina: ConfigBuscadorPaginado<Fila>['cargarPagina'],
): ConfigBuscadorPaginado<Fila> => ({
  modo: 'paginado',
  titulo: 'Buscar',
  cargarPagina,
  texto: (f) => f.nombre,
  id: (f) => f.id,
});

const texto = (fixture: ReturnType<typeof montar>) =>
  (fixture.nativeElement as HTMLElement).textContent ?? '';

describe('Buscador en modo paginado', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('muestra los resultados de la primera página', async () => {
    const fixture = montar(
      base(async () => ({ items: [{ id: 1, nombre: 'MANDIOCA' }], hayMas: false })),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('MANDIOCA');
  });

  it('dice que no pudo consultar cuando la carga falla, y NO «Sin resultados»', async () => {
    const fixture = montar(base(async () => Promise.reject(new Error('red caída'))));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Un fallo de red presentado como «Sin resultados» le dice al operador que
    // el proveedor no existe. Cargaría el gasto contra otro.
    expect(texto(fixture)).toContain('No se pudo consultar');
    expect(texto(fixture)).not.toContain('Sin resultados');
    expect(fixture.componentInstance.error()).toBe(true);
  });

  it('sale del estado de error cuando la consulta vuelve a funcionar', async () => {
    let fallar = true;
    const fixture = montar(
      base(async () => {
        if (fallar) {
          throw new Error('red caída');
        }
        return { items: [{ id: 7, nombre: 'COSTILLA' }], hayMas: false };
      }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe(true);

    fallar = false;
    fixture.componentInstance.reintentar();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.error()).toBe(false);
    expect(texto(fixture)).toContain('COSTILLA');
  });

  it('acumula la página siguiente en vez de reemplazarla', async () => {
    const paginas: Record<number, Fila[]> = {
      0: [{ id: 1, nombre: 'UNO' }],
      1: [{ id: 2, nombre: 'DOS' }],
    };
    const fixture = montar(
      base(async (_t, pagina) => ({ items: paginas[pagina] ?? [], hayMas: pagina === 0 })),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.cargarMas();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(texto(fixture)).toContain('UNO');
    expect(texto(fixture)).toContain('DOS');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/buscador-paginado.spec.ts`
Expected: FAIL. El segundo caso falla porque el componente hoy renderiza «Sin resultados» ante un error, y `error` / `reintentar` no existen.

- [ ] **Step 3: Write minimal implementation**

En `src/app/shared/buscador/buscador.component.ts`, agregar el signal y el reintento, y cambiar el `.catch()`:

```ts
  readonly error = signal(false);
```

```ts
  reintentar(): void {
    this.buscar();
  }
```

```ts
  private cargarPagina(pagina: number, reemplazar: boolean): void {
    if (this.config.modo !== 'paginado') {
      return;
    }
    this.cargando.set(reemplazar);
    this.error.set(false);
    this.config
      .cargarPagina(this.consulta(), pagina)
      .then(({ items, hayMas }) => {
        this.pagina = pagina;
        this.resultados.update((previos) => (reemplazar ? items : [...previos, ...items]));
        this.hayMas.set(hayMas);
      })
      .catch(() => {
        // ⚠️ Un fallo NO es una lista vacía. Vaciar los resultados acá haría
        // que el diálogo dijera «Sin resultados», o sea que el dato no
        // existe — cuando lo único cierto es que no se pudo preguntar.
        this.error.set(true);
        this.hayMas.set(false);
      })
      .finally(() => this.cargando.set(false));
  }
```

Y en el template, entre el bloque de `cargando()` y el de lista vacía:

```html
      @if (cargando()) {
        <frc-skeleton [cantidad]="4" />
      } @else if (error()) {
        <frc-estado-error
          titulo="No se pudo consultar"
          detalle="Revisá la conexión y probá de nuevo."
          (reintentar)="reintentar()"
        />
      } @else if (resultados().length === 0) {
```

Agregar `EstadoErrorComponent` al `imports` del componente y su import desde `../estados-ui/estado-error.component`.

- [ ] **Step 4: Verify the error component's API before wiring it**

Run: `sed -n 1,60p src/app/shared/estados-ui/estado-error.component.ts`
Ajustar los nombres de `input`/`output` del paso 3 a los que el componente realmente expone. **No inventar la firma**: si el output no se llama `reintentar`, se usa el que haya.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/pruebas/buscador-paginado.spec.ts`
Expected: PASS, los cuatro casos.

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/buscador/buscador.component.ts src/app/pruebas/buscador-paginado.spec.ts
git commit -m "fix(buscador): stop showing a failed query as 'no results'

The paginated mode emptied the list on error, so a network failure read
as 'Sin resultados' — the searcher claiming the supplier does not exist
when it merely could not ask. It now has its own error state with a
retry, and the first tests the component has ever had.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 2: Modelos de ente, input del alta y el campo de naturaleza que nunca llegaba

**Files:**
- Create: `src/app/domains/gastos/ente.model.ts`
- Modify: `src/app/domains/gastos/pre-gasto.model.ts`
- Test: `src/app/pruebas/tipo-gasto-reglas.spec.ts` (se le agrega un caso)

**Interfaces:**
- Consumes: `TipoEnte` y `ModuloPadreGasto` de `src/app/domains/gastos/tipo-gasto.reglas.ts`.
- Produces:
  - `BeneficiarioTipo = 'PERSONA' | 'PROVEEDOR'`, `DetalleFinanciero { monto, monedaId, formaPago }` y `MonedaResumen { id, denominacion?, simbolo? }` — **en `domains/`**, para que las reglas del resumen no tengan que importar desde `pages/`
  - `Ente { id?: number; tipoEnte?: TipoEnte; referenciaId?: number; descripcion?: string; activo?: boolean }`
  - `Vehiculo`, `Mueble`, `Inmueble`, `Equipo`, y `ActivoBusqueda = Vehiculo | Mueble | Inmueble | Equipo`
  - `TipoGasto` con `tipoNaturaleza?: string` y `esPagoCuotaActivo?: boolean`
  - `PreGastoInput`, `PreGastoDetalleFinanzasInput`

- [ ] **Step 1: Write the failing test**

Agregar al final de `src/app/pruebas/tipo-gasto-reglas.spec.ts`, dentro del `describe` principal:

```ts
  describe('el campo de naturaleza que manda el central', () => {
    it('lee la naturaleza de `tipoNaturaleza`, que es como se llama en el central', () => {
      // El central expone `tipoNaturaleza`, no `naturaleza`. El modelo tenía
      // el nombre corto, así que la naturaleza llegaba siempre `undefined` y
      // la tarjeta de cuotas no aparecía nunca para un gasto recurrente.
      const tipo: TipoGasto = {
        id: 1,
        descripcion: 'ALQUILER',
        moduloPadre: 'INMUEBLE',
        tipoNaturaleza: 'RECURRENTE',
      };

      expect(mostrarCuotasActivo(tipo.moduloPadre, tipo.tipoNaturaleza, null)).toBe(true);
    });

    it('un esPagoCuotaActivo explícito manda sobre la naturaleza', () => {
      const tipo: TipoGasto = {
        id: 2,
        descripcion: 'REPARACIÓN',
        moduloPadre: 'VEHICULO',
        tipoNaturaleza: 'RECURRENTE',
        esPagoCuotaActivo: false,
      };

      expect(
        mostrarCuotasActivo(tipo.moduloPadre, tipo.tipoNaturaleza, tipo.esPagoCuotaActivo),
      ).toBe(false);
    });
  });
```

Agregar el import al encabezado del archivo:

```ts
import { TipoGasto } from '../domains/gastos/pre-gasto.model';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/tipo-gasto-reglas.spec.ts`
Expected: FAIL de tipos — `TipoGasto` no tiene `tipoNaturaleza` ni `esPagoCuotaActivo`; hoy declara `naturaleza`.

- [ ] **Step 3: Write minimal implementation**

En `src/app/domains/gastos/pre-gasto.model.ts`, reemplazar la interfaz `TipoGasto`:

```ts
export interface TipoGasto {
  id?: number;
  descripcion?: string;
  activo?: boolean;
  autorizacion?: boolean;
  /** Decide qué activo hace falta. Ver `tipo-gasto.reglas.ts`. */
  moduloPadre?: string;
  /**
   * ⚠️ Se llama `tipoNaturaleza`, no `naturaleza`. Es el nombre del campo en
   * el central (`financiero/tipo_gasto.graphqls`). Con el nombre corto la
   * naturaleza llegaba `undefined` y `mostrarCuotasActivo` devolvía `false`
   * para todo gasto recurrente, sin que nada fallara.
   */
  tipoNaturaleza?: string;
  esPagoCuotaActivo?: boolean;
}
```

Y agregar al final del mismo archivo:

```ts
export type BeneficiarioTipo = 'PERSONA' | 'PROVEEDOR';

/**
 * Una fila del detalle financiero **como la maneja el formulario**, con los
 * campos todavía sin completar. `PreGastoDetalleFinanzasInput` es la versión
 * ya validada que viaja al central.
 */
export interface DetalleFinanciero {
  monto: number | null;
  monedaId: number | null;
  formaPago: string | null;
}

/** Lo que se necesita de una moneda para formatear un importe. */
export interface MonedaResumen {
  id: number;
  denominacion?: string;
  simbolo?: string;
}

/** Una fila del detalle financiero. Una moneda por fila, sin repetir. */
export interface PreGastoDetalleFinanzasInput {
  monedaId: number;
  formaPago: string;
  monto: number;
}

/**
 * Lo que recibe `savePreGasto`.
 *
 * ⚠️ Viaja bajo el argumento `entity:`, que es lo que manda `DatosService.guardar`.
 * `saveEnte`, en el mismo flujo, lo recibe bajo `ente:`.
 */
export interface PreGastoInput {
  id?: number;
  sucursalId: number;
  sucursalCajaId?: number;
  funcionarioId?: number;
  tipoGastoId?: number;
  descripcion?: string;
  usuarioId?: number;
  nivelUrgencia?: string;
  beneficiarioProveedorId?: number;
  beneficiarioPersonaId?: number;
  fechaVencimiento?: string;
  enteId?: number;
  finanzas: PreGastoDetalleFinanzasInput[];
}
```

> No se declara `cajaId`. En `frc-mobile` sale de `localStorage.getItem('cajaId')`, una clave que **nadie escribe** en todo el repo: viaja siempre `undefined`.

Crear `src/app/domains/gastos/ente.model.ts`:

```ts
import { TipoEnte } from './tipo-gasto.reglas';

/**
 * El activo al que se imputa un gasto, en el catálogo financiero.
 *
 * No es lo mismo que el activo en sí: el `Ente` es la ficha que lo vincula a
 * las finanzas, y se crea al vuelo la primera vez que alguien le imputa algo.
 */
export interface Ente {
  id?: number;
  tipoEnte?: TipoEnte;
  referenciaId?: number;
  descripcion?: string;
  activo?: boolean;
}

export interface Vehiculo {
  id: number;
  chapa?: string;
  modelo?: { descripcion?: string; marca?: { descripcion?: string } };
}

export interface Mueble {
  id: number;
  descripcion?: string;
}

export interface Inmueble {
  id: number;
  nombreAsignado?: string;
}

export interface Equipo {
  id: number;
  identificador?: string;
  descripcion?: string;
  modelo?: { descripcion?: string; marca?: { descripcion?: string } };
}

export type ActivoBusqueda = Vehiculo | Mueble | Inmueble | Equipo;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/pruebas/tipo-gasto-reglas.spec.ts`
Expected: PASS.

Run: `grep -rn "\.naturaleza" src/app --include=*.ts`
Expected: sin resultados. Si aparece alguno, se corrige a `tipoNaturaleza`.

- [ ] **Step 5: Commit**

```bash
git add src/app/domains/gastos/ src/app/pruebas/tipo-gasto-reglas.spec.ts
git commit -m "fix(gastos): read the expense nature from the field the central sends

The TipoGasto model declared 'naturaleza'; the central sends
'tipoNaturaleza'. Nothing consumed it yet, so nothing failed — but
mostrarCuotasActivo would have returned false for every recurring
expense, silently hiding the instalment card. Adds the Ente models and
the PreGastoInput the new form needs, minus the dead cajaId field.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 3: Las diez operaciones GraphQL

**Files:**
- Modify: `src/app/graphql/operaciones/gastos/graphql-query.ts`
- Create: `src/app/graphql/operaciones/gastos/tipoGastos.ts`, `savePreGasto.ts`, `enteByReferenciaId.ts`, `saveEnte.ts`, `enteFinancialSummary.ts`, `activosSearchPage.ts`
- Create: `src/app/graphql/personas/persona/graphql-query.ts`, `personaSearchPage.ts`

**Interfaces:**
- Consumes: `Query` / `Mutation` de `src/app/core/graphql/gql-base`; `PageInfo<T>` de `src/app/domains/page-info.model`; los modelos de la Task 2.
- Produces, todas `@Injectable({ providedIn: 'root' })`:
  `TipoGastosGQL` · `SavePreGastoGQL` · `EnteByReferenciaIdGQL` · `SaveEnteGQL` · `EnteFinancialSummaryGQL` · `VehiculoSearchPageGQL` · `MuebleSearchPageGQL` · `InmuebleSearchPageGQL` · `EquipoSearchPageGQL` · `PersonaSearchPageGQL`.
  Y el tipo `ResumenFinancieroEnte` exportado desde `enteFinancialSummary.ts`.

- [ ] **Step 1: Verify every field name against the central before writing a line**

```bash
cd /home/franco/dev-frc/backend/franco-system-backend-servidor
sed -n '140,175p' src/main/resources/graphql/financiero/pre_gasto.graphqls
sed -n '75,100p'  src/main/resources/graphql/financiero/tipo_gasto.graphqls
sed -n '90,110p'  src/main/resources/graphql/activos/ente.graphqls
sed -n '85,100p'  src/main/resources/graphql/activos/vehiculo.graphqls
sed -n '60,70p'   src/main/resources/graphql/activos/mueble.graphqls
sed -n '70,85p'   src/main/resources/graphql/activos/inmueble.graphqls
sed -n '90,100p'  src/main/resources/graphql/equipos/equipo.graphqls
sed -n '50,65p'   src/main/resources/graphql/personas/persona.graphqls
```

Anotar la forma exacta de cada `*Page` (si trae `hasNext` y `getContent`) y los campos de `Vehiculo`, `Mueble`, `Inmueble` y `Equipo`. **Pedir un campo que no existe hace fallar la query entera**, no solo ese campo.

- [ ] **Step 2: Write the documents**

Agregar a `src/app/graphql/operaciones/gastos/graphql-query.ts`:

```ts
export const tipoGastosQuery = gql`
  query ($page: Int, $size: Int) {
    data: tipoGastos(page: $page, size: $size) {
      id
      descripcion
      activo
      autorizacion
      moduloPadre
      tipoNaturaleza
      esPagoCuotaActivo
    }
  }
`;

export const savePreGastoMutation = gql`
  mutation ($entity: PreGastoInput!) {
    data: savePreGasto(entity: $entity) {
      id
      sucursalId
    }
  }
`;

export const enteByReferenciaIdQuery = gql`
  query ($tipoEnte: TipoEnte!, $referenciaId: ID!) {
    data: enteByReferenciaId(tipoEnte: $tipoEnte, referenciaId: $referenciaId) {
      id
      tipoEnte
      referenciaId
      descripcion
      activo
    }
  }
`;

export const saveEnteMutation = gql`
  mutation ($ente: EnteInput!) {
    data: saveEnte(ente: $ente) {
      id
      tipoEnte
      referenciaId
      descripcion
      activo
    }
  }
`;

export const enteFinancialSummaryQuery = gql`
  query ($enteId: ID!, $tipoGastoId: ID) {
    data: getEnteFinancialSummary(enteId: $enteId, tipoGastoId: $tipoGastoId) {
      enteId
      descripcion
      montoTotal
      montoYaPagado
      montoPendiente
      cuotasTotales
      cuotasPagadas
      cuotasFaltantes
      diaVencimiento
      diasParaVencer
      estadoCuota
      monedaSimbolo
      monedaId
      proveedorNombre
      proveedorId
      situacionPago
      porcentajePagado
      montoSugerido
      descripcionSugerida
      autocompletarMonto
      numeroCuotaActual
      fechaVencimientoSugerida
    }
  }
`;

export const vehiculoSearchPageQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: vehiculoSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent {
        id
        chapa
        modelo {
          descripcion
          marca { descripcion }
        }
      }
    }
  }
`;

export const muebleSearchPageQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: muebleSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent { id descripcion }
    }
  }
`;

export const inmuebleSearchPageQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: inmuebleSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent { id nombreAsignado }
    }
  }
`;

export const equipoSearchPageQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: equipoSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent {
        id
        identificador
        descripcion
        modelo {
          descripcion
          marca { descripcion }
        }
      }
    }
  }
`;
```

Y crear `src/app/graphql/personas/persona/graphql-query.ts`:

```ts
import { gql } from 'apollo-angular';

/**
 * Búsqueda paginada de personas.
 *
 * Se pide solo lo que el buscador muestra: nombre para la fila y documento
 * para distinguir dos homónimos, que es el caso que hace elegir mal.
 */
export const personaSearchPageQuery = gql`
  query ($texto: String, $page: Int, $size: Int) {
    data: personaSearchPage(texto: $texto, page: $page, size: $size) {
      hasNext
      getContent {
        id
        nombre
        documento
      }
    }
  }
`;
```

- [ ] **Step 3: Write the Query and Mutation classes**

Una por archivo, todas siguiendo el patrón de `proveedoresPorTexto.ts`. Ejemplo completo, y el resto es idéntico cambiando tipo y documento — `src/app/graphql/operaciones/gastos/tipoGastos.ts`:

```ts
import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { TipoGasto } from 'src/app/domains/gastos/pre-gasto.model';
import { tipoGastosQuery } from './graphql-query';

export interface Response {
  data?: TipoGasto[];
}

@Injectable({ providedIn: 'root' })
export class TipoGastosGQL extends Query<Response> {
  document = tipoGastosQuery;
}
```

`src/app/graphql/operaciones/gastos/savePreGasto.ts`:

```ts
import { Injectable } from '@angular/core';
import { Mutation } from 'src/app/core/graphql/gql-base';
import { savePreGastoMutation } from './graphql-query';

/** Lo que devuelve el alta: alcanza para navegar al detalle. */
export interface PreGastoCreado {
  id: number;
  sucursalId?: number;
}

export interface Response {
  data?: PreGastoCreado;
}

@Injectable({ providedIn: 'root' })
export class SavePreGastoGQL extends Mutation<Response> {
  document = savePreGastoMutation;
}
```

`src/app/graphql/operaciones/gastos/enteFinancialSummary.ts`:

```ts
import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { enteFinancialSummaryQuery } from './graphql-query';

/**
 * Lo que el central sabe de la deuda de un activo.
 *
 * ⚠️ El campo se llama `getEnteFinancialSummary`; `EnteFinancialSummary`, sin
 * el `get`, es el tipo de retorno.
 */
export interface ResumenFinancieroEnte {
  enteId?: number;
  descripcion?: string;
  montoTotal?: number;
  montoYaPagado?: number;
  montoPendiente?: number;
  cuotasTotales?: number;
  cuotasPagadas?: number;
  cuotasFaltantes?: number;
  diaVencimiento?: number;
  diasParaVencer?: number;
  estadoCuota?: string;
  monedaSimbolo?: string;
  monedaId?: number;
  proveedorNombre?: string;
  proveedorId?: number;
  situacionPago?: string;
  porcentajePagado?: number;
  montoSugerido?: number;
  descripcionSugerida?: string;
  autocompletarMonto?: boolean;
  numeroCuotaActual?: number;
  fechaVencimientoSugerida?: string;
}

export interface Response {
  data?: ResumenFinancieroEnte;
}

@Injectable({ providedIn: 'root' })
export class EnteFinancialSummaryGQL extends Query<Response> {
  document = enteFinancialSummaryQuery;
}
```

`src/app/graphql/operaciones/gastos/activosSearchPage.ts` — las cuatro juntas, porque cambian juntas:

```ts
import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import type { Equipo, Inmueble, Mueble, Vehiculo } from 'src/app/domains/gastos/ente.model';
import type { PageInfo } from 'src/app/domains/page-info.model';
import {
  equipoSearchPageQuery,
  inmuebleSearchPageQuery,
  muebleSearchPageQuery,
  vehiculoSearchPageQuery,
} from './graphql-query';

@Injectable({ providedIn: 'root' })
export class VehiculoSearchPageGQL extends Query<{ data?: PageInfo<Vehiculo> }> {
  document = vehiculoSearchPageQuery;
}

@Injectable({ providedIn: 'root' })
export class MuebleSearchPageGQL extends Query<{ data?: PageInfo<Mueble> }> {
  document = muebleSearchPageQuery;
}

@Injectable({ providedIn: 'root' })
export class InmuebleSearchPageGQL extends Query<{ data?: PageInfo<Inmueble> }> {
  document = inmuebleSearchPageQuery;
}

@Injectable({ providedIn: 'root' })
export class EquipoSearchPageGQL extends Query<{ data?: PageInfo<Equipo> }> {
  document = equipoSearchPageQuery;
}
```

`enteByReferenciaId.ts` (`Query<{ data?: Ente }>`), `saveEnte.ts` (`Mutation<{ data?: Ente }>`) y `personaSearchPage.ts` (`Query<{ data?: PageInfo<Persona> }>`, importando `Persona` de `src/app/domains/personas/persona.model`) siguen el mismo molde.

- [ ] **Step 4: Verify the alias is on every operation**

Run:
```bash
grep -c "data:" src/app/graphql/operaciones/gastos/graphql-query.ts
grep -n "data:" src/app/graphql/personas/persona/graphql-query.ts
```
Expected: una línea `data:` por operación nueva. Sin el alias el resultado llega `undefined` **sin error ni log**, y el síntoma aparece recién en la pantalla.

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: AOT en verde.

- [ ] **Step 6: Commit**

```bash
git add src/app/graphql/
git commit -m "feat(gastos): add the GraphQL operations the request form needs

Ten operations, all already present in the central: the expense-type
catalogue, savePreGasto, the ente lookup and creation, the financial
summary, the four asset searchers and the paginated person search. No
backend change, so no Mobile-suffixed parallel method.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 4: Las reglas de validación

**Files:**
- Create: `src/app/pages/operaciones/gastos/gastos-solicitud.reglas.ts`
- Test: `src/app/pruebas/gastos-solicitud-reglas.spec.ts`

**Interfaces:**
- Consumes: `etiquetaModuloPadre`, `requiereEnteActivo` de `src/app/domains/gastos/tipo-gasto.reglas`; `BeneficiarioTipo`, `DetalleFinanciero` y `MonedaResumen` de `src/app/domains/gastos/pre-gasto.model` (Task 2).
- Produces:
  - `interface DatosSolicitud { sucursalId, responsableId, tipoGastoId, moduloPadre, enteId, beneficiarioTipo, beneficiarioPersonaId, beneficiarioProveedorId, detalles }`
  - `function faltaParaGuardar(datos: DatosSolicitud): string | null`
  - `function totalesPorMoneda(detalles, monedas): { monedaId, denominacion, simbolo, total }[]`

- [ ] **Step 1: Write the failing test**

Crear `src/app/pruebas/gastos-solicitud-reglas.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  DatosSolicitud,
  faltaParaGuardar,
  totalesPorMoneda,
} from '../pages/operaciones/gastos/gastos-solicitud.reglas';

const completo = (): DatosSolicitud => ({
  sucursalId: 1,
  responsableId: 10,
  tipoGastoId: 5,
  moduloPadre: 'PERSONAS',
  enteId: null,
  beneficiarioTipo: 'PROVEEDOR',
  beneficiarioPersonaId: null,
  beneficiarioProveedorId: 33,
  detalles: [{ monto: 50000, monedaId: 1, formaPago: 'EFECTIVO' }],
});

describe('Qué falta para poder pedir la plata', () => {
  it('no falta nada cuando está todo', () => {
    expect(faltaParaGuardar(completo())).toBeNull();
  });

  it('pide la sucursal de retiro', () => {
    expect(faltaParaGuardar({ ...completo(), sucursalId: null })).toBe(
      'Seleccione una sucursal de retiro',
    );
  });

  it('avisa cuando el usuario en sesión no tiene persona', () => {
    // Es un problema de datos, no de pantalla: el retiro se imputa a la
    // persona, no al usuario.
    expect(faltaParaGuardar({ ...completo(), responsableId: null })).toBe(
      'No se encontró la persona del usuario en sesión',
    );
  });

  it('pide el tipo de gasto', () => {
    expect(faltaParaGuardar({ ...completo(), tipoGastoId: null })).toBe(
      'Seleccione un tipo de gasto',
    );
  });

  it('exige el activo cuando el módulo padre lo requiere, con su etiqueta', () => {
    expect(
      faltaParaGuardar({ ...completo(), moduloPadre: 'VEHICULO', enteId: null }),
    ).toBe('Seleccione Vehículo');
  });

  it('un servicio continuo exige un inmueble, y lo dice con su contexto', () => {
    // La luz la consume un local. El módulo padre dice ANDE; el activo es un
    // inmueble.
    expect(faltaParaGuardar({ ...completo(), moduloPadre: 'ANDE', enteId: null })).toBe(
      'Seleccione Inmueble (ANDE)',
    );
  });

  it('no pide activo para PERSONAS ni para OTRO', () => {
    expect(faltaParaGuardar({ ...completo(), moduloPadre: 'OTRO', enteId: null })).toBeNull();
  });

  it('exige la persona cuando el beneficiario es una persona', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        beneficiarioTipo: 'PERSONA',
        beneficiarioPersonaId: null,
      }),
    ).toBe('Seleccione la persona beneficiaria');
  });

  it('exige el proveedor cuando el beneficiario es un proveedor', () => {
    expect(faltaParaGuardar({ ...completo(), beneficiarioProveedorId: null })).toBe(
      'Seleccione el proveedor beneficiario',
    );
  });

  it('rechaza un monto en cero', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [{ monto: 0, monedaId: 1, formaPago: 'EFECTIVO' }],
      }),
    ).toBe('Cargue un monto mayor a cero en el detalle 1');
  });

  it('rechaza un detalle sin forma de pago', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [{ monto: 100, monedaId: 1, formaPago: null }],
      }),
    ).toBe('Complete la moneda y la forma de pago del detalle 1');
  });

  it('NO permite repetir la misma moneda en dos detalles', () => {
    // Es la regla dura del modelo: el detalle financiero es una lista de
    // {monto, moneda, forma de pago} y cada moneda aparece una sola vez.
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [
          { monto: 100, monedaId: 1, formaPago: 'EFECTIVO' },
          { monto: 200, monedaId: 1, formaPago: 'TRANSFERENCIA' },
        ],
      }),
    ).toBe('No repita la misma moneda en más de un detalle');
  });

  it('permite dos detalles en monedas distintas', () => {
    expect(
      faltaParaGuardar({
        ...completo(),
        detalles: [
          { monto: 100, monedaId: 1, formaPago: 'EFECTIVO' },
          { monto: 200, monedaId: 2, formaPago: 'EFECTIVO' },
        ],
      }),
    ).toBeNull();
  });
});

describe('Totales por moneda', () => {
  const monedas = [
    { id: 1, denominacion: 'Guaraní', simbolo: '₲' },
    { id: 2, denominacion: 'Dólar', simbolo: 'US$' },
  ];

  it('agrupa por moneda y conserva la denominación para el formato', () => {
    // La denominación es lo que decide si el importe lleva decimales. El
    // símbolo solo no alcanza.
    const totales = totalesPorMoneda(
      [
        { monto: 100, monedaId: 1, formaPago: 'EFECTIVO' },
        { monto: 50, monedaId: 2, formaPago: 'EFECTIVO' },
      ],
      monedas,
    );

    expect(totales).toEqual([
      { monedaId: 1, denominacion: 'Guaraní', simbolo: '₲', total: 100 },
      { monedaId: 2, denominacion: 'Dólar', simbolo: 'US$', total: 50 },
    ]);
  });

  it('ignora los detalles sin moneda o sin monto', () => {
    expect(
      totalesPorMoneda([{ monto: null, monedaId: 1, formaPago: 'EFECTIVO' }], monedas),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-reglas.spec.ts`
Expected: FAIL — el módulo `gastos-solicitud.reglas` no existe.

- [ ] **Step 3: Write minimal implementation**

Crear `src/app/pages/operaciones/gastos/gastos-solicitud.reglas.ts`:

```ts
import type {
  BeneficiarioTipo,
  DetalleFinanciero,
  MonedaResumen,
} from 'src/app/domains/gastos/pre-gasto.model';
import {
  etiquetaModuloPadre,
  requiereEnteActivo,
} from 'src/app/domains/gastos/tipo-gasto.reglas';

/**
 * Reglas del alta de una solicitud de caja chica, sin Angular en el medio.
 *
 * Viven acá y no en la pantalla para poder probarlas: deciden si se puede
 * pedir la plata y, cuando no, qué le falta al operador.
 */

export interface DatosSolicitud {
  sucursalId: number | null;
  responsableId: number | null;
  tipoGastoId: number | null;
  moduloPadre: string | null;
  enteId: number | null;
  beneficiarioTipo: BeneficiarioTipo;
  beneficiarioPersonaId: number | null;
  beneficiarioProveedorId: number | null;
  detalles: DetalleFinanciero[];
}

/** Lo que falta para poder guardar, o `null` si está todo. */
export function faltaParaGuardar(datos: DatosSolicitud): string | null {
  if (!datos.sucursalId) {
    return 'Seleccione una sucursal de retiro';
  }
  if (!datos.responsableId) {
    // El retiro se imputa a la persona, no al usuario. Sin persona asociada
    // es un problema de datos, no de pantalla.
    return 'No se encontró la persona del usuario en sesión';
  }
  if (!datos.tipoGastoId) {
    return 'Seleccione un tipo de gasto';
  }
  if (requiereEnteActivo(datos.moduloPadre) && !datos.enteId) {
    return `Seleccione ${etiquetaModuloPadre(datos.moduloPadre)}`;
  }
  if (datos.beneficiarioTipo === 'PERSONA' && !datos.beneficiarioPersonaId) {
    return 'Seleccione la persona beneficiaria';
  }
  if (datos.beneficiarioTipo === 'PROVEEDOR' && !datos.beneficiarioProveedorId) {
    return 'Seleccione el proveedor beneficiario';
  }

  for (const [indice, detalle] of datos.detalles.entries()) {
    if (detalle.monedaId == null || !detalle.formaPago) {
      return `Complete la moneda y la forma de pago del detalle ${indice + 1}`;
    }
    if (detalle.monto == null || detalle.monto <= 0) {
      return `Cargue un monto mayor a cero en el detalle ${indice + 1}`;
    }
  }

  // ⚠️ Una moneda por detalle, sin repetir. El modelo del central es una
  // lista de {monto, moneda, forma de pago}: dos filas en la misma moneda no
  // se pueden distinguir después.
  const monedas = datos.detalles.map((d) => d.monedaId);
  if (new Set(monedas).size !== monedas.length) {
    return 'No repita la misma moneda en más de un detalle';
  }

  return null;
}

export interface TotalPorMoneda {
  monedaId: number;
  denominacion: string;
  simbolo: string;
  total: number;
}

/**
 * Cuánto se pide en cada moneda.
 *
 * Devuelve la **denominación**, no solo el símbolo: es el nombre lo que
 * decide si el importe lleva decimales, y el guaraní no lleva.
 */
export function totalesPorMoneda(
  detalles: DetalleFinanciero[],
  monedas: MonedaResumen[],
): TotalPorMoneda[] {
  const porMoneda = new Map<number, number>();

  for (const detalle of detalles) {
    if (detalle.monedaId == null || detalle.monto == null || detalle.monto <= 0) {
      continue;
    }
    porMoneda.set(detalle.monedaId, (porMoneda.get(detalle.monedaId) ?? 0) + detalle.monto);
  }

  return [...porMoneda.entries()].map(([monedaId, total]) => {
    const moneda = monedas.find((m) => m.id === monedaId);
    return {
      monedaId,
      denominacion: moneda?.denominacion ?? '',
      simbolo: moneda?.simbolo ?? '',
      total,
    };
  });
}
```

Nota sobre el orden: el test «rechaza un monto en cero» espera el mensaje de monto, y el de forma de pago espera el suyo. La implementación chequea moneda y forma de pago **antes** que el monto; si algún caso del test no coincide, se ajusta el orden de los `if` —no el test— hasta que los mensajes salgan como el test los pide.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-reglas.spec.ts`
Expected: PASS, los quince casos.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/operaciones/gastos/gastos-solicitud.reglas.ts src/app/pruebas/gastos-solicitud-reglas.spec.ts
git commit -m "feat(gastos): add the validation rules for a petty cash request

Pure functions with a test per branch, including the hard one: one
currency per financial line, never repeated. The central stores the
lines as a list of {amount, currency, payment method}, so two lines in
the same currency cannot be told apart afterwards.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 5: El resumen financiero del activo y el autocompletado

**Files:**
- Create: `src/app/domains/gastos/ente-financiero.reglas.ts`
- Test: `src/app/pruebas/ente-financiero-reglas.spec.ts`

**Interfaces:**
- Consumes: `ResumenFinancieroEnte` de `src/app/graphql/operaciones/gastos/enteFinancialSummary`; `BeneficiarioTipo`, `DetalleFinanciero` y `MonedaResumen` de `src/app/domains/gastos/pre-gasto.model` (Task 2). **No importa nada de `pages/`**: una regla de dominio que dependa de una pantalla invierte las capas.
- Produces:
  - `interface VistaResumenEnte { titulo, descripcion, montoTotal, montoPendiente, montoCuota, denominacion, simbolo, cuotaTexto, cuotasFaltantesTexto, vencimientoTexto, notificacion, mostrarCuotas, proveedorTexto }`
  - `function avisoVencimiento(diasParaVencer?: number | null): string | null`
  - `function construirVistaResumen(resumen, monedas): VistaResumenEnte`
  - `function aplicarAutocompletado(resumen, actual): { fechaVencimiento, detalles, beneficiarioTipo, beneficiarioProveedorId, textoProveedor }`

- [ ] **Step 1: Write the failing test**

Crear `src/app/pruebas/ente-financiero-reglas.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  aplicarAutocompletado,
  avisoVencimiento,
  construirVistaResumen,
} from '../domains/gastos/ente-financiero.reglas';

const monedas = [
  { id: 1, denominacion: 'Guaraní', simbolo: '₲' },
  { id: 2, denominacion: 'Dólar', simbolo: 'US$' },
];

describe('Aviso de vencimiento', () => {
  it('no dice nada cuando el central no informó los días', () => {
    // Silencio, no «vence hoy». Un cero acá afirmaría algo que nadie dijo.
    expect(avisoVencimiento(null)).toBeNull();
    expect(avisoVencimiento(undefined)).toBeNull();
  });

  it('avisa que ya está vencida', () => {
    expect(avisoVencimiento(-3)).toBe('Cuota vencida hace 3 días');
  });

  it('avisa cuando falta poco', () => {
    expect(avisoVencimiento(4)).toBe('Vence en 4 días');
    expect(avisoVencimiento(10)).toBe('Vence en 10 días');
  });

  it('informa sin urgencia cuando falta mucho', () => {
    expect(avisoVencimiento(45)).toBe('Próximo vencimiento en 45 días');
  });
});

describe('Vista del resumen del activo', () => {
  it('conserva la denominación de la moneda, no solo el símbolo', () => {
    // El original redondeaba todo a entero, así que un resumen en dólares
    // perdía los centavos. La denominación es lo que decide la precisión.
    const vista = construirVistaResumen(
      { descripcion: 'CAMIONETA', montoTotal: 1284.5, montoPendiente: 642.25, monedaId: 2 },
      monedas,
    );

    expect(vista.denominacion).toBe('Dólar');
    expect(vista.montoTotal).toBe(1284.5);
    expect(vista.montoPendiente).toBe(642.25);
  });

  it('muestra el plan cuando hay cuotas', () => {
    const vista = construirVistaResumen(
      { cuotasTotales: 12, cuotasPagadas: 3, cuotasFaltantes: 9, monedaId: 1 },
      monedas,
    );

    expect(vista.mostrarCuotas).toBe(true);
    expect(vista.cuotaTexto).toBe('Cuota 4/12');
    expect(vista.cuotasFaltantesTexto).toBe('9 cuotas pendientes');
  });

  it('respeta el número de cuota que informa el central por sobre el calculado', () => {
    const vista = construirVistaResumen(
      { cuotasTotales: 12, cuotasPagadas: 3, numeroCuotaActual: 9, monedaId: 1 },
      monedas,
    );

    expect(vista.cuotaTexto).toBe('Cuota 9/12');
  });

  it('singulariza una sola cuota pendiente', () => {
    const vista = construirVistaResumen(
      { cuotasTotales: 6, cuotasPagadas: 5, cuotasFaltantes: 1, monedaId: 1 },
      monedas,
    );

    expect(vista.cuotasFaltantesTexto).toBe('1 cuota pendiente');
  });

  it('sin cuotas usa el estado que informa el central', () => {
    const vista = construirVistaResumen({ estadoCuota: 'AL DÍA', monedaId: 1 }, monedas);

    expect(vista.mostrarCuotas).toBe(false);
    expect(vista.cuotaTexto).toBe('AL DÍA');
  });

  it('sin día fijo lo dice, en vez de inventar uno', () => {
    expect(construirVistaResumen({ monedaId: 1 }, monedas).vencimientoTexto).toBe(
      'Sin día fijo',
    );
    expect(construirVistaResumen({ diaVencimiento: 10, monedaId: 1 }, monedas).vencimientoTexto)
      .toBe('Día 10 del mes');
  });
});

describe('Autocompletado al elegir un activo', () => {
  const vacio = {
    fechaVencimiento: '',
    detalles: [{ monto: null, monedaId: null, formaPago: 'EFECTIVO' }],
    beneficiarioTipo: 'PROVEEDOR' as const,
    beneficiarioProveedorId: null,
    textoProveedor: '',
  };

  it('completa el primer detalle cuando está vacío', () => {
    const r = aplicarAutocompletado(
      { montoSugerido: 450000, monedaId: 1, autocompletarMonto: true },
      vacio,
    );

    expect(r.detalles[0].monto).toBe(450000);
    expect(r.detalles[0].monedaId).toBe(1);
    expect(r.detalles[0].formaPago).toBe('EFECTIVO');
  });

  it('NO pisa un monto que el operador ya cargó', () => {
    // Es el apartamiento deliberado de frc-mobile: allá, cambiar de activo
    // borraba sin aviso lo que la persona había tipeado.
    const r = aplicarAutocompletado(
      { montoSugerido: 450000, monedaId: 1, autocompletarMonto: true },
      { ...vacio, detalles: [{ monto: 99, monedaId: 2, formaPago: 'EFECTIVO' }] },
    );

    expect(r.detalles[0].monto).toBe(99);
    expect(r.detalles[0].monedaId).toBe(2);
  });

  it('respeta un autocompletarMonto en false', () => {
    const r = aplicarAutocompletado(
      { montoSugerido: 450000, monedaId: 1, autocompletarMonto: false },
      vacio,
    );

    expect(r.detalles[0].monto).toBeNull();
  });

  it('completa el vencimiento solo si estaba vacío', () => {
    expect(
      aplicarAutocompletado({ fechaVencimientoSugerida: '2026-10-05T00:00:00' }, vacio)
        .fechaVencimiento,
    ).toBe('2026-10-05');

    expect(
      aplicarAutocompletado(
        { fechaVencimientoSugerida: '2026-10-05T00:00:00' },
        { ...vacio, fechaVencimiento: '2026-09-30' },
      ).fechaVencimiento,
    ).toBe('2026-09-30');
  });

  it('fuerza el beneficiario al proveedor que informa el central', () => {
    const r = aplicarAutocompletado(
      { proveedorId: 77, proveedorNombre: 'inmobiliaria del este' },
      { ...vacio, beneficiarioTipo: 'PERSONA' },
    );

    expect(r.beneficiarioTipo).toBe('PROVEEDOR');
    expect(r.beneficiarioProveedorId).toBe(77);
    expect(r.textoProveedor).toBe('INMOBILIARIA DEL ESTE');
  });

  it('deja todo como estaba cuando el resumen no sugiere nada', () => {
    expect(aplicarAutocompletado({}, vacio)).toEqual(vacio);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/ente-financiero-reglas.spec.ts`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Write minimal implementation**

Crear `src/app/domains/gastos/ente-financiero.reglas.ts`:

```ts
import type { ResumenFinancieroEnte } from 'src/app/graphql/operaciones/gastos/enteFinancialSummary';
import type {
  BeneficiarioTipo,
  DetalleFinanciero,
  MonedaResumen,
} from './pre-gasto.model';

/**
 * Cómo se lee lo que el central sabe de la deuda de un activo, y qué de eso
 * puede completar el formulario solo.
 *
 * Es lógica pura: acá se decide qué se muestra y qué se autocompleta, pero
 * **los montos no se recalculan** — vienen del backend.
 */

export interface VistaResumenEnte {
  titulo: string;
  descripcion: string;
  montoTotal: number;
  montoPendiente: number;
  montoCuota: number | null;
  /** La denominación decide la precisión: el guaraní no lleva decimales. */
  denominacion: string;
  simbolo: string;
  cuotaTexto: string;
  cuotasFaltantesTexto: string;
  vencimientoTexto: string;
  notificacion: string | null;
  mostrarCuotas: boolean;
  proveedorTexto: string;
}

/** Qué tan cerca está el vencimiento, o `null` si el central no lo informó. */
export function avisoVencimiento(diasParaVencer?: number | null): string | null {
  if (diasParaVencer == null) {
    return null;
  }
  if (diasParaVencer < 0) {
    return `Cuota vencida hace ${Math.abs(diasParaVencer)} días`;
  }
  if (diasParaVencer <= 10) {
    return `Vence en ${diasParaVencer} días`;
  }
  return `Próximo vencimiento en ${diasParaVencer} días`;
}

export function construirVistaResumen(
  resumen: ResumenFinancieroEnte,
  monedas: MonedaResumen[],
): VistaResumenEnte {
  const moneda = monedas.find((m) => m.id === Number(resumen.monedaId));
  const mostrarCuotas = (resumen.cuotasTotales ?? 0) > 0;
  const cuotaActual = resumen.numeroCuotaActual ?? (resumen.cuotasPagadas ?? 0) + 1;
  const faltantes = resumen.cuotasFaltantes ?? 0;

  return {
    titulo: resumen.descripcion || 'Activo vinculado',
    descripcion: resumen.descripcionSugerida || resumen.descripcion || '',
    montoTotal: resumen.montoTotal ?? 0,
    montoPendiente: resumen.montoPendiente ?? 0,
    montoCuota: mostrarCuotas && (resumen.montoSugerido ?? 0) > 0
      ? (resumen.montoSugerido as number)
      : null,
    denominacion: moneda?.denominacion ?? '',
    simbolo: moneda?.simbolo ?? resumen.monedaSimbolo ?? '',
    cuotaTexto: mostrarCuotas
      ? `Cuota ${cuotaActual}/${resumen.cuotasTotales}`
      : resumen.estadoCuota || 'Sin cuotas',
    cuotasFaltantesTexto: mostrarCuotas
      ? `${faltantes} ${faltantes === 1 ? 'cuota pendiente' : 'cuotas pendientes'}`
      : '',
    vencimientoTexto: resumen.diaVencimiento
      ? `Día ${resumen.diaVencimiento} del mes`
      : 'Sin día fijo',
    notificacion: avisoVencimiento(resumen.diasParaVencer),
    mostrarCuotas,
    proveedorTexto: resumen.proveedorNombre || '',
  };
}

export interface EstadoAutocompletable {
  fechaVencimiento: string;
  detalles: DetalleFinanciero[];
  beneficiarioTipo: BeneficiarioTipo;
  beneficiarioProveedorId: number | null;
  textoProveedor: string;
}

/**
 * Lo que el formulario puede completar solo al elegir un activo.
 *
 * ⚠️ **No pisa lo que el operador ya cargó.** `frc-mobile` reemplazaba el
 * primer detalle cada vez que se elegía un activo, así que cambiar de activo
 * borraba el importe tipeado sin ningún aviso.
 */
export function aplicarAutocompletado(
  resumen: ResumenFinancieroEnte,
  actual: EstadoAutocompletable,
): EstadoAutocompletable {
  const fechaSugerida = recortarFecha(resumen.fechaVencimientoSugerida);
  const fechaVencimiento = actual.fechaVencimiento || fechaSugerida || '';

  const detalles = [...actual.detalles];
  const primero = detalles[0];
  const puedeCompletarMonto =
    primero != null &&
    primero.monto == null &&
    resumen.autocompletarMonto !== false &&
    resumen.montoSugerido != null;

  if (puedeCompletarMonto) {
    detalles[0] = {
      ...primero,
      monto: Number(resumen.montoSugerido),
      monedaId: resumen.monedaId != null ? Number(resumen.monedaId) : primero.monedaId,
    };
  }

  if (resumen.proveedorId != null) {
    return {
      fechaVencimiento,
      detalles,
      beneficiarioTipo: 'PROVEEDOR',
      beneficiarioProveedorId: Number(resumen.proveedorId),
      textoProveedor: (resumen.proveedorNombre ?? '').toUpperCase(),
    };
  }

  return {
    fechaVencimiento,
    detalles,
    beneficiarioTipo: actual.beneficiarioTipo,
    beneficiarioProveedorId: actual.beneficiarioProveedorId,
    textoProveedor: actual.textoProveedor,
  };
}

/** `2026-10-05T00:00:00` → `2026-10-05`. */
function recortarFecha(fecha?: string | null): string {
  if (!fecha) {
    return '';
  }
  return fecha.length >= 10 ? fecha.substring(0, 10) : fecha;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/pruebas/ente-financiero-reglas.spec.ts`
Expected: PASS, los dieciséis casos.

- [ ] **Step 5: Commit**

```bash
git add src/app/domains/gastos/ente-financiero.reglas.ts src/app/pruebas/ente-financiero-reglas.spec.ts
git commit -m "feat(gastos): read the asset's financial summary and autofill from it

Two deliberate departures from frc-mobile, both tested: the autofill no
longer overwrites an amount the operator already typed, and the summary
keeps the currency denomination instead of rounding every figure to an
integer, which silently dropped the cents on a dollar-denominated plan.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 6: El servicio

**Files:**
- Modify: `src/app/pages/operaciones/gastos/gastos.service.ts`
- Test: `src/app/pruebas/gastos-solicitud-servicio.spec.ts` (crear)

**Interfaces:**
- Consumes: las clases GQL de la Task 3; `DatosService`; `tipoEnteDesdeModuloPadre` de `tipo-gasto.reglas`.
- Produces, sobre `GastosService`:
  - `tiposDeGasto(): Observable<TipoGasto[]>`, `monedas(): Observable<Moneda[]>`, `formasPago(): Observable<FormaPago[]>` — los tres catálogos de la carga inicial. **Las sucursales no pasan por acá**: la pantalla inyecta `SucursalService` (`domains/empresarial/sucursal/sucursal.service.ts`) directo, como `recepcion-nueva.page.ts`
  - `buscarPersonas(texto: string, pagina: number): Promise<{ items: Persona[]; hayMas: boolean }>` y sus gemelas `buscarProveedores`, `buscarVehiculos`, `buscarMuebles`, `buscarInmuebles`, `buscarEquipos`
  - `resolverEnte(moduloPadre: string, referenciaId: number): Promise<Ente>`
  - `resumenDelEnte(enteId: number, tipoGastoId: number | null): Observable<ResumenFinancieroEnte>`
  - `crearSolicitud(input: PreGastoInput): Observable<PreGastoCreado>`

- [ ] **Step 1: Write the failing test**

El servicio se prueba **doblando `DatosService`**, no montando Apollo: lo que
importa acá es qué variables se mandan y cómo se interpreta la respuesta.

Crear `src/app/pruebas/gastos-solicitud-servicio.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatosService } from '../core/graphql/datos.service';
import { GastosService } from '../pages/operaciones/gastos/gastos.service';

describe('GastosService — alta de solicitud', () => {
  let datos: {
    consultar: ReturnType<typeof vi.fn>;
    mutar: ReturnType<typeof vi.fn>;
    guardar: ReturnType<typeof vi.fn>;
    paginado: ReturnType<typeof vi.fn>;
  };

  const servicio = () => TestBed.inject(GastosService);

  beforeEach(() => {
    datos = {
      consultar: vi.fn(() => of(null)),
      mutar: vi.fn(() => of(null)),
      guardar: vi.fn(() => of({ id: 1 })),
      paginado: vi.fn(() => of([])),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: DatosService, useValue: datos }],
    });
  });

  describe('resolución del ente', () => {
    it('devuelve el ente existente sin crear uno nuevo', async () => {
      // Crear un ente duplicado por cada solicitud ensucia el catálogo
      // financiero, y el activo termina con dos fichas de deuda.
      datos.consultar.mockReturnValue(of({ id: 5, tipoEnte: 'VEHICULO' }));

      const ente = await servicio().resolverEnte('VEHICULO', 88);

      expect(ente.id).toBe(5);
      expect(datos.mutar).not.toHaveBeenCalled();
    });

    it('crea el ente cuando el activo todavía no tiene ficha financiera', async () => {
      datos.consultar.mockReturnValue(of(null));
      datos.mutar.mockReturnValue(of({ id: 9 }));

      const ente = await servicio().resolverEnte('INMUEBLE', 12);

      expect(ente.id).toBe(9);
      // ⚠️ `saveEnte` recibe su argumento como `ente:`, no `entity:`.
      expect(datos.mutar.mock.calls[0][1]).toEqual({
        ente: { tipoEnte: 'INMUEBLE', referenciaId: 12, activo: true },
      });
    });

    it('mapea EQUIPOS a EQUIPO', async () => {
      // El módulo padre es plural y el tipo de ente singular. Comparar
      // directo falla y el ente se crearía con un tipo que el central no
      // reconoce.
      datos.consultar.mockReturnValue(of(null));
      datos.mutar.mockReturnValue(of({ id: 3 }));

      await servicio().resolverEnte('EQUIPOS', 4);

      expect(datos.consultar.mock.calls[0][1]).toMatchObject({ tipoEnte: 'EQUIPO' });
    });

    it('un servicio continuo se imputa a un inmueble', async () => {
      // La luz la consume un local, no la categoría «ANDE».
      datos.consultar.mockReturnValue(of({ id: 2 }));

      await servicio().resolverEnte('ANDE', 30);

      expect(datos.consultar.mock.calls[0][1]).toMatchObject({ tipoEnte: 'INMUEBLE' });
    });

    it('rechaza un módulo que no admite activo', async () => {
      await expect(servicio().resolverEnte('PERSONAS', 1)).rejects.toThrow(
        'El tipo de gasto no admite vinculación a un activo',
      );
    });
  });

  describe('buscadores paginados', () => {
    it('devuelve hayMas según el hasNext del central', async () => {
      datos.consultar.mockReturnValue(
        of({ getContent: [{ id: 1, chapa: 'ABC123' }], hasNext: true }),
      );

      const pagina = await servicio().buscarVehiculos('abc', 0);

      expect(pagina.items).toHaveLength(1);
      expect(pagina.hayMas).toBe(true);
      expect(datos.consultar.mock.calls[0][1]).toMatchObject({ texto: 'abc', page: 0 });
    });

    it('corta cuando no hay más páginas', async () => {
      // Con `hayMas` en true de más, «Cargar más» pide páginas vacías para
      // siempre.
      datos.consultar.mockReturnValue(of({ getContent: [], hasNext: false }));

      expect((await servicio().buscarPersonas('', 3)).hayMas).toBe(false);
    });

    it('una respuesta sin contenido no rompe la lista', async () => {
      datos.consultar.mockReturnValue(of(null));

      expect(await servicio().buscarMuebles('x', 0)).toEqual({ items: [], hayMas: false });
    });
  });

  describe('alta', () => {
    it('manda el input al guardado, sin cajaId', async () => {
      // `cajaId` existe en frc-mobile y viaja siempre undefined: sale de una
      // clave de localStorage que nadie escribe.
      const input = {
        sucursalId: 1,
        finanzas: [{ monedaId: 1, formaPago: 'EFECTIVO', monto: 500 }],
      };

      servicio().crearSolicitud(input).subscribe();

      expect(datos.guardar).toHaveBeenCalled();
      expect(datos.guardar.mock.calls[0][1]).not.toHaveProperty('cajaId');
      expect(datos.guardar.mock.calls[0][1]).toMatchObject(input);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-servicio.spec.ts`
Expected: FAIL — los métodos no existen.

- [ ] **Step 3: Write minimal implementation**

Agregar a `src/app/pages/operaciones/gastos/gastos.service.ts`:

```ts
  private readonly tipoGastosGQL = inject(TipoGastosGQL);
  private readonly savePreGastoGQL = inject(SavePreGastoGQL);
  private readonly enteByReferenciaGQL = inject(EnteByReferenciaIdGQL);
  private readonly saveEnteGQL = inject(SaveEnteGQL);
  private readonly resumenEnteGQL = inject(EnteFinancialSummaryGQL);
  private readonly personasGQL = inject(PersonaSearchPageGQL);
  private readonly proveedoresGQL = inject(ProveedoresPorTextoGQL);
  private readonly vehiculosGQL = inject(VehiculoSearchPageGQL);
  private readonly mueblesGQL = inject(MuebleSearchPageGQL);
  private readonly inmueblesGQL = inject(InmuebleSearchPageGQL);
  private readonly equiposGQL = inject(EquipoSearchPageGQL);
  private readonly monedasGQL = inject(MonedasGQL);
  private readonly formasPagoGQL = inject(FormasPagoGQL);

  /** Tamaño de página de todos los buscadores del alta. */
  private static readonly TAM_PAGINA = 25;

  tiposDeGasto(): Observable<TipoGasto[]> {
    return this.datos
      .paginado<TipoGasto[]>(this.tipoGastosGQL, 0, 200)
      .pipe(map((lista) => lista ?? []));
  }

  monedas(): Observable<Moneda[]> {
    return this.datos.consultar<Moneda[]>(this.monedasGQL).pipe(map((l) => l ?? []));
  }

  /** Igual que `SolicitudPagoService.formasPago()`: catálogo chico, se trae entero. */
  formasPago(): Observable<FormaPago[]> {
    return this.datos
      .consultar<FormaPago[]>(this.formasPagoGQL, { page: 0, size: 200 }, { mostrarCarga: false })
      .pipe(map((l) => l ?? []));
  }

  /**
   * Una página de resultados para `frc-buscador` en modo paginado.
   *
   * ⚠️ `hayMas` sale de `hasNext` del central. Devolver `true` de más hace
   * que «Cargar más» pida páginas vacías indefinidamente.
   */
  private async pagina<T>(
    gql: Query<{ data?: PageInfo<T> }>,
    texto: string,
    pagina: number,
  ): Promise<{ items: T[]; hayMas: boolean }> {
    const page = await firstValueFrom(
      this.datos.consultar<PageInfo<T>>(gql, {
        texto,
        page: pagina,
        size: GastosService.TAM_PAGINA,
      }),
    );
    return { items: page?.getContent ?? [], hayMas: page?.hasNext === true };
  }

  buscarPersonas(texto: string, pagina: number) {
    return this.pagina<Persona>(this.personasGQL, texto, pagina);
  }

  buscarProveedores(texto: string, pagina: number) {
    return this.pagina<Proveedor>(this.proveedoresGQL, texto, pagina);
  }

  buscarVehiculos(texto: string, pagina: number) {
    return this.pagina<Vehiculo>(this.vehiculosGQL, texto, pagina);
  }

  buscarMuebles(texto: string, pagina: number) {
    return this.pagina<Mueble>(this.mueblesGQL, texto, pagina);
  }

  buscarInmuebles(texto: string, pagina: number) {
    return this.pagina<Inmueble>(this.inmueblesGQL, texto, pagina);
  }

  buscarEquipos(texto: string, pagina: number) {
    return this.pagina<Equipo>(this.equiposGQL, texto, pagina);
  }

  /**
   * La ficha financiera del activo elegido, creándola si no existe.
   *
   * ⚠️ **Es una escritura disparada por elegir, no por guardar.** Si el
   * operador abandona el formulario, el `Ente` queda creado igual. Es como
   * funciona `frc-mobile`: el `Ente` es la ficha del activo en el catálogo
   * financiero, no la solicitud.
   */
  async resolverEnte(moduloPadre: string, referenciaId: number): Promise<Ente> {
    const tipoEnte = tipoEnteDesdeModuloPadre(moduloPadre);
    if (!tipoEnte) {
      throw new Error('El tipo de gasto no admite vinculación a un activo');
    }

    const existente = await firstValueFrom(
      this.datos.consultar<Ente>(this.enteByReferenciaGQL, { tipoEnte, referenciaId }),
    );
    if (existente?.id) {
      return existente;
    }

    // ⚠️ `saveEnte` recibe su argumento como `ente:`, no como `entity:` —
    // que es lo que usa `savePreGasto` en el mismo flujo.
    const creado = await firstValueFrom(
      this.datos.mutar<Ente>(this.saveEnteGQL, {
        ente: { tipoEnte, referenciaId, activo: true },
      }),
    );
    if (!creado?.id) {
      throw new Error('No se pudo vincular el activo seleccionado');
    }
    return creado;
  }

  resumenDelEnte(enteId: number, tipoGastoId: number | null) {
    return this.datos.consultar<ResumenFinancieroEnte>(this.resumenEnteGQL, {
      enteId,
      tipoGastoId,
    });
  }

  /** `DatosService.guardar` manda el input bajo `entity`, que es lo que espera `savePreGasto`. */
  crearSolicitud(input: PreGastoInput): Observable<PreGastoCreado> {
    return this.datos.guardar<PreGastoCreado>(
      this.savePreGastoGQL,
      input as unknown as Record<string, unknown>,
      undefined,
      { mensajeExito: 'Solicitud creada' },
    );
  }
```

Con sus imports. `DatosService.guardar` ya completa `usuarioId` desde la sesión: **no pasarlo a mano** salvo que se quiera atribuir a otro usuario.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-servicio.spec.ts`
Expected: PASS.

Run: `npm run build`
Expected: AOT en verde.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/operaciones/gastos/gastos.service.ts src/app/pruebas/gastos-solicitud-servicio.spec.ts
git commit -m "feat(gastos): add catalogue, searchers and ente resolution to the service

resolverEnte looks the asset up by reference and creates its financial
record only when it has none, mapping EQUIPOS to EQUIPO — plural module,
singular ente type, and comparing them directly fails. The paginated
searchers derive hayMas from the central's hasNext so 'Cargar más' stops
instead of asking for empty pages forever.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 7: La pantalla — estructura, carga inicial y los tres estados

**Files:**
- Create: `src/app/pages/operaciones/gastos/gastos-solicitud-nueva.page.ts`
- Modify: `src/app/pages/operaciones/gastos/gastos.routes.ts`
- Modify: `src/app/pages/operaciones/gastos/gastos-lista.page.ts`
- Test: `src/app/pruebas/gastos-solicitud-nueva.spec.ts`

**Interfaces:**
- Consumes: `GastosService` (Task 6) para tipos de gasto, monedas y formas de pago; `SucursalService` para las sucursales; `faltaParaGuardar` / `totalesPorMoneda` (Task 4), `AuthService.sucursal()`, `PaginaComponent`, `SeccionComponent`, `SelectorComponent`, `BuscadorComponent`, `CampoImporteComponent`, `CampoFechaComponent`, `ImporteComponent`, `EstadoErrorComponent`, `SkeletonComponent`, `DialogoService`, `NotificacionService`.
- Produces: `GastosSolicitudNuevaPage`, ruta `nueva`.

- [ ] **Step 1: Read the sibling page before writing anything**

Run: `sed -n 1,120p src/app/pages/operaciones/gastos/gastos-rendicion.page.ts`
Run: `sed -n 240,330p src/app/pages/operaciones/solicitud-pago/solicitud-pago-nueva.page.ts`

Copiar la estructura: `@Component` standalone con `template` y `styles` inline, `ChangeDetectionStrategy.OnPush`, dependencias por `inject`, estado en `signal`, derivados en `computed`.

- [ ] **Step 2: Write the failing test**

La pantalla se monta con `GastosService` doblado, igual que
`caja-pantallas.spec.ts`. Crear `src/app/pruebas/gastos-solicitud-nueva.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { SucursalService } from '../domains/empresarial/sucursal/sucursal.service';
import { GastosService } from '../pages/operaciones/gastos/gastos.service';
import { GastosSolicitudNuevaPage } from '../pages/operaciones/gastos/gastos-solicitud-nueva.page';

const TIPOS = [
  { id: 1, descripcion: 'VIÁTICO', moduloPadre: 'PERSONAS', tipoNaturaleza: 'VARIABLE' },
  { id: 2, descripcion: 'COMBUSTIBLE', moduloPadre: 'VEHICULO', tipoNaturaleza: 'VARIABLE' },
  { id: 3, descripcion: 'LUZ', moduloPadre: 'ANDE', tipoNaturaleza: 'RECURRENTE' },
];

const MONEDAS = [
  { id: 1, denominacion: 'Guaraní', simbolo: '₲' },
  { id: 2, denominacion: 'Dólar', simbolo: 'US$' },
];

const SUCURSALES = [
  { id: 1, nombre: 'SUC. CENTRAL', activo: true, deposito: { id: 1 } },
  // Sin depósito: es virtual para stock, pero una caja chica se retira igual.
  { id: 9, nombre: 'COMPRAS', activo: true, deposito: null },
];

describe('Alta de solicitud de caja chica', () => {
  let gastos: Record<string, ReturnType<typeof vi.fn>>;

  const montar = () => {
    const fixture = TestBed.createComponent(GastosSolicitudNuevaPage);
    fixture.detectChanges();
    return fixture;
  };

  const texto = (f: { nativeElement: HTMLElement }) => f.nativeElement.textContent ?? '';

  beforeEach(() => {
    localStorage.clear();
    gastos = {
      tiposDeGasto: vi.fn(() => of(TIPOS)),
      monedas: vi.fn(() => of(MONEDAS)),
      formasPago: vi.fn(() => of([{ id: 1, descripcion: 'EFECTIVO' }])),
      resolverEnte: vi.fn(async () => ({ id: 50 })),
      resumenDelEnte: vi.fn(() => of({})),
      crearSolicitud: vi.fn(() => of({ id: 2338, sucursalId: 1 })),
      buscarVehiculos: vi.fn(async () => ({ items: [], hayMas: false })),
      buscarInmuebles: vi.fn(async () => ({ items: [], hayMas: false })),
      buscarMuebles: vi.fn(async () => ({ items: [], hayMas: false })),
      buscarEquipos: vi.fn(async () => ({ items: [], hayMas: false })),
      buscarPersonas: vi.fn(async () => ({ items: [], hayMas: false })),
      buscarProveedores: vi.fn(async () => ({ items: [], hayMas: false })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GastosService, useValue: gastos },
        // Las sucursales no pasan por GastosService: la pantalla usa el
        // servicio que ya existe, como recepcion-nueva.page.ts.
        { provide: SucursalService, useValue: { todas: () => of(SUCURSALES) } },
      ],
    });
    // La sucursal sale de la sesión: no existe «entrar a una sucursal».
    TestBed.inject(AuthService).establecerUsuario({
      id: 7,
      persona: { id: 41, nombre: 'MAURO LANDO' },
      inicioSesion: { sucursal: SUCURSALES[0] },
    } as never);
  });

  it('muestra el esqueleto mientras los catálogos no llegaron', () => {
    // Un selector de tipo de gasto vacío no se distingue de «no hay tipos de
    // gasto». Mientras no hay respuesta, esqueleto.
    //
    // ⚠️ `NEVER`, no `of([])`: `of` emite en el mismo tick, la carga
    // terminaría antes del primer `detectChanges` y el test miraría un
    // estado que ya pasó — pasaría o fallaría por la razón equivocada.
    gastos['tiposDeGasto'].mockReturnValue(NEVER);
    const fixture = montar();

    expect(fixture.nativeElement.querySelector('frc-skeleton')).not.toBeNull();
  });

  it('ofrece reintentar cuando la carga de catálogos falla', () => {
    // frc-mobile silencia este fallo con un catch vacío y deja los selectores
    // vacíos: el formulario parece cargado y no lo está.
    gastos['tiposDeGasto'].mockReturnValue(throwError(() => new Error('central caído')));
    const fixture = montar();

    expect(fixture.nativeElement.querySelector('frc-estado-error')).not.toBeNull();
    expect(texto(fixture)).not.toContain('Seleccionar tipo de gasto');
  });

  it('toma la sucursal de la sesión como valor por defecto', () => {
    const fixture = montar();

    expect(fixture.componentInstance.sucursalId()).toBe(1);
  });

  it('ofrece también las sucursales sin depósito', () => {
    // `soloOperables()` es para lo que mueve stock. Filtrar acá dejaría al
    // operador de COMPRAS sin poder pedir plata.
    const fixture = montar();

    expect(fixture.componentInstance.sucursales().map((s) => s.id)).toEqual([1, 9]);
  });

  it('muestra el responsable de la sesión y no lo deja elegir', () => {
    // El retiro se imputa a la persona, no al usuario.
    const fixture = montar();

    expect(texto(fixture)).toContain('MAURO LANDO');
    expect(fixture.componentInstance.responsableId()).toBe(41);
  });
});
```

Los nombres de los métodos doblados (`monedas`, `formasPago`) tienen que coincidir
con los que expone `GastosService` al terminar la Task 6. **`SucursalService` no se
proxea**: verificá su método real con `sed -n 1,40p src/app/domains/empresarial/sucursal/sucursal.service.ts`
y ajustá el doble a esa firma — no inventes un método que no existe.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-nueva.spec.ts`
Expected: FAIL — la página no existe.

- [ ] **Step 4: Write the page skeleton with its three states**

Crear `gastos-solicitud-nueva.page.ts` con: la carga de tipos de gasto, monedas, formas de pago y sucursales; `cargando` / `errorCarga` / contenido; la sucursal por defecto desde `AuthService.sucursal()`; y las secciones de beneficiario, tipo de gasto, sucursal, vencimiento, urgencia y descripción. Los montos y el activo llegan en las tareas siguientes.

Recordar: **ni un backtick dentro de `template:` o `styles:`**, y **cero literales de color o espaciado** — todo por `var(--sp-*)` y los tokens semánticos.

- [ ] **Step 5: Wire the route BEFORE the id route**

En `src/app/pages/operaciones/gastos/gastos.routes.ts`, agregar como **primera** entrada después de `''`:

```ts
  /** ⚠️ `nueva` va antes que el detalle: como segmento posterior caería en `:id`. */
  {
    path: 'nueva',
    loadComponent: () =>
      import('./gastos-solicitud-nueva.page').then((m) => m.GastosSolicitudNuevaPage),
  },
```

- [ ] **Step 6: Add the entry point in the list**

En `gastos-lista.page.ts`, un botón que navegue a `/operaciones/gastos/nueva`, siguiendo cómo lo hace `solicitudes-pago-lista.page.ts` (`sed -n 1,80p src/app/pages/operaciones/solicitud-pago/solicitudes-pago-lista.page.ts`).

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-nueva.spec.ts`
Expected: PASS.

Run: `npm run build`
Expected: AOT en verde.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/operaciones/gastos/
git commit -m "feat(gastos): add the petty cash request screen with its three states

The initial catalogue load gets a skeleton and a real error state with
retry. frc-mobile swallows that failure with a bare catch and leaves the
selectors empty, which reads as 'there are no expense types' rather than
'the catalogue never loaded'.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 8: El activo, su resumen y el autocompletado en la pantalla

**Files:**
- Modify: `src/app/pages/operaciones/gastos/gastos-solicitud-nueva.page.ts`
- Test: `src/app/pruebas/gastos-solicitud-nueva.spec.ts`

**Interfaces:**
- Consumes: `requiereEnteActivo`, `etiquetaModuloPadre` (`tipo-gasto.reglas`); `resolverEnte`, `resumenDelEnte`, `buscar*` (Task 6); `construirVistaResumen`, `aplicarAutocompletado` (Task 5).
- Produces: en la página, `readonly vistaResumen = signal<VistaResumenEnte | null>(null)` y `readonly errorResumen = signal(false)`.

- [ ] **Step 1: Write the failing test**

Agregar a `src/app/pruebas/gastos-solicitud-nueva.spec.ts`, reusando el
`beforeEach` de la Task 7:

```ts
describe('Alta de solicitud — el activo imputado', () => {
  it('no pide activo para un tipo de gasto de PERSONAS', () => {
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[0]);
    fixture.detectChanges();

    expect(fixture.componentInstance.requiereActivo()).toBe(false);
  });

  it('pide un vehículo cuando el módulo padre es VEHICULO', () => {
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    fixture.detectChanges();

    expect(fixture.componentInstance.requiereActivo()).toBe(true);
    expect(fixture.componentInstance.etiquetaActivo()).toBe('Vehículo');
  });

  it('pide un inmueble para ANDE, y lo llama «Inmueble (ANDE)»', () => {
    // Los siete servicios continuos se imputan a un inmueble: la luz la
    // consume un local. «Inmueble» a secas no distingue el de la luz del
    // del agua.
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    fixture.detectChanges();

    expect(fixture.componentInstance.etiquetaActivo()).toBe('Inmueble (ANDE)');
  });

  it('limpia el activo elegido al cambiar de tipo de gasto', async () => {
    // Un vehículo quedaría imputado a un gasto de inmueble: el gasto termina
    // contra el activo equivocado y nadie lo nota.
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    await fixture.componentInstance.elegirActivo({ id: 88, chapa: 'ABC123' });
    fixture.detectChanges();
    expect(fixture.componentInstance.enteId()).toBe(50);

    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    fixture.detectChanges();

    expect(fixture.componentInstance.enteId()).toBeNull();
    expect(fixture.componentInstance.vistaResumen()).toBeNull();
  });

  it('dice «No se pudo consultar el activo» cuando el resumen falla', async () => {
    // Nunca montos en cero: un cero afirma que no se debe nada, y eso no lo
    // dijo nadie.
    gastos['resumenDelEnte'].mockReturnValue(throwError(() => new Error('sin red')));
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[1]);
    await fixture.componentInstance.elegirActivo({ id: 88, chapa: 'ABC123' });
    fixture.detectChanges();

    expect(fixture.componentInstance.errorResumen()).toBe(true);
    expect(texto(fixture)).toContain('No se pudo consultar el activo');
    expect(texto(fixture)).not.toContain('₲ 0');
  });

  it('autocompleta el primer detalle vacío al elegir el activo', async () => {
    gastos['resumenDelEnte'].mockReturnValue(
      of({ montoSugerido: 450000, monedaId: 1, autocompletarMonto: true }),
    );
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    await fixture.componentInstance.elegirActivo({ id: 12, nombreAsignado: 'LOCAL 3' });
    fixture.detectChanges();

    expect(fixture.componentInstance.detalles()[0].monto).toBe(450000);
    expect(fixture.componentInstance.detalles()[0].monedaId).toBe(1);
  });

  it('NO pisa el monto que el operador ya había cargado', async () => {
    // Es el apartamiento deliberado de frc-mobile: allá, cambiar de activo
    // borraba sin aviso lo tipeado.
    gastos['resumenDelEnte'].mockReturnValue(
      of({ montoSugerido: 450000, monedaId: 1, autocompletarMonto: true }),
    );
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    fixture.componentInstance.cambiarDetalle(0, { monto: 99000, monedaId: 2 });
    await fixture.componentInstance.elegirActivo({ id: 12, nombreAsignado: 'LOCAL 3' });
    fixture.detectChanges();

    expect(fixture.componentInstance.detalles()[0].monto).toBe(99000);
    expect(fixture.componentInstance.detalles()[0].monedaId).toBe(2);
  });

  it('elige el buscador que corresponde al módulo padre', async () => {
    const fixture = montar();
    fixture.componentInstance.elegirTipoGasto(TIPOS[2]);
    await fixture.componentInstance.abrirBuscadorActivo();

    // ANDE es un servicio continuo: el buscador es el de inmuebles, no uno
    // propio del módulo.
    expect(gastos['buscarInmuebles']).toHaveBeenCalled();
    expect(gastos['buscarVehiculos']).not.toHaveBeenCalled();
  });
});
```

El último caso necesita que `abrirBuscadorActivo()` sea observable desde el test.
Si abrir el diálogo lo hace imposible, se extrae la construcción de la config a un
método `configBuscadorActivo()` y se prueba ese: **el test se adapta a la firma
real, no al revés.**

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-nueva.spec.ts`
Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Implement**

En la página:

- `moduloPadre = computed(() => this.tipoGasto()?.moduloPadre ?? null)`
- `requiereActivo = computed(() => requiereEnteActivo(this.moduloPadre()))`
- `etiquetaActivo = computed(() => etiquetaModuloPadre(this.moduloPadre()))`
- Al elegir tipo de gasto: limpiar `enteId`, `activoReferenciaId`, `textoActivo`, `vistaResumen` y `errorResumen`.
- `abrirBuscadorActivo()`: arma la `ConfigBuscadorPaginado` según el módulo padre —`buscarVehiculos` para `VEHICULO`, `buscarMuebles` para `MUEBLE`, `buscarInmuebles` para `INMUEBLE` y los siete servicios continuos, `buscarEquipos` para `EQUIPOS`— y la abre con `dialogo.abrir`.
- Elegido el activo: `resolverEnte` → `resumenDelEnte` → `construirVistaResumen` para la tarjeta y `aplicarAutocompletado` para los campos.
- Si el resumen falla: `errorResumen.set(true)` y la tarjeta muestra **«No se pudo consultar el activo»**, sin montos.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-nueva.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/operaciones/gastos/gastos-solicitud-nueva.page.ts src/app/pruebas/gastos-solicitud-nueva.spec.ts
git commit -m "feat(gastos): pick the imputed asset and read its financial summary

The searcher shown depends on the expense type's parent module, with the
seven continuous services all resolving to a building. Changing the
expense type clears the chosen asset, or the expense would end up filed
against the wrong one. A failed summary says so instead of showing zeros.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 9: Detalle financiero, guardado y navegación al QR

**Files:**
- Modify: `src/app/pages/operaciones/gastos/gastos-solicitud-nueva.page.ts`
- Test: `src/app/pruebas/gastos-solicitud-nueva.spec.ts`

**Interfaces:**
- Consumes: `faltaParaGuardar`, `totalesPorMoneda` (Task 4); `crearSolicitud` (Task 6).
- Produces: `function construirPreGastoInput(datos): PreGastoInput` en
  `gastos-solicitud.reglas.ts`, y la pantalla completa.

- [ ] **Step 1: Write the failing test**

Primero la parte pura. Agregar a `src/app/pruebas/gastos-solicitud-reglas.spec.ts`:

```ts
import { construirPreGastoInput } from '../pages/operaciones/gastos/gastos-solicitud.reglas';

describe('El input que se manda al central', () => {
  const base = {
    sucursalId: 1,
    responsableId: 41,
    tipoGastoId: 5,
    enteId: 50,
    beneficiarioTipo: 'PROVEEDOR' as const,
    beneficiarioPersonaId: 77,
    beneficiarioProveedorId: 33,
    fechaVencimiento: '2026-10-05',
    nivelUrgencia: 'NORMAL',
    descripcion: '  combustible de la semana  ',
    detalles: [{ monto: 500, monedaId: 1, formaPago: 'EFECTIVO' }],
  };

  it('no lleva cajaId', () => {
    // El campo existe en frc-mobile y viaja siempre undefined: sale de una
    // clave de localStorage que nadie escribe en todo el repo.
    expect(construirPreGastoInput(base)).not.toHaveProperty('cajaId');
  });

  it('la sucursal de la caja es la misma de retiro', () => {
    const input = construirPreGastoInput(base);
    expect(input.sucursalId).toBe(1);
    expect(input.sucursalCajaId).toBe(1);
  });

  it('manda el beneficiario que corresponde y no el otro', () => {
    // Mandar los dos dejaría al central decidiendo cuál vale.
    const proveedor = construirPreGastoInput(base);
    expect(proveedor.beneficiarioProveedorId).toBe(33);
    expect(proveedor.beneficiarioPersonaId).toBeUndefined();

    const persona = construirPreGastoInput({ ...base, beneficiarioTipo: 'PERSONA' });
    expect(persona.beneficiarioPersonaId).toBe(77);
    expect(persona.beneficiarioProveedorId).toBeUndefined();
  });

  it('recorta la descripción y la omite si queda vacía', () => {
    expect(construirPreGastoInput(base).descripcion).toBe('combustible de la semana');
    expect(
      construirPreGastoInput({ ...base, descripcion: '   ' }).descripcion,
    ).toBeUndefined();
  });

  it('omite el vencimiento vacío en vez de mandar cadena vacía', () => {
    expect(
      construirPreGastoInput({ ...base, fechaVencimiento: '' }).fechaVencimiento,
    ).toBeUndefined();
  });

  it('manda las finanzas con monto, moneda y forma de pago', () => {
    expect(construirPreGastoInput(base).finanzas).toEqual([
      { monto: 500, monedaId: 1, formaPago: 'EFECTIVO' },
    ]);
  });

  it('no manda usuarioId: lo completa la capa de datos desde la sesión', () => {
    expect(construirPreGastoInput(base)).not.toHaveProperty('usuarioId');
  });
});
```

Y la parte de pantalla, en `src/app/pruebas/gastos-solicitud-nueva.spec.ts`:

```ts
describe('Alta de solicitud — montos y guardado', () => {
  const completar = (fixture: ReturnType<typeof montar>) => {
    fixture.componentInstance.elegirTipoGasto(TIPOS[0]);
    fixture.componentInstance.elegirProveedor({ id: 33, persona: { nombre: 'DIST. ESTE' } });
    fixture.componentInstance.cambiarDetalle(0, {
      monto: 500000,
      monedaId: 1,
      formaPago: 'EFECTIVO',
    });
    fixture.detectChanges();
  };

  it('arranca con un detalle y deja agregar otro', () => {
    const fixture = montar();
    expect(fixture.componentInstance.detalles()).toHaveLength(1);

    fixture.componentInstance.agregarDetalle();
    expect(fixture.componentInstance.detalles()).toHaveLength(2);
  });

  it('no deja quitar el último detalle', () => {
    const fixture = montar();
    fixture.componentInstance.quitarDetalle(0);

    expect(fixture.componentInstance.detalles()).toHaveLength(1);
  });

  it('muestra el total en guaraníes sin decimales', () => {
    // El guaraní no lleva decimales, y la denominación es lo que lo decide.
    const fixture = montar();
    fixture.componentInstance.cambiarDetalle(0, {
      monto: 1500000,
      monedaId: 1,
      formaPago: 'EFECTIVO',
    });
    fixture.detectChanges();

    expect(texto(fixture)).toContain('1.500.000');
    expect(texto(fixture)).not.toContain('1.500.000,00');
  });

  it('bloquea el guardado y dice qué falta', () => {
    const fixture = montar();
    fixture.detectChanges();

    expect(fixture.componentInstance.falta()).toBe('Seleccione un tipo de gasto');
    expect(gastos['crearSolicitud']).not.toHaveBeenCalled();
  });

  it('avisa cuando se repite la moneda entre detalles', () => {
    const fixture = montar();
    completar(fixture);
    fixture.componentInstance.agregarDetalle();
    fixture.componentInstance.cambiarDetalle(1, {
      monto: 100,
      monedaId: 1,
      formaPago: 'TRANSFERENCIA',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.falta()).toBe(
      'No repita la misma moneda en más de un detalle',
    );
  });

  it('navega al detalle de la solicitud creada, donde está el QR', async () => {
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = montar();
    completar(fixture);

    await fixture.componentInstance.guardar();

    // El detalle se resuelve por id **y** sucursal: sin los dos no encuentra
    // la solicitud.
    expect(navegar).toHaveBeenCalledWith(['/operaciones/gastos', 2338, 1]);
  });

  it('se queda en el formulario si el guardado falla', async () => {
    // Navegar igual perdería una carga entera.
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    gastos['crearSolicitud'].mockReturnValue(throwError(() => new Error('rechazado')));
    const fixture = montar();
    completar(fixture);

    await fixture.componentInstance.guardar();

    expect(navegar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.guardando()).toBe(false);
    expect(fixture.componentInstance.detalles()[0].monto).toBe(500000);
  });
});
```

Agregar `import { Router } from '@angular/router';` al encabezado del archivo.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/pruebas/gastos-solicitud-nueva.spec.ts`
Expected: FAIL en los casos nuevos.

- [ ] **Step 3: Implement the input builder**

En `gastos-solicitud.reglas.ts`:

```ts
export interface DatosParaInput {
  sucursalId: number;
  responsableId: number;
  tipoGastoId: number;
  enteId: number | null;
  beneficiarioTipo: BeneficiarioTipo;
  beneficiarioPersonaId: number | null;
  beneficiarioProveedorId: number | null;
  fechaVencimiento: string;
  nivelUrgencia: string;
  descripcion: string;
  detalles: DetalleFinanciero[];
}

/**
 * Lo que se le manda a `savePreGasto`.
 *
 * ⚠️ **Sin `cajaId` y sin `usuarioId`.** El primero es el campo muerto de
 * `frc-mobile` —sale de una clave de localStorage que nadie escribe—; el
 * segundo lo completa `DatosService.guardar` desde la sesión, y pisarlo acá
 * atribuiría la solicitud a otro usuario.
 */
export function construirPreGastoInput(datos: DatosParaInput): PreGastoInput {
  const descripcion = datos.descripcion.trim();

  return {
    sucursalId: datos.sucursalId,
    // La caja de la que se retira es la de la sucursal elegida.
    sucursalCajaId: datos.sucursalId,
    funcionarioId: datos.responsableId,
    tipoGastoId: datos.tipoGastoId,
    enteId: datos.enteId ?? undefined,
    // Solo el beneficiario que corresponde: mandar los dos dejaría al central
    // decidiendo cuál vale.
    beneficiarioPersonaId:
      datos.beneficiarioTipo === 'PERSONA' ? datos.beneficiarioPersonaId ?? undefined : undefined,
    beneficiarioProveedorId:
      datos.beneficiarioTipo === 'PROVEEDOR'
        ? datos.beneficiarioProveedorId ?? undefined
        : undefined,
    fechaVencimiento: datos.fechaVencimiento || undefined,
    nivelUrgencia: datos.nivelUrgencia,
    descripcion: descripcion || undefined,
    finanzas: datos.detalles.map((d) => ({
      monto: d.monto as number,
      monedaId: d.monedaId as number,
      formaPago: d.formaPago as string,
    })),
  };
}
```

Con el import de `PreGastoInput` desde `src/app/domains/gastos/pre-gasto.model`.

- [ ] **Step 4: Implement the screen**

- `detalles = signal<DetalleFinanciero[]>([{ monto: null, monedaId: null, formaPago: null }])`, con agregar y quitar (quitar deshabilitado con uno solo).
- Cada fila: `frc-campo-importe` para el monto, `frc-selector` para moneda y forma de pago.
- `totales = computed(() => totalesPorMoneda(this.detalles(), this.monedas()))`, mostrados con `frc-importe` pasándole `denominacion` y `simbolo`.
- `falta = computed(() => faltaParaGuardar({...}))`; el botón se deshabilita y el mensaje se muestra.
- `guardar()`: `construirPreGastoInput(...)` → `crearSolicitud` → `router.navigate(['/operaciones/gastos', id, sucursalId])`. Si falla, `guardando.set(false)` y se queda en el formulario — `DatosService` ya muestra el error real del central.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS, incluidos los 901 previos.

Run: `npm run build`
Expected: AOT en verde.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/operaciones/gastos/ src/app/pruebas/
git commit -m "feat(gastos): create the request and land on its withdrawal QR

Saving navigates to the new request's detail rather than back to the
list: the QR the employee shows at the till lives there, and it is what
they need next. A failed save keeps the form, so a full entry is not
lost.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

### Task 10: Documentación y plan de testeo manual

Sin esto el módulo **no está terminado** (regla 4.1).

**Files:**
- Modify: `docs/PLAN_TESTEO_MANUAL.md`
- Modify: `docs/modulos/operaciones-solicitud-gastos.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the manual test block**

Agregar el bloque **52 · Alta de solicitud de caja chica** al final de `docs/PLAN_TESTEO_MANUAL.md`, con «Esperado» por caso, cubriendo como mínimo:

1. Entrar desde la lista de caja chica.
2. Los catálogos cargan; con el central caído, el estado de error con reintentar.
3. La sucursal de retiro viene con la de la sesión y se puede cambiar.
4. Un tipo de gasto de `PERSONAS` no pide activo.
5. Uno de `VEHICULO` pide un vehículo, y el buscador pagina con «Cargar más».
6. Uno de `ANDE` pide un inmueble y lo llama «Inmueble (ANDE)».
7. Cambiar de tipo de gasto limpia el activo elegido.
8. Un activo con plan de cuotas muestra la tarjeta de resumen.
9. El monto sugerido entra en el primer detalle vacío.
10. Con un monto ya cargado, elegir otro activo **no lo pisa**.
11. Dos detalles en la misma moneda: no deja guardar y lo dice.
12. Dos detalles en monedas distintas: guarda.
13. El total en guaraníes sale sin decimales.
14. Guardar lleva al detalle, con el QR de retiro visible.
15. El QR sirve para retirar en la caja.

- [ ] **Step 2: Update the totals table**

Sumar el bloque 52 con su cantidad de casos y actualizar la fila «Total», hoy en **472**.

> ⚠️ Ya hay un desfase conocido en esa tabla —la fila «Total» y la suma por bloque no coinciden— anterior a este trabajo. **No lo arregles acá**: sumá tu bloque y dejá el desfase donde está, o el diff mezcla dos cosas distintas.

- [ ] **Step 3: Mark what could NOT be verified**

En el bloque, marcar explícitamente los casos que no se ejecutaron y por qué. Los que dependen de un activo con plan de cuotas cargado necesitan un dato concreto en la base: **consultarla para elegirlo, no inventar un ejemplo**. Compilar no es probar; verificar por SQL es evidencia parcial y hay que decirlo como tal.

- [ ] **Step 4: Update the module doc**

En `docs/modulos/operaciones-solicitud-gastos.md`:
- El alta pasa de «Lo que falta» a implementada, con su ruta.
- Corregir la afirmación de que `enteFinancialSummary` y `getEnteFinancialSummary` son dos archivos para lo mismo: uno es la clase `Query`, el otro el documento.
- Anotar que `extraerCajaId()` era código muerto y no se portó.
- Anotar que el campo de naturaleza es `tipoNaturaleza`.

- [ ] **Step 5: Update CLAUDE.md**

Sacar «el **alta** de la solicitud» de la línea de «Pendiente» y sumarlo al «Estado», junto con la nota de que `frc-buscador` en modo paginado tiene ahora su primer consumidor y sus tests.

- [ ] **Step 6: Verify the gates**

Run: `npm test`
Run: `npm run build`
Expected: los dos en verde.

- [ ] **Step 7: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "feat(gastos): document the request form and its manual test block

Adds block 52 to the manual test plan with an expectation per case, and
marks which cases could not be run here — the ones needing an asset with
an instalment plan in the base. Corrects the module doc's claim that the
two financial-summary files were duplicates.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0163TzsnGbnUuxmoaSnxHPDi"
```

---

## Cierre — antes de cualquier push

**No se pushea ni se abre PR hasta que el usuario haya probado la app y aprobado explícitamente.**

1. Levantar `npm start` (:4300). Si hace falta el central local, en :8081 sin perfil `dev`. En `localhost` la app cae a **alpha** por defecto: para el central local hay que elegir `http://localhost:8081` a mano en la pantalla de servidor, y eso invalida la sesión.
2. Decirle **dónde probar**: pantalla, pasos y un caso con datos que existan de verdad. **Consultar la base para elegir el tipo de gasto y el activo** — no inventar un ejemplo.
3. Esperar la **aprobación explícita**.
4. **Preguntar si se pushea**, en una pregunta que trate solo del push, y esperar el sí.
5. Recién ahí `git push` y PR.

Que los tests pasen y el AOT esté en verde no saltea nada de esto: compilar no es probar. Que el usuario confirme que una prueba funcionó **tampoco es autorización para pushear** — está reportando el resultado de lo que se le pidió probar.
