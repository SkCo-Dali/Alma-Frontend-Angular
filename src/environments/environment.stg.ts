// Staging / UAT — app registration Alma-Uat + backend por Sensedia (stg).
export const environment = {
  production: false,
  name: 'stg',
  apiUrl: 'https://apisstg.skandia.com.co/SkCo.Alma.API',
  azure: {
    clientId: '2e8727a9-d58a-40fd-959f-f7f7e3f4b03a',
    tenantId: '08271f42-81ef-45d6-81ac-49776c4be615',
  },
  /** Apps de otros equipos montadas en el shell (App Manifest). */
  remotes: {
    sacUsuarios: {
      scriptUrl: 'https://skco-sac-usuarios-web-stg.azurewebsites.net/SkCo.UserManagement.Angular.js',
      styleUrl: 'https://skco-sac-usuarios-web-stg.azurewebsites.net/SkCo.UserManagement.Angular.css',
    },
  },
};
