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
      scriptUrl: 'https://skco-sac-usuarios-web-dev.azurewebsites.net/SkCo.UserManagement.Angular.js',
      styleUrl: 'https://skco-sac-usuarios-web-dev.azurewebsites.net/SkCo.UserManagement.Angular.css',
    },
  },
};
