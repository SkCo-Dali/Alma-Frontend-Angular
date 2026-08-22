// Producción — app registration Alma-Prd + backend por Sensedia.
export const environment = {
  production: true,
  name: 'prd',
  apiUrl: 'https://apis.skandia.com.co/SkCo.Alma.API',
  azure: {
    clientId: '30fe7ddc-476c-4341-adef-f053bfe376b3',
    tenantId: '08271f42-81ef-45d6-81ac-49776c4be615',
  },
  /** Apps de otros equipos montadas en el shell (App Manifest). */
  remotes: {
    sacUsuarios: {
      scriptUrl: 'https://skco-sac-usuarios-web-prd.azurewebsites.net/SkCo.UserManagement.Angular.js',
      styleUrl: 'https://skco-sac-usuarios-web-prd.azurewebsites.net/SkCo.UserManagement.Angular.css',
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
