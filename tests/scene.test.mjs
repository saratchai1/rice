import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { PlantScene } from '../src/scene.js';

test('conceptual 3D factory builds all 8 numbered assets and conveyors without WebGL', () => {
  const oldDocument=globalThis.document;
  globalThis.document={ createElement:()=>({ width:0,height:0,getContext:()=>({beginPath(){},roundRect(){},fill(){},stroke(){},fillText(){}}) }) };
  try {
    const plant=Object.create(PlantScene.prototype);
    plant.scene=new THREE.Scene();
    plant.assetGroups=new Map();plant.indicators=new Map();plant.labels=[];plant.particles=[];
    plant.buildPlant();
    assert.equal(plant.assetGroups.size,8);
    assert.equal(plant.indicators.size,8);
    assert.equal(plant.labels.length,8);
    assert.ok(plant.particles.length>=35);
    for(let id=1;id<=8;id++)assert.ok(plant.assetGroups.has(id),`asset ${id} missing`);
    assert.ok(plant.scene.children.length>=8);
    assert.ok(plant.thermalCloud);
  } finally {globalThis.document=oldDocument;}
});
