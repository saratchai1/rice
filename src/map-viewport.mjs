export const MAP_FULL_VIEW = Object.freeze({ x: 0, y: 0, width: 580, height: 525 });
export const MAP_MAX_ZOOM = 8;

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export function clampMapView(view) {
  const zoom = clamp(MAP_FULL_VIEW.width / view.width, 1, MAP_MAX_ZOOM);
  const width = MAP_FULL_VIEW.width / zoom;
  const height = MAP_FULL_VIEW.height / zoom;
  return {
    x: clamp(view.x, 0, MAP_FULL_VIEW.width - width),
    y: clamp(view.y, 0, MAP_FULL_VIEW.height - height),
    width,
    height,
  };
}

export function zoomMapView(view, factor, anchor = { x: view.x + view.width / 2, y: view.y + view.height / 2 }) {
  if (!Number.isFinite(factor) || factor <= 0) return { ...view };
  const zoom = clamp(MAP_FULL_VIEW.width / view.width * factor, 1, MAP_MAX_ZOOM);
  const width = MAP_FULL_VIEW.width / zoom;
  const height = MAP_FULL_VIEW.height / zoom;
  const scale = width / view.width;
  return clampMapView({
    x: anchor.x - (anchor.x - view.x) * scale,
    y: anchor.y - (anchor.y - view.y) * scale,
    width,
    height,
  });
}

export function panMapView(view, dx, dy) {
  return clampMapView({ ...view, x: view.x + dx, y: view.y + dy });
}

export function mapPixelScale(view, rect) {
  return Math.min(rect.width / view.width, rect.height / view.height);
}

export function mapPointFromClient(view, rect, clientX, clientY) {
  const scale = mapPixelScale(view, rect);
  const padX = (rect.width - view.width * scale) / 2;
  const padY = (rect.height - view.height * scale) / 2;
  return {
    x: clamp(view.x + (clientX - rect.left - padX) / scale, view.x, view.x + view.width),
    y: clamp(view.y + (clientY - rect.top - padY) / scale, view.y, view.y + view.height),
  };
}

export function attachMapViewport(svg, { zoomIn, zoomOut, reset, label }) {
  let view = { ...MAP_FULL_VIEW };
  const pointers = new Map();
  let blockClick = false;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function apply(next) {
    view = clampMapView(next);
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    const currentZoom = MAP_FULL_VIEW.width / view.width;
    label.textContent = `${Math.round(currentZoom * 100)}%`;
    zoomIn.disabled = currentZoom >= MAP_MAX_ZOOM - 1e-7;
    zoomOut.disabled = currentZoom <= 1 + 1e-7;
    reset.disabled = currentZoom <= 1 + 1e-7 && view.x === 0 && view.y === 0;
  }

  function zoomAt(factor, clientX, clientY) {
    const anchor = Number.isFinite(clientX) && Number.isFinite(clientY)
      ? mapPointFromClient(view, svg.getBoundingClientRect(), clientX, clientY)
      : undefined;
    apply(zoomMapView(view, factor, anchor));
  }

  zoomIn.addEventListener('click', () => zoomAt(1.45));
  zoomOut.addEventListener('click', () => zoomAt(1 / 1.45));
  reset.addEventListener('click', () => apply(MAP_FULL_VIEW));
  svg.addEventListener('wheel', event => {
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? svg.clientHeight : 1);
    zoomAt(Math.exp(-delta * 0.0014), event.clientX, event.clientY);
  }, { passive: false });

  svg.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, dragging: false });
  });

  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const previous = [...pointers.values()].map(p => ({ ...p }));
    const pointer = pointers.get(event.pointerId);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (pointers.size >= 2) {
      const next = [...pointers.values()];
      const startMid = midpoint(previous[0], previous[1]);
      const endMid = midpoint(next[0], next[1]);
      const before = distance(previous[0], previous[1]);
      const after = distance(next[0], next[1]);
      if (before > 4 && after > 4) {
        const anchor = mapPointFromClient(view, svg.getBoundingClientRect(), startMid.x, startMid.y);
        const zoomed = zoomMapView(view, after / before, anchor);
        const px = mapPixelScale(zoomed, svg.getBoundingClientRect());
        apply(panMapView(zoomed, -(endMid.x - startMid.x) / px, -(endMid.y - startMid.y) / px));
      }
      blockClick = true;
      for (const [id, p] of pointers) {
        p.dragging = true;
        if (!svg.hasPointerCapture(id)) svg.setPointerCapture(id);
      }
      svg.classList.add('is-panning');
    } else if (MAP_FULL_VIEW.width / view.width > 1) {
      if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) >= 4) pointer.dragging = true;
      if (pointer.dragging) {
        if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
        const scale = mapPixelScale(view, svg.getBoundingClientRect());
        apply(panMapView(view, -(pointer.x - previous[0].x) / scale, -(pointer.y - previous[0].y) / scale));
        blockClick = true;
        svg.classList.add('is-panning');
      }
    }
  });

  function pointerEnd(event) {
    pointers.delete(event.pointerId);
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (pointers.size < 2) {
      for (const p of pointers.values()) { p.startX = p.x; p.startY = p.y; p.dragging = false; }
    }
    if (!pointers.size) svg.classList.remove('is-panning');
  }
  svg.addEventListener('pointerup', pointerEnd);
  svg.addEventListener('pointercancel', pointerEnd);
  svg.addEventListener('click', event => {
    if (blockClick) { event.preventDefault(); event.stopImmediatePropagation(); blockClick = false; }
  }, true);

  svg.addEventListener('keydown', event => {
    const key = event.key;
    if (key === '+' || key === '=') zoomAt(1.45);
    else if (key === '-' || key === '_') zoomAt(1 / 1.45);
    else if (key === '0' || key === 'Escape') apply(MAP_FULL_VIEW);
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      const steps = { ArrowUp: [0, -25], ArrowDown: [0, 25], ArrowLeft: [-25, 0], ArrowRight: [25, 0] };
      apply(panMapView(view, ...steps[key]));
    } else return;
    event.preventDefault();
  });

  apply(view);
  return { getView: () => ({ ...view }), reset: () => apply(MAP_FULL_VIEW) };
}
