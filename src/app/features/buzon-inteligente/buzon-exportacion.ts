// Funciones puras de la exportación del Buzón Inteligente 2.0, portadas de
// alma-backend app/services/buzon_exportacion.py. El backend genera los archivos
// reales; aquí se usan para la cobertura de salidas por etiqueta, el «Así se
// llamará» del nombre de archivo, detectar las listas del JSON y simular la
// vista previa y la lectura del modelo en el modo demostración.

import type { Base, ColumnaPlantilla, FilaBase, FormatoColumna, ModoSalida, OrigenColumna, Plantilla, PlantillaIn, Proceso, Salida, TipoOrigen } from './buzon.api';
import { coincide, normaliza } from './buzon-asignacion';

/** Primera salida activa (por orden) que cubre la etiqueta; `etiquetas` null = todas. */
export function salidaPara<T extends Pick<Salida, 'activa' | 'etiquetas'>>(salidas: T[], etiqueta: string): T | null {
  const clave = etiqueta.toUpperCase();
  return salidas.find((s) => s.activa && (s.etiquetas === null || s.etiquetas.some((e) => e.toUpperCase() === clave))) ?? null;
}

/** Salidas (con archivo) que cubren una etiqueta, en orden. */
export function salidasDe<T extends Pick<Salida, 'activa' | 'etiquetas' | 'modo'>>(salidas: T[], etiqueta: string): T[] {
  const clave = etiqueta.toUpperCase();
  return salidas.filter((s) => s.activa && s.modo !== 'ninguno' && (s.etiquetas === null || s.etiquetas.some((e) => e.toUpperCase() === clave)));
}

const simple = (v: unknown) => v === null || (typeof v !== 'object' && typeof v !== 'function');

/** Cargue_{codigo_pac}_{fecha} → Cargue_PC0342_2026-10-27.xlsx */
export function nombreArchivo(patron: string, datos: Record<string, unknown>, meta: Record<string, string>, formato: string): string {
  const valores: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(datos).filter(([, v]) => simple(v))),
    ...meta,
    fecha: meta['hoy'] ?? new Date().toISOString().slice(0, 10),
  };
  let texto = (patron || 'archivo').replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k: string) => String(valores[k] ?? ''));
  texto = texto.replace(/[\\/:*?"<>|\r\n]+/g, '_').replace(/^[ ._]+|[ ._]+$/g, '') || 'archivo';
  if (texto.toLowerCase().endsWith('.' + formato)) texto = texto.slice(0, -(formato.length + 1));
  return texto.slice(0, 190).replace(/[ ._]+$/, '') + '.' + formato;
}

/** Listas de objetos del JSON (candidatas a «una fila por elemento») con los campos de sus elementos. */
export function listasDelJson(datos: Record<string, unknown> | null | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  Object.entries(datos ?? {}).forEach(([k, v]) => {
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
      out[k] = [...new Set(v.flatMap((x) => Object.keys(x as object)))];
    }
  });
  return out;
}

