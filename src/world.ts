import * as THREE from 'three';
import { assetUrl, type Chapter } from './content';

export interface Hotspot { id: string; label: string; x: number; z: number; marker: THREE.Sprite; disabled?: boolean; }
interface Obstacle { x: number; z: number; w: number; d: number; }
const palettes = ['#809a84', '#a5ad7d', '#668e80', '#c4a57e'];

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d')!);
  const t = new THREE.CanvasTexture(canvas); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function portraitTexture(shirt: string, variant: number) {
  return canvasTexture(32, 48, c => {
    c.fillStyle = 'rgba(28,36,34,.22)'; c.fillRect(6, 45, 21, 3);
    c.fillStyle = '#424b49'; c.fillRect(9, 33, 6, 12); c.fillRect(19, 33, 6, 12);
    c.fillStyle = '#e9d6af'; c.fillRect(7, 43, 8, 3); c.fillRect(19, 43, 8, 3);
    c.fillStyle = shirt; c.fillRect(8, 20, 18, 16); c.fillRect(5, 23, 5, 10); c.fillRect(25, 23, 4, 10);
    c.fillStyle = '#d99e78'; c.fillRect(5, 32, 5, 5); c.fillRect(25, 32, 4, 5); c.fillRect(14, 16, 7, 6);
    c.fillStyle = '#f1c9a2'; c.fillRect(10, 6, 15, 13); c.fillRect(8, 9, 19, 6);
    c.fillStyle = ['#53413b', '#493c35', '#685647', '#393b37'][variant % 4];
    c.fillRect(9, 3, 16, 5); c.fillRect(7, 6, 5, 8); c.fillRect(23, 6, 4, variant % 2 ? 15 : 6);
    if (variant % 2) c.fillRect(7, 12, 4, 10);
    c.fillStyle = '#443a34'; c.fillRect(13, 11, 2, 2); c.fillRect(21, 11, 2, 2);
    c.fillStyle = '#c58168'; c.fillRect(17, 16, 4, 1);
    c.fillStyle = '#f5e2bf'; c.fillRect(12, 22, 2, 4); c.fillRect(21, 22, 2, 4);
    if (variant === 3) { c.strokeStyle = '#3c4945'; c.strokeRect(11, 10, 6, 4); c.strokeRect(19, 10, 6, 4); }
  });
}

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(66, 1, 0.1, 60);
  room = new THREE.Group();
  hotspots: Hotspot[] = [];
  obstacles: Obstacle[] = [];
  yaw = 0;
  pitch = 0;
  menu = true;
  elapsed = 0;
  width = 0;
  height = 0;
  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#a8c4bc');
    this.renderer.domElement.id = 'world';
    this.renderer.domElement.setAttribute('aria-label', '第一人稱像素房間');
    container.prepend(this.renderer.domElement);
    this.scene.fog = new THREE.Fog('#c2cbb4', 18, 48);
    this.scene.add(new THREE.HemisphereLight('#fff4d8', '#718777', 2.4));
    const sun = new THREE.DirectionalLight('#ffe0a7', 2.2); sun.position.set(-3, 8, -4); this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#b1cec7', .6); fill.position.set(5, 3, 4); this.scene.add(fill);
    this.scene.add(this.room);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    const scale = Math.min(1, 850 / w, 540 / h);
    this.renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.width = w; this.height = h;
  }
  material(color: string, texture?: THREE.Texture) { return new THREE.MeshLambertMaterial({ color, ...(texture ? { map: texture } : {}) }); }
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: string, solid = false, texture?: THREE.Texture) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.material(color, texture));
    m.position.set(x, y, z); this.room.add(m);
    if (solid) this.obstacles.push({ x, z, w, d });
    return m;
  }
  plant(x: number, z: number, y = 0, big = false) {
    const s = big ? 1.5 : 1;
    this.box(x, y + .18 * s, z, .34 * s, .36 * s, .34 * s, '#b67f61');
    this.box(x, y + .37 * s, z, .4 * s, .1 * s, .4 * s, '#d09b76');
    this.box(x, y + .64 * s, z, .08, .55 * s, .08, '#627752');
    for (let i = 0; i < 5; i++) {
      this.box(x + Math.sin(i * 2) * .15 * s, y + (.5 + i * .09) * s, z + Math.cos(i * 2) * .13 * s, .28 * s, .18 * s, .25 * s, palettes[i % 4]);
    }
  }
  book(x: number, y: number, z: number, color: string, r = 0) { const b = this.box(x, y, z, .24, .06, .34, color); b.rotation.y = r; }
  table(x: number, z: number, w = 1.7, d = .85) {
    this.box(x, .83, z, w, .14, d, '#b48c62', true);
    this.box(x, .74, z, w - .08, .08, d - .08, '#7d6650');
    for (const a of [-1, 1]) for (const b of [-1, 1]) this.box(x + a * (w / 2 - .12), .36, z + b * (d / 2 - .1), .12, .72, .12, '#78624e');
  }
  lamp(x: number, z: number, y: number) {
    this.box(x, y + .03, z, .3, .06, .28, '#6f7160');
    this.box(x, y + .22, z, .06, .4, .06, '#726e5b');
    this.box(x, y + .43, z, .42, .26, .32, '#eed4a1');
    this.box(x, y + .29, z, .46, .05, .36, '#f6ddb0');
  }
  picture(x: number, y: number, z: number, w: number, h: number, variant: number) {
    this.box(x, y, z, w, h, .06, '#856c51');
    const t = canvasTexture(48, 40, c => {
      c.fillStyle = ['#adc4b9', '#c0bb93', '#a6bac2'][variant % 3]; c.fillRect(0, 0, 48, 40);
      c.fillStyle = '#f2dbab'; c.fillRect(31, 5, 8, 8);
      c.fillStyle = '#7d9985'; c.fillRect(0, 22, 48, 18); c.fillRect(8, 15, 20, 10);
      c.fillStyle = '#597c6a'; c.fillRect(0, 31, 48, 9); c.fillRect(28, 23, 20, 11);
      c.fillStyle = '#d7c399'; c.fillRect(15, 26, 9, 14);
    });
    this.box(x, y, z + .04, w - .13, h - .13, .015, '#ffffff', false, t);
  }
  addHotspot(id: string, label: string, x: number, z: number, y = 1.25) {
    const map = canvasTexture(32, 32, c => {
      c.fillStyle = '#334943'; c.fillRect(8, 2, 16, 28); c.fillRect(2, 8, 28, 16);
      c.fillStyle = '#efc787'; c.fillRect(10, 5, 12, 22); c.fillRect(5, 10, 22, 12);
      c.fillStyle = '#fff3d0'; c.fillRect(13, 10, 6, 12); c.fillRect(10, 13, 12, 6);
    });
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: true, transparent: true }));
    marker.position.set(x, y, z); marker.scale.set(.22, .22, 1); marker.userData.baseY = y; this.room.add(marker);
    this.hotspots.push({ id, label, x, z, marker });
  }
  load(chapter: Chapter, index: number) {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    this.room.traverse(o => {
      const obj = o as THREE.Mesh;
      if (obj.geometry) geometries.add(obj.geometry);
      if (obj.material) for (const m of (Array.isArray(obj.material) ? obj.material : [obj.material])) {
        materials.add(m); if ('map' in m && m.map) textures.add(m.map as THREE.Texture);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    this.room.clear(); this.hotspots = []; this.obstacles = [];
    this.camera.position.set(0, 1.58, 3.25); this.yaw = 0; this.pitch = 0;
    this.box(0, -.12, 0, 10.2, .22, 9, '#a58c68');
    for (let z = -4.2; z < 4.5; z += .48) for (let x = -4.9; x < 5; x += 1.8) {
      this.box(x + .85 + ((Math.round(z * 10) % 2) ? .15 : 0), .002, z, 1.77, .012, .45, ['#c4a780', '#bfa079', '#caae88', '#bea581'][Math.abs(Math.round(x * 11 + z * 13)) % 4]);
    }
    this.box(0, 1.9, -4.4, 10, 3.8, .18, chapter.color);
    this.box(-5, 1.9, 0, .18, 3.8, 8.8, chapter.color);
    this.box(5, 1.9, 0, .18, 3.8, 8.8, chapter.color);
    this.box(0, .15, -4.24, 10, .3, .12, '#e6dfc7');
    this.box(-4.85, .15, 0, .12, .3, 8.7, '#e6dfc7');
    this.box(4.85, .15, 0, .12, .3, 8.7, '#e6dfc7');
    // A painted pixel city beyond a deep-set window.
    const view = canvasTexture(128, 96, c => {
      c.fillStyle = index === 7 ? '#b9a89e' : '#b7d1c7'; c.fillRect(0, 0, 128, 96);
      c.fillStyle = '#f6e5b8'; c.fillRect(88, 12, 13, 13);
      c.fillStyle = '#dfdfc6'; c.fillRect(4, 14, 26, 4); c.fillRect(8, 10, 15, 5); c.fillRect(51, 24, 23, 4);
      for (let i = 0; i < 9; i++) {
        const x = i * 17 - 5, h = 30 + (i * 17) % 35;
        c.fillStyle = ['#8fa9a0', '#9fb4a7', '#b7b99c'][i % 3]; c.fillRect(x, 96 - h, 16, h);
        c.fillStyle = '#d8d8b7'; for (let a = 0; a < 3; a++) for (let b = 0; b < 5; b++) c.fillRect(x + 3 + a * 4, 100 - h + b * 9, 2, 4);
      }
      c.fillStyle = '#6e957d'; c.fillRect(0, 81, 128, 15); c.fillRect(7, 70, 23, 18); c.fillRect(40, 77, 34, 15);
    });
    this.box(-2, 2.18, -4.24, 3.55, 2.45, .12, '#e9dfc3');
    this.box(-2, 2.18, -4.15, 3.25, 2.18, .03, '#ffffff', false, view);
    this.box(-2, 2.18, -4.07, .1, 2.2, .12, '#f3e8cb'); this.box(-2, 2.14, -4.07, 3.3, .09, .12, '#f3e8cb');
    this.box(-2, 1.04, -3.99, 3.75, .12, .4, '#e6d9b6');
    for (const x of [-3.98, -.08]) for (let i = 0; i < 3; i++) this.box(x + i * .1, 2.08, -3.98, .12, 2.7, .14, i % 2 ? '#dad4bb' : '#f1e4c8');
    this.box(-2, 3.52, -3.99, 4.35, .07, .1, '#84785c');
    // Soft block-shaped sunlight and a woven rug.
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const patch = this.box(-1.8 + i * 1.1, .022, -.15 + j * .75, .98, .005, .68, '#e4ca91'); patch.rotation.y = -.2;
    }
    this.box(.4, .018, 1.15, 3.5, .022, 2.2, '#79948a');
    this.box(.4, .034, 1.15, 3.26, .01, 1.98, index % 2 ? '#b4ae88' : '#c5b191');
    for (let i = 0; i < 7; i++) this.box(-1.05 + i * .48, .041, 1.15, .025, .005, 1.92, '#dfd0aa');
    // Sofa, cushions, and side table.
    this.box(-3.9, .4, .65, 1.4, .65, 2.6, '#6d897b', true);
    this.box(-4.45, .88, .65, .32, .85, 2.6, '#7f9988');
    for (const z of [-.13, .65, 1.43]) this.box(-3.78, .76, z, 1.08, .21, .72, '#9aa88b');
    this.box(-3.9, .8, -.7, 1.4, .48, .22, '#657f71'); this.box(-3.9, .8, 2, 1.4, .48, .22, '#657f71');
    this.box(-4, 1, -.12, .45, .38, .55, '#d7b788');
    this.box(-4, 1, 1.34, .45, .38, .55, '#d7c9a8');
    this.table(-2.3, -2.95, 1.45, .68); this.plant(-2.7, -3, .9); this.book(-2.1, .94, -2.85, '#c28066', .12);
    this.table(2.9, -2.9, 2.45, 1.02); this.lamp(3.65, -3.0, .9);
    this.box(2.7, 1.25, -3.14, .92, .6, .09, '#424e49'); this.box(2.7, 1.26, -3.08, .79, .46, .02, '#96b4a3');
    this.box(2.7, 1, -3.1, .09, .3, .12, '#46534b'); this.box(2.7, .94, -2.71, .65, .03, .22, '#dfd7bc');
    this.box(2.8, .53, -1.6, .65, .12, .62, '#6e7c68', true); this.box(2.8, .93, -1.32, .64, .7, .08, '#87917a');
    // Central activity table.
    this.table(.35, -1.45, 1.55, .84);
    this.book(-.1, .94, -1.4, '#e8cb97'); this.book(.1, 1.01, -1.45, '#93a28c', -.18);
    this.box(.77, 1.02, -1.4, .17, .23, .17, '#f1dcc0');
    // Shelf and records.
    this.box(3.2, 2.55, -4.16, 2.8, .13, .42, '#9b7d5c');
    for (let i = 0; i < 8; i++) this.box(2.1 + i * .17, 2.84, -4.12, .12, .47 + (i % 3) * .06, .2, ['#b0836b', '#d0b789', '#718e7f', '#d8d1ae'][i % 4]);
    this.plant(4.1, -4.05, 2.62); this.picture(.55, 2.48, -4.21, 1.15, 1.32, index);
    this.plant(-4.1, 3.2, 0, true); this.plant(4.18, -1, 0, true);
    // Door on right wall, with visible inset panels.
    this.box(4.82, 1.25, 2.15, .13, 2.5, 1.65, '#e8d9b7');
    this.box(4.72, 1.2, 2.15, .09, 2.34, 1.4, '#9e7b58');
    this.box(4.66, 1.75, 2.15, .04, .92, 1.08, '#b4966d'); this.box(4.66, .65, 2.15, .04, .92, 1.08, '#b4966d');
    this.box(4.56, 1.15, 1.68, .16, .09, .09, '#e8c887');
    // Small environmental details distinguish each friend's daily life.
    if (index === 0) {
      this.box(-3.8, .16, 2.75, .65, .3, .6, '#bca981');
      this.box(-3.8, .32, 2.75, .65, .025, .6, '#d7bc8e');
      this.book(-3.8, .37, 2.75, '#7d9889');
    } else if (index === 2) {
      // Kitchen cabinets, stove, and hanging mugs; existing desk acts as counter.
      this.box(3, .44, -3, 2.4, .82, .88, '#d5c8a6');
      for (let i = 0; i < 3; i++) { this.box(2.2 + i * .78, .47, -2.54, .69, .66, .045, '#ebe0bd'); this.box(2.2 + i * .78, .64, -2.5, .18, .04, .045, '#8b8e6c'); }
      this.box(1.95, .93, -3, .65, .06, .7, '#5d6e60');
      this.box(1.95, 1.04, -3, .42, .19, .4, '#889382');
      this.box(1.95, 1.16, -3, .49, .05, .45, '#b9b9a0');
      this.box(.62, 1.05, -1.45, .28, .17, .27, '#d9b77c');
      for (let i = 0; i < 4; i++) this.box(1.8 + i * .4, 2.12, -4.02, .19, .23, .19, ['#e6d7ad','#a7b994','#d6ad8b','#9ab7ac'][i]);
    } else if (index === 3) {
      this.box(-4.25, .5, -2.3, .72, 1, .7, '#5c7380', true);
      this.box(-4.25, 1.3, -2.45, .8, .68, .42, '#687d8b');
      this.box(-4.25, 1.32, -2.2, .62, .43, .035, '#b0c8ab');
      this.box(-4.25, 1, -2.05, .83, .1, .4, '#c6b7a0');
      this.box(-4.4, 1.12, -2.05, .07, .2, .07, '#855957');
      for (let i = 0; i < 4; i++) this.box(-4.42 + i * .12, 1.33, -2.17, .08, .08, .012, i % 2 ? '#7d9785' : '#d6bb89');
    } else if (index === 4) {
      for (let i = 0; i < 3; i++) this.picture(.1 + i * .49, 3.23, -4.17, .34, .42, i);
      this.box(.35, 1.06, -1.39, .35, .24, .23, '#536255');
      this.box(.35, 1.07, -1.24, .16, .16, .13, '#3e4f47');
      this.plant(-4.22, -2.15, 0, true);
      this.plant(1.22, -3.9, 0, true);
    } else if (index === 5) {
      for (let row = 0; row < 3; row++) {
        this.box(-4.4, .55 + row * .63, -2.9, .74, .08, 1.65, '#9a825f');
        for (let j = 0; j < 4; j++) this.box(-4.35, .74 + row * .63, -3.48 + j * .36, .48, .32, .25, ['#8c9a79','#c5ad80','#8eaca0','#c7bca1'][(j+row)%4]);
      }
      this.box(.35, 1.01, -1.4, .68, .19, .48, '#a17f58');
      this.box(.35, 1.12, -1.4, .64, .04, .45, '#e6d3a5');
    } else if (index >= 6) {
      // Pixel upright piano and acoustic tiles, kept outside the walking route.
      this.box(-4.17, .64, -2.75, .86, 1.28, 1.8, '#6b6b55', true);
      this.box(-3.68, .89, -2.75, .2, .06, 1.73, '#e4dfc6');
      for (let i = 0; i < 12; i++) this.box(-3.65, .94, -3.5 + i * .13, .14, .07, .06, '#536054');
      this.box(-4.13, 1.31, -2.75, .93, .08, 1.9, '#867a5b');
      for (let i = 0; i < 5; i++) this.box(1.6 + i * .4, 3.22, -4.23, .3, .55, .1, i % 2 ? '#637b70' : '#7e8e79');
      if (index === 7) {
        for (const x of [1.92, 3.5]) { this.box(x, 1.18, -3.19, .3, .48, .25, '#3f554a'); this.box(x, 1.18, -3.04, .17, .22, .04, '#778c70'); }
        for (let i = 0; i < 6; i++) this.box(2.48 + i * .09, 1.18 + (i % 3) * .06, -3.065, .035, .12 + (i % 3) * .08, .012, '#d5bf8b');
      }
    }
    if (index > 0) {
      const texture = chapter.portrait ? new THREE.TextureLoader().load(assetUrl(chapter.portrait)) : portraitTexture(chapter.shirt, index);
      texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .1 }));
      sprite.position.set(-1.75, 1.1, -.75); sprite.scale.set(1.35, 2.05, 1); this.room.add(sprite);
      this.addHotspot('npc', chapter.name, -1.75, -.75, 2.34);
    }
    this.addHotspot('clue', chapter.clueName, -2.15, -2.9, 1.28);
    this.addHotspot('door', index === 7 ? '今天就在這裡，好好聽歌' : '前往下一站', 4.4, 2.15, 1.65);
    if (index === 0) {
      this.box(-1.8, .96, -2.8, .16, .03, .28, '#e4bd64'); this.addHotspot('key', '拿起鑰匙', -1.8, -2.7, 1.43);
      this.box(.3, .98, -1.4, .22, .04, .36, '#364e48'); this.addHotspot('phone', '看看手機訊息', .3, -1.4, 1.35);
    } else if (index === 1) {
      this.addHotspot('headphones', '耳機（暫定）', -3.5, .3, 1.25);
      this.addHotspot('ticket', '車票（暫定）', -1.85, -2.8, 1.48);
      this.addHotspot('usb', '隨身碟（暫定）', 2.5, -2.55, 1.23);
      this.box(-3.5, .95, .3, .3, .12, .28, '#444d45'); this.box(2.5, .95, -2.55, .14, .04, .22, '#e2b577');
    } else if (index === 7) {
      this.box(.4, 1.14, -1.45, .06, 1.35, .06, '#4b5550'); this.box(.4, 1.82, -1.45, .22, .38, .2, '#536b60');
      this.box(.4, .17, -1.45, .6, .06, .5, '#59685b');
      this.addHotspot('record', '麥克風 · 錄音（暫定）', .4, -1.45, 2.12);
      this.addHotspot('mix', '工作桌 · 混音（暫定）', 2.65, -2.5, 1.72);
      this.box(3.85, .39, .8, .9, .78, .65, '#b39770', true);
      this.box(3.85, .94, .8, .72, .3, .33, '#3d5650'); this.box(3.85, .94, .98, .63, .22, .015, '#738477');
      for (let i = 0; i < 6; i++) this.box(3.59 + i * .1, .94, .998, .025, .2, .01, '#40584f');
      this.addHotspot('speaker', '藍牙喇叭 · 聽新歌', 3.85, .8, 1.42);
      for (let i = 0; i < 6; i++) this.box(1.9 + i * .25, 1.72, -4.25, .15, .95, .07, '#5a6e64');
    } else {
      const labels = ['', '', '料理台 · 準備點心', '記憶玩具 · 亮燈挑戰', '布景板 · 重現合照', '相片盒 · 排列回憶', '節拍器 · 一起練習'];
      this.addHotspot('puzzle', `${labels[index]}（暫定）`, .35, -1.35, 1.5);
      this.box(.35, .99, -1.43, .7, .1, .4, index === 2 ? '#e4cf9d' : chapter.shirt);
      if (index === 3) for (let i = 0; i < 4; i++) this.box(.07 + i * .18, 1.07, -1.43, .12, .07, .18, ['#e5bf76', '#96b490', '#86aebf', '#bfabd0'][i]);
    }
  }
  hide(id: string) { const h = this.hotspots.find(h => h.id === id); if (h) { h.disabled = true; h.marker.visible = false; } }
  nearest(): Hotspot | undefined {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    let closest: Hotspot | undefined, best = Infinity;
    for (const h of this.hotspots) {
      if (h.disabled) continue;
      const delta = new THREE.Vector3(h.x - this.camera.position.x, 0, h.z - this.camera.position.z);
      const distance = delta.length();
      if (distance < 2.15 && (distance < .6 || delta.normalize().dot(forward) > .45)) {
        const score = distance + (1 - delta.dot(forward)) * .8;
        if (score < best) { best = score; closest = h; }
      }
    }
    return closest;
  }
  look(dx: number, dy: number) { this.yaw -= dx * .003; this.pitch = THREE.MathUtils.clamp(this.pitch - dy * .0024, -.68, .68); }
  move(x: number, z: number, dt: number) {
    const length = Math.max(1, Math.hypot(x, z)); x /= length; z /= length;
    const dx = (x * Math.cos(this.yaw) + z * Math.sin(this.yaw)) * dt * 2.4;
    const dz = (-x * Math.sin(this.yaw) + z * Math.cos(this.yaw)) * dt * 2.4;
    const p = this.camera.position;
    const clear = (px: number, pz: number) => Math.abs(px) < 4.52 && pz > -3.91 && pz < 4.05 && !this.obstacles.some(o => Math.abs(px - o.x) < o.w / 2 + .23 && Math.abs(pz - o.z) < o.d / 2 + .23);
    if (clear(p.x + dx, p.z)) p.x += dx;
    if (clear(p.x, p.z + dz)) p.z += dz;
  }
  render(dt: number) {
    this.elapsed += dt;
    if (this.menu) {
      this.camera.position.set(3.8 + Math.sin(this.elapsed * .09) * .2, 2.7, 4.2);
      this.camera.lookAt(-1, 1.1, -1.65);
    } else { this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(this.pitch, this.yaw, 0); }
    for (const h of this.hotspots) {
      h.marker.visible = !this.menu && !h.disabled;
      h.marker.position.y = h.marker.userData.baseY + Math.sin(this.elapsed * 2 + h.x) * .04;
    }
    this.renderer.render(this.scene, this.camera);
  }
}
