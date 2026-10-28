// Estado de la exportación de un buzón, compartido por la pestaña «Exportación»
// y el paso 5 del asistente «Nuevo buzón» (en el prototipo, EXPP / m.expCfg).
// El prototipo no tiene botones de guardar: aquí cada cambio se guarda solo,
// unos instantes después, cuando el proceso queda en un estado que la API acepta
// (una salida sin etiquetas o una plantilla sin columnas espera a completarse).
//   1. Plantillas: cada salida «Plantilla específica» tiene la suya; se crea al
//      tener nombre y al menos una columna, y se actualiza con cada cambio.
//   2. Salidas del proceso: se reemplazan en orden (PUT /procesos/{id}/salidas).

import { signal } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';
import { Base, BuzonApi, ProcesoExportacion, SalidaIn } from './buzon.api';
import { CampoExp, SalidaUI, TplForm, camposExp, cuerpoTpl, extrae, listasDe, listasDelJson, salidaNueva, tplDePlantilla, tplGuardable, tplVacia } from './buzon-exportacion';

/** Un proceso con sus salidas en edición. */
export interface ProcesoUI {
  p: ProcesoExportacion;
  salidas: SalidaUI[];
  campos: CampoExp[];
  listas: string[];
  /** Salidas con cambios sin guardar. */
  sucio: boolean;
  estado: 'ok' | 'pendiente' | 'guardando' | 'error';
  /** Por qué no se ha guardado (pendiente) o el error de la API. */
  motivo: string;
}

const ESPERA_MS = 700;

export class ExportacionEstado {
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly procesos = signal<ProcesoUI[]>([]);
  readonly bases = signal<Base[]>([]);
  /** Sube con cada cambio: los formularios son mutables y las vistas lo leen para repintarse. */
  readonly version = signal(0);

  private buzonId = '';
  private uid = 0;
  private readonly esperas = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly colas = new Map<string, Promise<void>>();

  constructor(
    private readonly api: BuzonApi,
    private readonly toast: ToastService,
  ) {}