export function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  let t = String(v).replace(/[^\d,.-]/g, '');
  if (!t || '-.,'.includes(t)) return null;
  if (t.includes(',') && t.includes('.')) {
    const decimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
    t = t.split(decimal === ',' ? '.' : ',').join('').replace(',', '.');
  } else if (t.includes(',')) {
    const partes = t.split(',');
    t = partes.slice(1).every((p) => p.length === 3) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if ((t.match(/\./g) ?? []).length > 1 || (t.split('.').length === 2 && t.split('.')[1].length === 3)) {
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function fecha(v: unknown): string | null {
  const t = String(v ?? '').trim().slice(0, 10);
  let m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(t);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(t);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : null;
}

/** Texto de la celda según el formato (como se vería en Excel). */
export function conFormato(v: unknown, formato: FormatoColumna): string {
  if (v === null || v === undefined || v === '') return '';
  if (formato === 'numero' || formato === 'moneda' || formato === 'entero') {
    const n = numero(v);
    if (n === null) return String(v);
    if (formato === 'entero') return String(Math.round(n));
    return formato === 'moneda' ? n.toLocaleString('es-CO', { maximumFractionDigits: 0 }) : String(n);
  }
  if (formato === 'fecha') return fecha(v) ?? String(v);
  if (Array.isArray(v)) return v.join(', ');
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

function listaPrincipal(datos: Record<string, unknown>, detalle: string | null): Record<string, unknown>[] {
  if (detalle) {
    const l = datos[detalle];
    return Array.isArray(l) ? l.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
  }
  const listas = Object.values(datos).filter(
    (v): v is Record<string, unknown>[] => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === 'object'),
  );
  return listas.sort((a, b) => b.length - a.length)[0] ?? [];
}

function ctxFila(datos: Record<string, unknown>, item: Record<string, unknown> | null): Record<string, unknown> {
  return { ...Object.fromEntries(Object.entries(datos).filter(([, v]) => simple(v))), ...(item ?? {}) };
}

function valorColumna(o: OrigenColumna, ctx: Record<string, unknown>, meta: Record<string, string>, fila: number, filaExcel: number, bases: Record<string, Base & { filas: FilaBase[] }>): unknown {
  switch (o.tipo) {
    case 'campo':
      return ctx[(o.campo ?? '').split('.').pop() ?? ''] ?? '';
    case 'fijo':
      return o.valor ?? '';
    case 'correo':
      return meta[o.dato ?? ''] ?? '';
    case 'fila':
      return fila;
    case 'base': {
      const base = bases[o.base_id ?? ''];
      const valor = ctx[o.campo ?? ''];
      if (!base || valor === undefined || valor === '') return '';
      const comp = o.comparacion ?? 'exacta';
      const nv = normaliza(valor, comp);
      return base.filas.find((f) => coincide(nv, f[o.columna_busqueda ?? ''], comp))?.[o.columna_resultado ?? ''] ?? '';
    }
    case 'formula':
      return (o.formula ?? '').replace(/\{fila\}/g, String(filaExcel));
    default:
      return '';
  }
}

/** Celdas del archivo como texto: plantilla o, sin plantilla, «tabla según el JSON». */
export function matriz(
  plantilla: Pick<Plantilla, 'titulo' | 'columnas' | 'detalle'> | null,
  datos: Record<string, unknown>,
  meta: Record<string, string>,
  bases: Record<string, Base & { filas: FilaBase[] }> = {},
): { titulo: string[][]; encabezados: string[]; filas: string[][] } {
  if (!plantilla) {
    const simples = Object.keys(datos).filter((k) => simple(datos[k]));
    const items = listaPrincipal(datos, null);
    const sub = [...new Set(items.flatMap((it) => Object.keys(it)))].filter((k) => !simples.includes(k));
    const cols = [...simples, ...sub];
    const ctxs = items.length ? items.map((it) => ctxFila(datos, it)) : [ctxFila(datos, null)];
    return { titulo: [], encabezados: cols, filas: ctxs.map((c) => cols.map((k) => conFormato(c[k], 'texto'))) };
  }
  const items = listaPrincipal(datos, plantilla.detalle);
  const ctxs = items.length ? items.map((it) => ctxFila(datos, it)) : [ctxFila(datos, null)];
  const primera = plantilla.titulo.length + 2;
  return {
    titulo: plantilla.titulo,
    encabezados: plantilla.columnas.map((c) => c.encabezado),
    filas: ctxs.map((ctx, i) =>
      plantilla.columnas.map((c) =>
        conFormato(valorColumna(c.origen, ctx, meta, i + 1, primera + i, bases), c.origen.tipo === 'formula' ? 'texto' : c.formato),
      ),
    ),
  };
}

const tokens = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);

const SINONIMOS: [string[], string[]][] = [
  [['VALOR', 'MONTO', 'IMPORTE', 'APORTE', 'TOTAL'], ['monto', 'valor', 'valor_aporte', 'valor_total']],
  [['DOCUMENTO', 'CEDULA', 'IDENTIFICACION', 'CC'], ['cedula', 'identificacion', 'numero_identificacion', 'documento']],
  [['NIT'], ['nit_']],
  [['CONTRATO', 'ENCARGO', 'POLIZA'], ['contrato', 'encargo', 'poliza']],
  [['NOMBRE', 'AFILIADO', 'PARTICIPE'], ['nombre']],
  [['FECHA'], ['fecha_aporte', 'fecha_pago', 'fecha']],
  [['BANCO'], ['banco']],
  [['CODIGO', 'PLAN', 'PC'], ['codigo_pac', 'codigo']],
];

/** Origen propuesto (✦) para un encabezado, o null. Misma idea que el backend. */
export function sugerirColumna(encabezado: string, campos: string[]): OrigenColumna | null {
  const enc = tokens(encabezado);
  if (!enc.length) return null;
  const texto = enc.join(' ');
  if (['CONSECUTIVO', 'ITEM', 'N', 'NO', 'NRO', 'FILA', 'SECUENCIA'].includes(texto) || texto.startsWith('CONSECUTIVO')) return { tipo: 'fila' };
  let mejor: [number, number, number, string] | null = null;
  for (const campo of campos) {
    const ct = tokens(campo.replace(/[_.]/g, ' '));
    const comunes = ct.filter((t) => enc.includes(t)).length;
    if (ct.length && comunes && comunes / ct.length >= 0.5) {
      const cand: [number, number, number, string] = [comunes / ct.length, comunes, -ct.length, campo];
      if (!mejor || cand[0] > mejor[0] || (cand[0] === mejor[0] && (cand[1] > mejor[1] || (cand[1] === mejor[1] && cand[2] > mejor[2])))) mejor = cand;
    }
  }
  if (mejor) return { tipo: 'campo', campo: mejor[3] };
  for (const [claves, preferidos] of SINONIMOS) {
    if (claves.some((k) => texto.split(' ').includes(k) || texto.startsWith(k))) {
      for (const pref of preferidos) {
        const c = campos.find((x) => {
          const hoja = x.split('.').pop() ?? x;
          return hoja === pref || (pref.endsWith('_') && hoja.startsWith(pref)) || hoja.split('_').includes(pref);
        });
        if (c) return { tipo: 'campo', campo: c };
      }
    }
  }
  return null;
}

/** Una columna está lista cuando su origen tiene todo lo que necesita. */
export function faltaEnColumna(c: ColumnaPlantilla): string | null {
  const o = c.origen;
  if (!c.encabezado.trim()) return 'no tiene nombre';
  switch (o.tipo) {
    case 'vacio':
      return 'elige de dónde sale el valor';
    case 'campo':
      return o.campo ? null : 'elige el dato del correo';
    case 'fijo':
      return o.valor?.trim() ? null : 'escribe el texto fijo';
    case 'correo':
      return o.dato ? null : 'elige la información del correo';
    case 'base':
      return o.base_id && o.campo && o.columna_busqueda && o.columna_resultado ? null : 'completa la base, el dato y las dos columnas';
    case 'formula':
      return (o.formula ?? '').startsWith('=') ? null : 'la fórmula debe empezar con «=»';
    default:
      return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Prototipo validado (contexto-recaudos-pac/buzon-inteligente-v2.html): salidas
// por proceso (salidasUI), constructor de plantillas en tres pasos (tplBuilder)
// y su vista previa con datos ficticios (previewTpl). Mismas reglas, sobre el
// modelo de Alma: la plantilla es una fila propia y la salida la referencia.
// ═════════════════════════════════════════════════════════════════════════════

/** Columna del constructor: la de la API + ✦ (propuesta de Alma por el nombre). */
export interface ColForm extends ColumnaPlantilla {
  sug?: boolean;
}

/** Modelo leído en el navegador: filas crudas de cada hoja, para elegir hoja y fila de encabezados. */
export interface ModeloVista {
  file: string;
  /** No se pudo leer: se muestra la vista de ejemplo. */
  demo: boolean;
  hojas: Record<string, string[][]>;
  orden: string[];
  hoja: string;
  fila: number;
}

export type PasoTpl = 1 | 2 | 3;

/** Plantilla en edición (mutable, como `S.tb.t` del prototipo) + estado del constructor. */
export interface TplForm {
  /** null = aún no se ha guardado. */
  id: string | null;
  nombre: string;
  formato: 'xlsx' | 'csv';
  separador: string;
  hoja: string;
  nombre_archivo: string;
  titulo: string[][];
  columnas: ColForm[];
  detalle: string | null;
  modelo: string | null;
  paso: PasoTpl;
  /** Columna seleccionada en el paso ②. */
  sel: number;
  vista: ModeloVista | null;
  /** Filas del modelo debajo de los encabezados (ejemplo para las columnas sin asignar). */
  muestra: string[][];
  msg: string;
  /** Cambió desde el último guardado. */
  sucio: boolean;
}

/** Dato del JSON para las columnas: [ruta, lista a la que pertenece ('' = dato simple)]. */
export type CampoExp = [string, string];

/** Salida en edición. `etiquetas`: 'todas' o las claves a las que aplica. */
export interface SalidaUI {
  uid: number;
  nombre: string;
  modo: ModoSalida;
  etiquetas: 'todas' | string[];
  plantilla_id: string | null;
  activa: boolean;
  tpl: TplForm | null;
}

export type VistaCeldas = 'val' | 'form';

/** Orígenes en el lenguaje del prototipo (chips de «¿De dónde sale el valor?»). */
export const ORIGENES_TPL: { id: 'campo' | 'fijo' | 'base' | 'formula' | 'correo'; nombre: string; icon: string; campo: string }[] = [
  { id: 'campo', nombre: 'Dato del correo (JSON)', icon: 'braces', campo: 'Dato del JSON' },
  { id: 'fijo', nombre: 'Texto fijo', icon: 'type', campo: 'Texto fijo' },
  { id: 'base', nombre: 'Columna de una base', icon: 'sheet', campo: 'Columna de la base' },
  { id: 'formula', nombre: 'Fórmula', icon: 'sigma', campo: 'Fórmula' },
  { id: 'correo', nombre: 'Información del correo', icon: 'mail', campo: 'Información del correo' },
];

/** El chip de origen que corresponde al tipo («Número de fila» es la fórmula FILA()). */
export function origenTpl(t: TipoOrigen): string {
  return t === 'fila' ? 'formula' : t;
}

const LISTA = new Set(['lista', 'tabla']);

/** El proceso extrae datos (si no, solo categoriza y no genera archivo). */
export function extrae(p: Proceso): boolean {
  return p.clave.toUpperCase() !== 'OTROS' && p.campos_extraer.length > 0;
}

/** Datos para las columnas: los simples y, de cada lista, «lista.campo» (campos vistos en los correos). */
export function camposExp(p: Proceso, listasJson: Record<string, string[]>): CampoExp[] {
  if (!extrae(p)) return [];
  const out: CampoExp[] = [];
  p.campos_extraer.forEach((c) => {
    if (LISTA.has(c.tipo ?? '') || listasJson[c.clave]) (listasJson[c.clave] ?? []).forEach((a) => out.push([`${c.clave}.${a}`, c.clave]));
    else out.push([c.clave, '']);
  });
  return out;
}

/** Listas de objetos del proceso (candidatas a «una fila por elemento»). */
export function listasDe(p: Proceso, listasJson: Record<string, string[]>): string[] {
  return p.campos_extraer.filter((c) => LISTA.has(c.tipo ?? '') || listasJson[c.clave]).map((c) => c.clave);
}

export function salidaNueva(p: Proceso, uid: number): SalidaUI {
  const ex = extrae(p);
  return { uid, nombre: ex ? `Tabla ${p.clave}` : 'Sin archivo', modo: ex ? 'tabla' : 'ninguno', etiquetas: 'todas', plantilla_id: null, activa: true, tpl: null };
}

export function salidaCubre(s: Pick<SalidaUI, 'etiquetas'>, et: string): boolean {
  return s.etiquetas === 'todas' || s.etiquetas.includes(et);
}

/** Por etiqueta, las salidas con archivo que la cubren. */
export function coberturaExp(p: Proceso, salidas: SalidaUI[]): [string, SalidaUI[]][] {
  return p.etiquetas.map((e) => [e, salidas.filter((s) => s.activa && s.modo !== 'ninguno' && salidaCubre(s, e))]);
}

/** Lo que impide dar por lista la exportación de un proceso (paso 5 del asistente). */
export function salidasFaltan(p: Proceso, salidas: SalidaUI[]): string[] {
  const out: string[] = [];
  salidas.forEach((s) => {
    if (s.etiquetas !== 'todas' && !s.etiquetas.length) out.push(`${p.clave} · «${s.nombre}» no aplica a ninguna etiqueta`);
    if (s.modo === 'plantilla' && tplIncompleto(s.tpl).length) out.push(`${p.clave} · «${s.nombre}»: plantilla incompleta`);
  });
  return out;
}

export function tplVacia(nombre: string, listas: string[]): TplForm {
  return {
    id: null,
    nombre: nombre || 'Mi plantilla',
    formato: 'xlsx',
    separador: ';',
    hoja: 'Datos',
    nombre_archivo: '',
    titulo: [],
    columnas: [],
    detalle: listas[0] ?? null,
    modelo: null,
    paso: 1,
    sel: 0,
    vista: null,
    muestra: [],
    msg: '',
    sucio: true,
  };
}

/** «Armarla desde los datos del JSON» o «Empezar en blanco». */
export function tplNuevo(desde: 'json' | 'cero', campos: CampoExp[], listas: string[], nombre: string): TplForm {
  const t = tplVacia(nombre, listas);
  t.nombre_archivo = '{proceso}_{fecha}';
  t.paso = 2;
  if (desde === 'json') {
    t.columnas = campos
      .filter((c) => !listas.length || c[1] === listas[0] || !c[1])
      .map((c) => ({
        encabezado: (c[0].split('.').pop() ?? c[0]).replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()),
        origen: { tipo: 'campo', campo: c[0] },
        formato: /valor|monto|total/.test(c[0]) ? 'moneda' : /fecha/.test(c[0]) ? 'fecha' : 'texto',
      }));
    const id = campos.find((c) => /numero|nit|codigo|cedula/.test(c[0]) && !c[1]);
    if (id) t.nombre_archivo = `{${id[0]}}_{fecha}`;
  } else t.columnas = [{ encabezado: 'Columna 1', origen: { tipo: 'vacio' }, formato: 'texto' }];
  return t;
}

export function tplDePlantilla(p: Plantilla): TplForm {
  return {
    id: p.id,
    nombre: p.nombre,
    formato: p.formato,
    separador: p.separador,
    hoja: p.hoja,
    nombre_archivo: p.nombre_archivo,
    titulo: p.titulo.map((r) => [...r]),
    columnas: p.columnas.map((c) => ({ ...c, origen: { ...c.origen } })),
    detalle: p.detalle,
    modelo: p.modelo,
    paso: p.columnas.length ? 2 : 1,
    sel: 0,
    vista: null,
    muestra: [],
    msg: '',
    sucio: false,
  };
}

/** Qué le falta a una columna: el origen, el valor o nada. */
export function colFalta(c: ColumnaPlantilla): 'origen' | 'valor' | null {
  const o = c.origen;
  switch (o.tipo) {
    case 'vacio':
      return 'origen';
    case 'campo':
      return o.campo?.trim() ? null : 'valor';
    case 'correo':
      return o.dato ? null : 'valor';
    case 'formula':
      return (o.formula ?? '').replace(/^=/, '').trim() ? null : 'valor';
    case 'base':
      return o.base_id && o.campo && o.columna_busqueda && o.columna_resultado ? null : 'valor';
    default:
      return null;
  }
}

export function tplIncompleto(t: TplForm | null): string[] {
  if (!t) return ['Sin diseño de plantilla.'];
  const out: string[] = [];
  if (t.nombre.trim().length < 2) out.push('Ponle nombre a la plantilla.');
  if (!t.columnas.length) out.push('Sube tu plantilla o agrega al menos una columna.');
  t.columnas.forEach((c, i) => {
    const f = colFalta(c);
    if (!c.encabezado.trim()) out.push(`La columna ${i + 1} no tiene nombre.`);
    else if (f === 'origen') out.push(`«${c.encabezado}»: elige de dónde sale el valor.`);
    else if (f) out.push(`«${c.encabezado}»: falta el valor.`);
  });
  if (!t.nombre_archivo.trim()) out.push('Define el nombre del archivo.');
  return out;
}

/** Se puede guardar (aunque esté incompleta: lo que falta se guarda como «sin asignar»). */
export function tplGuardable(t: TplForm): boolean {
  return t.nombre.trim().length >= 2 && t.columnas.length > 0;
}

export function cuerpoTpl(t: TplForm): PlantillaIn {
  const limpio = (c: ColForm): OrigenColumna => {
    if (colFalta(c)) return { tipo: 'vacio' };
    const o = c.origen;
    switch (o.tipo) {
      case 'campo':
        return { tipo: 'campo', campo: (o.campo ?? '').trim() };
      case 'fijo':
        return { tipo: 'fijo', valor: o.valor ?? '' };
      case 'correo':
        return { tipo: 'correo', dato: o.dato };
      case 'base':
        return { tipo: 'base', base_id: o.base_id, campo: o.campo, columna_busqueda: o.columna_busqueda, columna_resultado: o.columna_resultado, comparacion: o.comparacion ?? 'exacta' };
      case 'formula':
        return { tipo: 'formula', formula: '=' + (o.formula ?? '').trim().replace(/^=/, '') };
      default:
        return { tipo: o.tipo };
    }
  };
  return {
    nombre: t.nombre.trim(),
    formato: t.formato,
    separador: t.separador || ';',
    hoja: (t.hoja.trim() || 'Datos').slice(0, 31),
    nombre_archivo: t.nombre_archivo.trim() || t.nombre.trim(),
    titulo: t.titulo
      .filter((r) => r.some((c) => String(c).trim()))
      .slice(0, 10)
      .map((r) => r.map((c) => String(c))),
    columnas: t.columnas.map((c, i) => ({ encabezado: c.encabezado.trim() || `Columna ${i + 1}`, formato: c.formato, origen: limpio(c) })),
    detalle: t.detalle || null,
    modelo: t.modelo,
  };
}

// ── Lectura del modelo del usuario: .csv directo; .xlsx con SheetJS (si no carga, vista de ejemplo) ──

export function nrm(v: unknown): string {
  return String(v ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9@.]/g, '');
}

export type ModeloLeidoLocal = Omit<ModeloVista, 'hoja' | 'fila'>;

/** Vista de ejemplo (datos ficticios) cuando el archivo no se puede leer. */
export function modeloDemo(name?: string): ModeloLeidoLocal {
  return {
    file: name || 'MODELO_CARGUE.xlsx',
    demo: true,
    hojas: {
      Cargue: [
        ['CARGUE DE APORTES'],
        [''],
        ['CONSECUTIVO', 'DOCUMENTO', 'NOMBRE', 'VALOR', 'FECHA', 'OBSERVACION'],
        ['1', '79000001', 'PEDRO EJEMPLO', '1250000', '2026-10-15', ''],
        ['2', '52987654', 'ANA DEMO', '980000', '2026-10-15', ''],
      ],
      Instrucciones: [['Llenar desde la fila 4']],
    },
    orden: ['Cargue', 'Instrucciones'],
  };
}

export async function leerModeloArchivo(f: File): Promise<{ mod: ModeloLeidoLocal; aviso: string }> {
  if (/\.csv$/i.test(f.name)) {
    const lines = (await f.text()).split(/\r?\n/).filter((l) => l.trim());
    const sep = (lines[0] ?? '').includes(';') ? ';' : ',';
    const filas = lines.slice(0, 60).map((l) => l.split(sep).map((x) => x.trim().replace(/^"|"$/g, '')));
    return { mod: { file: f.name, demo: false, hojas: { CSV: filas }, orden: ['CSV'] }, aviso: '' };
  }
  let XLSX: typeof import('xlsx');
  try {
    XLSX = await import('xlsx');
  } catch {
    return { mod: modeloDemo(f.name), aviso: 'El lector de Excel no cargó: se muestra una vista de ejemplo.' };
  }
  try {
    const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
    const hojas: Record<string, string[][]> = {};
    wb.SheetNames.forEach((n) => {
      hojas[n] = XLSX.utils
        .sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, blankrows: true, defval: '', raw: false })
        .slice(0, 60)
        .map((row) => row.map((c) => String(c ?? '')));
    });
    return { mod: { file: f.name, demo: false, hojas, orden: wb.SheetNames }, aviso: '' };
  } catch (er) {
    return { mod: modeloDemo(f.name), aviso: `No se pudo leer el archivo (${er instanceof Error ? er.message : String(er)}): se muestra una vista de ejemplo.` };
  }
}

