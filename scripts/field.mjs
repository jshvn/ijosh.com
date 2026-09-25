// Writes the page background: the jshvn/brand banner field as a repeating tile, one per
// color scheme. 40px cells on a 48px pitch with an 8px corner, which is the mark's grid
// (20 unit cell, 24 unit pitch, rx 4) at twice size; CSS halves it on narrow screens.
// Each cell takes one of four tones by hashing its lattice position, as the banners do,
// so the output is byte-identical on every run.
//
//   node scripts/field.mjs          write static/images/field-{light,dark}.svg
//   node scripts/field.mjs --check  exit 1 if the committed files differ from the output
//
// ponytail: the hash and tones are copied from brand/src/social.mjs and tokens.mjs. The
// tile belongs in jshvn/brand, served from brand.ijosh.com like the banners; move it there
// if a second site ever wants it.
import { readFileSync, writeFileSync } from 'node:fs';

const N = 24; // cells per side; even, so the tile's half-width stays a whole number of pitches
const PITCH = 48;
const CELL = 40;
const RX = 8;

const SCHEMES = {
  // the brand's field: light tones on charcoal
  dark: { tones: ['#f4f7fb', '#a8adb5', '#767b82', '#4a4f56'], opacity: 0.1 },
  // the same grain on white: the tones reversed, a touch lighter
  light: { tones: ['#17191c', '#4a4f56', '#767b82', '#a8adb5'], opacity: 0.07 },
};

const shade = (i, j, tones) => {
  let h = Math.imul(i + 0x9e37, 374761393) ^ Math.imul(j + 0x85eb, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return tones[((h ^ (h >>> 16)) >>> 0) % tones.length];
};

const tile = ({ tones, opacity }) => {
  const groups = new Map(tones.map((t) => [t, []]));
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      groups.get(shade(i, j, tones)).push(`<rect x="${i * PITCH}" y="${j * PITCH}" width="${CELL}" height="${CELL}" rx="${RX}"/>`);
    }
  }
  const size = N * PITCH;
  const body = [...groups].map(([t, rects]) => `<g fill="${t}">${rects.join('')}</g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g opacity="${opacity}">${body}</g></svg>\n`;
};

const check = process.argv.includes('--check');
let stale = false;
for (const [scheme, spec] of Object.entries(SCHEMES)) {
  const path = `static/images/field-${scheme}.svg`;
  const svg = tile(spec);
  if (!check) writeFileSync(path, svg);
  else if (readFileSync(path, 'utf8') !== svg) {
    console.error(`check:field: ${path} differs from scripts/field.mjs -- run \`task field\``);
    stale = true;
  }
}
if (check && !stale) console.log('check:field: field tiles match scripts/field.mjs');
process.exit(stale ? 1 : 0);
