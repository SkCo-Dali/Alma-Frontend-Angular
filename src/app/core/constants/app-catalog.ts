// Catálogo de aplicaciones de ALMA. Nota: la gestión de accesos, roles, auditoría y
// métricas vive en la consola /admin (ícono Accesos del Dock), no como Apps del
// catálogo.

import { Application, User } from '../models/platform.models';

export const APP_CATALOG: Application[] = [
  {
    id: 'app-agente-alma',
    nombre: 'Agente Alma',
    descripcion:
      'Asistente conversacional de Servicio al Cliente: procesos y casos de Salesforce.',
    categoria: 'Asistentes',
    icono: 'sparkles',
    iconUrl: '/app-icons/agente-alma.png',
    color: '#00C83C',
    url: '/apps/agente-alma',
    internalRoute: '/apps/agente-alma',
    integrationType: 'internal',
    requiredPermission: 'app.agente-alma.view',
    estado: 'beta',
    favorito: true,
  },
  {
    id: 'app-buzon-inteligente',
    nombre: 'Buzón Inteligente',
    descripcion:
      'Clasifica con IA los correos que llegan a los buzones de cada área y ejecuta la acción acordada: etiquetar, mover, reenviar o asignar.',
    categoria: 'Asistentes',
    icono: 'mail-search',
    color: '#6D4AE0',
    url: '/apps/buzon-inteligente',
    internalRoute: '/apps/buzon-inteligente',
    integrationType: 'internal',
    requiredPermission: 'app.buzon-inteligente.view',
    estado: 'beta',
    favorito: true,
  },
  {
    id: 'app-recaudos-acreditacion-pac',
    nombre: 'Acreditación PAC',
    descripcion:
      'Bandeja de pagos PAC recibidos por correo: cruce con suspense, cargue a Pipeline y respuesta a la empresa.',
    categoria: 'Recaudos',
    icono: 'coins',
    color: '#0089B8',
    url: '/apps/recaudos-acreditacion-pac',
    internalRoute: '/apps/recaudos-acreditacion-pac',
    integrationType: 'internal',
    requiredPermission: 'app.recaudos-acreditacion-pac.view',
    estado: 'beta',
    favorito: false,
  },
  {
    id: 'app-visor-comunicaciones',
    nombre: 'Visor de comunicaciones',
    descripcion:
      'Visor de archivos .eml: renderiza el correo, sus encabezados y adjuntos sin exponer el código.',
    categoria: 'Servicio al Cliente',
    icono: 'mail-open',
    color: '#02B1FF',
    url: '/apps/visor-comunicaciones',
    internalRoute: '/apps/visor-comunicaciones',
    integrationType: 'internal',
    requiredPermission: 'app.visor-comunicaciones.view',
    estado: 'beta',
    favorito: false,
  },
  {
    id: 'app-suscripcion',
    nombre: 'Suscripción de Seguros',
    descripcion:
      'Bandeja de cotizaciones de Vida: declaraciones, evaluación del motor y emisión.',
    categoria: 'Suscripción',
    icono: 'brain',
    iconUrl: '/app-icons/suscripcion.png',
    color: '#00C83C',
    url: '/apps/suscripcion',
    internalRoute: '/apps/suscripcion',
    integrationType: 'internal',
    requiredPermission: 'app.suscripcion.view',
    estado: 'active',
    favorito: true,
    lastUsedAt: '19 Jul, 9:10 a. m.',
  },
  {
    id: 'app-motor-comisiones',
    nombre: 'Motor de Comisiones',
    descripcion:
      'Planes de compensación, parametrización, ejecución del motor e información gerencial.',
    categoria: 'Comisiones',
    icono: 'calculator',
    iconUrl: '/app-icons/motor-comisiones.png',
    color: '#00C83C',
    url: '/apps/motor-comisiones',
    internalRoute: '/apps/motor-comisiones',
    integrationType: 'internal',
    requiredPermission: 'app.motor-comisiones.view',
    // Quienes solo tienen el rol/permiso de Desarrollo Comercial también ven la App.
    requiredAnyPermission: [
      'app.motor-comisiones.view',
      'app.motor-comisiones.desarrollo-comercial',
    ],
    estado: 'active',
    favorito: false,
  },
];

/** Usuario mock para desarrollo local sin Entra. */
export const MOCK_USER: User = {
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
