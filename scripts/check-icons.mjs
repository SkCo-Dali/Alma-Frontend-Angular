// Verifica que todo ícono usado en las plantillas esté registrado en ALMA_ICONS.
//
// Por qué existe: lucide-angular LANZA desde ngOnChanges cuando el nombre no
// está en el set de LucideAngularModule.pick(). En una app zoneless eso aborta
// el ciclo de detección de esa vista, así que un solo nombre mal escrito deja
// la pantalla en blanco — no es un ícono que falta, es el render que se cae.
// Los nombres son strings, así que el compilador no los revisa: este script sí.
//
// Uso: npm run check:icons

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'src';
const ICONS_TS = join(RAIZ, 'app', 'shared', 'icons.ts');

// PascalCase de lucide -> nombre kebab de la plantilla.
// Ojo con los dígitos, que van separados por AMBOS lados:
//   CheckCircle2 -> check-circle-2 · Columns3Cog -> columns-3-cog
const kebab = (n) =>
  n
    .replace(/(?<=[a-zA-Z])(?=[A-Z])/g, '-')
    .replace(/(?<=[A-Za-z])(?=[0-9])/g, '-')
    .replace(/(?<=[0-9])(?=[A-Z])/g, '-')
    .toLowerCase();

const fuente = readFileSync(ICONS_TS, 'utf8');
const bloque = fuente.slice(fuente.indexOf('export const ALMA_ICONS = {'));
const registrados = new Set(
  [...bloque.matchAll(/^\s*([A-Z][A-Za-z0-9]*),/gm)].map((m) => kebab(m[1])),
);

function* archivos(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else if (p.endsWith('.ts')) yield p;
  }
}

const faltantes = new Map();
const anota = (nombre, archivo) => {
  if (registrados.has(nombre)) return;
  if (!faltantes.has(nombre)) faltantes.set(nombre, new Set());
  faltantes.get(nombre).add(archivo.replace(/\\/g, '/'));
};

for (const archivo of archivos(RAIZ)) {
  const txt = readFileSync(archivo, 'utf8');
  // 1) <lucide-icon name="x" ...>  — sólo dentro de la etiqueta, para no
  //    confundirse con el atributo name= de un <input>.
  for (const tag of txt.matchAll(/<lucide-icon\b[^>]*>/g)) {
    const m = /\bname="([a-z0-9-]+)"/.exec(tag[0]);
    if (m) anota(m[1], archivo);
  }
  // 2) icon: 'x'  — configuraciones que luego alimentan [name]="…".
  for (const m of txt.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)) anota(m[1], archivo);
}

console.log(`Íconos registrados en ALMA_ICONS: ${registrados.size}`);
if (faltantes.size === 0) {
  console.log('OK: todos los íconos usados están registrados.');
  process.exit(0);
}
console.error('\nÍconos NO registrados (romperían el render de su pantalla):');
for (const [nombre, archs] of [...faltantes].sort()) {
  console.error(`  ✗ ${nombre.padEnd(24)} ${[...archs].sort().join(', ')}`);
}
console.error('\nAgrégalos a ALMA_ICONS en src/app/shared/icons.ts, o usa uno ya registrado.');
process.exit(1);
