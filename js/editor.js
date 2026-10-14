(() => {
'use strict';

// ビューアのランタイムは文字列で持つ。エディター自身で使い、書き出す HTML にも同じものを埋め込む
{
  const sc = document.createElement('script');
  sc.textContent = window.MF_RUNTIME_SRC;
  document.head.appendChild(sc);
}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const h = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const k in props) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
};

/* ---------- 定数 ---------- */

const svg = (d, extra = '') => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/>${extra}</svg>`;
const IC = {
  doc: svg('M5 3h6l4 4v10H5z M11 3v4h4'),
  open: svg('M3 6h5l2 2h7v8H3z'),
  save: svg('M4 4h10l2 2v10H4z M7 4v4h6V4 M7 16v-5h6v5'),
  undo: svg('M7 5L3 9l4 4 M3 9h9a4 4 0 0 1 0 8h-2'),
  redo: svg('M13 5l4 4-4 4 M17 9H8a4 4 0 0 0 0 8h2'),
  text: svg('M5 5h10 M10 5v11 M8 16h4'),
  shape: svg('M3 9h8v8H3z', '<circle cx="13" cy="7" r="4"/>'),
  image: svg('M3 4h14v12H3z M3 14l4-4 4 4 2-2 4 4', '<circle cx="13" cy="8" r="1.2"/>'),
  cube: svg('M10 2.5l6.5 3.7v7.6L10 17.5 3.5 13.8V6.2z M3.5 6.2L10 10l6.5-3.8 M10 10v7.5'),
  play: svg('M6 4l10 6-10 6z'),
  export: svg('M10 3v9 M6.5 6.5L10 3l3.5 3.5 M4 12v4h12v-4'),
  copy: svg('M7 7h9v9H7z M4 13V4h9'),
  trash: svg('M4 6h12 M8 6V4h4v2 M6 6l1 11h6l1-11'),
  al: svg('M4 3v14 M6 6h9v3H6z M6 11h6v3H6z'),
  ac: svg('M10 3v14 M5 6h10v3H5z M7 11h6v3H7z'),
  ar: svg('M16 3v14 M5 6h9v3H5z M8 11h6v3H8z'),
  at: svg('M3 4h14 M6 6h3v9H6z M11 6h3v6h-3z'),
  am: svg('M3 10h14 M6 5h3v10H6z M11 7h3v6h-3z'),
  ab: svg('M3 16h14 M6 5h3v9H6z M11 8h3v6h-3z'),
  tl: svg('M4 5h12 M4 9h8 M4 13h12 M4 16.5h6'),
  tc: svg('M4 5h12 M6 9h8 M4 13h12 M7 16.5h6'),
  tr: svg('M4 5h12 M8 9h8 M4 13h12 M10 16.5h6'),
  tj: svg('M4 5h12 M4 9h12 M4 13h12 M4 16.5h12'),
};

const FONTS = {
  sans: { n: 'ゴシック（システム）', css: '"Hiragino Sans","Yu Gothic UI","Yu Gothic","Meiryo",sans-serif' },
  serif: { n: '明朝（システム）', css: '"Hiragino Mincho ProN","Yu Mincho","YuMincho",serif' },
  notosans: { n: 'Noto Sans JP', css: '"Noto Sans JP","Yu Gothic UI",sans-serif', g: 'Noto+Sans+JP:wght@400;500;700;900' },
  notoserif: { n: 'Noto Serif JP', css: '"Noto Serif JP","Yu Mincho",serif', g: 'Noto+Serif+JP:wght@400;500;700;900' },
  zenkaku: { n: 'Zen Kaku Gothic New', css: '"Zen Kaku Gothic New","Yu Gothic UI",sans-serif', g: 'Zen+Kaku+Gothic+New:wght@400;500;700;900' },
  rounded: { n: 'M PLUS Rounded 1c', css: '"M PLUS Rounded 1c","Yu Gothic UI",sans-serif', g: 'M+PLUS+Rounded+1c:wght@400;500;700;900' },
  shippori: { n: 'Shippori Mincho', css: '"Shippori Mincho","Yu Mincho",serif', g: 'Shippori+Mincho:wght@400;500;700;800' },
  inter: { n: 'Inter', css: '"Inter","Yu Gothic UI",sans-serif', g: 'Inter:wght@400;500;700;900' },
  mono: { n: '等幅（コード）', css: '"JetBrains Mono","Cascadia Code",Consolas,"BIZ UDGothic",monospace', g: 'JetBrains+Mono:wght@400;700' },
};
const fontsHref = (keys) => 'https://fonts.googleapis.com/css2?' + keys.map((k) => 'family=' + FONTS[k].g).join('&') + '&display=swap';

const INK = '#1d1d1f';
const TEXT_BASE = { font: 'sans', color: INK, bg: '', pad: 0, radius: 0, ls: 0, align: 'left' };
const TEXT_PRESETS = {
  title: { label: 'タイトル', size: 52, weight: 900, lh: 1.25, ls: 0.01 },
  heading: { label: '見出し', size: 30, weight: 700, lh: 1.35 },
  sub: { label: '小見出し', size: 20, weight: 700, lh: 1.45 },
  body: { label: '本文', size: 15, weight: 400, lh: 1.9 },
  caption: { label: 'キャプション', size: 12, weight: 400, lh: 1.6, color: '#6e6e73' },
  code: { label: 'コード', size: 13, weight: 400, lh: 1.65, font: 'mono', color: '#e8e8ed', bg: '#1e1f24', pad: 18, radius: 10 },
};
const SIZES = [
  ['A4 縦', 794, 1123], ['A4 横', 1123, 794], ['B5 縦', 688, 971],
  ['16:9', 1280, 720], ['4:3', 1024, 768], ['正方形', 1000, 1000],
];
const TYPE_NAME = { text: 'テキスト', image: '画像', shape: '図形', model: '3D アニメーション' };
const SHADOW = '0 12px 32px rgba(0,0,0,.16),0 2px 6px rgba(0,0,0,.08)';
// 文中に差し込むマウスの図。押すボタンだけ青く塗る
const mouseSvg = (b) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 22">' +
  '<rect x="1" y="1" width="14" height="20" rx="7" fill="#fff" stroke="#3a3a3c" stroke-width="1.4"/>' +
  (b === 'l' ? '<path d="M8 1.7A6.3 6.3 0 0 0 1.7 8v1H8z" fill="#0071e3"/>' : '') +
  (b === 'r' ? '<path d="M8 1.7A6.3 6.3 0 0 1 14.3 8v1H8z" fill="#0071e3"/>' : '') +
  '<path d="M1.7 9h12.6M8 1.7V9" stroke="#3a3a3c" stroke-width="1.2" fill="none"/>' +
  `<rect x="6.6" y="3.4" width="2.8" height="4.4" rx="1.4" fill="${b === 'm' ? '#0071e3' : '#fff'}" stroke="#3a3a3c" stroke-width="1"/></svg>`;
const MOUSE_ICON = Object.fromEntries(['l', 'm', 'r'].map((b) => [b, 'data:image/svg+xml,' + encodeURIComponent(mouseSvg(b))]));
const COMMON = new Set(['x', 'y', 'w', 'h', 'rot', 'opacity', 'locked', 'radius', 'shadow', 'borderW', 'borderC']);

// 箇条書きの記号。段ごとにクラスを持てるよう子セレクタで当て、クラスのない入れ子の段は外側の段の記号を引き継ぐ
const LIST_MARK = {
  dot: 'content:"・";font-weight:400',
  disc: 'content:"•"',
  dash: 'content:"–";font-weight:400',
  square: 'content:"▪"',
  check: 'content:"✓";color:#0071e3',
  arrow: 'content:"→";color:#0071e3',
  num: 'content:counter(mf) ".";text-align:left;font-variant-numeric:tabular-nums',
  alpha: 'content:counter(mf,lower-alpha) ".";text-align:left;font-weight:400',
  circled: 'content:counter(mf,mf-circled);font-weight:400',
  paren: 'content:"(" counter(mf) ")";text-align:left;font-weight:400',
  step: 'content:counter(mf);font-size:.72em;width:1.6em;height:1.6em;line-height:1.6em;margin-left:-2.78em;margin-right:1.18em;border-radius:50%;background:#0071e3;color:#fff;vertical-align:.12em',
};
const LIST_CSS = Object.entries(LIST_MARK).map(([id, css]) =>
  `.mf-l-${id}>li::before,.mf-l-${id} :is(ul,ol):not([class])>li::before{${css}}`).join('\n') +
  '\n.mf-tx .mf-l-step,.mf-tx .mf-l-step :is(ul,ol):not([class]){padding-left:2em}';
// エディターと書き出し HTML で共通のスタイル
const BASE_CSS = `
.mf-page{position:relative;overflow:hidden;background:#fff}
.mf-el{position:absolute;box-sizing:border-box}
.mf-tx{box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;line-break:strict;min-height:1em;outline:none}
.mf-tx a{color:#0a6cff;text-decoration:underline}
.mf-box{width:100%;height:100%;box-sizing:border-box;overflow:hidden}
.mf-box img{width:100%;height:100%;display:block}
.mf-box svg{display:block;overflow:visible}
.mf-kbd{display:inline-block;min-width:1.55em;padding:0 .42em;margin:0 .1em;box-sizing:border-box;text-align:center;text-indent:0;
font-family:system-ui,-apple-system,"Segoe UI","Hiragino Sans","Yu Gothic UI",sans-serif;font-size:.8em;font-weight:600;font-style:normal;line-height:1.6;letter-spacing:0;
color:#1d1d1f;background:linear-gradient(#fff,#f0f0f3);border:1px solid #c4c4ca;border-bottom-width:2.5px;border-radius:.38em;
box-shadow:0 1px 1.5px rgba(0,0,0,.08);vertical-align:.1em;white-space:nowrap}
.mf-code{font-family:"JetBrains Mono","Cascadia Code",Consolas,"BIZ UDGothic",monospace;font-size:.88em;padding:.08em .38em;border-radius:.3em;background:rgba(118,118,128,.15)}
.mf-mark{background:linear-gradient(transparent 58%,rgba(255,214,10,.7) 58%);padding:0 .06em}
.mf-tx img.mf-mouse,.btn img.mf-mouse{display:inline;height:1.25em;width:auto;vertical-align:-.25em;margin:0 .08em}
@counter-style mf-circled{system:fixed;symbols:"①" "②" "③" "④" "⑤" "⑥" "⑦" "⑧" "⑨" "⑩" "⑪" "⑫" "⑬" "⑭" "⑮" "⑯" "⑰" "⑱" "⑲" "⑳";suffix:""}
.mf-tx ul,.mf-tx ol{margin:0;padding:0 0 0 1.6em;list-style:none;counter-reset:mf}
.mf-tx li{counter-increment:mf}
.mf-tx li+li{margin-top:.2em}
.mf-tx li::before{display:inline-block;width:1.6em;margin-left:-1.6em;text-align:center;font-weight:700;text-indent:0}
${LIST_CSS}
`;

/* ---------- 状態 ---------- */

const state = { doc: null, pageIdx: 0, sel: new Set(), editing: null, interact: null, zoom: 1, zoomMode: 'fit' };
const assets = new Map();   // id -> {id,name,type,mime,blob,url}
let posters = {};           // 要素 id -> 3D ビューの静止画（サムネイルと書き出しの読み込み前表示に使う）
const nodes = new Map();    // 要素 id -> DOM
const viewers = new Map();  // 要素 id -> {v, asset}
let guides = [], tip = null, marquee = null, clip = null;
const fileRef = { h: null };

const stage = $('#stage'), holder = $('#holder'), pageEl = $('#page'), overlay = $('#overlay');
const curPage = () => state.doc.pages[state.pageIdx];
const findEl = (id) => curPage().els.find((e) => e.id === id);
const selEls = () => curPage().els.filter((e) => state.sel.has(e.id));

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- HTML 生成 ---------- */

function outerStyle(el) {
  const hgt = el.type === 'text' && el.autoH ? 'auto' : el.h + 'px';
  return `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${hgt};` +
    (el.rot ? `transform:rotate(${el.rot}deg);` : '') + (el.opacity < 1 ? `opacity:${el.opacity};` : '');
}
function deco(el) {
  return (el.radius ? `border-radius:${el.radius}px;` : '') + (el.shadow ? `box-shadow:${SHADOW};` : '') +
    (el.borderW ? `border:${el.borderW}px solid ${el.borderC};` : '');
}
function textStyle(el) {
  return `font-family:${(FONTS[el.font] || FONTS.sans).css};font-size:${el.size}px;font-weight:${el.weight};color:${el.color};` +
    `text-align:${el.align};line-height:${el.lh};letter-spacing:${el.ls}em;padding:${el.pad}px;` +
    (el.bg ? `background:${el.bg};` : '') + deco(el) + (el.vertical ? 'writing-mode:vertical-rl;' : '') + (el.autoH ? '' : 'height:100%;');
}
function modelStyle(el) {
  return 'width:100%;height:100%;' + (el.bg ? `background:${el.bg};` : '') + deco(el);
}
function modelOpts(el) {
  const { asset, clip, autoplay, loop, speed, controls, grid, skeleton, wire, autoRotate, exposure, fps, time, cam, bg } = el;
  return { asset, clip, autoplay, loop, speed, controls, grid, skeleton, wire, autoRotate, exposure, fps, time, cam, bg, keys: el.keys !== false, order: el.order || null };
}
function shapeHTML(el) {
  const sh = el.shadow ? `box-shadow:${SHADOW};` : '';
  if (el.shape === 'arrow') {
    const t = Math.max(1, el.strokeW || 4), hd = Math.min(el.w * 0.6, Math.max(t * 3.2, 14)), y = el.h / 2, hw = Math.max(t * 1.6, 7);
    return `<div class="mf-box" style="overflow:visible"><svg width="${el.w}" height="${el.h}" viewBox="0 0 ${el.w} ${el.h}">` +
      `<line x1="0" y1="${y}" x2="${el.w - hd + 1}" y2="${y}" stroke="${el.fill}" stroke-width="${t}"/>` +
      `<polygon points="${el.w},${y} ${el.w - hd},${y - hw} ${el.w - hd},${y + hw}" fill="${el.fill}"/></svg></div>`;
  }
  const r = el.shape === 'ellipse' ? 'border-radius:50%;' : el.radius ? `border-radius:${el.radius}px;` : '';
  return `<div class="mf-box" style="${el.fill ? `background:${el.fill};` : ''}${el.borderW ? `border:${el.borderW}px solid ${el.borderC};` : ''}${r}${sh}"></div>`;
}
// ctx.mode: 'edit' | 'thumb' | 'export'、ctx.img(id) は画像の URL を返す
const PH = { image: ['image', '画像をドロップ、またはダブルクリック'], model: ['cube', 'glb をドロップ、またはダブルクリック'] };
function placeholderHTML(el) {
  const [ic, label] = PH[el.type];
  return `<div class="mf-box mf-ph" style="${esc(el.type === 'model' ? modelStyle(el) : deco(el))}">${IC[ic]}<span>${label}</span></div>`;
}
function innerHTML(el, ctx) {
  if ((el.type === 'image' || el.type === 'model') && !el.asset) {
    return ctx.mode === 'export' ? '' : placeholderHTML(el);
  }
  if (el.type === 'text') return `<div class="mf-tx" style="${esc(textStyle(el))}">${el.html}</div>`;
  if (el.type === 'image') {
    const src = ctx.img(el.asset);
    return `<div class="mf-box" style="${esc(deco(el))}">${src ? `<img src="${src}" style="object-fit:${el.fit}" alt="" draggable="false">` : ''}</div>`;
  }
  if (el.type === 'shape') return shapeHTML(el);
  if (el.type === 'model') {
    const p = posters[el.id];
    if (ctx.mode === 'export') {
      return `<div class="mfv" data-mfv="${esc(JSON.stringify(modelOpts(el)))}" style="${esc(modelStyle(el))}">${p ? `<img class="mfv-poster" src="${p}" alt="">` : ''}</div>`;
    }
    return `<div class="mf-box" style="${esc(modelStyle(el))}">${p ? `<img src="${p}" style="object-fit:contain" alt="">` : ''}</div>`;
  }
  return '';
}
const elHTML = (el, ctx) => `<div class="mf-el" style="${esc(outerStyle(el))}">${innerHTML(el, ctx)}</div>`;
const liveCtx = (mode) => ({ mode, img: (id) => (assets.get(id) || {}).url || '' });

/* ---------- ページ描画 ---------- */

function destroyNode(id) {
  const rec = viewers.get(id);
  if (rec) { rec.v.dispose(); viewers.delete(id); }
  const n = nodes.get(id);
  if (n) n.remove();
  nodes.delete(id);
}

function syncModel(n, el) {
  if (!el.asset) {
    const rec = viewers.get(el.id);
    if (rec) { rec.v.dispose(); viewers.delete(el.id); }
    const html = placeholderHTML(el);
    if (n._ph !== html) { n.innerHTML = html; n._ph = html; }
    return;
  }
  if (n._ph) { n.innerHTML = ''; n._ph = null; }
  let host = n.firstElementChild;
  if (!host) { host = h('div'); n.appendChild(host); }
  host.style.cssText = modelStyle(el);
  let rec = viewers.get(el.id);
  if (rec && rec.asset !== el.asset) {
    rec.v.dispose(); viewers.delete(el.id); rec = null;
  }
  const opts = { ...modelOpts(el), interactive: state.interact === el.id };
  if (rec) { rec.v.set(opts); return; }
  const id = el.id;
  const v = new MFV.Viewer(host, opts, (ch) => onViewerChange(id, ch));
  viewers.set(id, { v, asset: el.asset });
  const a = assets.get(el.asset);
  if (!a) { v.message('glb が見つかりません'); return; }
  a.blob.arrayBuffer().then((b) => v.load(b)).then(() => {
    if (state.sel.has(id)) insp();
    setTimeout(() => snapPoster(id), 250);
  }).catch((e) => console.warn(e));
}

function snapPoster(id) {
  const rec = viewers.get(id);
  if (!rec) return;
  const p = rec.v.poster(640);
  if (p) { posters[id] = p; scheduleThumbs(); scheduleSave(); }
}

let viewerCommitT = 0;
function onViewerChange(id, ch) {
  const el = findEl(id);
  if (!el) return;
  Object.assign(el, ch);
  scheduleSave();
  clearTimeout(viewerCommitT);
  viewerCommitT = setTimeout(() => { commit(); snapPoster(id); if (state.sel.has(id) && !('cam' in ch)) insp(); }, 400);
}

function applyEl(n, el) {
  n.style.cssText = outerStyle(el);
  n.classList.toggle('editing', state.editing === el.id || state.interact === el.id);
  if (el.type === 'model') { syncModel(n, el); return; }
  if (el.type === 'text') {
    let tx = n.firstElementChild;
    if (!tx) { tx = h('div', { class: 'mf-tx' }); n.appendChild(tx); n.classList.add('placeholder'); }
    tx.style.cssText = textStyle(el);
    if (state.editing !== el.id && n._html !== el.html) { tx.innerHTML = el.html; n._html = el.html; }
    if (el.autoH) {
      const hh = n.offsetHeight;
      if (hh && Math.abs(hh - el.h) > 0.5) el.h = hh;
    }
    return;
  }
  const html = innerHTML(el, liveCtx('edit'));
  if (n._html !== html) { n.innerHTML = html; n._html = html; }
}

function renderPage() {
  const d = state.doc, pg = curPage();
  pageEl.style.width = d.w + 'px';
  pageEl.style.height = d.h + 'px';
  pageEl.style.background = pg.bg;
  const ids = new Set(pg.els.map((e) => e.id));
  for (const id of [...nodes.keys()]) if (!ids.has(id)) destroyNode(id);
  pg.els.forEach((el, i) => {
    let n = nodes.get(el.id);
    if (!n) {
      n = h('div', { class: 'el mf-el', 'data-id': el.id });
      nodes.set(el.id, n);
    }
    if (pageEl.children[i] !== n) pageEl.insertBefore(n, pageEl.children[i] || null);
    applyEl(n, el);
  });
  renderOverlay();
}

function renderOverlay() {
  const z = state.zoom, sel = selEls();
  let s = '';
  for (const el of sel) {
    const mode = state.editing === el.id || state.interact === el.id;
    s += `<div class="selbox${mode ? ' mode' : ''}${el.locked ? ' locked' : ''}" style="left:${el.x * z}px;top:${el.y * z}px;width:${el.w * z}px;height:${el.h * z}px;transform:rotate(${el.rot}deg)">`;
    if (sel.length === 1 && !el.locked && !mode) {
      const onlyX = el.type === 'text' && el.autoH;
      for (const hx of [-1, 0, 1]) for (const hy of [-1, 0, 1]) {
        if ((!hx && !hy) || (onlyX && hy)) continue;
        const cur = !hy ? 'ew' : !hx ? 'ns' : hx === hy ? 'nwse' : 'nesw';
        s += `<i class="h" data-h="${hx},${hy}" style="left:${(hx + 1) * 50}%;top:${(hy + 1) * 50}%;cursor:${cur}-resize"></i>`;
      }
      s += '<i class="rot" title="回転"></i>';
    }
    s += '</div>';
  }
  for (const g of guides) s += g.v != null ? `<div class="guide v" style="left:${g.v * z}px"></div>` : `<div class="guide hz" style="top:${g.h * z}px"></div>`;
  if (marquee) s += `<div class="marquee" style="left:${marquee.l * z}px;top:${marquee.t * z}px;width:${(marquee.r - marquee.l) * z}px;height:${(marquee.b - marquee.t) * z}px"></div>`;
  if (tip) s += `<div class="sizetip" style="left:${tip.x * z}px;top:${tip.y * z}px">${tip.text}</div>`;
  overlay.innerHTML = s;
}

function applyZoom() {
  const d = state.doc;
  if (state.zoomMode === 'fit') {
    state.zoom = clamp(Math.min((stage.offsetWidth - 80) / d.w, (stage.offsetHeight - 80) / d.h), 0.1, 3);
  } else state.zoom = state.zoomMode;
  holder.style.width = d.w * state.zoom + 'px';
  holder.style.height = d.h * state.zoom + 'px';
  pageEl.style.transform = `scale(${state.zoom})`;
  const zs = $('#zoomSel');
  const val = String(state.zoomMode);
  let custom = zs.querySelector('[data-custom]');
  if (![...zs.options].some((o) => o.value === val && !o.dataset.custom)) {
    if (!custom) { custom = h('option', { 'data-custom': '1' }); zs.appendChild(custom); }
    custom.value = val; custom.textContent = Math.round(state.zoom * 100) + '%';
  } else if (custom) custom.remove();
  zs.value = val;
  renderOverlay();
}

/* ---------- サムネイル ---------- */

const TW = 118;
function renderThumbs() {
  const d = state.doc, k = TW / d.w, ctx = liveCtx('thumb');
  const box = $('#thumbs');
  box.innerHTML = d.pages.map((pg, i) =>
    `<div class="thumb${i === state.pageIdx ? ' active' : ''}" data-i="${i}" draggable="true"><span class="thumb-no">${i + 1}</span>` +
    `<div class="thumb-frame" style="width:${TW}px;height:${d.h * k}px"><div class="mf-page" style="width:${d.w}px;height:${d.h}px;transform:scale(${k});background:${pg.bg}">` +
    pg.els.map((el) => elHTML(el, ctx)).join('') + '</div></div></div>').join('');
}
let thumbT = 0;
function scheduleThumbs() { clearTimeout(thumbT); thumbT = setTimeout(renderThumbs, 250); }

function gotoPage(i) {
  exitModes();
  state.pageIdx = clamp(i, 0, state.doc.pages.length - 1);
  state.sel.clear();
  renderPage(); renderThumbs(); insp();
}

/* ---------- 変更の反映と履歴 ---------- */

function touch() { renderPage(); scheduleThumbs(); scheduleSave(); }
function refreshAll() { applyZoom(); renderPage(); renderThumbs(); insp(); scheduleSave(); }

const hist = { stack: [], i: -1 };
function commit() {
  const s = JSON.stringify(state.doc);
  if (hist.stack[hist.i] === s) return;
  hist.stack.length = hist.i + 1;
  hist.stack.push(s);
  if (hist.stack.length > 120) hist.stack.shift();
  hist.i = hist.stack.length - 1;
  syncUndo();
}
function syncUndo() {
  $('[data-act=undo]').disabled = hist.i <= 0;
  $('[data-act=redo]').disabled = hist.i >= hist.stack.length - 1;
}
function undo(dir) {
  exitModes();
  const j = hist.i + dir;
  if (j < 0 || j >= hist.stack.length) return;
  hist.i = j;
  state.doc = JSON.parse(hist.stack[j]);
  state.pageIdx = clamp(state.pageIdx, 0, state.doc.pages.length - 1);
  const ids = new Set(curPage().els.map((e) => e.id));
  state.sel = new Set([...state.sel].filter((id) => ids.has(id)));
  refreshAll(); syncUndo();
}
function resetHistory() { hist.stack = []; hist.i = -1; commit(); }

/* ---------- 選択・編集モード ---------- */

function setSel(ids) { state.sel = new Set(ids); renderOverlay(); insp(); }

function exitModes() {
  let changed = false;
  if (state.editing) {
    const el = findEl(state.editing), n = nodes.get(state.editing);
    if (n && el) {
      const tx = n.firstElementChild;
      tx.contentEditable = 'false';
      // 装飾の入力用に置いた目印の空白を消し、中身のない装飾は取り除く
      tx.innerHTML = tx.innerHTML.replace(/​/g, '');
      $$('.mf-kbd,.mf-code,.mf-mark', tx).forEach((s) => { if (!s.textContent) s.remove(); });
      let html = tx.innerHTML;
      if (html === '<br>') html = '';
      el.html = html;
      n._html = undefined;
    }
    state.editing = null;
    getSelection().removeAllRanges();
    changed = true;
  }
  if (state.interact) { state.interact = null; changed = true; }
  if (changed) { touch(); commit(); }
}

function enterEdit(id, selectAll) {
  exitModes();
  const el = findEl(id);
  if (!el || el.locked) return;
  state.editing = id;
  state.sel = new Set([id]);
  renderPage(); insp();
  const tx = nodes.get(id).firstElementChild;
  tx.contentEditable = 'true';
  tx.focus();
  const r = document.createRange();
  r.selectNodeContents(tx);
  if (!selectAll) r.collapse(false);
  const s = getSelection();
  s.removeAllRanges(); s.addRange(r);
}

function enterInteract(id) {
  exitModes();
  state.interact = id;
  state.sel = new Set([id]);
  renderPage(); insp();
  toast('ドラッグで視点、下のバーでポーズを調整。Esc で確定');
}

function inlineCmd(cmd, val) {
  const el = selEls()[0];
  if (!el || el.type !== 'text') return;
  if (state.editing !== el.id) enterEdit(el.id, true);
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(cmd, false, val);
  const tx = nodes.get(el.id).firstElementChild;
  $$('a', tx).forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  el.html = tx.innerHTML;
  touch();
}

// 文字装飾。インスペクタのボタンとキーボードショートカットの両方がこの表を使う
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const keyLabel = (key, shift) => (IS_MAC ? '⌘' + (shift ? '⇧' : '') : 'Ctrl+' + (shift ? 'Shift+' : '')) + key.toUpperCase();
const TEXT_CMDS = [
  { html: '<b>B</b>', title: '太字', key: 'b', run: () => inlineCmd('bold') },
  { html: '<i>I</i>', title: '斜体', key: 'i', run: () => inlineCmd('italic') },
  { html: '<u>U</u>', title: '下線', key: 'u', run: () => inlineCmd('underline') },
  { html: '色', title: '強調色', key: 'h', shift: true, run: () => inlineCmd('foreColor', '#ff3b30') },
  { html: 'リンク', title: 'リンク', key: 'k', run: () => { const u = prompt('リンク先の URL'); if (u) inlineCmd('createLink', u); } },
  { html: '解除', title: '装飾を外す', key: '\\', run: () => { inlineCmd('removeFormat'); inlineCmd('unlink'); } },
];
// 技術書向けの装飾。キーキャップ・インラインコード・マーカーは選択範囲を span で囲み、
// もう一度掛けると外れる。マウスの図は小さな画像として文中に差し込む
const TECH_CMDS = [
  { html: '<span class="mf-kbd">キー</span>', title: 'キーキャップ（「Ctrl+Z」のように + でつなぐと 1 キーずつ囲む）', key: 'k', shift: true, run: () => wrapInline('mf-kbd') },
  { html: '<span class="mf-code">コード</span>', title: 'インラインコード', key: 'e', run: () => wrapInline('mf-code') },
  { html: '<span class="mf-mark">マーカー</span>', title: 'マーカー', key: 'y', shift: true, run: () => wrapInline('mf-mark') },
];
const MOUSE_CMDS = [['l', '左クリック'], ['m', 'ホイール（中ボタン）'], ['r', '右クリック']].map(([b, title]) => ({
  html: `<img class="mf-mouse" src="${MOUSE_ICON[b]}" alt="">`, title, run: () => insertInline(`<img class="mf-mouse" src="${MOUSE_ICON[b]}" alt="${title}">`),
}));

function editingTx() {
  const el = first();
  if (!el || el.type !== 'text') return null;
  if (state.editing !== el.id) enterEdit(el.id, true);
  return { el, tx: nodes.get(el.id).firstElementChild };
}
function wrapInline(cls) {
  const cur = editingTx();
  if (!cur) return;
  const { el, tx } = cur, sel = getSelection();
  if (!sel.rangeCount || !tx.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
  const r = sel.getRangeAt(0);
  const owner = (n) => { for (let x = n; x && x !== tx; x = x.parentNode) if (x.nodeType === 1 && x.classList.contains(cls)) return x; return null; };
  const unwrap = (x) => { const p = x.parentNode; while (x.firstChild) p.insertBefore(x.firstChild, x); x.remove(); p.normalize(); };
  const span = (text) => { const s = document.createElement('span'); s.className = cls; if (text != null) s.textContent = text; return s; };
  const caret = (node, after) => {
    const rr = document.createRange();
    if (after) {
      // 装飾の直後に目印の空白を置いてからカーソルを移す。そうしないと続けて打った文字が装飾の中に入る
      const z = document.createTextNode('​');
      node.after(z);
      rr.setStart(z, 1);
    } else rr.setStart(node, node.length);
    rr.collapse(true); sel.removeAllRanges(); sel.addRange(rr);
  };
  const hit = owner(r.startContainer) || owner(r.endContainer);
  // 範囲を選んでいれば装飾を外し、カーソルだけなら装飾の外へ抜ける
  if (hit && r.collapsed) caret(hit, true);
  else if (hit) unwrap(hit);
  else if (r.collapsed) {
    // 何も選んでいなければ空の装飾を置き、続けて打つ文字をその中に入れる
    const s = span('​');
    r.insertNode(s);
    caret(s.firstChild);
  } else {
    const text = r.toString().trim(), frag = r.extractContents();
    frag.querySelectorAll('.' + cls).forEach(unwrap);
    let out = span(), last;
    if (cls === 'mf-kbd' && !frag.querySelector('*') && /^[^\s+]+(\s*\+\s*[^\s+]+)+$/.test(text)) {
      out = document.createDocumentFragment();
      text.split(/\s*\+\s*/).forEach((key, i) => { if (i) out.append('+'); out.append(span(key)); });
    } else out.append(frag);
    last = out.nodeType === 11 ? out.lastChild : out;
    r.insertNode(out);
    caret(last, true);
  }
  el.html = tx.innerHTML;
  touch();
}
// 箇条書き。段落単位で ul / ol にし、記号の種類はクラスで切り替える
const LISTS = [
  { id: 'none', label: 'なし', title: '箇条書きを解除' },
  { id: 'dot', label: '・', title: '中黒' },
  { id: 'disc', label: '•', title: '黒丸' },
  { id: 'dash', label: '–', title: 'ダッシュ' },
  { id: 'square', label: '▪', title: '四角' },
  { id: 'check', label: '<span style="color:#0071e3">✓</span>', title: 'チェック' },
  { id: 'arrow', label: '<span style="color:#0071e3">→</span>', title: '矢印' },
  { id: 'num', label: '1.', title: '番号', ol: true },
  { id: 'alpha', label: 'a.', title: 'アルファベット', ol: true },
  { id: 'circled', label: '①', title: '丸数字', ol: true },
  { id: 'paren', label: '(1)', title: 'かっこ数字', ol: true },
  { id: 'step', label: '<span class="list-step">1</span>', title: '手順バッジ', ol: true },
];
function setList(id) {
  const cur = editingTx();
  if (!cur) return;
  const { el, tx } = cur, sel = getSelection();
  if (!sel.rangeCount) return;
  const ownOf = (n) => {
    const e = n && (n.nodeType === 1 ? n : n.parentNode), l = e && e.closest('ul,ol');
    return l && tx.contains(l) ? l : null;
  };
  const depth = (l) => { let d = 0; for (let x = ownOf(l.parentNode); x; x = ownOf(x.parentNode)) d++; return d; };
  const inRange = () => [...tx.querySelectorAll('ul,ol')].filter((l) => sel.getRangeAt(0).intersectsNode(l));
  // カーソルが箇条書きの中にあれば、その段だけが対象。範囲を選んでいれば、範囲にかかるいちばん外側の段
  const sameList = () => {
    const a = ownOf(sel.anchorNode);
    return a && (sel.getRangeAt(0).collapsed || a === ownOf(sel.focusNode)) ? a : null;
  };
  const levelLists = () => {
    const own = sameList();
    if (own) return [own];
    const all = inRange();
    if (!all.length) return [];
    const m = Math.min(...all.map(depth));
    return all.filter((l) => depth(l) === m);
  };
  const spec = LISTS.find((l) => l.id === id);
  if (id === 'none') {
    const own = sameList(), lists = own ? [own] : inRange();
    // 入れ子の内側から順に、項目を普通の段落へ戻す。戻した段落は選んだままにして、続けて別の記号を掛けられるようにする
    const made = [], whole = sel.rangeCount && sel.getRangeAt(0).toString().trim() === tx.textContent.trim();
    for (const l of lists.reverse()) {
      if (!l.isConnected) continue;
      for (const c of [...l.childNodes]) {
        if (c.nodeName === 'LI') { const d = document.createElement('div'); while (c.firstChild) d.append(c.firstChild); l.before(d); c.remove(); made.push(d); }
        else l.before(c);
      }
      l.remove();
    }
    const live = made.filter((d) => d.isConnected);
    if (whole || live.length) {
      const rr = document.createRange();
      if (whole) rr.selectNodeContents(tx);
      else {
        live.sort((p, q) => (p.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        rr.setStartBefore(live[0]); rr.setEndAfter(live[live.length - 1]);
      }
      sel.removeAllRanges(); sel.addRange(rr);
    }
  } else {
    const tag = spec.ol ? 'OL' : 'UL';
    let targets = levelLists();
    if (!targets.length) {
      document.execCommand(spec.ol ? 'insertOrderedList' : 'insertUnorderedList');
      targets = levelLists();
    }
    // 番号と記号の切り替えは要素を差し替えて行う。execCommand だと入れ子の段まで巻き込むため
    const keep = [sel.anchorNode, sel.anchorOffset, sel.focusNode, sel.focusOffset];
    const whole = sel.getRangeAt(0).toString().trim() === tx.textContent.trim();
    for (let l of targets) {
      if (l.tagName !== tag) {
        const n = document.createElement(tag);
        while (l.firstChild) n.append(l.firstChild);
        l.replaceWith(n);
        l = n;
      }
      l.className = 'mf-l-' + id;
    }
    if (whole) { const rr = document.createRange(); rr.selectNodeContents(tx); sel.removeAllRanges(); sel.addRange(rr); }
    else if (keep[0] && keep[0].isConnected && keep[2] && keep[2].isConnected) sel.setBaseAndExtent(...keep);
  }
  el.html = tx.innerHTML;
  touch();
}

function insertInline(html) {
  const cur = editingTx();
  if (!cur) return;
  const s = getSelection();
  if (s.rangeCount && !s.getRangeAt(0).collapsed) s.collapseToEnd();
  document.execCommand('insertHTML', false, html);
  cur.el.html = cur.tx.innerHTML;
  touch();
}

// テキストを編集中か、テキストを 1 つだけ選んでいるときに効く。選んでいるだけなら全文に掛かる
function textShortcut(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  const el = first();
  if (!state.editing && !(state.sel.size === 1 && el && el.type === 'text')) return false;
  const k = e.key.toLowerCase();
  // Shift+数字は配列によって e.key が変わるので、物理キーで見る
  if (e.shiftKey && (e.code === 'Digit8' || e.code === 'Digit7')) {
    e.preventDefault();
    setList(e.code === 'Digit8' ? 'disc' : 'num');
    return true;
  }
  const cmd = [...TEXT_CMDS, ...TECH_CMDS].find((c) => c.key === k && !!c.shift === e.shiftKey);
  if (!cmd) return false;
  e.preventDefault();
  cmd.run();
  return true;
}

/* ---------- ポインター操作 ---------- */

function pagePt(e) {
  const r = pageEl.getBoundingClientRect();
  return { x: (e.clientX - r.left) / state.zoom, y: (e.clientY - r.top) / state.zoom };
}
function aabb(el) {
  const r = (el.rot * Math.PI) / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
  const w = el.w * c + el.h * s, hh = el.w * s + el.h * c, cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  return { l: cx - w / 2, t: cy - hh / 2, r: cx + w / 2, b: cy + hh / 2 };
}
function bounds(els) {
  const bs = els.map(aabb);
  return { l: Math.min(...bs.map((b) => b.l)), t: Math.min(...bs.map((b) => b.t)), r: Math.max(...bs.map((b) => b.r)), b: Math.max(...bs.map((b) => b.b)) };
}
function snapLines(exclude) {
  const d = state.doc, xs = [0, d.w / 2, d.w], ys = [0, d.h / 2, d.h];
  for (const el of curPage().els) {
    if (exclude.has(el.id)) continue;
    const b = aabb(el);
    xs.push(b.l, (b.l + b.r) / 2, b.r);
    ys.push(b.t, (b.t + b.b) / 2, b.b);
  }
  return { xs, ys };
}
function snap1(vals, lines) {
  const thr = 6 / state.zoom;
  let best = null;
  for (const v of vals) for (const l of lines) {
    const d = l - v;
    if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, l };
  }
  return best;
}

function beginDrag(onMove, onUp) {
  const mv = (e) => onMove(e, pagePt(e));
  const up = (e) => {
    window.removeEventListener('pointermove', mv);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    onUp(e);
  };
  window.addEventListener('pointermove', mv);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function startMove(p0) {
  const els = selEls().filter((el) => !el.locked);
  if (!els.length) return;
  const orig = els.map((el) => ({ el, x: el.x, y: el.y }));
  const b0 = bounds(els), lines = snapLines(new Set(els.map((e) => e.id)));
  let moved = false;
  beginDrag((ev, p) => {
    let dx = p.x - p0.x, dy = p.y - p0.y;
    if (!moved && Math.hypot(dx, dy) * state.zoom < 3) return;
    moved = true;
    if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    guides = [];
    if (!ev.altKey) {
      const sx = snap1([b0.l + dx, (b0.l + b0.r) / 2 + dx, b0.r + dx], lines.xs);
      const sy = snap1([b0.t + dy, (b0.t + b0.b) / 2 + dy, b0.b + dy], lines.ys);
      if (sx) { dx += sx.d; guides.push({ v: sx.l }); }
      if (sy) { dy += sy.d; guides.push({ h: sy.l }); }
    }
    for (const o of orig) { o.el.x = Math.round(o.x + dx); o.el.y = Math.round(o.y + dy); }
    renderPage(); syncGeom();
  }, () => {
    guides = [];
    renderOverlay();
    if (moved) { scheduleThumbs(); scheduleSave(); commit(); }
  });
}

function startResize(hx, hy) {
  const el = selEls()[0];
  const o = { ...el }, th = (o.rot * Math.PI) / 180, cos = Math.cos(th), sin = Math.sin(th);
  const c0 = { x: o.x + o.w / 2, y: o.y + o.h / 2 }, ax = (-hx * o.w) / 2, ay = (-hy * o.h) / 2;
  const lines = snapLines(new Set([el.id]));
  let moved = false;
  beginDrag((ev, p) => {
    moved = true;
    const dx = p.x - c0.x, dy = p.y - c0.y;
    let lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos;
    guides = [];
    const keep = hx && hy && ((el.type === 'image' || el.type === 'model') !== ev.shiftKey);
    if (!o.rot && !ev.altKey && !keep) {
      const sx = hx && snap1([c0.x + lx], lines.xs), sy = hy && snap1([c0.y + ly], lines.ys);
      if (sx) { lx += sx.d; guides.push({ v: sx.l }); }
      if (sy) { ly += sy.d; guides.push({ h: sy.l }); }
    }
    let w = hx ? Math.max(8, hx * (lx - ax)) : o.w, hh = hy ? Math.max(8, hy * (ly - ay)) : o.h;
    if (keep) { const s = Math.max(w / o.w, hh / o.h); w = o.w * s; hh = o.h * s; }
    const nx = ax + (hx * w) / 2, ny = ay + (hy * hh) / 2;
    const cx = c0.x + nx * cos - ny * sin, cy = c0.y + nx * sin + ny * cos;
    el.w = Math.round(w); el.h = Math.round(hh);
    el.x = Math.round(cx - w / 2); el.y = Math.round(cy - hh / 2);
    tip = { x: p.x, y: p.y, text: `${el.w} × ${el.h}` };
    renderPage(); syncGeom();
  }, () => {
    guides = []; tip = null;
    renderPage();
    if (moved) { scheduleThumbs(); scheduleSave(); commit(); if (el.type === 'model') setTimeout(() => snapPoster(el.id), 100); }
  });
}

function startRotate() {
  const el = selEls()[0];
  const c = { x: el.x + el.w / 2, y: el.y + el.h / 2 };
  beginDrag((ev, p) => {
    let a = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
    if (ev.shiftKey) a = Math.round(a / 15) * 15;
    else { const q = Math.round(a / 45) * 45; if (Math.abs(a - q) < 3) a = q; }
    a = ((a + 540) % 360) - 180;
    el.rot = Math.round(a * 10) / 10;
    tip = { x: p.x, y: p.y, text: `${el.rot}°` };
    renderPage(); syncGeom();
  }, () => { tip = null; renderOverlay(); scheduleThumbs(); scheduleSave(); commit(); });
}

function startMarquee(p0, add) {
  const base = add ? new Set(state.sel) : new Set();
  beginDrag((ev, p) => {
    marquee = { l: Math.min(p0.x, p.x), t: Math.min(p0.y, p.y), r: Math.max(p0.x, p.x), b: Math.max(p0.y, p.y) };
    const hit = curPage().els.filter((el) => {
      const b = aabb(el);
      return b.l < marquee.r && b.r > marquee.l && b.t < marquee.b && b.b > marquee.t;
    });
    state.sel = new Set([...base, ...hit.map((e) => e.id)]);
    renderOverlay();
  }, () => { marquee = null; renderOverlay(); insp(); });
}

stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const hd = e.target.closest('.h,.rot');
  if (hd) {
    e.preventDefault();
    if (hd.classList.contains('rot')) startRotate();
    else { const [hx, hy] = hd.dataset.h.split(',').map(Number); startResize(hx, hy); }
    return;
  }
  const n = e.target.closest('#page .el');
  const id = n && n.dataset.id;
  if (id && (state.editing === id || state.interact === id)) return;
  if (id && e.target.closest('.mfv-bar')) {
    if (!state.sel.has(id)) { exitModes(); setSel([id]); }
    return;
  }
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  exitModes();
  // スクロールバー上のクリックは選択操作にしない
  if (e.target === stage && (e.offsetX > stage.clientWidth || e.offsetY > stage.clientHeight)) return;
  e.preventDefault();
  const p = pagePt(e);
  if (!id) {
    if (!e.shiftKey) setSel([]);
    startMarquee(p, e.shiftKey);
    return;
  }
  if (e.shiftKey) {
    const s = new Set(state.sel);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSel(s);
    if (!s.has(id)) return;
  } else if (!state.sel.has(id)) setSel([id]);
  startMove(p);
});

stage.addEventListener('dblclick', (e) => {
  const n = e.target.closest('#page .el');
  if (!n || e.target.closest('.mfv-bar')) return;
  const el = findEl(n.dataset.id);
  if (!el || state.editing === el.id || state.interact === el.id) return;
  if (el.type === 'text') enterEdit(el.id);
  else if (el.type === 'model' && !el.asset) pickFiles('#fileGlb', (files) => fillModel(el, files[0]));
  else if (el.type === 'model') enterInteract(el.id);
  else if (el.type === 'image') pickFiles('#fileImg', (files) => replaceImage(el, files[0]));
});

pageEl.addEventListener('input', () => {
  const el = state.editing && findEl(state.editing);
  if (!el) return;
  el.html = nodes.get(el.id).firstElementChild.innerHTML;
  touch();
});
pageEl.addEventListener('click', (e) => { if (e.target.closest('a')) e.preventDefault(); });
// 箇条書きの中では Tab で 1 段下げ、Shift+Tab で戻す
pageEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !state.editing) return;
  const n = getSelection().anchorNode, li = n && (n.nodeType === 1 ? n : n.parentNode).closest('li');
  if (!li) return;
  e.preventDefault();
  document.execCommand(e.shiftKey ? 'outdent' : 'indent');
  const el = findEl(state.editing);
  el.html = nodes.get(el.id).firstElementChild.innerHTML;
  touch();
});

stage.addEventListener('wheel', (e) => {
  if (!e.ctrlKey || state.interact) return;
  e.preventDefault();
  state.zoomMode = +clamp(state.zoom * Math.exp(-e.deltaY * 0.0015), 0.1, 4).toFixed(2);
  applyZoom();
}, { passive: false });
new ResizeObserver(() => { if (state.doc && state.zoomMode === 'fit') applyZoom(); }).observe(stage);

/* ---------- 要素の追加 ---------- */

function baseEl(type, w, hh, extra) {
  const d = state.doc;
  return {
    id: uid(), type, x: Math.round((d.w - w) / 2), y: Math.round((d.h - hh) / 2), w, h: hh, rot: 0, opacity: 1, locked: false,
    radius: 0, shadow: false, borderW: 0, borderC: INK, ...extra,
  };
}
function addEl(el, pt) {
  const els = curPage().els;
  if (pt) { el.x = Math.round(pt.x - el.w / 2); el.y = Math.round(pt.y - el.h / 2); }
  else while (els.some((o) => o.x === el.x && o.y === el.y)) { el.x += 24; el.y += 24; }
  els.push(el);
  state.sel = new Set([el.id]);
  touch(); commit(); insp();
  return el;
}
function makeText(preset, html = '', extra = {}) {
  const d = state.doc, m = Math.round(d.w * 0.08), big = preset === 'title' || preset === 'heading';
  const { label, ...p } = TEXT_PRESETS[preset];
  return baseEl('text', big ? d.w - m * 2 : Math.min(420, d.w - m * 2), 40, {
    html, autoH: true, vertical: false, ...TEXT_BASE, ...p, preset, ...extra,
  });
}
function makeShape(kind) {
  const base = { shape: kind, fill: '#0a84ff' };
  if (kind === 'line') return baseEl('shape', 320, 3, { ...base, shape: 'rect', fill: INK });
  if (kind === 'arrow') return baseEl('shape', 220, 28, { ...base, fill: '#ff3b30', strokeW: 4 });
  if (kind === 'round') return baseEl('shape', 240, 160, { ...base, shape: 'rect', radius: 24 });
  if (kind === 'ellipse') return baseEl('shape', 200, 200, base);
  return baseEl('shape', 240, 160, base);
}

function newAsset(blob, name, type) {
  const a = { id: uid(), name, type, mime: blob.type || (type === 'glb' ? 'model/gltf-binary' : 'image/png'), blob, url: URL.createObjectURL(blob) };
  assets.set(a.id, a);
  idb.put('assets', a.id, { id: a.id, name: a.name, type: a.type, mime: a.mime, blob: a.blob });
  return a;
}
function imageSize(url) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth || 400, h: im.naturalHeight || 300 });
    im.onerror = () => res({ w: 400, h: 300 });
    im.src = url;
  });
}
async function insertImage(file, pt) {
  const a = newAsset(file, file.name || 'image', 'image');
  const s = await imageSize(a.url), d = state.doc;
  const k = Math.min(1, (d.w * 0.6) / s.w, (d.h * 0.5) / s.h);
  addEl(baseEl('image', Math.round(s.w * k), Math.round(s.h * k), { asset: a.id, fit: 'contain' }), pt);
}
async function replaceImage(el, file) {
  if (!file) return;
  el.asset = newAsset(file, file.name, 'image').id;
  touch(); commit();
}
function makeModel(assetId) {
  const d = state.doc, w = Math.round(Math.min(560, d.w * 0.72));
  return baseEl('model', w, Math.round(w * 0.68), {
    asset: assetId, clip: 0, autoplay: true, loop: true, speed: 1, controls: true, grid: true, skeleton: false, wire: false,
    autoRotate: false, exposure: 1, fps: 0, time: 0, cam: null, bg: '#f2f2f4', radius: 12, keys: true, order: null,
  });
}
function fillModel(el, file) {
  if (!file) return;
  Object.assign(el, { asset: newAsset(file, file.name || 'model.glb', 'glb').id, clip: 0, time: 0, cam: null, order: null });
  touch(); commit(); insp();
}
function emptySlotAt(pt, type) {
  if (!pt) return null;
  return [...curPage().els].reverse().find((el) => {
    const b = aabb(el);
    return el.type === type && !el.asset && pt.x >= b.l && pt.x <= b.r && pt.y >= b.t && pt.y <= b.b;
  });
}
function insertModel(file, pt) { addEl(makeModel(newAsset(file, file.name || 'model.glb', 'glb').id), pt); }
function sampleBlob() {
  return new Blob([Uint8Array.from(atob(window.MF_SAMPLE_GLB), (c) => c.charCodeAt(0))], { type: 'model/gltf-binary' });
}
function handleFiles(files, pt) {
  let n = 0;
  for (const f of files) {
    const name = (f.name || '').toLowerCase();
    const at = pt && { x: pt.x + n * 24, y: pt.y + n * 24 };
    const isGlb = /\.(glb|gltf|vrm)$/.test(name), isImg = f.type.startsWith('image/');
    const slot = !n && emptySlotAt(pt, isGlb ? 'model' : 'image');
    if (slot && isGlb) { fillModel(slot, f); setSel([slot.id]); n++; }
    else if (slot && isImg) { replaceImage(slot, f); setSel([slot.id]); n++; }
    else if (isGlb) { insertModel(f, at); n++; }
    else if (isImg) { insertImage(f, at); n++; }
    else if (/\.mfolio$/.test(name)) { openProject(f); return; }
  }
  if (!n) toast('画像か glb ファイルを追加できます');
}
function pickFiles(sel, fn) {
  const inp = $(sel);
  inp.value = '';
  inp.onchange = () => { if (inp.files.length) fn([...inp.files]); };
  inp.click();
}

/* ---------- 並べ替え・整列・複製 ---------- */

function reorder(mode) {
  const els = curPage().els, sel = selEls();
  if (!sel.length) return;
  const rest = els.filter((e) => !state.sel.has(e.id));
  let at = els.indexOf(mode === 'front' || mode === 'up' ? sel[sel.length - 1] : sel[0]);
  if (mode === 'front') at = rest.length;
  else if (mode === 'back') at = 0;
  else if (mode === 'up') at = Math.min(rest.length, at - sel.length + 2);
  else at = Math.max(0, at - 1);
  rest.splice(at, 0, ...sel);
  curPage().els = rest;
  touch(); commit();
}
function align(mode) {
  const sel = selEls().filter((e) => !e.locked);
  if (!sel.length) return;
  const d = state.doc, b = sel.length > 1 ? bounds(sel) : { l: 0, t: 0, r: d.w, b: d.h };
  for (const el of sel) {
    const a = aabb(el);
    if (mode === 'l') el.x += b.l - a.l;
    if (mode === 'c') el.x += (b.l + b.r) / 2 - (a.l + a.r) / 2;
    if (mode === 'r') el.x += b.r - a.r;
    if (mode === 't') el.y += b.t - a.t;
    if (mode === 'm') el.y += (b.t + b.b) / 2 - (a.t + a.b) / 2;
    if (mode === 'b') el.y += b.b - a.b;
    el.x = Math.round(el.x); el.y = Math.round(el.y);
  }
  touch(); commit(); syncGeom();
}
function distribute(axis) {
  const sel = selEls().filter((e) => !e.locked);
  if (sel.length < 3) return;
  const k = axis === 'x' ? ['l', 'r', 'x'] : ['t', 'b', 'y'];
  const items = sel.map((el) => ({ el, a: aabb(el) })).sort((p, q) => p.a[k[0]] - q.a[k[0]]);
  const total = items.reduce((s, it) => s + (it.a[k[1]] - it.a[k[0]]), 0);
  const gap = (items[items.length - 1].a[k[1]] - items[0].a[k[0]] - total) / (items.length - 1);
  let pos = items[0].a[k[0]];
  for (const it of items) {
    it.el[k[2]] = Math.round(it.el[k[2]] + pos - it.a[k[0]]);
    pos += it.a[k[1]] - it.a[k[0]] + gap;
  }
  touch(); commit(); syncGeom();
}
function cloneEls(els, dx, dy) {
  return els.map((el) => {
    const c = JSON.parse(JSON.stringify(el));
    c.id = uid(); c.x += dx; c.y += dy;
    if (posters[el.id]) posters[c.id] = posters[el.id];
    return c;
  });
}
function duplicateSel() {
  const cs = cloneEls(selEls(), 24, 24);
  if (!cs.length) return;
  curPage().els.push(...cs);
  state.sel = new Set(cs.map((c) => c.id));
  touch(); commit(); insp();
}
function deleteSel() {
  if (!state.sel.size) return;
  exitModes();
  curPage().els = curPage().els.filter((e) => !state.sel.has(e.id));
  state.sel.clear();
  touch(); commit(); insp();
}
function pasteClip() {
  if (!clip) return;
  clip.n++;
  const cs = cloneEls(clip.els, 24 * clip.n, 24 * clip.n);
  curPage().els.push(...cs);
  state.sel = new Set(cs.map((c) => c.id));
  touch(); commit(); insp();
}

/* ---------- インスペクタ ---------- */

const first = () => selEls()[0];
function setProp(key, val) {
  const f = first();
  if (!f) return;
  for (const t of selEls()) if (COMMON.has(key) || t.type === f.type) t[key] = val;
  touch();
}
const fmt = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);

const C = {
  num(key, o = {}) {
    const i = h('input', { type: 'number', step: o.step || 1, min: o.min, max: o.max, 'data-key': key });
    i.value = fmt(first()[key]);
    i.addEventListener('input', () => {
      let v = parseFloat(i.value);
      if (isNaN(v)) return;
      if (o.min != null) v = Math.max(o.min, v);
      if (o.max != null) v = Math.min(o.max, v);
      setProp(key, v);
    });
    i.addEventListener('change', () => commit());
    return i;
  },
  range(key, min, max, step, show = (v) => v) {
    const val = h('span', { class: 'val' }, show(first()[key]));
    const i = h('input', { type: 'range', min, max, step });
    i.value = first()[key];
    i.addEventListener('input', () => { setProp(key, +i.value); val.textContent = show(+i.value); });
    i.addEventListener('change', () => commit());
    return [i, val];
  },
  color(key, none) {
    const cur = first()[key];
    const i = h('input', { type: 'color' });
    i.value = cur || '#ffffff';
    const wrap = h('span', { class: 'color' });
    let chk = null;
    if (none) {
      chk = h('input', { type: 'checkbox', title: '塗りを使う' });
      chk.checked = !!cur;
      chk.addEventListener('change', () => { setProp(key, chk.checked ? i.value : ''); commit(); });
      wrap.append(chk);
    }
    i.addEventListener('input', () => { if (chk) chk.checked = true; setProp(key, i.value); });
    i.addEventListener('change', () => commit());
    wrap.append(i);
    return wrap;
  },
  sel(key, opts, o = {}) {
    const s = h('select', {}, opts.map(([v, l]) => h('option', { value: v }, l)));
    s.value = first()[key];
    s.addEventListener('change', () => { setProp(key, o.num ? +s.value : s.value); commit(); if (o.after) o.after(); });
    return s;
  },
  check(key, label, after) {
    const i = h('input', { type: 'checkbox' });
    i.checked = !!first()[key];
    i.addEventListener('change', () => { setProp(key, i.checked); if (after) after(i.checked); commit(); });
    return h('label', { class: 'chk grow' }, i, label);
  },
  seg(key, opts) {
    const box = h('div', { class: 'seg' });
    for (const [v, html, title] of opts) {
      const b = h('button', { html, title, class: first()[key] === v ? 'on' : '' });
      b.addEventListener('click', () => { setProp(key, v); commit(); $$('button', box).forEach((x) => x.classList.toggle('on', x === b)); });
      box.append(b);
    }
    return box;
  },
  btn(html, fn, o = {}) {
    const b = h('button', { class: 'btn' + (o.cls ? ' ' + o.cls : ''), html, title: o.title });
    // テキスト編集中の選択範囲を保つため、フォーカスを奪わない
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', fn);
    return b;
  },
};
const row = (label, ...c) => h('div', { class: 'row' }, label ? h('span', { class: 'lbl' }, label) : null, ...c);
const sec = (title, ...rows) => h('div', { class: 'sec' }, title ? h('div', { class: 'sec-title' }, title) : null, ...rows);
const pair = (label, ctl) => h('span', { class: 'pair' }, h('span', {}, label), ctl);
const hint = (t) => h('div', { class: 'hint' }, t);

function syncGeom() {
  const el = first();
  if (!el) return;
  for (const i of $$('#inspector [data-key]')) {
    if (document.activeElement !== i && COMMON.has(i.dataset.key)) i.value = fmt(el[i.dataset.key]);
  }
}

function docPanel() {
  const d = state.doc, pg = curPage();
  const title = h('input', { type: 'text', value: d.title });
  title.addEventListener('input', () => { d.title = title.value; scheduleSave(); });
  title.addEventListener('change', () => commit());
  const cur = SIZES.findIndex((s) => s[1] === d.w && s[2] === d.h);
  const size = h('select', {}, SIZES.map((s, i) => h('option', { value: i }, `${s[0]}（${s[1]}×${s[2]}）`)), h('option', { value: -1 }, 'カスタム'));
  size.value = cur;
  const setSize = (w, hh) => { d.w = w; d.h = hh; refreshAll(); commit(); };
  size.addEventListener('change', () => { const s = SIZES[+size.value]; if (s) setSize(s[1], s[2]); });
  const wI = h('input', { type: 'number', min: 200, max: 4000, value: d.w }), hI = h('input', { type: 'number', min: 200, max: 4000, value: d.h });
  const onWH = () => { const w = +wI.value, hh = +hI.value; if (w >= 200 && hh >= 200) setSize(w, hh); };
  wI.addEventListener('change', onWH); hI.addEventListener('change', onWH);
  const bg = h('input', { type: 'color', value: pg.bg });
  bg.addEventListener('input', () => { pg.bg = bg.value; touch(); });
  bg.addEventListener('change', () => commit());
  const vbg = h('select', {}, [['#e9e9ec', 'ライト'], ['#f7f5f0', '紙色'], ['#1c1c1e', 'ダーク']].map(([v, l]) => h('option', { value: v }, l)));
  vbg.value = d.viewBg;
  vbg.addEventListener('change', () => { d.viewBg = vbg.value; scheduleSave(); commit(); });
  const flow = h('select', {}, [['paged', 'ページ送り'], ['scroll', '縦スクロール'], ['seamless', '縦スクロール（つなげる）']].map(([v, l]) => h('option', { value: v }, l)));
  flow.value = d.flow || 'scroll';
  flow.addEventListener('change', () => { d.flow = flow.value; scheduleSave(); commit(); insp(); });
  return [
    h('div', { class: 'insp-head' }, '書類'),
    sec('書類', row('タイトル', title), row('ページサイズ', size), row('', pair('W', wI), pair('H', hI))),
    sec('書き出した HTML の読み方', row('形式', flow), row('背景', vbg),
      hint({ paged: '1 ページずつ表示し、矢印キーやボタンでめくります。', scroll: 'ページを縦に並べ、スクロールで読み進めます。', seamless: 'ページの切れ目をなくし、1 枚の長い紙面として読めます。' }[d.flow || 'scroll'])),
    sec(`ページ ${state.pageIdx + 1}`, row('背景色', h('span', { class: 'color' }, bg))),
    sec('使い方',
      hint('ツールバーからテキスト・図形・画像・3D を追加します。画像と glb はドラッグ＆ドロップでも入れられます。'),
      hint('テキストはダブルクリックで編集、3D はダブルクリックで視点とポーズを決めます。'),
      hint('Shift で縦横比や移動方向を固定、Alt でスナップを一時的に切ります。')),
  ];
}

function textPanel(el) {
  const presets = h('div', { class: 'presets' }, Object.entries(TEXT_PRESETS).map(([k, p]) =>
    C.btn(p.label, () => {
      const { label, ...v } = p;
      for (const t of selEls()) if (t.type === 'text') Object.assign(t, TEXT_BASE, { align: t.align }, v, { preset: k });
      touch(); commit(); insp();
    }, { cls: el.preset === k ? 'on' : '' })));
  return [
    sec('スタイル', presets),
    sec('文字',
      row('フォント', C.sel('font', Object.entries(FONTS).map(([k, f]) => [k, f.n]))),
      row('太さ', C.sel('weight', [[400, '標準'], [500, '中'], [700, '太字'], [900, '極太']], { num: true })),
      row('サイズ', C.num('size', { min: 6, max: 400 }), h('span', { class: 'color' }, C.color('color'))),
      row('装飾', h('div', { class: 'btns' },
        TEXT_CMDS.map((c) => C.btn(c.html, c.run, { title: `${c.title}（${keyLabel(c.key, c.shift)}）` })))),
      row('技術書', h('div', { class: 'btns tech' },
        TECH_CMDS.map((c) => C.btn(c.html, c.run, { title: `${c.title}（${keyLabel(c.key, c.shift)}）` })))),
      row('マウス', h('div', { class: 'btns tech' }, MOUSE_CMDS.map((c) => C.btn(c.html, c.run, { title: c.title + 'の図を挿入' })))),
      row('箇条書き', h('div', { class: 'list-grid' }, LISTS.map((l) => C.btn(l.label, () => setList(l.id), {
        title: l.title + (l.id === 'disc' ? `（${keyLabel('8', true)}）` : l.id === 'num' ? `（${keyLabel('7', true)}）` : ''),
      })))),
      row('行揃え', C.seg('align', [['left', IC.tl, '左揃え'], ['center', IC.tc, '中央揃え'], ['right', IC.tr, '右揃え'], ['justify', IC.tj, '両端揃え']])),
      row('行間', ...C.range('lh', 1, 3, 0.05, (v) => v.toFixed(2))),
      row('字間', ...C.range('ls', -0.05, 0.4, 0.01, (v) => v.toFixed(2)))),
    sec('ボックス',
      row('背景', C.color('bg', true)),
      row('余白', C.num('pad', { min: 0, max: 200 })),
      row('', C.check('autoH', '高さを内容に合わせる', () => insp())),
      row('', C.check('vertical', '縦書き', (on) => {
        for (const t of selEls()) if (t.type === 'text') { t.autoH = !on; if (on) { t.h = Math.max(t.h, 320); } }
        touch(); insp();
      }))),
  ];
}

function imagePanel(el) {
  return [sec('画像',
    row('収め方', C.seg('fit', [['contain', '全体', '画像全体を表示'], ['cover', '切り抜き', '枠いっぱいに表示'], ['fill', '引き伸ばし', '枠に合わせて変形']])),
    row('', C.btn('画像を差し替え…', () => pickFiles('#fileImg', (f) => replaceImage(el, f[0])))))];
}

function shapePanel(el) {
  const rows = [row('塗り', C.color('fill', el.shape !== 'arrow'))];
  if (el.shape === 'arrow') rows.push(row('線の太さ', C.num('strokeW', { min: 1, max: 40 })));
  return [sec('図形', ...rows)];
}

// 著者が決めたクリップの並び（元の番号の配列）。null は glb の順のまま全部見せる
function clipOrder(el, n) {
  const seen = new Set();
  const o = (Array.isArray(el.order) ? el.order : []).filter((i) => Number.isInteger(i) && i >= 0 && i < n && !seen.has(i) && seen.add(i));
  return o.length ? o : [...Array(n).keys()];
}
function clipList(el, names) {
  const n = names.length, order = clipOrder(el, n);
  const apply = (o) => {
    el.order = o.length === n && o.every((x, i) => x === i) ? null : o;
    if (!o.includes(el.clip)) { el.clip = o[0]; el.time = 0; }
    touch(); commit(); insp();
  };
  const move = (pos, d) => { const o = [...order]; [o[pos], o[pos + d]] = [o[pos + d], o[pos]]; apply(o); };
  const item = (i, pos) => {
    const shown = pos >= 0;
    const chk = h('input', { type: 'checkbox', title: '再生バーの一覧に出す' });
    chk.checked = shown;
    chk.disabled = shown && order.length === 1;
    chk.addEventListener('change', () => apply(shown ? order.filter((x) => x !== i) : [...order, i]));
    const name = h('span', { class: 'clip-name', title: '最初に表示するクリップにする' }, names[i]);
    name.addEventListener('click', () => { if (!shown) return; el.clip = i; el.time = 0; touch(); commit(); insp(); });
    return h('div', { class: 'clip-row' + (i === el.clip ? ' cur' : '') + (shown ? '' : ' off') }, chk, name,
      shown ? C.btn('↑', () => pos > 0 && move(pos, -1), { title: '上へ', cls: pos > 0 ? '' : 'dim' }) : null,
      shown ? C.btn('↓', () => pos < order.length - 1 && move(pos, 1), { title: '下へ', cls: pos < order.length - 1 ? '' : 'dim' }) : null);
  };
  return h('div', { class: 'clips' }, order.map((i, pos) => item(i, pos)), [...Array(n).keys()].filter((i) => !order.includes(i)).map((i) => item(i, -1)));
}

function modelPanel(el) {
  if (!el.asset) return [sec('アニメーション', hint('枠に glb をドロップするか、ダブルクリックして選びます。'),
    row('', C.btn('glb を選ぶ…', () => pickFiles('#fileGlb', (f) => fillModel(el, f[0])))))];
  if (el.keys === undefined) el.keys = true;
  const rec = viewers.get(el.id), v = rec && rec.v.ready ? rec.v : null, names = v ? v.clipNames : [];
  const a = assets.get(el.asset);
  const rows = [];
  if (names.length > 1) rows.push(clipList(el, names), hint('名前をクリックすると最初に表示するクリップになります。チェックを外したクリップは再生バーの一覧に出ません。'));
  else if (!names.length) rows.push(hint(v ? 'この glb にはアニメーションが含まれていません。' : '読み込み中…'));
  if (v && el.keys !== false) {
    const src = { meta: 'glb に同梱された元のキー位置', estimated: '値の変化から推定（全フレームが焼き込まれた glb）', tracks: 'glb に記録されたキー' }[v.keySource];
    if (src) rows.push(hint(`キーの印：${src}、${v.keys.length} 個`));
  }
  const fileFps = v && v.meta[v.clipIdx] && v.meta[v.clipIdx].fps;
  return [
    sec('アニメーション',
      hint(a ? a.name : ''),
      ...rows,
      row('', C.check('autoplay', '自動再生'), C.check('loop', 'ループ')),
      row('速度', C.sel('speed', [[0.1, '0.1×'], [0.25, '0.25×'], [0.5, '0.5×'], [1, '1×'], [2, '2×']], { num: true })),
      row('fps', C.sel('fps', [[0, `自動（${fileFps || 30} fps）`], [12, '12 fps'], [24, '24 fps'], [30, '30 fps'], [60, '60 fps']], { num: true })),
      row('開始（秒）', C.num('time', { min: 0, step: 0.01 })),
      hint('自動再生を切ると、開始位置のポーズで止まった図になります。再生バーを動かして決められます。黄色の印が記録されているキーフレームで、Shift を押しながらコマ送りボタンを押すと印へ飛びます。')),
    sec('表示',
      row('', C.check('controls', '再生バー'), C.check('keys', 'キーフレーム')),
      row('', C.check('grid', 'グリッド'), C.check('autoRotate', '自動で回す')),
      row('', C.check('skeleton', 'スケルトン'), C.check('wire', 'ワイヤー')),
      row('明るさ', ...C.range('exposure', 0.3, 2.5, 0.05, (v) => v.toFixed(2))),
      row('背景', C.color('bg', true)),
      row('', h('div', { class: 'btns' },
        C.btn('視点を調整', () => enterInteract(el.id)),
        C.btn('視点をリセット', () => { setProp('cam', null); commit(); setTimeout(() => snapPoster(el.id), 100); }))),
      row('', C.btn('glb を差し替え…', () => pickFiles('#fileGlb', (f) => {
        el.asset = newAsset(f[0], f[0].name, 'glb').id; el.clip = 0; el.time = 0; el.cam = null; el.order = null;
        touch(); commit(); insp();
      })))),
  ];
}

function arrangePanel(sel) {
  const many = sel.length > 1;
  const alignBtns = [['l', IC.al, '左'], ['c', IC.ac, '左右中央'], ['r', IC.ar, '右'], ['t', IC.at, '上'], ['m', IC.am, '上下中央'], ['b', IC.ab, '下']]
    .map(([m, ic, t]) => C.btn(ic, () => align(m), { title: (many ? '選択範囲の' : 'ページの') + t + 'に揃える' }));
  return [
    sec('外観',
      row('不透明度', ...C.range('opacity', 0.05, 1, 0.05, (v) => Math.round(v * 100) + '%')),
      row('角丸', C.num('radius', { min: 0, max: 500 })),
      row('枠線', C.num('borderW', { min: 0, max: 40 }), C.color('borderC')),
      row('', C.check('shadow', '影をつける'))),
    sec('配置',
      row('位置', pair('X', C.num('x')), pair('Y', C.num('y'))),
      row('サイズ', pair('W', C.num('w', { min: 1 })), pair('H', C.num('h', { min: 1 }))),
      row('回転', C.num('rot', { min: -180, max: 180 }), h('span', { class: 'val' }, '度')),
      row('整列', h('div', { class: 'btns' }, alignBtns)),
      many && sel.length > 2 ? row('均等配置', h('div', { class: 'btns' }, C.btn('横', () => distribute('x')), C.btn('縦', () => distribute('y')))) : null,
      row('重ね順', h('div', { class: 'btns' },
        C.btn('最前面', () => reorder('front')), C.btn('前へ', () => reorder('up')),
        C.btn('後ろへ', () => reorder('down')), C.btn('最背面', () => reorder('back')))),
      row('', C.check('locked', '位置をロック', () => renderOverlay())),
      row('', h('div', { class: 'btns' }, C.btn('複製', duplicateSel), C.btn('削除', deleteSel, { cls: 'danger' })))),
  ];
}

function insp() {
  const box = $('#inspector');
  box.innerHTML = '';
  const sel = selEls();
  if (!sel.length) { box.append(...docPanel()); return; }
  const el = sel[0], same = sel.every((e) => e.type === el.type);
  box.append(h('div', { class: 'insp-head' }, sel.length > 1 ? `${sel.length} 個のオブジェクト` : TYPE_NAME[el.type]));
  if (same) {
    const p = { text: textPanel, image: imagePanel, shape: shapePanel, model: modelPanel }[el.type](el);
    box.append(...p);
  }
  box.append(...arrangePanel(sel).filter(Boolean));
}

/* ---------- 保存（自動保存とプロジェクトファイル） ---------- */

const idb = {
  db: null,
  open() {
    return new Promise((res) => {
      try {
        const rq = indexedDB.open('motionfolio', 1);
        rq.onupgradeneeded = () => { rq.result.createObjectStore('kv'); rq.result.createObjectStore('assets'); };
        rq.onsuccess = () => { this.db = rq.result; res(); };
        rq.onerror = () => res();
      } catch { res(); }
    });
  },
  tx(store, mode, fn) {
    return new Promise((res) => {
      if (!this.db) return res(null);
      try {
        const rq = fn(this.db.transaction(store, mode).objectStore(store));
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => res(null);
      } catch { res(null); }
    });
  },
  put(store, key, val) { return this.tx(store, 'readwrite', (s) => s.put(val, key)); },
  get(store, key) { return this.tx(store, 'readonly', (s) => s.get(key)); },
  all(store) { return this.tx(store, 'readonly', (s) => s.getAll()); },
  clear(store) { return this.tx(store, 'readwrite', (s) => s.clear()); },
};
let saveT = 0;
function scheduleSave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => idb.put('kv', 'doc', { doc: state.doc, posters, pageIdx: state.pageIdx }), 700);
}

function usedAssets() {
  const s = new Set();
  for (const pg of state.doc.pages) for (const el of pg.els) if (el.asset) s.add(el.asset);
  return s;
}
const blobToDataURL = (blob) => new Promise((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result);
  fr.onerror = () => rej(fr.error);
  fr.readAsDataURL(blob);
});

async function saveBlob(blob, name, accept, ref) {
  if (window.showSaveFilePicker) {
    try {
      let hd = ref && ref.h;
      if (!hd) {
        hd = await showSaveFilePicker({ suggestedName: name, types: [{ description: 'MotionFolio', accept }] });
        if (ref) ref.h = hd;
      }
      const w = await hd.createWritable();
      await w.write(blob);
      await w.close();
      return hd.name;
    } catch (e) {
      if (e.name === 'AbortError') return null;
      if (ref) ref.h = null;
    }
  }
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return name;
}
const fileBase = () => (state.doc.title || 'untitled').replace(/[\\/:*?"<>|]/g, '_');

async function saveProject() {
  exitModes();
  const used = usedAssets();
  const parts = ['{"format":"motionfolio","version":1,"doc":', JSON.stringify(state.doc), ',"posters":', JSON.stringify(posters), ',"assets":['];
  let n = 0;
  for (const a of assets.values()) {
    if (!used.has(a.id)) continue;
    parts.push((n++ ? ',' : '') + JSON.stringify({ id: a.id, name: a.name, type: a.type, mime: a.mime, data: await blobToDataURL(a.blob) }));
  }
  parts.push(']}');
  const name = await saveBlob(new Blob(parts, { type: 'application/json' }), fileBase() + '.mfolio', { 'application/json': ['.mfolio'] }, fileRef);
  if (name) toast(`${name} を保存しました`);
}

function clearAll() {
  for (const id of [...nodes.keys()]) destroyNode(id);
  for (const a of assets.values()) URL.revokeObjectURL(a.url);
  assets.clear();
  posters = {};
  state.sel.clear(); state.editing = null; state.interact = null; state.pageIdx = 0;
  fileRef.h = null;
  return idb.clear('assets');
}

async function openProject(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
    if (data.format !== 'motionfolio' || !data.doc) throw new Error('format');
  } catch { toast('MotionFolio のプロジェクトファイルではありません'); return; }
  await clearAll();
  for (const a of data.assets || []) {
    const blob = await (await fetch(a.data)).blob();
    const rec = { id: a.id, name: a.name, type: a.type, mime: a.mime, blob, url: URL.createObjectURL(blob) };
    assets.set(a.id, rec);
    idb.put('assets', a.id, { id: a.id, name: a.name, type: a.type, mime: a.mime, blob });
  }
  state.doc = data.doc;
  posters = data.posters || {};
  refreshAll(); resetHistory();
  toast(`${file.name} を開きました`);
}

function blankDoc() {
  return { title: '名称未設定', w: 794, h: 1123, viewBg: '#e9e9ec', flow: 'scroll', pages: [{ id: uid(), bg: '#ffffff', els: [] }] };
}
async function newDoc() {
  if (!confirm('現在の書類を閉じて、新しい書類を作りますか？\n保存していない変更は失われます。')) return;
  await clearAll();
  state.doc = blankDoc();
  curPage().els = templateEls('cover');
  refreshAll(); resetHistory();
}

// ページテンプレート。位置はページサイズに対する比率で決めるので、どの判型でも収まる
const ACCENT = '#0071e3';
const TEMPLATES = {
  blank: { label: '空白', note: '', make: () => [] },
  cover: { label: '表紙', note: 'タイトルと図', make: (g) => [
    g.S(g.m, g.y(120), 56, 6),
    g.T('caption', 'ANIMATION TECHNICAL BOOK', g.m, g.y(146), g.cw, { ls: 0.24, weight: 700, color: ACCENT }),
    g.T('title', 'タイトルを入力', g.m, g.y(176), g.cw),
    g.T('body', 'この本で扱う内容を一文で。誰に向けた、何のための本かを書きます。', g.m, g.y(262), g.cw * 0.8, { size: 17, color: '#48484a' }),
    g.M(g.m, g.y(380), g.cw, g.y(520)),
    g.T('caption', '著者名　／　発行年', g.m, g.y(1010), g.cw),
  ] },
  chapter: { label: '章扉', note: '章番号と導入', make: (g) => [
    g.T('title', '01', g.m, g.y(170), g.cw, { size: Math.round(g.y(150)), color: ACCENT, lh: 1 }),
    g.T('heading', '章のタイトル', g.m, g.y(370), g.cw, { size: 36 }),
    g.S(g.m, g.y(440), 56, 6),
    g.T('body', 'この章で身につくことを、二、三行で予告します。読み終えたときに何ができるようになるのかを先に示すと、読者は安心して読み進められます。', g.m, g.y(476), g.cw * 0.78, { size: 16, color: '#48484a' }),
  ] },
  figure: { label: '図と本文', note: '大きな 3D ＋ 2 段組み', make: (g) => [
    g.T('caption', 'SECTION 1.1', g.m, g.y(64), g.cw, { ls: 0.2, weight: 700, color: ACCENT }),
    g.T('heading', '見出しを入力', g.m, g.y(88), g.cw),
    g.M(g.m, g.y(160), g.cw, g.y(430)),
    g.T('caption', '図 1　図の説明を入力。', g.m, g.y(604), g.cw),
    g.T('body', '本文を入力します。図で見せた動きのどこに注目してほしいのかを、最初の段落で伝えます。', g.m, g.y(660), g.col2),
    g.T('body', '続きの本文です。二段に分けると一行が短くなり、図の下でも読みやすくなります。', g.m + g.col2 + g.gap, g.y(660), g.col2),
  ] },
  side: { label: '図と解説', note: '左に 3D、右に要点', make: (g) => [
    g.T('heading', '見出しを入力', g.m, g.y(64), g.cw),
    g.M(g.m, g.y(140), g.cw * 0.58, g.y(500)),
    g.T('sub', 'ポイント', g.m + g.cw * 0.62, g.y(140), g.cw * 0.38),
    g.T('body', '図の隣に、見るべき点を短くまとめます。重心の移動、接地のタイミングなど。', g.m + g.cw * 0.62, g.y(184), g.cw * 0.38, { size: 13.5, lh: 1.8 }),
    g.T('caption', '図 1　図の説明を入力。', g.m, g.y(654), g.cw * 0.58),
    g.T('body', '本文を入力します。図と要点で掴んだ内容を、ここで順を追って説明します。', g.m, g.y(710), g.cw),
  ] },
  compare: { label: 'ポーズ比較', note: '3D を 2 つ並べる', make: (g) => [
    g.T('heading', '見出しを入力', g.m, g.y(64), g.cw),
    g.T('body', '二つの動きを並べ、何が違うのかを先に述べます。', g.m, g.y(126), g.cw, { color: '#48484a' }),
    g.M(g.m, g.y(200), g.col2, g.y(380)),
    g.M(g.m + g.col2 + g.gap, g.y(200), g.col2, g.y(380)),
    g.T('caption', 'A　修正前。', g.m, g.y(594), g.col2),
    g.T('caption', 'B　修正後。', g.m + g.col2 + g.gap, g.y(594), g.col2),
    g.T('sub', '違いはどこにあるか', g.m, g.y(660), g.cw),
    g.T('body', '本文を入力します。A と B の差を、フレーム番号を挙げながら説明します。', g.m, g.y(704), g.cw),
  ] },
  steps: { label: '手順', note: '番号つき 3 ステップ', make: (g) => [
    g.T('heading', '手順の見出し', g.m, g.y(64), g.cw),
    ...[0, 1, 2].flatMap((i) => {
      const y0 = g.y(160 + i * 300), ix = g.m + 56, iw = g.cw * 0.42, tx = ix + iw + g.gap;
      return [
        g.T('title', String(i + 1), g.m, y0 - 8, 50, { size: 44, color: ACCENT, lh: 1.1 }),
        g.I(ix, y0, iw, g.y(250)),
        g.T('sub', `ステップ ${i + 1} の見出し`, tx, y0, g.m + g.cw - tx),
        g.T('body', 'この手順で行う操作と、確認すべき結果を書きます。', tx, y0 + 42, g.m + g.cw - tx, { size: 13.5, lh: 1.8 }),
      ];
    }),
  ] },
  code: { label: 'コード解説', note: '本文とコード', make: (g) => [
    g.T('heading', '見出しを入力', g.m, g.y(64), g.cw),
    g.T('body', 'コードの前に、何をするための処理なのかを説明します。', g.m, g.y(130), g.cw),
    g.T('code', 'const mixer = new AnimationMixer(model);\nfor (const clip of gltf.animations) {\n  mixer.clipAction(clip).play();\n}', g.m, g.y(200), g.cw),
    g.T('body', 'コードの後に、要点を行ごとに補足します。', g.m, g.y(340), g.cw),
    g.M(g.m, g.y(420), g.cw, g.y(400)),
    g.T('caption', '図 1　実行結果。', g.m, g.y(834), g.cw),
  ] },
};
function templateEls(name) {
  const d = state.doc, R = Math.round, m = R(d.w * 0.08), cw = d.w - m * 2, gap = R(d.w * 0.035);
  const place = (el, x, y, w, hh) => Object.assign(el, { x: R(x), y: R(y), w: R(w) }, hh ? { h: R(hh) } : {});
  return TEMPLATES[name].make({
    m, cw, gap, col2: (cw - gap) / 2, y: (v) => (v * d.h) / 1123,
    T: (preset, html, x, y, w, extra) => place(makeText(preset, html, extra), x, y, w),
    M: (x, y, w, hh) => place(makeModel(null), x, y, w, hh),
    I: (x, y, w, hh) => place(baseEl('image', 10, 10, { asset: null, fit: 'contain', radius: 12 }), x, y, w, hh),
    S: (x, y, w, hh) => place(baseEl('shape', 10, 10, { shape: 'rect', fill: ACCENT }), x, y, w, hh),
  });
}
function addPage(name) {
  exitModes();
  state.doc.pages.splice(state.pageIdx + 1, 0, { id: uid(), bg: '#ffffff', els: [] });
  state.pageIdx++;
  curPage().els = templateEls(name);
  gotoPage(state.pageIdx); commit(); scheduleSave();
}
function pageMenu(anchor) {
  popup(anchor, Object.entries(TEMPLATES).map(([k, t]) => ({ label: t.label, note: t.note, fn: () => addPage(k) })));
}

function welcomeDoc() {
  state.doc = blankDoc();
  state.doc.title = 'MotionFolio へようこそ';
  const a = newAsset(sampleBlob(), 'bend.glb', 'glb');
  const T = (preset, html, x, y, w, extra) => ({ ...makeText(preset, html, extra), x, y, w });
  curPage().els.push(
    T('caption', 'MOTIONFOLIO', 64, 70, 400, { ls: 0.24, weight: 700, color: '#0071e3' }),
    T('title', '動きを、そのまま紙面に。', 64, 96, 666),
    T('body', 'テキスト・画像・図形を自由に配置し、glb のアニメーションをページの中で再生できるレイアウトエディターです。仕上がった書類は、単体で開ける HTML として書き出せます。', 64, 190, 620, { color: '#48484a' }),
    { ...makeModel(a.id), x: 64, y: 300, w: 666, h: 420 },
    T('caption', '図 1　サンプルの筒。ダブルクリックすると視点とポーズを調整できます。再生バーはそのまま書き出し先でも動きます。', 64, 734, 666),
    T('sub', '置く', 64, 800, 200),
    T('body', 'ツールバーから追加するか、画像や glb をウインドウへドラッグします。ガイドに吸着させながら位置を整えられます。', 64, 838, 200, { size: 13, lh: 1.8 }),
    T('sub', '動かす', 297, 800, 200),
    T('body', 'クリップ、速度、ループ、スケルトン表示を右のパネルで切り替えます。自動再生を切れば、任意のフレームで止めた図になります。', 297, 838, 200, { size: 13, lh: 1.8 }),
    T('sub', '書き出す', 530, 800, 200),
    T('body', '「HTML 書き出し」で、画像もモデルも埋め込んだ 1 ファイルにまとまります。ブラウザだけで読め、印刷にも対応します。', 530, 838, 200, { size: 13, lh: 1.8 }),
  );
}

/* ---------- HTML 書き出し ---------- */

// 書き出した HTML とプレビューのタブに付けるアイコン。エディター（青地）と見分けられるよう配色を反転している
const READER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect x="3" y="3" width="58" height="58" rx="13" fill="#fff" stroke="#0071e3" stroke-width="6"/>' +
  '<path d="M24 20v24l20-12z" fill="#0071e3" stroke="#0071e3" stroke-width="5" stroke-linejoin="round"/>' +
  '<rect x="42" y="8" width="13" height="13" rx="2.5" transform="rotate(45 48.5 14.5)" fill="#ffd60a" stroke="#fff" stroke-width="2.5"/></svg>';

async function buildHTML() {
  exitModes();
  const d = state.doc, used = usedAssets();
  const urls = new Map(), glbs = [];
  for (const a of assets.values()) {
    if (!used.has(a.id)) continue;
    const data = await blobToDataURL(a.blob);
    if (a.type === 'image') urls.set(a.id, data);
    else glbs.push(`<script type="application/octet-stream" id="mf-asset-${a.id}">${data.slice(data.indexOf(',') + 1)}</script>\n`);
  }
  const ctx = { mode: 'export', img: (id) => urls.get(id) || '' };
  const fonts = new Set();
  for (const pg of d.pages) for (const el of pg.els) if (el.type === 'text' && FONTS[el.font] && FONTS[el.font].g) fonts.add(el.font);
  const dark = parseInt(d.viewBg.slice(1, 3), 16) < 128, flow = d.flow || 'scroll';
  const pageShadow = '0 1px 3px rgba(0,0,0,.14),0 14px 44px rgba(0,0,0,.16)';
  const css = BASE_CSS + `
html{background:${d.viewBg}}
body{margin:0;font-family:system-ui,-apple-system,"Hiragino Sans","Yu Gothic UI",sans-serif;-webkit-font-smoothing:antialiased}
.mf-bar{position:sticky;top:0;z-index:5;height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;font-size:13px;
background:${dark ? 'rgba(28,28,30,.8)' : 'rgba(255,255,255,.8)'};color:${dark ? '#f2f2f7' : '#1d1d1f'};backdrop-filter:blur(16px);border-bottom:1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}}
.mf-title{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mf-nav{display:flex;align-items:center;gap:6px;flex:none}.mf-count{opacity:.6;font-variant-numeric:tabular-nums;min-width:52px;text-align:center}
.mf-nav button{all:unset;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;cursor:pointer;font-size:18px}
.mf-nav button:hover{background:${dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.07)'}}
.mf-doc{--s:1;display:flex;flex-direction:column;align-items:center;padding:28px 16px 64px;box-sizing:border-box}
.mf-stack{display:flex;flex-direction:column;align-items:center;gap:28px}
.mf-wrap{flex:none;position:relative;width:calc(${d.w}px*var(--s));height:calc(${d.h}px*var(--s));box-shadow:${pageShadow}}
.seamless .mf-stack{gap:0;box-shadow:${pageShadow}}.seamless .mf-wrap{box-shadow:none}
.paged{padding:20px 16px;min-height:calc(100vh - 45px);justify-content:center}
.paged .mf-wrap{display:none}.paged .mf-wrap.cur{display:block}
.mf-wrap>.mf-page{position:absolute;left:0;top:0;width:${d.w}px;height:${d.h}px;transform:scale(var(--s));transform-origin:0 0}
@page{size:${d.w}px ${d.h}px;margin:0}
@media print{html{background:#fff}.mf-bar{display:none}.mf-doc{--s:1!important;padding:0;display:block;min-height:0}.mf-stack{display:block;box-shadow:none}.mf-wrap{display:block!important;box-shadow:none;break-after:page}}
`;
  const reader = `(function(){var W=${d.w},H=${d.h},paged=${flow === 'paged'},doc=document.querySelector('.mf-doc'),cur=0;
var wraps=[].slice.call(document.querySelectorAll('.mf-wrap')),cnt=document.querySelector('.mf-count');
function fit(){var s=paged?Math.min((innerWidth-32)/W,(innerHeight-85)/H):Math.min((innerWidth-32)/W,1.4);doc.style.setProperty('--s',Math.max(.2,s))}
function label(i){cnt.textContent=(i+1)+' / '+wraps.length}
function show(i){cur=Math.max(0,Math.min(wraps.length-1,i));wraps.forEach(function(w,j){w.classList.toggle('cur',j===cur)});label(cur);try{history.replaceState(null,'','#p'+(cur+1))}catch(e){}}
function go(d){if(paged)show(cur+d);else{var t=wraps[Math.max(0,Math.min(wraps.length-1,cur+d))];if(t)t.scrollIntoView({behavior:'smooth',block:'start'})}}
addEventListener('resize',fit);fit();
document.querySelector('.mf-prev').onclick=function(){go(-1)};document.querySelector('.mf-next').onclick=function(){go(1)};
if(paged){show((parseInt(location.hash.slice(2))||1)-1);
addEventListener('keydown',function(e){if(/INPUT|SELECT/.test(e.target.tagName))return;var k=e.key;
if(k==='ArrowRight'||k==='PageDown'||k===' '){e.preventDefault();show(cur+1)}else if(k==='ArrowLeft'||k==='PageUp'){e.preventDefault();show(cur-1)}else if(k==='Home')show(0);else if(k==='End')show(wraps.length-1)});
var acc=0,lock=0,last=0;addEventListener('wheel',function(e){if(e.ctrlKey||(e.target.closest&&e.target.closest('.mfv-armed,select')))return;
var now=Date.now(),dy=(e.deltaY||e.deltaX)*(e.deltaMode===1?33:e.deltaMode===2?400:1);if(now-last>250||dy*acc<0)acc=0;last=now;
if(Math.abs(dy)>=50){show(cur+(dy>0?1:-1));acc=0;return}
if(now<lock)return;acc+=dy;if(Math.abs(acc)>=120){show(cur+(acc>0?1:-1));acc=0;lock=now+160}},{capture:true,passive:true})}
else{var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){cur=wraps.indexOf(e.target);label(cur)}})},{rootMargin:'-45% 0px -45% 0px'});
wraps.forEach(function(w){io.observe(w)})}
if(window.MFV)MFV.autoInit();})();`;
  const parts = [
    `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${esc(d.title)}</title>\n<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(READER_ICON)}">\n`,
    fonts.size ? `<link rel="stylesheet" href="${fontsHref([...fonts])}">\n` : '',
    `<style>${css}</style>\n</head>\n<body>\n<header class="mf-bar"><span class="mf-title">${esc(d.title)}</span><span class="mf-nav"><button class="mf-prev" title="前のページ">‹</button><span class="mf-count">1 / ${d.pages.length}</span><button class="mf-next" title="次のページ">›</button></span></header>\n<main class="mf-doc ${flow}">\n<div class="mf-stack">\n`,
  ];
  d.pages.forEach((pg, i) => {
    parts.push(`<section class="mf-wrap" id="p${i + 1}"><div class="mf-page" style="background:${pg.bg}">\n${pg.els.map((el) => elHTML(el, ctx)).join('\n')}\n</div></section>\n`);
  });
  parts.push('</div>\n</main>\n', ...glbs);
  if (glbs.length) parts.push('<script>', window.MF_RUNTIME_SRC.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'), '</script>\n');
  parts.push(`<script>${reader}</script>\n</body>\n</html>\n`);
  return new Blob(parts, { type: 'text/html' });
}
async function exportHTML() {
  const blob = await buildHTML();
  const name = await saveBlob(blob, fileBase() + '.html', { 'text/html': ['.html'] });
  if (name) toast(`${name} を書き出しました（${(blob.size / 1048576).toFixed(1)} MB）`);
}
async function preview() {
  const url = URL.createObjectURL(await buildHTML());
  if (!window.open(url, '_blank')) toast('ポップアップがブロックされました');
}

