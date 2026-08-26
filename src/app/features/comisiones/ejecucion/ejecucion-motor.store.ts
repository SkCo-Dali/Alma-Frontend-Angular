// Estado de la Ejecución del Motor (port de useEjecucionMotor).
//
// Lógica conservada del original:
// - Cada job corre en Databricks: al lanzarlo se guarda su run_id y se consulta
//   el estado cada 10 s; tras 3 errores seguidos de red se declara conexión
//   perdida y se deja de monitorear.
// - El porcentaje es estimado por tiempo (no lo da Databricks): 10→60% en los
//   primeros 5 min y 60→92% en los 10 siguientes; 95% al finalizar y 100% al
//   terminar.
// - Al entrar a la pantalla se recuperan las ejecuciones activas del backend,
//   así el monitoreo sobrevive a un refresco de la página.
// - El pipeline de ingesta (ADF) no expone estado, así que su avance se simula
//   con temporizadores: disparado → esperando correo → revisa tu correo → listo.
// - Cada tab de datos tiene sus propios filtros y su propia página; la búsqueda
//   solo se aplica al pulsar "Filtrar" (o Enter), nunca al teclear.

import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { ComisionesToast } from '../comisiones-toast.service';
import {
  DEFAULT_MOTOR_PAGE_SIZE,
  MotorActiveJob,
  MotorApi,
  MotorCompania,
  MotorDataTab,
  MotorJob,
  MotorTableTab,
} from './motor.api';

const POLL_MS = 10_000;
const MAX_ERRORS = 3;
const RUN_PHASE1_MS = 5 * 60 * 1000;
const RUN_PHASE2_MS = 10 * 60 * 1000;
const ADF_TRIGGERED_MS = 10_000;
const ADF_WAITING_EMAIL_MS = 4 * 60 * 1000;
const ADF_CHECK_EMAIL_MS = 30_000;

/** Lista de respaldo si el API de jobs no responde (mismos ids que Databricks). */
const JOBS_FALLBACK: MotorJob[] = [
  { job_id: 1119920686380224, orden: 1, nombre: 'Motor de Comisiones', descripcion: 'Calcula las comisiones base de todos los asesores del período' },
  { job_id: 142205964357855, orden: 2, nombre: 'Ajuste de Comisiones', descripcion: 'Aplica ajustes manuales y correcciones al cálculo de comisiones' },
  { job_id: 171026749578083, orden: 3, nombre: 'Mantenimiento y Exclusividad', descripcion: 'Actualiza y valida los indicadores de exclusividad por asesor' },
  { job_id: 438073747969009, orden: 4, nombre: 'Volúmenes y Reportes', descripcion: 'Genera los volúmenes de ventas y vistas de reportería' },
  { job_id: 343538865338068, orden: 5, nombre: 'Contabilidad', descripcion: 'Procesa las imputaciones contables de las comisiones calculadas' },
  { job_id: 47437940367346, orden: 6, nombre: 'Generación de Covers', descripcion: 'Genera los archivos cover de comisiones para cada canal' },
  { job_id: 946267918633956, orden: 7, nombre: 'Envío de Covers', descripcion: 'Distribuye y envía los covers generados a los destinatarios finales' },
];

export type JobPhase =
  | 'idle'
  | 'pending'
  | 'running'
  | 'terminating'
  | 'success'
  | 'canceled'
  | 'error';

export interface JobState {
  phase: JobPhase;
  runId: number | null;
  startTime: number | null;
  runningStart: number | null;
  lifecyclePhase: string | null;
  progress: number;
  errorDetail: string | null;
  errorsConsec: number;
  elapsedText: string;
}

export type AdfPhase =
  | 'idle'
  | 'triggered'
  | 'waiting_email'
  | 'check_email'
  | 'success'
  | 'error';

export interface TableState {
  page: number;
  total: number;
  pages: number;
  page_size: number;
  cols: string[];
  rows: unknown[][];
  loading: boolean;
}

export interface CorreoModalData {
  periodo: string | number;
  segmento: string;
  archivo: string;
  correo?: string;
  nombre?: string;
}

interface FiltrosComisiones {
  compania: string;
  periodo: string;
  search: string;
}

interface FiltrosCorreos {
  periodo: string;
  segmento: string;
  estado: string;
  search: string;
}

