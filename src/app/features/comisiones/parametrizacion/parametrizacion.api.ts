// Clientes de las 8 entidades de Parametrización, con sus mapeos API↔UI.
//
// Detalles del contrato que NO se pueden cambiar sin tocar el backend:
// - El listado siempre pagina con un tamaño fijo por entidad (200, y 500 en
//   diferidos) y la UI necesita todos los registros, así que se traen todas las
//   páginas: la 1 primero (da el total) y el resto en paralelo. Diferidos va
//   secuencial con 200 ms entre páginas porque el servicio responde 429.
// - Los porcentajes viajan como fracción (0.25) y se muestran como 25%: se
//   divide entre 100 al escribir y la vista multiplica al mostrar.
// - Diferidos y casos especiales no siempre traen id: se arma uno compuesto.

import { Injectable, inject } from '@angular/core';
import { ComisionesHttp } from '../comisiones-http.service';
import {
  AccountingCategory,
  AccountingRecord,
  AutonomousPatrimonyRecord,
  CATEGORY_TO_COMPANY_CODE,
  COMPANY_CODE_TO_CATEGORY,
  COMPANY_CODE_TO_NAME,
  CarbonBondRecord,
  CommissionConfigRecord,
  CommissionTypeRecord,
  DeferredPercentageRecord,
  DeferredRecord,
  SpecialCaseRecord,
  aFechaUI,
  aIsoFecha,
} from './parametrizacion.domain';

interface ListResponse<T> {
  items: T[];
  page?: number;
  page_size?: number;
  total?: number;
}

const PAGE_SIZE = 200;
const PAGE_SIZE_DIFERIDOS = 500;

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

@Injectable({ providedIn: 'root' })
export class ParametrizacionApi {
  private readonly http = inject(ComisionesHttp);

  /** Página 1 (da el total) y el resto en paralelo. */
  private async traerTodo<T>(
    path: string,
    pageSize: number,
    extra: Record<string, string | number | boolean | undefined> = {},
  ): Promise<T[]> {
    const primera = await this.http.get<ListResponse<T>>(
      `${path}${qs({ page: 1, page_size: pageSize, ...extra })}`,
    );
    let todos = [...(primera.items ?? [])];
    const total = primera.total ?? todos.length;
    const paginas = Math.ceil(total / pageSize);
    if (paginas > 1) {
      const restantes = await Promise.all(
        Array.from({ length: paginas - 1 }, (_, i) =>
          this.http.get<ListResponse<T>>(
            `${path}${qs({ page: i + 2, page_size: pageSize, ...extra })}`,
          ),
        ),
      );
      for (const r of restantes) todos = [...todos, ...(r.items ?? [])];
    }
    return todos;
  }

  // ── 1. Contabilidad ───────────────────────────────────────────────────────

  async listAccounting(product?: string): Promise<AccountingRecord[]> {
    const items = await this.traerTodo<ApiAccountingRecord>(
      '/api/commission-accounting',
      PAGE_SIZE,
      { product },
    );
    return items.map(mapAccounting);
  }

  createAccounting(data: Partial<AccountingRecord>): Promise<ApiAccountingRecord> {
    return this.http.send<ApiAccountingRecord>(
      '/api/commission-accounting',
      'POST',
      toAccountingRequest(data),
      'Error creando el registro contable',
    );
  }

  updateAccounting(
    id: string,
    data: Partial<AccountingRecord>,
  ): Promise<ApiAccountingRecord> {
    return this.http.send<ApiAccountingRecord>(
      `/api/commission-accounting/${id}`,
      'PUT',
      toAccountingRequest(data),
      'Error actualizando el registro contable',
    );
  }

  deleteAccounting(id: string): Promise<void> {
    return this.http.send<void>(
      `/api/commission-accounting/${id}`,
      'DELETE',
      undefined,
      'Error eliminando el registro contable',
    );
  }

