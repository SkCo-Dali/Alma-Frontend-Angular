// Header del shell: barra de vidrio esmerilado con el logo, el lema de la
// plataforma, el botón de cuadrícula (abre el Launchpad) y el chip de usuario
// con su cargo. El cambio de tema vive dentro del menú del usuario.

import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../core/auth/auth.service';
import { LaunchpadService } from '../../core/services/launchpad.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { shortName } from '../../core/utils/name';

@Component({
  selector: 'alma-header',
  imports: [RouterLink, LucideAngularModule],
  template: `
    <header class="spk-bar sticky top-0 z-30 flex h-20 items-center gap-4 px-4 md:px-6">
      <a routerLink="/" class="flex shrink-0 items-center gap-3" aria-label="Inicio">
        <img src="alma-logo.png" alt="Alma Skandia" class="block h-[3.25rem] w-auto dark:hidden" />
        <img
          src="alma-logo-neg.png"
          alt="Alma Skandia"
          class="hidden h-[3.25rem] w-auto dark:block"
        />
        <span class="hidden h-8 w-px bg-border sm:block"></span>
        <span class="hidden flex-col justify-center sm:flex">
          <span class="text-[13px] font-semibold leading-tight text-foreground">
            Conecta · Orquesta · Impulsa
          </span>
          <span class="text-[11px] leading-tight text-muted-foreground">
            Suite Digital de Operaciones
          </span>
        </span>
      </a>

      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          (click)="launchpad.open.set(true)"
          class="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/80 text-primary shadow-sm transition-all hover:-translate-y-px hover:shadow-md"
          aria-label="Todas las aplicaciones"
          title="Todas las aplicaciones"
        >
          <lucide-icon name="layout-grid" [size]="18" />
        </button>

        <div class="relative">
          <button
            type="button"
            (click)="toggleMenu($event)"
            class="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/80 py-1 pl-1 pr-2.5 shadow-sm transition-all hover:shadow-md"
            [attr.aria-expanded]="menuOpen()"
          >
            <img
              [src]="user().foto"
              [alt]="user().nombre"
              class="h-9 w-9 rounded-full border border-border object-cover"
            />
            <span class="hidden flex-col items-start sm:flex">
              <span class="text-sm font-semibold leading-tight text-foreground">
                {{ displayName() }}
              </span>
              <span class="text-[11px] leading-tight text-muted-foreground">
                {{ user().cargo }}
              </span>
            </span>
            <lucide-icon
              name="chevron-down"
              [size]="16"
              class="hidden text-muted-foreground sm:block"
            />
          </button>

          @if (menuOpen()) {
            <div
              class="surface-solid absolute right-0 z-50 mt-2 w-56 rounded-md border border-border p-1 text-popover-foreground shadow-[var(--shadow-md)]"
            >
              <div class="px-2 py-1.5">
                <p class="text-sm font-semibold">{{ user().nombre }}</p>
                <p class="text-xs font-normal text-muted-foreground">{{ user().correo }}</p>
              </div>
              <div class="-mx-1 my-1 h-px bg-muted"></div>
              <a
                routerLink="/profile"
                (click)="menuOpen.set(false)"
                class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <lucide-icon name="user" [size]="16" /> Mi perfil
              </a>
              <a
                routerLink="/settings"
                (click)="menuOpen.set(false)"
                class="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <lucide-icon name="settings" [size]="16" /> Configuración
              </a>
              <button
                type="button"
                (click)="$event.stopPropagation(); prefs.toggleTheme()"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <lucide-icon [name]="dark() ? 'sun' : 'moon'" [size]="16" />
                {{ dark() ? 'Modo claro' : 'Modo oscuro' }}
              </button>
              <div class="-mx-1 my-1 h-px bg-muted"></div>
              <button
                type="button"
                (click)="signOut()"
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-accent"
              >
                <lucide-icon name="log-out" [size]="16" /> Cerrar sesión
              </button>
            </div>
          }
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  protected readonly prefs = inject(PreferencesService);
  protected readonly launchpad = inject(LaunchpadService);
  private readonly auth = inject(AuthService);

  protected readonly user = this.auth.user;
  protected readonly displayName = computed(() => shortName(this.user().nombre));
  protected readonly dark = computed(() => {
    this.prefs.theme();
    return this.prefs.resolved() === 'dark';
  });
  protected readonly menuOpen = signal(false);

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  protected signOut(): void {
    this.menuOpen.set(false);
    void this.auth.signOut();
  }

  @HostListener('document:click')
  closeMenu(): void {
    if (this.menuOpen()) this.menuOpen.set(false);
  }
}
