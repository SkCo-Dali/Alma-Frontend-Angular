// Errores de mutación del módulo de comisiones: distingue el 409 (registro duplicado)
// del resto para poder mostrar el aviso correcto.

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
  'Ya existe un registro igual a este. Revisa los datos e intenta de nuevo.';

/** Mensajes genéricos por acción (no se filtran errores técnicos al usuario).
 *  Tuteo consistente con el resto de la plataforma — antes cambiaban a
 *  "usted" solo aquí. */
export const MENSAJES_ERROR: Record<string, string> = {
  create: 'No pudimos crear el registro. Intenta de nuevo en un momento.',
  update: 'No pudimos guardar los cambios. Intenta de nuevo en un momento.',
  delete: 'No pudimos eliminar el registro. Intenta de nuevo en un momento.',
  fetch: 'No pudimos cargar la información. Intenta de nuevo en un momento.',
  toggle: 'No pudimos cambiar el estado del registro. Intenta de nuevo en un momento.',
};
