// Descripción de las 8 secciones de Parametrización: columnas de la tabla,
// campos del formulario, campos derivados y validaciones cruzadas. Es la descripción
// declarativa que alimenta una sola tabla y un solo diálogo genéricos.

import { ParamColumn, ParamRow } from './param-table.component';
import { ParamField, ParamValues } from './param-form-dialog.component';
import { SeccionId } from './parametrizacion.store';
import {
  ACCOUNTING_CATEGORY_LABELS,
  AccountingCategory,
  CANAL_OPTIONS,
  CATEGORY_TO_COMPANY_CODE,
  COMPANY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  STATUS_OPTIONS,
  deriveNombreContabilidad,
  documentoValido,
  extractAbreviacionFromCommissionName,
  extractProductoFromCommissionName,
  hoyISO,
} from './parametrizacion.domain';

export interface FormCtx {
  categoria: AccountingCategory;
  /** Planes publicados: alimentan los selectores de tipo de comisión/regla. */
  planes: { id: string; name: string }[];
}

export interface SeccionSpec {
  id: SeccionId;
  titulo: string;
  subtitulo?: string;
  placeholderBusqueda: string;
  columnas: ParamColumn[];
  anchoMinimo: string;
  soloLectura?: boolean;
  /** Contabilidad y tipos de comisión se dividen por compañía. */
  porCategoria?: boolean;
  /** Diferidos consulta al backend por rango de fechas. */
  conRangoFechas?: boolean;
  botonCrear?: string;
  formColumnas?: 2 | 3;
  formAncho?: string;
  tituloCrear?: string;
  descCrear?: string;
  tituloEditar?: string;
  descEditar?: (row: ParamRow) => string;
  buscarEn: (row: ParamRow) => unknown[];
  campos?: (ctx: FormCtx) => ParamField[];
  aFormulario?: (row: ParamRow | null, ctx: FormCtx) => ParamValues;
  aRegistro?: (v: ParamValues, ctx: FormCtx) => Record<string, unknown>;
  derivar?: (key: string, v: ParamValues, ctx: FormCtx) => ParamValues;
  validar?: (v: ParamValues) => Record<string, string>;
}

const txt = (v: string | boolean | undefined): string =>
  v === undefined || v === null ? '' : String(v);

const num = (v: string | boolean | undefined): number => Number(txt(v)) || 0;

const canalOptions = CANAL_OPTIONS.map((c) => ({ label: c.label, value: c.value }));
const companyOptions = COMPANY_OPTIONS.map((c) => ({ label: c.label, value: c.value }));
const statusOptions = STATUS_OPTIONS.map((s) => ({ label: s.label, value: s.value }));
const docOptions = DOCUMENT_TYPE_OPTIONS.map((d) => ({ label: d.label, value: d.value }));

const codigoCanal = (canal: string): number =>
  CANAL_OPTIONS.find((c) => c.value === canal)?.code ?? 0;

const codigoCompania = (nombre: string): number =>
  COMPANY_OPTIONS.find((c) => c.value === nombre)?.code ?? 0;

/** Porcentajes: el registro guarda fracción y el formulario muestra 0-100. */
const aPorcentajeForm = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const p = n * 100;
  return String(Number.isInteger(p) ? p : Number(p.toFixed(3)));
};

// ── 1. Contabilidad ─────────────────────────────────────────────────────────