  toggleAccounting(id: string, isActive: boolean): Promise<unknown> {
    return this.http.send(
      `/api/commission-accounting/${id}/toggle-active`,
      'POST',
      { is_active: isActive },
      'Error cambiando el estado del registro',
    );
  }

  // ── 2. Tipos de comisión ──────────────────────────────────────────────────

  async listCommissionTypes(): Promise<CommissionTypeRecord[]> {
    const items = await this.traerTodo<ApiCommissionType>(
      '/api/commission-types',
      PAGE_SIZE,
    );
    return items.map(mapCommissionType);
  }

  createCommissionType(data: Partial<CommissionTypeRecord>): Promise<ApiCommissionType> {
    return this.http.send<ApiCommissionType>(
      '/api/commission-types',
      'POST',
      toCommissionTypeRequest(data),
      'Error creando el tipo de comisión',
    );
  }

  updateCommissionType(
    id: string,
    data: Partial<CommissionTypeRecord>,
  ): Promise<ApiCommissionType> {
    return this.http.send<ApiCommissionType>(
      `/api/commission-types/${id}`,
      'PUT',
      toCommissionTypeRequest(data),
      'Error actualizando el tipo de comisión',
    );
  }

  deleteCommissionType(id: string): Promise<void> {
    return this.http.send<void>(
      `/api/commission-types/${id}`,
      'DELETE',
      undefined,
      'Error eliminando el tipo de comisión',
    );
  }

  toggleCommissionType(id: string, isActive: boolean): Promise<unknown> {
    return this.http.send(
      `/api/commission-types/${id}/toggle-active`,
      'POST',
      { is_active: isActive },
      'Error cambiando el estado del tipo de comisión',
    );
  }

  // ── 3. Diferidos (solo lectura) ───────────────────────────────────────────

  /** Secuencial con pausa: el servicio responde 429 si se pide en paralelo. */
  async listDeferred(desde?: string, hasta?: string): Promise<DeferredRecord[]> {
    const params = { updated_from: desde, updated_to: hasta };
    const primera = await this.http.get<ApiDeferredListResponse>(
      `/api/deferred-delta${qs({ page: 1, page_size: PAGE_SIZE_DIFERIDOS, ...params })}`,
    );
    let todos = [...(primera.data ?? [])];
    const paginas = primera.total_pages ?? 1;
    for (let p = 2; p <= paginas; p++) {
      await new Promise((r) => setTimeout(r, 200));
      const res = await this.http.get<ApiDeferredListResponse>(
        `/api/deferred-delta${qs({ page: p, page_size: PAGE_SIZE_DIFERIDOS, ...params })}`,
      );
      todos = [...todos, ...(res.data ?? [])];
    }
    return todos.map(mapDeferred);
  }

  // ── 4. Diferidos paramétrico ──────────────────────────────────────────────

  async listDeferredParameters(): Promise<DeferredPercentageRecord[]> {
    const items = await this.traerTodo<ApiDeferredParameter>(
      '/api/deferred-parameters',
      PAGE_SIZE,
    );
    return items.map(mapDeferredParameter);
  }

  createDeferredParameter(
    data: Partial<DeferredPercentageRecord>,
  ): Promise<ApiDeferredParameter> {
    return this.http.send<ApiDeferredParameter>(
      '/api/deferred-parameters',
      'POST',
      toDeferredParameterRequest(data),
      'Error creando el diferido paramétrico',
    );
  }

  updateDeferredParameter(
    id: string,
    data: Partial<DeferredPercentageRecord>,
  ): Promise<ApiDeferredParameter> {
    return this.http.send<ApiDeferredParameter>(
      `/api/deferred-parameters/${id}`,
      'PUT',
      toDeferredParameterRequest(data),
      'Error actualizando el diferido paramétrico',
    );
  }

  deleteDeferredParameter(id: string): Promise<void> {
    return this.http.send<void>(
      `/api/deferred-parameters/${id}`,
      'DELETE',
      undefined,
      'Error eliminando el diferido paramétrico',
    );
  }

