# 📦 ALMA — Frontend

Shell de la plataforma **ALMA** (Vicepresidencia de Operaciones de Skandia) en **Angular 21**.
Además de las aplicaciones propias de Operaciones, ALMA es un **contenedor de aplicaciones**:
cualquier equipo puede montar la suya dentro del shell y reutilizar la sesión, los permisos
y el diseño de la plataforma.

> Este repositorio es el **único** frontend de ALMA. El front anterior en React
> (`SkCo-Dali/alma-frontend`) quedó archivado.

---

## 🚀 Stack

| Categoría      | Tecnología |
|----------------|------------|
| Framework      | Angular 21 — standalone, signals y **zoneless** (`provideZonelessChangeDetection`) |
| Componentes    | Propios (`shared/`): checkbox, switch, tooltip, portal, tablas, paginación… |
| Estilos        | Tailwind CSS 4 sobre los design tokens del sistema de diseño de Alma (`styles.css`) |
| Iconografía    | lucide (`shared/icons.ts` — un ícono que no esté registrado ahí no se pinta) |
| Autenticación  | Microsoft Entra ID vía `@azure/msal-browser` (una app registration por ambiente) |
| Backend        | `SkCo.Alma.API` (FastAPI) — este repo no lo modifica |
| Despliegue     | Azure Static Web Apps vía GitHub Actions (una rama por ambiente) |

Sin librerías de UI de terceros ni de gráficas: los componentes y las gráficas del módulo
de comisiones son propios (SVG nativo). Es deliberado — el lenguaje visual de Alma es la
fuente de verdad y de ahí saldrá la librería de componentes de Skandia.

## 📁 Estructura

```
src/
├── app/
│   ├── core/           # Núcleo de la plataforma
│   │   ├── auth/          # AuthService (MSAL + usuario mock en local)
│   │   ├── constants/     # Catálogo de apps (App Manifest)
│   │   ├── models/        # Modelos de dominio
│   │   ├── services/      # API, aplicaciones, preferencias, tema, avisos
│   │   └── utils/         # Utilidades puras (nombres, formatos)
│   ├── features/       # Las aplicaciones: suscripción, comisiones, cheques,
│   │                   # agente, accesos, métricas
│   ├── shared/         # Header, Dock, primitivas de UI, directivas, íconos
│   └── ui/             # Páginas del shell (inicio, perfil, ajustes, host de apps)
└── environments/       # local / dev / stg / prd (fileReplacements)
```

## 🧩 Cómo se conecta una app a ALMA (App Manifest)

Cada aplicación se registra en el catálogo (`core/constants/app-catalog.ts`, que en el
futuro servirá alma-backend) con un manifest:

| Campo | Uso |
|-------|-----|
| `nombre / icono / color` | Tile en el Dock y en el Launchpad |
| `requiredPermission` | RBAC: el Dock solo pinta lo que el usuario puede abrir |
| `integrationType` | `internal` · `microfrontend` · `iframe` · `external` |
| `internalRoute / url` | Destino según el tipo |
| `remote` | Solo `microfrontend`: bundle, elemento, scopes y mapeo de roles |

**Aplicaciones propias** (`internal`): Suscripción de Seguros, Motor de Comisiones, Cheques
y Agente Alma. Viven en `features/` y se cargan por ruta *lazy*.

**Aplicaciones de otros equipos** (`microfrontend`): se publican como Web Component y el
shell las monta pasándoles la sesión por propiedades — token, usuario y roles — así que no
vuelven a autenticar ni pintan su propio menú. La primera es *Usuarios SAC*.

## ⚙️ Ejecutar en local

```bash
npm install
npm start        # http://localhost:4200
```

En local la autenticación queda deshabilitada (clientId vacío en `environment.ts`) y se usa
un usuario mock con todos los permisos, ideal para trabajar en UI. Los builds por ambiente
(`build:dev | build:stg | build:prd`) inyectan el app registration y el API reales vía
`fileReplacements`.

Todavía no hay suite de pruebas unitarias configurada: Angular 21 recomienda el builder
`@angular/build:unit-test` (vitest), y esa decisión queda para el equipo de desarrollo.

## 🔒 Autenticación

MSAL contra Entra ID (Alma-Dev / Alma-Uat / Alma-Prd): login por redirect, token silencioso
para `api://{clientId}/access_as_user`, foto de perfil vía Microsoft Graph (`User.Read`) y
permisos efectivos desde `GET /api/users/me` (alma.Users). Para una app remota con su propio
API, el shell puede pedir el token **de ese recurso** (`remote.scopes`), de modo que la app
siga validando su audiencia y sus roles sin cambiar su código.

## 🚢 Despliegue

| Rama | Environment | Static Web App | URL |
|------|-------------|----------------|-----|
| `develop` | Development | SkCoAlmaDev | https://devalma.skandia.co |
| `staging` | UAT | SkCoAlmaUat | https://uatalma.skandia.co |
| `main` | Production | SkCoAlma | https://yellow-coast-07a6bcd0f.7.azurestaticapps.net |

El workflow compila con la configuración del ambiente y sube `dist/browser` +
`staticwebapp.config.json`. Cada ambiente toma su token de despliegue del secreto de
repositorio `AZURE_SWA_TOKEN_DEV` / `AZURE_SWA_TOKEN_UAT` / `AZURE_SWA_TOKEN_PRD`.