const jobIdle = (): JobState => ({
  phase: 'idle',
  runId: null,
  startTime: null,
  runningStart: null,
  lifecyclePhase: null,
  progress: 0,
  errorDetail: null,
  errorsConsec: 0,
  elapsedText: '',
});

const tablaVacia = (loading = false): TableState => ({
  page: 1,
  total: 0,
  pages: 1,
  page_size: DEFAULT_MOTOR_PAGE_SIZE,
  cols: [],
  rows: [],
  loading,
});

const filtrosComisionesVacios = (): FiltrosComisiones => ({
  compania: '',
  periodo: '',
  search: '',
});

const filtrosCorreosVacios = (): FiltrosCorreos => ({
  periodo: '',
  segmento: '',
  estado: '',
  search: '',
});

@Injectable()
export class EjecucionMotorStore implements OnDestroy {
  private readonly api = inject(MotorApi);
  private readonly toast = inject(ComisionesToast);

  readonly jobs = signal<MotorJob[]>([]);
  readonly jobsState = signal<Record<number, JobState>>({});
  readonly adfPhase = signal<AdfPhase>('idle');
  readonly adfError = signal<string | null>(null);
  readonly restoring = signal(false);

  readonly companias = signal<MotorCompania[]>([]);
  readonly roles = signal<string[]>([]);
  readonly periodosByTab = signal<Record<string, string[]>>({});

  readonly filtrosPre = signal<FiltrosComisiones>(filtrosComisionesVacios());
  readonly filtrosPost = signal<FiltrosComisiones>(filtrosComisionesVacios());
  readonly filtrosMant = signal<FiltrosComisiones>(filtrosComisionesVacios());
  readonly filtrosCorreos = signal<FiltrosCorreos>(filtrosCorreosVacios());

  /** Sube al cambiar filtros para que las tablas limpien sus filtros de columna. */
  readonly filterResetKeys = signal<Record<MotorDataTab, number>>({
    pre: 0,
    post: 0,
    mant: 0,
    correos: 0,
  });

  readonly tableData = signal<Record<MotorDataTab, TableState>>({
    pre: tablaVacia(),
    post: tablaVacia(),
    mant: tablaVacia(),
    correos: tablaVacia(),
  });

  /** Búsqueda efectivamente aplicada (no la que se está escribiendo). */
  private readonly busquedaAplicada: Record<MotorDataTab, string> = {
    pre: '',
    post: '',
    mant: '',
    correos: '',
  };

  private readonly pollings: Record<number, ReturnType<typeof setInterval>> = {};
  private readonly cronometros: Record<number, ReturnType<typeof setInterval>> = {};
  private adfTimers: ReturnType<typeof setTimeout>[] = [];
  private periodosCargados: Record<string, boolean> = {};
  private opcionesCargadas = false;
  private inicializado = false;

  readonly stats = computed(() => {
    const valores = Object.values(this.jobsState());
    const activos = valores.filter((s) =>
      ['pending', 'running', 'terminating'].includes(s.phase),
    ).length;
    const adfActivo = ['triggered', 'waiting_email', 'check_email'].includes(this.adfPhase())
      ? 1
      : 0;
    return {
      idle: valores.filter((s) => s.phase === 'idle').length,
      running: activos + adfActivo,
      success: valores.filter((s) => s.phase === 'success').length,
      error:
        valores.filter((s) => s.phase === 'error').length +
        (this.adfPhase() === 'error' ? 1 : 0),
    };
  });

  readonly hayActivos = computed(() =>
    Object.values(this.jobsState()).some((s) =>
      ['pending', 'running', 'terminating'].includes(s.phase),
    ),
  );

  jobPorId(id: number): MotorJob | undefined {
    return this.jobs().find((j) => j.job_id === id);
  }

  estadoDe(id: number): JobState {
    return this.jobsState()[id] ?? jobIdle();
  }

  filtros(tab: MotorDataTab): FiltrosComisiones | FiltrosCorreos {
    if (tab === 'correos') return this.filtrosCorreos();
    if (tab === 'post') return this.filtrosPost();
    if (tab === 'mant') return this.filtrosMant();
    return this.filtrosPre();
  }

  setFiltro(tab: MotorDataTab, key: string, valor: string): void {
    if (tab === 'correos') {
      this.filtrosCorreos.update((prev) => ({ ...prev, [key]: valor }));
      return;
    }
    const sig =
      tab === 'post' ? this.filtrosPost : tab === 'mant' ? this.filtrosMant : this.filtrosPre;
    sig.update((prev) => ({ ...prev, [key]: valor }));
  }

