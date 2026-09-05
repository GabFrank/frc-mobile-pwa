# El presupuesto del bundle inicial

De dónde salen los números de `budgets` en `angular.json` y qué hacer cuando
el build vuelve a quejarse.

## Los números

```json
{ "type": "initial", "maximumWarning": "750kB", "maximumError": "900kB" }
```

**Se miden en tamaño crudo**, no comprimido: es lo único que el presupuesto de
Angular sabe comparar. Lo que el navegador realmente baja es bastante menos.

## Por qué 750, y no 500

El repo arrancó con `500kB / 1MB`, que son los valores que genera `ng new`.
Nunca se cumplieron: el arranque de esta app **no puede** entrar en 500 kB
crudos, así que el warning salía en cada build y dejó de significar algo. Es
lo que hizo que tres `NG8011` pasaran desapercibidos hasta que alguien se puso
a leer la salida entera.

Medición del 2026-09-05, commit `5aee0e2`:

```
Initial total   660.34 kB crudo   |   169.84 kB transferencia
```

Y ese arranque está repartido así —medido forzando un split limpio, no
estimado:

| Bloque | Crudo | Qué es |
|---|---:|---|
| Angular | 295 kB | `core`, `router`, `forms`, `platform-browser` |
| Material + CDK | 160 kB | overlay, a11y, portal, snack-bar, button |
| Apollo + graphql | 158 kB | `@apollo/client`, `apollo-angular`, `graphql` |
| Propio | ~26 kB | `main`, estilos globales, config, guards, sesión |

Ninguno de los tres es opcional para arrancar. **750 kB deja ~90 kB de margen
sobre lo que hay hoy** —suficiente para que el presupuesto no sea ruido, poco
como para que una regresión de verdad lo dispare— y el error baja de 1 MB a
900 kB, que es lo que la app no debería cruzar sin que alguien lo decida.

## Firebase no está en el arranque

Es la sospecha natural y es falsa: Firebase quedó entero en chunks lazy. Lo
único que suma al arranque son ~900 bytes de configuración.

## Material entra al arranque por un solo import, y es accidental

El grafo eager desde `main.ts` son 34 archivos, y tiene **exactamente un**
import de Material:

```
@angular/material/snack-bar
  ← core/ui/notificacion.service.ts
  ← core/graphql/datos.service.ts        ← la capa de datos importa la de UI
  ← core/auth/sesion.service.ts
  ← app.config.ts   (provideAppInitializer → SesionService.restaurar())
  ← main.ts
```

`DatosService` avisa éxito y error por snackbar, y con eso arrastra
`MatSnackBar` → overlay → CDK: 160 kB.

**Cortarlo no mejora la carga.** Se midió: la primera pantalla es el login, que
usa Material igual, así que el chunk se pediría un round-trip después. Se
cambia un bundle grande por dos pedidos, y el arranque queda en 500 kB justos,
sin margen.

Lo que sí queda en pie de ese hallazgo es un problema de capas —la capa de
datos no debería importar la de UI—, y ese se arregla por lo que es, no por
peso.

## Qué hacer cuando el warning vuelva a salir

En este orden:

1. **Mirar qué entró al grafo eager**, no subir el número. El grafo se recorre
   desde `main.ts` siguiendo solo los `import` estáticos: todo lo que cuelga de
   `app.config.ts`, `app.routes.ts` (guards incluidos) y `app.ts`. Un servicio
   de `core/` que importa un componente es la causa típica.
2. **Si lo que entró tiene que estar**, subir el presupuesto **y actualizar
   este documento** con la medición nueva. Un número sin la medición que lo
   justifica vuelve a ser una expectativa inventada, que es como empezó esto.
3. **Nunca** dejarlo incumplido. Un presupuesto que siempre falla no es un
   presupuesto: es ruido que tapa los warnings que sí importan.
