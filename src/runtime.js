// MotionFolio 3D ビューア。エディターと書き出した HTML の両方がこの 1 本を使う。
// WebGL コンテキストは全ビューアで 1 つだけ持ち、描いた結果を各ビューアの 2D canvas へ転写する。
// ページ内にビューアを何個置いてもブラウザのコンテキスト数上限に当たらない。
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const CSS = `
.mfv{display:flex;flex-direction:column;overflow:hidden;position:relative;box-sizing:border-box}
.mfv-view{flex:1;min-height:0;position:relative}
.mfv-view canvas{position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;touch-action:none}
.mfv-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}
.mfv-msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:12px system-ui,sans-serif;color:#8e8e93;pointer-events:none;text-align:center;padding:8px}
.mfv-bar{flex:none;height:34px;display:flex;align-items:center;gap:2px;padding:0 6px;background:#1c1c1e;color:#f2f2f7;font:11px system-ui,sans-serif;user-select:none}
.mfv-bar button{all:unset;width:26px;height:26px;display:grid;place-items:center;border-radius:6px;cursor:pointer;color:inherit;flex:none}
.mfv-bar button:hover{background:rgba(255,255,255,.14)}
.mfv-bar button.on{background:#0a84ff}
.mfv-bar button svg{width:14px;height:14px;fill:currentColor}
.mfv-track{flex:1;min-width:40px;height:100%;position:relative;margin:0 6px}
.mfv-track::before{content:"";position:absolute;left:0;right:0;top:50%;height:4px;margin-top:-2px;border-radius:2px;background:rgba(255,255,255,.2)}
.mfv-marks{position:absolute;left:2px;right:2px;top:50%;height:0;pointer-events:none}
.mfv-marks i{position:absolute;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;background:#ffd60a;transform:rotate(45deg);border-radius:1px}
.mfv-marks svg{position:absolute;left:0;top:-4px;width:100%;height:8px}
.mfv-marks path{stroke:#ffd60a;stroke-width:1;opacity:.85;fill:none}
.mfv-seek{-webkit-appearance:none;appearance:none;position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;background:none;cursor:pointer;outline:none}
.mfv-seek::-webkit-slider-runnable-track{height:18px;background:none}
.mfv-seek::-webkit-slider-thumb{-webkit-appearance:none;width:4px;height:18px;border-radius:2px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.45)}
.mfv-seek::-moz-range-track{height:18px;background:none}
.mfv-seek::-moz-range-thumb{width:4px;height:18px;border:0;border-radius:2px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.45)}
.mfv-time{font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.85;min-width:58px;text-align:right;margin-right:4px}
.mfv-bar select{all:unset;font:inherit;color:inherit;padding:3px 6px;border-radius:6px;cursor:pointer;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(255,255,255,.1)}
.mfv-bar select option{color:#111;background:#fff}
.mfv.mfv-static canvas{pointer-events:none}
`;

const ICON = {
  play: '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>',
  prev: '<svg viewBox="0 0 16 16"><path d="M3 3h2v10H3zM13 3v10L6 8z"/></svg>',
  next: '<svg viewBox="0 0 16 16"><path d="M11 3h2v10h-2zM3 3v10l7-5z"/></svg>',
  bone: '<svg viewBox="0 0 16 16"><path d="M4.2 1.6a2 2 0 0 1 2.9 2.3l5 5a2 2 0 1 1 1.3 3.3 2 2 0 1 1-3.3 1.3 2 2 0 0 1-.4-1.9l-5-5A2 2 0 1 1 2.4 3.3a2 2 0 0 1 1.8-1.7z"/></svg>',
};

let gl = null, envTex = null, loader = null, styleDone = false;
const live = new Set();
let raf = 0, last = 0;

function ensureGL() {
  if (gl) return gl;
  gl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  gl.setPixelRatio(1);
  gl.setSize(512, 512, false);
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.setClearColor(0x000000, 0);
  const pm = new THREE.PMREMGenerator(gl);
  envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return gl;
}

function ensureLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // Draco 圧縮の glb を開いたときだけ、デコーダーをネットワークから取得する
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  return loader;
}

function tick(now) {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  for (const v of live) v._update(dt);
}

