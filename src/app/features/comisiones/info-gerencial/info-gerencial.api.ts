// Métricas y Reportes: /api/performance (filtros, métricas, comisiones y Excel) y
// /api/reports (8 reportes con su Excel).

import { Injectable, inject } from '@angular/core';
import { ComisionesHttp } from '../comisiones-http.service';

const PERFORMANCE = '/api/performance';
const REPORTS = '/api/reports';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 300, 400, 500] as const;
export const DEFAULT_PAGE_SIZE = 200;

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  periods: FilterOption[];
  channels: FilterOption[];
  companies: FilterOption[];
  products: FilterOption[];
}

export const EMPTY_FILTER_OPTIONS: FilterOptions = {
  periods: [],
  channels: [],
  companies: [],
  products: [],
};

export interface InfoGerencialFilters {
  period: string;
  channel: string;
  company: string;
  product: string;
}

export const DEFAULT_FILTERS: InfoGerencialFilters = {
  period: 'all',
  channel: 'all',
  company: 'all',
  product: 'all',
};

export interface ApiMetricItem {
  key: string;
  total: number;
}

export interface ApiSeriePeriodoItem {
  periodo: string;
  total: number;
}

export interface ApiMetricsResponse {
  periodo_seleccionado: string;
  total_comisiones: number;
  total_registros: number;
  por_canal: ApiMetricItem[];
  por_producto: ApiMetricItem[];
  por_regla: ApiMetricItem[];
  serie_periodo: ApiSeriePeriodoItem[];
}

export type TableRow = Record<string, string | number | null>;

export interface ApiTableResponse {
  periodo_seleccionado: string | null;
  total_comisiones: number;
  columns: string[];
  page: number;
  page_size: number;
  total_records: number;
  total_pages: number;
  data: TableRow[];
  label?: string;
}

