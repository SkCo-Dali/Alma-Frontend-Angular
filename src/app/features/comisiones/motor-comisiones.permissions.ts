// Permisos RBAC del Motor de Comisiones. El backend asigna estos permisos a
// roles (p. ej. el rol "Desarrollo Comercial" → desarrollo-comercial).

export const MOTOR_COMISIONES_PERMS = {
  /** Acceso general a la app y a la mayoría de submódulos. */
  view: 'app.motor-comisiones.view',
  /** Catálogos (admin de la app / permiso explícito). */
  catalogs: 'app.motor-comisiones.catalogs',
  /**
   * Solo el módulo Desarrollo Comercial. Quien lo tenga sin `view` no ve el
   * resto de submódulos (planes, parametrización, ejecución, etc.).
   */
  desarrolloComercial: 'app.motor-comisiones.desarrollo-comercial',
} as const;