const DEFAULTS = {
  bg: '', clip: 0, autoplay: true, loop: true, speed: 1, controls: true, grid: true,
  skeleton: false, wire: false, autoRotate: false, exposure: 1, fps: 30, time: 0,
  cam: null, interactive: true, keys: true, order: null,
};

export class Viewer {
  constructor(host, opts = {}, onChange = null) {
    if (!styleDone) {
      const st = document.createElement('style');
      st.textContent = CSS;
      document.head.appendChild(st);
      styleDone = true;
    }
    this.host = host;
    this.o = { ...DEFAULTS, ...opts };
    this.onChange = onChange;
    this.ready = false;
    this.visible = true;
    this.dirty = true;
    this.t = this.o.time || 0;
    this.playing = !!this.o.autoplay;
    this.clips = [];
    this.clipNames = [];
    this.armed = false;

    host.classList.add('mfv');
    this.view = document.createElement('div');
    this.view.className = 'mfv-view';
    this.cv = document.createElement('canvas');
    this.ctx = this.cv.getContext('2d');
    this.msg = document.createElement('div');
    this.msg.className = 'mfv-msg';
    this.msg.textContent = '読み込み中…';
    this.view.append(this.cv, this.msg);
    this.bar = document.createElement('div');
    this.bar.className = 'mfv-bar';
    this.bar.style.display = 'none';
    host.append(this.view, this.bar);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
    this.camera.position.set(2, 1.5, 4);

    // ホイールはクリックで有効にした後か Ctrl 併用時だけズームに使う。そうしないとページのスクロールを奪う
    this.cv.addEventListener('wheel', (e) => {
      if (!this.armed && !e.ctrlKey) e.stopImmediatePropagation();
    }, { capture: true });
    // mfv-armed は、ホイールをズームに使っている最中だと外側（ページ送り）へ知らせる印
    const arm = (on) => { this.armed = on; host.classList.toggle('mfv-armed', on); };
    this.cv.addEventListener('pointerdown', () => arm(true));
    this.cv.addEventListener('pointerleave', () => arm(false));

    this.controls = new OrbitControls(this.camera, this.cv);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.controls.addEventListener('end', () => this._emitCam());

    this.io = new IntersectionObserver((es) => {
      this.visible = es[es.length - 1].isIntersecting;
      if (this.visible) this.dirty = true;
    });
    this.io.observe(host);

    this._buildBar();
    this._applyStatic();
    live.add(this);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  message(text) { this.msg.textContent = text; this.msg.style.display = text ? '' : 'none'; }

  load(buf) {
    return new Promise((resolve, reject) => {
      ensureGL();
      ensureLoader().parse(buf, '', (gltf) => {
        if (this.disposed) return resolve();
        try { this._setup(gltf); resolve(); } catch (e) { this.message('表示できません: ' + e.message); reject(e); }
      }, (err) => {
        this.message('読み込みに失敗しました');
        reject(err);
      });
    });
  }

  _setup(gltf) {
    const root = gltf.scene || gltf.scenes[0];
    this.root = root;
    this.scene.add(root);
    this.scene.environment = envTex;
    this.scene.environmentIntensity = 0.7;
    this.hasSkin = false;
    root.traverse((n) => {
      if (n.isSkinnedMesh) { n.frustumCulled = false; this.hasSkin = true; }
    });

    this.clips = gltf.animations || [];
    this.clipNames = this.clips.map((c, i) => c.name || `Clip ${i + 1}`);
    // BlenderBook 書き出しのアドオンが、焼き込む前のキー位置と fps を extras に同梱している
    const defs = (gltf.parser && gltf.parser.json.animations) || [];
    this.meta = this.clips.map((c, i) => readMeta(defs[i]));
    this.mixer = new THREE.AnimationMixer(root);
    const order = this.order();
    this._setClip(order.includes(this.o.clip) ? this.o.clip : order[0], true);
    root.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = sphere.radius || 1;
    this.fit = { center: sphere.center.clone(), r };
    this.camera.near = r / 100;
    this.camera.far = r * 200;

    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 5, 4).multiplyScalar(r).add(sphere.center);
    key.target.position.copy(sphere.center);
    this.scene.add(key, key.target);

    const step = Math.pow(10, Math.floor(Math.log10(r * 2))) / 2;
    const cells = Math.max(8, Math.ceil((r * 6) / step / 2) * 2);
    this.grid = new THREE.GridHelper(cells * step, cells, 0x8e8e93, 0xb0b0b6);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.45;
    this.grid.position.set(sphere.center.x, box.min.y, sphere.center.z);
    this.scene.add(this.grid);

    this.skel = new THREE.SkeletonHelper(root);
    this.skel.material.depthTest = false;
    this.skel.material.transparent = true;
    this.scene.add(this.skel);

    this._applyCam();
    this._applyLook();
    this._fillBar();
    this.ready = true;
    this.dirty = true;
    this.message('');
    const poster = this.host.querySelector('.mfv-poster');
    if (poster) poster.remove();
  }

