# Adopción de `@skandia/ui` en Alma

Log resumible de la migración de Alma del design system bloqueado `sk-components-angular`
(feed privado nunca configurado, ver el historial de `docs/design-system-adoption.md`, ahora
superseded) hacia `@skandia/ui` (repo `SkCo.Fidu.DesignSystem.Lib.UX`), consumido localmente vía
tarball vendorizado mientras ese mismo feed no esté disponible.

## Estado por fase

### Fase 0 — Librería construida ✅

`npm run build:lib` en `SkCo.Fidu.DesignSystem.Lib.UX` nunca se había corrido; funcionó al primer
intento. Los dos scripts finales del pipeline (`generate-catalog-json.mjs`,
`copy-claude-tools.mjs`) no existen en `scripts/` — no bloquean nada, la librería real (ng-packagr)
ya quedó construida en `dist/skandia-ui` antes de llegar a ese punto. `package.json` empacado
declara `sideEffects: false` (tree-shaking real).

Cambio hecho en el repo DS: `scripts/generate-public-api.mjs` no exportaba `SKANDIA_DESIGN_TOKENS_CSS`
en el barrel público (`src/public-api.ts`) — se agregó una línea (`export { SKANDIA_DESIGN_TOKENS_CSS }
from './app/providers/design-tokens';`) porque la Fase 2 de Alma la necesita para forkear el
provider sin los `<link>` remotos.

### Fase 1 — Consumo local ✅

- `vendor/skandia-ui/skandia-ui-0.1.10.tgz` + `vendor/skandia-ui/README.md` (procedencia, cómo
  regenerar el tarball, cuándo migrar al feed real).
- `package.json`: `sk-components-angular` y sus peers reemplazados por `"@skandia/ui":
  "file:vendor/skandia-ui/skandia-ui-0.1.10.tgz"` + `primeng`/`@primeuix/themes`/`primeicons`
  directos.
- Bug preexistente corregido de paso: `"@angular/cdk": ">=21"` resolvía a v22 (incompatible con
  Angular 21.x de Alma) y bloqueaba `npm install` por completo, incluso antes de tocar
  `@skandia/ui`. Fijado a `^21.2.6`.
- `npm ls` confirma cero conflictos de peers.

### Fase 2 — Providers ✅

`provideAlmaSkandiaUI()` (`src/app/shared/providers/alma-skandia-ui.provider.ts`) — fork de
`provideSkandiaUI()` que reutiliza `providePrimeNG`+`SkandiaPreset` y la inyección de
`SKANDIA_DESIGN_TOKENS_CSS`, pero **omite** los dos `<link>` remotos a
`skcoblobresources.blob.core.windows.net` (`sk-desing-main.css`, `sk-icon-all.min.css`) — CSS
legacy sin versión fija ni SRI; Alma ya auto-hospeda su propia tipografía. Registrado en
`app.config.ts`. `primeicons.css` agregado al array `styles` de `angular.json`.

Verificado en vivo (Playwright, `ng serve`): cero peticiones a `skcoblobresources`, cero errores de
consola, un solo `<style id="skandia-design-tokens">` en `<head>`.

### Fase 3 — Puente de tokens y diferenciación Fiduciaria ✅ (con desviaciones documentadas)

- Tipografía migrada de los `--sk-font-*` hand-rolled a los tokens reales inyectados (`--title`,
  `--body`, `--weight-regular/medium/bold`) en `body`/`h1-h6`/`label`/`small` (`src/styles.css`).
- Bloque `:root` hand-rolled (`--sk-font-*`, `--sk-shadow-*`, `--sk-space-*`) eliminado —
  `--sk-shadow-*`/`--sk-space-*` no tenían ningún consumidor.
- **Colisión de nombres conocida, sin resolver activamente**: tanto los tokens de Alma como los de
  `@skandia/ui` definen `--shadow-sm` y `--shadow-md` (valores distintos). Por orden de carga
  (`SKANDIA_DESIGN_TOKENS_CSS` se `prepend`-ea al `<head>`, `styles.css` se linkea después), el
  valor de Alma gana en el cascade — si algún `sk-*` interno depende de su propio `--shadow-sm`
  esperando el valor de Skandia, se verá con la sombra de Alma en su lugar. No se ha visto ningún
  efecto visual adverso en los pilotos probados; revisar si aparece algo raro en sombras de
  overlays/diálogos `sk-*` durante la Fase 4.
