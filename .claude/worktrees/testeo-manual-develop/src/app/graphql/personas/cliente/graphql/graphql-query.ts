import gql from 'graphql-tag';

export const clientesQuery = gql`
  {
    clientes {
      id
      persona {
        id
        nombre
      }
      nombre
      credito
      contactos {
        id
        telefono
      }
    }
  }
`;

export const clientesSearchByPersona = gql`
  query ($texto: String) {
    data: clientePorPersona(texto: $texto) {
      id
      persona {
        id
        nombre
        direccion
      }
      nombre
      documento
      credito
      contactos {
        id
        telefono
      }
    }
  }
`;

export const clientePorPersonaDocumento = gql`
  query ($texto: String) {
    data: clientePorPersonaDocumento(texto: $texto) {
      id
      persona {
        id
        nombre
        direccion
      }
      nombre
      credito
      contactos {
        id
        telefono
      }
    }
  }
`;

export const clienteSearchByPersonaId = gql`
  query ($id: ID) {
    data: clientePorPersonaId(id: $id) {
      id
      persona {
        id
        nombre
      }
      nombre
      credito
      contactos {
        id
        telefono
      }
      tipo
      codigo
    }
  }
`;

export const clientePorPersonaIdFromServer = gql`
  query ($id: ID) {
    data: clientePorPersonaIdFromServer(id: $id) {
      id
      persona {
        id
        nombre
      }
      nombre
      credito
      contactos {
        id
        telefono
      }

      tipo
      codigo
    }
  }
`;

export const clientesSearchByTelefono = gql`
  query ($texto: String) {
    data: clientePorTelefono(texto: $texto) {
      id
      persona {
        id
        nombre
      }
      nombre
      credito
      contactos {
        id
        telefono
      }
    }
  }
`;

export const clienteQuery = gql`
  query ($id: ID!) {
    data: cliente(id: $id) {
      id
      persona {
        id
        nombre
      }
      nombre
      credito
      contactos {
        id
        telefono
      }
    }
  }
`;

export const saveCliente = gql`
  mutation saveCliente($entity: ClienteInput!) {
    data: saveCliente(cliente: $entity) {
      id
    }
  }
`;

export const deleteClienteQuery = gql`
  mutation deleteCliente($id: ID!) {
    deleteCliente(id: $id)
  }
`;

