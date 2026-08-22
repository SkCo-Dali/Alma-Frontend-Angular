// Catálogo de aplicaciones de ALMA (paridad con data/mock.ts del front React).
// Las apps reales están "en migración" desde el front React: su manifest ya
// existe pero la ruta interna muestra el estado de migración hasta portarlas.

import {
  AccessRequest,
  Application,
  Role,
  Team,
  User,
} from '../models/platform.models';

export const APP_CATALOG: Application[] = [
  // ---- Aplicaciones reales ----
  {
    id: 'app-agente-alma',
    nombre: 'Agente Alma',
    descripcion:
      'Asistente conversacional de Servicio al Cliente: procesos, casos de Salesforce y cheques.',
    categoria: 'Asistentes',
    icono: 'sparkles',
    color: '#00C83C',
    url: '/apps/agente-alma',
    internalRoute: '/apps/agente-alma',
    integrationType: 'internal',
    requiredPermission: 'app.agente-alma.view',
    estado: 'beta',
    favorito: true,
  },
  {
    id: 'app-cheques',
    nombre: 'Cheques',
    descripcion:
      'Base de cheques emitidos de Servicio al Cliente. Alimenta al Agente Alma.',
    categoria: 'Servicio al Cliente',
    icono: 'wallet',
    color: '#00C83C',
    url: '/apps/cheques',
    internalRoute: '/apps/cheques',
    integrationType: 'internal',
    requiredPermission: 'app.cheques.view',
    estado: 'active',
    favorito: false,
  },
  {
    id: 'app-suscripcion',
    nombre: 'Motor de Suscripción',
    descripcion: 'Bandeja de aprobación de pólizas de Vida Individual — Crea Patrimonio.',
    categoria: 'Suscripción',
    icono: 'brain',
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
    color: '#00C83C',
    url: '/apps/motor-comisiones',
    internalRoute: '/apps/motor-comisiones',
    integrationType: 'internal',
    requiredPermission: 'app.motor-comisiones.view',
    estado: 'active',
    favorito: false,
  },
  // ---- Maquetas (alineadas al negocio de Skandia) ----
  {
    id: 'app-bandeja-emision',
    nombre: 'Bandeja de Emisión',
    descripcion: 'Gestión y seguimiento de solicitudes de emisión de pólizas.',
    categoria: 'Emisión',
    icono: 'file-text',
    color: '#00C83C',
    url: 'https://emision.skandia.co',
    integrationType: 'external',
    requiredPermission: 'app.emision.view',
    estado: 'active',
    favorito: true,
    lastUsedAt: 'Hoy, 8:45 a. m.',
  },
  {
    id: 'app-control-documental',
    nombre: 'Control Documental',
    descripcion: 'Repositorio de expedientes, soportes y documentos de Operaciones.',
    categoria: 'Documental',
    icono: 'folder-open',
    color: '#0F6CBD',
    url: 'https://documental.skandia.co',
    integrationType: 'external',
    requiredPermission: 'app.documental.view',
    estado: 'active',
    favorito: true,
    lastUsedAt: '20 Jul, 4:30 p. m.',
  },
  {
    id: 'app-pharos-consulta',
    nombre: 'Pharos Consulta',
    descripcion: 'Consulta de terceros, declaraciones y transacciones en Pharos.',
    categoria: 'Consultas',
    icono: 'gem',
    color: '#00B294',
    url: 'https://pharos.skandia.co',
    integrationType: 'external',
    requiredPermission: 'app.pharos.view',
    estado: 'active',
    favorito: true,
    lastUsedAt: 'Ayer, 11:15 a. m.',
  },
  {
    id: 'app-dashboard-operaciones',
    nombre: 'Dashboard Operaciones',
    descripcion: 'Indicadores y métricas de la operación en tiempo real.',
    categoria: 'Analítica',
    icono: 'bar-chart-3',
    color: '#6B69D6',
    url: 'https://dashboard.skandia.co',
    integrationType: 'external',
    requiredPermission: 'app.dashboard.view',
    estado: 'active',
    favorito: true,
    lastUsedAt: 'Ayer, 5:20 p. m.',
  },
  {
    id: 'app-salesforce-hub',
    nombre: 'Salesforce Hub',
    descripcion: 'Acceso al CRM corporativo y vistas 360 del cliente.',
    categoria: 'CRM',
    icono: 'cloud',
    color: '#00A1E0',
    url: 'https://skandia.my.salesforce.com',
    integrationType: 'external',
    requiredPermission: 'app.salesforce.view',
    estado: 'active',
    favorito: true,
    lastUsedAt: '18 Jul, 3:15 p. m.',
  },
];

