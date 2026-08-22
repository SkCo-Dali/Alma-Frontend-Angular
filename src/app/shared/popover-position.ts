// Coloca un panel flotante respecto a su disparador, como el Popover de Radix
// con align="start": debajo y alineado a la izquierda del botón, volteando
// arriba si no cabe y corriéndose para no salirse de la pantalla.
//
// Se posiciona midiendo el panel YA renderizado (en <body>, vía almaPortal), no
// con alturas estimadas: así el panel nunca queda desplazado ni cortado.

export function colocarPanel(
  panel: HTMLElement,
  anchor: DOMRect,
  align: 'start' | 'end' = 'start',
): void {
  const r = panel.getBoundingClientRect();
  const margen = 8;

  let left = align === 'end' ? anchor.right - r.width : anchor.left;
  left = Math.min(Math.max(margen, left), window.innerWidth - r.width - margen);

  let top = anchor.bottom + 4;
  if (top + r.height > window.innerHeight - margen) {
    const arriba = anchor.top - r.height - 4;
    top = arriba >= margen ? arriba : Math.max(margen, window.innerHeight - r.height - margen);
  }

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}
