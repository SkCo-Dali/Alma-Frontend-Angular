// Desarrollo — app registration Alma-Dev + backend dev (App Service).
export const environment = {
  production: false,
  name: 'dev',
  apiUrl: 'https://skcoalmadev-bmdza3angyh0dab9.eastus2-01.azurewebsites.net',
  azure: {
    clientId: 'd43d6a91-ee68-4e97-ada0-069a106a142a',
    tenantId: '08271f42-81ef-45d6-81ac-49776c4be615',
  },
  /** Apps de otros equipos montadas en el shell (App Manifest). */
  remotes: {
    sacUsuarios: {
      scriptUrl: 'https://skcoalmaremotesdev.z20.web.core.windows.net/sac-usuarios/SkCo.UserManagement.Angular.js',
      styleUrl: 'https://skcoalmaremotesdev.z20.web.core.windows.net/sac-usuarios/SkCo.UserManagement.Angular.css',
      /** Base del API de la app remota; vacío ⇒ la que trae su propio build. */
      apiBaseUrl: '',
      /**
       * Vacío ⇒ la app remota recibe el token de Alma (su API acepta la
       * audiencia de Alma). Para que valide su PROPIA audiencia y sus app roles
       * sin cambiarle código, poner aquí su scope
       * ('api://37f7436f-806a-4372-90f4-f5f56d24edc1/access_as_user')
       * y pre-autorizar el cliente de Alma en su app registration.
       */
      scopes: [] as string[],
    },
  },
};
