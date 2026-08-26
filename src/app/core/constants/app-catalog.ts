// Catálogo de aplicaciones de ALMA. Nota: la gestión de accesos, roles, auditoría y
// métricas vive en la consola /admin (ícono Accesos del Dock), no como Apps del
// catálogo.

import { environment } from '@env/environment';
import { Application, User } from '../models/platform.models';

export const APP_CATALOG: Application[] = [
  // ---- Aplicaciones reales ----
  {
    id: 'app-sac-usuarios',
    nombre: 'Usuarios SAC',
    descripcion:
      'Administración de usuarios del Servicio al Cliente: consulta, bloqueo y desbloqueo con trazabilidad, creación y validación de PIN.',
    categoria: 'Servicio al Cliente',
    icono: 'user-cog',
    color: '#0099de', // --sk-color-info
    url: '/apps/sac-usuarios',
    internalRoute: '/apps/sac-usuarios',
    integrationType: 'microfrontend',
    requiredPermission: 'app.sac-usuarios.view',
    estado: 'beta',
    favorito: false,
    // App del equipo del SAC: vive en su propio despliegue y se monta aquí como
    // Web Component. Alma le pasa la sesión; ella no vuelve a autenticar.
    remote: {
      scriptUrl: environment.remotes.sacUsuarios.scriptUrl,
      styleUrl: environment.remotes.sacUsuarios.styleUrl,
      scopes: environment.remotes.sacUsuarios.scopes,
      apiBaseUrl: environment.remotes.sacUsuarios.apiBaseUrl || undefined,
      elementName: 'sac-usuarios',
      roleMap: {
        'app.sac-usuarios.fraude': 'prevencion.fraude',
        'app.sac-usuarios.operaciones': 'sac.operaciones',
      },
    },
  },
  {
    id: 'app-agente-alma',
    nombre: 'Agente Alma',
    descripcion:
      'Asistente conversacional de Servicio al Cliente: procesos, casos de Salesforce y cheques.',
    categoria: 'Asistentes',
    icono: 'sparkles',
    iconUrl: '/app-icons/agente-alma.png',
    color: '#00c73d', // --sk-color-primary
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
    color: '#00c73d', // --sk-color-primary
    url: '/apps/cheques',
    internalRoute: '/apps/cheques',
    integrationType: 'internal',
    requiredPermission: 'app.cheques.view',
    estado: 'active',
    favorito: false,
  },
  {
    id: 'app-suscripcion',
    nombre: 'Suscripción de Seguros',
    descripcion:
      'Bandeja de cotizaciones de Vida: declaraciones, evaluación del motor y emisión.',
    categoria: 'Suscripción',
    icono: 'brain',
    color: '#03a835', // --sk-color-primary-hover
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
    color: '#00c73d', // --sk-color-primary
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
    color: '#16d727', // --sk-color-accent
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
    color: '#666666', // --sk-color-text-muted
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
    color: '#009a2f', // --sk-color-primary-active
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
    color: '#404040', // --sk-color-text
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
    color: '#0099de', // --sk-color-info
    url: 'https://skandia.my.salesforce.com',
    integrationType: 'external',
    requiredPermission: 'app.salesforce.view',
    estado: 'active',
    favorito: true,
    lastUsedAt: '18 Jul, 3:15 p. m.',
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
    'app.sac-usuarios.view',
    'app.sac-usuarios.operaciones',
    'app.agente-alma.view',
    'app.cheques.view',
    'app.emision.view',
    'app.documental.view',
    'app.pharos.view',
    'app.dashboard.view',
    'app.salesforce.view',
    'platform.admin',
    'platform.access.view',
    'platform.access.assign',
    'platform.audit.view',
    'platform.metrics.view',
  ],
};
