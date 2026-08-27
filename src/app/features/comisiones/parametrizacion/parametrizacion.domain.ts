// Tipos de dominio de Parametrización (port de types/accounting.ts) y los
// catálogos de opciones que comparten sus formularios.

export type AccountingCategory = 'seguros' | 'fiduciaria' | 'pensiones_obligatorias';

export const CATEGORIES: AccountingCategory[] = [
  'seguros',
  'fiduciaria',
  'pensiones_obligatorias',
];

export const ACCOUNTING_CATEGORY_LABELS: Record<AccountingCategory, string> = {
  seguros: 'Vida',
  fiduciaria: 'Fiduciaria',
  pensiones_obligatorias: 'AFP',
};

export const CATEGORY_TO_COMPANY_CODE: Record<AccountingCategory, number> = {
  fiduciaria: 180,
  seguros: 137,
  pensiones_obligatorias: 194,
};

export const COMPANY_CODE_TO_CATEGORY: Record<number, AccountingCategory> = {
  180: 'fiduciaria',
  137: 'seguros',
  194: 'pensiones_obligatorias',
};

/** Razones sociales que usan los selects de compañía. */
export const COMPANY_OPTIONS = [
  { label: 'Skandia Seguros De Vida S.A.', value: 'Skandia Seguros De Vida S.A.', code: 137 },
  { label: 'Skandia Fiduciaria S.A.', value: 'Skandia Fiduciaria S.A.', code: 180 },
  {
    label: 'Skandia Pensiones y Cesantias S.A.',
    value: 'Skandia Pensiones y Cesantias S.A.',
    code: 194,
  },
];

export const COMPANY_CODE_TO_NAME: Record<number, string> = {
  137: 'Skandia Seguros De Vida S.A.',
  180: 'Skandia Fiduciaria S.A.',
  194: 'Skandia Pensiones y Cesantias S.A.',
};

/** Canal y su código, iguales en los cuatro formularios que lo piden. */
export const CANAL_OPTIONS = [
  { label: 'Intermediario', value: 'Intermediario', code: 2 },
  { label: 'Tradicional', value: 'Tradicional', code: 3 },
  { label: 'Empleados', value: 'Empleados', code: 1 },
];

export const STATUS_OPTIONS = [
  { label: 'Activo', value: 'A' },
  { label: 'Inactivo', value: 'I' },
];

export const DOCUMENT_TYPE_OPTIONS = [
  { label: 'Cédula de Ciudadanía', value: 'C' },
  { label: 'Nit Persona Jurídica', value: 'N' },
  { label: 'Cédula de Extranjería', value: 'E' },
  { label: 'Pasaporte', value: 'P' },
  { label: 'Permiso por proteccion temporal', value: 'V' },
  { label: 'Registro civil de nacimiento o NUIP', value: 'R' },
  { label: 'Tarjeta de Identidad', value: 'T' },
  { label: 'Nit Persona Natural', value: 'M' },
];

/** Tipos de documento cuyo número admite solo dígitos. */
const DOC_SOLO_DIGITOS = ['C', 'T', 'M', 'N', 'V'];

export function documentoValido(tipo: string, numero: string): boolean {
  if (!numero) return true;
  return DOC_SOLO_DIGITOS.includes(tipo)
    ? /^\d+$/.test(numero)
    : /^[a-zA-Z0-9]+$/.test(numero);
}

export function soloDigitos(tipo: string): boolean {
  return DOC_SOLO_DIGITOS.includes(tipo);
}

export const MESES_OPTIONS = [
  { label: 'Enero', value: '01' },
  { label: 'Febrero', value: '02' },
  { label: 'Marzo', value: '03' },
  { label: 'Abril', value: '04' },
  { label: 'Mayo', value: '05' },
  { label: 'Junio', value: '06' },
  { label: 'Julio', value: '07' },
  { label: 'Agosto', value: '08' },
  { label: 'Septiembre', value: '09' },
  { label: 'Octubre', value: '10' },
  { label: 'Noviembre', value: '11' },
  { label: 'Diciembre', value: '12' },
];

// ── Registros ───────────────────────────────────────────────────────────────

export interface AccountingRecord {
  id: string;
  CodigoCompania: number;
  NombreCompania: string;
  Producto: string;
  TipoComision: string;
  TipoComisionId?: string;
  Canal: string;
  CanalCode?: number;
  UnidadNegocio: number;
  CuentaContable: number;
  Subcuenta: string;
  UnidadNegocioCuentaPorPagar: number;
  CuentaContableCuentaPorPagar: number;
  SubcuentaCuentaPorPagar: string;
  EsActivo: boolean;
  UpdatedOn: string;
  category: AccountingCategory;
}

export interface CommissionTypeRecord {
  id: string;
  TipoComision: string;
  TipoComisionId?: string;
  IDTipoComision?: number;
  Canal: string;
  CanalCode?: number;
  Abreviacion: string;
  Producto: string;
  NombreContabilidad: string;
  CodigoCompania?: number;
  NombreCompania?: string;
  EsActivo: boolean;
  UpdatedOn: string;
  category: AccountingCategory;
}

export interface DeferredRecord {
  id: string;
  ContratoCorto: number;
  Clasificacion: string | null;
  Tramo: number;
  CanalId: number;
  TipoComision: number;
  Pagado: boolean;
  FechaPago: string;
  FechaActivacion: string;
  EstadoDiferido: number;
  DescripcionEstadoDiferido: string;
  ValorComision: number;
  UpdatedOn: string;
}

