import { Injectable } from '@angular/core';
import { Query } from 'src/app/core/graphql/gql-base';
import { isUserFaceAuthQuery } from './graphql-query';

@Injectable({
  providedIn: 'root'
})
export class IsUserFaceAuthGQL extends Query<{ data?: Boolean }> {
  document = isUserFaceAuthQuery;
}