/** Usuario mock para desarrollo local sin Entra (paridad con data/mock.ts). */
export const MOCK_USER: User = {
  id: 'u-001',
  nombre: 'Daniel Cano',
  correo: 'daniel.cano@skandia.co',
  cargo: 'Analista de Operaciones',
  equipo: 'Vicepresidencia de Operaciones',
  foto: 'https://api.dicebear.com/9.x/initials/svg?seed=Daniel%20Cano&backgroundColor=0d6cbd&textColor=ffffff',
  roles: ['admin', 'operations.analyst'],
  permissions: [
    'app.agente-alma.view',
    'app.cheques.view',
    'app.suscripcion.view',
    'app.motor-comisiones.view',
    'app.emision.view',
    'app.documental.view',
    'app.pharos.view',
    'app.dashboard.view',
    'app.salesforce.view',
    'platform.admin',
  ],
};

export const TEAMS: Team[] = [
  { id: 't-1', nombre: 'Emisión y Novedades', miembros: 28 },
  { id: 't-2', nombre: 'Suscripción', miembros: 14 },
  { id: 't-3', nombre: 'Comisiones', miembros: 9 },
  { id: 't-4', nombre: 'Gestión Documental', miembros: 17 },
  { id: 't-5', nombre: 'Servicio al Cliente', miembros: 46 },
  { id: 't-6', nombre: 'Excelencia Operacional', miembros: 12 },
];

export const ROLES: Role[] = [
  {
    id: 'r-admin',
    nombre: 'Administrador de Plataforma',
    descripcion: 'Acceso completo a la administración del portal.',
    permissions: ['platform.admin', '*.view', '*.manage'],
  },
  {
    id: 'r-suscriptor',
    nombre: 'Suscriptor',
    descripcion: 'Evaluación y aprobación de solicitudes en el Motor de Suscripción.',
    permissions: ['app.suscripcion.view', 'app.pharos.view', 'app.documental.view'],
  },
  {
    id: 'r-supervisor-comisiones',
    nombre: 'Supervisor de Comisiones',
    descripcion: 'Parametrización y ejecución del Motor de Comisiones.',
    permissions: ['app.motor-comisiones.view'],
  },
  {
    id: 'r-analista-comisiones',
    nombre: 'Analista de Comisiones',
    descripcion: 'Consulta y análisis de comisiones causadas.',
    permissions: ['app.motor-comisiones.view'],
  },
  {
    id: 'r-operador',
    nombre: 'Analista de Operaciones',
    descripcion: 'Acceso operativo diario a emisión y consultas.',
    permissions: ['app.emision.view', 'app.pharos.view', 'app.dashboard.view'],
  },
];

export const ACCESS_REQUESTS: AccessRequest[] = [
  {
    id: 'req-1',
    applicationId: 'app-motor-comisiones',
    applicationName: 'Motor de Comisiones',
    requestedAt: '2026-07-22',
    status: 'pending',
    justification: 'Apoyo en la parametrización de planes del canal Vida.',
  },
  {
    id: 'req-2',
    applicationId: 'app-dashboard-operaciones',
    applicationName: 'Dashboard Operaciones',
    requestedAt: '2026-07-20',
    status: 'pending',
    justification: 'Seguimiento de indicadores del equipo de Emisión.',
  },
  {
    id: 'req-3',
    applicationId: 'app-salesforce-hub',
    applicationName: 'Salesforce Hub',
    requestedAt: '2026-07-18',
    status: 'pending',
    justification: 'Consulta de vistas 360 para atención de casos.',
  },
];

// Rol único de alma.Users (estilo Dali) → permisos de la plataforma.
// Claves en minúsculas; la comparación es case-insensitive.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  analista: ['app.agente-alma.view', 'app.cheques.view'],
  supervisorcomisiones: ['app.motor-comisiones.view'],
  analistacomisiones: ['app.motor-comisiones.view'],
};
