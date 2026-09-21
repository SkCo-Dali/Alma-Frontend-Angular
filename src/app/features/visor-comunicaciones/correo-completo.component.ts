// Vista de UN correo a pantalla completa, para abrir en pestaña nueva desde el
// visor. Existe para leer cómodo un correo largo sin el panel de la bandeja.
//
// Reutiliza `alma-email-frame` A PROPÓSITO, en vez de volcar el HTML en la
// pestaña: el frame trae el `sandbox=""` y la CSP que bloquean scripts,
// formularios, navegación y recursos remotos. Abrir el HTML suelto perdería esas
// protecciones y, sobre todo, dejaría clicables los enlaces del remitente —que
// Communication Services reescribe para medir— así que un analista mirando un
// correo registraría un clic a nombre del cliente.

import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

import { ComunicacionesService } from './comunicaciones.service';
import { EmailFrameComponent } from './email-frame.component';
import { EmlService } from './eml.service';
import { ParsedEml } from './eml.types';

@Component({
  selector: 'alma-correo-completo',
  imports: [DatePipe, LucideAngularModule, EmailFrameComponent],
  template: `
    <div class="flex h-full flex-col bg-background">
      @if (cargando()) {
        <p class="p-8 text-center text-sm text-muted-foreground">
          <lucide-icon name="loader-2" [size]="18" class="animate-spin text-primary" />
          Descargando el correo…
        </p>
      } @else if (error(); as e) {
        <p class="p-8 text-center text-sm text-destructive">{{ e }}</p>
      } @else if (eml(); as m) {
        <header class="shrink-0 border-b border-border bg-[var(--surface-sunken)] px-5 py-3">
          <h1 class="truncate text-base font-bold text-foreground" [title]="m.subject">
            {{ m.subject || '(sin asunto)' }}
          </h1>
          <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            @if (m.from?.address) {
              <span><span class="font-medium text-foreground">De:</span> {{ m.from?.address }}</span>
            }
            @if (destinatario(); as d) {
              <span><span class="font-medium text-foreground">Para:</span> {{ d }}</span>
            }
            @if (m.date) {
              <span>{{ m.date | date: "d 'de' MMMM 'de' y, h:mm a" }}</span>
            }
          </div>
        </header>

        @if (m.hasRemoteContent) {
          <div
            class="flex shrink-0 items-center gap-2 border-b border-border/60 bg-[var(--surface-sunken)] px-5 py-2 text-xs text-muted-foreground"
          >
            <lucide-icon name="shield-alert" [size]="15" class="text-primary" />
            <span>
              Este correo tenía imágenes alojadas fuera de Skandia. No se cargan: hacerlo le
              avisaría al remitente que alguien está viendo el mensaje. Las imágenes que viajaron
              dentro del correo sí se muestran.
            </span>
          </div>
        }

        @if (m.html) {
          <alma-email-frame class="min-h-0 flex-1" [html]="m.html" />
        } @else {
          <pre
            class="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-white p-6 text-sm leading-relaxed text-[#111]"
            >{{ m.text || 'Este correo no tiene cuerpo.' }}</pre
          >
        }
      }
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class CorreoCompletoComponent {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(ComunicacionesService);
  private readonly eml_ = inject(EmlService);

  protected readonly eml = signal<ParsedEml | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly destinatario = computed(() => this.eml()?.to?.[0]?.address ?? null);

  constructor() {
    void this.cargar();
  }

  private async cargar(): Promise<void> {
    const id = this.ruta.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('No se indicó qué correo abrir.');
      this.cargando.set(false);
      return;
    }
    try {
      const buffer = await this.api.obtenerEmlPorId(id);
      const parsed = await this.eml_.parse(buffer);
      this.eml.set(parsed);
      document.title = `${parsed.subject || 'Correo'} — ALMA`;
    } catch {
      this.error.set('No se pudo descargar el correo.');
    } finally {
      this.cargando.set(false);
    }
  }
}
