// Mapeo compartido activo/inactivo → severity de `sk-tag` (@skandia/ui).
// Antes retipeado por separado en auditoria-accesos y usuarios-accesos como
// clases Tailwind (`bg-primary/10 text-primary` / `bg-amber-500/10 ...` o
// `bg-muted text-muted-foreground`) — un solo punto de verdad ahora.
export type SkTagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export function activoSeverity(activo: boolean): SkTagSeverity {
  return activo ? 'success' : 'secondary';
}
