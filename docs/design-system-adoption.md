# Adopción del Design System de Skandia en Alma

> **SUPERSEDED** — Este documento describe el plan de adopción de `sk-components-angular`, que
> quedó bloqueado por el feed privado de Azure Artifacts nunca configurado en este entorno. Se
> reemplazó por la adopción de `@skandia/ui` (repo `SkCo.Fidu.DesignSystem.Lib.UX`), consumido vía
> tarball vendorizado sin depender de ese feed — ver **`docs/skandia-ui-adoption.md`** para el
> estado actual. Se conserva este archivo por su valor histórico (decisiones de tipografía/
> foundations que siguen vigentes) y para git-blame, no por vigencia del plan.

Estado de la migración descrita en el plan de mejoras (auditoría Rams + sk-components-ref +
desarrollo-frontend + skandia-comunicacion). Este documento existe para que cualquiera pueda
retomar el trabajo exactamente donde quedó, sin releer el hilo completo.

## Bloqueo activo: feed privado de `sk-components-angular`

`sk-components-angular` (y sus peers `primeng`, `primeicons`, `@primeuix/themes`) no están en el
registro público de npm — viven en un feed privado de Skandia (Azure Artifacts u otro). Esta
sesión de trabajo no tenía ese registro configurado ni credenciales, así que **todo lo que
requiere el paquete real está declarado pero no instalado**.

`package.json` ya lista las dependencias (`sk-components-angular@1.5.0` + peers) para que
`npm install` las traiga en cuanto el registro esté configurado. Sin ese registro, `npm install`
fallará específicamente en `sk-components-angular` (404) — es esperado, no un bug.

### Para retomarlo

1. Configurar el feed privado en `.npmrc` (raíz del proyecto o global):
   ```
   @<scope o feed>:registry=https://pkgs.dev.azure.com/<org>/_packaging/<feed>/npm/registry/
   always-auth=true
   //pkgs.dev.azure.com/<org>/_packaging/<feed>/npm/registry/:_authToken=<token>
   ```
   (Pedir la URL exacta y el token a Arquitectura Frontend — no está documentada en las skills
   consumidas, que asumen un entorno ya autenticado.)
2. `npm install`.
3. **Fase 0 del plan — spike de viabilidad**, ahora ejecutable:
   - `npx ng build --configuration production` y comparar el bundle contra el baseline de esta
     sesión (729 kB raw / 176 kB transfer inicial, muy por debajo del budget 2mb/4mb). El costo
     real de PrimeNG se mide aquí.
   - Montar `sk-modal`, `sk-input-select` y `sk-toast` en una ruta de prueba y confirmar que
     abren/cierran/actualizan sin `ApplicationRef.tick()` manual — Alma corre
     `provideZonelessChangeDetection()` (`app.config.ts`).
4. Añadir el segundo entry de estilos en `angular.json` (Tailwind 4 es CSS-first: el `@use` de la
   lib no puede vivir dentro de `styles.css`):
   ```jsonc
   "styles": [
     "node_modules/primeicons/primeicons.css",
     "src/sk-foundations.scss",
     "src/styles.css"
   ]
   ```
   Crear `src/sk-foundations.scss`:
   ```scss
   @use 'sk-components-angular/styles/sk-tokens';
   @use 'sk-components-angular/styles/sk-motion';
   @use 'sk-components-angular/styles/sk-typography';
   @use 'sk-components-angular/styles/sk-breakpoints' as bp;
   ```
5. **Retirar la reproducción manual** de los tokens estáticos que esta sesión escribió a mano en
   `src/styles.css` (bloque `:root` al inicio del archivo: `--sk-font-*`, `--sk-shadow-*`,
   `--sk-space-*`) — quedan duplicados una vez que `sk-tokens.scss` los provee de verdad. El
   `@font-face` de Montserrat/Open Sans si se queda (ver sección de tipografía abajo).
6. **Escribir el puente de color**, ahora que se puede leer `SkandiaLight`/`skandiaPalette.light`
   reales desde el paquete instalado (`node_modules/sk-components-angular/**/*.d.ts` o el
   `CHANGELOG.md` que viaja en el paquete desde 1.3.1). Esta sesión **no inventó valores hex**
   porque no podía verificarlos contra la fuente real — sería fijar un verde que quizá no es el de
   marca. En `:root`/`.dark` de `src/styles.css`, mapeo pendiente:
   ```css
   --primary: var(--sk-color-primary);
   --primary-hover: var(--sk-color-primary-hover);
   --foreground: var(--sk-color-text);
   --muted-foreground: var(--sk-color-text-muted);
   --card: var(--sk-color-surface);
   --background: var(--sk-color-bg);
   --border: var(--sk-color-border);
   --input: var(--sk-color-border-hover);
   --destructive: var(--sk-color-error);
   --success: var(--sk-color-success);
   --warning: var(--sk-color-warning);
   --info: var(--sk-color-info); /* reemplaza el --chart-2 provisional de esta sesión */
   --shadow-sm/md/lg: derivar de --sk-shadow-subtle/-surface/-raised/-overlay
   ```
   Los tokens translúcidos de Alma (`--secondary`, `--muted`, `--accent`, `--surface-sunken`,
   `--ring`) no tienen equivalente en `SkColorPalette` (paleta cerrada de hex planos) — derivarlos
   con `color-mix(in srgb, var(--sk-color-text) N%, transparent)`.
