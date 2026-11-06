import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAP_FULL_VIEW, MAP_MAX_ZOOM, clampMapView,
  zoomMapView, panMapView, mapPointFromClient, attachMapViewport,
} from '../src/map-viewport.mjs';

const near = (actual, expected, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} differs from ${expected}`);

test('zoom keeps an interior anchor fixed and respects the 8× limit', () => {
  const anchor = { x: 300, y: 225 };
  const twice = zoomMapView(MAP_FULL_VIEW, 2, anchor);
  near(twice.width, 290);
  near(twice.height, 262.5);
  near((anchor.x - twice.x) / twice.width, anchor.x / MAP_FULL_VIEW.width);
  near((anchor.y - twice.y) / twice.height, anchor.y / MAP_FULL_VIEW.height);
  const max = zoomMapView(twice, 1000);
  near(MAP_FULL_VIEW.width / max.width, MAP_MAX_ZOOM);
});

test('zoom out, pan and bounding boxes cannot leave the map frame', () => {
  const view = zoomMapView(MAP_FULL_VIEW, 4);
  const topLeft = panMapView(view, -9999, -9999);
  assert.equal(topLeft.x, 0);
  assert.equal(topLeft.y, 0);
  const bottomRight = panMapView(view, 9999, 9999);
  near(bottomRight.x + bottomRight.width, MAP_FULL_VIEW.width);
  near(bottomRight.y + bottomRight.height, MAP_FULL_VIEW.height);
  assert.deepEqual(clampMapView({ x: -900, y: 600, width: 900, height: 900 }), MAP_FULL_VIEW);
  assert.deepEqual(zoomMapView(view, .00001), MAP_FULL_VIEW);
});

test('screen-to-map conversion handles SVG letterboxing', () => {
  const rect = { left: 100, top: 200, width: 800, height: 400 };
  const center = mapPointFromClient(MAP_FULL_VIEW, rect, 500, 400);
  near(center.x, 290);
  near(center.y, 262.5);
  assert.deepEqual(mapPointFromClient(MAP_FULL_VIEW, rect, 100, 100), { x: 0, y: 0 });
});

test('zoom controls, wheel, drag, keyboard and reset act on one SVG viewBox', () => {
  const listeners = new Map();
  const attributes = {};
  const classes = new Set();
  const svg = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    setAttribute(name, value) { attributes[name] = value; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 580, height: 525 }; },
    get clientHeight() { return 525; },
    hasPointerCapture() { return false; },
    setPointerCapture() {},
    releasePointerCapture() {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
  };
  const button = () => ({ disabled: false, addEventListener(type, fn) { this.click = fn; } });
  const zoomIn = button(), zoomOut = button(), reset = button(), label = {};
  const controller = attachMapViewport(svg, { zoomIn, zoomOut, reset, label });
  assert.equal(attributes.viewBox, '0 0 580 525');
  assert.equal(label.textContent, '100%');
  assert.equal(zoomOut.disabled, true);

  zoomIn.click();
  assert.ok(controller.getView().width < 580);
  assert.equal(label.textContent, '145%');
  assert.equal(reset.disabled, false);

  const original = controller.getView();
  listeners.get('pointerdown')({ pointerType: 'mouse', button: 0, pointerId: 1, clientX: 250, clientY: 250 });
  listeners.get('pointermove')({ pointerId: 1, clientX: 220, clientY: 220 });
  assert.ok(controller.getView().x > original.x);
  assert.ok(classes.has('is-panning'));
  listeners.get('pointerup')({ pointerId: 1 });
  assert.ok(!classes.has('is-panning'));
  listeners.get('click')({ preventDefault() {}, stopImmediatePropagation() {} });

  let prevented = false;
  listeners.get('wheel')({ deltaY: -100, deltaMode: 0, clientX: 300, clientY: 260, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.ok(controller.getView().width < original.width);

  const beforeKey = controller.getView().width;
  listeners.get('keydown')({ key: '-', preventDefault() {} });
  assert.ok(controller.getView().width > beforeKey);
  reset.click();
  assert.deepEqual(controller.getView(), MAP_FULL_VIEW);
  assert.equal(attributes.viewBox, '0 0 580 525');
  assert.equal(reset.disabled, true);
});