export const REPORT_TYPES = [
  { value: 'reporte_contabilidad', label: 'Reporte contabilidad', endpoint: 'contabilidad' },
  { value: 'contabilidad_agentes', label: 'Contabilidad Agentes', endpoint: 'contabilidad-agentes' },
  { value: 'exclusividad', label: 'Exclusividad', endpoint: 'exclusividad' },
  { value: 'contabilidad_sociedad', label: 'Contabilidad Sociedad', endpoint: 'contabilidad-sociedad' },
  { value: 'sociedad_exclusiva', label: 'Sociedad Exclusiva', endpoint: 'sociedad-exclusiva' },
  { value: 'impuestos', label: 'Impuestos', endpoint: 'impuestos' },
  { value: 'interfaz_jde', label: 'Interfaz JDE', endpoint: 'interfaz-jde' },
  { value: 'informe_rechazos', label: 'Informe rechazos', endpoint: 'informe-rechazos' },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]['value'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MESES_ABBR = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** 202503 → "Marzo 2025". */
export function formatPeriodo(periodo: number | string): string {
  const v = String(periodo);
  if (v.length !== 6) return v;
  const idx = parseInt(v.slice(4), 10) - 1;
  return `${MESES[idx] ?? v.slice(4)} ${v.slice(0, 4)}`;
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
}

export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `$${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return formatCurrency(value);
}

export function ultimaActualizacion(): string {
  const now = new Date();
  const dia = String(now.getDate()).padStart(2, '0');
  return `Última actualización: ${dia}/${MESES_ABBR[now.getMonth()]}/${now.getFullYear()}`;
}

// Etiquetas de columna de la tabla de desempeño.
const COLUMNAS_DESEMPENO: Record<string, string> = {
  Periodo: 'Periodo',
  NombreCompania: 'Nombre compañía',
  Producto: 'Producto',
  ContratoCorto: 'Contrato corto',
  ContratoLargo: 'Contrato largo',
  CanalDescripcion: 'Canal',
  TipoComision: 'Tipo comisión',
  Regla: 'Regla',
  ValorComision: 'Valor comisión',
};

// Etiquetas de columna de los reportes (solo las que cambian de nombre).
const COLUMNAS_REPORTES: Record<string, string> = {
  NombreCompania: 'Nombre compañía',
  ValorComision: 'Valor comisión',
  TipoComision: 'Tipo comisión',
};

/** Columnas que se pintan como moneda en los reportes. */
export const COLUMNAS_MONEDA = new Set([
  'ColumnaBaseTotal',
  'Expr2',
  'ComisionMasIva',
  'ValorTotalConIva',
  'ComisionBase',
  'ValorIVA',
  'TotalComision',
  'ValorComision',
  'ValorBase',
]);

/** Columnas anchas (nombres largos). */
export const COLUMNAS_ANCHAS = new Set([
  'NombreCompania',
  'NombreSociedad',
  'Descripcion',
  'NombreAgte',
  'NombreTercero',
  'TipoComision',
]);

export function etiquetaColumnaDesempeno(col: string): string {
  return COLUMNAS_DESEMPENO[col] ?? col;
}

export function etiquetaColumnaReporte(col: string): string {
  return COLUMNAS_REPORTES[col] ?? col;
}

export function numeroDeCelda(value: unknown): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseFloat(value.replace(/,/g, ''));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

// ── Datos derivados para las gráficas ───────────────────────────────────────

/** Paleta legible y contrastada (verde de marca + acentos). */
const PALETA = [
  '#00C73D',
  '#2563EB',
  '#F59E0B',
  '#0D9488',
  '#7C3AED',
  '#EA580C',
  '#0284C7',
  '#65A30D',
];

export interface CanalDatum {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface ReglaDatum {
  name: string;
  value: number;
}

export interface MesDatum {
  month: string;
  year: string;
  value: number;
  periodo: string;
}

export function mapCanales(
  porCanal: ApiMetricItem[],
  totalComisiones: number,
): CanalDatum[] {
  const base = totalComisiones > 0 ? totalComisiones : 1;
  return porCanal.map((item, i) => ({
    name: item.key,
    value: item.total,
    percentage: Math.round((item.total * 100) / base),
    color: PALETA[i % PALETA.length],
  }));
}

export function mapReglas(porRegla: ApiMetricItem[]): ReglaDatum[] {
  return porRegla.map((item) => ({ name: item.key, value: item.total }));
}

/** Solo los últimos 6 periodos de la serie. */
export function mapMeses(serie: ApiSeriePeriodoItem[]): MesDatum[] {
  return serie.slice(-6).map((item) => {
    const periodo = String(item.periodo);
    const idx = parseInt(periodo.slice(4), 10) - 1;
    return {
      month: MESES_ABBR[idx] ?? periodo.slice(4),
      year: periodo.slice(0, 4),
      value: item.total,
      periodo,
    };
  });
}

export function totalSerie(serie: ApiSeriePeriodoItem[]): number {
  return serie.reduce((sum, item) => sum + item.total, 0);
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
export class InfoGerencialApi {
  private readonly http = inject(ComisionesHttp);

  async getFilters(): Promise<FilterOptions> {
    const res = await this.http.get<{
      filters: { periodo: number[]; canal: string[]; compania: string[]; producto: string[] };
    }>(`${PERFORMANCE}/filters`);
    const f = res.filters;
    return {
      periods: (f?.periodo ?? []).map((p) => ({
        value: String(p),
        label: formatPeriodo(p),
      })),
      channels: (f?.canal ?? []).map((c) => ({ value: c, label: c })),
      companies: (f?.compania ?? []).map((c) => ({ value: c, label: c })),
      products: (f?.producto ?? []).map((p) => ({ value: p, label: p })),
    };
  }

  /** Los filtros en "all" simplemente no se envían. */
  getMetrics(filtros: InfoGerencialFilters): Promise<ApiMetricsResponse> {
    return this.http.get<ApiMetricsResponse>(
      `${PERFORMANCE}/metrics${qs({
        periodo: filtros.period !== 'all' ? filtros.period : undefined,
        canal: filtros.channel !== 'all' ? filtros.channel : undefined,
        compania: filtros.company !== 'all' ? filtros.company : undefined,
        producto: filtros.product !== 'all' ? filtros.product : undefined,
      })}`,
    );
  }

  getCommissions(params: {
    page: number;
    page_size: number;
    periodo?: string;
    search?: string;
  }): Promise<ApiTableResponse> {
    return this.http.get<ApiTableResponse>(`${PERFORMANCE}/commissions${qs(params)}`);
  }

  exportCommissions(periodo?: string): Promise<void> {
    return this.http.descargar(
      `${PERFORMANCE}/excel${qs({ periodo })}`,
      `comisiones_${periodo ?? 'todos'}.xlsx`,
    );
  }

  getReport(
    tipo: ReportType,
    params: { page: number; page_size: number; periodo?: string; search?: string },
  ): Promise<ApiTableResponse> {
    return this.http.get<ApiTableResponse>(
      `${REPORTS}/${this.endpoint(tipo)}${qs(params)}`,
    );
  }

  exportReport(tipo: ReportType, periodo?: string): Promise<void> {
    return this.http.descargar(
      `${REPORTS}/${this.endpoint(tipo)}/excel${qs({ periodo })}`,
      `${tipo}_${periodo ?? 'todos'}.xlsx`,
    );
  }

  private endpoint(tipo: ReportType): string {
    return REPORT_TYPES.find((r) => r.value === tipo)?.endpoint ?? tipo;
  }
}
