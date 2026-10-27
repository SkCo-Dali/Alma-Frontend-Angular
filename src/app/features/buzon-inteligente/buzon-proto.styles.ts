// Estilos del prototipo validado del Buzón Inteligente 2.0 (contexto-recaudos-pac/
// buzon-inteligente-v2.html), para que las pantallas de Alma se vean igual que el
// artefacto que aprobó el área. Usa los tokens de Alma (--card, --primary, --border…)
// y agrega los semánticos del prototipo (ámbar, esmeralda, rosa, violeta, cielo).
// Se incluye en `styles` de cada componente: con la encapsulación de Angular las
// clases solo aplican dentro de ese componente.

export const BUZON_PROTO_CSS = `
:host {
  --sunken: oklch(0.62 0.012 286 / 10%);
  --primary-ink: oklch(0.5 0.15 150);
  --primary-fg: var(--primary-foreground);
  --amber: oklch(0.55 0.13 65); --amber-bg: oklch(0.77 0.16 75 / 18%);
  --emerald: oklch(0.52 0.13 155); --emerald-bg: oklch(0.7 0.17 155 / 16%);
  --rose: oklch(0.55 0.2 15); --rose-bg: oklch(0.64 0.21 15 / 14%);
  --slate: oklch(0.45 0.02 260); --slate-bg: oklch(0.55 0.02 260 / 14%);
  --violet: oklch(0.52 0.2 295); --violet-bg: oklch(0.6 0.2 295 / 14%);
  --sky: oklch(0.52 0.13 235); --sky-bg: oklch(0.65 0.13 235 / 15%);
  --code-bg: oklch(0.21 0.006 286); --code-fg: oklch(0.93 0.004 286);
  --solid: oklch(0.99 0.002 286);
  --mono: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  display: block;
}
:host-context(.dark) {
  --sunken: oklch(0.75 0.01 286 / 10%);
  --primary-ink: oklch(0.8 0.17 150);
  --amber: oklch(0.82 0.13 80); --amber-bg: oklch(0.78 0.15 80 / 18%);
  --emerald: oklch(0.8 0.14 155); --emerald-bg: oklch(0.7 0.15 155 / 18%);
  --rose: oklch(0.78 0.14 15); --rose-bg: oklch(0.68 0.19 15 / 18%);
  --slate: oklch(0.82 0.02 260); --slate-bg: oklch(0.7 0.02 260 / 18%);
  --violet: oklch(0.78 0.14 295); --violet-bg: oklch(0.7 0.15 295 / 18%);
  --sky: oklch(0.8 0.11 235); --sky-bg: oklch(0.7 0.12 235 / 18%);
  --code-bg: oklch(0.17 0.004 286);
  --solid: oklch(0.27 0.006 286);
}
button, input, select, textarea { font: inherit; color: inherit; }
h2 { margin: 0; }
p { margin: 0; }
.muted { color: var(--muted-foreground); }
.xs { font-size: 0.75rem; } .xxs { font-size: 0.6875rem; } .sm { font-size: 0.875rem; }
.b { font-weight: 650; } .bb { font-weight: 700; }
.mono { font-family: var(--mono); }
.glass { background-color: color-mix(in srgb, var(--card) 74%, transparent); backdrop-filter: blur(16px) saturate(1.15); -webkit-backdrop-filter: blur(16px) saturate(1.15); border: 1px solid color-mix(in srgb, var(--border) 60%, transparent); box-shadow: var(--shadow-sm); }
.r-2xl { border-radius: 16px; }
.sunk { background: var(--sunken); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.between { justify-content: space-between; }
.stack { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; min-width: 0; }
.g2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 640px) { .g2 { grid-template-columns: minmax(0, 1fr); } }
.page { max-width: 1400px; margin: 0 auto; padding: 8px 16px 32px; display: grid; gap: 16px; }
.back { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border-radius: 12px; font-weight: 550; cursor: pointer; border: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.back:hover { color: var(--primary-ink); }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 12px; font-size: 0.875rem; font-weight: 550; cursor: pointer; border: 1px solid transparent; background: transparent; white-space: nowrap; }
.btn.sm { height: 32px; font-size: 0.75rem; border-radius: 10px; padding: 0 10px; }
.btn.primary { background: var(--primary); color: var(--primary-fg); }
.btn.primary:hover { background: var(--primary-hover); }
.btn.outline { border-color: var(--input); }
.btn.outline:hover, .btn.ghost:hover { background: var(--accent); }
.btn.ghost { width: 32px; height: 32px; padding: 0; border-radius: 8px; }
.btn.danger { color: var(--rose); }
.btn.danger:hover { background: var(--rose-bg); }
.btn[disabled] { opacity: 0.5; pointer-events: none; }
.input { display: flex; height: 36px; width: 100%; border-radius: 10px; border: 1px solid var(--input); background: transparent; padding: 4px 12px; font-size: 0.875rem; box-shadow: var(--shadow-sm); min-width: 0; }
.input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 2px var(--ring); }
.input.sm { height: 30px; font-size: 0.78rem; padding: 2px 8px; border-radius: 8px; }
select.input { appearance: none; -webkit-appearance: none; padding-right: 32px; cursor: pointer; background-image: linear-gradient(45deg, transparent 50%, var(--muted-foreground) 50%), linear-gradient(135deg, var(--muted-foreground) 50%, transparent 50%); background-position: calc(100% - 16px) 15px, calc(100% - 11px) 15px; background-size: 5px 5px; background-repeat: no-repeat; }
select.input option { background: var(--solid); color: var(--foreground); }
select.input.sm { padding-right: 28px; background-position: calc(100% - 14px) 12px, calc(100% - 9px) 12px; }
.label { font-size: 0.75rem; color: var(--muted-foreground); }
.fld { display: grid; gap: 6px; min-width: 0; align-content: start; }
.badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; font-weight: 550; white-space: nowrap; }
.b-amber { background: var(--amber-bg); color: var(--amber); } .b-emerald { background: var(--emerald-bg); color: var(--emerald); }
.b-rose { background: var(--rose-bg); color: var(--rose); } .b-slate { background: var(--slate-bg); color: var(--slate); }
.b-violet { background: var(--violet-bg); color: var(--violet); } .b-sky { background: var(--sky-bg); color: var(--sky); }
.chipo { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--border) 80%, transparent); padding: 1px 8px; font-size: 0.6875rem; background: var(--sunken); white-space: nowrap; }
.demo { display: inline-flex; align-items: center; gap: 5px; font-size: 0.7rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: var(--violet-bg); color: var(--violet); }
.pills { display: flex; gap: 4px; flex-wrap: wrap; }
.pills button { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; border-radius: 8px; padding: 6px 12px; font-size: 0.75rem; font-weight: 550; cursor: pointer; color: var(--muted-foreground); }
.pills button:hover { background: var(--accent); }
.pills button[aria-selected="true"] { background: color-mix(in srgb, var(--primary) 12%, transparent); color: var(--primary-ink); }
.chipbar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.chipbar button { display: inline-flex; align-items: center; gap: 6px; height: 32px; border-radius: 999px; padding: 0 12px; font-size: 0.75rem; font-weight: 550; cursor: pointer; border: 1px solid color-mix(in srgb, var(--border) 60%, transparent); }
.chipbar button[aria-pressed="true"] { background: var(--primary); color: var(--primary-fg); border-color: var(--primary); }
.chipbar .n { border-radius: 999px; padding: 0 6px; font-size: 0.625rem; background: var(--amber-bg); color: var(--amber); }
.chipbar button[aria-pressed="true"] .n { background: oklch(1 0 0 / 25%); color: inherit; }
.chipbar .sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }
table.t { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
table.t th { height: 40px; padding: 0 12px; text-align: left; font-weight: 550; color: var(--muted-foreground); border-bottom: 1px solid var(--border); white-space: nowrap; font-size: 0.8rem; }
table.t td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
table.t tr:last-child td { border-bottom: 0; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.scroll-x { overflow-x: auto; }
.note { display: flex; gap: 8px; align-items: flex-start; font-size: 0.78rem; padding: 8px 12px; border-radius: 10px; }
.err { color: var(--rose); font-size: 0.78rem; }
.search { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 12px; flex-wrap: nowrap; }
.search input { border: 0; background: transparent; outline: none; flex: 1; min-width: 0; font-size: .875rem; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.empty { flex: 1; display: grid; place-items: center; text-align: center; padding: 40px; }
.empty .ei { width: 64px; height: 64px; border-radius: 24px; display: grid; place-items: center; background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary-ink); margin: 0 auto 12px; }
.box { border-radius: 16px; padding: 16px; display: grid; gap: 8px; align-content: start; min-width: 0; }
.box.line { border: 1px solid color-mix(in srgb, var(--border) 80%, transparent); }
.cap { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-foreground); }
dl.kv { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px 16px; margin: 0; font-size: 0.78rem; }
dl.kv dt { font-family: var(--mono); color: var(--muted-foreground); }
dl.kv dd { margin: 0; font-weight: 550; overflow-wrap: anywhere; }
.stamp { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: var(--muted-foreground); }
.code-ed { width: 100%; min-height: 300px; font-family: var(--mono); font-size: 0.76rem; line-height: 1.55; background: var(--code-bg); color: var(--code-fg); border: 1px solid var(--border); border-radius: 12px; padding: 12px; resize: vertical; }
.code-ed:focus { outline: none; box-shadow: 0 0 0 2px var(--ring); }
.lock { font-family: var(--mono); font-size: 0.72rem; padding: 8px 12px; border-radius: 10px; background: var(--sunken); color: var(--muted-foreground); display: grid; gap: 2px; }
.effect { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--border); font-size: 0.8rem; }
.tl { list-style: none; margin: 0; padding: 0 0 0 20px; border-left: 1px solid color-mix(in srgb, var(--border) 80%, transparent); display: grid; gap: 14px; }
.tl li { position: relative; }
.tl li::before { content: ""; position: absolute; left: -26px; top: 5px; width: 11px; height: 11px; border-radius: 50%; background: var(--muted-foreground); border: 2px solid var(--card); }
.tl li.ok::before { background: var(--primary); } .tl li.warn::before { background: var(--amber); } .tl li.bad::before { background: var(--rose); } .tl li.skip::before { background: var(--input); }
.tl .w { font-size: 0.75rem; color: var(--muted-foreground); }
pre.json { margin: 0; background: var(--code-bg); color: var(--code-fg); border-radius: 12px; padding: 12px 0; font-family: var(--mono); font-size: 0.74rem; line-height: 1.6; overflow-x: auto; }
pre.json .ln { display: block; padding: 0 14px 0 10px; border-left: 3px solid transparent; white-space: pre; }
pre.json .base { border-left-color: oklch(0.7 0.13 240 / 70%); background: oklch(0.7 0.13 240 / 9%); }
pre.json .k { color: oklch(0.8 0.1 240); } pre.json .s { color: oklch(0.82 0.14 150); } pre.json .n { color: oklch(0.83 0.12 75); }
.sheet-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); background: var(--card); }
.sheet-box .sheet-wrap { max-height: 380px; min-height: 120px; overflow: auto; }
.sheet-big .sheet-wrap { max-height: calc(100dvh - 300px); overflow: auto; }
table.sheet { border-collapse: collapse; font-family: var(--mono); font-size: 0.72rem; min-width: 600px; width: 100%; }
table.sheet th { background: var(--sunken); color: var(--muted-foreground); font-weight: 550; padding: 4px 8px; border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
table.sheet td { padding: 5px 8px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); white-space: nowrap; }
table.sheet td.rh, table.sheet th.rh { background: var(--sunken); color: var(--muted-foreground); text-align: center; width: 34px; }
table.sheet tr.h td:not(.rh) { background: color-mix(in srgb, var(--primary) 10%, transparent); }
table.sheet .f { color: var(--sky); } table.sheet .k { color: var(--muted-foreground); }
table.sheet .miss { background: var(--amber-bg); }
table.sheet .chg { background: var(--sky-bg); color: var(--sky); font-weight: 700; }
table.sheet tr.newr td:not(.rh) { box-shadow: inset 0 0 0 9999px color-mix(in srgb, var(--sky) 8%, transparent); }
.sheet-tabs { display: flex; gap: 4px; padding: 6px 8px; background: var(--sunken); font-size: 0.7rem; flex-wrap: wrap; }
.sheet-tabs span { padding: 3px 10px; border-radius: 5px; font-size: 0.72rem; }
.sheet-tabs .on { background: var(--card); font-weight: 650; }
ul.rev { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
ul.rev li { display: flex; gap: 8px; align-items: flex-start; font-size: 0.8rem; padding: 6px 10px; border-radius: 8px; }
ul.rev li.warn { background: var(--amber-bg); color: var(--amber); }
ul.rev li.ok { background: var(--emerald-bg); color: var(--emerald); }
.thread { border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: var(--card); }
.thread .crumb { font-size: 0.72rem; color: var(--muted-foreground); padding: 7px 12px; background: var(--sunken); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 6px; }
.thread .msg { padding: 10px 12px; border-bottom: 1px solid var(--border); display: grid; gap: 4px; font-size: 0.8rem; }
.thread .msg:last-child { border-bottom: 0; }
.thread .msg.este { background: color-mix(in srgb, var(--primary) 6%, transparent); }
.thread .msg.draft { background: color-mix(in srgb, var(--rose-bg) 30%, transparent); border-left: 3px solid var(--rose); }
.att { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.7rem; padding: 2px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--sunken); width: fit-content; max-width: 100%; overflow-wrap: anywhere; }
.att.x { background: var(--emerald-bg); border-color: transparent; color: var(--emerald); }
`;