  // fps を 0（自動）にしていれば、glb に同梱された fps を使う
  get fps() {
    const m = this.meta && this.meta[this.clipIdx];
    return this.o.fps > 0 ? this.o.fps : (m && m.fps) || 30;
  }

  // 著者が並べ替え・非表示にしたクリップの順番（元の番号の配列）
  order() {
    const n = this.clips.length, seen = new Set();
    const o = (Array.isArray(this.o.order) ? this.o.order : []).filter((i) => Number.isInteger(i) && i >= 0 && i < n && !seen.has(i) && seen.add(i));
    return o.length ? o : [...Array(n).keys()];
  }

  _setClip(i, force) {
    if (!this.clips.length) { this.dur = 0; return; }
    i = Math.max(0, Math.min(this.clips.length - 1, i | 0));
    if (!force && i === this.clipIdx) return;
    if (this.action) this.action.stop();
    this.clipIdx = i;
    this.action = this.mixer.clipAction(this.clips[i]);
    this.action.play();
    this.dur = this.clips[i].duration;
    this.t = Math.min(this.t, this.dur);
    this._pose();
  }

  _pose() {
    if (!this.action) return;
    this.action.time = this.t;
    this.mixer.update(0);
    this.dirty = true;
  }

  _applyCam() {
    if (!this.fit) return;
    const c = this.o.cam;
    if (c && c.p && c.t) {
      this.camera.position.fromArray(c.p);
      this.controls.target.fromArray(c.t);
    } else {
      const d = (this.fit.r / Math.sin((this.camera.fov * Math.PI) / 360)) * 1.08;
      const dir = new THREE.Vector3(0.55, 0.32, 1).normalize();
      this.controls.target.copy(this.fit.center);
      this.camera.position.copy(this.fit.center).addScaledVector(dir, d);
    }
    this.controls.update();
    this.dirty = true;
  }