  /**
   * Carga salidas, plantillas, bases y las listas del JSON vistas en los correos
   * recientes. `porDefecto`: qué salida mostrar en un proceso sin salidas guardadas
   * (el asistente propone la «Tabla» del prototipo y la guarda; la pestaña muestra
   * la verdad: «Sin archivo»).
   */
  async cargar(buzonId: string, porDefecto: 'tabla' | 'ninguno'): Promise<void> {
    this.buzonId = buzonId;
    this.cargando.set(true);
    this.error.set(null);
    try {
      const [x, bases, correos] = await Promise.all([
        this.api.exportacion(buzonId),
        this.api.listarBases(buzonId).catch(() => [] as Base[]),
        this.api.listarCorreos({ buzon_id: buzonId, limit: 100 }).catch(() => ({ data: [], total: 0 })),
      ]);
      // Listas de objetos del JSON por proceso, con los campos de sus elementos.
      const listas: Record<string, Record<string, string[]>> = {};
      correos.data.forEach((c) => {
        if (!c.datos_extraidos || !c.proceso_clave) return;
        const l = (listas[c.proceso_clave] ??= {});
        Object.entries(listasDelJson(c.datos_extraidos)).forEach(([k, v]) => (l[k] = [...new Set([...(l[k] ?? []), ...v])]));
      });
      // Una plantilla usada por dos salidas se edita en un solo formulario.
      const tpls = new Map(x.plantillas.map((t) => [t.id, tplDePlantilla(t)]));
      const procesos = x.procesos
        .filter((p) => p.activo && p.clave.toUpperCase() !== 'OTROS')
        .map((p) => {
          const lj = listas[p.clave] ?? {};
          const pu: ProcesoUI = { p, salidas: [], campos: camposExp(p, lj), listas: listasDe(p, lj), sucio: false, estado: 'ok', motivo: '' };
          pu.salidas = p.salidas.map((s) => ({
            uid: ++this.uid,
            nombre: s.nombre,
            modo: s.modo,
            etiquetas: s.etiquetas === null ? 'todas' : [...s.etiquetas],
            plantilla_id: s.plantilla_id,
            activa: s.activa,
            tpl: s.plantilla_id ? (tpls.get(s.plantilla_id) ?? null) : null,
          }));
          if (!pu.salidas.length) {
            const s = salidaNueva(p, ++this.uid);
            if (porDefecto === 'ninguno') Object.assign(s, { nombre: 'Sin archivo', modo: 'ninguno' });
            pu.salidas = [s];
            pu.sucio = porDefecto === 'tabla';
          }
          // Un proceso que no extrae datos no genera archivo (normExp).
          if (!extrae(p) && pu.salidas.some((s) => s.modo !== 'ninguno')) {
            pu.salidas.forEach((s) => (s.modo = 'ninguno'));
            pu.sucio = true;
          }
          return pu;
        });
      this.bases.set(bases);
      this.procesos.set(procesos);
      procesos.filter((pu) => pu.sucio).forEach((pu) => this.programar(pu, 0));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Cambiaron las salidas del proceso. */
  tocar(pu: ProcesoUI, inmediato = false): void {
    pu.sucio = true;
    this.version.update((v) => v + 1);
    this.programar(pu, inmediato ? 0 : ESPERA_MS);
  }

  /** Cambió la plantilla de una salida del proceso. */
  tocarTpl(pu: ProcesoUI, t: TplForm): void {
    t.sucio = true;
    this.version.update((v) => v + 1);
    this.programar(pu, ESPERA_MS);
  }

  // ── Edición de salidas (los `case "sal-…"` del prototipo) ──

  cambiarModo(pu: ProcesoUI, s: SalidaUI): void {
    if (s.modo === 'plantilla' && !s.tpl) s.tpl = tplVacia(s.nombre, pu.listas);
    this.tocar(pu, true);
  }

  agregarSalida(pu: ProcesoUI): SalidaUI {
    const s = salidaNueva(pu.p, ++this.uid);
    s.nombre = `Salida ${pu.salidas.length + 1}`;
    s.etiquetas = [];
    pu.salidas.push(s);
    this.tocar(pu);
    this.toast.show('Salida agregada: marca a qué etiquetas aplica');
    return s;
  }

  quitarSalida(pu: ProcesoUI, i: number): void {
    pu.salidas.splice(i, 1);
    this.tocar(pu, true);
  }

  alternarTodas(pu: ProcesoUI, s: SalidaUI): void {
    s.etiquetas = s.etiquetas === 'todas' ? [] : 'todas';
    this.tocar(pu);
  }

  marcarEtiqueta(pu: ProcesoUI, s: SalidaUI, et: string, on: boolean): void {
    const ets = pu.p.etiquetas;
    let cur = s.etiquetas === 'todas' ? [...ets] : [...s.etiquetas];
    if (on) {
      if (!cur.includes(et)) cur.push(et);
    } else cur = cur.filter((x) => x !== et);
    s.etiquetas = cur.length === ets.length ? 'todas' : cur;
    this.tocar(pu);
  }

  /** Guarda ya lo que esté esperando (al salir de la pantalla). */
  flush(): void {
    this.esperas.forEach((h, id) => {
      clearTimeout(h);
      const pu = this.procesos().find((x) => x.p.id === id);
      if (pu) this.encolar(pu);
    });
    this.esperas.clear();
  }

  /** Lo que impide guardar las salidas del proceso ('' = se pueden guardar). */
  motivo(pu: ProcesoUI): string {
    for (const s of pu.salidas) {
      if (!s.nombre.trim()) return 'cada salida necesita un nombre.';
      if (pu.p.etiquetas.length > 1 && s.etiquetas !== 'todas' && !s.etiquetas.length) return `«${s.nombre}» no aplica a ninguna etiqueta.`;
      if (s.modo === 'plantilla' && !s.plantilla_id) return `«${s.nombre}»: la plantilla se guarda cuando tenga nombre y al menos una columna.`;
    }
    return '';
  }

  private programar(pu: ProcesoUI, ms: number): void {
    clearTimeout(this.esperas.get(pu.p.id));
    this.esperas.set(
      pu.p.id,
      setTimeout(() => {
        this.esperas.delete(pu.p.id);
        this.encolar(pu);
      }, ms),
    );
  }

  /** Un guardado a la vez por proceso: el siguiente ve el id de la plantilla que creó el anterior. */
  private encolar(pu: ProcesoUI): void {
    const id = pu.p.id;
    this.colas.set(id, (this.colas.get(id) ?? Promise.resolve()).then(() => this.guardar(pu)));
  }

  private async guardar(pu: ProcesoUI): Promise<void> {
    const bump = () => this.version.update((v) => v + 1);
    pu.estado = 'ok';
    pu.motivo = '';
    // 1) Plantillas de las salidas «Plantilla específica».
    for (const s of pu.salidas) {
      const t = s.tpl;
      if (s.modo !== 'plantilla' || !t) continue;
      if ((t.sucio || !t.id) && tplGuardable(t)) {
        t.sucio = false; // lo que cambie mientras se guarda vuelve a marcarla
        try {
          const r = t.id ? await this.api.actualizarPlantilla(t.id, cuerpoTpl(t)) : await this.api.crearPlantilla(this.buzonId, cuerpoTpl(t));
          t.id = r.id;
        } catch (e) {
          t.sucio = true;
          pu.estado = 'error';
          pu.motivo = e instanceof Error ? e.message : String(e);
          bump();
          return;
        }
      }
      if (t.id && s.plantilla_id !== t.id) {
        s.plantilla_id = t.id;
        pu.sucio = true;
      }
    }
    if (!pu.sucio) {
      bump();
      return;
    }
    // 2) Salidas del proceso.
    const motivo = this.motivo(pu);
    if (motivo) {
      pu.estado = 'pendiente';
      pu.motivo = motivo;
      bump();
      return;
    }
    pu.sucio = false;
    pu.estado = 'guardando';
    bump();
    const multi = pu.p.etiquetas.length > 1;
    const body: SalidaIn[] = pu.salidas.map((s) => ({
      nombre: s.nombre.trim(),
      modo: s.modo,
      etiquetas: s.etiquetas === 'todas' || !multi ? null : s.etiquetas,
      plantilla_id: s.modo === 'plantilla' ? s.plantilla_id : null,
      activa: s.activa,
    }));
    try {
      await this.api.guardarSalidas(pu.p.id, body);
      pu.estado = 'ok';
      pu.motivo = '';
    } catch (e) {
      pu.sucio = true;
      pu.estado = 'error';
      pu.motivo = e instanceof Error ? e.message : String(e);
    }
    bump();
  }
}

/** Salidas con archivo del proceso (contador de la pestaña). */
export function conArchivo(pu: ProcesoUI): number {
  return pu.salidas.filter((s) => s.activa && s.modo !== 'ninguno').length;
}

