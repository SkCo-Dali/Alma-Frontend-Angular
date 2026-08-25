// Modelos de dominio de la plataforma ALMA.

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
  /** Ruta DENTRO del shell. La declaran todas las apps que Alma pinta
   *  (internal, iframe y microfrontend); las 'external' no la tienen. */
  internalRoute?: string;
  /** Solo para integrationType 'microfrontend': la app remota se publica como
   *  Web Component (lo que produce la plantilla Angular corporativa). */
  remote?: RemoteApp;
}

/** Punto de entrada de una app de otro equipo montada dentro del shell. */
export interface RemoteApp {
  /** Bundle publicado por el equipo dueño (Blob Storage o App Service). */
  scriptUrl: string;
  /** Hoja de estilos del bundle, si la publica aparte. */
  styleUrl?: string;
  /** Nombre del custom element que define ese bundle. */
  elementName: string;
  /**
   * Base del API que debe consumir la app remota. Permite repuntarla (p. ej. de
   * un App Service al gateway corporativo) por configuración, sin recompilar su
   * bundle. Ausente ⇒ usa la que trae su propio build.
   */
  apiBaseUrl?: string;
  /**
   * Scopes del API de la app remota (p. ej. `api://<su-client-id>/access_as_user`).
   *
   * Si se declaran, Alma pide a Entra un token PARA ESE RECURSO y se lo entrega
   * al elemento: la app remota sigue validando su propia audiencia y sus propios
   * app roles, sin tocar su código. Requiere que su app registration
   * pre-autorice el cliente de Alma (o consentimiento del administrador).
   *
   * Vacío o ausente ⇒ se le pasa el token de Alma (entonces su API tiene que
   * aceptar la audiencia de Alma).
   */
  scopes?: string[];
  /** Permiso de Alma → rol funcional que espera la app remota. */
  roleMap?: Record<string, string>;
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
  /** Nivel de desenfoque de la imagen de fondo: 'off' | 'suave' | 'medio' | 'fuerte'.
   *  (Fue booleano hasta ago-2026; el cliente migra el valor heredado.) */
  backgroundBlur?: string;
  appOrder?: string[];
  dockCount?: number;
}
