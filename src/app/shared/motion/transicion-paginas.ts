// Transición entre páginas de Nova (View Transitions del router).
//
// Solo se anima el contenido (<main>, view-transition-name: nova-pagina); el
// header y el Dock quedan quietos. Las curvas viven en styles.css y usan el
// spring «smooth». Se salta cuando:
//   - el usuario pidió reducir movimiento,
//   - solo cambian los query params o el fragmento (filtros, paginación…):
//     la página es la misma y animarla en cada filtro cansa.

import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

function ruta(snap: ActivatedRouteSnapshot | null): string {
  const partes: string[] = [];
  for (let s = snap; s; s = s.firstChild) {
    for (const u of s.url) partes.push(u.path);
  }
  return partes.join('/');
}

export function alCrearTransicionDePagina({ transition, from, to }: ViewTransitionInfo): void {
  const reducido =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducido || ruta(from) === ruta(to)) {
    transition.skipTransition();
    return;
  }
  // Los view-transition-name (nova-pagina, nova-dock) solo existen mientras
  // dura la transición: un nombre permanente vuelve a <main> y al Dock raíz de
  // backdrop-filter y los vidrios de adentro dejarían de desenfocar el fondo.
  // La captura de la página vieja ocurre en el siguiente frame, así que poner
  // la clase aquí (sincrónico) llega a tiempo.
  const html = document.documentElement;
  html.classList.add('nova-vt');
  const quitar = () => html.classList.remove('nova-vt');
  void transition.finished.finally(quitar);
  // Red de seguridad: si la transición no avanza (pestaña en segundo plano,
  // navegador sin frames), que la clase no se quede pegada.
  setTimeout(quitar, 2500);
}
