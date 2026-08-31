// Cliente del correo de PLATAFORMA (/api/correo, alma-backend): buzones por
// App y su conexión OAuth. Las operaciones "por App" (plantillas, envío,
// historial) siguen viviendo en el cliente de cada App (p.ej. SuscripcionApi)
// porque llevan su propio contexto; esto es la cara administrativa.

import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

export interface PlantillaCorreoApi {
  id: string;
  app_slug: string | null;
  /** 'plataforma' (todas las Apps) | 'app' (compartida del área) | 'personal'. */
  ambito: 'plataforma' | 'app' | 'personal';
  propietario: string | null;
  nombre: string;
  categoria: string;
  asunto: string;
  cuerpo_html: string;
  activa: boolean;
  creada_en: string;
  creada_por: string;
  actualizada_en: string | null;
  actualizada_por: string | null;
}

export interface PlantillaCorreoIn {
  nombre: string;
  categoria: string;
  asunto: string;
  cuerpo_html: string;
  ambito?: 'app' | 'personal';
}

export interface BuzonCorreoApi {
  id: string;
  direccion: string;
  app_slug: string | null;
  descripcion: string | null;
  estado: string;
  conectada: boolean;
  conectada_por: string | null;
  conectada_en: string | null;
  scopes: string;
  puede_administrar: boolean;
}

@Injectable({ providedIn: 'root' })
export class CorreoApi {
  private readonly api = inject(ApiService);

  getBuzones(): Promise<{ configurado: boolean; items: BuzonCorreoApi[] }> {
    return this.api.fetch('/api/correo/buzones');
  }

  conectarBuzon(buzonId: string, code: string, redirectUri: string):
    Promise<{ conectada: boolean; email: string }> {
    return this.api.fetch(`/api/correo/buzones/${buzonId}/conectar`, {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
  }

  desconectarBuzon(buzonId: string): Promise<void> {
    return this.api.fetch(`/api/correo/buzones/${buzonId}/conexion`, { method: 'DELETE' });
  }

  // ── Plantillas (transversales, con dueño por App y ámbito) ────────────────

  getPlantillas(app: string, soloActivas = false): Promise<{
    items: PlantillaCorreoApi[];
    variables: Record<string, string>;
    puede_gestionar: boolean;
  }> {
    return this.api.fetch(
      `/api/correo/plantillas?app=${encodeURIComponent(app)}` +
      (soloActivas ? '&solo_activas=true' : ''));
  }

  crearPlantilla(app: string, body: PlantillaCorreoIn): Promise<PlantillaCorreoApi> {
    return this.api.fetch('/api/correo/plantillas', {
      method: 'POST',
      body: JSON.stringify({ ...body, app_slug: app }),
    });
  }

  actualizarPlantilla(id: string, body: Partial<PlantillaCorreoIn> & { activa?: boolean }):
    Promise<PlantillaCorreoApi> {
    return this.api.fetch(`/api/correo/plantillas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  eliminarPlantilla(id: string): Promise<void> {
    return this.api.fetch(`/api/correo/plantillas/${id}`, { method: 'DELETE' });
  }
}
