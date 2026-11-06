import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSETS, CAPEX_PER_SITE, NATIONAL_NOMINAL_CAPEX, PROJECT_COUNT, PROVINCES,
  DEMO_SITES, REGIONS, DEMO_TEAMS, getFleetStats, calculateDrying,
  makeWorkOrder, advanceWorkOrder, seedWorkOrders } from '../src/model.mjs';

test('source BOQ totals 11.8 million baht for eight asset categories', () => {
  assert.equal(ASSETS.length, 8);
  assert.equal(CAPEX_PER_SITE, 11800000);
  assert.equal(NATIONAL_NOMINAL_CAPEX, 3540000000);
});

test('300 synthetic sites cover all 77 provinces without fabricated GPS', () => {
  assert.equal(PROVINCES.length, 77);
  assert.equal(PROJECT_COUNT, 300);
  assert.equal(DEMO_SITES.length, 300);
  assert.equal(new Set(DEMO_SITES.map(s => s.id)).size, 300);
  assert.equal(new Set(DEMO_SITES.map(s => s.province)).size, 77);
  assert.ok(DEMO_SITES.every(s => s.demo && !('lat' in s) && !('lng' in s)));
});

test('fleet health distribution accounts for all sites', () => {
  const stats=getFleetStats();
  assert.equal(stats.assets, 2400);
  assert.equal(stats.healthy+stats.warning+stats.critical+stats.offline, 300);
});

test('regional demo team registry matches all six regions', () => {
  assert.equal(REGIONS.length, 6);
  assert.equal(DEMO_TEAMS.length, 6);
  assert.equal(new Set(DEMO_TEAMS.map(t => t.region)).size, 6);
});

test('wet basis dry matter and water balances close', () => {
  const result=calculateDrying({ inletMoisture:24, outletMoisture:14, feedTph:2.8 });
  const drySolidsIn=2.8*(1-.24);
  const drySolidsOut=result.outputTph*(1-.14);
  assert.ok(Math.abs(drySolidsIn-drySolidsOut)<1e-10);
  assert.ok(Math.abs(result.evaporatedKgH-(2.8-result.outputTph)*1000)<1e-10);
  assert.ok(result.biomassKgH>0);
});

test('no drying occurs when target moisture is not below inlet', () => {
  const x=calculateDrying({inletMoisture:14,outletMoisture:16,feedTph:2});
  assert.equal(x.evaporatedKgH,0);
  assert.equal(x.biomassKgH,0);
  assert.ok(x.warnings.length>0);
});

test('solar supply cannot exceed electric demand in self-consumption metric', () => {
  const x=calculateDrying({solarKwp:150,solarFactor:1,feedTph:1});
  assert.ok(x.solarKw>x.electricalDemandKw);
  assert.equal(x.solarUsedKw,x.electricalDemandKw);
  assert.equal(x.gridKw,0);
});

test('zero feed does not generate biomass demand', () => {
  const x=calculateDrying({feedTph:0});
  assert.equal(x.evaporatedKgH,0);
  assert.equal(x.biomassKgH,0);
});

test('work orders validate site, asset and priority', () => {
  assert.throws(()=>makeWorkOrder({siteId:'RICE-999',assetId:1}),/Unknown site/);
  assert.throws(()=>makeWorkOrder({siteId:'RICE-001',assetId:42}),/Unknown asset/);
  assert.throws(()=>makeWorkOrder({siteId:'RICE-001',assetId:1,priority:'secret'}),/Invalid priority/);
  const order=makeWorkOrder({siteId:'RICE-001',assetId:3});
  assert.equal(order.status,'new');
  assert.equal(order.demo,true);
});

test('work orders cannot be assigned to a team in the wrong region', () => {
  const order=makeWorkOrder({siteId:'RICE-001',assetId:3});
  const wrong=DEMO_TEAMS.find(t=>t.region!==order.region);
  assert.throws(()=>advanceWorkOrder(order,wrong.id),/same region/);
});

test('work order workflow can complete and is idempotent at done', () => {
  let order=makeWorkOrder({siteId:'RICE-001',assetId:3});
  const team=DEMO_TEAMS.find(t=>t.region===order.region);
  order=advanceWorkOrder(order,team.id);assert.equal(order.status,'assigned');
  order=advanceWorkOrder(order);assert.equal(order.status,'in_progress');
  order=advanceWorkOrder(order);assert.equal(order.status,'done');
  assert.deepEqual(advanceWorkOrder(order),order);
  assert.ok(seedWorkOrders().length>0);
});