const CONTABILIDAD: SeccionSpec = {
  id: 'contabilidad',
  titulo: 'Contabilidad',
  placeholderBusqueda: 'Buscar por compañía, producto, canal...',
  porCategoria: true,
  botonCrear: 'Crear Registro',
  anchoMinimo: '1300px',
  formColumnas: 3,
  formAncho: '900px',
  tituloCrear: 'Crear Registro Contable',
  descCrear: 'Ingresa la información para el nuevo registro contable.',
  tituloEditar: 'Editar Registro Contable',
  descEditar: (r) => `Modifica los campos del registro contable de ${r['NombreCompania']}`,
  columnas: [
    { key: 'Producto', label: 'Producto', tipo: 'chipPrimario' },
    { key: 'TipoComision', label: 'Tipo Comisión' },
    { key: 'Canal', label: 'Canal', tipo: 'chipMuted' },
    { key: 'UnidadNegocio', label: 'U. Negocio' },
    { key: 'CuentaContable', label: 'Cuenta Contable', tipo: 'mono' },
    { key: 'Subcuenta', label: 'Subcuenta', tipo: 'mono' },
    { key: 'UnidadNegocioCuentaPorPagar', label: 'U. Neg. CxP' },
    { key: 'CuentaContableCuentaPorPagar', label: 'Cta. Contable CxP', tipo: 'mono' },
    { key: 'SubcuentaCuentaPorPagar', label: 'Subcta. CxP', tipo: 'mono' },
    { key: 'EsActivo', label: 'Activo', tipo: 'switch' },
    { key: 'UpdatedOn', label: 'Última Act.', tipo: 'fecha', filtro: 'fecha' },
  ],
  buscarEn: (r) => [
    r['NombreCompania'],
    r['Producto'],
    r['TipoComision'],
    r['Canal'],
    r['Subcuenta'],
  ],
  campos: (ctx) => [
    { key: 'NombreCompania', label: 'Nombre Compañía', tipo: 'texto', requerido: true, deshabilitado: true },
    { key: 'Producto', label: 'Producto', tipo: 'texto', requerido: true, deshabilitado: true },
    {
      key: 'TipoComisionId',
      label: 'Tipo Comisión',
      tipo: 'select',
      requerido: true,
      buscable: true,
      opciones: ctx.planes.map((p) => ({ label: p.name, value: p.id })),
    },
    { key: 'Canal', label: 'Canal', tipo: 'select', requerido: true, opciones: canalOptions },
    { key: 'UnidadNegocio', label: 'Unidad de Negocio', tipo: 'numero', requerido: true, maxLength: 12 },
    { key: 'CuentaContable', label: 'Cuenta Contable', tipo: 'numero', requerido: true, maxLength: 6 },
    { key: 'Subcuenta', label: 'Subcuenta', tipo: 'numero', requerido: true, maxLength: 4 },
    { key: 'UnidadNegocioCuentaPorPagar', label: 'U. Negocio CxP', tipo: 'numero' },
    { key: 'CuentaContableCuentaPorPagar', label: 'Cuenta Contable CxP', tipo: 'numero' },
    { key: 'SubcuentaCuentaPorPagar', label: 'Subcuenta CxP', tipo: 'numero' },
    { key: 'EsActivo', label: 'Activo', tipo: 'switch' },
  ],
  aFormulario: (r, ctx) => ({
    NombreCompania: r
      ? txt(r['NombreCompania'] as string)
      : ACCOUNTING_CATEGORY_LABELS[ctx.categoria],
    Producto: txt(r?.['Producto'] as string),
    TipoComision: txt(r?.['TipoComision'] as string),
    TipoComisionId: txt(r?.['TipoComisionId'] as string),
    Canal: txt(r?.['Canal'] as string),
    UnidadNegocio: r ? String(r['UnidadNegocio'] ?? '') : '',
    CuentaContable: r ? String(r['CuentaContable'] ?? '') : '',
    Subcuenta: txt(r?.['Subcuenta'] as string),
    UnidadNegocioCuentaPorPagar: r ? String(r['UnidadNegocioCuentaPorPagar'] ?? '') : '',
    CuentaContableCuentaPorPagar: r ? String(r['CuentaContableCuentaPorPagar'] ?? '') : '',
    SubcuentaCuentaPorPagar: txt(r?.['SubcuentaCuentaPorPagar'] as string),
    EsActivo: r ? Boolean(r['EsActivo']) : true,
  }),
  aRegistro: (v, ctx) => ({
    NombreCompania: txt(v['NombreCompania']),
    CodigoCompania: CATEGORY_TO_COMPANY_CODE[ctx.categoria],
    category: ctx.categoria,
    Producto: txt(v['Producto']),
    TipoComision: txt(v['TipoComision']),
    TipoComisionId: txt(v['TipoComisionId']),
    Canal: txt(v['Canal']),
    CanalCode: codigoCanal(txt(v['Canal'])),
    UnidadNegocio: num(v['UnidadNegocio']),
    CuentaContable: num(v['CuentaContable']),
    Subcuenta: txt(v['Subcuenta']),
    UnidadNegocioCuentaPorPagar: num(v['UnidadNegocioCuentaPorPagar']),
    CuentaContableCuentaPorPagar: num(v['CuentaContableCuentaPorPagar']),
    SubcuentaCuentaPorPagar: txt(v['SubcuentaCuentaPorPagar']) || '0',
    EsActivo: Boolean(v['EsActivo']),
  }),
  // Al elegir el plan se guarda su nombre y se deduce el producto.
  derivar: (key, v, ctx) => {
    if (key !== 'TipoComisionId') return v;
    const plan = ctx.planes.find((p) => p.id === txt(v['TipoComisionId']));
    if (!plan) return v;
    return {
      ...v,
      TipoComision: plan.name,
      Producto: extractProductoFromCommissionName(plan.name),
    };
  },
};

// ── 2. Tipos de comisión ────────────────────────────────────────────────────