/** Primera fila (de las 10 primeras) con al menos dos celdas con texto. */
export function filaEncabezado(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) if (rows[i].filter((c) => String(c).trim()).length >= 2) return i;
  return 0;
}

/** Columna propuesta (✦) para un encabezado del modelo. */
export function sugerirCol(h: string, campos: CampoExp[]): ColForm {
  const n = nrm(h);
  const f: FormatoColumna = /VALOR|MONTO|TOTAL|APORTE/.test(n) ? 'moneda' : /FECHA/.test(n) ? 'fecha' : 'texto';
  const o = sugerirColumna(h, campos.map((c) => c[0]));
  if (o) return { encabezado: h, origen: o, formato: o.tipo === 'fila' ? 'numero' : f, sug: true };
  if (/FECHA/.test(n)) return { encabezado: h, origen: { tipo: 'correo', dato: 'fecha' }, formato: 'fecha', sug: true };
  if (/ASUNTO/.test(n)) return { encabezado: h, origen: { tipo: 'correo', dato: 'asunto' }, formato: 'texto', sug: true };
  return { encabezado: h, origen: { tipo: 'vacio' }, formato: f };
}

/** Toma las columnas del modelo: las que coinciden por nombre conservan lo asignado. Devuelve cuántas se conservaron. */
export function aplicarModelo(t: TplForm, mod: ModeloLeidoLocal, hoja: string, fila: number, campos: CampoExp[]): number {
  const rows = mod.hojas[hoja] ?? [];
  const enc = (rows[fila] ?? []).map((x) => String(x).trim());
  const prev = new Map(t.columnas.map((c) => [nrm(c.encabezado), c]));
  const cols: ColForm[] = [];
  const idx: number[] = [];
  let conservadas = 0;
  enc.forEach((h, k) => {
    if (!h) return;
    idx.push(k);
    const p = prev.get(nrm(h));
    if (p) {
      conservadas++;
      cols.push({ ...p, origen: { ...p.origen }, encabezado: h });
    } else cols.push(sugerirCol(h, campos));
  });
  t.columnas = cols;
  t.vista = { ...mod, hoja, fila };
  t.modelo = mod.file;
  t.muestra = rows.slice(fila + 1, fila + 3).map((r) => idx.map((k) => r[k] ?? ''));
  if (hoja !== 'CSV') t.hoja = hoja.slice(0, 31);
  t.sel = 0;
  // Lo que está arriba de los encabezados se conserva como título.
  const arriba = rows.slice(0, fila).filter((r) => r.some((c) => String(c).trim()));
  t.titulo = arriba.map((r) => r.slice(0, Math.max(enc.length, 1)));
  if (arriba.length && (!t.nombre.trim() || /^Plantilla |^Mi plantilla/.test(t.nombre))) t.nombre = arriba[0].filter((c) => String(c).trim()).join(' ');
  if (!t.nombre_archivo.trim()) t.nombre_archivo = mod.file.replace(/\.[a-z]+$/i, '') + '_{fecha}';
  return conservadas;
}

