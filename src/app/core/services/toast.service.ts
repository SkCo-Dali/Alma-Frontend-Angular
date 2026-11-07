// Avisos breves. Desde la isla de Nova se pintan en el centro del header
// (ver IslaService); esta clase conserva la API de siempre para que las Apps
// sigan llamando toast.show(...) / toast.error(...) sin cambios.

import { Injectable, inject } from '@angular/core';
import { IslaService } from './isla.service';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: 'default' | 'destructive';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly isla = inject(IslaService);

  show(title: string, description?: string, variant: Toast['variant'] = 'default'): void {
    this.isla.avisar(title, description, variant === 'destructive' ? 'error' : 'ok');
  }

  error(title: string, description?: string): void {
    this.show(title, description, 'destructive');
  }
}
