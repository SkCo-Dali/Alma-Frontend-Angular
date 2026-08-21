# 📦 ALMA — Frontend Angular

Shell de la plataforma **ALMA** (Vicepresidencia de Operaciones de Skandia) en Angular.
Reemplaza al front React ([Alma-Frontend](https://github.com/SkCo-Dali/Alma-Frontend)) manteniendo paridad visual y funcional, y convierte a ALMA en un **contenedor de aplicaciones** al que cualquier equipo puede conectar las suyas.

---

## 🚀 Stack

| Categoría      | Tecnología |
|----------------|------------|
| Framework      | Angular 21 (standalone, signals, zoneless) — alineado a `SkCo.ProjectTemplate.Angular` |
| Componentes    | PrimeNG 21 + `@primeng/themes` con preset **Alma** (Aura + verde Skandia `#00C83C`) |
| Estilos        | Tailwind CSS 4 con los design tokens macOS/aurora portados del front React |
| Iconografía    | lucide (los mismos íconos del front React) |
| Autenticación  | Microsoft Entra ID vía `@azure/msal-browser` (app registration por ambiente) |
| Backend        | `SkCo.Alma.API` (FastAPI) — sin cambios |
| Despliegue     | Azure Static Web Apps vía GitHub Actions (rama → ambiente) |

## 📁 Estructura

```
src/
├── app/
│   ├── core/           # Núcleo de la plataforma
│   │   ├── auth/          # AuthService (MSAL + fallback mock)
│   │   ├── constants/     # Catálogo de apps (App Manifest) y roles
│   │   ├── models/        # Modelos de plataforma
│   │   └── services/      # API, aplicaciones, tema, estado UI
│   ├── shared/         # Header, Dock, loader de marca, íconos
│   └── ui/             # Páginas del shell (home, aplicaciones, host de apps)
└── environments/       # local / dev / stg / prd (fileReplacements)
```

## 🧩 Cómo se conecta una app a ALMA (App Manifest)

Cada aplicación se registra en el catálogo (`core/constants/app-catalog.ts`, próximamente servido por alma-backend) con un manifest:

| Campo | Uso |
|-------|-----|
| `nombre / icono / color` | Tile en el dock y en el catálogo |
| `requiredPermission` | RBAC: el dock solo pinta lo que el usuario puede abrir |
| `integrationType` | `internal` (lazy route en este workspace) · `microfrontend` (remota federada) · `iframe` (app existente con SSO silencioso) · `external` (link) |
| `internalRoute / url` | Destino según el tipo |

Las apps reales del front React (Motor de Comisiones, Suscripción, Cheques, Agente Alma) están **en migración**: su manifest ya existe y su ruta muestra el estado hasta que se porten.

## ⚙️ Ejecutar en local

```bash
npm install
npm start        # http://localhost:4200 — sin Entra: usuario mock con todos los permisos
```

Con `npm start` la auth queda deshabilitada (clientId vacío en `environment.ts`) y se usa el usuario mock — ideal para trabajar en UI. Los builds por ambiente (`build:dev|stg|prd`) inyectan el app registration real vía `fileReplacements`.

## 🔒 Autenticación

MSAL contra Entra ID (Alma-Dev / Alma-Uat / Alma-Prd), portado 1:1 del front React:
login por redirect, token silencioso para `api://{clientId}/access_as_user`, foto de perfil
vía Microsoft Graph (`User.Read`) y rol real desde `GET /api/users/me` (alma.Users).

## 🚢 Despliegue

`develop` → SWA **SkCoAlmaAngularDev** (Development) · `staging` → UAT · `main` → Production.
El workflow compila con la configuración del ambiente y sube `dist/browser` + `staticwebapp.config.json`.
Secreto requerido por environment: `AZURE_STATIC_WEB_APPS_API_TOKEN`.
