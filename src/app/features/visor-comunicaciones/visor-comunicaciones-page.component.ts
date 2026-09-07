// Visor de comunicaciones (EML). Entrada: una BANDEJA (mock del storage de Azure)
// con las comunicaciones; al abrir una se muestra como documento, sin exponer MIME,
// con panel INFORMACIÓN a la izquierda y tres modos: Vista correo · Adjuntos ·
// Detalles técnicos. El shell aporta header y dock; esta página llena la altura.

import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EmlService } from './eml.service';
import { EmlAttachment, ParsedEml } from './eml.types';
import { EmailFrameComponent } from './email-frame.component';
import { AttachmentPreviewComponent } from './attachment-preview.component';
import { BandejaComunicacionesComponent } from './bandeja-comunicaciones.component';
import { COMUNICACIONES_MOCK, ComunicacionRef } from './comunicaciones.mock';

type Modo = 'correo' | 'adjuntos' | 'detalles';

@Component({
  selector: 'alma-visor-comunicaciones-page',
  imports: [
    RouterLink,
    LucideAngularModule,
    EmailFrameComponent,
    AttachmentPreviewComponent,
    BandejaComunicacionesComponent,
  ],
  template: `
    <div data-full-bleed class="flex flex-col gap-3" [style.height]="'calc(100dvh - 8.5rem)'">
      <!-- Navegación -->
      <div class="flex shrink-0 items-center gap-2">
        <a
          routerLink="/"
          class="glass inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-primary"
        >
          <lucide-icon name="arrow-left" [size]="16" />
          Inicio
        </a>
        @if (parsed()) {
          <button
            type="button"
            (click)="volverBandeja()"
            class="glass inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-foreground shadow-[var(--shadow-sm)] transition-colors hover:text-primary"
          >
            <lucide-icon name="inbox" [size]="16" />
            Bandeja
          </button>
        }
      </div>

      @if (parsed(); as eml) {
        <!-- ── Visor ── -->
        <div class="flex min-h-0 flex-1 gap-4">
          <!-- Panel INFORMACIÓN -->
          <aside
            class="glass hidden w-72 shrink-0 flex-col overflow-y-auto rounded-2xl p-4 shadow-[var(--shadow-sm)] md:flex"
          >
            <p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Información
            </p>

            <p class="mt-4 text-[11px] font-medium text-muted-foreground">De</p>
            @if (eml.from; as f) {
              <p class="text-sm font-medium text-foreground">{{ f.name }}</p>
              <p class="break-words text-xs text-muted-foreground">{{ f.address }}</p>
            } @else {
              <p class="text-sm text-muted-foreground">—</p>
            }

            <p class="mt-4 text-[11px] font-medium text-muted-foreground">Para</p>
            @for (t of eml.to; track t.address) {
              <p class="break-words text-xs text-foreground">{{ t.address }}</p>
            } @empty {
              <p class="text-sm text-muted-foreground">—</p>
            }

            @if (eml.cc.length) {
              <p class="mt-4 text-[11px] font-medium text-muted-foreground">CC</p>
              @for (c of eml.cc; track c.address) {
                <p class="break-words text-xs text-foreground">{{ c.address }}</p>
              }
            }

            <p class="mt-4 text-[11px] font-medium text-muted-foreground">Fecha</p>
            <p class="text-sm text-foreground">{{ fechaLarga(eml.date) }}</p>

            <p class="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              Adjuntos
              <span class="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                {{ eml.attachments.length }}
              </span>
            </p>
            @for (a of eml.attachments; track a.id) {
              <button
                type="button"
                (click)="verAdjunto(a)"
                class="mt-1 flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-accent"
              >
                <lucide-icon [name]="iconoAdjunto(a)" [size]="15" class="shrink-0 text-primary" />
                <span class="min-w-0 flex-1 truncate text-xs text-foreground">{{ a.filename }}</span>
                <span class="shrink-0 text-[10px] text-muted-foreground">{{ formatBytes(a.sizeBytes) }}</span>
              </button>
            } @empty {
              <p class="mt-1 text-xs text-muted-foreground">Sin adjuntos</p>
            }

            <button
              type="button"
              (click)="volverBandeja()"
              class="alma-btn alma-btn-outline mt-auto h-9 rounded-xl text-xs"
            >
              <lucide-icon name="arrow-left" [size]="15" />
              Volver a la bandeja
            </button>
          </aside>

          <!-- Área principal -->
          <section class="glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-sm)]">
            <header class="shrink-0 border-b border-border/60 px-5 pb-3 pt-4">
              <h1 class="truncate text-lg font-bold text-foreground" [title]="eml.subject">
                {{ eml.subject }}
              </h1>
              <div class="mt-3 flex flex-wrap items-center gap-2">
                @for (m of modos; track m.id) {
                  <button
                    type="button"
                    (click)="modo.set(m.id)"
                    class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                    [class]="
                      modo() === m.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    "
                  >
                    <lucide-icon [name]="m.icon" [size]="16" />
                    {{ m.label }}
                  </button>
                }
              </div>
            </header>

            <div class="min-h-0 flex-1">
              @switch (modo()) {
                @case ('correo') {
                  <div class="flex h-full flex-col">
                    @if (eml.hasRemoteContent && !cargarRemoto()) {
                      <div
                        class="flex flex-wrap items-center gap-2 border-b border-border/60 bg-[var(--surface-sunken)] px-4 py-2 text-xs text-muted-foreground"
                      >
                        <lucide-icon name="shield-alert" [size]="15" class="text-primary" />
                        <span class="flex-1">Se bloqueó contenido remoto (imágenes externas y rastreo).</span>
                        <button
                          type="button"
                          (click)="cargarRemoto.set(true)"
                          class="alma-btn alma-btn-outline h-7 rounded-lg text-xs"
                        >
                          Cargar imágenes
                        </button>
                      </div>
                    }
                    @if (eml.html) {
                      <alma-email-frame class="min-h-0 flex-1" [html]="eml.html" [loadRemote]="cargarRemoto()" />
                    } @else {
                      <pre
                        class="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words bg-white p-5 text-sm leading-relaxed text-[#111]"
                      >{{ eml.text || 'Este correo no tiene cuerpo.' }}</pre>
                    }
                  </div>
                }
                @case ('adjuntos') {
                  @if (adjuntoActivo(); as a) {
                    <alma-attachment-preview class="h-full" [attachment]="a" />
                  } @else {
                    <div class="flex h-full flex-col items-center justify-center gap-2 text-center">
                      <lucide-icon name="paperclip" [size]="28" class="text-muted-foreground/50" />
                      <p class="text-sm text-muted-foreground">Este correo no tiene adjuntos.</p>
                    </div>
                  }
                }
                @case ('detalles') {
                  <div class="h-full overflow-auto p-5">
                    <div class="mb-4 grid gap-3 sm:grid-cols-2">
                      <div class="rounded-lg border border-border/60 p-3">
                        <p class="text-[10px] uppercase tracking-wider text-muted-foreground">Message-ID</p>
                        <p class="break-words text-xs text-foreground">{{ eml.messageId || '—' }}</p>
                      </div>
                      <div class="rounded-lg border border-border/60 p-3">
                        <p class="text-[10px] uppercase tracking-wider text-muted-foreground">Tamaño del archivo</p>
                        <p class="text-xs text-foreground">{{ formatBytes(eml.sizeBytes) }}</p>
                      </div>
                    </div>
                    <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Encabezados ({{ eml.headers.length }})
                    </p>
                    <div class="overflow-hidden rounded-lg border border-border/60">
                      <table class="w-full text-xs">
                        <tbody>
                          @for (h of eml.headers; track $index) {
                            <tr class="border-b border-border/40 align-top last:border-0">
                              <td class="w-48 whitespace-nowrap px-3 py-1.5 font-mono font-medium text-muted-foreground">
                                {{ h.key }}
                              </td>
                              <td class="break-all px-3 py-1.5 font-mono text-foreground">{{ h.value }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                }
              }
            </div>
          </section>
        </div>
      } @else {
        <!-- ── Bandeja (mock del storage) ── -->
        @if (error()) {
          <p class="flex shrink-0 items-center gap-1.5 text-xs text-destructive">
            <lucide-icon name="alert-triangle" [size]="14" />
            {{ error() }}
          </p>
        }
        <alma-bandeja-comunicaciones
          class="min-h-0 flex-1"
          [comunicaciones]="comunicaciones"
          [abriendoId]="abriendoId()"
          (abrir)="abrir($event)"
        />
      }
    </div>
  `,
})
export class VisorComunicacionesPageComponent {
  private readonly eml = inject(EmlService);