  toggleDeferredParameter(id: string, isActive: boolean): Promise<unknown> {
    return this.http.send(
      `/api/deferred-parameters/${id}/toggle-active`,
      'POST',
      { is_active: isActive },
      'Error cambiando el estado del diferido paramétrico',
    );
  }

  // ── 5. Config. Contrato (bonos de carbono) ────────────────────────────────

  async listContractConfig(): Promise<CarbonBondRecord[]> {
    const items = await this.traerTodo<ApiContractConfig>(
      '/api/contract-config',
      PAGE_SIZE,
    );
    return items.map(mapContractConfig);
  }

  createContractConfig(data: Partial<CarbonBondRecord>): Promise<ApiContractConfig> {
    return this.http.send<ApiContractConfig>(
      '/api/contract-config',
      'POST',
      toContractConfigRequest(data),
      'Error creando la configuración de contrato',
    );
  }

  updateContractConfig(
    id: string,
    data: Partial<CarbonBondRecord>,
  ): Promise<ApiContractConfig> {
    return this.http.send<ApiContractConfig>(
      `/api/contract-config/${id}`,
      'PUT',
      toContractConfigRequest(data),
      'Error actualizando la configuración de contrato',
    );
  }

  deleteContractConfig(id: string): Promise<void> {
    return this.http.send<void>(
      `/api/contract-config/${id}`,
      'DELETE',
      undefined,
      'Error eliminando la configuración de contrato',
    );
  }

  toggleContractConfig(id: string, isActive: boolean): Promise<unknown> {
    return this.http.send(
      `/api/contract-config/${id}/toggle-active`,
      'POST',
      { is_active: isActive },
      'Error cambiando el estado de la configuración',
    );
  }

  // ── 6. Config. Producto (patrimonios autónomos) ───────────────────────────

  async listProductConfig(product?: string): Promise<AutonomousPatrimonyRecord[]> {
    const items = await this.traerTodo<ApiProductConfig>('/api/product-config', PAGE_SIZE, {
      product,
    });
    return items.map(mapProductConfig);
  }

  createProductConfig(
    data: Partial<AutonomousPatrimonyRecord>,
  ): Promise<ApiProductConfig> {
    return this.http.send<ApiProductConfig>(
      '/api/product-config',
      'POST',
      toProductConfigRequest(data),
      'Error creando la configuración de producto',
    );
  }

  updateProductConfig(
    id: string,
    data: Partial<AutonomousPatrimonyRecord>,
  ): Promise<ApiProductConfig> {
    return this.http.send<ApiProductConfig>(
      `/api/product-config/${id}`,
      'PUT',
      toProductConfigRequest(data),
      'Error actualizando la configuración de producto',
    );
  }

  deleteProductConfig(id: string): Promise<void> {
    return this.http.send<void>(
      `/api/product-config/${id}`,
      'DELETE',
      undefined,
      'Error eliminando la configuración de producto',
    );
  }

  toggleProductConfig(id: string, isActive: boolean): Promise<unknown> {
    return this.http.send(
      `/api/product-config/${id}/toggle-active`,
      'POST',
      { is_active: isActive },
      'Error cambiando el estado de la configuración',
    );
  }

  // ── 7. Ajustes de comisiones ──────────────────────────────────────────────

  async listCommissionAdjustments(): Promise<CommissionConfigRecord[]> {
    const items = await this.traerTodo<ApiCommissionAdjustment>(
      '/api/commission-adjustments',
      PAGE_SIZE,
    );
    return items.map(mapCommissionAdjustment);
  }

  createCommissionAdjustment(
    data: CommissionConfigRecord,
  ): Promise<ApiCommissionAdjustment> {
    return this.http.send<ApiCommissionAdjustment>(
      '/api/commission-adjustments',
      'POST',
      toCommissionAdjustmentRequest(data),
      'Error creando el ajuste de comisión',
    );
  }

