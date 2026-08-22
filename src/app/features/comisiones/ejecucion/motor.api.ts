// Ejecución del motor: jobs de Databricks, pipeline de ingesta (ADF), tablas de
// resultado y distribución de correos. Port de types/motorApi.ts +
// utils/motorApiClient.ts + motorApiMapper.ts + motorTableHelpers.ts.

import { Injectable, inject } from '@angular/core';
import { ComisionesHttp } from '../comisiones-http.service';

const BASE = '/api/motor';

export const DEFAULT_MOTOR_PAGE_SIZE = 200;
export const MOTOR_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;

export interface MotorJob {
  job_id: number;
  orden: number;
  nombre: string;
  descripcion: string;
  url_databricks?: string;
}

export interface MotorJobEjecutarResponse {
  run_id: number;
  nombre: string;
}

export interface MotorJobEstadoResponse {
  estado: string;
  resultado?: string;
  terminado: boolean;
  mensaje?: string;
}

export interface MotorActiveJob {
  job_id: number;
  run_id: number;
  estado: string;
  inicio?: number;
}

export type MotorTableRow = Record<string, string | number | null>;

export interface ApiMotorTableResponse {
  page: number;
  page_size: number;
  columns?: string[];
  total?: number;
  pages?: number;
  total_records?: number;
  total_pages?: number;
  rows?: unknown[][];
  data?: MotorTableRow[];
}

export interface MotorTableResponse {
  page: number;
  total: number;
  pages: number;
  page_size: number;
  columns: string[];
  rows: unknown[][];
}

export interface MotorCompania {
  id: string;
  nombre: string;
}

export type MotorDataTab = 'pre' | 'post' | 'mant' | 'correos';
export type MotorTableTab = 'pre' | 'post' | 'mant';

// Columnas de respaldo cuando el API no manda `columns`.
export const MOTOR_PRE_COLUMNS = [
  'Periodo', 'CodigoCompania', 'NombreCompania', 'Producto', 'ContratoLargo',
  'ContratoCorto', 'IdTomador', 'NombreTomador', 'NumeroDocumentoTomador',
  'TipoDocumentoTomador', 'NumeroPrimasPagadasNumerico', 'ValorPrima',
  'ValorPagado', 'PrimaMayor2M', 'PrimaMayorTomador2M', 'FechaExpectativaPago',
  'Regla', 'TipoComision', 'ValorComision', 'ValorBase', 'CanalId',
  'CanalDescripcion', 'Id', 'IdTipoAgte', 'Nombre', 'IdSociedad',
  'NombreSociedad', 'CorreoSociedad', 'Clasificacion', 'ClasificacionEspecial',
  'IdTercero', 'AreaFiscal', 'SubgrupoFp',
];

export const MOTOR_POST_COLUMNS = [
  'Periodo', 'CodigoCompania', 'NombreCompania', 'Producto', 'ContratoLargo',
  'ContratoCorto', 'IdTomador', 'NombreTomador', 'NumeroDocumentoTomador',
  'TipoDocumentoTomador', 'Edad', 'FechaVinculacion',
  'NumeroPrimasPagadasNumerico', 'ValorPrima', 'ValorPagado',
  'FechaExpectativaPago', 'Regla', 'TipoComision', 'ValorComision',
  'ValorBase', 'CanalId', 'CanalDescripcion', 'Id', 'Nombre', 'IdSociedad',
  'NombreSociedad', 'Clasificacion', 'CorreoSociedad', 'IdPromotor',
  'Promotor', 'IdAliado', 'Aliado', 'WSaler', 'IdTercero', 'AreaFiscal',
];

export const MOTOR_MANT_COLUMNS = [
  'CodigoCompania', 'NombreCompania', 'Segmento', 'Tipo', 'Id', 'CanalId',
  'Producto', 'Regla_Negocio', 'Periodo', 'SaldoInicialMes', 'ComisionMes',
  'ComisionAcumulada', 'MontoLiberadoMes', 'MontoLiberadoAcumulado',
  'SaldoPendiente', 'FechaMovimiento', 'FechaProceso',
];

export const MOTOR_CORREOS_COLUMNS = [
  'Periodo', 'Segmento', 'IdTercero', 'NombreDestinatario', 'Correo',
  'CorreoOrigen', 'NombreArchivo', 'EstadoEnvio', 'IntentosEnvio',
  'IdMensaje', 'DetalleError', 'FechaEnvio',
];