  protected readonly comunicaciones = COMUNICACIONES_MOCK;
  protected readonly parsed = signal<ParsedEml | null>(null);
  protected readonly abriendoId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly modo = signal<Modo>('correo');
  protected readonly cargarRemoto = signal(false);
  private readonly adjuntoSel = signal<EmlAttachment | null>(null);

  protected readonly adjuntoActivo = computed(
    () => this.adjuntoSel() ?? this.parsed()?.attachments[0] ?? null,
  );

  protected readonly modos: { id: Modo; label: string; icon: string }[] = [
    { id: 'correo', label: 'Vista correo', icon: 'mail' },
    { id: 'adjuntos', label: 'Adjuntos', icon: 'paperclip' },
    { id: 'detalles', label: 'Detalles técnicos', icon: 'sliders-horizontal' },
  ];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.eml.revoke(this.parsed()));
  }

  protected async abrir(c: ComunicacionRef): Promise<void> {
    if (this.abriendoId()) return;
    this.error.set(null);
    this.abriendoId.set(c.id);
    try {
      const resp = await fetch(c.archivo);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buffer = await resp.arrayBuffer();
      const nuevo = await this.eml.parse(buffer);
      this.eml.revoke(this.parsed());
      this.parsed.set(nuevo);
      this.adjuntoSel.set(null);
      this.modo.set('correo');
      this.cargarRemoto.set(false);
    } catch {
      this.error.set('No se pudo abrir la comunicación. Intenta de nuevo.');
    } finally {
      this.abriendoId.set(null);
    }
  }

  protected volverBandeja(): void {
    this.eml.revoke(this.parsed());
    this.parsed.set(null);
    this.adjuntoSel.set(null);
    this.modo.set('correo');
    this.cargarRemoto.set(false);
  }

  protected verAdjunto(a: EmlAttachment): void {
    this.adjuntoSel.set(a);
    this.modo.set('adjuntos');
  }

  protected formatBytes(n: number): string {
    return this.eml.formatBytes(n);
  }

  protected fechaLarga(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  }

  protected iconoAdjunto(a: EmlAttachment): string {
    switch (a.kind) {
      case 'pdf':
        return 'file-text';
      case 'image':
        return 'eye';
      case 'text':
        return 'scroll-text';
      default:
        return 'paperclip';
    }
  }
}
