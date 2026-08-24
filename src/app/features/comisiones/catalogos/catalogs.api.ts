// Catálogos del motor de comisiones: las tablas/vistas fuente sobre las que se escriben
// las fórmulas, sus campos y los valores permitidos de cada campo.

import { Injectable, inject } from '@angular/core';
import { ComisionesHttp } from '../comisiones-http.service';

const BASE = '/api/catalogs';

export type CatalogFieldType =
  | 'int'
  | 'bigint'
  | 'decimal'
  | 'double'
  | 'string'
  | 'date'
  | 'datetime';

export const CATALOG_FIELD_TYPES: CatalogFieldType[] = [
  'int',
  'bigint',
  'decimal',
  'double',
  'string',
  'date',
  'datetime',
];

export interface Catalog {
  id: string;
  name: string;
  description?: string | null;
  source_path?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CatalogField {
  id: string;
  catalog_id: string;
  field_name: string;
  field_type: CatalogFieldType;
  display_name?: string | null;
  description?: string | null;
  is_filterable: boolean;
  is_visible: boolean;
  example_value?: string | null;
  created_at: string;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface CatalogFieldValue {
  id: string;
  field_id: string;
  value: string;
  label: string;
  description?: string | null;
  is_active: boolean;
  sort_index: number;
  created_at: string;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface ListResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface CreateCatalogRequest {
  name: string;
  description?: string;
  source_path?: string;
  is_active?: boolean;
}

export type UpdateCatalogRequest = Partial<CreateCatalogRequest>;

export interface CreateCatalogFieldRequest {
  field_name: string;
  field_type: CatalogFieldType;
  display_name?: string;
  description?: string;
  is_filterable?: boolean;
  is_visible?: boolean;
  example_value?: string;
}

export type UpdateCatalogFieldRequest = Partial<CreateCatalogFieldRequest>;

export interface DeleteResponse {
  deleted: boolean;
  id: string;
}

/** El API solo acepta los tipos de la lista; cualquier otro se manda como string. */
function normalizeFieldType(tipo?: string): CatalogFieldType {
  const t = String(tipo ?? '').toLowerCase() as CatalogFieldType;
  return CATALOG_FIELD_TYPES.includes(t) ? t : 'string';
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

@Injectable({ providedIn: 'root' })
export class CatalogsApi {
  private readonly http = inject(ComisionesHttp);

  // ── Catálogos ─────────────────────────────────────────────────────────────

  list(params: {
    q?: string;
    is_active?: boolean;
    page?: number;
    page_size?: number;
    order_by?: 'name' | 'created_at';
    order_dir?: 'asc' | 'desc';
  } = {}): Promise<ListResponse<Catalog>> {
    return this.http.get<ListResponse<Catalog>>(`${BASE}${qs(params)}`);
  }

  getById(catalogId: string): Promise<Catalog> {
    return this.http.get<Catalog>(`${BASE}/${catalogId}`);
  }

  create(data: CreateCatalogRequest): Promise<Catalog> {
    return this.http.send<Catalog>(BASE, 'POST', data, 'Error creando el catálogo');
  }

  update(catalogId: string, data: UpdateCatalogRequest): Promise<Catalog> {
    return this.http.send<Catalog>(
      `${BASE}/${catalogId}`,
      'PUT',
      data,
      'Error actualizando el catálogo',
    );
  }

  remove(catalogId: string): Promise<DeleteResponse> {
    return this.http.send<DeleteResponse>(
      `${BASE}/${catalogId}`,
      'DELETE',
      undefined,
      'Error eliminando el catálogo',
    );
  }

  activate(catalogId: string): Promise<Catalog> {
    return this.http.send<Catalog>(
      `${BASE}/${catalogId}/activate`,
      'POST',
      undefined,
      'Error activando el catálogo',
    );
  }

  deactivate(catalogId: string): Promise<Catalog> {
    return this.http.send<Catalog>(
      `${BASE}/${catalogId}/deactivate`,
      'POST',
      undefined,
      'Error desactivando el catálogo',
    );
  }

  // ── Campos ────────────────────────────────────────────────────────────────

  listFields(
    catalogId: string,
    params: {
      q?: string;
      field_type?: string;
      is_filterable?: boolean;
      is_visible?: boolean;
      page?: number;
      page_size?: number;
      order_by?: 'field_name' | 'created_at';
      order_dir?: 'asc' | 'desc';
    } = {},
  ): Promise<ListResponse<CatalogField>> {
    return this.http.get<ListResponse<CatalogField>>(
      `${BASE}/${catalogId}/fields${qs(params)}`,
    );
  }

  createField(
    catalogId: string,
    data: CreateCatalogFieldRequest,
  ): Promise<CatalogField> {
    return this.http.send<CatalogField>(
      `${BASE}/${catalogId}/fields`,
      'POST',
      { ...data, field_type: normalizeFieldType(data.field_type) },
      'Error creando el campo',
    );
  }

  updateField(
    catalogId: string,
    fieldId: string,
    data: UpdateCatalogFieldRequest,
  ): Promise<CatalogField> {
    const payload = data.field_type
      ? { ...data, field_type: normalizeFieldType(data.field_type) }
      : data;
    return this.http.send<CatalogField>(
      `${BASE}/${catalogId}/fields/${fieldId}`,
      'PUT',
      payload,
      'Error actualizando el campo',
    );
  }

  removeField(catalogId: string, fieldId: string): Promise<DeleteResponse> {
    return this.http.send<DeleteResponse>(
      `${BASE}/${catalogId}/fields/${fieldId}`,
      'DELETE',
      undefined,
      'Error eliminando el campo',
    );
  }

  // ── Valores de campo ──────────────────────────────────────────────────────

  listFieldValues(
    catalogId: string,
    fieldId: string,
    params: {
      q?: string;
      is_active?: boolean;
      page?: number;
      page_size?: number;
      order_by?: 'sort_index' | 'value';
      order_dir?: 'asc' | 'desc';
    } = {},
  ): Promise<ListResponse<CatalogFieldValue>> {
    return this.http.get<ListResponse<CatalogFieldValue>>(
      `${BASE}/${catalogId}/fields/${fieldId}/values${qs(params)}`,
    );
  }

}
