// Errores de mutación del módulo de comisiones: distingue el 409 (registro duplicado)
// del resto para poder mostrar el aviso correcto.

export const HTTP_CONFLICT = 409;
export const HTTP_UNPROCESSABLE = 422;

export class ApiConflictError extends Error {
  readonly status = HTTP_CONFLICT;

  constructor(message = 'Conflict') {
    super(message);
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
