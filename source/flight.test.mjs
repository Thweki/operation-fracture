import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createFlight} from './flight.js';
import {encounterCollision} from './combat-collision.js';

function craft(solids=[]){
  const camera=new T.PerspectiveCamera(),start=new T.Vector3(6,6,-150);
  camera.position.copy(start);camera.updateMatrixWorld();
  const collider=encounterCollision(T,solids,()=>0,{extent:260});collider.rebuild(new T.Vector3(0,0,0));
  const controls=createFlight(T,camera.position,camera,{heightAt:()=>0,bounds:{minX:-218,maxX:218,minZ:-225,maxZ:214},collider});
  return {camera,controls,start};
}
test('a neutral-stick dodge has the same distance at 30 and 120 Hz',()=>{
  for(const hz of [30,120]){
    const {camera,controls,start}=craft();
    assert.equal(controls.dash(new Set()),true);
    assert.equal(controls.dash(new Set()),false);
    for(let i=0;i<hz/2;i++)controls.update(1/hz,new Set(),true,false);
    assert.ok(Math.abs(start.distanceTo(camera.position)-4.23)<.01);
  }
});
test('oblique motion slides along a solid and cannot pass through it',()=>{
  const {camera,controls}=craft([new T.Box3(new T.Vector3(7,0,-200),new T.Vector3(8,15,-110))]);
  const keys=new Set(['KeyW','KeyD']);
  for(let i=0;i<100;i++)controls.update(1/60,keys,false,false);
  assert.ok(camera.position.x<=7&&camera.position.x>6);
  assert.ok(camera.position.z< -160);
});
test('analogue input preserves small movements and braking removes drift',()=>{
  const {camera,controls,start}=craft();controls.setStick(.25,0);
  for(let i=0;i<60;i++)controls.update(1/60,new Set(),false,false);
  const distance=camera.position.distanceTo(start);assert.ok(distance>3&&distance<3.4);
  controls.setStick(0,0);for(let i=0;i<30;i++)controls.update(1/60,new Set(),false,false);
  assert.equal(controls.speed,0);
});
