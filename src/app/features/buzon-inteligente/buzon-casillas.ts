// Casillas del asistente de procesos «simples» (095). Cada casilla es UNA revisión de Nova
// (`proceso.revisiones`): el analista solo ve y arma la frase; aquí se traduce a la revisión
// que guarda el backend y de vuelta. El catálogo, las claves y los textos salen de
// prototipos/catalogo-casillas.md, acordado con el backend (alma-backend PR 447 y 450).
// El analista nunca configura datos: cada revisión declara en `datos` lo que la IA debe
// copiar, y Nova lo compara con código.

import { CondicionEtiqueta, CondicionSimple, DatoRevision, OperadorCondicion, ParIguales, Revision } from './buzon.api';

export type TipoFrase = 'digitos' | 'iguales' | 'fecha' | 'empieza' | 'distintos' | 'obligatorio' | 'no_permitido' | 'firmada';

/** «Solo cuando…» (opcional): la casilla solo se revisa si se cumple. */
export interface SiCasilla {
  dato: string;
  op: OperadorCondicion;
  valor: string;
}

export interface Casilla {
  /** «otra» = revisión hecha fuera del asistente (p. ej. por SQL): solo se activa o se quita. */
  tipo: TipoFrase | 'otra';
  activa: boolean;
  /** El dato en palabras («la cuenta del cliente»). */
  dato: string;
  /** Segundo dato de «es distinto de». */
  datoB: string;
  /** Documentos de «es igual en A y en B». */
  docA: string;
  docB: string;
  /** N de dígitos, N de días o los números del prefijo. */
  numero: string;
  /** Valor de «no puede ser». */
  valor: string;
  /** Cómo comparar en «es igual en»; '' = automático según el dato. */
  como: '' | NonNullable<ParIguales['como']>;
  si: SiCasilla | null;
  /** La revisión tal como llegó: si la casilla no se edita, se reenvía igual. */
  original?: Revision;
  editada?: boolean;
}

export const FRASES: { tipo: TipoFrase; molde: string; ejemplo: string }[] = [
  { tipo: 'digitos', molde: '[dato] tiene [N] dígitos', ejemplo: 'La cuenta del cliente tiene 11 dígitos' },
  { tipo: 'iguales', molde: '[dato] es igual en [documento A] y en [documento B]', ejemplo: 'El nombre es igual en la carta y en el certificado' },
  { tipo: 'fecha', molde: '[fecha] es de hoy o de los últimos [N] días', ejemplo: 'La fecha de la carta es de hoy o de ayer' },
  { tipo: 'empieza', molde: '[dato] empieza por [números]', ejemplo: 'El contrato empieza por 10000' },
  { tipo: 'distintos', molde: '[dato] es distinto de [otro dato]', ejemplo: 'La cuenta del cliente es distinto de la cuenta de Skandia' },
  { tipo: 'obligatorio', molde: '[dato] no puede estar vacío', ejemplo: 'El valor no puede estar vacío' },
  { tipo: 'no_permitido', molde: '[dato] no puede ser [valor]', ejemplo: 'El banco no puede ser Bancolombia' },
  { tipo: 'firmada', molde: 'La carta está firmada por el cliente', ejemplo: 'Nova mira el espacio de la firma' },
];

/** Solo ayuda para escribir: el dato es texto libre. */
export const SUGERENCIAS_DATOS = [
  'la cuenta del cliente', 'la cuenta de Skandia', 'la cédula', 'el nombre del titular',
  'el contrato', 'el valor', 'la fecha de la carta', 'la fecha del certificado',
];
export const SUGERENCIAS_DOCS = ['la carta', 'el certificado', 'el comprobante'];

export const OPERADORES_SI: { op: OperadorCondicion; texto: string; valor: boolean }[] = [
  { op: '=', texto: 'es', valor: true },
  { op: 'distinto de', texto: 'no es', valor: true },
  { op: 'vacio', texto: 'está vacío', valor: false },
  { op: 'no vacio', texto: 'no está vacío', valor: false },
  { op: 'en', texto: 'es uno de', valor: true },
];

const FIRMA: DatoRevision = {
  clave: 'carta_firmada',
  descripcion: 'Mira el espacio de firma de la carta: si (hay firma), no (vacío) o no_se_puede_ver (solo hay texto)',
};
const FRASE_FIRMA = 'la carta está firmada por el cliente';
const SOBRAN = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al']);
const RE_CLAVE = /^[a-z][a-z0-9_]{0,59}$/;

