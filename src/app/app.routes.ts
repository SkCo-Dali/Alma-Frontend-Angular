import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./ui/home/home.component').then((m) => m.HomeComponent),
    title: 'ALMA — Skandia',
  },
  // La antigua /applications se reemplazó por el Launchpad del Dock; /help se
  // integró en Configuración. Se mantienen solo para redirigir enlaces viejos.
  { path: 'applications', redirectTo: '', pathMatch: 'full' },
  { path: 'help', redirectTo: 'settings', pathMatch: 'full' },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./ui/favorites/favorites.component').then((m) => m.FavoritesComponent),
    title: 'Favoritos — ALMA',
  },
  {
    path: 'apps/cheques',
    loadComponent: () =>
      import('./features/cheques/cheques-page.component').then(
        (m) => m.ChequesPageComponent,
      ),
    title: 'Cheques — ALMA',
  },
  {
    path: 'apps/agente-alma',
    loadComponent: () =>
      import('./features/agente-alma/agente-alma-page.component').then(
        (m) => m.AgenteAlmaPageComponent,
      ),
    title: 'Agente Alma — ALMA',
  },
  {
    path: 'apps/suscripcion',
    loadComponent: () =>
      import('./features/suscripcion/suscripcion-page.component').then(
        (m) => m.SuscripcionPageComponent,
      ),
    title: 'Suscripción de Seguros — ALMA',
  },
  {
    path: 'apps/:appId',
    loadComponent: () =>
      import('./ui/app-host/app-host.component').then((m) => m.AppHostComponent),
    title: 'ALMA — Skandia',
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./ui/admin/admin.component').then((m) => m.AdminComponent),
    title: 'Accesos — ALMA',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./ui/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Configuración — ALMA',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./ui/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Mi perfil — ALMA',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./ui/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Página no encontrada — ALMA',
  },
];
