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
    },
  },
};