const TIPOS_COMISION: SeccionSpec = {
  id: 'tiposComision',
  titulo: 'Tipo de comisión',
  placeholderBusqueda: 'Buscar por tipo, canal o producto...',
  porCategoria: true,
  botonCrear: 'Crear Tipo',
  anchoMinimo: '1100px',
  formColumnas: 2,
  formAncho: '760px',
  tituloCrear: 'Crear Tipo de Comisión',
  descCrear: 'Ingresa la información para el nuevo tipo de comisión.',
  tituloEditar: 'Editar Tipo de Comisión',
  descEditar: (r) => `Modifica los campos para el tipo de comisión ${r['TipoComision']}.`,
  columnas: [
    { key: 'IDTipoComision', label: 'ID Tipo de Comisión' },
    { key: 'TipoComision', label: 'Tipo Comisión' },
    { key: 'Canal', label: 'Canal', tipo: 'chipMuted' },
    { key: 'Abreviacion', label: 'Abreviación' },
    { key: 'Producto', label: 'Producto', tipo: 'chipPrimario' },
    { key: 'NombreContabilidad', label: 'Nombre Contabilidad' },
    { key: 'EsActivo', label: 'Activo', tipo: 'switch' },
    { key: 'UpdatedOn', label: 'Última Act.', tipo: 'fecha', filtro: 'fecha' },
  ],
  buscarEn: (r) => [r['id'], r['TipoComision'], r['Canal']],
  campos: (ctx) => [
    { key: 'NombreCompania', label: 'Nombre Compañía', tipo: 'texto', requerido: true, deshabilitado: true },
    { key: 'IDTipoComision', label: 'ID Tipo de Comisión', tipo: 'numero', requerido: true, maxLength: 4 },
    {
      key: 'TipoComision',
      label: 'Tipo Comisión',
      tipo: 'select',
      requerido: true,
      buscable: true,
      ancho: 'full',
      opciones: ctx.planes.map((p) => ({ label: p.name, value: p.name })),
    },
    { key: 'Canal', label: 'Canal', tipo: 'select', requerido: true, opciones: canalOptions },
    { key: 'Abreviacion', label: 'Abreviación', tipo: 'texto', requerido: true, deshabilitado: true },
    { key: 'Producto', label: 'Producto', tipo: 'texto', requerido: true, deshabilitado: true },
    {
      key: 'NombreContabilidad',
      label: 'Nombre Contabilidad',
      tipo: 'texto',
      requerido: true,
      deshabilitado: true,
      ancho: 'full',
    },
    {
      key: 'EsActivo',
      label: 'Estado Activo',
      tipo: 'switch',
      ayuda: 'Activa o desactiva este tipo de comisión',
    },
  ],
  aFormulario: (r, ctx) => ({
    NombreCompania: r
      ? txt(r['NombreCompania'] as string)
      : (COMPANY_OPTIONS.find(
          (c) => c.code === CATEGORY_TO_COMPANY_CODE[ctx.categoria],
        )?.value ?? ''),
    IDTipoComision: r ? String(r['IDTipoComision'] ?? '') : '',
    TipoComision: txt(r?.['TipoComision'] as string),
    Canal: txt(r?.['Canal'] as string),
    Abreviacion: txt(r?.['Abreviacion'] as string),
    Producto: txt(r?.['Producto'] as string),
    NombreContabilidad: txt(r?.['NombreContabilidad'] as string),
    EsActivo: r ? Boolean(r['EsActivo']) : true,
  }),
  aRegistro: (v, ctx) => ({
    NombreCompania: txt(v['NombreCompania']),
    CodigoCompania:
      codigoCompania(txt(v['NombreCompania'])) || CATEGORY_TO_COMPANY_CODE[ctx.categoria],
    category: ctx.categoria,
    IDTipoComision: num(v['IDTipoComision']),
    TipoComision: txt(v['TipoComision']),
    Canal: txt(v['Canal']),
    CanalCode: codigoCanal(txt(v['Canal'])),
    Abreviacion: txt(v['Abreviacion']),
    Producto: txt(v['Producto']),
    NombreContabilidad: txt(v['NombreContabilidad']),
    EsActivo: Boolean(v['EsActivo']),
  }),
  // Del nombre del plan salen abreviación, producto y nombre de contabilidad.
  derivar: (key, v) => {
    if (key !== 'TipoComision') return v;
    const nombre = txt(v['TipoComision']);
    if (!nombre) return v;
    return {
      ...v,
      Abreviacion: extractAbreviacionFromCommissionName(nombre),
      Producto: extractProductoFromCommissionName(nombre),
      NombreContabilidad: deriveNombreContabilidad(nombre),
    };
  },
};

// ── 3. Diferidos (solo lectura) ─────────────────────────────────────────────

const DIFERIDOS: SeccionSpec = {
  id: 'diferidos',
  titulo: 'Diferidos',
  placeholderBusqueda: 'Buscar por contrato, clasificación o estado...',
  soloLectura: true,
  conRangoFechas: true,
  anchoMinimo: '1400px',
  columnas: [
    { key: 'ContratoCorto', label: 'Contrato', tipo: 'mono' },
    { key: 'Clasificacion', label: 'Clasificación' },
    { key: 'Tramo', label: 'Tramo' },
    { key: 'CanalId', label: 'ID Canal', tipo: 'mono' },
    { key: 'TipoComision', label: 'Tipo Comision', tipo: 'mono' },
    { key: 'Pagado', label: 'Pagado', tipo: 'siNo' },
    { key: 'FechaPago', label: 'Fecha de Pago', tipo: 'fecha', filtro: 'fecha' },
    {
      key: 'FechaActivacion',
      label: 'Fecha de Actualización',
      tipo: 'fecha',
      filtro: 'fecha',
    },
    { key: 'EstadoDiferido', label: 'Estado Diferido' },
    { key: 'DescripcionEstadoDiferido', label: 'Estado', tipo: 'estado' },
    { key: 'ValorComision', label: 'Valor Comision', tipo: 'moneda2' },
  ],
  buscarEn: (r) => [r['ContratoCorto'], r['Clasificacion'], r['DescripcionEstadoDiferido']],
};

// ── 4. Diferidos paramétrico ────────────────────────────────────────────────

