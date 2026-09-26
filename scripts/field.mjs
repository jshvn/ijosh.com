// Writes the page background: the jshvn/brand banner field as a repeating tile, one per
// color scheme. 40px cells on a 48px pitch with an 8px corner, which is the mark's grid
// (20 unit cell, 24 unit pitch, rx 4) at twice size; CSS halves it on narrow screens.
// Each cell takes one of four tones from the grain (assets/js/grain.mjs), so the output
// is byte-identical on every run.
//
//   node scripts/field.mjs          write static/images/field-{light,dark}.svg
//   node scripts/field.mjs --check  exit 1 if the committed files differ from the output
import { readFileSync, writeFileSync } from 'node:fs';
import { SCHEMES, shade } from '../assets/js/grain.mjs';

const N = 24; // cells per side; even, so the tile's half-width stays a whole number of pitches
const PITCH = 48;
const CELL = 40;
const RX = 8;

const tile = ({ tones, opacity }) => {
  const groups = new Map(tones.map((t) => [t, []]));
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      groups.get(tones[shade(i, j)]).push(`<rect x="${i * PITCH}" y="${j * PITCH}" width="${CELL}" height="${CELL}" rx="${RX}"/>`);
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
