// Rounds the card's height up to the field's lattice, a cell plus whole pitches, and
// publishes it as --card-h for the CSS to size and place the card with. CSS rounds the
// card when it fills the screen; this only matters when the words are taller than the
// screen (a phone, or zoomed text), where the height comes from how they wrap.
// ponytail: without this script a phone's card keeps its natural height, and the row of
// cells under it can be cut. Nothing else depends on it.
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
