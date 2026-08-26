// Configuración v2: tema, fondo esmerilado, cuentas conectadas (Pharos), conexiones del
// Agente (próximamente), ayuda y sesión. La Ayuda se integró aquí (/help redirige).

import { Component, computed, inject } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { SkButtonComponent, SkTagComponent } from '@skandia/ui';
import { AuthService } from '../../core/auth/auth.service';
import {
  BACKGROUNDS,
  Background,
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

// Vista previa (aprox.) de cada fondo; la paleta esmerilada real vive en
// styles.css (--wp-* por data-bg). Los sólidos usan tokens del Design System
// Skandia (@skandia/ui); los wallpapers fotográficos son imágenes propias de Alma.
const FONDOS: Record<Background, { label: string; preview: string }> = {
  oceano: {
    label: 'Océano',
    preview:
      'linear-gradient(135deg, var(--feedback-info-dark), var(--extras-c18), var(--primary-l03))',
  },
  aurora: {
    label: 'Aurora',
    preview:
      'linear-gradient(135deg, var(--primary-00), var(--feedback-info-dark), var(--feedback-warning-dark))',
  },
  atardecer: {
    label: 'Atardecer',
    preview:
      'linear-gradient(135deg, var(--feedback-warning-dark), var(--extras-c15), var(--secondarygreencomplementary-00))',
  },
  grafito: {
    label: 'Grafito',
    preview:
      'linear-gradient(135deg, var(--neutral-l04), var(--primarygrey-l05), var(--neutral-l03))',
  },
  cielo: {
    label: 'Cielo',
    preview:
      'linear-gradient(135deg, var(--extras-c02), var(--secondarybluecomplementary-l03), var(--primary-l04))',
  },
  terraza: { label: 'Terraza', preview: 'url(/wallpapers/terraza.jpg) center/cover' },
  mirador: { label: 'Mirador', preview: 'url(/wallpapers/mirador.jpg) center/cover' },
  lago: { label: 'Lago', preview: 'url(/wallpapers/lago.jpg) center/cover' },
  balcon: { label: 'Balcón', preview: 'url(/wallpapers/balcon.jpg) center/cover' },
  dorado: { label: 'Dorado', preview: 'url(/wallpapers/dorado.jpg) center/cover' },
};

const AYUDA = [
  { icon: 'book-open', title: 'Documentación', desc: 'Guías de uso y preguntas frecuentes.' },
  { icon: 'life-buoy', title: 'Soporte técnico', desc: 'Contacta a Operaciones Digitales.' },
  { icon: 'message-circle', title: 'Sugerencias', desc: 'Cuéntanos cómo mejorar el portal.' },
];

@Component({
  selector: 'alma-settings',
  imports: [
    LucideAngularModule,
    SkButtonComponent,
    SkTagComponent,
    PageHeaderComponent,
    CuentaPharosComponent,
  ],
  template: `
    <alma-page-header title="Configuración" description="Preferencias personales del portal." />

    <div class="flex max-w-3xl flex-col gap-5">
      <!-- ── Apariencia ── -->
      <section class="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
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
      </section>

      <!-- ── Cuentas conectadas (Pharos, para usuarios de Suscripción) ── -->
      @if (puedeSuscripcion()) {
        <alma-cuenta-pharos />
      }

      <!-- ── Conexiones para el Agente Alma (próximamente) ── -->
      <section class="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold text-foreground">Conexiones para el Agente Alma</h2>
          <sk-tag value="Próximamente" severity="info" />
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
            <sk-button
              variant="secondary"
              class="h-8 text-xs"
              [disabled]="true"
              label="Conectar"
            />
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
            <sk-button
              variant="secondary"
              class="h-8 text-xs"
              [disabled]="true"
              label="Conectar"
            />
          </div>
        </div>
      </section>

      <!-- ── Ayuda ── -->
      <section class="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
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
      <section class="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-sm)]">
        <h2 class="text-sm font-semibold text-foreground">Sesión</h2>
        <p class="mb-3 text-xs text-muted-foreground">
          Sesión iniciada como {{ user().correo }}.
        </p>
        <sk-button
          variant="secondary"
          type="button"
          label="Cerrar sesión"
          (clicked)="signOut()"
        />
      </section>
    </div>
  `,
})
export class SettingsComponent {
  protected readonly prefs = inject(PreferencesService);
  private readonly auth = inject(AuthService);

  protected readonly temas = TEMAS;
  protected readonly fondos = BACKGROUNDS;
  protected readonly fondosMeta = FONDOS;
  protected readonly ayuda = AYUDA;
  protected readonly user = this.auth.user;
  protected readonly puedeSuscripcion = computed(() =>
    this.auth.hasPermission('app.suscripcion.view'),
  );

  protected signOut(): void {
    void this.auth.signOut();
  }
}
