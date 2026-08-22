// Reglas de un plan de compensación y sus condiciones.
// Port de types/commissionRulesApi.ts + utils/commissionRulesApiClient.ts +
// types/conditionRulesApi.ts + utils/conditionRulesApiClient.ts + mappers.

import { Injectable, inject } from '@angular/core';
import { ComisionesHttp } from '../comisiones-http.service';
import { CommissionRule } from './commission-plans.api';

// ── Reglas ──────────────────────────────────────────────────────────────────

export interface ApiCommissionRule {
  id: string;
  commission_plan_id: string;
  name: string;
  description: string | null;
  formula: string;
  catalog: string;
  data_field: string | null;
  owner_name: string | null;
  is_active: boolean;
  created_at: string;
  plan_status?: string;
  plan_is_deleted?: boolean;
}

export interface CreateCommissionRuleRequest {
  name: string;
  description?: string;
  formula: string;
  catalog: string;
  date_field?: string;
  owner_name?: string;
  is_active?: boolean;
}

export interface CommissionRulesQueryParams {
  is_active?: boolean;
  catalog?: string[];
  owner_name?: string;
  search?: string;
  page?: number;
  page_size?: number;
  order_by?: 'name' | 'catalog' | 'is_active' | 'created_at';
  order_dir?: 'asc' | 'desc';
}

// ── Condiciones ─────────────────────────────────────────────────────────────

export type ValueType = 'column' | 'text';

export type ConditionOperator =
  | 'equal'
  | 'not_equal'
  | 'bigger_than'
  | 'greater_than'
  | 'bigger_or_equal'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'starts_with'
  | 'ends_with'
  | 'between';

export type LogicalOperator = 'AND' | 'OR';

export interface ApiConditionRule {
  id: string;
  commission_rule_id: string;
  field_name: string;
  operator: ConditionOperator;
  field_value: string;
  value_type: ValueType;
  logical_operator: LogicalOperator;
  group_level: number;
  condition_order: number;
  created_at: string;
}

export interface CreateConditionRuleRequest {
  field_name: string;
  operator: ConditionOperator;
  field_value: string;
  value_type: ValueType;
  logical_operator?: LogicalOperator;
  group_level?: number;
  condition_order?: number;
}

export type UpdateConditionRuleRequest = Partial<CreateConditionRuleRequest>;

export interface ConditionRulesQueryParams {
  page?: number;
  page_size?: number;
  order_by?:
    | 'created_at'
    | 'field_name'
    | 'operator'
    | 'group_level'
    | 'condition_order';
  order_dir?: 'asc' | 'desc';
}

export interface ListResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface DeleteResponse {
  deleted: boolean;
  id: string;
}

// ── Mappers ─────────────────────────────────────────────────────────────────

export function mapApiRuleToUI(api: ApiCommissionRule): CommissionRule {
  return {
    id: api.id,
    name: api.name,
    formula: api.formula,
    // Las condiciones llegan por su propio endpoint; la tabla las resuelve
    // fila por fila y por eso arranca vacío.
    conditions: '',
    catalog: api.catalog,
    description: api.description || undefined,
    owner: api.owner_name || undefined,
    dataField: api.data_field || undefined,
  };
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
export class CommissionRulesApi {
  private readonly http = inject(ComisionesHttp);

  // ── Reglas ────────────────────────────────────────────────────────────────

  list(
    planId: string,
    params: CommissionRulesQueryParams = {},
  ): Promise<ListResponse<ApiCommissionRule>> {
    const { catalog, ...resto } = params;
    let query = qs(resto as Record<string, string | number | boolean | undefined>);
    if (catalog?.length) {
      const extra = catalog.map((c) => `catalog=${encodeURIComponent(c)}`).join('&');
      query = query ? `${query}&${extra}` : `?${extra}`;
    }
    return this.http.get<ListResponse<ApiCommissionRule>>(
      `/api/commission-plans/${planId}/rules${query}`,
    );
  }

  create(
    planId: string,
    data: CreateCommissionRuleRequest,
  ): Promise<ApiCommissionRule> {
    return this.http.send<ApiCommissionRule>(
      `/api/commission-plans/${planId}/rules`,
      'POST',
      data,
      'Error creando la regla',
    );
  }

  getById(ruleId: string): Promise<ApiCommissionRule> {
    return this.http.get<ApiCommissionRule>(`/api/commission-rules/${ruleId}`);
  }

  update(
    ruleId: string,
    data: Partial<CreateCommissionRuleRequest>,
  ): Promise<ApiCommissionRule> {
    return this.http.send<ApiCommissionRule>(
      `/api/commission-rules/${ruleId}`,
      'PUT',
      data,
      'Error actualizando la regla',
    );
  }

  remove(ruleId: string): Promise<DeleteResponse> {
    return this.http.send<DeleteResponse>(
      `/api/commission-rules/${ruleId}`,
      'DELETE',
      undefined,
      'Error eliminando la regla',
    );
  }

  // ── Condiciones ───────────────────────────────────────────────────────────

  listConditions(
    ruleId: string,
    params: ConditionRulesQueryParams = {},
  ): Promise<ListResponse<ApiConditionRule>> {
    return this.http.get<ListResponse<ApiConditionRule>>(
      `/api/commission-rules/${ruleId}/conditions${qs(
        params as Record<string, string | number | boolean | undefined>,
      )}`,
    );
  }

  createCondition(
    ruleId: string,
    data: CreateConditionRuleRequest,
  ): Promise<ApiConditionRule> {
    return this.http.send<ApiConditionRule>(
      `/api/commission-rules/${ruleId}/conditions`,
      'POST',
      data,
      'Error creando la condición',
    );
  }

  updateCondition(
    ruleId: string,
    conditionId: string,
    data: UpdateConditionRuleRequest,
  ): Promise<ApiConditionRule> {
    return this.http.send<ApiConditionRule>(
      `/api/commission-rules/${ruleId}/conditions/${conditionId}`,
      'PUT',
      data,
      'Error actualizando la condición',
    );
  }

  removeCondition(ruleId: string, conditionId: string): Promise<DeleteResponse> {
    return this.http.send<DeleteResponse>(
      `/api/commission-rules/${ruleId}/conditions/${conditionId}`,
      'DELETE',
      undefined,
      'Error eliminando la condición',
    );
  }
}