export interface DeferredPercentageRecord {
  id: string;
  company_name?: string;
  company_code?: number;
  clasificacion: string;
  tramo: number;
  porcentaje_diferido: number;
  canal_id: number;
  estado: string;
  descripcion_estado: string;
  fecha_activacion: string;
  activo: boolean;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface CarbonBondRecord {
  id: string;
  ContratoLargo: string;
  Hasta: number;
  Mayor: number;
  Activo: boolean;
  UpdatedOn: string;
}

export interface AutonomousPatrimonyRecord {
  id: string;
  Producto: string;
  Desde: number;
  Hasta: number | null;
  PorcentajeEA: number;
  Activo: boolean;
  CreatedAt: string;
  CreatedBy: string;
  UpdatedAt: string;
  UpdatedBy: string | null;
  IsDeleted: boolean;
}

export interface CommissionConfigRecord {
  id: string;
  period: number;
  company_code: number;
  company_name: string;
  product: string;
  long_contract: number;
  short_contract: number;
  policyholder_id: number;
  policyholder_name: string;
  policyholder_document_number: string;
  policyholder_document_type: string;
  paid_premiums_count: number;
  premium_value: number;
  paid_value: number;
  prime_over_2m: boolean;
  policyholder_prime_over_2m: boolean;
  /** En la UI va en dd/MM/yyyy; al API en yyyy-MM-dd. */
  expected_payment_date: string;
  rule: string;
  commission_type: string;
  commission_value: number;
  base_value: number;
  channel_id: number;
  channel_description: string;
  agent_id: number;
  agent_type_id: number;
  agent_name: string;
  company_id: number;
  company_legal_name: string;
  company_email: string;
  classification: string;
  special_classification: string;
  third_party_id: number;
  fiscal_area: string;
  fiscal_area_cesco: string;
  fp_subgroup: string;
  is_active: boolean;
  is_deleted?: boolean;
  created_at?: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface SpecialCaseRecord {
  id: string;
  NombreCompania: string;
  CodigoCompania: number;
  IdAgte: number;
  IdSociedad: number;
  ClasificacionEspecial: string;
  Activo: boolean;
  UltimaActualizacion: string;
}

export interface ExcludedContractRecord {
  id: string;
  NombreCompania: string;
  CodigoCompania: string;
  Producto: string;
  ContratoLargo: string;
  Activo: boolean;
  UltimaActualizacion: string;
}

// ── Utilidades de nombres de plan ───────────────────────────────────────────

/**
 * Producto = última palabra del nombre del plan; si esa última palabra es un
 * porcentaje (p. ej. "…_OMPEV_25%"), el producto es la penúltima.
 */
export function extractProductoFromCommissionName(name: string): string {
  const partes = name.split('_');
  if (partes.length >= 2) {
    const ultima = partes[partes.length - 1];
    if (/\d/.test(ultima) && ultima.includes('%')) return partes[partes.length - 2];
  }
  return partes[partes.length - 1] ?? '';
}

/**
 * Abreviación = palabras intermedias del nombre (sin canal ni producto).
 * Los clawback se abrevian siempre como "CLAW".
 */
export function extractAbreviacionFromCommissionName(name: string): string {
  const partes = name.split('_');
  if (partes.length < 3) return '';
  let fin = partes.length - 1;
  const ultima = partes[partes.length - 1];
  if (/\d/.test(ultima) && ultima.includes('%')) fin = partes.length - 2;
  const medio = partes.slice(1, fin);
  if (medio.some((p) => /CLAW|CLAWBACK|CLWBACK/i.test(p))) return 'CLAW';
  return medio.join('_');
}

/** NombreContabilidad = canal_abreviación_producto. */
export function deriveNombreContabilidad(name: string): string {
  const partes = name.split('_');
  if (partes.length === 0) return '';
  const canal = partes[0];
  const abrev = extractAbreviacionFromCommissionName(name);
  const producto = extractProductoFromCommissionName(name);
  return [canal, abrev, producto].filter(Boolean).join('_');
}

// ── Formato ─────────────────────────────────────────────────────────────────

export function fmtFechaCorta(valor: unknown): string {
  if (!valor) return '';
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) return String(valor);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function fmtFechaHora(valor: unknown): string {
  if (!valor) return '';
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) return String(valor);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${fmtFechaCorta(valor)} ${hh}:${mi}`;
}

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const COP_2 = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoneda(valor: unknown, decimales = 0): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  return decimales === 2 ? COP_2.format(n) : COP.format(n);
}

/** El API guarda fracciones; la UI muestra porcentaje. */
export function fmtPorcentaje(valor: unknown): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  const p = n * 100;
  return `${Number.isInteger(p) ? p : Number(p.toFixed(3))}%`;
}

/** dd/MM/yyyy → yyyy-MM-dd (y viceversa) para las fechas de los formularios. */
export function aIsoFecha(ddmmyyyy: string): string {
  const p = ddmmyyyy.split('/');
  if (p.length !== 3) return ddmmyyyy;
  return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
}

export function aFechaUI(iso: string): string {
  if (!iso) return '';
  if (iso.includes('/')) return iso;
  const p = iso.slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export function hoyISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
