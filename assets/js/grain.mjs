// The field's grain: the tones for each color scheme, and which one a lattice cell takes by
// hashing its position, as the jshvn/brand banners do. scripts/field.mjs writes the static
// tile from it; assets/js/weather.js redraws the same lattice on a canvas.
//
// ponytail: the hash and tones are copied from brand/src/social.mjs and tokens.mjs. The tile
// belongs in jshvn/brand, served from brand.ijosh.com like the banners; move it there if a
// second site ever wants it.

export const SCHEMES = {
  // the brand's field: light tones on charcoal
  dark: { tones: ['#f4f7fb', '#a8adb5', '#767b82', '#4a4f56'], opacity: 0.1 },
  // the same grain on white: the tones reversed, a touch lighter
  light: { tones: ['#17191c', '#4a4f56', '#767b82', '#a8adb5'], opacity: 0.07 },
};

export const hash = (i, j) => {
  let h = Math.imul(i + 0x9e37, 374761393) ^ Math.imul(j + 0x85eb, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

// A cell's index into its scheme's tones; 0 is the strongest.
export const shade = (i, j) => hash(i, j) % 4;
