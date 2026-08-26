// Host de micro-frontends: monta una app de otro equipo dentro del shell.
//
// El contrato es el del App Manifest: la app remota se publica como Web
// Component (Angular Elements, que es lo que produce la plantilla corporativa),
// y aquí se carga su script + su hoja de estilos y se instancia su elemento.
//
// La sesión NO se repite: Alma le pasa por propiedades el access token del
// operador, su nombre/correo y los roles funcionales que le corresponden. El
// token se renueva en silencio y se vuelve a escribir en el elemento, así la app
// remota nunca tiene que autenticar por su cuenta.

import {
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent } from '@skandia/ui';
import { AuthService } from '../../core/auth/auth.service';
import { Application } from '../../core/models/platform.models';

/** Refresco del token dentro del elemento remoto (el de Entra dura ~1 h). */
const REFRESH_MS = 20 * 60 * 1000;

/** Scripts/estilos ya inyectados: una app remota se carga una sola vez. */
const cargados = new Map<string, Promise<void>>();

function cargarEstilo(url: string): void {
  if (document.querySelector(`link[data-mf="${url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  link.dataset['mf'] = url;
  document.head.appendChild(link);
}

function cargarScript(url: string): Promise<void> {
  const previo = cargados.get(url);
  if (previo) return previo;
  const promesa = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.dataset['mf'] = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    document.body.appendChild(s);
  });
  cargados.set(url, promesa);
  return promesa;
}

@Component({
  selector: 'alma-microfrontend-host',
  imports: [LucideAngularModule, SkButtonComponent],
  template: `
    @if (error(); as err) {
      <div class="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <div
          class="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        >
          <lucide-icon name="alert-triangle" [size]="26" />
        </div>
        <h1 class="mt-4 text-xl font-bold">No se pudo cargar {{ app().nombre }}</h1>
        <p class="mt-2 max-w-md text-sm text-muted-foreground">{{ err }}</p>
        <sk-button
          variant="secondary"
          type="button"
          class="mt-6"
          label="Reintentar"
          (clicked)="montar()"
        />
      </div>
    } @else if (cargando()) {
      <div class="flex min-h-[55vh] flex-col items-center justify-center gap-3">
        <lucide-icon name="loader-2" [size]="28" class="animate-spin text-muted-foreground" />
        <p class="text-sm text-muted-foreground">Cargando {{ app().nombre }}…</p>
      </div>
    }

    <!-- Contenedor del elemento remoto. Se mantiene siempre en el DOM para que
         la app no se desmonte al pintar estados de carga. -->
    <div #contenedor [class.hidden]="cargando() || !!error()" class="w-full"></div>
  `,
})
export class MicrofrontendHostComponent implements OnDestroy {
  readonly app = input.required<Application>();

  private readonly auth = inject(AuthService);

  @ViewChild('contenedor', { static: true })
  private contenedor!: ElementRef<HTMLDivElement>;

  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  private elemento: HTMLElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private montado = '';

  constructor() {
    // Se monta cuando llega el manifest (y se remonta si cambia de app).
    void Promise.resolve().then(() => this.montar());
  }

  protected readonly remoto = computed(() => this.app().remote);

  protected async montar(): Promise<void> {
    const remoto = this.remoto();
    if (!remoto) {
      this.error.set('La aplicación no declara su punto de entrada remoto.');
      this.cargando.set(false);
      return;
    }
    if (this.montado === remoto.scriptUrl && this.elemento) return;

    this.cargando.set(true);
    this.error.set(null);

    try {
      if (remoto.styleUrl) cargarEstilo(remoto.styleUrl);
      await cargarScript(remoto.scriptUrl);
      await customElements.whenDefined(remoto.elementName);

      const el = document.createElement(remoto.elementName);
      this.aplicarSesion(el, await this.token());
      this.contenedor.nativeElement.replaceChildren(el);
      this.elemento = el;
      this.montado = remoto.scriptUrl;
      this.cargando.set(false);

      // Renovación silenciosa del token mientras la app esté abierta.
      this.timer = setInterval(() => {
        void this.token().then((t) => {
          if (t && this.elemento) {
            (this.elemento as unknown as Record<string, unknown>)['accessToken'] = t;
          }
        });
      }, REFRESH_MS);
    } catch (e) {
      this.cargando.set(false);
      this.error.set(
        e instanceof Error
          ? e.message
          : 'La aplicación remota no respondió. Revisa que esté publicada.',
      );
    }
  }

  /**
   * Token que recibe la app remota:
   *  - si declara `scopes`, uno emitido PARA SU PROPIO API (conserva su audiencia
   *    y sus app roles, sin cambiarle el código);
   *  - si no, el token de Alma (su API tiene que aceptar la audiencia de Alma).
   */
  private async token(): Promise<string | null> {
    const scopes = this.remoto()?.scopes;
    if (!scopes?.length) return this.auth.getAccessToken();
    const { token, motivo } = await this.auth.getRemoteToken(scopes);
    if (!token) throw new Error(motivo ?? 'No se pudo obtener el token de la aplicación.');
    return token;
  }

  /** Propiedades del elemento = los @Input() de la app remota. */
  private aplicarSesion(el: HTMLElement, token: string | null): void {
    const props = el as unknown as Record<string, unknown>;
    const user = this.auth.user();
    const base = this.remoto()?.apiBaseUrl;
    if (base) props['apiBaseUrl'] = base;
    props['accessToken'] = token ?? '';
    props['userName'] = user.nombre;
    props['userEmail'] = user.correo;
    props['roles'] = this.rolesRemotos();
  }

  /**
   * Traduce los permisos de Alma a los roles funcionales que espera la app
   * remota (su UI los usa para habilitar acciones). El mapa viene en el
   * manifest, así cada app declara su propia equivalencia.
   */
  private rolesRemotos(): string[] {
    const mapa = this.remoto()?.roleMap ?? {};
    const roles = new Set<string>();
    for (const [permiso, rol] of Object.entries(mapa)) {
      if (this.auth.hasPermission(permiso)) roles.add(rol);
    }
    return [...roles];
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.elemento?.remove();
    this.elemento = null;
  }
}
