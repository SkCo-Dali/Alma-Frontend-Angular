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
  // App Suscripción de Seguros: landing de tiles + subpáginas de-anidadas
  // (bandeja, config del motor, config del simulador y detalle por id).
  {
    path: 'apps/suscripcion',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/suscripcion/suscripcion-landing.component').then(
        (m) => m.SuscripcionLandingComponent,
      ),
    title: 'Suscripción de Seguros — ALMA',
  },
  {
    path: 'apps/suscripcion/cotizaciones',
    loadComponent: () =>
      import('./features/suscripcion/cotizaciones-page.component').then(
        (m) => m.CotizacionesPageComponent,
      ),
    title: 'Bandeja de Cotizaciones — ALMA',
  },
  {
    path: 'apps/suscripcion/motor',
    loadComponent: () =>
      import('./features/suscripcion/motor-config/motor-config-page.component').then(
        (m) => m.MotorConfigPageComponent,
      ),
    title: 'Configuración del motor — ALMA',
  },
  {
    path: 'apps/suscripcion/plantillas',
    loadComponent: () =>
      import('./features/suscripcion/plantillas-correo-page.component').then(
        (m) => m.PlantillasCorreoPageComponent,
      ),
    title: 'Plantillas de correo — ALMA',
  },
  {
    path: 'apps/suscripcion/simulador',
    loadComponent: () =>
      import(
        './features/suscripcion/simulador-config/simulador-config-page.component'
      ).then((m) => m.SimuladorConfigPageComponent),
    title: 'Configuración del Simulador — ALMA',
  },
  {
    // Detalle de una cotización. Va DESPUÉS de las rutas fijas de la app para
    // que /cotizaciones, /motor y /simulador no se traguen como :solicitudId.
    path: 'apps/suscripcion/:solicitudId',
    loadComponent: () =>
      import('./features/suscripcion/detalle-solicitud.component').then(
        (m) => m.DetalleSolicitudComponent,
      ),
    title: 'Suscripción de Seguros — ALMA',
  },
  // App Motor de Comisiones: landing de tiles + sub-módulos.
  {
    path: 'apps/motor-comisiones',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/comisiones/comisiones-landing.component').then(
        (m) => m.ComisionesLandingComponent,
      ),
    title: 'Motor de Comisiones — ALMA',
  },
  {
    path: 'apps/motor-comisiones/compensation-plans',
    loadComponent: () =>
      import('./features/comisiones/planes/compensation-plans.page').then(
        (m) => m.CompensationPlansPageComponent,
      ),
    title: 'Planes de Compensación — ALMA',
  },
  {
    path: 'apps/motor-comisiones/catalogs',
    loadComponent: () =>
      import('./features/comisiones/catalogos/catalogs.page').then(
        (m) => m.CatalogsPageComponent,
      ),
    title: 'Catálogos — ALMA',
  },
  {
    path: 'apps/motor-comisiones/ejecucion-motor',
    loadComponent: () =>
      import('./features/comisiones/ejecucion/ejecucion-motor.page').then(
        (m) => m.EjecucionMotorPageComponent,
      ),
    title: 'Ejecución del Motor — ALMA',
  },
  {
    path: 'apps/motor-comisiones/accounting',
    loadComponent: () =>
      import('./features/comisiones/parametrizacion/parametrizacion.page').then(
        (m) => m.ParametrizacionPageComponent,
      ),
    title: 'Parametrización — ALMA',
  },
  {
    path: 'apps/motor-comisiones/info-gerencial',
    loadComponent: () =>
      import('./features/comisiones/info-gerencial/info-gerencial.page').then(
        (m) => m.InfoGerencialPageComponent,
      ),
    title: 'Métricas y Reportes — ALMA',
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
