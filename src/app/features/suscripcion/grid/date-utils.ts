// Utilidades de fecha para los filtros del grid. Reemplazan a date-fns con
// aritmética local sobre fechas PURAS (YYYY-MM-DD): las columnas de Suscripción
// no llevan hora ni zona, así que todo se calcula en la fecha local del usuario
// y se serializa date-only.

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** YYYY-MM-DD de un Date (en su fecha LOCAL, sin conversión UTC). */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parsea YYYY-MM-DD como fecha LOCAL (no UTC, que correría un día). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function addYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() + n);
  return r;
}

/** Lunes de la semana de `d` (weekStartsOn: 1, igual que el original). */
export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const dow = (r.getDay() + 6) % 7; // 0 = lunes
  r.setDate(r.getDate() - dow);
  return r;
}

export function endOfWeek(d: Date): Date {
  return addDays(startOfWeek(d), 6);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function startOfQuarter(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

export function endOfQuarter(d: Date): Date {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0);
}

export function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

export function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31);
}

/** Nombre del mes en español (1-12). */
export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

/** YYYY-MM-DD → DD/MM/YYYY (etiqueta de los selectores). */
export function etiquetaFecha(d: string): string {
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
}
