import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { getUsuarioImagesQuery } from './graphql-query';

@Injectable({
  providedIn: 'root'
})
export class GetUsuarioImagesGQL extends Query<{ data?: string[] }> {
  document = getUsuarioImagesQuery;
}
