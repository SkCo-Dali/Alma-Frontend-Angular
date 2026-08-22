// Cliente del módulo Accesos y Roles (alma-backend /api/accesos/*).
// RBAC por App: los usuarios se identifican por Users.Id; el email es contacto.
// Un admin de App (permiso app.<slug>.*) solo ve/gestiona los roles de su App.

import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ApiService } from './api.service';

export interface RolCatalogo {
  role_id: string;
  app: string | null; // null = rol de plataforma
  slug: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface RolAsignado {
  role_id: string;
  app: string | null;
  slug: string;
  name: string;
}

export interface UsuarioDirectorio {
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
  roles: RolAsignado[];
}

export interface EventoAuditoria {
  email: string;
  role: string;
  action: 'granted' | 'revoked';
  performed_by: string;
  date: string;
}

export function etiquetaRol(r: { app: string | null; name: string }): string {
  return r.app ? `${r.app} · ${r.name}` : `Plataforma · ${r.name}`;
}

@Injectable({ providedIn: 'root' })
export class AccesosApi {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  listarRoles(): Promise<RolCatalogo[]> {
    return this.api.fetch<RolCatalogo[]>('/api/accesos/roles');
  }

  listarUsuarios(): Promise<UsuarioDirectorio[]> {
    return this.api.fetch<UsuarioDirectorio[]>('/api/accesos/usuarios');
  }

  /** Nombre para mostrar de una persona del directorio (Graph); null si no hay
   *  token/consentimiento o el correo no existe. */
  async resolverNombreDirectorio(email: string, interactivo = false): Promise<string | null> {
    const token = await this.auth.getDirectoryToken(interactivo);
    if (!token) return null;
    try {
      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=displayName`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!resp.ok) return null;
      const data = (await resp.json()) as { displayName?: string };
      return data.displayName?.trim() || null;
    } catch {
      return null;
    }
  }

  crearUsuario(email: string, name?: string | null): Promise<{ user_id: string }> {
    return this.api.fetch('/api/accesos/usuarios', {
      method: 'POST',
      body: JSON.stringify({ email, name: name || undefined }),
    });
  }

  actualizarUsuario(userId: string, name: string, isActive: boolean): Promise<UsuarioDirectorio> {
    return this.api.fetch(`/api/accesos/usuarios/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, is_active: isActive }),
    });
  }

  otorgarRol(userId: string, roleId: string): Promise<{ granted: boolean }> {
    return this.api.fetch('/api/accesos/asignaciones', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role_id: roleId }),
    });
  }

  revocarRol(userId: string, roleId: string): Promise<{ revoked: boolean }> {
    return this.api.fetch('/api/accesos/asignaciones', {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId, role_id: roleId }),
    });
  }

  listarAuditoria(): Promise<EventoAuditoria[]> {
    return this.api.fetch<EventoAuditoria[]>('/api/accesos/auditoria');
  }
}
