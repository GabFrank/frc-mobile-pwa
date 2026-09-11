/**
 * Página del backend.
 *
 * ⚠️ Los nombres llevan el prefijo `get` porque el central serializa los
 * getters de `Page` de Spring Data tal cual. Las queries GraphQL deben pedir
 * `getTotalPages`, no `totalPages`.
 *
 * En `frc-mobile` este tipo vivía dentro de `app.component.ts`.
 */
export interface Pageable {
  pageNumber?: number;
  pageSize?: number;
  offset?: number;
}

export interface PageInfo<T> {
  content?: T[];
  getContent?: T[];
  getTotalPages?: number;
  getTotalElements?: number;
  getNumberOfElements?: number;
  isFirst?: boolean;
  isLast?: boolean;
  hasNext?: boolean;
  hasPrevious?: boolean;
  getPageable?: Pageable;
}
