// Tooltip de Alma. Port del Tooltip de Alma (components/ui/tooltip.tsx: Radix +
// shadcn): burbuja verde con texto blanco, esquinas suaves, aparece arriba del
// elemento sin retardo y se monta en <body> (Radix usa Portal) para que ningún
// contenedor con overflow o filtro la recorte ni le herede estilos.
//
// Reemplaza los `title=""` nativos que se habían usado durante la migración: el
// tooltip del navegador tiene otra tipografía, otro color y otro retardo.

import {
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  input,
} from '@angular/core';

@Directive({
  selector: '[almaTooltip]',
  host: {
    '(mouseenter)': 'mostrar()',
    '(mouseleave)': 'ocultar()',
    '(focusin)': 'mostrar()',
    '(focusout)': 'ocultar()',
    '(click)': 'ocultar()',
  },
})
export class TooltipDirective implements OnDestroy {
  readonly almaTooltip = input('');
  /** Lado preferido, igual que el `side` de Radix. */
  readonly almaTooltipSide = input<'top' | 'bottom'>('top');
  /** Ancho máximo de la burbuja (Radix lo pasa por className). */
  readonly almaTooltipMaxWidth = input('20rem');

  private readonly host = inject(ElementRef<HTMLElement>);
  private burbuja: HTMLElement | null = null;

  protected mostrar(): void {
    const texto = this.almaTooltip();
    if (!texto || this.burbuja) return;

    const el = document.createElement('div');
    el.textContent = texto;
    el.setAttribute('role', 'tooltip');
    el.className =
      'fixed z-[200] overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md';
    el.style.maxWidth = this.almaTooltipMaxWidth();
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);

    // Centrado arriba del elemento, con 4 px de aire (sideOffset de Radix).
    const r = this.host.nativeElement.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, r.left + r.width / 2 - b.width / 2),
      window.innerWidth - b.width - 8,
    );
    const arriba = r.top - b.height - 4;
    const abajo = r.bottom + 4;
    const cabeArriba = arriba >= 8;
    const cabeAbajo = abajo + b.height <= window.innerHeight - 8;
    el.style.left = `${left}px`;
    el.style.top = `${
      this.almaTooltipSide() === 'bottom'
        ? (cabeAbajo || !cabeArriba ? abajo : arriba)
        : (cabeArriba || !cabeAbajo ? arriba : abajo)
    }px`;

    this.burbuja = el;
  }

  protected ocultar(): void {
    this.burbuja?.remove();
    this.burbuja = null;
  }

  ngOnDestroy(): void {
    this.ocultar();
  }
}