const DIFERIDOS_PARAM: SeccionSpec = {
  id: 'diferidosParam',
  titulo: 'Diferidos Paramétrico',
  placeholderBusqueda: 'Buscar por clasificación, modificado por...',
  botonCrear: 'Crear Registro',
  anchoMinimo: '1300px',
  formColumnas: 2,
  formAncho: '700px',
  tituloCrear: 'Crear Diferidos Paramétrico',
  descCrear: 'Ingresa la información para el nuevo registro de diferidos paramétrico.',
  tituloEditar: 'Editar Diferidos Paramétrico',
  descEditar: (r) =>
    `Modifica la información para el registro de clasificación ${r['clasificacion']}.`,
  columnas: [
    { key: 'clasificacion', label: 'Clasificación' },
    { key: 'tramo', label: 'Tramo' },
    { key: 'porcentaje_diferido', label: 'Porcentaje Dif.', tipo: 'porcentaje' },
    { key: 'canal_id', label: 'ID Canal', tipo: 'mono' },
    { key: 'estado', label: 'Estado', tipo: 'mono' },
    { key: 'descripcion_estado', label: 'Descripción Estado' },
    { key: 'fecha_activacion', label: 'Fecha Activación', tipo: 'fecha', filtro: 'fecha' },
    { key: 'activo', label: 'Activo', tipo: 'switch' },
    { key: 'fecha_creacion', label: 'Fecha Creación', tipo: 'fecha', filtro: 'fecha' },
    {
      key: 'fecha_actualizacion',
      label: 'Fecha Actualización',
      tipo: 'fecha',
      filtro: 'fecha',
    },
  ],
  buscarEn: (r) => [r['clasificacion'], r['descripcion_estado']],
  campos: () => [
    { key: 'company_name', label: 'Nombre Compañía', tipo: 'select', requerido: true, opciones: companyOptions, ancho: 'full' },
    { key: 'clasificacion', label: 'Clasificación', tipo: 'texto', placeholder: 'Ej: Nuevo' },
    { key: 'tramo', label: 'Tramo', tipo: 'numero', requerido: true, maxLength: 1 },
    { key: 'porcentaje_diferido', label: 'Porcentaje Diferido (%)', tipo: 'decimal', requerido: true },
    { key: 'canal', label: 'Canal', tipo: 'select', requerido: true, opciones: canalOptions },
    { key: 'estado', label: 'Estado', tipo: 'select', requerido: true, opciones: statusOptions },
    { key: 'descripcion_estado', label: 'Descripción Estado', tipo: 'texto', deshabilitado: true },
    { key: 'fecha_activacion', label: 'Fecha Activación', tipo: 'fecha', deshabilitado: true },
    { key: 'activo', label: 'Activo', tipo: 'switch' },
  ],
  aFormulario: (r) => ({
    company_name: txt(r?.['company_name'] as string),
    clasificacion: txt(r?.['clasificacion'] as string),
    tramo: r ? String(r['tramo'] ?? '') : '',
    porcentaje_diferido: r ? aPorcentajeForm(r['porcentaje_diferido']) : '',
    canal: r
      ? (CANAL_OPTIONS.find((c) => c.code === Number(r['canal_id']))?.value ?? '')
      : '',
    estado: txt(r?.['estado'] as string),
    descripcion_estado: txt(r?.['descripcion_estado'] as string),
    fecha_activacion: r ? String(r['fecha_activacion'] ?? '').slice(0, 10) : hoyISO(),
    activo: r ? Boolean(r['activo']) : true,
  }),
  aRegistro: (v) => ({
    company_name: txt(v['company_name']),
    company_code: codigoCompania(txt(v['company_name'])),
    clasificacion: txt(v['clasificacion']),
    tramo: num(v['tramo']),
    porcentaje_diferido: Number(txt(v['porcentaje_diferido'])) || 0,
    canal_id: codigoCanal(txt(v['canal'])),
    estado: txt(v['estado']),
    descripcion_estado: txt(v['descripcion_estado']),
    fecha_activacion: txt(v['fecha_activacion']),
    activo: Boolean(v['activo']),
  }),
  // La descripción del estado sale de la etiqueta del estado elegido.
  derivar: (key, v) => {
    if (key !== 'estado') return v;
    const opcion = STATUS_OPTIONS.find((s) => s.value === txt(v['estado']));
    return { ...v, descripcion_estado: opcion?.label ?? '' };
  },
};

// ── 5. Config. Contrato ─────────────────────────────────────────────────────

const CONFIG_CONTRATO: SeccionSpec = {
  id: 'configContrato',
  titulo: 'Config. Contrato',
  placeholderBusqueda: 'Buscar por contrato o estado...',
  botonCrear: 'Crear Registro',
  anchoMinimo: '900px',
  formColumnas: 2,
  formAncho: '620px',
  tituloCrear: 'Configuración Contrato',
  descCrear: 'Ingresa la información para el nuevo contrato.',
  tituloEditar: 'Configuración Contrato',
  descEditar: (r) => `Modifica la información para el contrato ${r['ContratoLargo']}.`,
  columnas: [
    { key: 'ContratoLargo', label: 'Contrato Largo', tipo: 'mono' },
    { key: 'Hasta', label: 'Hasta (%)', tipo: 'porcentaje' },
    { key: 'Mayor', label: 'Mayor (%)', tipo: 'porcentaje' },
    { key: 'Activo', label: 'Activo', tipo: 'switch' },
    { key: 'UpdatedOn', label: 'Última Actualización', tipo: 'fecha', filtro: 'fecha' },
  ],
  buscarEn: (r) => [r['ContratoLargo'], r['Activo'] ? 'activo' : 'inactivo'],
  campos: () => [
    { key: 'ContratoLargo', label: 'Contrato Largo', tipo: 'numero', requerido: true, maxLength: 18 },
    {
      key: 'Hasta',
      label: 'Hasta (%)',
      tipo: 'decimal',
      requerido: true,
      placeholder: 'Numero entre 0 - 100',
    },
    {
      key: 'Mayor',
      label: 'Mayor (%)',
      tipo: 'decimal',
      requerido: true,
      placeholder: 'Numero entre 0 - 100',
    },
    { key: 'Activo', label: 'Activo', tipo: 'switch' },
  ],
  aFormulario: (r) => ({
    ContratoLargo: txt(r?.['ContratoLargo'] as string),
    Hasta: r ? aPorcentajeForm(r['Hasta']) : '',
    Mayor: r ? aPorcentajeForm(r['Mayor']) : '',
    Activo: r ? Boolean(r['Activo']) : true,
  }),
  aRegistro: (v) => ({
    ContratoLargo: txt(v['ContratoLargo']),
    Hasta: Number(txt(v['Hasta'])) || 0,
    Mayor: Number(txt(v['Mayor'])) || 0,
    Activo: Boolean(v['Activo']),
  }),
};

