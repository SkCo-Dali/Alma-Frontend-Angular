// Usuario de desarrollo local (sin Entra). SOLO lo importa src/environments/
// environment.ts: los builds de dev, stg y prd reemplazan ese archivo
// (fileReplacements), así que este usuario —con todos los permisos de
// plataforma— no viaja en el código que se sirve en esos ambientes. Hallazgo 5
// del retest de 7Way (sep-2026): la lista de permisos quedaba expuesta en el
// bundle de producción.

import type { User } from '../models/platform.models';

export const USUARIO_LOCAL: User = {
  id: 'u-001',
  nombre: 'Daniel Cano',
  correo: 'daniel.cano@skandia.co',
  cargo: 'Analista de Operaciones',
  equipo: 'Vicepresidencia de Operaciones',
  foto: 'https://api.dicebear.com/9.x/initials/svg?seed=Daniel%20Cano&backgroundColor=0d6cbd&textColor=ffffff',
  roles: ['admin', 'operations.analyst'],
  permissions: [
    'app.suscripcion.view',
    'app.suscripcion.solicitudes.manage',
    'app.suscripcion.solicitudes.emit',
    'app.suscripcion.motor.config',
    'app.suscripcion.simulador.config',
    'app.motor-comisiones.view',
    'app.motor-comisiones.catalogs',
    'app.agente-alma.view',
    'app.visor-comunicaciones.view',
    'app.buzon-inteligente.view',
    'app.buzon-inteligente.review',
    'app.buzon-inteligente.manage',
    'app.recaudos-acreditacion-pac.view',
    'app.recaudos-acreditacion-pac.config',
    'platform.admin',
    'platform.access.view',
    'platform.access.assign',
    'platform.audit.view',
    'platform.metrics.view',
  ],
};
