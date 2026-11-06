import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SITES, PROVINCES } from '../src/model.mjs';
import { PROVINCE_MAP, projectLocation, provinceSvgPath, pointInsideProvince, generateMapPositions } from '../src/map-geo.mjs';

const positions=generateMapPositions(DEMO_SITES);

test('GIS boundaries cover exactly the 77 expected Thai provinces', () => {
  assert.equal(PROVINCE_MAP.size,77);
  assert.deepEqual(new Set(PROVINCE_MAP.keys()),new Set(PROVINCES.map(p=>p.name)));
  assert.ok([...PROVINCE_MAP.values()].every(p=>p.polygons.length>0&&provinceSvgPath(p).startsWith('M')));
});

test('all 300 displayed site points are inside their named province and Thailand', () => {
  assert.equal(positions.size,300);
  for (const site of DEMO_SITES) {
    const point=positions.get(site.id),province=PROVINCE_MAP.get(site.province);
    assert.ok(point,`missing map point for ${site.id}`);
    assert.ok(pointInsideProvince(point.lon,point.lat,province),`${site.id} is outside ${site.province}`);
    const {x,y}=projectLocation(point.lon,point.lat);
    assert.ok(x>=0&&x<=580&&y>=0&&y<=525,`${site.id} is outside the SVG viewport`);
  }
});

test('demo points are deterministic, but not falsely exported as GPS coordinates', () => {
  assert.deepEqual([...generateMapPositions(DEMO_SITES)], [...positions]);
  assert.ok(DEMO_SITES.every(site=>!('lat' in site)&&!('lng' in site)));
});

test('simplified Thailand country extent remains in expected WGS84 range', () => {
  const coordinates=[...PROVINCE_MAP.values()].flatMap(p=>p.polygons.flatMap(poly=>poly.flat()));
  const lons=coordinates.map(p=>p[0]),lats=coordinates.map(p=>p[1]);
  assert.ok(Math.min(...lons)>97&&Math.max(...lons)<106);
  assert.ok(Math.min(...lats)>5&&Math.max(...lats)<21);
});