const mayus = (t: string): string => (t ? t[0].toUpperCase() + t.slice(1) : t);
const minus = (t: string): string => (t ? t[0].toLowerCase() + t.slice(1) : t);

export function nuevaCasilla(tipo: TipoFrase): Casilla {
  return { tipo, activa: true, dato: '', datoB: '', docA: '', docB: '', numero: '', valor: '', como: '', si: null, editada: true };
}

/** «la cuenta del cliente» → cuenta_cliente: sin tildes, sin artículos ni «de/del». */
export function claveDato(texto: string): string {
  const base = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const palabras = base.split(/[^a-z0-9]+/).filter((p) => p && !SOBRAN.has(p));
  let k = palabras.join('_');
  if (k && !/^[a-z]/.test(k)) k = `dato_${k}`;
  return k.slice(0, 60).replace(/_+$/, '') || 'dato';
}

/** Lo que la IA debe copiar para ese dato (las fechas, en YYYY-MM-DD). */
export function descripcionDato(palabras: string): string {
  const t = mayus(palabras.trim());
  return /fecha/i.test(palabras) ? `${t}, la fecha IMPRESA en el documento, en formato YYYY-MM-DD.` : `${t}, tal como aparece en el correo o sus adjuntos.`;
}

/** De vuelta: las palabras del dato a partir de su descripción (o de la clave). */
function palabrasDe(clave: string | undefined, datos: DatoRevision[] | undefined): string {
  const d = datos?.find((x) => x.clave === clave);
  if (!d) return (clave ?? '').replace(/_/g, ' ');
  return minus(d.descripcion.replace(/,\s*(tal como aparece|la fecha IMPRESA)[\s\S]*$/, '').trim());
}

/** «es igual en»: nombres por palabras; cuentas, cédulas, contratos y valores como número. */
export function comoAuto(dato: string): NonNullable<ParIguales['como']> {
  if (/nombre/i.test(dato)) return 'palabras';
  if (/cuenta|c[eé]dula|contrato|n[uú]mero|\bnit\b|valor/i.test(dato)) return 'numero';
  return 'texto';
}

function textoSi(si: SiCasilla | null): string {
  if (!si || !si.dato.trim()) return '';
  const o = OPERADORES_SI.find((x) => x.op === si.op);
  return ` (solo cuando ${si.dato.trim()} ${o?.texto ?? si.op}${o?.valor ? ' ' + (si.valor.trim() || '[valor]') : ''})`;
}

/** La frase tal como la ve el analista (sin mayúscula inicial). */
export function frase(c: Casilla): string {
  const x = (t: string, ph: string): string => t.trim() || ph;
  const dato = x(c.dato, '[dato]');
  let f: string;
  switch (c.tipo) {
    case 'digitos': f = `${dato} tiene ${x(c.numero, '[N]')} dígitos`; break;
    case 'iguales': f = `${dato} es igual en ${x(c.docA, '[documento A]')} y en ${x(c.docB, '[documento B]')}`; break;
    case 'fecha': {
      const n = c.numero.trim();
      f = `${x(c.dato, '[fecha]')} ${n === '0' ? 'es de hoy' : n === '1' ? 'es de hoy o de ayer' : `es de hoy o de los últimos ${x(n, '[N]')} días`}`;
      break;
    }
    case 'empieza': f = `${dato} empieza por ${x(c.numero, '[números]')}`; break;
    case 'distintos': f = `${dato} es distinto de ${x(c.datoB, '[otro dato]')}`; break;
    case 'obligatorio': f = `${dato} no puede estar vacío`; break;
    case 'no_permitido': f = `${dato} no puede ser ${x(c.valor, '[valor]')}`; break;
    case 'firmada': f = FRASE_FIRMA; break;
    default: return minus(c.original?.nombre ?? 'revisión');
  }
  return minus(f) + textoSi(c.si);
}

export function textoCasilla(c: Casilla): string {
  return mayus(frase(c));
}

