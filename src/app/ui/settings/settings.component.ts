// Configuración v2: tema, fondo esmerilado, cuentas conectadas (Pharos), conexiones del
// Agente (próximamente), ayuda y sesión. La Ayuda se integró aquí (/help redirige).

import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import {
  BACKGROUNDS,
  Background,
  BackgroundBlur,
  isImageBackground,
  PreferencesService,
  Theme,
} from '../../core/services/preferences.service';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { CuentaPharosComponent } from '../../features/suscripcion/cuenta-pharos.component';

const TEMAS: { id: Theme; label: string; icon: string }[] = [
  { id: 'light', label: 'Claro', icon: 'sun' },
  { id: 'dark', label: 'Oscuro', icon: 'moon' },
  { id: 'system', label: 'Sistema', icon: 'monitor' },
];

// Vista previa (aprox.) de cada fondo esmerilado; la paleta real vive en
// styles.css (--wp-* por data-bg).
const FONDOS: Record<Background, { label: string; preview: string }> = {
  terraza: { label: 'Terraza', preview: 'url(/wallpapers/terraza.jpg) center/cover' },
  mirador: { label: 'Mirador', preview: 'url(/wallpapers/mirador.jpg) center/cover' },
  lago: { label: 'Lago', preview: 'url(/wallpapers/lago.jpg) center/cover' },
  balcon: { label: 'Balcón', preview: 'url(/wallpapers/balcon.jpg) center/cover' },
  dorado: { label: 'Dorado', preview: 'url(/wallpapers/dorado.jpg) center/cover' },
  oceano: { label: 'Océano', preview: 'linear-gradient(135deg,#4fb8ff,#02b1ff,#7ce0c0)' },
  aurora: { label: 'Aurora', preview: 'linear-gradient(135deg,#00c83c,#02b1ff,#ff9200)' },
  atardecer: { label: 'Atardecer', preview: 'linear-gradient(135deg,#ffb54d,#ff9200,#a0e070)' },
  grafito: { label: 'Grafito', preview: 'linear-gradient(135deg,#d0d3d8,#b6bbc2,#e2e4e8)' },
  cielo: { label: 'Cielo', preview: 'linear-gradient(135deg,#bfe6ff,#8fd6f0,#dff0e6)' },
};

const NIVELES_DESENFOQUE: { id: BackgroundBlur; label: string }[] = [
  { id: 'off', label: 'Ninguno' },
  { id: 'suave', label: 'Suave' },
  { id: 'medio', label: 'Medio' },
  { id: 'fuerte', label: 'Fuerte' },
];

const AYUDA = [
  { icon: 'book-open', title: 'Documentación', desc: 'Guías de uso y preguntas frecuentes.' },
  { icon: 'life-buoy', title: 'Soporte técnico', desc: 'Contacta a Operaciones Digitales.' },
  { icon: 'message-circle', title: 'Sugerencias', desc: 'Cuéntanos cómo mejorar el portal.' },
];