// ── 6. Config. Producto ─────────────────────────────────────────────────────

const CONFIG_PRODUCTO: SeccionSpec = {
  id: 'configProducto',
  titulo: 'Config. Producto',
  placeholderBusqueda: 'Buscar por producto o estado...',
  botonCrear: 'Crear Registro',
  anchoMinimo: '1000px',
  formColumnas: 2,
  formAncho: '620px',
  tituloCrear: 'Configuración Producto',
  descCrear: 'Ingresa la información para el nuevo registro de configuración de producto.',
  tituloEditar: 'Configuración Producto',
  descEditar: (r) => `Modifica la información para el producto ${r['Producto']}.`,
  columnas: [
    { key: 'Producto', label: 'Producto', tipo: 'mono' },
    { key: 'Desde', label: 'Desde ($)', tipo: 'moneda' },
    { key: 'Hasta', label: 'Hasta ($)', tipo: 'moneda' },
    { key: 'PorcentajeEA', label: 'Porcentaje EA (%)', tipo: 'porcentaje' },
    { key: 'Activo', label: 'Activo', tipo: 'switch' },
    { key: 'UpdatedAt', label: 'Última Actualización', tipo: 'fecha', filtro: 'fecha' },
  ],
  buscarEn: (r) => [r['Producto'], r['Activo'] ? 'activo' : 'inactivo'],
  campos: () => [
    { key: 'Producto', label: 'Producto', tipo: 'texto', requerido: true, placeholder: 'Ej: NPAEOLH' },
    { key: 'Desde', label: 'Desde ($)', tipo: 'numero', requerido: true },
    { key: 'Hasta', label: 'Hasta ($)', tipo: 'numero', requerido: true, maxLength: 18 },
    { key: 'PorcentajeEA', label: 'Porcentaje EA (%)', tipo: 'decimal', requerido: true },
    { key: 'Activo', label: 'Activo', tipo: 'switch' },
  ],
  aFormulario: (r) => ({
    Producto: txt(r?.['Producto'] as string),
    Desde: r ? String(r['Desde'] ?? '') : '',
    Hasta: r && r['Hasta'] !== null ? String(r['Hasta'] ?? '') : '',
    PorcentajeEA: r ? aPorcentajeForm(r['PorcentajeEA']) : '',
    Activo: r ? Boolean(r['Activo']) : true,
  }),
  aRegistro: (v) => ({
    Producto: txt(v['Producto']),
    Desde: num(v['Desde']),
    Hasta: txt(v['Hasta']) === '' ? null : num(v['Hasta']),
    PorcentajeEA: Number(txt(v['PorcentajeEA'])) || 0,
    Activo: Boolean(v['Activo']),
  }),
  // El rango tiene que ser creciente.
  validar: (v): Record<string, string> => {
    const desde = Number(txt(v['Desde']));
    const hasta = Number(txt(v['Hasta']));
    if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return {};
    if (desde >= hasta) {
      return {
        Desde: 'El valor debe ser menor que el valor de Hasta',
        Hasta: 'El valor debe ser mayor que el valor de Desde',
      };
    }
    return {};
  },
};

// ── 7. Ajustes de comisiones ────────────────────────────────────────────────