// ── Vista previa con datos ficticios ──

export function letra(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function valorEjemplo(campo: string): string {
  if (/fecha/.test(campo)) return '2026-10-15';
  if (/nit/.test(campo)) return '900000001';
  if (/cedula|identificacion/.test(campo)) return '79000001';
  if (/valor|monto|total/.test(campo)) return '1250000';
  if (/numero|codigo|poliza|factura/.test(campo)) return 'DEMO-0001';
  if (/moneda/.test(campo)) return 'COP';
  return 'Ejemplo';
}

/** Valor ficticio de un dato del JSON en la fila i. */
export function valorCampoEj(campo: string, i: number): string {
  const k = campo.split('.').pop() ?? '';
  if (/fecha/.test(k)) return '2026-10-15';
  if (/tipo_identificacion/.test(k)) return 'C';
  if (/identificacion|cedula/.test(k)) return String(79000001 + i);
  if (/subcuenta/.test(k)) return 'G';
  if (/pct/.test(k)) return '4';
  if (/valor|aporte|monto|total/.test(k)) return String(1250000 + i * 250000);
  if (/codigo_pac/.test(k)) return 'PC0001';
  return valorEjemplo(k);
}

const META_EJ: Record<string, (i: number) => string> = {
  asunto: () => 'Asunto de ejemplo',
  remitente: () => 'remitente@ejemplo.com',
  fecha: () => '2026-10-20',
  radicado: (i) => `DEMO000${i + 1}`,
  etiqueta: () => 'ETIQUETA',
};

function calculoEj(f: string, i: number): string {
  return /FILA/i.test(f) ? String(i + 1) : /CONTAR/i.test(f) ? '2' : /SUMA|valor/i.test(f) ? '2500000' : '0';
}

/** Valor ficticio de una columna en la fila i. */
export function valorColEj(c: ColumnaPlantilla, i: number, sv: VistaCeldas): string {
  const o = c.origen;
  switch (o.tipo) {
    case 'fijo':
      return o.valor ?? '';
    case 'correo':
      return META_EJ[o.dato ?? '']?.(i) ?? '';
    case 'base':
      return o.columna_resultado ? valorEjemplo(o.columna_resultado.toLowerCase()) : '';
    case 'formula': {
      const f = (o.formula ?? '').replace(/^=/, '');
      return sv === 'form' ? '=' + f : calculoEj(f, i);
    }
    case 'fila':
      return sv === 'form' ? '=FILA()' : String(i + 1);
    case 'campo':
      return valorCampoEj(o.campo ?? '', i);
    default:
      return '';
  }
}

/** Texto de la celda según el formato (vista previa). */
export function fmtV(v: string, f: FormatoColumna | 'fecha_dmy'): string {
  if (!v) return '';
  const dig = v.replace(/[^\d.-]/g, '');
  const n = Number(dig);
  const num = !v.startsWith('=') && dig !== '' && !isNaN(n);
  if (f === 'moneda' && num) return '$ ' + n.toLocaleString('es-CO');
  if (f === 'numero' && num) return String(n);
  if (f === 'entero' && num) return String(Math.round(n));
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (f === 'fecha' && m) return `${m[3]}/${m[2]}/${m[1]}`;
  if (f === 'fecha_dmy' && m) return `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
  return v;
}

/** «Así se llamará» con datos ficticios (sin extensión). */
export function nombreArchivoEj(t: Pick<TplForm, 'nombre_archivo'>, proceso: string): string {
  return t.nombre_archivo.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, k: string) =>
    k === 'proceso' ? proceso || 'PROCESO' : k === 'fecha' || k === 'hoy' ? '2026-10-20' : META_EJ[k] ? META_EJ[k](0) : valorCampoEj(k, 0),
  );
}

export interface CeldaHoja {
  v: string;
  cls?: string;
  th?: boolean;
  b?: boolean;
  span?: number;
}

/** Hoja de la vista previa: letras de columna, filas (h = resaltada) y pestañas. */
export interface HojaVista {
  letras: string[];
  filas: { h: boolean; celdas: CeldaHoja[] }[];
  hojas: string[];
  archivo: string;
  detalle: string | null;
}

export function previewTpl(t: TplForm, sv: VistaCeldas, proceso: string): HojaVista {
  const nc = Math.max(t.columnas.length, 1);
  const filas: HojaVista['filas'] = [];
  t.titulo.forEach((r) => filas.push({ h: true, celdas: [{ v: r.filter((c) => String(c).trim()).join(' '), b: true, span: nc }] }));
  filas.push({ h: true, celdas: t.columnas.map((c) => ({ v: c.encabezado || '…', th: true })) });
  for (let i = 0; i < (t.detalle ? 2 : 1); i++) {
    filas.push({
      h: false,
      celdas: t.columnas.map((c) => {
        const tipo = c.origen.tipo;
        const v = fmtV(valorColEj(c, i, sv), c.formato);
        return {
          v: v || (tipo === 'vacio' ? '¿de dónde sale?' : ''),
          cls: tipo === 'vacio' ? 'miss' : tipo === 'fijo' ? 'k' : (tipo === 'formula' || tipo === 'fila') && sv === 'form' ? 'f' : '',
        };
      }),
    });
  }
  return { letras: t.columnas.map((_, j) => letra(j)), filas, hojas: [t.hoja || 'Datos'], archivo: `${nombreArchivoEj(t, proceso)}.${t.formato}`, detalle: t.detalle };
}

/** «Tabla según el JSON»: una columna por dato; con listas, una fila por elemento de la primera. */
export function tablaJson(campos: CampoExp[], listas: string[]): { cols: string[]; filas: string[][] } {
  const cols = campos.filter((c) => !listas.length || !c[1] || c[1] === listas[0]).map((c) => c[0]);
  return { cols, filas: [0, 1].map((i) => cols.map((c) => valorCampoEj(c, i))) };
}

// Ejemplo de referencia «Cargue PAC» (solo lectura, datos ficticios): encabezado con
// cálculos y detalle por afiliado, armado con las mismas reglas del prototipo.
type ColRef = [string, 'constante' | 'campo' | 'calculo', string, 'texto' | 'numero' | 'fecha_dmy'];
const REF_ENC: ColRef[] = [
  ['Tipo de registro', 'constante', '5754', 'texto'],
  ['Código PAC', 'campo', 'codigo_pac', 'texto'],
  ['NIT', 'campo', 'nit_empresa', 'numero'],
  ['Fecha', 'campo', 'fecha_aporte', 'fecha_dmy'],
  ['Registros', 'calculo', 'CONTAR(afiliados)', 'numero'],
  ['Total', 'calculo', 'SUMA(afiliados.valor_aporte)', 'numero'],
];
const REF_COLS: ColRef[] = [
  ['Tipo', 'constante', '4', 'texto'],
  ['Identificación', 'campo', 'afiliados.numero_identificacion', 'texto'],
  ['Tipo id.', 'campo', 'afiliados.tipo_identificacion', 'texto'],
  ['Subcuenta', 'campo', 'afiliados.subcuenta', 'texto'],
  ['Valor', 'campo', 'afiliados.valor_aporte', 'numero'],
  ['Retiene', 'constante', 'Y', 'texto'],
  ['Retención', 'calculo', 'REDONDEAR(valor_aporte*pct_retencion/100;0)', 'numero'],
];

export function referenciaPac(sv: VistaCeldas): HojaVista {
  const celda = (c: ColRef, i: number): CeldaHoja => {
    const v = c[1] === 'constante' ? c[2] : c[1] === 'calculo' ? (sv === 'form' ? '=' + c[2] : calculoEj(c[2], i)) : valorCampoEj(c[2], i);
    return { v: fmtV(v, c[3]), cls: c[1] === 'constante' ? 'k' : c[1] === 'calculo' && sv === 'form' ? 'f' : '' };
  };
  return {
    letras: REF_COLS.map((_, j) => letra(j)),
    filas: [{ h: true, celdas: REF_ENC.map((c) => celda(c, 0)) }, ...[0, 1].map((i) => ({ h: false, celdas: REF_COLS.map((c) => celda(c, i)) }))],
    hojas: ['Cargue', 'Revisión'],
    archivo: `${valorCampoEj('nit_empresa', 0)}_${valorCampoEj('codigo_pac', 0)}_${valorCampoEj('fecha_aporte', 0)}.xlsx`,
    detalle: 'afiliados',
  };
}