  updateCommissionAdjustment(
    id: string,
    data: CommissionConfigRecord,
  ): Promise<ApiCommissionAdjustment> {
    return this.http.send<ApiCommissionAdjustment>(
      `/api/commission-adjustments/${id}`,
      'PUT',
      toCommissionAdjustmentRequest(data),
      'Error actualizando el ajuste de comisión',
    );
  }

  deleteCommissionAdjustment(id: string): Promise<void> {
    return this.http.send<void>(
      `/api/commission-adjustments/${id}`,
      'DELETE',
      undefined,
      'Error eliminando el ajuste de comisión',
    );
  }

  toggleCommissionAdjustment(id: string, isActive: boolean): Promise<unknown> {
    return this.http.send(
      `/api/commission-adjustments/${id}/toggle-active`,
      'POST',
      { is_active: isActive },
      'Error cambiando el estado del ajuste',
    );
  }

  // ── 8. Casos especiales ───────────────────────────────────────────────────

  /** El listado puede llegar como arreglo plano o como {items}. */
  async listSpecialCases(): Promise<SpecialCaseRecord[]> {
    const primera = await this.http.get<ApiSpecialCase[] | ListResponse<ApiSpecialCase>>(
      `/api/special-cases${qs({ page: 1, page_size: PAGE_SIZE })}`,
    );
    const normalizar = (
      res: ApiSpecialCase[] | ListResponse<ApiSpecialCase>,
    ): { items: ApiSpecialCase[]; total: number } =>
      Array.isArray(res)
        ? { items: res, total: res.length }
        : { items: res.items ?? [], total: res.total ?? res.items?.length ?? 0 };

    const { items, total } = normalizar(primera);
    let todos = [...items];
    const paginas = Math.ceil(total / PAGE_SIZE);
    if (paginas > 1) {
      const restantes = await Promise.all(
        Array.from({ length: paginas - 1 }, (_, i) =>
          this.http.get<ApiSpecialCase[] | ListResponse<ApiSpecialCase>>(
            `/api/special-cases${qs({ page: i + 2, page_size: PAGE_SIZE })}`,
          ),
        ),
      );
      for (const r of restantes) todos = [...todos, ...normalizar(r).items];
    }
    return todos.map(mapSpecialCase);
  }

  createSpecialCase(data: Partial<SpecialCaseRecord>): Promise<ApiSpecialCase> {
    return this.http.send<ApiSpecialCase>(
      '/api/special-cases',
      'POST',
      toSpecialCaseRequest(data),
      'Error creando el caso especial',
    );
  }

  updateSpecialCase(
    id: string,
    data: Partial<SpecialCaseRecord>,
  ): Promise<ApiSpecialCase> {
    return this.http.send<ApiSpecialCase>(
      `/api/special-cases/${id}`,
      'PUT',
      toSpecialCaseRequest(data),
      'Error actualizando el caso especial',
    );
  }

  deleteSpecialCase(id: string): Promise<void> {
    return this.http.send<void>(
      `/api/special-cases/${id}`,
      'DELETE',
      undefined,
      'Error eliminando el caso especial',
    );
  }

  toggleSpecialCase(id: string, isActive: boolean): Promise<unknown> {
    return this.http.send(
      `/api/special-cases/${id}/toggle-active`,
      'POST',
      { is_active: isActive },
      'Error cambiando el estado del caso especial',
    );
  }
}

// ── Formas del API y mapeos ─────────────────────────────────────────────────

export interface ApiAccountingRecord {
  id: string;
  company_code: string;
  company_name: string;
  product: string;
  commission_type_id: string;
  commission_type: string;
  channel_code: string;
  channel: string;
  business_unit: string;
  gl_account: string;
  subaccount: string;
  ap_business_unit: string;
  ap_gl_account: string;
  ap_subaccount: string;
  is_active: boolean;
  updated_at: string;
}

const GUID_VACIO = '00000000-0000-0000-0000-000000000000';