  _applyLook() {
    const o = this.o;
    if (this.grid) this.grid.visible = !!o.grid;
    if (this.skel) this.skel.visible = !!o.skeleton;
    if (this.root) {
      this.root.traverse((n) => {
        if (!n.material) return;
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) m.wireframe = !!o.wire;
      });
    }
    this.controls.autoRotate = !!o.autoRotate;
    this.controls.autoRotateSpeed = 1.5;
    this.bar.style.display = o.controls && this.clips.length ? '' : 'none';
    if (this.boneBtn) {
      this.boneBtn.classList.toggle('on', !!o.skeleton);
      this.boneBtn.style.display = this.hasSkin ? '' : 'none';
    }
    this.dirty = true;
  }

  _applyStatic() {
    this.host.classList.toggle('mfv-static', !this.o.interactive);
    this.controls.enabled = !!this.o.interactive;
  }

  set(opts) {
    const p = this.o;
    const o = (this.o = { ...p, ...opts });
    if (o.interactive !== p.interactive) this._applyStatic();
    if (!this.ready) { this.playing = !!o.autoplay; this.t = o.time || 0; return; }
    if (o.clip !== p.clip) { this._setClip(o.clip); this._fillBar(); }
    if (o.autoplay !== p.autoplay) this.playing = !!o.autoplay;
    if (o.time !== p.time && !this.playing) { this.t = Math.min(o.time || 0, this.dur); this._pose(); }
    if (JSON.stringify(o.cam) !== JSON.stringify(p.cam)) this._applyCam();
    if (JSON.stringify(o.order) !== JSON.stringify(p.order)) {
      const order = this.order();
      if (!order.includes(this.clipIdx)) { this.t = 0; this._setClip(order[0]); }
    }
    if (o.fps !== p.fps || o.keys !== p.keys || JSON.stringify(o.order) !== JSON.stringify(p.order)) this._fillBar();
    this._applyLook();
    this._syncBar();
  }

  _emitCam() {
    const cam = {
      p: this.camera.position.toArray().map((n) => +n.toFixed(4)),
      t: this.controls.target.toArray().map((n) => +n.toFixed(4)),
    };
    this.o.cam = cam;
    if (this.onChange) this.onChange({ cam });
  }

  _emitTime() {
    this.o.time = +this.t.toFixed(4);
    if (this.onChange) this.onChange({ time: this.o.time });
  }

  _buildBar() {
    const b = (cls, icon, title, fn) => {
      const el = document.createElement('button');
      el.className = cls; el.innerHTML = icon; el.title = title; el.type = 'button';
      el.addEventListener('click', fn);
      this.bar.appendChild(el);
      return el;
    };
    this.playBtn = b('mfv-play', ICON.play, '再生 / 一時停止', () => {
      if (!this.playing && this.dur && this.t >= this.dur) this.t = 0;
      this.playing = !this.playing;
      this._syncBar();
      if (!this.playing) this._emitTime();
    });
    b('mfv-prev', ICON.prev, '1 フレーム戻る（Shift で前のキーフレーム）', (e) => this._step(-1, e.shiftKey));
    b('mfv-next', ICON.next, '1 フレーム進む（Shift で次のキーフレーム）', (e) => this._step(1, e.shiftKey));
    this.seek = document.createElement('input');
    this.seek.type = 'range'; this.seek.className = 'mfv-seek'; this.seek.min = 0; this.seek.step = 1;
    this.seek.addEventListener('input', () => {
      this.playing = false;
      this.t = Math.min(this.dur, this.seek.value / this.fps);
      this._pose(); this._syncBar();
    });
    this.seek.addEventListener('change', () => this._emitTime());
    this.timeEl = document.createElement('span');
    this.timeEl.className = 'mfv-time';
    this.clipSel = document.createElement('select');
    this.clipSel.title = 'アニメーション';
    this.clipSel.addEventListener('change', () => {
      const clip = +this.clipSel.value;
      this.t = 0;
      this.set({ clip });
      if (this.onChange) this.onChange({ clip });
    });
    this.speedSel = document.createElement('select');
    this.speedSel.title = '再生速度';
    for (const s of [0.1, 0.25, 0.5, 1, 2]) {
      const op = document.createElement('option');
      op.value = s; op.textContent = s + '×';
      this.speedSel.appendChild(op);
    }
    this.speedSel.addEventListener('change', () => {
      this.o.speed = +this.speedSel.value;
      if (this.onChange) this.onChange({ speed: this.o.speed });
    });
    this.marks = document.createElement('div');
    this.marks.className = 'mfv-marks';
    const track = document.createElement('div');
    track.className = 'mfv-track';
    track.append(this.marks, this.seek);
    this.bar.append(track, this.timeEl, this.clipSel, this.speedSel);
    this.boneBtn = b('mfv-bone', ICON.bone, 'スケルトン表示', () => {
      this.o.skeleton = !this.o.skeleton;
      this._applyLook();
      if (this.onChange) this.onChange({ skeleton: this.o.skeleton });
    });
  }

  _fillBar() {
    this.clipSel.innerHTML = '';
    const order = this.order();
    for (const i of order) {
      const op = document.createElement('option');
      op.value = i; op.textContent = this.clipNames[i];
      this.clipSel.appendChild(op);
    }
    this.clipSel.value = this.clipIdx || 0;
    this.clipSel.style.display = order.length > 1 ? '' : 'none';
    this.frames = Math.max(1, Math.round(this.dur * this.fps));
    this.seek.max = this.frames;
    this._fillMarks();
    this._syncBar();
  }

  // クリップに記録されているキーフレームの時刻を集め、シークバーに印を並べる
  _fillMarks() {
    const clip = this.clips[this.clipIdx], meta = this.meta && this.meta[this.clipIdx];
    const set = new Set();
    if (meta) {
      this.keySource = 'meta';
      for (const t of meta.times) if (t >= -1e-6 && t <= this.dur + 1e-3) set.add(Math.round(t * 1000) / 1000);
    } else if (clip) {
      this.keySource = clip.tracks.some(isBaked) ? 'estimated' : 'tracks';
      for (const tr of clip.tracks) for (const t of isBaked(tr) ? estimateKeys(tr) : tr.times) set.add(Math.round(t * 1000) / 1000);
    }
    this.keys = [...set].sort((a, b) => a - b);
    if (this.o.keys === false || !this.dur) { this.marks.innerHTML = ''; return; }
    const d = this.dur;
    // 多いときは菱形だと潰れて読めないので細い線に切り替える
    this.marks.innerHTML = this.keys.length <= 150
      ? this.keys.map((t) => `<i style="left:${((t / d) * 100).toFixed(3)}%"></i>`).join('')
      : `<svg viewBox="0 0 1000 10" preserveAspectRatio="none"><path vector-effect="non-scaling-stroke" d="${this.keys.map((t) => `M${((t / d) * 1000).toFixed(1)} 0V10`).join('')}"/></svg>`;
  }

  _syncBar() {
    if (!this.seek) return;
    const f = Math.round(this.t * this.fps);
    if (document.activeElement !== this.seek) this.seek.value = f;
    const org = (this.meta && this.meta[this.clipIdx] && this.meta[this.clipIdx].frameOrigin) || 0;
    this.timeEl.textContent = `${f + org} / ${(this.frames || 0) + org} f`;
    const icon = this.playing ? ICON.pause : ICON.play;
    if (this._icon !== icon) { this.playBtn.innerHTML = icon; this._icon = icon; }
    const sp = String(this.o.speed);
    if (![...this.speedSel.options].some((op) => op.value === sp)) {
      const op = document.createElement('option');
      op.value = sp; op.textContent = sp + '×';
      this.speedSel.appendChild(op);
    }
    this.speedSel.value = sp;
  }

  _step(dir, toKey) {
    if (!this.dur) return;
    this.playing = false;
    if (toKey && this.keys.length) {
      const k = dir > 0 ? this.keys.find((x) => x > this.t + 1e-3) : [...this.keys].reverse().find((x) => x < this.t - 1e-3);
      if (k == null) return;
      this.t = Math.min(this.dur, k);
    } else {
      const f = Math.round(this.t * this.fps) + dir;
      this.t = Math.max(0, Math.min(this.dur, f / this.fps));
    }
    this._pose(); this._syncBar(); this._emitTime();
  }

  _size() {
    // ページは CSS transform で拡縮されるので、実表示倍率をページ要素から求める
    const page = this.host.closest('.mf-page');
    let s = 1;
    if (page && page.offsetWidth) s = page.getBoundingClientRect().width / page.offsetWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.round(this.view.clientWidth * s * dpr);
    let h = Math.round(this.view.clientHeight * s * dpr);
    const k = Math.min(1, 2048 / Math.max(w, h, 1));
    w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
    if (w !== this.cv.width || h !== this.cv.height) {
      this.cv.width = w; this.cv.height = h;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.dirty = true;
    }
  }

  _update(dt) {
    if (!this.ready || !this.visible) return;
    this._size();
    if (this.playing && this.dur) {
      this.t += dt * this.o.speed;
      if (this.t >= this.dur) {
        if (this.o.loop) this.t %= this.dur;
        else { this.t = this.dur; this.playing = false; }
      }
      this._pose();
      this._syncBar();
    }
    if (this.o.interactive || this.o.autoRotate) this.controls.update(dt);
    if (this.dirty) this._render();
  }

  _render() {
    this.dirty = false;
    const w = this.cv.width, h = this.cv.height;
    const r = ensureGL();
    const c = r.domElement;
    if (c.width < w || c.height < h) {
      r.setSize(Math.max(c.width, Math.ceil(w / 256) * 256), Math.max(c.height, Math.ceil(h / 256) * 256), false);
    }
    r.setViewport(0, 0, w, h);
    r.setScissor(0, 0, w, h);
    r.setScissorTest(true);
    r.toneMappingExposure = this.o.exposure;
    r.clear();
    r.render(this.scene, this.camera);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.drawImage(c, 0, c.height - h, w, h, 0, 0, w, h);
  }

  poster(maxW = 640) {
    if (!this.ready || !this.cv.width) return null;
    this._render();
    const k = Math.min(1, maxW / this.cv.width);
    const c = document.createElement('canvas');
    c.width = Math.round(this.cv.width * k); c.height = Math.round(this.cv.height * k);
    c.getContext('2d').drawImage(this.cv, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.82);
  }

  dispose() {
    this.disposed = true;
    live.delete(this);
    if (!live.size && raf) { cancelAnimationFrame(raf); raf = 0; }
    this.io.disconnect();
    this.controls.dispose();
    if (this.mixer) this.mixer.stopAllAction();
    this.scene.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material) {
        for (const m of Array.isArray(n.material) ? n.material : [n.material]) {
          for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
          m.dispose();
        }
      }
    });
    this.view.remove();
    this.bar.remove();
  }
}