@Component({
  selector: 'alma-settings',
  imports: [RouterLink, LucideAngularModule, PageHeaderComponent, CuentaPharosComponent],
  template: `
    <div class="mx-auto max-w-3xl">
      <a
        routerLink="/"
        class="glass mb-4 inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-primary"
      >
        <lucide-icon name="arrow-left" [size]="16" />
        Inicio
      </a>

      <alma-page-header title="Configuración" description="Preferencias personales del portal." />

      <div class="flex flex-col gap-5">
      <!-- ── Apariencia ── -->
      <section class="glass rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <h2 class="text-sm font-semibold text-foreground">Apariencia</h2>
        <p class="mb-4 text-xs text-muted-foreground">
          El tema y el fondo se guardan en tu cuenta.
        </p>

        <p class="mb-2 text-xs font-medium text-muted-foreground">Tema</p>
        <div class="mb-5 flex gap-2">
          @for (t of temas; track t.id) {
            <button
              (click)="prefs.theme.set(t.id)"
              class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
              [class]="
                prefs.theme() === t.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              "
            >
              <lucide-icon [name]="t.icon" [size]="16" />
              {{ t.label }}
            </button>
          }
        </div>

        <p class="mb-2 text-xs font-medium text-muted-foreground">Fondo</p>
        <div class="flex flex-wrap gap-3">
          @for (bg of fondos; track bg) {
            <button
              (click)="prefs.background.set(bg)"
              class="group flex flex-col items-center gap-1.5"
              [title]="fondosMeta[bg].label"
            >
              <span
                class="relative h-14 w-20 rounded-lg border shadow-sm transition-transform group-hover:scale-105"
                [class]="
                  prefs.background() === bg
                    ? 'border-primary ring-2 ring-primary/40'
                    : 'border-border'
                "
                [style.background]="fondosMeta[bg].preview"
              >
                @if (prefs.background() === bg) {
                  <span
                    class="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <lucide-icon name="check" [size]="12" />
                  </span>
                }
              </span>
              <span
                class="text-[11px]"
                [class]="
                  prefs.background() === bg
                    ? 'font-medium text-primary'
                    : 'text-muted-foreground'
                "
              >
                {{ fondosMeta[bg].label }}
              </span>
            </button>
          }
        </div>

        <!-- Desenfoque: solo tiene sentido con fondos de imagen. -->
        @if (esFondoImagen()) {
          <div class="mt-5">
            <p class="mb-1 text-xs font-medium text-muted-foreground">Desenfoque</p>
            <p class="mb-2 text-xs text-muted-foreground">
              Difumina la imagen para dar más protagonismo al contenido.
            </p>
            <div class="flex flex-wrap gap-2">
              @for (n of nivelesDesenfoque; track n.id) {
                <button
                  (click)="prefs.backgroundBlur.set(n.id)"
                  class="rounded-lg border px-3 py-2 text-sm transition-colors"
                  [class]="
                    prefs.backgroundBlur() === n.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  "
                >
                  {{ n.label }}
                </button>
              }
            </div>
          </div>
        }
      </section>

      <!-- ── Cuentas conectadas (Pharos, para usuarios de Suscripción) ── -->
      @if (puedeSuscripcion()) {
        <alma-cuenta-pharos />
      }

      <!-- ── Conexiones para el Agente Alma (próximamente) ── -->
      <section class="glass rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold text-foreground">Conexiones para el Agente Alma</h2>
          <span class="alma-badge bg-primary/10 text-primary">Próximamente</span>
        </div>
        <p class="mb-4 mt-1 text-xs text-muted-foreground">
          Conecta tus cuentas para que el Agente Alma trabaje contigo de forma transversal:
          leerá lo que te llega (con tu mismo nivel de acceso), lo cruzará con las Apps a
          las que tienes acceso y te sugerirá acciones.
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex items-start gap-3 rounded-lg border border-dashed border-border p-3 opacity-70">
            <span class="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <lucide-icon name="mail" [size]="16" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-foreground">Correo (Outlook)</p>
              <p class="text-xs text-muted-foreground">
                Ej.: llega un reclamo de liquidación → Alma lo detecta, investiga el
                contexto en la App de Comisiones y te sugiere la acción.
              </p>
            </div>
            <button class="alma-btn alma-btn-outline h-8 text-xs" disabled>Conectar</button>
          </div>
          <div class="flex items-start gap-3 rounded-lg border border-dashed border-border p-3 opacity-70">
            <span class="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
              <lucide-icon name="plug" [size]="16" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-foreground">Salesforce</p>
              <p class="text-xs text-muted-foreground">
                Si te asignan un caso, Alma te avisa y lo cruza con la App correspondiente
                para darte el contexto completo.
              </p>
            </div>
            <button class="alma-btn alma-btn-outline h-8 text-xs" disabled>Conectar</button>
          </div>
        </div>
      </section>

      <!-- ── Ayuda ── -->
      <section class="glass rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <h2 class="text-sm font-semibold text-foreground">Ayuda y soporte</h2>
        <p class="mb-4 text-xs text-muted-foreground">
          Recursos y contacto del equipo de Operaciones Digitales.
        </p>
        <div class="grid gap-3 sm:grid-cols-3">
          @for (r of ayuda; track r.title) {
            <div class="rounded-lg border border-border p-3">
              <span
                class="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"
              >
                <lucide-icon [name]="r.icon" [size]="16" />
              </span>
              <p class="mt-2 text-sm font-medium text-foreground">{{ r.title }}</p>
              <p class="text-xs text-muted-foreground">{{ r.desc }}</p>
            </div>
          }
        </div>
      </section>

      <!-- ── Sesión ── -->
      <section class="glass rounded-xl p-5 shadow-[var(--shadow-sm)]">
        <h2 class="text-sm font-semibold text-foreground">Sesión</h2>
        <p class="mb-3 text-xs text-muted-foreground">
          Sesión iniciada como {{ user().correo }}.
        </p>
        <button type="button" class="alma-btn alma-btn-outline" (click)="signOut()">
          <lucide-icon name="log-out" [size]="16" />
          Cerrar sesión
        </button>
      </section>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  protected readonly prefs = inject(PreferencesService);
  private readonly auth = inject(AuthService);

  protected readonly temas = TEMAS;
  protected readonly fondos = BACKGROUNDS;
  protected readonly fondosMeta = FONDOS;
  protected readonly nivelesDesenfoque = NIVELES_DESENFOQUE;
  /** El desenfoque solo aplica (y se ofrece) cuando el fondo es una imagen. */
  protected readonly esFondoImagen = computed(() => isImageBackground(this.prefs.background()));
  protected readonly ayuda = AYUDA;
  protected readonly user = this.auth.user;
  protected readonly puedeSuscripcion = computed(() =>
    this.auth.hasPermission('app.suscripcion.view'),
  );

  protected signOut(): void {
    void this.auth.signOut();
  }
}
