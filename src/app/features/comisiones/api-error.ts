// Errores de mutación del módulo de comisiones: distingue el 409 (registro duplicado)
// del resto y conserva el motivo que manda el backend en los 4xx (validaciones y
// reglas de negocio), para que el aviso diga por qué no se pudo guardar.

export const HTTP_CONFLICT = 409;
export const HTTP_UNPROCESSABLE = 422;

/** Error HTTP del API con el motivo legible del backend (solo en 4xx). */
export class ApiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly motivo: string | null = null,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export class ApiConflictError extends ApiHttpError {
  constructor(message = 'Conflict', motivo: string | null = null) {
    super(message, HTTP_CONFLICT, motivo);
    this.name = 'ApiConflictError';
  }
}

/** 422: el cuerpo suele traer errores de validación de negocio (p. ej. carga masiva). */
export class ApiValidationError extends Error {
  readonly status = HTTP_UNPROCESSABLE;
  readonly body: unknown;

  constructor(body: unknown, message = 'Validation failed') {
    super(message);
    this.name = 'ApiValidationError';
    this.body = body;
  }
}

export function isApiConflictError(error: unknown): error is ApiConflictError {
  return error instanceof ApiConflictError;
}

export function isApiValidationError(error: unknown): error is ApiValidationError {
  return error instanceof ApiValidationError;
}

/** Motivo del backend si el error lo trae; null en 5xx, red o errores propios. */
export function motivoDeError(error: unknown): string | null {
  return error instanceof ApiHttpError ? error.motivo : null;
}

const MAX_MOTIVO = 300;

// Nombres en pantalla de los campos que más rechaza el backend.
const ETIQUETAS_CAMPO: Record<string, string> = {
  formula: 'Fórmula',
  name: 'Nombre',
  description: 'Descripción',
  field_name: 'Campo',
  field_value: 'Valor',
  value_type: 'Tipo de valor',
  operator: 'Operador',
  logical_operator: 'Unión',
  catalog: 'Catálogo',
};

// Mensajes estándar de validación (vienen en inglés) por su tipo.
const MENSAJES_TIPO: Record<string, string> = {
  missing: 'es obligatorio',
  string_pattern_mismatch: 'tiene caracteres no permitidos',
  string_too_long: 'es demasiado largo',
  string_too_short: 'es demasiado corto',
  extra_forbidden: 'no se permite en este formulario',
  literal_error: 'no es un valor permitido',
  greater_than: 'está por debajo del mínimo',
  greater_than_equal: 'está por debajo del mínimo',
  less_than: 'supera el máximo',
  less_than_equal: 'supera el máximo',
};

interface ErrorValidacion {
  loc?: unknown[];
  msg?: string;
  type?: string;
}

function textoDeValidacion(e: ErrorValidacion): string {
  const campo = [...(e.loc ?? [])].reverse().find((p) => typeof p === 'string' && p !== 'body');
  const mensaje =
    (e.type && MENSAJES_TIPO[e.type]) || (e.msg ?? '').replace(/^Value error,\s*/i, '');
  if (!campo) return mensaje;
  return `${ETIQUETAS_CAMPO[campo as string] ?? campo}: ${mensaje}`;
}

/**
 * Traduce el `detail` de una respuesta de error a un texto para el aviso:
 * texto tal cual, o la lista de validación como "Campo: motivo; …".
 */
export function leerMotivo(texto: string): string | null {
  let detail: unknown;
  try {
    detail = (JSON.parse(texto) as { detail?: unknown })?.detail;
  } catch {
    return null;
  }
  let motivo = '';
  if (typeof detail === 'string') {
    motivo = detail;
  } else if (Array.isArray(detail)) {
    motivo = detail
      .filter((e): e is ErrorValidacion => typeof e === 'object' && e !== null)
      .map(textoDeValidacion)
      .filter(Boolean)
      .join('; ');
  }
  motivo = motivo.trim();
  if (!motivo) return null;
  return motivo.length > MAX_MOTIVO ? `${motivo.slice(0, MAX_MOTIVO - 1)}…` : motivo;
}

export const CONFLICT_TOAST_DESCRIPTION =
  'No se puede crear el registro porque ya existe ese registro.';

/** Mensajes genéricos por acción (no se filtran errores técnicos al usuario). */
export const MENSAJES_ERROR: Record<string, string> = {
  create: 'Error al crear el registro. Por favor intente nuevamente.',
  update: 'Error al actualizar el registro. Por favor intente nuevamente.',
  delete: 'Error al eliminar el registro. Por favor intente nuevamente.',
  fetch: 'Error al cargar la información. Por favor intente nuevamente.',
  toggle: 'Error al cambiar el estado del registro. Por favor intente nuevamente.',
};