function readMeta(def) {
  try {
    const raw = def && def.extras && def.extras.blenderbook;
    const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!m || !Array.isArray(m.times)) return null;
    return { fps: m.fps > 0 ? m.fps : 0, times: m.times.filter((t) => Number.isFinite(t)), frameOrigin: m.frameOrigin || 0 };
  } catch { return null; }
}

// 一定間隔で 5 点以上並ぶトラックは、書き出し時に毎フレーム焼き込まれたものとみなす
function isBaked(tr) {
  const t = tr.times, n = t.length;
  if (n < 5) return false;
  const d = (t[n - 1] - t[0]) / (n - 1);
  for (let i = 1; i < n; i++) if (Math.abs(t[i] - t[i - 1] - d) > d * 0.01) return false;
  return true;
}

// 焼き込まれた値の並びから元のキーを推定する。拾えるのは端点、動きが折り返す点、
// 止まる点と動き出す点。動きの途中に滑らかにつないだキーは値に痕跡が残らないので拾えない
function estimateKeys(tr) {
  const t = tr.times, n = t.length, k = tr.getValueSize(), v = Float64Array.from(tr.values);
  if (tr.ValueTypeName === 'quaternion') {
    for (let i = 1; i < n; i++) {
      let dot = 0;
      for (let c = 0; c < 4; c++) dot += v[i * 4 + c] * v[(i - 1) * 4 + c];
      if (dot < 0) for (let c = 0; c < 4; c++) v[i * 4 + c] = -v[i * 4 + c];
    }
  }
  let range = 0;
  for (let c = 0; c < k; c++) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { lo = Math.min(lo, v[i * k + c]); hi = Math.max(hi, v[i * k + c]); }
    range = Math.max(range, hi - lo);
  }
  const eps = Math.max(range * 1e-4, 1e-7);
  const out = [t[0], t[n - 1]];
  for (let i = 1; i < n - 1; i++) {
    let still1 = true, still2 = true, turn = false;
    for (let c = 0; c < k; c++) {
      const a = v[i * k + c] - v[(i - 1) * k + c], b = v[(i + 1) * k + c] - v[i * k + c];
      if (Math.abs(a) > eps) still1 = false;
      if (Math.abs(b) > eps) still2 = false;
      if (a * b < 0 && Math.abs(a) > eps && Math.abs(b) > eps) turn = true;
    }
    if (turn || still1 !== still2) out.push(t[i]);
  }
  return out;
}

const bufCache = new Map();
function assetBuffer(id) {
  if (!bufCache.has(id)) {
    const node = document.getElementById('mf-asset-' + id);
    const b64 = node ? node.textContent.trim() : '';
    bufCache.set(id, fetch('data:application/octet-stream;base64,' + b64)
      .then((r) => r.arrayBuffer())
      .catch(() => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer));
  }
  return bufCache.get(id);
}

// 書き出した HTML 用。画面に近づいたビューアから順に読み込む
export function autoInit(root = document) {
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const o = JSON.parse(e.target.dataset.mfv);
      const v = new Viewer(e.target, { ...o, interactive: true });
      assetBuffer(o.asset).then((buf) => v.load(buf)).catch((err) => console.error(err));
    }
  }, { rootMargin: '400px' });
  root.querySelectorAll('[data-mfv]').forEach((n) => io.observe(n));
}
