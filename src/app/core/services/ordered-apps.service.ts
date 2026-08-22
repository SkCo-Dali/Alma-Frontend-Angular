// Todas las Apps en el orden ÚNICO del usuario (preferencias.appOrder),
// incluidas las Apps de plataforma (Configuración siempre; Accesos si el
// usuario es admin de plataforma o de alguna App). Fuente de verdad para el
// Dock (primeras dockCount) y el Launchpad (todas). Paridad use-ordered-apps.

import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { Application } from '../models/platform.models';
import { ApplicationsService } from './applications.service';
import { PreferencesService } from './preferences.service';

function appPlataforma(
  over: Partial<Application> &
    Pick<Application, 'id' | 'nombre' | 'icono' | 'color' | 'internalRoute'>,
): Application {
  return {
    descripcion: '',
    categoria: 'Plataforma',
    url: '',
    integrationType: 'internal',
    requiredPermission: '',
    estado: 'active',
    favorito: false,
    ...over,
  };
}

const CONFIG_APP = appPlataforma({
  id: 'app-configuracion',
  nombre: 'Configuración',
  descripcion: 'Apariencia, conexiones y ayuda del portal.',
  icono: 'settings',
  iconUrl: '/app-icons/configuracion.png',
  color: '#64748B',
  internalRoute: '/settings',
});

const ADMIN_APP = appPlataforma({
  id: 'app-administracion',
  nombre: 'Accesos',
  descripcion: 'Usuarios, roles, auditoría y métricas de la plataforma.',
  icono: 'shield-check',
  iconUrl: '/app-icons/accesos.png',
  color: '#33415A',
  internalRoute: '/admin',
});

@Injectable({ providedIn: 'root' })
export class OrderedAppsService {
  private readonly apps = inject(ApplicationsService);
  private readonly auth = inject(AuthService);
  private readonly prefs = inject(PreferencesService);

  readonly ordered = computed<Application[]>(() => {
    const user = this.auth.user();
    const appOrder = this.prefs.appOrder();
    const esAdmin =
      this.auth.hasPermission('platform.access.view') ||
      this.auth.hasPermission('platform.audit.view') ||
      this.auth.hasPermission('platform.metrics.view') ||
      user.permissions.some((p) => p.startsWith('app.') && p.endsWith('.*'));

    const todas: Application[] = [...this.apps.applications(), CONFIG_APP];
    if (esAdmin) todas.push(ADMIN_APP);

    const pos = new Map(appOrder.map((id, i) => [id, i]));
    return [...todas].sort((a, b) => {
      const pa = pos.has(a.id) ? (pos.get(a.id) as number) : appOrder.length + todas.indexOf(a);
      const pb = pos.has(b.id) ? (pos.get(b.id) as number) : appOrder.length + todas.indexOf(b);
      return pa - pb;
    });
  });
}

/** Mueve `fromId` junto a `toId`; con `after` lo inserta DESPUÉS del destino. */
export function reordenar(
  ordenIds: string[],
  fromId: string,
  toId: string,
  after = false,
): string[] {
  const rest = ordenIds.filter((x) => x !== fromId);
  let ti = rest.indexOf(toId);
  if (ti < 0) return ordenIds;
  if (after) ti += 1;
  rest.splice(ti, 0, fromId);
  return rest;
}