/** Qué le falta a la casilla para guardarse (null = lista). */
export function errorCasilla(c: Casilla): string | null {
  if (c.tipo === 'otra' || c.tipo === 'firmada') return null;
  if (!c.dato.trim()) return 'Escribe el dato, por ejemplo «la cuenta del cliente».';
  if (!RE_CLAVE.test(claveDato(c.dato))) return 'El dato debe tener al menos una letra.';
  const entero = (min: number, max: number): boolean => /^\d+$/.test(c.numero.trim()) && +c.numero >= min && +c.numero <= max;
  if (c.tipo === 'digitos' && !entero(1, 40)) return 'Escribe cuántos dígitos (un número de 1 a 40).';
  if (c.tipo === 'fecha' && !entero(0, 365)) return 'Escribe cuántos días (0 = solo hoy).';
  if (c.tipo === 'empieza' && !/^\d+$/.test(c.numero.trim())) return 'Escribe solo los números con los que debe empezar.';
  if (c.tipo === 'iguales') {
    if (!c.docA.trim() || !c.docB.trim()) return 'Escribe en qué dos documentos se compara.';
    if (claveDato(c.docA) === claveDato(c.docB)) return 'Los dos documentos deben ser distintos.';
  }
  if (c.tipo === 'distintos') {
    if (!c.datoB.trim()) return 'Escribe con qué otro dato se compara.';
    if (claveDato(c.datoB) === claveDato(c.dato)) return 'Los dos datos deben ser distintos.';
  }
  if (c.tipo === 'no_permitido' && !c.valor.trim()) return 'Escribe el valor que no se permite.';
  if (c.si?.dato.trim() && OPERADORES_SI.find((o) => o.op === c.si!.op)?.valor && !c.si.valor.trim()) return 'Completa el «Solo cuando…» o quítalo.';
  return null;
}

/** La revisión que se guarda en `proceso.revisiones`. */
export function aRevision(c: Casilla): Revision {
  if (c.original && (!c.editada || c.tipo === 'otra')) return { ...c.original, activa: c.activa };
  const f = frase(c);
  const d = (pal: string): DatoRevision => ({ clave: claveDato(pal), descripcion: descripcionDato(pal) });
  const base = { nombre: mayus(f), activa: c.activa, motivo: `No se cumple: ${f}. {detalle}` };
  const campo = claveDato(c.dato);
  let r: Revision;
  let datos: DatoRevision[] = [d(c.dato)];
  switch (c.tipo) {
    case 'digitos': r = { ...base, tipo: 'digitos', campo, cantidad: +c.numero }; break;
    case 'fecha': r = { ...base, tipo: 'fecha_vigente', campo, dias: +c.numero }; break;
    case 'empieza': r = { ...base, tipo: 'empieza_por', campo, prefijo: c.numero.replace(/\D/g, '') }; break;
    case 'obligatorio': r = { ...base, tipo: 'obligatorios', campos: [campo] }; break;
    case 'no_permitido': r = { ...base, tipo: 'no_permitido', campo, valores: [c.valor.trim()] }; break;
    case 'distintos':
      r = { ...base, tipo: 'distintos', a: campo, b: claveDato(c.datoB) };
      datos = [d(c.dato), d(c.datoB)];
      break;
    case 'iguales': {
      const a = `${c.dato.trim()} según ${c.docA.trim()}`;
      const b = `${c.dato.trim()} según ${c.docB.trim()}`;
      const ka = claveDato(`${c.dato} ${c.docA}`);
      const kb = claveDato(`${c.dato} ${c.docB}`);
      r = { ...base, tipo: 'iguales', pares: [{ a: ka, b: kb, como: c.como || comoAuto(c.dato), nombre: c.dato.trim() }] };
      datos = [{ clave: ka, descripcion: descripcionDato(a) }, { clave: kb, descripcion: descripcionDato(b) }];
      break;
    }
    default: // firmada
      r = { ...base, tipo: 'no_permitido', campo: FIRMA.clave, valores: ['no'] };
      datos = [FIRMA];
  }
  if (c.si?.dato.trim()) {
    const conValor = OPERADORES_SI.find((o) => o.op === c.si!.op)?.valor;
    const valor = c.si.op === 'en' ? c.si.valor.split(',').map((x) => x.trim()).filter(Boolean) : c.si.valor.trim();
    r.si = [{ campo: claveDato(c.si.dato), op: c.si.op, ...(conValor ? { valor } : {}) }];
    datos.push(d(c.si.dato));
  }
  r.datos = datos.filter((x, i) => datos.findIndex((y) => y.clave === x.clave) === i);
  return r;
}

