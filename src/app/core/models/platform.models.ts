// Modelos de la plataforma ALMA (portados del front React, types/index.ts).

/** Cómo se integra una app al shell:
 *  - internal:      construida dentro de este workspace (lazy route).
 *  - microfrontend: remota federada (Native Federation) — carga en runtime.
 *  - iframe:        app existente embebida con SSO silencioso de Entra.
 *  - external:      link que abre en pestaña nueva. */
export type IntegrationType = 'internal' | 'microfrontend' | 'iframe' | 'external';

export type AppStatus = 'active' | 'maintenance' | 'beta' | 'deprecated';

export interface User {
  id: string;
  nombre: string;
  correo: string;
  cargo: string;
  equipo: string;
  foto: string;
  roles: string[];
  permissions: string[];
}

/** App Manifest: el contrato con el que cualquier app —propia o de otro
 *  equipo— se registra en la plataforma. Hoy vive en código (catálogo);
 *  el siguiente paso es servirlo desde alma-backend. */
export interface Application {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  icono: string;
  /** Ícono estilo App de iOS (imagen full-bleed): ruta a un PNG cuadrado en
   *  /public/app-icons. Si está presente, reemplaza al ícono lucide + degradado. */
  iconUrl?: string;
  color: string;
  url: string;
  integrationType: IntegrationType;
  requiredPermission: string;
  estado: AppStatus;
  favorito: boolean;
  lastUsedAt?: string;
  internalRoute?: string;
}

export interface Team {
  id: string;
  nombre: string;
  descripcion?: string;
  miembros: number;
}

export interface Role {
  id: string;
  nombre: string;
  descripcion?: string;
  permissions: string[];
}

export interface AccessRequest {
  id: string;
  applicationId: string;
  applicationName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  justification: string;
}

export interface AppRole {
  role_id: string;
  app: string | null; // null = rol de plataforma
  slug: string;
  nombre: string;
}

/** Perfil del usuario autenticado: identidad (alma.Users) + permisos RBAC por App. */
export interface MeApi {
  email: string | null;
  id: string | null;
  name: string | null;
  role: string | null; // legacy (rol único); usar `permissions`
  is_active: boolean;
  registrado: boolean;
  permissions?: string[];
  app_roles?: AppRole[];
}

/** Preferencias del portal persistidas por usuario (cross-device). */
export interface PreferenciasPortal {
  theme?: string;
  background?: string;
  appOrder?: string[];
  dockCount?: number;
}
