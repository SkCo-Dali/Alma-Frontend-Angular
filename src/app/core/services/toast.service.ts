// Avisos flotantes (equivalente al hook use-toast del front React): cola de
// mensajes con auto-cierre. El host <alma-toasts> los pinta en el shell.

import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: 'default' | 'destructive';
}

const DURACION_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(title: string, description?: string, variant: Toast['variant'] = 'default'): void {
    const id = ++this.seq;
    this.toasts.update((t) => [...t, { id, title, description, variant }]);
    setTimeout(() => this.dismiss(id), DURACION_MS);
  }

  error(title: string, description?: string): void {
    this.show(title, description, 'destructive');
  }

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