/* ---------- ツールバー・メニュー ---------- */

function popup(anchor, items) {
  $$('.menu').forEach((m) => m.remove());
  const m = h('div', { class: 'menu' });
  for (const it of items) {
    if (!it) { m.append(h('hr')); continue; }
    m.append(h('button', { html: (it.icon || '') + `<span>${it.label}</span>` + (it.note ? `<small>${it.note}</small>` : ''), onclick: () => { m.remove(); it.fn(); } }));
  }
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  m.style.left = clamp(r.left + r.width / 2 - m.offsetWidth / 2, 8, innerWidth - m.offsetWidth - 8) + 'px';
  m.style.top = (r.bottom + 6 + m.offsetHeight > innerHeight ? Math.max(8, r.top - m.offsetHeight - 6) : r.bottom + 6) + 'px';
  setTimeout(() => window.addEventListener('pointerdown', function close(e) {
    if (m.contains(e.target)) return;
    m.remove();
    window.removeEventListener('pointerdown', close, true);
  }, true));
}

const ACT = {
  new: newDoc,
  open: () => pickFiles('#fileProj', (f) => openProject(f[0])),
  save: saveProject,
  undo: () => undo(-1),
  redo: () => undo(1),
  text: (b) => popup(b, Object.entries(TEXT_PRESETS).map(([k, p]) => ({
    label: p.label, note: p.size + ' px', fn: () => { const el = addEl(makeText(k)); enterEdit(el.id); },
  }))),
  shape: (b) => popup(b, [['rect', '四角形'], ['round', '角丸四角形'], ['ellipse', '楕円'], ['line', '線'], ['arrow', '矢印']]
    .map(([k, label]) => ({ label, fn: () => addEl(makeShape(k)) }))),
  image: () => pickFiles('#fileImg', (f) => handleFiles(f)),
  model: (b) => popup(b, [
    { label: 'glb ファイルを選ぶ…', icon: IC.cube, fn: () => pickFiles('#fileGlb', (f) => handleFiles(f)) },
    null,
    { label: 'サンプルを置く', note: '曲がる筒', fn: () => addEl(makeModel(newAsset(sampleBlob(), 'bend.glb', 'glb').id)) },
  ]),
  preview, export: exportHTML,
  pageAdd: (b) => pageMenu(b),
  pageDup: () => {
    exitModes();
    const pg = curPage();
    state.doc.pages.splice(state.pageIdx + 1, 0, { id: uid(), bg: pg.bg, els: cloneEls(pg.els, 0, 0) });
    gotoPage(state.pageIdx + 1); commit(); scheduleSave();
  },
  pageDel: () => {
    if (state.doc.pages.length < 2) { toast('最後の 1 ページは削除できません'); return; }
    exitModes();
    state.doc.pages.splice(state.pageIdx, 1);
    gotoPage(Math.min(state.pageIdx, state.doc.pages.length - 1)); commit(); scheduleSave();
  },
};
for (const b of $$('[data-ic]')) b.insertAdjacentHTML('afterbegin', IC[b.dataset.ic]);
for (const b of $$('[data-act]')) b.addEventListener('click', () => ACT[b.dataset.act](b));
$('#zoomSel').addEventListener('change', (e) => {
  state.zoomMode = e.target.value === 'fit' ? 'fit' : +e.target.value;
  applyZoom();
});

