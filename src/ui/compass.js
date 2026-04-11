const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function dirIndex(dir) {
  const i = DIRS.indexOf(dir);
  return i >= 0 ? i : 0;
}

/**
 * Renders a 100x100 compass rose with cardinal labels and a pointer for `dir`.
 * @param {string} dir One of N, NE, E, SE, S, SW, W, NW
 * @returns {HTMLDivElement}
 */
export function renderCompass(dir) {
  const idx = dirIndex(dir);
  const angle = idx * 45; // degrees, clockwise from North-up

  const wrap = document.createElement('div');
  wrap.className = 'compass-rose';

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('width', '100');
  svg.setAttribute('height', '100');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Compass pointing ${dir}`);

  const bg = document.createElementNS(ns, 'circle');
  bg.setAttribute('cx', '50');
  bg.setAttribute('cy', '50');
  bg.setAttribute('r', '48');
  bg.setAttribute('fill', 'transparent');
  bg.setAttribute('stroke', 'rgba(255,255,255,0.12)');
  bg.setAttribute('stroke-width', '1.5');
  svg.appendChild(bg);

  // Cardinal labels around the edge
  const labelR = 41;
  DIRS.forEach((d, i) => {
    const a = ((i * 45 - 90) * Math.PI) / 180;
    const x = 50 + labelR * Math.cos(a);
    const y = 50 + labelR * Math.sin(a);
    const t = document.createElementNS(ns, 'text');
    t.textContent = d;
    t.setAttribute('x', String(x));
    t.setAttribute('y', String(y));
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.setAttribute('fill', d === dir ? '#b8f54a' : 'rgba(255,255,255,0.28)');
    t.setAttribute('font-family', 'Geist Mono, monospace');
    t.setAttribute('font-size', '9');
    t.setAttribute('font-weight', '600');
    svg.appendChild(t);
  });

  const g = document.createElementNS(ns, 'g');
  g.setAttribute('transform', `translate(50 50) rotate(${angle})`);

  // Pointer triangle (points up in local coords; rotate group for direction)
  const pointer = document.createElementNS(ns, 'path');
  pointer.setAttribute(
    'd',
    'M0,-34 L7,-22 L-7,-22 Z',
  );
  pointer.setAttribute('fill', '#b8f54a');
  pointer.setAttribute('stroke', 'rgba(0,0,0,0.35)');
  pointer.setAttribute('stroke-width', '0.6');
  pointer.setAttribute('stroke-linejoin', 'round');

  const anim = document.createElementNS(ns, 'animate');
  anim.setAttribute('attributeName', 'opacity');
  anim.setAttribute('values', '1;0.55;1');
  anim.setAttribute('dur', '1.1s');
  anim.setAttribute('repeatCount', '1');
  pointer.appendChild(anim);

  g.appendChild(pointer);
  svg.appendChild(g);

  const hub = document.createElementNS(ns, 'circle');
  hub.setAttribute('cx', '50');
  hub.setAttribute('cy', '50');
  hub.setAttribute('r', '6');
  hub.setAttribute('fill', '#b8f54a');
  hub.setAttribute('stroke', 'rgba(0,0,0,0.35)');
  hub.setAttribute('stroke-width', '0.6');
  svg.appendChild(hub);

  wrap.appendChild(svg);
  return wrap;
}
