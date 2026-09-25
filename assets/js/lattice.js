// Rounds the card's height up to the field's lattice, a cell plus whole pitches, and
// publishes it as --card-h. The CSS uses it for the card's min-height and, on the wide
// layout, to centre the lattice on the card, so the bottom edge falls between cells too.
// ponytail: without this script the card keeps its natural height, and on a phone the
// row of cells under it can be cut. Width needs no script; CSS rounds that.
const root = document.documentElement;
const card = document.querySelector('.card');

const snap = () => {
  root.style.removeProperty('--card-h');
  const pitch = parseFloat(getComputedStyle(root).getPropertyValue('--pitch'));
  const cell = (pitch * 5) / 6; // the mark's grid: 20 unit cells on a 24 unit pitch
  const rows = Math.ceil((card.offsetHeight - cell) / pitch);
  root.style.setProperty('--card-h', `${rows * pitch + cell}px`);
};

// Fires on load, on font swap, and when a resize reflows the words or crosses a breakpoint.
if (card) new ResizeObserver(snap).observe(card);