- **Punto 1 (botones)**: `product="fiduciaria"` en cada `<sk-button>` migrado — ver Fase 4a.
- **Punto 2 (hover de íconos)**: regla agregada en `styles.css` — `a:hover lucide-icon, button:hover
  lucide-icon, [role="button"]:hover lucide-icon { color: var(--icon-fiduciaria); }`. Deliberadamente
  NO se fuerza el color default de ningún ícono (Alma ya tiene su propio lenguaje de color
  establecido fuera de este patrón — estados, sphere/dock, gráficos); solo se agrega el cambio en
  hover que pide la guía.
- **Punto 3 (fondo de pantalla) — DESVIACIÓN DELIBERADA, decidida con el usuario**: la guía pide
  `var(--background-fiduciaria)` (#f7f7f7 plano) como fondo base de las vistas. Alma pinta un
  wallpaper degradado animado en `body` (5 variantes: oceano/aurora/atardecer/grafito/cielo, con
  soporte `.dark`) — un activo de marca ya establecido y deliberadamente diseñado (ver commits
  previos: "estrenar el fondo solarpunk", "capa de vida alrededor del avatar"). Se decidió
  **conservar el wallpaper sin tocarlo**. `--background-fiduciaria` queda disponible para
  superficies planas nuevas que se agreguen más adelante (p. ej. contenido de diálogos/tarjetas
  `sk-*` que no lleven el wallpaper), no para el fondo raíz.
- **Punto 4 (tipografía — H1 y ALL CAPS) — pendiente de revisión de diseño, NO aplicado aún**: ver
  checklist abajo. Cambiar esto a ciegas en 21+20 archivos habría sido un cambio visual amplio sin
  revisión; se deja como checklist accionable en vez de un barrido mecánico.

#### Checklist pendiente — `<h1>` (21 archivos)

La guía pide que en experiencias Fiduciaria no exista `<h1>`: el rol "título principal de vista"
pasa a un elemento `<h2>` con el tamaño visual propio de H2 (24px), no el de H1 (32px) — es un
cambio de elemento Y de tamaño, no solo un rename. Requiere revisión visual por pantalla porque casi
ninguno de estos usa las clases de tipo-escala del DS (`text-h1-*`); usan utilidades Tailwind
arbitrarias (`text-3xl`, `text-lg`, etc.) que hay que bajar de forma consistente.

Archivos con `<h1>` (grep `src/app/**/*.ts`, buscar `<h1`): `agente-alma/chat-agente.component.ts`,
`cheques/bandeja-cheques.component.ts`, `comisiones/catalogos/catalogs.page.ts`,
`comisiones/comisiones-landing.component.ts`, `comisiones/ejecucion/ejecucion-motor.page.ts`,
`comisiones/info-gerencial/info-gerencial.page.ts`, `comisiones/parametrizacion/parametrizacion.page.ts`,
`comisiones/planes/compensation-plans.page.ts`, `metricas/metricas-uso.component.ts`,
`suscripcion/detalle-solicitud.component.ts`, `suscripcion/motor-config/motor-config-page.component.ts`,
`suscripcion/simulador-config/simulador-config-page.component.ts`,
`suscripcion/suscripcion-landing.component.ts`, `shared/components/access-denied.component.ts`,
`shared/components/inactive-screen.component.ts`, `shared/components/login-screen.component.ts`,
`shared/components/page-header.component.ts` (¡componente compartido — un solo cambio aquí
propaga a todos sus consumidores!), `ui/app-host/app-host.component.ts` (2 ocurrencias),
`ui/app-host/microfrontend-host.component.ts`, `ui/home/home.component.ts`,
`ui/not-found/not-found.component.ts`.

**Recomendación de secuencia**: empezar por `shared/components/page-header.component.ts` (un
cambio, muchos consumidores gratis), luego auditar visualmente cada página restante una por una.

#### Checklist pendiente — texto en `uppercase` (~38 ocurrencias, ~20 archivos)

Patrón establecido y extendido: encabezados de tabla (`<th>`/celdas con `uppercase tracking-wider`)
y labels "eyebrow" pequeños sobre secciones/campos. La guía prohíbe mayúsculas completas sin
excepción para encabezados de tabla. Cambiar esto reformatea visualmente casi todas las tablas de
datos de comisiones y suscripción — requiere decisión de diseño (¿case normal con el mismo peso/
tracking, o un tratamiento visual distinto para diferenciar encabezados de tabla?), no un
find-replace de la clase `uppercase`.

Archivos: `comisiones/catalogos/fields-manager-dialog.component.ts`,
`comisiones/ejecucion/ejecucion-motor.page.ts`, `comisiones/ejecucion/motor-ejecucion-tab.component.ts`,
`comisiones/parametrizacion/param-table.component.ts`, `comisiones/planes/commission-rules-table.component.ts`,
`comisiones/planes/compensation-plans.page.ts`, `comisiones/planes/plans-table.component.ts`,
`comisiones/planes/rule-dialog.component.ts`, `comisiones/ui/date-column-filter.component.ts`,
`comisiones/ui/sortable-table-head.component.ts`, `suscripcion/declaraciones-dialog.component.ts`,
`suscripcion/detalle-solicitud.component.ts`, `suscripcion/evaluar-modal.component.ts` (9
ocurrencias — el más denso), `suscripcion/grid/column-selector.component.ts`,
`suscripcion/grid/suscripcion-grid-table.component.ts`, `suscripcion/motor-config/historial-cambios.component.ts`.

### Fase 4 — Migración de componentes (en curso)

**4a. Botones** — en curso, migrado vía sweep en 6 lotes paralelos tras verificar 2 pilotos
(`catalog-dialogs.component.ts`, `bandeja-cheques.component.ts`) visualmente con Playwright: ambos
renderizan correctamente con `product="fiduciaria"` (verde-teal de marca, distinto del verde
Skandia genérico), estados disabled/loading funcionan. Ver sección de progreso más abajo para el
resultado del sweep completo.

**4b. Badges** ✅ completo y verificado visualmente. `sk-tag` (no `sk-badge`, cuya `variant` está
limitada a success/warning/info/error sin opción neutra) reemplazó `.alma-badge` en 6 archivos.
Nuevo `src/app/shared/status-severity.ts` (`activoSeverity()`) consolida el patrón activo/inactivo
duplicado en `auditoria-accesos`/`usuarios-accesos`; `cheques.api.ts` ganó `ESTADO_SEVERITY`
(reemplazó `ESTADO_COLOR`, sin otros consumidores). **1 caso deliberadamente sin migrar**:
`usuarios-accesos.component.ts:108` — el badge de rol tiene un botón de revocar ANIDADO dentro
(`(click)="revocar(...)"`); ni `sk-tag` ni `sk-badge` proyectan contenido arbitrario (solo
`[value]`/`[label]`), así que forzarlo habría roto la interacción de revocar. `.alma-badge` CSS
sigue en `styles.css` solo por este caso — no borrar hasta resolverlo.

**4d. Inputs — hallazgo que cambia el plan original**: tanto `sk-input` como `sk-dropdown` (el
equivalente a `<select>` — no existe "sk-select") son `ControlValueAccessor` reales
(`NG_VALUE_ACCESSOR` vía `forwardRef`), verificado en el código fuente de ambos. Un CVA de Angular
funciona igual de bien con `FormsModule` (`[(ngModel)]`) que con `ReactiveFormsModule`
(`formControlName`) — **no hay que migrar a Reactive Forms primero para poder usar `sk-input`**.
La migración de la Fase 5 (Reactive Forms) sigue siendo valiosa para los formularios que hoy tienen
validación manual ad-hoc y se beneficiarían de `Validators`, pero deja de ser un requisito previo
para el swap de campos simples (buscadores, filtros, un solo campo) — esos pueden migrar ya, sin
tocar su arquitectura de formulario. Diferencia real de esfuerzo: `sk-input` es swap directo de
clase; `sk-dropdown` requiere construir un array `options: {label, value}[]` por cada `<select>`
(no acepta `<option>` nativo), y hay que verificar tipos de `value` no-string (p. ej.
`usuarios-accesos.component.ts` usa `[ngValue]="true"`/`false` boolean en un `<select>`).

**Fase 5 (Reactive Forms real)** — pendiente, ahora acotada solo a formularios con lógica de
validación que realmente se beneficia de `Validators`/`FormGroup`, no a todo campo con `ngModel`.

**✅ 4d completo** — ~145 campos migrados en 29 archivos (6 lotes paralelos), manteniendo
`[(ngModel)]` sin tocar la arquitectura de formularios. Decisión de floating label aplicada
consistentemente (texto de cada `<label>` externo movido a `[label]`, externos eliminados —
confirmado en vivo con Playwright que la asociación de accesibilidad queda bien conectada
internamente, el árbol de accesibilidad expone "Contrato *" etc. como nombre accesible del
campo). Verificado visualmente: formulario de cheques (10 sk-input + 3 sk-dropdown), dropdown
abre con overlay temado, tipeo y validación reactiva en vivo funcionan.

**Campos dejados intencionalmente sin migrar (2 casos, con razón documentada por los agentes)**:
- `rule-dialog.component.ts:152` — textarea de fórmula: el componente usa `@ViewChild` +
  `selectionStart`/`selectionEnd`/`setSelectionRange()` para insertar operadores/funciones en la
  posición del cursor; `sk-textarea` no expone el `<textarea>` nativo interno para `ViewChild`,
  así que migrarlo habría roto la inserción silenciosamente (ni `tsc` ni `ng build` lo detectan,
  es un problema de comportamiento en runtime).

**Regresiones menores conocidas (aceptadas, no bloquean)**:
- `sk-input` no tiene inputs `min`/`max`/`step` — se perdieron las restricciones nativas de rango
  en 3-4 campos de fecha/número (p. ej. fecha fin ya no bloquea elegir una fecha antes de fecha
  inicio en el date-picker nativo del browser). La validación de negocio real (si existe) vive en
  el `.ts`, esto es solo la pista visual del input nativo.
- **Bug real encontrado en `@skandia/ui` v0.1.10**: el `placeholder` de `sk-dropdown` no está
  conectado al `p-select` interno (verificado en el `.mjs` compilado) — no hace nada. Workaround
  usado: `[label]` en su lugar. Vale la pena reportarlo al equipo del DS.
- `sk-dropdown`'s `options` está tipado estrictamente `{label: string; value: string}[]` pese a
  que el CVA en runtime acepta cualquier tipo de `value` — los casos con `value` booleano/numérico
  se resolvieron con `$any(...)` en el template o convirtiendo a string ida y vuelta. No es un bug,
  pero vale la pena que el DS relaje el tipo a `{label: string; value: unknown}[]` para evitar el
  cast en cada consumidor.
- Los tooltips por-opción que algunos `<option title="...">` tenían se perdieron — la forma
  `{label, value}[]` de `sk-dropdown` no tiene slot para eso.

**4c. Tabs — hallazgo importante, cambia el plan original**: `SkTabsComponent` (`sk-tabs`) del
repo DS es un wrapper de demo/showcase, NO apto para el uso real de Alma —
recibe `tabs: {value, label, content: string}[]` y renderiza `content` como texto plano en un
`<p>` fijo; **no tiene `<ng-content>` ni ninguna forma de proyectar una plantilla Angular arbitraria
por panel** (tablas, formularios, gráficos — que es exactamente lo que cada tab de Alma contiene
hoy). Forzar `sk-tabs` ahí sería imposible sin texto plano, o requeriría modificar el componente en
el repo DS.

**Decisión: usar los componentes PrimeNG crudos (`p-tabs`/`p-tablist`/`p-tab`/`p-tabpanels`/
`p-tabpanel` de `primeng/tabs`) directamente en vez de `sk-tabs`.** Siguen temados por
`SkandiaPreset` (theme global vía `provideAlmaSkandiaUI()`, no por componente), y `p-tab` sí tiene
`<ng-content>` real, `role="tab"` nativo, navegación de teclado incorporada (`onKeyDown` propio,
sin necesitar `tablist-keyboard.ts`) e input `disabled`. Confirmado en
`node_modules/primeng/fesm2022/primeng-tabs.mjs`. Esto sigue cumpliendo el objetivo de la Fase 4c
(reemplazar los 7 tab-bars a mano + `tablist-keyboard.ts` por un componente real y accesible) sin
pasar por la limitación de `sk-tabs`.

**✅ Completo** — los 7 tab-bars migrados (`admin.component.ts` piloto + 6 en sweep paralelo:
`ejecucion-motor.page.ts`, `info-gerencial.page.ts`, `plan-editor-dialog.component.ts`,
`rule-dialog.component.ts`, `date-filter.component.ts`, `discrete-filter.component.ts`).
`src/app/shared/tablist-keyboard.ts` — sin consumidores, borrado.

**Lección de verificación**: `tsc --noEmit` NO valida el balance de tags HTML dentro de templates
Angular (eso lo hace el compilador AOT real). Uno de los 6 migrados en paralelo
(`discrete-filter.component.ts`) quedó con un `</div>` sobrante (residuo del wrapper
`role="tabpanel"` original que `<p-tabpanel>` ya reemplaza) — `tsc` no lo detectó, pero
`ng build` sí (`NG5002: Unexpected closing tag`). Corregido. **De aquí en adelante, `ng build`
(no solo `tsc`) es obligatorio antes de dar por cerrada cualquier migración de templates.**

## Procedimiento para actualizar `vendor/skandia-ui`

Ver `vendor/skandia-ui/README.md`.