const AJUSTES: SeccionSpec = {
  id: 'ajustesComisiones',
  titulo: 'Ajustes Comisiones',
  placeholderBusqueda: 'Buscar por compañía, producto, tomador...',
  botonCrear: 'Crear Registro',
  anchoMinimo: '4500px',
  formColumnas: 3,
  formAncho: '1000px',
  tituloCrear: 'Crear Ajuste de Comisión',
  descCrear:
    'Ingresa la información detallada para configurar el nuevo ajuste de comisión.',
  tituloEditar: 'Editar Ajuste de Comisión',
  descEditar: () => 'Modifica la información de la configuración seleccionada.',
  columnas: [
    { key: 'period', label: 'Periodo' },
    { key: 'company_code', label: 'Codigo Compañia' },
    { key: 'company_name', label: 'Nombre Compañía' },
    { key: 'product', label: 'Producto' },
    { key: 'long_contract', label: 'Contrato Largo' },
    { key: 'short_contract', label: 'Contrato Corto' },
    { key: 'policyholder_id', label: 'ID Tomador' },
    { key: 'policyholder_name', label: 'Nombre Tomador' },
    { key: 'policyholder_document_number', label: 'Numero Documento Tomador' },
    { key: 'policyholder_document_type', label: 'Tipo Documento Tomador' },
    { key: 'paid_premiums_count', label: 'Numero Primas Pagadas' },
    { key: 'premium_value', label: 'Valor Prima', tipo: 'moneda' },
    { key: 'paid_value', label: 'Valor Pagado', tipo: 'moneda' },
    { key: 'prime_over_2m', label: 'Prima Mayor 2M', tipo: 'siNo' },
    { key: 'policyholder_prime_over_2m', label: 'Prima Mayor Tomador 2M', tipo: 'siNo' },
    { key: 'expected_payment_date', label: 'Fecha Expectativa Pago' },
    { key: 'rule', label: 'Regla' },
    { key: 'commission_type', label: 'Tipo Comisión' },
    { key: 'commission_value', label: 'Valor Comisión', tipo: 'moneda' },
    { key: 'base_value', label: 'Valor Base', tipo: 'moneda' },
    { key: 'channel_id', label: 'Canal ID' },
    { key: 'channel_description', label: 'Canal Descripción' },
    { key: 'agent_id', label: 'ID Agente' },
    { key: 'agent_type_id', label: 'ID Tipo Agente' },
    { key: 'agent_name', label: 'Nombre' },
    { key: 'company_id', label: 'ID Sociedad' },
    { key: 'company_legal_name', label: 'Nombre Sociedad' },
    { key: 'company_email', label: 'Correo Sociedad' },
    { key: 'classification', label: 'Clasificación' },
    { key: 'special_classification', label: 'Clasificación Especial' },
    { key: 'third_party_id', label: 'ID Tercero' },
    { key: 'fiscal_area', label: 'Area Fiscal' },
    { key: 'fiscal_area_cesco', label: 'Area Fiscal Cesco' },
    { key: 'fp_subgroup', label: 'Subgrupo FP' },
    { key: 'is_active', label: 'Activo', tipo: 'switch' },
    { key: 'updated_at', label: 'Actualización', tipo: 'fechaHora' },
  ],
  buscarEn: (r) => [
    r['company_name'],
    r['product'],
    r['policyholder_name'],
    r['channel_description'],
    r['agent_id'],
    r['long_contract'],
    r['short_contract'],
    r['policyholder_document_number'],
  ],
  campos: (ctx) => [
    { key: 'period', label: 'Periodo', tipo: 'periodo', requerido: true },
    { key: 'company_name', label: 'Nombre Compañía', tipo: 'select', requerido: true, opciones: companyOptions },
    { key: 'product', label: 'Producto', tipo: 'texto', maxLength: 50 },
    { key: 'long_contract', label: 'Contrato Largo', tipo: 'numero', maxLength: 15 },
    { key: 'short_contract', label: 'Contrato Corto', tipo: 'numero', maxLength: 15 },
    { key: 'policyholder_id', label: 'ID Tomador', tipo: 'numero', maxLength: 15 },
    { key: 'policyholder_name', label: 'Nombre Tomador', tipo: 'texto', maxLength: 100 },
    {
      key: 'policyholder_document_type',
      label: 'Tipo Documento',
      tipo: 'select',
      requerido: true,
      opciones: docOptions,
    },
    {
      key: 'policyholder_document_number',
      label: 'Nro Documento Tomador',
      tipo: 'texto',
      maxLength: 30,
    },
    { key: 'paid_premiums_count', label: 'Número Primas Pagadas', tipo: 'numero', maxLength: 5 },
    { key: 'premium_value', label: 'Valor Prima', tipo: 'numero', maxLength: 15 },
    { key: 'paid_value', label: 'Valor Pagado', tipo: 'numero', maxLength: 15 },
    { key: 'prime_over_2m', label: 'Prima Mayor 2M', tipo: 'switch' },
    { key: 'policyholder_prime_over_2m', label: 'Prima Mayor Tomador 2M', tipo: 'switch' },
    { key: 'expected_payment_date', label: 'Expectativa Pago', tipo: 'fecha', requerido: true },
    {
      key: 'rule',
      label: 'Regla',
      tipo: 'select',
      requerido: true,
      buscable: true,
      opciones: ctx.planes.map((p) => ({ label: p.name, value: p.name })),
    },
    { key: 'commission_type', label: 'Tipo Comisión', tipo: 'numero', requerido: true, maxLength: 100 },
    { key: 'commission_value', label: 'Valor Comisión', tipo: 'numero', maxLength: 15 },
    { key: 'base_value', label: 'Valor Base', tipo: 'numero', maxLength: 15 },
    { key: 'channel_description', label: 'Canal', tipo: 'select', requerido: true, opciones: canalOptions },
    { key: 'agent_id', label: 'Id', tipo: 'numero', requerido: true, maxLength: 15 },
    { key: 'agent_type_id', label: 'ID Tipo Agente', tipo: 'numero', maxLength: 3 },
    { key: 'agent_name', label: 'Nombre (Opcional)', tipo: 'texto', maxLength: 100 },
    { key: 'company_id', label: 'ID Sociedad', tipo: 'numero', maxLength: 15 },
    { key: 'company_legal_name', label: 'Nombre Sociedad', tipo: 'texto', maxLength: 100 },
    { key: 'company_email', label: 'Correo Sociedad', tipo: 'email', maxLength: 100 },
    { key: 'classification', label: 'Clasificación', tipo: 'texto', maxLength: 50 },
    { key: 'special_classification', label: 'Clasificación Especial', tipo: 'texto', maxLength: 50 },
    { key: 'third_party_id', label: 'ID Tercero', tipo: 'numero', maxLength: 15 },
    { key: 'fiscal_area', label: 'Área Fiscal', tipo: 'texto', maxLength: 100 },
    { key: 'fiscal_area_cesco', label: 'Área Fiscal Cesco', tipo: 'texto', maxLength: 100 },
    { key: 'fp_subgroup', label: 'Subgrupo FP', tipo: 'texto', maxLength: 100 },
    { key: 'is_active', label: 'Activo', tipo: 'switch' },
    { key: 'entry_date', label: 'Fecha de Ingreso', tipo: 'fecha', deshabilitado: true },
  ],
  aFormulario: (r) => ({
    period: r ? String(r['period'] ?? '') : '',
    company_name: txt(r?.['company_name'] as string),
    product: txt(r?.['product'] as string),
    long_contract: r ? String(r['long_contract'] ?? '') : '',
    short_contract: r ? String(r['short_contract'] ?? '') : '',
    policyholder_id: r ? String(r['policyholder_id'] ?? '') : '',
    policyholder_name: txt(r?.['policyholder_name'] as string),
    policyholder_document_type: txt(r?.['policyholder_document_type'] as string),
    policyholder_document_number: txt(r?.['policyholder_document_number'] as string),
    paid_premiums_count: r ? String(r['paid_premiums_count'] ?? '') : '',
    premium_value: r ? String(r['premium_value'] ?? '') : '',
    paid_value: r ? String(r['paid_value'] ?? '') : '',
    prime_over_2m: r ? Boolean(r['prime_over_2m']) : false,
    policyholder_prime_over_2m: r ? Boolean(r['policyholder_prime_over_2m']) : false,
    expected_payment_date: r
      ? aIsoDesdeUI(String(r['expected_payment_date'] ?? ''))
      : '',
    rule: txt(r?.['rule'] as string),
    commission_type: txt(r?.['commission_type'] as string),
    commission_value: r ? String(r['commission_value'] ?? '') : '',
    base_value: r ? String(r['base_value'] ?? '') : '',
    channel_description: txt(r?.['channel_description'] as string),
    agent_id: r ? String(r['agent_id'] ?? '') : '',
    agent_type_id: r ? String(r['agent_type_id'] ?? '') : '',
    agent_name: txt(r?.['agent_name'] as string),
    company_id: r ? String(r['company_id'] ?? '') : '',
    company_legal_name: txt(r?.['company_legal_name'] as string),
    company_email: txt(r?.['company_email'] as string),
    classification: txt(r?.['classification'] as string),
    special_classification: txt(r?.['special_classification'] as string),
    third_party_id: r ? String(r['third_party_id'] ?? '') : '',
    fiscal_area: txt(r?.['fiscal_area'] as string),
    fiscal_area_cesco: txt(r?.['fiscal_area_cesco'] as string),
    fp_subgroup: txt(r?.['fp_subgroup'] as string),
    is_active: r ? Boolean(r['is_active']) : true,
    // La fecha de ingreso siempre es hoy, como en el original.
    entry_date: hoyISO(),
  }),
  aRegistro: (v) => ({
    period: num(v['period']),
    company_name: txt(v['company_name']),
    company_code: codigoCompania(txt(v['company_name'])),
    product: txt(v['product']),
    long_contract: num(v['long_contract']),
    short_contract: num(v['short_contract']),
    policyholder_id: num(v['policyholder_id']),
    policyholder_name: txt(v['policyholder_name']),
    policyholder_document_number: txt(v['policyholder_document_number']),
    policyholder_document_type: txt(v['policyholder_document_type']),
    paid_premiums_count: num(v['paid_premiums_count']),
    premium_value: num(v['premium_value']),
    paid_value: num(v['paid_value']),
    prime_over_2m: Boolean(v['prime_over_2m']),
    policyholder_prime_over_2m: Boolean(v['policyholder_prime_over_2m']),
    // El mapper del API la convierte a yyyy-MM-dd.
    expected_payment_date: aUIDesdeIso(txt(v['expected_payment_date'])),
    rule: txt(v['rule']),
    commission_type: txt(v['commission_type']),
    commission_value: num(v['commission_value']),
    base_value: num(v['base_value']),
    channel_id: codigoCanal(txt(v['channel_description'])),
    channel_description: txt(v['channel_description']),
    agent_id: num(v['agent_id']),
    agent_type_id: num(v['agent_type_id']),
    agent_name: txt(v['agent_name']),
    company_id: num(v['company_id']),
    company_legal_name: txt(v['company_legal_name']),
    company_email: txt(v['company_email']),
    classification: txt(v['classification']),
    special_classification: txt(v['special_classification']),
    third_party_id: num(v['third_party_id']),
    fiscal_area: txt(v['fiscal_area']),
    fiscal_area_cesco: txt(v['fiscal_area_cesco']),
    fp_subgroup: txt(v['fp_subgroup']),
    is_active: Boolean(v['is_active']),
    updated_at: '',
  }),
  // Cambiar el tipo de documento limpia el número (cambia su formato válido).
  derivar: (key, v) => {
    if (key !== 'policyholder_document_type') return v;
    return { ...v, policyholder_document_number: '' };
  },
  validar: (v): Record<string, string> => {
    const tipo = txt(v['policyholder_document_type']);
    const numero = txt(v['policyholder_document_number']);
    if (tipo && numero && !documentoValido(tipo, numero)) {
      return {
        policyholder_document_number:
          'El número de documento no corresponde al formato del tipo seleccionado',
      };
    }
    return {};
  },
};