  private setFiltrosTab(tab: MotorDataTab, valor: FiltrosComisiones | FiltrosCorreos): void {
    if (tab === 'correos') this.filtrosCorreos.set(valor as FiltrosCorreos);
    else if (tab === 'post') this.filtrosPost.set(valor as FiltrosComisiones);
    else if (tab === 'mant') this.filtrosMant.set(valor as FiltrosComisiones);
    else this.filtrosPre.set(valor as FiltrosComisiones);
  }

  // ── Arranque ──────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.inicializado) return;
    this.inicializado = true;

    let jobs = JOBS_FALLBACK;
    try {
      jobs = await this.api.getJobs();
    } catch (e) {
      console.warn('No se pudo consultar la lista de jobs; se usa la de respaldo.', e);
    }
    this.jobs.set(jobs);

    const estados: Record<number, JobState> = {};
    for (const j of jobs) estados[j.job_id] = jobIdle();
    this.jobsState.set(estados);

    await Promise.all([this.restaurarActivos(jobs), this.cargarOpcionesFiltros()]);
  }

  /** Retoma el monitoreo de las ejecuciones que ya venían corriendo. */
  private async restaurarActivos(jobs: MotorJob[]): Promise<void> {
    this.restoring.set(true);
    try {
      const activos = await this.api.getActiveJobs();
      let recuperados = 0;

      for (const run of activos) {
        if (!jobs.some((j) => j.job_id === run.job_id)) continue;
        this.aplicarRestaurado(run);
        this.iniciarCronometro(run.job_id, run.inicio);
        this.pollings[run.job_id] = setInterval(
          () => void this.consultarEstado(run.job_id, run.run_id),
          POLL_MS,
        );
        recuperados++;
      }

      if (recuperados > 0) {
        this.toast.ok(
          'Ejecuciones recuperadas',
          `${recuperados} proceso(s) activo(s) restaurado(s)`,
        );
      }
    } catch (e) {
      console.error('Error restaurando ejecuciones activas:', e);
    } finally {
      this.restoring.set(false);
    }
  }

  private aplicarRestaurado(run: MotorActiveJob): void {
    const runningStart = run.inicio || Date.now();
    let phase: JobPhase = 'idle';
    let progress = 0;
    if (run.estado === 'PENDING') {
      phase = 'pending';
      progress = 5;
    } else if (run.estado === 'RUNNING') {
      phase = 'running';
      progress = Math.min(this.progresoEnEjecucion(runningStart), 92);
    } else if (run.estado === 'TERMINATING') {
      phase = 'terminating';
      progress = 95;
    }

    this.jobsState.update((prev) => ({
      ...prev,
      [run.job_id]: {
        phase,
        runId: run.run_id,
        startTime: run.inicio || Date.now(),
        runningStart,
        lifecyclePhase: run.estado,
        progress,
        errorDetail: null,
        errorsConsec: 0,
        elapsedText: 'Restaurando…',
      },
    }));
  }

  private async cargarOpcionesFiltros(): Promise<void> {
    if (this.opcionesCargadas) return;
    this.opcionesCargadas = true;
    try {
      const [companias, roles] = await Promise.all([
        this.api.getFiltrosCompanias(),
        this.api.getFiltrosRoles(),
      ]);
      this.companias.set(companias);
      this.roles.set(roles);
    } catch (e) {
      this.opcionesCargadas = false;
      console.error('Error cargando las opciones de filtro del motor:', e);
    }
  }

  async cargarPeriodos(tab: MotorDataTab): Promise<void> {
    if (this.periodosCargados[tab]) return;
    this.periodosCargados[tab] = true;
    try {
      const periodos = await this.api.getFiltrosPeriodos(tab);
      this.periodosByTab.update((prev) => ({ ...prev, [tab]: periodos }));
    } catch (e) {
      this.periodosCargados[tab] = false;
      console.error(e);
    }
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────

  /** Estimación por tiempo: Databricks no reporta porcentaje de avance. */
  private progresoEnEjecucion(desdeMs: number): number {
    const t = Date.now() - desdeMs;
    if (t <= RUN_PHASE1_MS) return 10 + (t / RUN_PHASE1_MS) * 50;
    return 60 + Math.min(((t - RUN_PHASE1_MS) / RUN_PHASE2_MS) * 32, 32);
  }

  private iniciarCronometro(jobId: number, desde?: number): void {
    clearInterval(this.cronometros[jobId]);
    const inicio = desde || Date.now();
    this.jobsState.update((prev) => ({
      ...prev,
      [jobId]: { ...(prev[jobId] ?? jobIdle()), startTime: inicio },
    }));

    this.cronometros[jobId] = setInterval(() => {
      const segs = Math.floor((Date.now() - inicio) / 1000);
      const m = Math.floor(segs / 60);
      const s = segs % 60;
      const texto = m > 0 ? `${m}m ${s}s` : `${s}s`;
      this.jobsState.update((prev) =>
        prev[jobId] ? { ...prev, [jobId]: { ...prev[jobId], elapsedText: texto } } : prev,
      );
    }, 1000);
  }

  private detenerTemporizadores(jobId: number): void {
    clearInterval(this.pollings[jobId]);
    delete this.pollings[jobId];
    clearInterval(this.cronometros[jobId]);
    delete this.cronometros[jobId];
  }

  async ejecutarJob(jobId: number): Promise<void> {
    this.detenerTemporizadores(jobId);
    this.jobsState.update((prev) => ({
      ...prev,
      [jobId]: {
        ...jobIdle(),
        phase: 'pending',
        startTime: Date.now(),
        progress: 5,
        elapsedText: 'Iniciando…',
      },
    }));

    try {
      const data = await this.api.ejecutarJob(jobId);
      this.jobsState.update((prev) => ({
        ...prev,
        [jobId]: { ...prev[jobId], runId: data.run_id },
      }));
      this.toast.ok('Job iniciado', `${data.nombre} · Run #${data.run_id}`);
      this.iniciarCronometro(jobId);
      this.pollings[jobId] = setInterval(
        () => void this.consultarEstado(jobId, data.run_id),
        POLL_MS,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.jobsState.update((prev) => ({
        ...prev,
        [jobId]: {
          ...jobIdle(),
          phase: 'error',
          errorDetail: msg,
          elapsedText: 'No se pudo iniciar',
        },
      }));
      this.toast.errorGenericoConMensaje(msg, 'Error al iniciar');
    }
  }

  async cancelarJob(jobId: number): Promise<void> {
    const runId = this.estadoDe(jobId).runId;
    if (!runId) return;
    try {
      await this.api.cancelarJob(runId);
      this.toast.ok('Cancelación solicitada', 'La ejecución se detendrá pronto');
      this.jobsState.update((prev) => ({
        ...prev,
        [jobId]: { ...prev[jobId], phase: 'terminating' },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.toast.errorGenericoConMensaje(msg, 'No se pudo cancelar');
    }
  }

  private async consultarEstado(jobId: number, runId: number): Promise<void> {
    try {
      const { estado, resultado, terminado, mensaje } = await this.api.getJobEstado(runId);
      const actual = this.estadoDe(jobId);

      let phase = actual.phase;
      let progress = actual.progress;
      let runningStart = actual.runningStart;

      if (estado === 'PENDING') {
        phase = 'pending';
        progress = 5;
      } else if (estado === 'RUNNING') {
        phase = 'running';
        if (actual.lifecyclePhase !== 'RUNNING') {
          runningStart = runningStart ?? Date.now();
          this.toast.ok('Cluster listo', `${this.jobPorId(jobId)?.nombre} está ejecutándose`);
        }
        progress = Math.min(this.progresoEnEjecucion(runningStart ?? Date.now()), 92);
      } else if (estado === 'TERMINATING') {
        phase = 'terminating';
        progress = 95;
      } else if (estado === 'SKIPPED') {
        phase = 'canceled';
        progress = 100;
        this.detenerTemporizadores(jobId);
        this.toast.ok('Proceso omitido', `El job ${this.jobPorId(jobId)?.nombre} fue omitido`);
      }

      let errorDetail = actual.errorDetail;
      if (terminado) {
        progress = 100;
        this.detenerTemporizadores(jobId);
        const nombre = this.jobPorId(jobId)?.nombre ?? 'Proceso';
        if (resultado === 'SUCCESS') {
          phase = 'success';
          this.toast.ok('Proceso completado', `${nombre} finalizó correctamente`);
        } else if (resultado === 'CANCELED') {
          phase = 'canceled';
          this.toast.ok('Proceso cancelado', nombre);
        } else {
          phase = 'error';
          errorDetail = mensaje || resultado || 'Error desconocido';
          this.toast.errorGenericoConMensaje(
            `${nombre} falló. Revisa los detalles.`,
            'Error en ejecución',
          );
        }
      }

      this.jobsState.update((prev) => ({
        ...prev,
        [jobId]: {
          ...prev[jobId],
          phase,
          progress,
          runningStart,
          lifecyclePhase: estado,
          errorsConsec: 0,
          errorDetail,
        },
      }));
    } catch {
      // Errores de red seguidos: a los 3 se abandona el monitoreo.
      const errores = this.estadoDe(jobId).errorsConsec + 1;
      this.jobsState.update((prev) => ({
        ...prev,
        [jobId]: { ...prev[jobId], errorsConsec: errores },
      }));
      if (errores >= MAX_ERRORS) this.conexionPerdida(jobId);
    }
  }

  private conexionPerdida(jobId: number): void {
    this.detenerTemporizadores(jobId);
    this.jobsState.update((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        phase: 'error',
        errorDetail: 'Se perdió la conexión con el API',
        lifecyclePhase: null,
        errorsConsec: 0,
      },
    }));
    this.toast.errorGenericoConMensaje(
      'El monitoreo se detuvo para este job',
      'Conexión perdida',
    );
  }

  // ── Pipeline de ingesta (ADF) ─────────────────────────────────────────────

  private limpiarAdfTimers(): void {
    for (const t of this.adfTimers) clearTimeout(t);
    this.adfTimers = [];
  }

  async ejecutarADF(): Promise<void> {
    this.limpiarAdfTimers();
    this.adfPhase.set('triggered');
    this.adfError.set(null);
    this.toast.ok('Pipeline iniciado', 'Ingesta SQL Server → Databricks en progreso');

    try {
      await this.api.ejecutarIngesta();
      // ADF no expone estado por API: el avance se simula por tiempo.
      this.adfTimers.push(
        setTimeout(() => this.adfPhase.set('waiting_email'), ADF_TRIGGERED_MS),
        setTimeout(() => {
          this.adfPhase.set('check_email');
          this.toast.ok('Revisa tu correo', 'El correo de notificación debería haber llegado');
        }, ADF_TRIGGERED_MS + ADF_WAITING_EMAIL_MS),
        setTimeout(
          () => {
            this.adfPhase.set('success');
            this.toast.ok(
              'Ingesta completada',
              'El pipeline ADF finalizó — ya puedes continuar con los jobs',
            );
          },
          ADF_TRIGGERED_MS + ADF_WAITING_EMAIL_MS + ADF_CHECK_EMAIL_MS,
        ),
      );
    } catch (e) {
      this.limpiarAdfTimers();
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.adfPhase.set('error');
      this.adfError.set(msg);
      this.toast.errorGenericoConMensaje(msg, 'Error al iniciar pipeline');
    }
  }

  // ── Tablas ────────────────────────────────────────────────────────────────

  async cargarTabla(tab: MotorDataTab, page = 1): Promise<void> {
    this.tableData.update((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));

    const f = this.filtros(tab);
    const pageSize = this.tableData()[tab].page_size;
    const search = this.busquedaAplicada[tab] || undefined;

    try {
      const data =
        tab === 'correos'
          ? await this.api.getCorreos({
              page,
              page_size: pageSize,
              periodo: (f as FiltrosCorreos).periodo || undefined,
              segmento: (f as FiltrosCorreos).segmento || undefined,
              estado: (f as FiltrosCorreos).estado || undefined,
              search,
            })
          : await this.api.getTabla(tab as MotorTableTab, {
              page,
              page_size: pageSize,
              compania: (f as FiltrosComisiones).compania || undefined,
              periodo: (f as FiltrosComisiones).periodo || undefined,
              search,
            });

      this.tableData.update((prev) => ({
        ...prev,
        [tab]: {
          page,
          total: data.total,
          pages: data.pages,
          page_size: data.page_size ?? pageSize,
          cols: data.columns,
          rows: data.rows,
          loading: false,
        },
      }));
    } catch (e) {
      this.tableData.update((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.toast.errorGenericoConMensaje(msg, 'Error al cargar tabla');
    }
  }

  /** Entrar al tab: filtros en blanco y primera página sin filtros. */
  async reiniciarYCargar(tab: MotorDataTab): Promise<void> {
    this.busquedaAplicada[tab] = '';
    this.setFiltrosTab(
      tab,
      tab === 'correos' ? filtrosCorreosVacios() : filtrosComisionesVacios(),
    );
    this.tableData.update((prev) => ({ ...prev, [tab]: tablaVacia(true) }));

    try {
      const data =
        tab === 'correos'
          ? await this.api.getCorreos({ page: 1, page_size: DEFAULT_MOTOR_PAGE_SIZE })
          : await this.api.getTabla(tab as MotorTableTab, {
              page: 1,
              page_size: DEFAULT_MOTOR_PAGE_SIZE,
            });

      this.tableData.update((prev) => ({
        ...prev,
        [tab]: {
          page: data.page,
          total: data.total,
          pages: data.pages,
          page_size: data.page_size ?? DEFAULT_MOTOR_PAGE_SIZE,
          cols: data.columns,
          rows: data.rows,
          loading: false,
        },
      }));
    } catch (e) {
      this.tableData.update((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.toast.errorGenericoConMensaje(msg, 'Error al cargar tabla');
    }
  }

  /** "Filtrar": aquí (y solo aquí) la búsqueda escrita pasa a aplicarse. */
  aplicarFiltros(tab: MotorDataTab): void {
    this.busquedaAplicada[tab] = this.filtros(tab).search.trim();
    void this.cargarTabla(tab, 1);
  }

  limpiarFiltros(tab: MotorDataTab): void {
    this.filterResetKeys.update((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
    void this.reiniciarYCargar(tab);
  }

  cambiarPagina(tab: MotorDataTab, page: number): void {
    void this.cargarTabla(tab, page);
  }

  cambiarTamanoPagina(tab: MotorDataTab, size: number): void {
    this.tableData.update((prev) => ({ ...prev, [tab]: { ...prev[tab], page_size: size } }));
    void this.cargarTabla(tab, 1);
  }

  async exportarExcel(tab: MotorDataTab): Promise<void> {
    const f = this.filtros(tab);
    this.toast.ok('Generando Excel', 'Descarga en progreso…');
    try {
      if (tab === 'correos') {
        const c = f as FiltrosCorreos;
        await this.api.exportCorreos(
          {
            periodo: c.periodo || undefined,
            segmento: c.segmento || undefined,
            estado: c.estado || undefined,
          },
          `correos_${c.periodo || 'todos'}.xlsx`,
        );
      } else {
        const c = f as FiltrosComisiones;
        await this.api.exportTabla(
          tab as MotorTableTab,
          { compania: c.compania || undefined, periodo: c.periodo || undefined },
          `${tab}_${c.periodo || 'todos'}.xlsx`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.toast.errorGenericoConMensaje(msg, 'Error al descargar Excel');
    }
  }

  // ── Correos ───────────────────────────────────────────────────────────────

  async editarCorreo(
    data: CorreoModalData,
    correo: string,
    nombre: string,
  ): Promise<boolean> {
    if (!correo.trim()) {
      this.toast.errorGenericoConMensaje('El correo no puede estar vacío', 'Campo requerido');
      return false;
    }
    try {
      await this.api.editarCorreo({
        periodo: parseInt(String(data.periodo), 10),
        segmento: data.segmento,
        nombre_archivo: data.archivo,
        correo: correo.trim(),
        nombre_destinatario: nombre,
      });
      this.toast.ok('Correo actualizado', 'Destinatario guardado y marcado como MANUAL');
      void this.cargarTabla('correos', this.tableData().correos.page);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.toast.errorGenericoConMensaje(msg, 'Error al guardar');
      return false;
    }
  }

  async excluirCorreo(data: CorreoModalData): Promise<boolean> {
    try {
      await this.api.excluirCorreo({
        periodo: parseInt(String(data.periodo), 10),
        segmento: data.segmento,
        nombre_archivo: data.archivo,
      });
      this.toast.ok('Correo excluido', 'Marcado como Excluido — no se enviará en el job 07');
      void this.cargarTabla('correos', this.tableData().correos.page);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.toast.errorGenericoConMensaje(msg, 'Error al excluir');
      return false;
    }
  }

  ngOnDestroy(): void {
    for (const id of Object.keys(this.pollings)) this.detenerTemporizadores(Number(id));
    for (const id of Object.keys(this.cronometros)) this.detenerTemporizadores(Number(id));
    this.limpiarAdfTimers();
  }
}