export const MOTOR_TABLE_COLUMNS: Record<MotorDataTab, string[]> = {
  pre: MOTOR_PRE_COLUMNS,
  post: MOTOR_POST_COLUMNS,
  mant: MOTOR_MANT_COLUMNS,
  correos: MOTOR_CORREOS_COLUMNS,
};

/** Opciones fijas del filtro de compañía en las tablas de comisiones. */
export const MOTOR_COMPANY_FILTER_OPTIONS = [
  { label: 'Todas', value: 'Todas' },
  { label: 'Skandia Seguros de Vida S.A.', value: '137' },
  { label: 'Skandia Fiduciaria', value: '180' },
  { label: 'Skandia AFP', value: '194' },
];

export const MOTOR_ESTADO_CORREO_OPTIONS = ['Pendiente', 'Excluido', 'Enviado', 'Error'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const SEGMENTO_LABELS: Record<string, string> = {
  AIS_Promotor: 'Promotor',
  AIS_Aliado: 'Aliado',
};

/** El valor que se manda al API sigue siendo el original. */
export function formatMotorSegmentoLabel(segmento: string): string {
  return SEGMENTO_LABELS[segmento] ?? segmento.replace(/_/g, ' ');
}

/** 202503 → "Marzo 2025". */
export function formatMotorPeriodo(periodo: string | number): string {
  const v = String(periodo);
  if (v.length !== 6) return v;
  const idx = parseInt(v.slice(4), 10) - 1;
  return `${MESES[idx] ?? v.slice(4)} ${v.slice(0, 4)}`;
}

export function formatMotorCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/** Filas por posición → filas por nombre de columna. */
export function motorRowsToObjects(columns: string[], rows: unknown[][]): MotorTableRow[] {
  return rows.map((row) => {
    const record: MotorTableRow = {};
    columns.forEach((column, i) => {
      const cell = row[i];
      if (cell === null || cell === undefined) record[column] = null;
      else if (typeof cell === 'string' || typeof cell === 'number') record[column] = cell;
      else record[column] = String(cell);
    });
    return record;
  });
}

function numerico(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Ordena numéricamente cuando ambos valores son números; si no, alfabético es-CO. */
export function sortMotorRows(
  data: MotorTableRow[],
  key: string,
  direction: 'asc' | 'desc' | null,
): MotorTableRow[] {
  if (!key || !direction) return data;
  return [...data].sort((a, b) => {
    const na = numerico(a[key]);
    const nb = numerico(b[key]);
    if (na !== null && nb !== null) return direction === 'asc' ? na - nb : nb - na;
    const c = String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'es');
    return direction === 'asc' ? c : -c;
  });
}

interface ApiCompaniaRow {
  id?: string | number;
  nombre?: string;
  codigo?: string | number;
  CodigoCompania?: string | number;
  NombreCompania?: string;
  name?: string;
  label?: string;
  value?: string | number;
}

/** El API ha devuelto esta lista con varias formas; se aceptan todas. */
export function mapMotorCompanias(source: unknown): MotorCompania[] {
  if (!Array.isArray(source)) return [];
  return source
    .map((raw, index): MotorCompania | null => {
      if (typeof raw === 'string' || typeof raw === 'number') {
        const id = String(raw);
        return { id, nombre: id };
      }
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const row = raw as ApiCompaniaRow;
      const id = String(row.id ?? row.codigo ?? row.CodigoCompania ?? row.value ?? index);
      const nombre = String(
        row.nombre ?? row.NombreCompania ?? row.name ?? row.label ?? id,
      ).trim();
      if (!id || !nombre) return null;
      return { id, nombre };
    })
    .filter((x): x is MotorCompania => x !== null);
}

/** Normaliza paginación, columnas y filas (que pueden venir como objetos). */
export function mapMotorTableResponse(
  res: ApiMotorTableResponse,
  tab: MotorDataTab,
): MotorTableResponse {
  const columns = res.columns?.length ? res.columns : [...MOTOR_TABLE_COLUMNS[tab]];
  const crudas = res.rows ?? res.data ?? [];
  const rows = Array.isArray(crudas)
    ? crudas.map((row) => {
        if (Array.isArray(row)) return row;
        if (row && typeof row === 'object') {
          const r = row as MotorTableRow;
          return columns.map((c) => r[c] ?? null);
        }
        return [];
      })
    : [];

  return {
    page: res.page,
    page_size: res.page_size,
    total: res.total ?? res.total_records ?? rows.length,
    pages: res.pages ?? res.total_pages ?? 1,
    columns,
    rows,
  };
}

export interface MotorTableQueryParams {
  page: number;
  page_size: number;
  compania?: string;
  periodo?: string;
  search?: string;
}

export interface MotorCorreosQueryParams {
  page: number;
  page_size: number;
  periodo?: string;
  segmento?: string;
  estado?: string;
  search?: string;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

@Injectable({ providedIn: 'root' })
export class MotorApi {
  private readonly http = inject(ComisionesHttp);

  getJobs(): Promise<MotorJob[]> {
    return this.http.get<MotorJob[]>(`${BASE}/jobs`);
  }

  getActiveJobs(): Promise<MotorActiveJob[]> {
    return this.http.get<MotorActiveJob[]>(`${BASE}/jobs/activos`);
  }

  ejecutarJob(jobId: number): Promise<MotorJobEjecutarResponse> {
    return this.http.send<MotorJobEjecutarResponse>(
      `${BASE}/jobs/ejecutar`,
      'POST',
      { job_id: jobId },
      'No se pudo iniciar el job',
    );
  }

  getJobEstado(runId: number): Promise<MotorJobEstadoResponse> {
    return this.http.get<MotorJobEstadoResponse>(`${BASE}/jobs/estado/${runId}`);
  }

  cancelarJob(runId: number): Promise<void> {
    return this.http.send<void>(
      `${BASE}/jobs/cancelar/${runId}`,
      'POST',
      undefined,
      'No se pudo cancelar la ejecución',
    );
  }

  /** Dispara el pipeline de ingesta (SQL Server → Databricks vía ADF). */
  ejecutarIngesta(): Promise<void> {
    return this.http.send<void>(
      `${BASE}/ingesta/ejecutar`,
      'POST',
      undefined,
      'No se pudo iniciar el pipeline de ingesta',
    );
  }

  async getFiltrosCompanias(): Promise<MotorCompania[]> {
    const res = await this.http.get<{ companias?: unknown }>(`${BASE}/filtros/companias`);
    return mapMotorCompanias(res.companias);
  }

  async getFiltrosRoles(): Promise<string[]> {
    const res = await this.http.get<{ roles?: string[] }>(`${BASE}/filtros/roles`);
    return res.roles ?? [];
  }

  async getFiltrosPeriodos(tabla: MotorDataTab): Promise<string[]> {
    const res = await this.http.get<{ periodos?: string[] }>(
      `${BASE}/filtros/periodos?tabla=${tabla}`,
    );
    return res.periodos ?? [];
  }

  async getTabla(
    tab: MotorTableTab,
    params: MotorTableQueryParams,
  ): Promise<MotorTableResponse> {
    const res = await this.http.get<ApiMotorTableResponse>(
      `${BASE}/tablas/${tab}${qs({ ...params })}`,
    );
    return mapMotorTableResponse(res, tab);
  }

  async getCorreos(params: MotorCorreosQueryParams): Promise<MotorTableResponse> {
    const res = await this.http.get<ApiMotorTableResponse>(
      `${BASE}/correos${qs({ ...params })}`,
    );
    return mapMotorTableResponse(res, 'correos');
  }

  /** El Excel se genera con los filtros aplicados, sin paginación ni búsqueda. */
  exportTabla(
    tab: MotorTableTab,
    params: { compania?: string; periodo?: string },
    fallbackFilename: string,
  ): Promise<void> {
    return this.http.descargar(
      `${BASE}/tablas/${tab}/exportar${qs({ ...params })}`,
      fallbackFilename,
    );
  }

  exportCorreos(
    params: { periodo?: string; segmento?: string; estado?: string },
    fallbackFilename: string,
  ): Promise<void> {
    return this.http.descargar(`${BASE}/correos/exportar${qs({ ...params })}`, fallbackFilename);
  }

  editarCorreo(data: {
    periodo: number;
    segmento: string;
    nombre_archivo: string;
    correo: string;
    nombre_destinatario: string;
  }): Promise<void> {
    return this.http.send<void>(
      `${BASE}/correos/editar`,
      'PATCH',
      data,
      'Error al editar correo',
    );
  }

  excluirCorreo(data: {
    periodo: number;
    segmento: string;
    nombre_archivo: string;
  }): Promise<void> {
    return this.http.send<void>(
      `${BASE}/correos/excluir`,
      'POST',
      data,
      'Error al excluir correo',
    );
  }
}
