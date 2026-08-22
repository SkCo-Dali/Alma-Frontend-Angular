// Nombres del directorio activo llegan como "Apellido1 Apellido2, Nombre1 Nombre2"
// (apellidos, coma, nombres). Estas utilidades extraen el nombre de pila y una
// etiqueta corta "Nombre A." para saludar y para el header.
// Port 1:1 de lib/name.ts.

/** Separa un nombre del AD en { given, family }. */
function splitName(full: string): { given: string; family: string } {
  const raw = (full || '').trim();
  if (!raw) return { given: '', family: '' };
  const comma = raw.indexOf(',');
  if (comma !== -1) {
    // "Coronado Benitez, Jimmy de Jesús" -> given="Jimmy de Jesús", family="Coronado Benitez"
    return {
      given: raw.slice(comma + 1).trim(),
      family: raw.slice(0, comma).trim(),
    };
  }
  // "Daniel Cano" -> given="Daniel", family="Cano"
  const parts = raw.split(/\s+/);
  return { given: parts[0] ?? '', family: parts.slice(1).join(' ') };
}

/** Primer nombre de pila: "Coronado Benitez, Jimmy de Jesús" -> "Jimmy". */
export function firstName(full: string): string {
  const { given, family } = splitName(full);
  const source = given || family || full || '';
  return source.split(/\s+/)[0] ?? '';
}

/** Etiqueta corta para el header: "Jimmy C." (nombre de pila + inicial del apellido). */
export function shortName(full: string): string {
  const { given, family } = splitName(full);
  const first = (given || full || '').split(/\s+/)[0] ?? '';
  const familyInitial = (family || '').split(/\s+/)[0]?.[0];
  return familyInitial ? `${first} ${familyInitial}.` : first;
}
