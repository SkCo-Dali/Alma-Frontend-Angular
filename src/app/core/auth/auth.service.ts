// Autenticación con Microsoft Entra ID vía MSAL (una app registration por
// ambiente: Alma-Dev / Alma-Uat / Alma-Prd). Portado 1:1 del front React
// (lib/msal.ts + providers/AuthProvider.tsx) a un servicio Angular con signals.
//
// - Sin clientId/tenantId en environment (dev local sin Entra) la auth queda
//   deshabilitada y la app usa el usuario mock.
// - ensureSignedIn NO dispara login: si no hay cuenta el shell muestra la
//   página de inicio de sesión y el usuario pulsa el botón → signIn().
// - RBAC por App: el backend calcula los permisos efectivos (alma.UserRoles /
//   RolePermissions); se soportan comodines 'app.<slug>.*'.

import { Injectable, computed, signal } from '@angular/core';
import {
  AccountInfo,
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-browser';
import { environment } from '@env/environment';
import { MOCK_USER } from '../constants/app-catalog';
import { MeApi, User } from '../models/platform.models';

const CLIENT_ID = environment.azure.clientId;
const TENANT_ID = environment.azure.tenantId;

export const authEnabled = Boolean(CLIENT_ID && TENANT_ID);

// Scope expuesto por la misma app registration (Expose an API)
const API_SCOPE = `api://${CLIENT_ID}/access_as_user`;

function resolveAccess(me: MeApi | null): { roles: string[]; permissions: string[] } {
  if (!me?.registrado || !me.is_active) {
    return { roles: [], permissions: [] };
  }
  const roles = me.app_roles?.length
    ? me.app_roles.map((r) => (r.app ? `${r.app}:${r.slug}` : r.slug))
    : me.role
      ? [me.role]
      : [];
  return { roles, permissions: me.permissions ?? [] };
}

function accountToUser(account: AccountInfo, me: MeApi | null, foto: string | null): User {
  const nombre = account.name || account.username;
  const { roles, permissions } = resolveAccess(me);
  return {
    id: me?.id || account.localAccountId,
    nombre,
    correo: account.username,
    cargo: 'Operaciones',
    equipo: 'Vicepresidencia de Operaciones',
    // Foto real de la cuenta (Microsoft Graph); iniciales como fallback
    foto:
      foto ??
      `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(nombre)}&backgroundColor=0d6cbd&textColor=ffffff`,
    roles,
    permissions,
  };
}

export type AuthStatus = 'loading' | 'login' | 'inactive' | 'ready';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private msal: PublicClientApplication | null = null;
  private initPromise: Promise<PublicClientApplication> | null = null;

  readonly status = signal<AuthStatus>(authEnabled ? 'loading' : 'ready');
  readonly user = signal<User>(MOCK_USER);
  readonly profile = signal<MeApi | null>(null);
  readonly isAuthenticated = computed(() => !authEnabled || this.status() === 'ready');
  readonly isAdmin = computed(() => this.hasPermission('platform.admin'));

  /** Arranque de sesión: procesa el redirect y, si hay cuenta, carga el perfil
   *  de alma.Users. Sin cuenta deja el estado en 'login' (pantalla de ingreso). */
  async init(loadProfile: () => Promise<MeApi | null>): Promise<void> {
    if (!authEnabled) return;
    try {
      const account = await this.ensureSignedIn();
      if (!account) {
        this.status.set('login');
        return;
      }
      void this.fetchAccountPhoto().then((url) => {
        if (url) this.user.update((u) => ({ ...u, foto: url }));
      });
      let me: MeApi | null = null;
      try {
        me = await loadProfile();
        this.profile.set(me);
        // Usuario inactivo: aunque la autenticación sea válida, no entra.
        if (me?.registrado && me.is_active === false) {
          this.user.set(accountToUser(account, me, null));
          this.status.set('inactive');
          return;
        }
      } catch (err) {
        console.error('[auth] no se pudo cargar /api/users/me', err);
      }
      this.user.set(accountToUser(account, me, null));
      this.status.set('ready');
    } catch (err) {
      console.error('[auth] error inicializando MSAL', err);
      this.status.set('ready');
    }
  }

  /** Soporta comodines por App: 'app.<slug>.*' concede 'app.<slug>.<accion>'. */
  hasPermission(permission: string): boolean {
    const perms = this.user().permissions;
    if (perms.includes('*') || perms.includes(permission)) return true;
    for (const g of perms) {
      if (g.endsWith('.*') && permission.startsWith(g.slice(0, -1))) return true;
    }
    return false;
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some((p) => this.hasPermission(p));
  }

  private async getMsal(): Promise<PublicClientApplication> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        this.msal = new PublicClientApplication({
          auth: {
            clientId: CLIENT_ID,
            authority: `https://login.microsoftonline.com/${TENANT_ID}`,
            redirectUri: window.location.origin,
            postLogoutRedirectUri: window.location.origin,
          },
          cache: {
            // localStorage: la sesión sobrevive refresh y pestañas nuevas
            cacheLocation: 'localStorage',
          },
        });
        await this.msal.initialize();
        return this.msal;
      })();
    }
    return this.initPromise;
  }

  private getAccount(app: PublicClientApplication): AccountInfo | null {
    return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
  }

  /** Devuelve la cuenta si ya hay sesión (procesando el retorno del redirect si
   *  aplica). NO dispara login. */
  private async ensureSignedIn(): Promise<AccountInfo | null> {
    const app = await this.getMsal();

    const result = await app.handleRedirectPromise();
    if (result?.account) {
      app.setActiveAccount(result.account);
      return result.account;
    }

    const account = this.getAccount(app);
    if (account) {
      app.setActiveAccount(account);
      return account;
    }
    return null;
  }

  /** Inicia sesión con Microsoft (redirect). Lo dispara el botón del login. */
  async signIn(): Promise<void> {
    if (!authEnabled) return;
    const app = await this.getMsal();
    await app.loginRedirect({ scopes: [API_SCOPE], extraScopesToConsent: ['User.Read'] });
  }

  /** Access token para el API de Alma (silencioso; si expiró la sesión, redirect). */
  async getAccessToken(): Promise<string | null> {
    if (!authEnabled) return null;
    const app = await this.getMsal();
    const account = this.getAccount(app);
    if (!account) {
      await app.loginRedirect({ scopes: [API_SCOPE], extraScopesToConsent: ['User.Read'] });
      return null;
    }
    try {
      const result = await app.acquireTokenSilent({ scopes: [API_SCOPE], account });
      return result.accessToken;
    } catch {
      await app.acquireTokenRedirect({ scopes: [API_SCOPE], account });
      return null;
    }
  }

  /** Access token para Microsoft Graph (User.Read — foto y perfil básicos). */
  private async getGraphToken(): Promise<string | null> {
    const app = await this.getMsal();
    const account = this.getAccount(app);
    if (!account) return null;
    try {
      const result = await app.acquireTokenSilent({ scopes: ['User.Read'], account });
      return result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await app.acquireTokenRedirect({ scopes: ['User.Read'], account });
        return null; // el navegador redirige; al volver, el token ya está en caché
      }
      console.warn('[auth] no se pudo obtener token de Graph para la foto:', err);
      return null;
    }
  }

  /** Access token para leer el DIRECTORIO (Graph, User.ReadBasic.All): resuelve
   *  el nombre de otras personas al registrarlas en Accesos. */
  async getDirectoryToken(interactivo = false): Promise<string | null> {
    if (!authEnabled) return null;
    const app = await this.getMsal();
    const account = this.getAccount(app);
    if (!account) return null;
    const scopes = ['User.ReadBasic.All'];
    try {
      const result = await app.acquireTokenSilent({ scopes, account });
      return result.accessToken;
    } catch (err) {
      if (interactivo && err instanceof InteractionRequiredAuthError) {
        await app.acquireTokenRedirect({ scopes, account });
        return null;
      }
      console.warn('[auth] sin token de directorio (User.ReadBasic.All):', err);
      return null;
    }
  }

  private async fetchAccountPhoto(): Promise<string | null> {
    try {
      const token = await this.getGraphToken();
      if (!token) return null;
      const res = await fetch('https://graph.microsoft.com/v1.0/me/photos/96x96/$value', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return URL.createObjectURL(await res.blob());
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    if (!authEnabled) return;
    const app = await this.getMsal();
    await app.logoutRedirect({ account: this.getAccount(app) ?? undefined });
  }
}
