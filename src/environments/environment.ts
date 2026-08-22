// Local: sin Entra (clientId vacío ⇒ auth deshabilitada, usuario mock) y
// backend local. Los builds por ambiente reemplazan este archivo (fileReplacements).
export const environment = {
  production: false,
  name: 'local',
  apiUrl: 'http://localhost:8000',
  azure: {
    clientId: '',
    tenantId: '',
  },
  /** Apps de otros equipos montadas en el shell (App Manifest). */
  remotes: {
    sacUsuarios: {
      scriptUrl: 'http://localhost:4310/SkCo.UserManagement.Angular.js',
      styleUrl: 'http://localhost:4310/SkCo.UserManagement.Angular.css',
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