7. **Registrar el theme service** en `app.config.ts`:
   ```ts
   provideSkComponents({ theme: ALMA_LIGHT }),
   provideSkValidatorMessages(),
   ```
   Crear `src/app/core/theme/alma-theme.ts` con `ALMA_LIGHT`/`ALMA_DARK` como `SkTheme`, partiendo
   de `skandiaPalette.light` y sobrescribiendo con los valores reales de Alma. Conectar
   `PreferencesService` (`core/services/preferences.service.ts`) a `SkThemeService.setTheme()`
   para que el toggle de tema mueva `--sk-color-*` y la clase `.dark` **a la vez**.
8. **Entregar la paleta oscura de Alma al equipo del DS.** `SkandiaDark` es hoy un placeholder
   (`_placeholder: true`, emite `console.warn`); Alma ya tiene un dark mode terminado. Es el aporte
   más valioso que sale de esta adopción.
9. Ejecutar la Fase 2 del plan (componentes `sk-*` selectivos) — ver la sección de componentes del
   plan para qué se adopta y qué se conserva (tablas y `alma-checkbox` con `indeterminate` se
   quedan: limitaciones documentadas de la librería, no preferencia).

## Lo que sí quedó hecho en esta sesión (sin el paquete)

### Tipografía — Montserrat + Open Sans, self-hosted

- Los 6 archivos `.woff2` (400/500/700 de cada familia, subset latin) están en `public/fonts/`,
  descargados y verificados como binarios distintos (no la negociación rota de la API `css2` de
  Google Fonts, que devolvía el mismo archivo para los tres pesos con ciertos User-Agents — se usó
  el espejo de Fontsource, que sirve cada peso como archivo separado).
- `@font-face` declarado en `src/styles.css`, `<link rel="preload">` en `src/index.html`.
- `--sk-font-title/-body/-weight-*` reproducidos a mano con los valores documentados (静态, no
  cambian con el tema) — reemplazar por el `@use` real en el paso 5 de arriba.
- `body`/`h1-h6`/`label`/`small` ya usan estos tokens. **No se inventó una escala de tamaños
  h2-h5**: la documentación solo daba los extremos (h1 32/40, h6 14/22); se aplicó family+weight
  sin tocar los `text-*` de Tailwind que cada pantalla ya trae.
- Se retiraron `font-weight: 450` y `letter-spacing: -0.003em` de `body` (calibrados para el
  stack de sistema, no para Open Sans). Se conservaron `-webkit-font-smoothing: auto` y
  `text-rendering: optimizeLegibility` — existen por una razón documentada (ClearType en Windows)
  independiente de la tipografía elegida.
- Verificado: `ng build --configuration production` limpio, fuentes copiadas a `dist/browser/fonts/`
  y referenciadas en el CSS compilado. Screenshot en vivo confirma el cambio de tipografía.

### Foundations parciales

- `--sk-space-*` (11 vars) y el comentario de breakpoints (768/1024) están declarados en
  `src/styles.css`, sin consumir todavía — quedan disponibles para ir reemplazando los valores
  arbitrarios (`top-24`, `max-w-[1400px]`, etc.) de forma incremental.
- `--sk-shadow-*` (4 niveles) declarados, sin remplazar `--shadow-sm/md/lg` de Alma todavía (para
  no alterar el output visual actual antes de tener la fuente real).
- `--color-success/-warning/-info` mapeados en `@theme inline` — cierra el motivo original de la
  fuga de ~400 usos de `amber/emerald/sky` crudos (`--success`/`--warning` existían pero no estaban
  expuestos a Tailwind). `--info` es nuevo, reutiliza el azul de `--chart-2` como valor provisional
  hasta tener `--sk-color-info` real.
- `.glass`/`.glass-strong` duplicados: se eliminó la definición muerta dentro de `@layer components`
  (la de fuera de layer, más abajo en el archivo, siempre ganaba).

### Color — deliberadamente NO tocado

Los tokens `oklch` de `:root`/`.dark` (verde Skandia, fondos, etc.) siguen siendo los de Alma.
Escribir el puente de color sin el paquete real habría significado inventar hex de marca — el
ejemplo de paleta que aparece en la documentación de theming es un tenant ficticio de demo, no
`SkandiaLight` real. Ver paso 6 arriba.

## Fase 6 — `fetch` → `HttpClient` (completa, no bloqueada)

A diferencia de la Fase 0/2, esto no dependía del feed privado y se ejecutó completo:

- El árbol de transporte real es más chico de lo que sugería el inventario inicial: casi todo el
  app pasa por **`ApiService.fetch()`** (`core/services/api.service.ts`); el módulo de Comisiones
  tiene su propia capa, **`ComisionesHttp`** (`features/comisiones/comisiones-http.service.ts`),
  con retry y manejo de conflicto 409. Ambas se migraron a `HttpClient`, preservando su firma
  pública exacta — ninguno de sus ~15 llamadores cambió.
