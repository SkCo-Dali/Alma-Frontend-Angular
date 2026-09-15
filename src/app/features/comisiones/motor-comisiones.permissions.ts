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
  /**
   * Autoría de planes: crear, editar y borrar planes y sus reglas, y enviarlos
   * a aprobación. Lo tienen analistas y supervisores.
   */
  plansManage: 'app.motor-comisiones.plans.manage',
  /** Aprobar, publicar, rechazar e inactivar planes. Solo supervisores. */
  plansApprove: 'app.motor-comisiones.plans.approve',
  /**
   * Parametrización y operación del motor: tipos de comisión, ajustes,
   * diferidos, contabilidad, contratos excluidos, casos especiales,
   * configuración de producto/contrato, correos, jobs e ingesta. El backend lo
   * exige desde la migración 036; sin él, esas pantallas responden 403.
   */
  config: 'app.motor-comisiones.config',
} as const;
