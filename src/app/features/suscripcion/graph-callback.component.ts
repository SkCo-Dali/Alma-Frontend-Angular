// Retorno del flujo OAuth delegado del buzón de suscripción: Microsoft
// redirige aquí con ?code=... (redirect URI registrado en las 3 apps de
// Entra). Canjea el código en el backend (que valida que la cuenta sea la del
// buzón y guarda los tokens cifrados) y vuelve a donde estaba el usuario
// (state = URL de origen, normalmente el detalle de la cotización).

import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AlmaLoaderComponent } from '../../shared/components/alma-loader.component';
import { CorreoApi } from '../../shared/correo/correo.api';
import { SuscripcionApi } from './suscripcion.api';

@Component({
  selector: 'alma-graph-callback',
  imports: [RouterLink, LucideAngularModule, AlmaLoaderComponent],
  template: `
    <div class="mx-auto flex w-full max-w-md flex-col items-center gap-4 pt-16 text-center">
      @if (procesando()) {
        <alma-loader [size]="80" />
        <p class="text-sm text-muted-foreground">Conectando el buzón de suscripción…</p>
      } @else if (error(); as err) {
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <lucide-icon name="plug" [size]="22" />
        </div>
        <div>
          <p class="text-sm font-semibold">No fue posible conectar el buzón</p>
          <p class="mt-1 text-xs text-muted-foreground">{{ err }}</p>
        </div>
        <a [routerLink]="destino()" class="alma-btn alma-btn-outline rounded-xl text-xs">
          Volver
        </a>
      } @else {
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <lucide-icon name="plug-zap" [size]="22" />
        </div>
        <p class="text-sm font-semibold">Buzón conectado</p>
        <p class="text-xs text-muted-foreground">Regresando…</p>
      }
    </div>
  `,
})
export class GraphCallbackComponent {
  private readonly api = inject(SuscripcionApi);
  private readonly correoApi = inject(CorreoApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly procesando = signal(true);
  protected readonly error = signal<string | null>(null);
  /** A dónde volver: el state del authorize (URL de origen) o la app. */
  protected readonly destino = signal('/apps/suscripcion');
  /** state = "b:<buzonId>|<url>" (buzón genérico, p.ej. desde Configuración)
      o "<url>" a secas (flujo del modal de Suscripción). */
  private buzonId: string | null = null;

  constructor() {
    const qp = this.route.snapshot.queryParamMap;
    let state = qp.get('state') ?? '';
    const m = /^b:([0-9a-f-]{36})\|(.*)$/i.exec(state);
    if (m) {
      this.buzonId = m[1];
      state = m[2];
    }
    // Solo rutas internas: nada de volver a un origen externo inyectado.
    if (state.startsWith('/') && !state.startsWith('//')) this.destino.set(state);
    void this.procesar(qp.get('code'), qp.get('error_description') ?? qp.get('error'));
  }

  private async procesar(code: string | null, errorOauth: string | null): Promise<void> {
    if (!code) {
      this.error.set(errorOauth ?? 'La autorización fue cancelada.');
      this.procesando.set(false);
      return;
    }
    const redirect = `${window.location.origin}/graph-callback`;
    try {
      if (this.buzonId) {
        await this.correoApi.conectarBuzon(this.buzonId, code, redirect);
      } else {
        await this.api.conectarCuentaCorreo(code, redirect);
      }
      this.procesando.set(false);
      setTimeout(() => void this.router.navigateByUrl(this.destino()), 900);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : String(e));
      this.procesando.set(false);
    }
  }
}
