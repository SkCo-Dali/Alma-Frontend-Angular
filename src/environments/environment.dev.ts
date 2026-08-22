// Desarrollo — app registration Alma-Dev + backend dev (App Service).
// Mismos valores que usa el front React (GitHub Environment "Development").
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
    },
  },
};
