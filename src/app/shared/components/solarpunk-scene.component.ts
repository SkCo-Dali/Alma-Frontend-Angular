// Escena "solarpunk" — el wallpaper ilustrado por defecto de ALMA: una
// ciudad-jardín luminosa (torres blancas con terrazas verdes y paneles solares,
// un árbol enorme, viñas colgantes y follaje en primer plano desenfocado, como
// si se mirara desde un interior con un arco orgánico).
//
// Todo es SVG + CSS: sin imágenes externas, escala a cualquier viewport
// (preserveAspectRatio slice) y cambia a su variante de ATARDECER en modo
// oscuro vía variables (--spk-*): cielo profundo, sol ámbar bajo y ventanas
// encendidas. Las motas de luz flotan salvo con prefers-reduced-motion.

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'alma-solarpunk-scene',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="spk-sky" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" style="stop-color: var(--spk-sky-a)" />
          <stop offset="0.45" style="stop-color: var(--spk-sky-b)" />
          <stop offset="1" style="stop-color: var(--spk-sky-c)" />
        </linearGradient>
        <radialGradient id="spk-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" style="stop-color: var(--spk-sun)" stop-opacity="0.95" />
          <stop offset="0.55" style="stop-color: var(--spk-sun)" stop-opacity="0.35" />
          <stop offset="1" style="stop-color: var(--spk-sun)" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="spk-tower" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color: var(--spk-tower-hi)" />
          <stop offset="1" style="stop-color: var(--spk-tower-lo)" />
        </linearGradient>
        <linearGradient id="spk-panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style="stop-color: var(--spk-panel-hi)" />
          <stop offset="1" style="stop-color: var(--spk-panel-lo)" />
        </linearGradient>
        <filter id="spk-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="spk-mid" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="spk-heavy" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="11" />
        </filter>
        <filter id="spk-arch" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>

      <!-- Cielo y sol -->
      <rect width="1600" height="900" fill="url(#spk-sky)" />
      <circle cx="600" cy="170" r="330" fill="url(#spk-sun)" />
      <circle cx="600" cy="170" r="88" fill="url(#spk-sun)" />
      <!-- Haces de luz -->
      <g style="fill: var(--spk-sun)" opacity="0.10" filter="url(#spk-mid)">
        <polygon points="560,60 720,60 1130,900 830,900" />
        <polygon points="380,40 470,40 180,900 20,900" />
      </g>

      <!-- Skyline lejano (desenfocado, casi silueta) -->
      <g style="fill: var(--spk-far)" opacity="0.5" filter="url(#spk-mid)">
        <rect x="880" y="330" width="52" height="380" rx="16" />
        <rect x="950" y="290" width="44" height="420" rx="14" />
        <rect x="1010" y="360" width="40" height="350" rx="13" />
        <rect x="70" y="330" width="46" height="370" rx="15" />
        <rect x="10" y="380" width="40" height="330" rx="13" />
        <rect x="470" y="380" width="42" height="320" rx="14" />
        <rect x="530" y="420" width="36" height="280" rx="12" />
      </g>

      <!-- Torres de la derecha: blancas con terrazas verdes y paneles solares -->
      <g filter="url(#spk-soft)">
        <g>
          <rect x="1080" y="300" width="72" height="420" rx="20" fill="url(#spk-tower)" />
          <rect x="1166" y="210" width="92" height="510" rx="24" fill="url(#spk-tower)" />
          <rect x="1272" y="332" width="76" height="390" rx="20" fill="url(#spk-tower)" />
          <rect x="1362" y="160" width="98" height="560" rx="26" fill="url(#spk-tower)" />
          <rect x="1474" y="272" width="82" height="450" rx="21" fill="url(#spk-tower)" />
          <rect x="1556" y="352" width="60" height="370" rx="16" fill="url(#spk-tower)" />
        </g>
        <!-- Pisos (líneas suaves) -->
        <g style="stroke: var(--spk-floorline)" stroke-width="2" opacity="0.55">
          <path d="M1170 260h84M1170 306h84M1170 352h84M1170 398h84M1170 444h84M1170 490h84M1170 536h84M1170 582h84" />
          <path d="M1366 212h90M1366 258h90M1366 304h90M1366 350h90M1366 396h90M1366 442h90M1366 488h90M1366 534h90M1366 580h90" />
          <path d="M1084 348h64M1084 394h64M1084 440h64M1084 486h64M1084 532h64" />
          <path d="M1478 320h74M1478 366h74M1478 412h74M1478 458h74M1478 504h74" />
        </g>
        <!-- Ventanas (se encienden al anochecer) -->
        <g style="fill: var(--spk-window)">
          <rect x="1180" y="272" width="14" height="20" rx="3" /><rect x="1204" y="272" width="14" height="20" rx="3" /><rect x="1228" y="272" width="14" height="20" rx="3" />
          <rect x="1180" y="364" width="14" height="20" rx="3" /><rect x="1228" y="364" width="14" height="20" rx="3" />
          <rect x="1180" y="456" width="14" height="20" rx="3" /><rect x="1204" y="456" width="14" height="20" rx="3" />
          <rect x="1376" y="224" width="15" height="20" rx="3" /><rect x="1400" y="224" width="15" height="20" rx="3" /><rect x="1424" y="224" width="15" height="20" rx="3" />
          <rect x="1376" y="316" width="15" height="20" rx="3" /><rect x="1424" y="316" width="15" height="20" rx="3" />
          <rect x="1376" y="408" width="15" height="20" rx="3" /><rect x="1400" y="408" width="15" height="20" rx="3" />
          <rect x="1092" y="360" width="13" height="18" rx="3" /><rect x="1116" y="360" width="13" height="18" rx="3" />
          <rect x="1486" y="332" width="13" height="18" rx="3" /><rect x="1510" y="332" width="13" height="18" rx="3" />
        </g>
        <!-- Terrazas verdes que desbordan las fachadas -->
        <g style="fill: var(--spk-leaf-2)">
          <ellipse cx="1080" cy="356" rx="22" ry="11" /><ellipse cx="1152" cy="448" rx="20" ry="10" /><ellipse cx="1080" cy="540" rx="24" ry="12" />
          <ellipse cx="1166" cy="312" rx="24" ry="12" /><ellipse cx="1258" cy="404" rx="22" ry="11" /><ellipse cx="1166" cy="496" rx="26" ry="12" /><ellipse cx="1258" cy="588" rx="22" ry="11" />
          <ellipse cx="1272" cy="386" rx="20" ry="10" /><ellipse cx="1348" cy="478" rx="22" ry="11" />
          <ellipse cx="1362" cy="264" rx="24" ry="12" /><ellipse cx="1460" cy="356" rx="24" ry="12" /><ellipse cx="1362" cy="448" rx="26" ry="13" /><ellipse cx="1460" cy="540" rx="24" ry="12" />
          <ellipse cx="1474" cy="326" rx="20" ry="10" /><ellipse cx="1556" cy="418" rx="22" ry="11" />
        </g>
        <!-- Jardines de azotea -->
        <g style="fill: var(--spk-leaf-1)">
          <ellipse cx="1116" cy="300" rx="34" ry="13" />
          <ellipse cx="1212" cy="210" rx="42" ry="15" />
          <ellipse cx="1310" cy="332" rx="36" ry="13" />
          <ellipse cx="1515" cy="272" rx="38" ry="14" />
        </g>
        <!-- Paneles solares en azoteas -->
        <g>
          <g transform="translate(1382 148) skewX(-16)">
            <rect width="26" height="16" rx="2" fill="url(#spk-panel)" /><rect x="30" width="26" height="16" rx="2" fill="url(#spk-panel)" /><rect x="60" width="26" height="16" rx="2" fill="url(#spk-panel)" />
          </g>
          <g transform="translate(1188 196) skewX(-16)">
            <rect width="24" height="15" rx="2" fill="url(#spk-panel)" /><rect x="28" width="24" height="15" rx="2" fill="url(#spk-panel)" />
          </g>
          <g transform="translate(1492 258) skewX(-16)">
            <rect width="22" height="14" rx="2" fill="url(#spk-panel)" /><rect x="26" width="22" height="14" rx="2" fill="url(#spk-panel)" />
          </g>
        </g>
        <!-- Puente-jardín entre torres -->
        <rect x="1186" y="560" width="220" height="13" rx="6.5" fill="url(#spk-tower)" />
        <g style="fill: var(--spk-leaf-2)">
          <ellipse cx="1210" cy="558" rx="14" ry="7" /><ellipse cx="1250" cy="556" rx="16" ry="8" /><ellipse cx="1296" cy="558" rx="14" ry="7" /><ellipse cx="1340" cy="556" rx="16" ry="8" /><ellipse cx="1382" cy="558" rx="13" ry="7" />
        </g>
      </g>

      <!-- Izquierda: torres tras el gran árbol -->
      <g filter="url(#spk-soft)">
        <rect x="140" y="250" width="88" height="470" rx="22" fill="url(#spk-tower)" />
        <rect x="252" y="330" width="72" height="390" rx="19" fill="url(#spk-tower)" />
        <g style="stroke: var(--spk-floorline)" stroke-width="2" opacity="0.55">
          <path d="M144 300h80M144 346h80M144 392h80M144 438h80M144 484h80" />
        </g>
        <g style="fill: var(--spk-window)">
          <rect x="154" y="312" width="14" height="19" rx="3" /><rect x="178" y="312" width="14" height="19" rx="3" />
          <rect x="154" y="404" width="14" height="19" rx="3" /><rect x="202" y="404" width="14" height="19" rx="3" />
        </g>
        <g style="fill: var(--spk-leaf-2)">
          <ellipse cx="140" cy="360" rx="22" ry="11" /><ellipse cx="228" cy="452" rx="20" ry="10" /><ellipse cx="140" cy="544" rx="24" ry="12" />
        </g>
        <g transform="translate(158 240) skewX(-16)">
          <rect width="24" height="15" rx="2" fill="url(#spk-panel)" /><rect x="28" width="24" height="15" rx="2" fill="url(#spk-panel)" />
        </g>
        <!-- El gran árbol -->
        <path d="M298 720 C302 600 292 520 300 430 C304 480 316 560 314 720 Z" style="fill: var(--spk-trunk)" />
        <g style="fill: var(--spk-leaf-1)">
          <circle cx="238" cy="330" r="96" />
          <circle cx="352" cy="252" r="112" />
          <circle cx="434" cy="356" r="84" />
          <circle cx="318" cy="408" r="88" />
        </g>
        <g style="fill: var(--spk-leaf-hi)" opacity="0.75">
          <circle cx="300" cy="256" r="52" />
          <circle cx="404" cy="300" r="44" />
          <circle cx="252" cy="384" r="40" />
        </g>
      </g>

      <!-- Franja de vegetación media (tras las tarjetas) -->
      <g filter="url(#spk-mid)">
        <g style="fill: var(--spk-leaf-2)">
          <ellipse cx="120" cy="742" rx="200" ry="72" />
          <ellipse cx="420" cy="762" rx="240" ry="66" />
          <ellipse cx="800" cy="748" rx="270" ry="74" />
          <ellipse cx="1180" cy="764" rx="250" ry="68" />
          <ellipse cx="1500" cy="746" rx="220" ry="76" />
        </g>
        <g style="fill: var(--spk-leaf-1)" opacity="0.85">
          <ellipse cx="260" cy="768" rx="150" ry="52" />
          <ellipse cx="640" cy="780" rx="180" ry="56" />
          <ellipse cx="1020" cy="772" rx="170" ry="52" />
          <ellipse cx="1390" cy="782" rx="160" ry="58" />
        </g>
      </g>

      <!-- Viñas colgantes desde el borde superior -->
      <g filter="url(#spk-soft)" style="stroke: var(--spk-vine)" stroke-width="3" fill="none" stroke-linecap="round">
        <path d="M270 0 q-8 60 6 118 q10 44 -4 86" />
        <path d="M330 0 q10 48 -2 96 q-8 38 6 70" />
        <path d="M1050 0 q-6 52 8 104 q8 40 -6 78" />
        <path d="M1120 0 q8 44 -4 88 q-8 36 4 66" />
        <path d="M760 0 q-6 38 4 74 q6 30 -4 56" />
      </g>
      <g filter="url(#spk-soft)" style="fill: var(--spk-vine)">
        <ellipse cx="262" cy="64" rx="9" ry="5" transform="rotate(-36 262 64)" /><ellipse cx="282" cy="116" rx="10" ry="5.5" transform="rotate(28 282 116)" /><ellipse cx="268" cy="172" rx="9" ry="5" transform="rotate(-30 268 172)" />
        <ellipse cx="338" cy="52" rx="9" ry="5" transform="rotate(30 338 52)" /><ellipse cx="322" cy="112" rx="9" ry="5" transform="rotate(-26 322 112)" /><ellipse cx="336" cy="152" rx="8" ry="4.5" transform="rotate(24 336 152)" />
        <ellipse cx="1044" cy="58" rx="9" ry="5" transform="rotate(-32 1044 58)" /><ellipse cx="1064" cy="120" rx="10" ry="5.5" transform="rotate(26 1064 120)" /><ellipse cx="1050" cy="166" rx="8" ry="4.5" transform="rotate(-24 1050 166)" />
        <ellipse cx="1128" cy="48" rx="9" ry="5" transform="rotate(28 1128 48)" /><ellipse cx="1112" cy="104" rx="9" ry="5" transform="rotate(-26 1112 104)" />
        <ellipse cx="754" cy="42" rx="8" ry="4.5" transform="rotate(-30 754 42)" /><ellipse cx="770" cy="92" rx="8" ry="4.5" transform="rotate(26 770 92)" />
      </g>

      <!-- Pájaros -->
      <g style="stroke: var(--spk-bird)" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.6">
        <path d="M700 210 q9 -9 18 0 q9 -9 18 0" />
        <path d="M770 176 q7 -7 14 0 q7 -7 14 0" />
      </g>

      <!-- Arco orgánico blanco (marco interior, muy difuso) -->
      <g style="fill: var(--spk-arch)" filter="url(#spk-arch)">
        <path d="M-60 -80 L360 -80 C170 30 60 160 10 330 L-60 330 Z" opacity="0.85" />
        <path d="M1240 -80 L1660 -80 L1660 330 L1590 330 C1540 160 1430 30 1240 -80 Z" opacity="0.85" />
        <rect x="-60" y="-70" width="1720" height="80" opacity="0.7" />
      </g>

      <!-- Follaje en primer plano (bokeh, fuera de foco) -->
      <g filter="url(#spk-heavy)">
        <g style="fill: var(--spk-leaf-fg)">
          <ellipse cx="60" cy="850" rx="230" ry="150" />
          <ellipse cx="240" cy="920" rx="200" ry="120" />
          <path d="M-20 620 C90 640 170 720 150 830 C60 800 -10 720 -20 620 Z" />
          <ellipse cx="1560" cy="860" rx="250" ry="160" />
          <ellipse cx="1400" cy="940" rx="210" ry="120" />
          <path d="M1620 560 C1500 590 1420 680 1450 800 C1550 760 1620 670 1620 560 Z" />
        </g>
        <g style="fill: var(--spk-leaf-fg-hi)" opacity="0.8">
          <ellipse cx="130" cy="800" rx="90" ry="52" transform="rotate(-24 130 800)" />
          <ellipse cx="1480" cy="790" rx="96" ry="54" transform="rotate(22 1480 790)" />
        </g>
      </g>
    </svg>

    <!-- Motas de luz flotando (polen / partículas al sol) -->
    <span class="spk-mote" style="left: 24%; top: 58%; animation-delay: 0s"></span>
    <span class="spk-mote" style="left: 33%; top: 40%; animation-delay: 2.2s"></span>
    <span class="spk-mote" style="left: 46%; top: 64%; animation-delay: 4.5s"></span>
    <span class="spk-mote" style="left: 58%; top: 36%; animation-delay: 1.4s"></span>
    <span class="spk-mote" style="left: 67%; top: 56%; animation-delay: 3.4s"></span>
    <span class="spk-mote" style="left: 78%; top: 44%; animation-delay: 5.6s"></span>
    <span class="spk-mote" style="left: 14%; top: 34%; animation-delay: 6.4s"></span>
  `,
  styles: `
    :host {
      /* Día: luz dorada de media mañana */
      --spk-sky-a: #fdf5dc;
      --spk-sky-b: #e9f5e0;
      --spk-sky-c: #cfead6;
      --spk-sun: #ffe9b0;
      --spk-far: #b7d8c0;
      --spk-tower-hi: #fbfdf8;
      --spk-tower-lo: #d7e8d6;
      --spk-floorline: rgba(255, 255, 255, 0.75);
      --spk-window: rgba(173, 216, 200, 0.55);
      --spk-panel-hi: #7fc4e8;
      --spk-panel-lo: #2d6a92;
      --spk-leaf-1: #5cae74;
      --spk-leaf-2: #79c48a;
      --spk-leaf-hi: #9ad8a4;
      --spk-trunk: #8a6f52;
      --spk-vine: #4f9a63;
      --spk-bird: #5c7a68;
      --spk-arch: #ffffff;
      --spk-leaf-fg: #2e7048;
      --spk-leaf-fg-hi: #47935f;
      --spk-mote: rgba(255, 240, 190, 0.9);

      position: fixed;
      inset: 0;
      z-index: -1;
      display: block;
      pointer-events: none;
      overflow: hidden;
    }

    /* Anochecer: cielo profundo, sol ámbar bajo, ventanas encendidas */
    :host-context(html.dark) {
      --spk-sky-a: #123236;
      --spk-sky-b: #0f2a30;
      --spk-sky-c: #0b1e26;
      --spk-sun: #ffb45e;
      --spk-far: #16333a;
      --spk-tower-hi: #2a4a4c;
      --spk-tower-lo: #16302f;
      --spk-floorline: rgba(255, 255, 255, 0.12);
      --spk-window: rgba(255, 199, 110, 0.85);
      --spk-panel-hi: #35586e;
      --spk-panel-lo: #14293a;
      --spk-leaf-1: #23573c;
      --spk-leaf-2: #2e6b48;
      --spk-leaf-hi: #3c7f55;
      --spk-trunk: #3f3428;
      --spk-vine: #275c3d;
      --spk-bird: #244038;
      --spk-arch: #0d2027;
      --spk-leaf-fg: #0e2c1d;
      --spk-leaf-fg-hi: #1a4229;
      --spk-mote: rgba(255, 205, 130, 0.8);
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .spk-mote {
      position: absolute;
      width: 5px;
      height: 5px;
      border-radius: 999px;
      background: var(--spk-mote);
      box-shadow: 0 0 10px 2px var(--spk-mote);
      animation: spk-mote 12s ease-in-out infinite;
      opacity: 0;
    }
    @keyframes spk-mote {
      0% { transform: translate(0, 0) scale(0.7); opacity: 0; }
      12% { opacity: 0.9; }
      50% { transform: translate(14px, -46px) scale(1); opacity: 0.65; }
      88% { opacity: 0.15; }
      100% { transform: translate(-8px, -92px) scale(0.6); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .spk-mote { animation: none; opacity: 0.5; }
    }
  `,
})
export class SolarpunkSceneComponent {}
