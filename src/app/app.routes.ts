import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./ui/home/home.component').then((m) => m.HomeComponent),
    title: 'ALMA — Skandia',
  },
  {
    path: 'applications',
    loadComponent: () =>
      import('./ui/applications/applications.component').then(
        (m) => m.ApplicationsComponent,
      ),
    title: 'Aplicaciones — ALMA',
  },
  {
    path: 'apps/:appId',
    loadComponent: () =>
      import('./ui/app-host/app-host.component').then((m) => m.AppHostComponent),
    title: 'ALMA — Skandia',
  },
  {
    path: 'access-requests',
    loadComponent: () =>
      import('./ui/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: {
      pageTitle: 'Solicitudes de acceso',
      pageDescription: 'Pide acceso a nuevas aplicaciones y sigue el estado de tus solicitudes.',
    },
    title: 'Solicitudes de acceso — ALMA',
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./ui/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: {
      pageTitle: 'Administración',
      pageDescription: 'Gestión de aplicaciones, roles y accesos de la plataforma.',
    },
    title: 'Administración — ALMA',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./ui/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: {
      pageTitle: 'Configuración',
      pageDescription: 'Preferencias de tu cuenta y de la plataforma.',
    },
    title: 'Configuración — ALMA',
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./ui/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: {
      pageTitle: 'Ayuda',
      pageDescription: 'Centro de ayuda y documentación de ALMA.',
    },
    title: 'Ayuda — ALMA',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./ui/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
    data: {
      pageTitle: 'Mi perfil',
      pageDescription: 'Tu información personal y roles en la plataforma.',
    },
    title: 'Mi perfil — ALMA',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./ui/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Página no encontrada — ALMA',
  },
];
