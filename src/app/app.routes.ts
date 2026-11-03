import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./ui/home/home.component').then((m) => m.HomeComponent),
    title: 'Nova — Skandia',
  },
  // La antigua /applications se reemplazó por el Launchpad del Dock; /help se
  // integró en Configuración. Se mantienen solo para redirigir enlaces viejos.
  { path: 'applications', redirectTo: '', pathMatch: 'full' },
  { path: 'help', redirectTo: 'settings', pathMatch: 'full' },
  {
    path: 'favorites',
    loadComponent: () =>
      import('./ui/favorites/favorites.component').then((m) => m.FavoritesComponent),
    title: 'Favoritos — Nova',
  },
  {
    path: 'apps/agente-alma',
    loadComponent: () =>
      import('./features/agente-alma/agente-alma-page.component').then(
        (m) => m.AgenteAlmaPageComponent,
      ),
    title: 'Agente Nova — Nova',
  },
  {
    path: 'apps/visor-comunicaciones',
    loadComponent: () =>
      import('./features/visor-comunicaciones/visor-comunicaciones-page.component').then(
        (m) => m.VisorComunicacionesPageComponent,
      ),
    title: 'Visor de comunicaciones — Nova',
  },
  // App Buzón Inteligente: landing + bandeja + buzones (lista/config) + métricas.
  {
    path: 'apps/buzon-inteligente',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/buzon-inteligente/buzon-landing.component').then(
        (m) => m.BuzonLandingComponent,
      ),
    title: 'Buzón Inteligente — Nova',
  },
  {
    path: 'apps/buzon-inteligente/bandeja',
    loadComponent: () =>
      import('./features/buzon-inteligente/bandeja-buzon.component').then(
        (m) => m.BandejaBuzonComponent,
      ),
    title: 'Bandeja — Buzón Inteligente — Nova',
  },
  {
    path: 'apps/buzon-inteligente/buzones',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/buzon-inteligente/buzones-page.component').then(
        (m) => m.BuzonesPageComponent,
      ),
    title: 'Buzones — Buzón Inteligente — Nova',
  },
  {
    path: 'apps/buzon-inteligente/buzones/:id',
    loadComponent: () =>
      import('./features/buzon-inteligente/buzon-config.component').then(
        (m) => m.BuzonConfigComponent,
      ),
    title: 'Configurar buzón — Buzón Inteligente — Nova',
  },
  {
    path: 'apps/buzon-inteligente/metricas',
    loadComponent: () =>
      import('./features/buzon-inteligente/metricas-buzon.component').then(
        (m) => m.MetricasBuzonComponent,
      ),
    title: 'Métricas — Buzón Inteligente — Nova',
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
    title: 'Suscripción de Seguros — Nova',
  },
  {
    path: 'apps/suscripcion/cotizaciones',
    loadComponent: () =>
      import('./features/suscripcion/cotizaciones-page.component').then(
        (m) => m.CotizacionesPageComponent,
      ),
    title: 'Bandeja de Cotizaciones — Nova',
  },
  {
    path: 'apps/suscripcion/motor',
    loadComponent: () =>
      import('./features/suscripcion/motor-config/motor-config-page.component').then(
        (m) => m.MotorConfigPageComponent,
      ),
    title: 'Configuración del motor — Nova',
  },
  {
    path: 'apps/suscripcion/reporteria',
    loadComponent: () =>
      import('./features/suscripcion/reporteria/reporteria-page.component').then(
        (m) => m.ReporteriaPageComponent,
      ),
    title: 'Auditoría y reportería — Nova',
  },
  {
    // Retorno del OAuth delegado del buzón de suscripción (redirect URI de
    // las apps de Entra). Fuera de /apps/suscripcion para no chocar con
    // :solicitudId y sobrevivir a cambios de esa jerarquía.
    path: 'graph-callback',
    loadComponent: () =>
      import('./features/suscripcion/graph-callback.component').then(
        (m) => m.GraphCallbackComponent,
      ),
    title: 'Conectando buzón — Nova',
  },
  {
    path: 'apps/suscripcion/simulador',
    loadComponent: () =>
      import(
        './features/suscripcion/simulador-config/simulador-config-page.component'
      ).then((m) => m.SimuladorConfigPageComponent),
    title: 'Configuración del Simulador — Nova',
  },
  {
    // Detalle de una cotización. Va DESPUÉS de las rutas fijas de la app para
    // que /cotizaciones, /motor y /simulador no se traguen como :solicitudId.
    path: 'apps/suscripcion/:solicitudId',
    loadComponent: () =>
      import('./features/suscripcion/detalle-solicitud.component').then(
        (m) => m.DetalleSolicitudComponent,
      ),
    title: 'Suscripción de Seguros — Nova',
  },
  // App Motor de Comisiones: landing de tiles + sub-módulos.
  {
    path: 'apps/motor-comisiones',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/comisiones/comisiones-landing.component').then(
        (m) => m.ComisionesLandingComponent,
      ),
    title: 'Motor de Comisiones — Nova',
  },
  {
    path: 'apps/motor-comisiones/compensation-plans',
    loadComponent: () =>
      import('./features/comisiones/planes/compensation-plans.page').then(
        (m) => m.CompensationPlansPageComponent,
      ),
    title: 'Planes de Compensación — Nova',
  },
  {
    path: 'apps/motor-comisiones/catalogs',
    loadComponent: () =>
      import('./features/comisiones/catalogos/catalogs.page').then(
        (m) => m.CatalogsPageComponent,
      ),
    title: 'Catálogos — Nova',
  },
  {
    path: 'apps/motor-comisiones/ejecucion-motor',
    loadComponent: () =>
      import('./features/comisiones/ejecucion/ejecucion-motor.page').then(
        (m) => m.EjecucionMotorPageComponent,
      ),
    title: 'Ejecución del Motor — Nova',
  },
  {
    path: 'apps/motor-comisiones/accounting',
    loadComponent: () =>
      import('./features/comisiones/parametrizacion/parametrizacion.page').then(
        (m) => m.ParametrizacionPageComponent,
      ),
    title: 'Parametrización — Nova',
  },
  {
    path: 'apps/motor-comisiones/desarrollo-comercial',
    loadComponent: () =>
      import('./features/comisiones/desarrollo-comercial/desarrollo-comercial.page').then(
        (m) => m.DesarrolloComercialPageComponent,
      ),
    title: 'Desarrollo Comercial — Nova',
  },
  {
    path: 'apps/motor-comisiones/info-gerencial',
    loadComponent: () =>
      import('./features/comisiones/info-gerencial/info-gerencial.page').then(
        (m) => m.InfoGerencialPageComponent,
      ),
    title: 'Métricas y Reportes — Nova',
  },
  // App Acreditación PAC (Recaudos): bandeja + configuración de estados.
  {
    path: 'apps/recaudos-aplicacion-pagos',
    loadComponent: () =>
      import('./features/aplicacion-pagos/aplicacion-pagos-page.component').then(
        (m) => m.AplicacionPagosPageComponent,
      ),
    title: 'Aplicación de Pagos — Nova',
  },
  // App Monitor-IA (SAC): campañas de autoevaluación automática de llamadas en Genesys.
  {
    path: 'apps/monitor-ia',
    loadComponent: () =>
      import('./features/monitor-ia/monitor-ia-page.component').then(
        (m) => m.MonitorIaPageComponent,
      ),
    title: 'Monitor-IA — Nova',
  },
  {
    path: 'apps/recaudos-acreditacion-pac',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/recaudos-acreditacion-pac/recaudos-pac-page.component').then(
        (m) => m.RecaudosPacPageComponent,
      ),
    title: 'Acreditación PAC — Nova',
  },
  {
    path: 'apps/recaudos-acreditacion-pac/estados',
    loadComponent: () =>
      import('./features/recaudos-acreditacion-pac/estados-config-page.component').then(
        (m) => m.EstadosConfigPageComponent,
      ),
    title: 'Configuración de estados — Acreditación PAC — Nova',
  },
  {
    path: 'apps/:appId',
    loadComponent: () =>
      import('./ui/app-host/app-host.component').then((m) => m.AppHostComponent),
    title: 'Nova — Skandia',
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./ui/admin/admin.component').then((m) => m.AdminComponent),
    title: 'Accesos — Nova',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./ui/settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Configuración — Nova',
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./ui/profile/profile.component').then((m) => m.ProfileComponent),
    title: 'Mi perfil — Nova',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./ui/not-found/not-found.component').then((m) => m.NotFoundComponent),
    title: 'Página no encontrada — Nova',
  },
];
