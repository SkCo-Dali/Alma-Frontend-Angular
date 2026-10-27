// Funciones puras de la exportación del Buzón Inteligente 2.0, portadas de
// alma-backend app/services/buzon_exportacion.py. El backend genera los archivos
// reales; aquí se usan para la cobertura de salidas por etiqueta, el «Así se
// llamará» del nombre de archivo, detectar las listas del JSON y simular la
// vista previa y la lectura del modelo en el modo demostración.

import type { Base, ColumnaPlantilla, FilaBase, FormatoColumna, OrigenColumna, Plantilla, Salida } from './buzon.api';
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
