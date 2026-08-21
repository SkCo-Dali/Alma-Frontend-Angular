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
};
