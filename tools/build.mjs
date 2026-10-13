// ビューアのランタイムを 1 本の文字列にまとめ、サンプル glb を生成する。
// エディターは file:// で直接開けるよう、どちらも通常の <script> で読める形にする。
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'js'), { recursive: true });
mkdirSync(join(root, 'sample'), { recursive: true });

const out = await build({
  entryPoints: [join(root, 'src/runtime.js')],
  bundle: true, minify: true, format: 'iife', globalName: 'MFV',
  target: 'es2020', write: false, legalComments: 'none',
});
const code = out.outputFiles[0].text;
writeFileSync(join(root, 'js/runtime-src.js'), 'window.MF_RUNTIME_SRC=' + JSON.stringify(code) + ';\n');
console.log('runtime', (code.length / 1024).toFixed(0) + ' KB');

const glb = makeSampleGlb();
writeFileSync(join(root, 'sample/bend.glb'), glb);
writeFileSync(join(root, 'js/sample.js'), 'window.MF_SAMPLE_GLB=' + JSON.stringify(glb.toString('base64')) + ';\n');
console.log('sample', glb.length + ' bytes');

// 3 本のボーンで曲がる筒。スキニングとクリップ切り替えを試せる最小のモデル
function makeSampleGlb() {
  const RINGS = 24, SIDES = 12, HEIGHT = 2, RADIUS = 0.16, JOINTS = 3;
  const seg = HEIGHT / JOINTS;
  const pos = [], nor = [], jnt = [], wgt = [], idx = [];
  for (let i = 0; i <= RINGS; i++) {
    const y = (HEIGHT * i) / RINGS;
    const f = Math.min(JOINTS - 1, y / seg);
    const j0 = Math.min(JOINTS - 1, Math.floor(f));
    const j1 = Math.min(JOINTS - 1, j0 + 1);
    // 関節の前後 30% だけを混ぜ、節の中央は 1 本のボーンに従わせる
    const local = f - j0;
    const w1 = j1 === j0 ? 0 : Math.max(0, Math.min(1, (local - 0.7) / 0.6 + 0.5)) * (local > 0.4 ? 1 : 0);
    for (let s = 0; s < SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      pos.push(Math.cos(a) * RADIUS, y, Math.sin(a) * RADIUS);
      nor.push(Math.cos(a), 0, Math.sin(a));
      jnt.push(j0, j1, 0, 0);
      wgt.push(1 - w1, w1, 0, 0);
    }
  }
  for (let i = 0; i < RINGS; i++) {
    for (let s = 0; s < SIDES; s++) {
      const a = i * SIDES + s, b = i * SIDES + ((s + 1) % SIDES), c = a + SIDES, d = b + SIDES;
      idx.push(a, c, b, b, c, d);
    }
  }
  const ibm = [];
  for (let j = 0; j < JOINTS; j++) ibm.push(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -j * seg, 0, 1);

  const FPS = 30, DUR = 2, N = FPS * DUR + 1;
  const times = Array.from({ length: N }, (_, i) => i / FPS);
  const quat = (axis, ang) => {
    const s = Math.sin(ang / 2), c = Math.cos(ang / 2);
    return axis === 'z' ? [0, 0, s, c] : axis === 'x' ? [s, 0, 0, c] : [0, s, 0, c];
  };
  const mul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const clipDefs = [
    { name: 'Wave', f: (t, j) => quat('z', 0.55 * Math.sin((2 * Math.PI * t) / DUR - j * 0.9)) },
    { name: 'Twist', f: (t, j) => mul(quat('y', j * 0.8 * Math.sin((2 * Math.PI * t) / DUR)), quat('x', j ? 0.35 * Math.sin((4 * Math.PI * t) / DUR) : 0)) },
  ];

  const chunks = [], views = [], accessors = [];
  let offset = 0;
  const add = (typed, type, count, extra = {}, target) => {
    const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    const pad = (4 - (buf.length % 4)) % 4;
    views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
    chunks.push(buf, Buffer.alloc(pad));
    offset += buf.length + pad;
    const componentType = typed instanceof Uint16Array ? 5123 : typed instanceof Uint8Array ? 5121 : 5126;
    accessors.push({ bufferView: views.length - 1, componentType, count, type, ...extra });
    return accessors.length - 1;
  };
  const nv = pos.length / 3;
  const aIdx = add(new Uint16Array(idx), 'SCALAR', idx.length, {}, 34963);
  const aPos = add(new Float32Array(pos), 'VEC3', nv, { min: [-RADIUS, 0, -RADIUS], max: [RADIUS, HEIGHT, RADIUS] }, 34962);
  const aNor = add(new Float32Array(nor), 'VEC3', nv, {}, 34962);
  const aJnt = add(new Uint8Array(jnt), 'VEC4', nv, {}, 34962);
  const aWgt = add(new Float32Array(wgt), 'VEC4', nv, {}, 34962);
  const aIbm = add(new Float32Array(ibm), 'MAT4', JOINTS);
  const aTime = add(new Float32Array(times), 'SCALAR', N, { min: [0], max: [DUR] });

  const animations = clipDefs.map((def) => {
    const samplers = [], channels = [];
    for (let j = 0; j < JOINTS; j++) {
      const out = add(new Float32Array(times.flatMap((t) => def.f(t, j))), 'VEC4', N);
      samplers.push({ input: aTime, output: out, interpolation: 'LINEAR' });
      channels.push({ sampler: j, target: { node: 1 + j, path: 'rotation' } });
    }
    return { name: def.name, samplers, channels };
  });

  const json = {
    asset: { version: '2.0', generator: 'MotionFolio sample' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [
      { name: 'Tube', mesh: 0, skin: 0 },
      { name: 'Bone0', children: [2] },
      { name: 'Bone1', translation: [0, seg, 0], children: [3] },
      { name: 'Bone2', translation: [0, seg, 0] },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: aPos, NORMAL: aNor, JOINTS_0: aJnt, WEIGHTS_0: aWgt }, indices: aIdx, material: 0 }] }],
    materials: [{ name: 'Body', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.98, 0.45, 0.2, 1], metallicFactor: 0, roughnessFactor: 0.45 } }],
    skins: [{ joints: [1, 2, 3], inverseBindMatrices: aIbm, skeleton: 1 }],
    animations,
    accessors, bufferViews: views,
    buffers: [{ byteLength: offset }],
  };
  let jb = Buffer.from(JSON.stringify(json));
  jb = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, jb, bh, bin]);
}