function categoriaDe(code: unknown): AccountingCategory {
  return COMPANY_CODE_TO_CATEGORY[Number(code)] ?? 'seguros';
}

/** En contabilidad la categoría se deduce del NOMBRE de la compañía. */
function categoriaPorNombre(nombre: string): AccountingCategory {
  const n = (nombre || '').toLowerCase();
  if (n.includes('fiduciaria')) return 'fiduciaria';
  if (
    n.includes('pension') ||
    n.includes('afp') ||
    n.includes('porvenir') ||
    n.includes('protección') ||
    n.includes('colfondos') ||
    n.includes('old mutual')
  ) {
    return 'pensiones_obligatorias';
  }
  return 'seguros';
}

function mapAccounting(api: ApiAccountingRecord): AccountingRecord {
  return {
    id: api.id,
    CodigoCompania: Number(api.company_code) || 0,
    NombreCompania: api.company_name,
    Producto: api.product,
    TipoComision: api.commission_type,
    TipoComisionId: api.commission_type_id,
    Canal: api.channel,
    CanalCode: Number(api.channel_code) || 0,
    UnidadNegocio: Number(api.business_unit) || 0,
    CuentaContable: Number(api.gl_account) || 0,
    Subcuenta: api.subaccount,
    UnidadNegocioCuentaPorPagar: Number(api.ap_business_unit) || 0,
    CuentaContableCuentaPorPagar: Number(api.ap_gl_account) || 0,
    SubcuentaCuentaPorPagar: api.ap_subaccount,
    EsActivo: api.is_active,
    UpdatedOn: api.updated_at,
    category: categoriaPorNombre(api.company_name),
  };
}

/** Todo va como string; el canal cae al nombre si no hay código. */
function toAccountingRequest(r: Partial<AccountingRecord>) {
  const code =
    r.CodigoCompania ||
    (r.category ? CATEGORY_TO_COMPANY_CODE[r.category] : CATEGORY_TO_COMPANY_CODE.seguros);
  return {
    company_code: String(code ?? ''),
    company_name: r.NombreCompania ?? '',
    product: r.Producto ?? '',
    commission_type_id: r.TipoComisionId || GUID_VACIO,
    commission_type: r.TipoComision ?? '',
    channel_code: r.CanalCode ? String(r.CanalCode) : (r.Canal ?? ''),
    channel: r.Canal ?? '',
    business_unit: r.UnidadNegocio !== undefined ? String(r.UnidadNegocio) : '',
    gl_account: r.CuentaContable !== undefined ? String(r.CuentaContable) : '',
    subaccount: r.Subcuenta ?? '',
    ap_business_unit:
      r.UnidadNegocioCuentaPorPagar !== undefined
        ? String(r.UnidadNegocioCuentaPorPagar)
        : '',
    ap_gl_account:
      r.CuentaContableCuentaPorPagar !== undefined
        ? String(r.CuentaContableCuentaPorPagar)
        : '',
    ap_subaccount: r.SubcuentaCuentaPorPagar ?? '',
    is_active: r.EsActivo ?? true,
  };
}

export interface ApiCommissionType {
  id: string;
  company_code: string;
  company_name: string;
  commission_type: string;
  commission_type_id: number;
  channel_code: string;
  channel: string;
  abbreviation: string;
  product_name: string;
  accounting_name: string;
  is_active: boolean;
  updated_at: string;
}

function mapCommissionType(api: ApiCommissionType): CommissionTypeRecord {
  const code = Number(api.company_code) || 0;
  return {
    id: api.id,
    TipoComision: api.commission_type,
    // El servicio no devuelve el GUID original del plan.
    TipoComisionId: '',
    IDTipoComision: api.commission_type_id,
    Canal: api.channel,
    CanalCode: Number(api.channel_code) || 0,
    Abreviacion: api.abbreviation,
    Producto: api.product_name,
    NombreContabilidad: api.accounting_name,
    CodigoCompania: code,
    NombreCompania: api.company_name || COMPANY_CODE_TO_NAME[code] || String(code),
    EsActivo: Boolean(api.is_active),
    UpdatedOn: api.updated_at,
    category: categoriaDe(code),
  };
}

