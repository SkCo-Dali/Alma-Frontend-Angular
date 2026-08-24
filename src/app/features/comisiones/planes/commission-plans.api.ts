// Planes de compensación: tipos de dominio y de API, mappers y cliente.

import { Injectable, inject } from '@angular/core';
import { ComisionesHttp } from '../comisiones-http.service';

const BASE = '/api/commission-plans';

// ── Dominio ─────────────────────────────────────────────────────────────────

export type CommissionPlanStatus =
  | 'published'
  | 'ready_to_approve'
  | 'draft'
  | 'rejected'
  | 'inactive';

export type AssignmentType = 'all_users' | 'user' | 'role' | 'team';

export interface CommissionRule {
  id: string;
  name: string;
  formula: string;
  conditions: string;
  catalog: string;
  description?: string;
  owner?: string;
  dataField?: string;
}

export interface CommissionPlan {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  assignmentType: AssignmentType;
  /** Id de usuario, nombre de rol o de equipo. */
  assignmentValue?: string;
  publishedOn?: string;
  status: CommissionPlanStatus;
  rules: CommissionRule[];
}

export const ALL_STATUSES: CommissionPlanStatus[] = [
  'published',
  'ready_to_approve',
  'draft',
  'rejected',
  'inactive',
];

export const STATUS_LABELS: Record<CommissionPlanStatus, string> = {
  published: 'Publicados',
  ready_to_approve: 'Listos para Aprobar',
  draft: 'Borradores',
  rejected: 'Rechazados',
  inactive: 'Inactivos',
};

export const ASSIGNMENT_LABELS: Record<AssignmentType, string> = {
  all_users: 'Todos los Usuarios',
  user: 'Usuario',
  role: 'Rol',
  team: 'Equipo',
};

export const ROLES_LIST = [
  'Administrador Comisiones',
  'Director Comercial - Agencias',
  'Director Comercial - Empleados',
  'Director Comercial - Seguros',
  'Empleados',
  'Empleados-Agente',
  'Gerente Comercial - Agencias',
  'Gerente Comercial - Empleados',
  'Gerente Comercial - Seguros',
  'Intermediario',
  'Intermediario - Agente AIS',
  'Intermediario - Aliado',
  'Intermediario - Promotor',
  'Skandia Administrator',
  'System Administrator',
  'Tradicional',
  'Tradicional - Agente Asociado',
  'Tradicional - Agente Socio',
];

// ── API ─────────────────────────────────────────────────────────────────────

export interface ApiCommissionPlan {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  assignment_type: AssignmentType;
  assignment_value?: string | null;
  status: CommissionPlanStatus;
  published_on?: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export interface ApiCommissionPlansListResponse {
  items: ApiCommissionPlan[];
  page: number;
  page_size: number;
  total: number;
}

export interface CreateCommissionPlanRequest {
  name: string;
  description: string;
  /** ISO: "2025-09-01T00:00:00" */
  start_date: string;
  end_date: string;
  assignment_type: AssignmentType;
  /** Solo cuando assignment_type es user, role o team. */
  assignment_value?: string;
}

export type UpdateCommissionPlanRequest = Partial<CreateCommissionPlanRequest>;

export interface DeleteCommissionPlanResponse {
  deleted: boolean;
  id: string;
}

// ── Mappers ─────────────────────────────────────────────────────────────────

export function mapApiPlanToUI(api: ApiCommissionPlan): CommissionPlan {
  return {
    id: api.id,
    name: api.name,
    description: api.description,
    startDate: api.start_date,
    endDate: api.end_date,
    assignmentType: api.assignment_type,
    assignmentValue: api.assignment_value || undefined,
    status: api.status,
    publishedOn: api.published_on || undefined,
    rules: [], // Las reglas se cargan aparte cuando se necesitan.
  };
}

/** Fecha para el API: inicio a las 00:00 y fin a las 23:59:59.999. */
export function formatDateForAPI(dateString: string, isEndDate = false): string {
  const date = new Date(dateString);
  if (isEndDate) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

// ── Cliente ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CommissionPlansApi {
  private readonly http = inject(ComisionesHttp);

  list(
    page = 1,
    pageSize = 20,
    status?: string,
  ): Promise<ApiCommissionPlansListResponse> {
    const qs = `?page=${page}&page_size=${pageSize}${status ? `&status=${status}` : ''}`;
    return this.http.get<ApiCommissionPlansListResponse>(`${BASE}${qs}`);
  }

  create(data: CreateCommissionPlanRequest): Promise<ApiCommissionPlan> {
    return this.http.send<ApiCommissionPlan>(
      BASE,
      'POST',
      data,
      'Error creando el plan de comisiones',
    );
  }

  update(id: string, data: UpdateCommissionPlanRequest): Promise<ApiCommissionPlan> {
    return this.http.send<ApiCommissionPlan>(
      `${BASE}/${id}`,
      'PUT',
      data,
      'Error actualizando el plan de comisiones',
    );
  }

  remove(id: string): Promise<DeleteCommissionPlanResponse> {
    return this.http.send<DeleteCommissionPlanResponse>(
      `${BASE}/${id}`,
      'DELETE',
      undefined,
      'Error eliminando el plan de comisiones',
    );
  }

  /** draft/rejected → ready_to_approve */
  sendToApproval(id: string): Promise<ApiCommissionPlan> {
    return this.http.send<ApiCommissionPlan>(
      `${BASE}/${id}/ready-to-approve`,
      'POST',
      undefined,
      'Error enviando el plan a aprobación',
    );
  }

  /** ready_to_approve → rejected */
  reject(id: string, reason?: string): Promise<ApiCommissionPlan> {
    return this.http.send<ApiCommissionPlan>(
      `${BASE}/${id}/reject`,
      'POST',
      reason ? { reason } : undefined,
      'Error rechazando el plan',
    );
  }

  /** draft/ready_to_approve → published */
  publish(id: string): Promise<ApiCommissionPlan> {
    return this.http.send<ApiCommissionPlan>(
      `${BASE}/${id}/publish`,
      'POST',
      undefined,
      'Error publicando el plan',
    );
  }

  /** published → inactive */
  inactivate(id: string, reason?: string): Promise<ApiCommissionPlan> {
    return this.http.send<ApiCommissionPlan>(
      `${BASE}/${id}/inactive`,
      'POST',
      reason ? { reason } : undefined,
      'Error inactivando el plan',
    );
  }
}
