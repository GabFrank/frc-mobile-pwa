import gql from 'graphql-tag';

export const usuariosQuery = gql`
  {
    usuario {
      id
      nickname
      persona {
        id
        nombre
      }
      password
      creadoEn
      usuario {
        persona {
          nombre
        }
      }
    }
  }
`;

export const usuariosSearch = gql`
  query ($texto: String) {
    data: usuarioSearch(texto: $texto) {
      id
      nickname
      persona {
        id
        nombre
      }
      password
      creadoEn
      usuario {
        persona {
          nombre
        }
      }
    }
  }
`;

export const usuarioQuery = gql`
  query ($id: ID!) {
    data: usuario(id: $id) {
      id
      nickname
      persona {
        id
        nombre
        telefono
        email
        nacimiento
        imagenes
        embeddingFacial
      }
      password
      creadoEn
      usuario {
        persona {
          nombre
        }
      }
      roles
      inicioSesion {
        id
        usuario {
          id
        }
        sucursal {
          id
          nombre
          # Con estos dos se decide si la sucursal de la sesion puede operar:
          # sin deposito es virtual. Ver sucursal.util.ts
          deposito
          activo
        }
        tipoDespositivo
        idDispositivo
        token
        horaInicio
        horaFin
        creadoEn
      }
    }
  }
`;

// Version de la query de usuario usada EXCLUSIVAMENTE en el login.
// Es identica a `usuarioQuery` pero SIN `persona.embeddingFacial`.
// Motivo: el login corre contra cualquier servidor, y los servidores en
// `release/beta` todavia no tienen el campo `embeddingFacial` en el type
// Persona -> GraphQL rechaza la query y el login falla.
// El login no consume `embeddingFacial`; la busqueda/galeria facial de marcacion
// sigue usando `usuarioQuery` (con el campo) contra el servidor que lo soporta.
// La query de arranque de sesión.
//
// ⚠️ NO pide `password`. El repo anterior lo traía —el backend lo devuelve en
// texto plano— y quedaba en memoria del cliente sin ninguna necesidad. Ver
// REPORTE_VULNERABILIDADES.md del workspace.
//
// La sucursal se toma de `inicioSesion.sucursal`. ⚠️ El tipo `Usuario` del
// central NO tiene campo `sucursal` — pedirlo hace fallar toda la query, y
// con ella el arranque de sesión. Verificado contra
// central/src/main/resources/graphql/personas/usuario.graphqls.
export const usuarioLoginQuery = gql`
  query ($id: ID!) {
    data: usuario(id: $id) {
      id
      nickname
      persona {
        id
        nombre
        telefono
        email
        nacimiento
        imagenes
      }
      creadoEn
      usuario {
        persona {
          nombre
        }
      }
      roles
      inicioSesion {
        id
        usuario {
          id
        }
        sucursal {
          id
          nombre
          # Con estos dos se decide si la sucursal de la sesion puede operar:
          # sin deposito es virtual. Ver sucursal.util.ts
          deposito
          activo
        }
        tipoDespositivo
        idDispositivo
        token
        horaInicio
        horaFin
        creadoEn
      }
    }
  }
`;

export const usuarioPorPersonaIdQuery = gql`
  query ($id: ID!) {
    data: usuarioPorPersonaId(id: $id) {
      id
      nickname
      persona {
        id
        nombre
      }
      password
      creadoEn
      usuario {
        persona {
          nombre
        }
      }
      roles
      inicioSesion {
        id
        usuario {
          id
        }
        sucursal {
          id
          nombre
          # Con estos dos se decide si la sucursal de la sesion puede operar:
          # sin deposito es virtual. Ver sucursal.util.ts
          deposito
          activo
        }
        tipoDespositivo
        idDispositivo
        token
        horaInicio
        horaFin
        creadoEn
      }
    }
  }
`;