function toCommissionTypeRequest(r: Partial<CommissionTypeRecord>) {
  const code =
    r.CodigoCompania ||
    (r.category ? CATEGORY_TO_COMPANY_CODE[r.category] : CATEGORY_TO_COMPANY_CODE.seguros);
  return {
    company_code: String(code),
    company_name: r.NombreCompania ?? '',
    commission_type: r.TipoComision ?? '',
    commission_type_id: r.IDTipoComision ?? 0,
    channel_code: String(r.CanalCode ?? 0),
    channel: r.Canal ?? '',
    abbreviation: r.Abreviacion ?? '',
    product_name: r.Producto ?? '',
    accounting_name: r.NombreContabilidad ?? '',
    is_active: r.EsActivo ?? true,
  };
}

interface ApiDeferredRecord {
  contratocorto: number;
  clasificacion: string | null;
  tramo: number;
  canalid: number;
  tipocomision: number;
  pagado: number | boolean;
  fechapago: string | null;
  fechaactivacion: string | null;
  estadodiferido: number;
  descripcionestadodiferido: string;
  valorcomision: number;
}

interface ApiDeferredListResponse {
  data?: ApiDeferredRecord[];
  page?: number;
  page_size?: number;
  total_records?: number;
  total_pages?: number;
}

function mapDeferred(api: ApiDeferredRecord): DeferredRecord {
  return {
    // El API no trae id; se compone uno estable con las tres claves del diferido.
    id: `${api.contratocorto}-${api.tramo}-${api.tipocomision}`,
    ContratoCorto: api.contratocorto,
    Clasificacion: api.clasificacion,
    Tramo: api.tramo,
    CanalId: api.canalid,
    TipoComision: api.tipocomision,
    Pagado: Boolean(api.pagado),
    FechaPago: api.fechapago || '',
    FechaActivacion: api.fechaactivacion || '',
    EstadoDiferido: api.estadodiferido,
    DescripcionEstadoDiferido: api.descripcionestadodiferido,
    ValorComision: api.valorcomision,
    UpdatedOn: api.fechaactivacion || '',
  };
}