// ── 8. Casos especiales ─────────────────────────────────────────────────────

const CASOS_ESPECIALES: SeccionSpec = {
  id: 'casosEspeciales',
  titulo: 'Casos Especiales',
  placeholderBusqueda: 'Buscar por compañía, ID Agente, Sociedad o Clasificación...',
  botonCrear: 'Crear Registro',
  anchoMinimo: '1000px',
  formColumnas: 2,
  formAncho: '620px',
  tituloCrear: 'Crear Caso Especial',
  descCrear: 'Ingresa los detalles para registrar un nuevo caso especial.',
  tituloEditar: 'Editar Caso Especial',
  descEditar: () => 'Modifica los detalles del caso especial seleccionado.',
  columnas: [
    { key: 'NombreCompania', label: 'Nombre Compañía' },
    { key: 'IdAgte', label: 'IdAgte', tipo: 'mono' },
    { key: 'IdSociedad', label: 'IdSociedad', tipo: 'mono' },
    { key: 'ClasificacionEspecial', label: 'Clasificación Especial' },
    { key: 'Activo', label: 'Activo', tipo: 'switch' },
    {
      key: 'UltimaActualizacion',
      label: 'Última Actualización',
      tipo: 'fecha',
      filtro: 'fecha',
    },
  ],
  buscarEn: (r) => [
    r['NombreCompania'],
    r['IdAgte'],
    r['IdSociedad'],
    r['ClasificacionEspecial'],
  ],
  campos: () => [
    {
      key: 'NombreCompania',
      label: 'Nombre Compañía',
      tipo: 'select',
      requerido: true,
      opciones: companyOptions,
      ancho: 'full',
    },
    { key: 'IdAgte', label: 'ID Agente', tipo: 'numero', requerido: true, maxLength: 15 },
    { key: 'IdSociedad', label: 'ID Sociedad', tipo: 'numero', requerido: true, maxLength: 15 },
    {
      key: 'ClasificacionEspecial',
      label: 'Clasificación Especial',
      tipo: 'texto',
      requerido: true,
      maxLength: 50,
      placeholder: 'Ej: Especial1',
      ancho: 'full',
    },
    { key: 'Activo', label: 'Estado Activo', tipo: 'switch', ayuda: 'Estado del registro' },
  ],
  aFormulario: (r) => ({
    NombreCompania: txt(r?.['NombreCompania'] as string),
    IdAgte: r ? String(r['IdAgte'] ?? '') : '',
    IdSociedad: r ? String(r['IdSociedad'] ?? '') : '',
    ClasificacionEspecial: txt(r?.['ClasificacionEspecial'] as string),
    Activo: r ? Boolean(r['Activo']) : true,
  }),
  aRegistro: (v) => ({
    NombreCompania: txt(v['NombreCompania']),
    CodigoCompania: codigoCompania(txt(v['NombreCompania'])),
    IdAgte: num(v['IdAgte']),
    IdSociedad: num(v['IdSociedad']),
    ClasificacionEspecial: txt(v['ClasificacionEspecial']),
    Activo: Boolean(v['Activo']),
  }),
};

