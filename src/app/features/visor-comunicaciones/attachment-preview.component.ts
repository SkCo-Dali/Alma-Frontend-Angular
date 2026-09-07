// Previsualización de un adjunto: PDF (iframe), imagen (img), texto (pre) o,
// para el resto, un estado con descarga. La descarga siempre está disponible.

import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { EmlAttachment } from './eml.types';
import { EmlService } from './eml.service';

@Component({
  selector: 'alma-attachment-preview',
  imports: [LucideAngularModule],
  template: `
    @let a = attachment();
    <div class="flex h-full flex-col">
      <!-- Barra del adjunto -->
      <div class="flex items-center gap-3 border-b border-border/60 px-4 py-2.5">
        <lucide-icon [name]="icono()" [size]="18" class="shrink-0 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-foreground">{{ a.filename }}</p>
          <p class="text-xs text-muted-foreground">
            {{ a.mimeType }} · {{ eml.formatBytes(a.sizeBytes) }}
          </p>
        </div>
        <a
          [href]="a.url"
          [download]="a.filename"
          class="alma-btn alma-btn-outline h-8 shrink-0 rounded-lg text-xs"
        >
          <lucide-icon name="download" [size]="15" />
          Descargar
        </a>
      </div>

      <!-- Cuerpo de la previsualización -->
      <div class="min-h-0 flex-1 overflow-auto bg-[var(--surface-sunken)]">
        @switch (a.kind) {
          @case ('pdf') {
            <iframe [src]="safeUrl()" title="PDF" class="h-full w-full border-0"></iframe>
          }
          @case ('image') {
            <div class="flex h-full items-center justify-center p-4">
              <img [src]="a.url" [alt]="a.filename" class="max-h-full max-w-full rounded-lg shadow-[var(--shadow-md)]" />
            </div>
          }
          @case ('text') {
            <pre class="whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-foreground">{{ texto() }}</pre>
          }
          @default {
            <div class="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <lucide-icon name="file-text" [size]="28" />
              </span>
              <p class="text-sm text-muted-foreground">
                No hay vista previa para este tipo de archivo.
              </p>
              <a
                [href]="a.url"
                [download]="a.filename"
                class="alma-btn alma-btn-primary h-9 rounded-lg text-sm"
              >
                <lucide-icon name="download" [size]="16" />
                Descargar {{ a.filename }}
              </a>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `:host { display: block; height: 100%; }`,
})
export class AttachmentPreviewComponent {
  readonly attachment = input.required<EmlAttachment>();

  protected readonly eml = inject(EmlService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly safeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.attachment().url),
  );
  protected readonly texto = signal('');

  protected readonly icono = computed(() => {
    switch (this.attachment().kind) {
      case 'pdf':
        return 'file-text';
      case 'image':
        return 'eye';
      case 'text':
        return 'scroll-text';
      default:
        return 'paperclip';
    }
  });

  constructor() {
    // Carga el contenido de los adjuntos de texto para el <pre>.
    effect(() => {
      const a = this.attachment();
      if (a.kind !== 'text') return;
      fetch(a.url)
        .then((r) => r.text())
        .then((t) => this.texto.set(t))
        .catch(() => this.texto.set('No se pudo leer el contenido.'));
    });
  }
}