/** Una revisión guardada como casilla. Lo que no salió del catálogo queda como «otra». */
export function deRevision(r: Revision): Casilla {
  const c: Casilla = { ...nuevaCasilla('digitos'), activa: r.activa !== false, original: r, editada: false };
  const otra: Casilla = { ...c, tipo: 'otra' };
  if (!r.datos?.length || (r.si?.length ?? 0) > 1) return otra;
  const pal = (k?: string): string => palabrasDe(k, r.datos);
  const s = r.si?.[0];
  if (s) c.si = { dato: pal(s.campo), op: s.op, valor: Array.isArray(s.valor) ? s.valor.join(', ') : (s.valor ?? '') };
  switch (r.tipo) {
    case 'digitos': return { ...c, tipo: 'digitos', dato: pal(r.campo), numero: String(r.cantidad ?? '') };
    case 'fecha_vigente': return { ...c, tipo: 'fecha', dato: pal(r.campo), numero: String(r.dias ?? '') };
    case 'empieza_por': return { ...c, tipo: 'empieza', dato: pal(r.campo), numero: r.prefijo ?? '' };
    case 'distintos': return { ...c, tipo: 'distintos', dato: pal(r.a), datoB: pal(r.b) };
    case 'obligatorios': return r.campos?.length === 1 ? { ...c, tipo: 'obligatorio', dato: pal(r.campos[0]) } : otra;
    case 'no_permitido':
      if (r.campo === FIRMA.clave && r.valores?.length === 1 && r.valores[0] === 'no') return { ...c, tipo: 'firmada' };
      return r.valores?.length === 1 ? { ...c, tipo: 'no_permitido', dato: pal(r.campo), valor: r.valores[0] } : otra;
    case 'iguales': {
      const p = r.pares?.length === 1 ? r.pares[0] : null;
      if (!p) return otra;
      const [da, docA] = pal(p.a).split(' según ');
      const [, docB] = pal(p.b).split(' según ');
      if (!docA || !docB) return otra;
      const dato = p.nombre || da;
      return { ...c, tipo: 'iguales', dato, docA, docB, como: p.como && p.como !== comoAuto(dato) ? p.como : '' };
    }
  }
  return otra;
}

/** Datos que ya usa el proceso (en palabras), para sugerirlos al escribir otra casilla. */
export function datosUsados(casillas: Casilla[]): string[] {
  const out = new Set<string>();
  for (const c of casillas) {
    if (c.tipo === 'otra' || c.tipo === 'firmada') continue;
    for (const t of [c.dato, c.datoB, c.si?.dato ?? '']) if (t.trim()) out.add(t.trim());
  }
  return [...out];
}

/** Aviso suave: el texto del prompt pide algo que ya revisa una casilla activa. */
export function repetidasEnTexto(texto: string, casillas: Casilla[]): string[] {
  const pistas: Partial<Record<Casilla['tipo'], RegExp>> = {
    digitos: /\b\d{1,2}\s*d[ií]gitos\b/i,
    iguales: /\bcoincid\w*|\bigual(es)? en\b/i,
    fecha: /\b(de hoy|de ayer|[uú]ltimos?\s+\d+\s+d[ií]as)\b/i,
    empieza: /\bempiezan? (por|con)\b/i,
    firmada: /\bfirmad[ao]\b/i,
  };
  const out: string[] = [];
  for (const c of casillas) {
    const re = c.activa ? pistas[c.tipo] : undefined;
    const m = re?.exec(texto);
    if (m && !out.includes(m[0])) out.push(m[0]);
  }
  return out;
}

/** Primer párrafo del prompt: con él el paso 1 (ruteo) elige el proceso. */
export function primerParrafo(texto: string): string {
  return texto.trim().split(/\n\s*\n/)[0]?.trim() ?? '';
}

/** «(sello vacio y (cuenta en [...] o banco contiene bancolombia))» */
export function describirCondicion(c: CondicionEtiqueta): string {
  if ('todas' in c) return `(${c.todas.map(describirCondicion).join(' y ')})`;
  if ('alguna' in c) return `(${c.alguna.map(describirCondicion).join(' o ')})`;
  const v = Array.isArray(c.valor) ? `[${c.valor.join(', ')}]` : (c.valor ?? '');
  return `${c.campo} ${c.op}${c.op === 'vacio' || c.op === 'no vacio' ? '' : ` ${v}`}`.trim();
}

/** ¿La condición se puede editar en la pantalla vieja (campo, =/contiene/distinto de, texto)? */
export function esCondicionClasica(c: CondicionEtiqueta | null | undefined): c is CondicionSimple & { valor?: string } {
  return !!c && !('todas' in c) && !('alguna' in c) && ['=', 'contiene', 'distinto de'].includes(c.op) && !Array.isArray(c.valor);
}