export const saveUsuario = gql`
  mutation saveUsuario($entity: UsuarioInput!) {
    data: saveUsuario(usuario: $entity) {
      id
      nickname
      persona {
        id
        nombre
      }
      password
      creadoEn
      usuario {
        persona {
          nombre
        }
      }
      inicioSesion {
        id
        usuario {
          id
        }
        sucursal {
          id
          nombre
          # Con estos dos se decide si la sucursal de la sesion puede operar:
          # sin deposito es virtual. Ver sucursal.util.ts
          deposito
          activo
        }
        tipoDespositivo
        idDispositivo
        token
        horaInicio
        horaFin
        creadoEn
      }
    }
  }
`;

export const deleteUsuarioQuery = gql`
  mutation deleteUsuario($id: ID!) {
    deleteUsuario(id: $id)
  }
`;

export const inicioSesionListPorUsuarioIdAndAbiertoGQL = gql`
  query ($id: Int!, $sucId: Int, $page: Int, $size: Int) {
    data: inicioSesionListPorUsuarioIdAndAbierto(
      id: $id
      sucId: $sucId
      page: $page
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
        usuario {
          id
        }
        sucursal {
          id
          nombre
          # Con estos dos se decide si la sucursal de la sesion puede operar:
          # sin deposito es virtual. Ver sucursal.util.ts
          deposito
          activo
        }
        tipoDespositivo
        idDispositivo
        token
        horaInicio
        horaFin
        creadoEn
      }
    }
  }
`;

export const saveInicioSesionGQL = gql`
  mutation saveInicioSesion($entity: InicioSesionInput!) {
    data: saveInicioSesion(entity: $entity) {
      id
      usuario {
        id
      }
      sucursal {
        id
      }
      tipoDespositivo
      idDispositivo
      token
      horaInicio
      horaFin
      creadoEn
    }
  }
`;

export const actualizarTokenFcmGQL = gql`
  mutation actualizarTokenFcm($tokenFcm: String!, $idDispositivo: String) {
    data: actualizarTokenFcm(tokenFcm: $tokenFcm, idDispositivo: $idDispositivo)
  }
`;

export const saveUsuarioImageQuery = gql`
  mutation ($id: ID!, $type: String!, $image: String!, $embedding: [Float], $embeddingGaleriaJson: String) {
    data: saveUsuarioImage(id: $id, type: $type, image: $image, embedding: $embedding, embeddingGaleriaJson: $embeddingGaleriaJson)
  }
`;

export const incorporarEmbeddingMarcacionQuery = gql`
  mutation ($usuarioId: ID!, $embedding: [Float]!, $score: Float!) {
    data: incorporarEmbeddingMarcacion(usuarioId: $usuarioId, embedding: $embedding, score: $score) {
      resultado
      mensaje
    }
  }
`;

export const usuarioPorEmbeddingQuery = gql`
  query ($embedding: [Float], $excludeIds: [Int]) {
    data: usuarioPorEmbedding(embedding: $embedding, excludeIds: $excludeIds) {
      usuario {
        id
        nickname
        activo
        persona {
          id
          nombre
          imagenes
          embeddingFacial
        }
      }
      similitud
    }
  }
`;

export const getUsuarioImagesQuery = gql`
  query ($id: ID!, $type: String!) {
    data: getUsuarioImages(id: $id, type: $type)
  }
`;

export const isUserFaceAuthQuery = gql`
  query ($id: ID!) {
    data: isUserFaceAuth(id: $id)
  }
`;

/**
 * Galería facial del usuario, para verificar 1:1 antes de marcar.
 *
 * ⚠️ **Query aparte y a demanda.** `embeddingFacial` es un JSON de ~96 KB:
 * pedirlo junto con la sesión lo haría viajar en cada login, y solo hace
 * falta cuando alguien va a marcar con el rostro.
 */
export const galeriaFacialQuery = gql`
  query ($id: ID!) {
    data: usuario(id: $id) {
      id
      persona {
        id
        embeddingFacial
      }
    }
  }
`;
