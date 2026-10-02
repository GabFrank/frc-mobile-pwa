import { ApolloTestingModule } from 'apollo-angular/testing';

/**
 * Apollo de mentira, para los tests que montan pantallas de shell.
 *
 * No hace falta cuando el test dobla el servicio de datos —`mis-finanzas`
 * mockea `MisFinanzasService` y no llega nunca a Apollo—. Hace falta cuando
 * el test monta un componente que **transitivamente** inyecta un `…GQL`:
 * el shell pide el conteo de no leídas, Inicio muestra el resumen de
 * crédito, y ninguno de los dos es el tema del test que los monta.
 *
 * Sin esto el fallo es `NG0201: No provider found for Apollo`, con una ruta
 * de inyección larga que no dice qué pantalla la disparó.
 */
export const APOLLO_DE_PRUEBA = [ApolloTestingModule];