/** dd/MM/yyyy → yyyy-MM-dd para el input date, y de vuelta. */
function aIsoDesdeUI(v: string): string {
  if (!v) return '';
  if (v.includes('/')) {
    const p = v.split('/');
    return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  return v.slice(0, 10);
}

function aUIDesdeIso(v: string): string {
  if (!v) return '';
  if (v.includes('/')) return v;
  const p = v.slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v;
}

export const SECCIONES: Record<SeccionId, SeccionSpec> = {
  contabilidad: CONTABILIDAD,
  tiposComision: TIPOS_COMISION,
  diferidos: DIFERIDOS,
  diferidosParam: DIFERIDOS_PARAM,
  configContrato: CONFIG_CONTRATO,
  configProducto: CONFIG_PRODUCTO,
  ajustesComisiones: AJUSTES,
  casosEspeciales: CASOS_ESPECIALES,
};

/** Pestañas principales y qué secciones muestra cada una, en orden. */
export const VISTAS: { value: string; label: string; secciones: SeccionId[] }[] = [
  { value: 'contabilidad', label: 'Contabilidad', secciones: ['contabilidad', 'tiposComision'] },
  { value: 'diferidos', label: 'Diferidos', secciones: ['diferidos', 'diferidosParam'] },
  { value: 'bonos_carbono', label: 'Config. Contrato', secciones: ['configContrato'] },
  {
    value: 'patrimonios_autonomos',
    label: 'Config. Producto',
    secciones: ['configProducto'],
  },
  {
    value: 'config_comisiones',
    label: 'Ajustes Comisiones',
    secciones: ['ajustesComisiones'],
  },
  { value: 'casos_especiales', label: 'Casos Especiales', secciones: ['casosEspeciales'] },
];
