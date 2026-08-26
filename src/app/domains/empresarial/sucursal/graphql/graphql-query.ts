import gql from 'graphql-tag';

/**
 * ⚠️ Pide **`deposito` y `activo`**: son los dos campos con los que se decide
 * si una sucursal puede participar de una operación. Ver `sucursal.util.ts`.
 */
export const sucursalesQuery = gql
  `{
    data: sucursales {
      id
      nombre
      localizacion
      deposito
      activo
      ciudad{
        id
      }
      creadoEn
      usuario{
        id
      }
      ip
      puerto
    }
  }`;

/**
 * ⚠️ **Devuelve un `SucursalPage`, no una lista.** Las sucursales viven en
 * `getContent`; `SucursalService.buscar()` lo desenvuelve.
 */
export const sucursalesSearch = gql
  `query($texto: String){
    data : sucursalesSearch(texto: $texto){
      getContent{
        id
        nombre
        localizacion
        ciudad{
          id
        }
        creadoEn
        usuario{
          id
        }
        ip
        puerto
      }
    }
  }`

export const sucursalQuery = gql
  `query($id: ID!){
    data : sucursal(id: $id){
      id
      nombre
      localizacion
      ciudad{
        id
      }
      creadoEn
      usuario{
        id
      }
      ip
      puerto
    }
  }`

  export const sucursalActualQuery = gql
  `query{
    data : sucursalActual{
      id
      nombre
      ip
      puerto
    }
  }`

export const saveSucursal = gql
  `mutation saveSucursal($entity:SucursalInput!){
      data: saveSucursal(sucursal:$entity){
        id
      }
    }`

export const deleteSucursalQuery = gql
  ` mutation deleteSucursal($id: ID!){
      deleteSucursal(id: $id)
    }`