const thumbs = $('#thumbs');
let dragFrom = -1;
thumbs.addEventListener('click', (e) => { const t = e.target.closest('.thumb'); if (t) gotoPage(+t.dataset.i); });
thumbs.addEventListener('dragstart', (e) => { const t = e.target.closest('.thumb'); if (t) { dragFrom = +t.dataset.i; e.dataTransfer.effectAllowed = 'move'; } });
thumbs.addEventListener('dragover', (e) => {
  const t = e.target.closest('.thumb');
  if (dragFrom < 0 || !t) return;
  e.preventDefault();
  $$('.thumb', thumbs).forEach((x) => x.classList.toggle('dragover', x === t));
});
thumbs.addEventListener('drop', (e) => {
  const t = e.target.closest('.thumb');
  if (dragFrom < 0 || !t) return;
  e.preventDefault();
  const to = +t.dataset.i, [pg] = state.doc.pages.splice(dragFrom, 1);
  state.doc.pages.splice(to, 0, pg);
  dragFrom = -1;
  gotoPage(to); commit(); scheduleSave();
});
thumbs.addEventListener('dragend', () => { dragFrom = -1; $$('.thumb', thumbs).forEach((x) => x.classList.remove('dragover')); });

/* ---------- ドロップ・貼り付け・キーボード ---------- */

let dropDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dropDepth++; stage.classList.add('dropping'); } });
window.addEventListener('dragleave', (e) => { if (hasFiles(e) && --dropDepth <= 0) { dropDepth = 0; stage.classList.remove('dropping'); } });
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dropDepth = 0; stage.classList.remove('dropping');
  const r = pageEl.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  handleFiles([...e.dataTransfer.files], inside ? pagePt(e) : null);
});

document.addEventListener('paste', (e) => {
  if (state.editing) {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    return;
  }
  if (e.target.closest && e.target.closest('input,select,textarea')) return;
  const files = [...e.clipboardData.files].filter((f) => f.type.startsWith('image/'));
  if (files.length) { e.preventDefault(); handleFiles(files); return; }
  if (clip) { pasteClip(); return; }
  const text = e.clipboardData.getData('text/plain');
  if (text.trim()) addEl(makeText('body', esc(text)));
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 's') { e.preventDefault(); saveProject(); return; }
  if (mod && k === 'o') { e.preventDefault(); ACT.open(); return; }
  if (e.key === 'Escape') {
    if (state.editing || state.interact) exitModes();
    else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    else setSel([]);
    renderOverlay();
    return;
  }
  if (!e.target.closest('input,select,textarea') && textShortcut(e)) return;
  if (e.target.closest('input,select,textarea,[contenteditable=true]')) return;
  if (mod && k === 'z') { e.preventDefault(); undo(e.shiftKey ? 1 : -1); return; }
  if (mod && k === 'y') { e.preventDefault(); undo(1); return; }
  if (mod && k === 'a') { e.preventDefault(); setSel(curPage().els.map((x) => x.id)); return; }
  if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
  if (mod && (k === 'c' || k === 'x')) {
    const sel = selEls();
    if (sel.length) { clip = { els: JSON.parse(JSON.stringify(sel)), n: 0 }; if (k === 'x') deleteSel(); }
    return;
  }
  if (mod && e.key === ']') { e.preventDefault(); reorder(e.shiftKey ? 'front' : 'up'); return; }
  if (mod && e.key === '[') { e.preventDefault(); reorder(e.shiftKey ? 'back' : 'down'); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
  if (e.key === 'Enter' && state.sel.size === 1) {
    const el = first();
    if (el.type === 'text') { e.preventDefault(); enterEdit(el.id); }
    else if (el.type === 'model') { e.preventDefault(); enterInteract(el.id); }
    return;
  }
  if (e.key === 'PageDown') { gotoPage(state.pageIdx + 1); return; }
  if (e.key === 'PageUp') { gotoPage(state.pageIdx - 1); return; }
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (arrow && state.sel.size) {
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    for (const el of selEls()) if (!el.locked) { el.x += arrow[0] * s; el.y += arrow[1] * s; }
    touch(); syncGeom();
    clearTimeout(viewerCommitT);
    viewerCommitT = setTimeout(commit, 400);
  }
});

/* ---------- 起動 ---------- */

async function init() {
  document.head.append(h('style', {}, BASE_CSS));
  document.head.append(h('link', { rel: 'stylesheet', href: fontsHref(Object.keys(FONTS).filter((k) => FONTS[k].g)) }));
  await idb.open();
  const saved = await idb.get('kv', 'doc');
  if (saved && saved.doc && saved.doc.pages && saved.doc.pages.length) {
    for (const a of (await idb.all('assets')) || []) assets.set(a.id, { ...a, url: URL.createObjectURL(a.blob) });
    state.doc = saved.doc;
    posters = saved.posters || {};
    state.pageIdx = clamp(saved.pageIdx || 0, 0, state.doc.pages.length - 1);
  } else welcomeDoc();
  refreshAll(); resetHistory();
  // Web フォントが届くとテキストの高さが変わるので測り直す
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { renderPage(); renderThumbs(); });
}
init();

window.MotionFolio = { state, assets, buildHTML };
})();
