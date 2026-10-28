// Importar la hoja del equipo (prototipo importView + aplicarImport): encabezados
// fijos en la fila 1 — correo · carpeta · una columna por grupo (X) · estado ·
// respaldo —, vista previa con la validación de cada fila e importación de las
// válidas (agrega y actualiza; los demás se conservan). La hoja se lee con
// /bases/leer; el nombre sale de una columna «nombre» si la hoja la trae, del
// equipo o del directorio. Lo usan el modal de Equipo y el paso 3 del asistente.

import { Component, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { AccesosApi } from '../../core/services/accesos.api';
import { ToastService } from '../../core/services/toast.service';
import { BuzonApi, Grupo, LecturaArchivo, Persona, PersonaIn } from './buzon.api';
import { aPersonaIn } from './buzon-asignacion';
import { RE_CORREO, nombresDirectorio } from './asignacion-ui';
import { CarpetaPlana } from './carpeta-select.component';

type Validacion = ['ok' | 'warn' | 'bad', string];

interface FilaImport {
  correo: string;
  carpeta: string;
  /** Ids de los grupos marcados con X. */
  grupos: string[];
  estado: string;
  respaldo: string;
  celdas: string[];
  v: Validacion;
}

const norm = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

@Component({
  selector: 'alma-import-equipo',
  imports: [LucideAngularModule],
  styleUrls: ['./buzon-proto.css'],
  styles: [`:host { display: contents; }`],
  template: `
    <p class="sm">La hoja debe tener estos encabezados en la fila 1: una fila por persona y una columna por grupo (marca con <b>X</b> los grupos que atiende).</p>
    <div class="sheet-wrap">
      <table class="sheet">
        <tr><th class="rh"></th>@for (h of hdr(); track $index; let i = $index) { <th>{{ letra(i) }}</th> }</tr>
        <tr class="h"><td class="rh">1</td>@for (h of hdr(); track $index) { <td><b>{{ h }}</b></td> }</tr>
        <tr><td class="rh">2</td>@for (v of ejemplo(); track $index) { <td class="k">{{ v }}</td> }</tr>
      </table>
    </div>
    <ul class="rev xs">
      <li><span><b>correo</b>: obligatorio. Es lo que Alma usa para reconocer a la persona en las bases (también su nombre).</span></li>
      <li><span><b>carpeta</b>: carpeta del buzón donde caen sus correos; debe existir en el buzón. Vacío = sin carpeta (queda en la carpeta vigilada).</span></li>
      <li><span><b>estado</b>: activo o inactivo · <b>respaldo</b>: correo de quien lo cubre.</span></li>
    </ul>
    <div class="row">
      <button type="button" class="btn outline sm" (click)="copiar()"><lucide-icon name="copy" [size]="13" /> Copiar encabezados</button>
      <label class="btn outline sm" [attr.for]="idp() + '-file'"><lucide-icon name="upload" [size]="13" /> Subir hoja (.xlsx o .csv)</label>
      <input type="file" [id]="idp() + '-file'" accept=".xlsx,.xlsm,.csv" hidden (change)="subir($event)" />
    </div>
    @if (leyendo()) { <p class="xs muted">Leyendo la hoja…</p> }
    @if (error(); as e) { <p class="note b-rose"><lucide-icon name="x-circle" [size]="13" /> <span>{{ e }}</span></p> }
    @if (lectura()) {
      <p class="xs b">Vista previa · {{ archivo() }}</p>
      <div class="scroll-x">
        <table class="t">
          <thead><tr><th class="num">#</th>@for (h of hdr(); track $index) { <th>{{ h }}</th> }<th>Validación</th></tr></thead>
          <tbody>
            @for (r of filas(); track $index; let i = $index) {
              <tr>
                <td class="num xs muted">{{ i + 1 }}</td>
                @for (c of r.celdas; track $index) { <td class="xs">{{ c }}</td> }
                <td><span class="badge" [class]="'badge ' + (r.v[0] === 'ok' ? 'b-emerald' : r.v[0] === 'warn' ? 'b-amber' : 'b-rose')">{{ r.v[1] }}</span></td>
              </tr>
            } @empty {
              <tr><td [attr.colspan]="hdr().length + 2" class="xs muted">La hoja no trae filas.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button type="button" class="btn primary sm" [disabled]="guardando() || !validas().length" (click)="importar()"><lucide-icon [name]="guardando() ? 'loader-2' : 'check'" [size]="13" [class.animate-spin]="guardando()" /> Importar {{ validas().length }} persona(s) válidas</button>
      </div>
    }
  `,
})
export class ImportEquipoComponent {
  private readonly api = inject(BuzonApi);
  private readonly accesos = inject(AccesosApi);
  private readonly toast = inject(ToastService);

  readonly buzonId = input.required<string>();
  /** Grupos que asignan a personas (ya guardados). */
  readonly grupos = input<Grupo[]>([]);
  readonly equipo = input<Persona[]>([]);
  readonly carpetas = input<CarpetaPlana[]>([]);
  readonly idp = input('imp');
  readonly importado = output<Persona[]>();

  protected readonly lectura = signal<LecturaArchivo | null>(null);
  protected readonly archivo = signal('');
  protected readonly leyendo = signal(false);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Nombres de los correos de la hoja (columna «nombre», equipo o directorio). */
  private readonly nombres = signal<Record<string, string>>({});

  protected readonly hdr = computed(() => ['correo', 'carpeta', ...this.grupos().map((g) => g.nombre), 'estado', 'respaldo']);
  protected readonly ejemplo = computed(() => [
    'persona@skandia.com.co',
    '(opcional)',
    ...this.grupos().map((_, i) => (i === 0 ? 'X' : '')),
    'activo',
    'respaldo@skandia.com.co',
  ]);

  protected letra(i: number): string {
    return String.fromCharCode(65 + (i % 26));
  }

  /** Columna de la hoja para un encabezado esperado (sin mayúsculas ni tildes). */
  private col(l: LecturaArchivo, h: string): string | undefined {
    return l.columnas.find((c) => norm(c) === norm(h));
  }

  protected readonly filas = computed<FilaImport[]>(() => {
    const l = this.lectura();
    if (!l) return [];
    const cCorreo = this.col(l, 'correo');
    if (!cCorreo) return [];
    const cCarpeta = this.col(l, 'carpeta');
    const cEstado = this.col(l, 'estado');
    const cResp = this.col(l, 'respaldo');
    const cGrupos = this.grupos().map((g) => [g.id, this.col(l, g.nombre)] as const);
    const existentes = new Set(this.equipo().map((p) => p.correo.toLowerCase()));
    const folders = this.carpetas();
    const vistos = new Set<string>();
    return (l.filas ?? l.muestra).map((f) => {
      const val = (c?: string) => (c ? String(f[c] ?? '').trim() : '');
      const correo = val(cCorreo).toLowerCase();
      const carpeta = val(cCarpeta);
      const grupos = cGrupos.filter(([, c]) => {
        const v = norm(val(c));
        return v && !['no', '0', 'n', 'false'].includes(v);
      }).map(([id]) => id);
      const fila: Omit<FilaImport, 'v'> = {
        correo,
        carpeta,
        grupos,
        estado: val(cEstado),
        respaldo: val(cResp).toLowerCase(),
        celdas: [val(cCorreo), carpeta, ...cGrupos.map(([, c]) => val(c)), val(cEstado), val(cResp)],
      };
      let v: Validacion;
      if (!RE_CORREO.test(correo)) v = ['bad', 'No es un correo'];
      else if (vistos.has(correo)) v = ['bad', 'Correo repetido en la hoja'];
      else if (carpeta && folders.length && !folders.some((x) => x.nombre === carpeta)) v = ['warn', `La carpeta «${carpeta}» no existe en el buzón: queda sin carpeta`];
      else if (!grupos.length) v = ['warn', 'Sin grupos: se agrega, pero no recibirá correos'];
      else if (existentes.has(correo)) v = ['warn', 'Ya está en el equipo: se actualiza'];
      else v = ['ok', this.nombres()[correo] ?? correo];
      if (RE_CORREO.test(correo)) vistos.add(correo);
      return { ...fila, v };
    });
  });
  protected readonly validas = computed(() => this.filas().filter((f) => f.v[0] !== 'bad'));

  protected async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.hdr().join('\t'));
      this.toast.show('Encabezados copiados: pégalos en la fila 1 de tu hoja');
    } catch {
      this.toast.show('Selecciona el texto y cópialo con Ctrl+C');
    }
  }

  protected async subir(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    const f = el.files?.[0];
    el.value = '';
    if (!f) return;
    this.leyendo.set(true);
    this.error.set(null);
    try {
      const l = await this.api.leerArchivo(f);
      const cCorreo = this.col(l, 'correo');
      if (!cCorreo) throw new Error('La hoja no tiene la columna «correo» en la fila de encabezados.');
      const cNombre = this.col(l, 'nombre');
      const nombres: Record<string, string> = {};
      const faltan: string[] = [];
      (l.filas ?? l.muestra).forEach((fila) => {
        const c = String(fila[cCorreo] ?? '').trim().toLowerCase();
        if (!RE_CORREO.test(c)) return;
        const n = (cNombre ? String(fila[cNombre] ?? '').trim() : '') || this.equipo().find((p) => p.correo.toLowerCase() === c)?.nombre;
        if (n) nombres[c] = n;
        else faltan.push(c);
      });
      Object.assign(nombres, await nombresDirectorio(this.accesos, [...new Set(faltan)]));
      this.nombres.set(nombres);
      this.archivo.set(f.name);
      this.lectura.set(l);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.leyendo.set(false);
    }
  }

  protected async importar(): Promise<void> {
    const equipo = this.equipo();
    const folders = this.carpetas();
    const personas: PersonaIn[] = equipo.map((p) => aPersonaIn(p, equipo));
    const filas = this.validas();
    filas.forEach((f) => {
      const activa = norm(f.estado) !== 'inactivo';
      const carpeta = f.carpeta && (!folders.length || folders.some((x) => x.nombre === f.carpeta)) ? f.carpeta : null;
      const grupos = Object.fromEntries(f.grupos.map((gid) => [gid, { activa, respaldo: f.respaldo || null }]));
      const ex = personas.find((p) => p.correo.toLowerCase() === f.correo);
      if (ex) {
        ex.carpeta = carpeta;
        ex.grupos = { ...ex.grupos, ...grupos };
      } else {
        personas.push({ nombre: this.nombres()[f.correo] ?? f.correo, correo: f.correo, carpeta, disponible: true, grupos });
      }
    });
    // Un respaldo que no está en el equipo no se puede guardar: se deja sin respaldo.
    const correos = new Set(personas.map((p) => p.correo.toLowerCase()));
    personas.forEach((p) => Object.values(p.grupos).forEach((m) => m.respaldo && !correos.has(m.respaldo.toLowerCase()) && (m.respaldo = null)));
    this.guardando.set(true);
    try {
      const nuevo = await this.api.guardarEquipo(this.buzonId(), personas);
      this.toast.show(`${filas.length} persona(s) importadas`);
      this.lectura.set(null);
      this.importado.emit(nuevo);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
