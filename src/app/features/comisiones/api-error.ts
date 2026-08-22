// Errores de mutación del módulo de comisiones: distingue el 409 (registro
// duplicado) del resto para poder mostrar el aviso correcto.
// Port de utils/apiMutationError.ts.

export const HTTP_CONFLICT = 409;

export class ApiConflictError extends Error {
  readonly status = HTTP_CONFLICT;

  constructor(message = 'Conflict') {
    super(message);
    this.name = 'ApiConflictError';
  }
}

export function isApiConflictError(error: unknown): error is ApiConflictError {
  return error instanceof ApiConflictError;
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