- `core/http/auth.interceptor.ts` — adjunta el Bearer token vía `AuthService.getAccessToken()`,
  solo a peticiones hacia `environment.apiUrl` (las llamadas a Microsoft Graph en
  `auth.service.ts` y `accesos.api.ts` quedan fuera: token y dominio distintos).
- `core/http/retry.interceptor.ts` — retry con backoff exponencial (3 intentos, 2^i·1000ms) ante
  5xx/error de red, opt-in vía `HttpContextToken` (`WITH_RETRY`). Solo `ComisionesHttp` lo activa,
  preservando el comportamiento exacto de antes (`ApiService` nunca reintentaba).
- **Excepción documentada, sin migrar:** `features/agente-alma/agente-alma.api.ts` sigue en
  `fetch` nativo para el streaming SSE del chat — `HttpClient` no maneja bien
  server-sent events sobre POST.
- Verificado en vivo con `ng serve` + Playwright: el módulo de Comisiones reintenta visiblemente
  contra un backend caído (backoff observable en el log de consola) y falla después de 3 intentos
  con el mismo mensaje de error de antes; el resto de la app (`ApiService`) falla al primer
  intento, sin retry — confirma que el `HttpContextToken` está scopeado correctamente.
- Pendiente, fuera de esta sesión: TanStack Query para los 8 stores (frente propio, ver plan).

## Accesibilidad — hecho sin el paquete

- **El hallazgo más grave del plan:** las filas de tabla clicables pero inalcanzables por teclado.
  Corregido en los 3 sitios nombrados —
  `suscripcion-grid-table.component.ts`, `commission-rules-table.component.ts`,
  `catalogs.page.ts` — con `role="button"`, `tabindex="0"`, `aria-label` descriptivo y
  `(keydown.enter)`/`(keydown.space)`, más anillo de foco visible.
- `motor-manual-guia.component.ts`: `aria-expanded` + `aria-controls` en el disclosure.
- `toasts.component.ts`: `role="alert"` en toasts destructivos (antes todos usaban `role="status"`,
  que puede no anunciarse a tiempo para un error).
- **No hecho — bloqueado por el paquete:** trampa de foco, `role="dialog"` y cierre con Escape en
  los ~20 modales propios. Es exactamente lo que `sk-modal` resuelve de fábrica (Fase 2). Construir
  un focus-trap propio ahora sería duplicar trabajo que se descarta en cuanto el paquete esté
  disponible — se dejó documentado en el plan, no implementado a medias.
- Los `div (click)` de los filtros (`discrete-filter`, `date-filter`, `roles-picker`) no se
  tocaron: envuelven un `alma-checkbox`/control que ya es un `<button>` nativamente enfocable, así
  que el hallazgo original es de paridad del área de clic, no un bloqueo real de teclado —
  prioridad menor que las filas de tabla.

## Contenido — hecho

- Tuteo unificado en `features/comisiones/api-error.ts` (los 5 mensajes que usaban "usted").
- Mensajes de error reescritos con verbos que invitan, no que ordenan ("Intenta de nuevo" en vez de
  "Por favor intente nuevamente").
- `"Bienvenido a Alma"` → `"Te damos la bienvenida a Alma"` (inclusivo).
- Emoji como iconografía retirados de los 4 modales de `ejecucion-motor.page.ts`
  (`⚙️→settings`, `⚠️→alert-triangle`, `✉️→mail`, `🚫→x-circle`), de
  `motor-manual-guia.component.ts` (`📋→clipboard-list`) y del toast de
  `ejecucion-motor.store.ts` (`📧` retirado del título).
- **No hecho:** los 18 estados vacíos (requieren revisar cada uno para distinguir "no hay nada
  todavía" de "tu filtro no encontró nada"), el glosario de jerga operativa, el archivo `TEXTOS`
  por feature, y el `⚠️` textual en las burbujas de error del chat de Agente Alma (caso menor,
  requiere rediseñar el layout del mensaje para un ícono real).

## Home — no rediseñado en esta sesión

El plan pide rediseñar el inicio (veredicto REDESIGN de la auditoría Rams) conservando la esfera
tal cual, sin reducirla. No se tocó `ui/home/home.component.ts` en esta pasada — queda como
trabajo siguiente, independiente del bloqueo de paquete.

## Verificación de esta sesión

- `npx tsc --noEmit -p tsconfig.app.json` limpio en cada punto de control.
- `npx ng build --configuration production` limpio; bundle inicial 729 kB raw / 176 kB transfer
  (budget: warning 2mb / error 4mb).
- `ng serve` + Playwright: home, cheques, ejecución del motor y catálogos cargan sin errores de
  consola atribuibles al código (los `ERR_CONNECTION_REFUSED` a `localhost:8000` son esperados —
  no hay backend local corriendo). Tipografía Montserrat/Open Sans confirmada visualmente. Retry
  scopeado correctamente confirmado por el patrón de reintentos en consola.
