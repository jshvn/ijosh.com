// Weather: soft fronts of light and shade drift over the field. A canvas laid over the
// field's tile redraws the same lattice, and a slow value noise over each cell's position
// and time lifts or lowers its tone. It starts as the tile exactly and eases in over three
// seconds. A visitor who asks for reduced motion, like a page without scripts, never gets
// the canvas and sees the tile alone.
import { SCHEMES, hash, shade } from './grain.mjs';

const root = document.documentElement;
const field = document.querySelector('.field');
const card = document.querySelector('.card');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// A cell's look is one number, its level. 0 to 1 walks the four tones from faintest to
// strongest at the field's opacity; 1 to LMAX raises the strongest tone's opacity to GLOW.
// 60 steps a level land the tones' own levels (0, 1/3, 2/3, 1) exactly, so at rest the
// canvas draws the tile's colors.
const LMAX = 2.5;
const STEPS = 150;
const GLOW = { dark: 0.4, light: 0.27 };

const lerp = (a, b, f) => a + (b - a) * f;
const smooth = (f) => f * f * (3 - 2 * f);

let colors = [];
let bg = '';

const recolor = () => {
  const style = getComputedStyle(root);
  const scheme = style.colorScheme === 'dark' ? 'dark' : 'light';
  const { tones, opacity } = SCHEMES[scheme];
  const rgb = tones.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  bg = style.getPropertyValue('--bg').trim();
  colors = Array.from({ length: STEPS + 1 }, (_, n) => {
    const l = (n / STEPS) * LMAX;
    if (l > 1) return `rgba(${rgb[0]},${lerp(opacity, GLOW[scheme], (l - 1) / (LMAX - 1))})`;
    const q = (1 - l) * 3;
    const i = Math.min(2, Math.floor(q));
    return `rgba(${rgb[i].map((v, k) => Math.round(lerp(v, rgb[i + 1][k], q - i)))},${opacity})`;
  });
};

// Value noise in [0, 1], smooth along all three axes, from the grain's hash.
const at = (i, j, k) => hash(i + Math.imul(k, 1013), j - Math.imul(k, 743)) / 4294967296;
const plane = (x, y, k, u, v) =>
  lerp(lerp(at(x, y, k), at(x + 1, y, k), u), lerp(at(x, y + 1, k), at(x + 1, y + 1, k), u), v);
const noise = (x, y, z) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  return lerp(plane(xi, yi, zi, u, v), plane(xi, yi, zi + 1, u, v), smooth(z - zi));
};

// The tile's lattice: anchored to the card's top-left corner, a cell 5/6 of a pitch, and
// the grain repeating every 24 cells. The field's percentage background position starts the
// tile half a tile (12 cells) left of the card. Cells wholly under the card are never seen.
let cells = [];
let pitch = 24;
let dpr = 1;

const layout = () => {
  const f = field.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const w = field.clientWidth;
  const h = field.clientHeight;
  pitch = parseFloat(getComputedStyle(root).getPropertyValue('--pitch'));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ox = c.left - f.left;
  const oy = c.top - f.top;
  const size = (pitch * 5) / 6;
  const wrap = (n) => ((n % 24) + 24) % 24;
  cells = [];
  for (let b = Math.floor(-oy / pitch); oy + b * pitch < h; b++) {
    for (let a = Math.floor(-ox / pitch); ox + a * pitch < w; a++) {
      const x = ox + a * pitch;
      const y = oy + b * pitch;
      if (x >= ox && y >= oy && x + size <= ox + c.width && y + size <= oy + c.height) continue;
      cells.push({ a, b, x, y, l0: (3 - shade(wrap(a + 12), wrap(b))) / 3 });
    }
  }
};

let t = 0;

const draw = () => {
  const amp = smooth(Math.min(1, t / 3));
  const size = (pitch * 5) / 6;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const { a, b, x, y, l0 } of cells) {
    let l = l0;
    let s = size;
    if (amp) {
      const n = 0.65 * noise(a * 0.16, b * 0.16, t * 0.22) + 0.35 * noise(a * 0.4 + 50, b * 0.4, t * 0.4);
      l += (n - 0.5) * 3.2 * amp;
      s *= 1 + (0.12 * n - 0.06) * amp;
    }
    ctx.fillStyle = colors[Math.round((Math.min(LMAX, Math.max(0, l)) / LMAX) * STEPS)];
    ctx.beginPath();
    ctx.roundRect(x + (size - s) / 2, y + (size - s) / 2, s, s, s / 5);
    ctx.fill();
  }
};

// About 30 frames a second: the fronts drift a pixel or two a second, and skipping every
// other frame halves the work on a phone. A frame after a hidden tab resumes where it left.
let raf = 0;
let last = 0;
const frame = (now) => {
  raf = requestAnimationFrame(frame);
  if (now - last < 30) return;
  t += Math.min(0.1, (now - last) / 1000);
  last = now;
  draw();
};

// The canvas goes in only once it holds a frame, so the tile never flashes blank.
const start = () => {
  t = 0;
  last = performance.now();
  recolor();
  layout();
  draw();
  field.prepend(canvas);
  raf = requestAnimationFrame(frame);
};
const stop = () => {
  cancelAnimationFrame(raf);
  canvas.remove();
};

if (field && card) {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = () => (still.matches ? stop() : start());
  const redraw = (fn) => () => {
    if (!canvas.isConnected) return;
    fn();
    draw();
  };
  const resize = new ResizeObserver(redraw(layout));
  resize.observe(field);
  resize.observe(card);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw(recolor));
  still.addEventListener('change', toggle);
  toggle();
}