interface ApiDeferredParameter {
  id: string;
  company_name?: string;
  company_code?: string | number;
  classification: string;
  tranche: number;
  deferred_percentage: number;
  channel_id: number;
  status: string;
  status_description: string;
  activation_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapDeferredParameter(api: ApiDeferredParameter): DeferredPercentageRecord {
  return {
    id: api.id,
    company_name: api.company_name,
    company_code: api.company_code !== undefined ? Number(api.company_code) : undefined,
    clasificacion: api.classification,
    tramo: api.tranche,
    porcentaje_diferido: api.deferred_percentage,
    canal_id: api.channel_id,
    estado: api.status,
    descripcion_estado: api.status_description,
    fecha_activacion: api.activation_date,
    activo: api.is_active,
    fecha_creacion: api.created_at,
    fecha_actualizacion: api.updated_at,
  };
}

function toDeferredParameterRequest(r: Partial<DeferredPercentageRecord>) {
  return {
    company_name: r.company_name,
    company_code: r.company_code !== undefined ? String(r.company_code) : undefined,
    classification: r.clasificacion ?? '',
    tranche: r.tramo ?? 0,
    // El API guarda fracción.
    deferred_percentage: (r.porcentaje_diferido ?? 0) / 100,
    channel_id: r.canal_id ?? 0,
    status: r.estado ?? '',
    status_description: r.descripcion_estado ?? '',
    activation_date: r.fecha_activacion ?? '',
    is_active: r.activo ?? true,
  };
}

interface ApiContractConfig {
  id: string;
  long_contract: string;
  until_percentage: number;
  greater_percentage: number;
  is_active: boolean;
  updated_at: string;
}

function mapContractConfig(api: ApiContractConfig): CarbonBondRecord {
  return {
    id: api.id,
    ContratoLargo: api.long_contract ?? '',
    Hasta: Number(api.until_percentage) || 0,
    Mayor: Number(api.greater_percentage) || 0,
    Activo: Boolean(api.is_active),
    UpdatedOn: api.updated_at ?? '',
  };
}

function toContractConfigRequest(r: Partial<CarbonBondRecord>) {
  return {
    long_contract: r.ContratoLargo ?? '',
    until_percentage: (r.Hasta ?? 0) / 100,
    greater_percentage: (r.Mayor ?? 0) / 100,
    is_active: r.Activo ?? true,
  };
}

interface ApiProductConfig {
  id: string;
  product: string;
  amount_from: number;
  amount_until?: number | null;
  amount_to?: number | null;
  ea_percentage: number;
  is_active: boolean;
  fecha_creacion: string;
  creado_por: string;
  updated_at: string;
  actualizado_por: string | null;
  eliminado: boolean;
}

function mapProductConfig(api: ApiProductConfig): AutonomousPatrimonyRecord {
  return {
    id: api.id,
    Producto: api.product,
    Desde: api.amount_from,
    // El servicio ha usado los dos nombres para el tope.
    Hasta: api.amount_to !== undefined ? api.amount_to : (api.amount_until ?? null),
    PorcentajeEA: api.ea_percentage,
    Activo: api.is_active,
    CreatedAt: api.fecha_creacion,
    CreatedBy: api.creado_por,
    UpdatedAt: api.updated_at,
    UpdatedBy: api.actualizado_por,
    IsDeleted: api.eliminado,
  };
}

function toProductConfigRequest(r: Partial<AutonomousPatrimonyRecord>) {
  return {
    product: r.Producto ?? '',
    amount_from: r.Desde ?? 0,
    amount_to: r.Hasta ?? null,
    ea_percentage: (r.PorcentajeEA ?? 0) / 100,
    is_active: r.Activo ?? true,
  };
}

type ApiCommissionAdjustment = Omit<CommissionConfigRecord, 'id'> & { id: string };

function mapCommissionAdjustment(api: ApiCommissionAdjustment): CommissionConfigRecord {
  return {
    ...api,
    // El API la manda en yyyy-MM-dd; la UI la muestra en dd/MM/yyyy.
    expected_payment_date: aFechaUI(api.expected_payment_date),
  };
}

function toCommissionAdjustmentRequest(r: CommissionConfigRecord) {
  return {
    ...r,
    expected_payment_date: aIsoFecha(r.expected_payment_date),
  };
}

interface ApiSpecialCase {
  id?: string;
  special_case_id?: string;
  agent_id: number | string;
  company_code: number | string;
  company_name: string;
  society_id: number | string;
  special_classification: string;
  is_active: boolean;
  updated_at: string;
}

function mapSpecialCase(api: ApiSpecialCase): SpecialCaseRecord {
  return {
    id:
      api.special_case_id ??
      api.id ??
      `${api.agent_id}-${api.company_code}-${api.society_id}-${api.special_classification}`,
    NombreCompania: api.company_name,
    CodigoCompania: Number(api.company_code) || 0,
    IdAgte: Number(api.agent_id) || 0,
    IdSociedad: Number(api.society_id) || 0,
    ClasificacionEspecial: api.special_classification,
    Activo: api.is_active,
    UltimaActualizacion: api.updated_at,
  };
}

function toSpecialCaseRequest(r: Partial<SpecialCaseRecord>) {
  return {
    agent_id: Number(r.IdAgte) || 0,
    company_code: String(Number(r.CodigoCompania) || 0),
    company_name: r.NombreCompania ?? '',
    society_id: Number(r.IdSociedad) || 0,
    special_classification: r.ClasificacionEspecial ?? '',
    is_active: r.Activo ?? true,
  };
}
