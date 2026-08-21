// Autenticación con Microsoft Entra ID vía MSAL (una app registration por
// ambiente: Alma-Dev / Alma-Uat / Alma-Prd). Portado del front React (lib/msal.ts
// + providers/AuthProvider.tsx) a un servicio Angular con signals.
//
// - Sin clientId/tenantId en environment (dev local sin Entra) la auth queda
//   deshabilitada y la app usa el usuario mock.
// - El estado se expone con signals: status(), user(), isAdmin().

import { Injectable, computed, signal } from '@angular/core';
import {
  AccountInfo,
  InteractionRequiredAuthError,
  PublicClientApplication,
} from '@azure/msal-browser';
import { environment } from '@env/environment';
import { MOCK_USER, ROLE_PERMISSIONS } from '../constants/app-catalog';
import { MeApi, User } from '../models/platform.models';

const CLIENT_ID = environment.azure.clientId;
const TENANT_ID = environment.azure.tenantId;

export const authEnabled = Boolean(CLIENT_ID && TENANT_ID);

// Scope expuesto por la misma app registration (Expose an API)
const API_SCOPE = `api://${CLIENT_ID}/access_as_user`;

function resolveAccess(me: MeApi | null): { roles: string[]; permissions: string[] } {
  if (!me?.registrado || !me.is_active || !me.role) {
    return { roles: [], permissions: [] };
  }
  const mapped = ROLE_PERMISSIONS[me.role.toLowerCase()] ?? [];
  if (mapped.includes('*')) {
    return { roles: [me.role], permissions: ['*'] };
  }
  return { roles: [me.role], permissions: mapped };
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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private msal: PublicClientApplication | null = null;
  private initPromise: Promise<PublicClientApplication> | null = null;

  readonly status = signal<'loading' | 'ready'>(authEnabled ? 'loading' : 'ready');
  readonly user = signal<User>(MOCK_USER);
  readonly profile = signal<MeApi | null>(null);
  readonly isAuthenticated = computed(() => !authEnabled || this.status() === 'ready');
  readonly isAdmin = computed(() => {
    const p = this.user().permissions;
    return p.includes('*') || p.includes('platform.admin');
  });

  /** Arranque de sesión: procesa el redirect, asegura cuenta y carga el perfil
   *  de alma.Users. En modo mock (sin Entra) no hace nada. */
  async init(loadProfile: () => Promise<MeApi | null>): Promise<void> {
    if (!authEnabled) return;
    const account = await this.ensureSignedIn();
    if (!account) return; // loginRedirect está navegando fuera de la app
    const [me, foto] = await Promise.all([
      loadProfile().catch(() => null),
      this.fetchAccountPhoto(),
    ]);
    this.profile.set(me);
    this.user.set(accountToUser(account, me, foto));
    this.status.set('ready');
  }

  hasPermission(permission: string): boolean {
    const p = this.user().permissions;
    return p.includes('*') || p.includes(permission);
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

    await app.loginRedirect({ scopes: [API_SCOPE], extraScopesToConsent: ['User.Read'] });
    return null; // no se llega: el navegador redirige a login.microsoftonline.com
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

  /** Access token para Microsoft Graph (User.Read — foto y perfil básicos).
   *  Solo silencioso: si falta consentimiento, una pasada interactiva lo otorga. */
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
