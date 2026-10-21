// Datos de la solicitud (FOR-0075): acceso por ruta, estado inicial y armado de lo que se
// envía al backend. Las claves son las del mapa del PDF (alma-backend app/data/prestaciones).

export type Datos = Record<string, unknown>;

export type TipoCampo = 'texto' | 'fecha' | 'numero' | 'email' | 'tel' | 'lista' | 'sino' | 'documento';

export interface CampoDef {
  /** Clave relativa a la sección (p. ej. `primer_nombre`, `recibe_prestacion.entidad`). */
  clave: string;
  rotulo: string;
  tipo: TipoCampo;
  /** Para `lista`: clave del catálogo de opciones. */
  catalogo?: string;
  max?: number;
  /** Columnas que ocupa en la grilla de 4 (por defecto 1). */
  ancho?: 1 | 2 | 4;
  /** Para `numero`: paso del campo ('1' enteros, '0.01' con decimales). */
  paso?: string;
  ayuda?: string;
}

const PASO = /^([^.[\]]+)(?:\[(\d+)\])?$/;

function partes(ruta: string): Array<string | number> {
  const salida: Array<string | number> = [];
  for (const p of ruta.split('.')) {
    const m = PASO.exec(p);
    if (!m) throw new Error(`Ruta inválida: ${ruta}`);
    salida.push(m[1]);
    if (m[2] !== undefined) salida.push(Number(m[2]));
  }
  return salida;
}

export function leer(datos: unknown, ruta: string): unknown {
  let actual: unknown = datos;
  for (const p of partes(ruta)) {
    if (actual === null || actual === undefined || typeof actual !== 'object') return undefined;
    actual = (actual as Record<string | number, unknown>)[p];
  }
  return actual;
}

/** Copia con el valor puesto en la ruta (no muta el original: las señales comparan por referencia). */
export function escribir<T>(datos: T, ruta: string, valor: unknown): T {
  const ps = partes(ruta);
  const poner = (nodo: unknown, i: number): unknown => {
    const p = ps[i];
    const copia: Record<string | number, unknown> | unknown[] = Array.isArray(nodo)
      ? [...nodo]
      : { ...((nodo as Record<string, unknown> | undefined) ?? {}) };
    const hijo = (copia as Record<string | number, unknown>)[p];
    (copia as Record<string | number, unknown>)[p] =
      i === ps.length - 1 ? valor : poner(hijo ?? (typeof ps[i + 1] === 'number' ? [] : {}), i + 1);
    return copia;
  };
  return poner(datos, 0) as T;
}

export function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Edad cumplida en `ref` (por defecto hoy) desde una fecha ISO; null si la fecha no sirve. */
export function edadEn(nacimiento: unknown, ref: unknown = hoyIso()): number | null {
  const n = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nacimiento ?? ''));
  const r = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ref ?? ''));
  if (!n || !r) return null;
  let edad = Number(r[1]) - Number(n[1]);
  if (Number(r[2]) < Number(n[2]) || (Number(r[2]) === Number(n[2]) && Number(r[3]) < Number(n[3]))) edad--;
  return edad >= 0 ? edad : null;
}

export function beneficiarioVacio(): Datos {
  return { invalidez: null, ley_2388: null };
}

export function solicitudInicial(): Datos {
  return {
    ciudad: '',
    fecha_solicitud: hoyIso(),
    tipo_solicitud: 'devolucion_saldos_vejez',
    afiliado: {
      tipo_documento: 'CC',
      recibe_prestacion: { respuesta: null },
      tramita_prestacion: { respuesta: null },
    },
    beneficiarios: [],
    bono: {},
    beps: {},
    gpm: {},
    convenios: {},
    semanas: null,
    datos: { responsables: [], finalidad_1: null, finalidad_2: null, finalidad_3: null },
  };
}

const vacio = (v: unknown): boolean => v === null || v === undefined || v === '';

/** Quita lo vacío (el backend lo trata igual, pero así el cuerpo es chico y legible) y agrega la firma. */
export function datosParaEnviar(datos: Datos): Datos {
  const limpiar = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(limpiar);
    if (v && typeof v === 'object') {
      const salida: Datos = {};
      for (const [k, x] of Object.entries(v)) {
        const l = limpiar(x);
        if (!vacio(l)) salida[k] = l;
      }
      return salida;
    }
    return typeof v === 'string' ? v.trim() : v;
  };
  const base = limpiar(datos) as Datos;
  const a = (datos['afiliado'] ?? {}) as Datos;
  const nombre = ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido']
    .map((k) => String(a[k] ?? '').trim())
    .filter(Boolean)
    .join(' ');
  // El reclamante es el afiliado: el bloque de firma se arma con sus datos, nunca se digita aparte.
  return {
    ...base,
    firma: { nombre, tipo_documento: a['tipo_documento'], numero_documento: a['numero_documento'] },
  };
}
