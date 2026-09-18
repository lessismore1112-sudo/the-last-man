import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
import {traceScopeShot,dragAim} from './scope-shot.mjs';
function actor(x,z){const g=new THREE.Group();g.position.set(x,0,z);const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());mesh.position.y=1;g.add(mesh);const e={g,hp:44};g.userData.entity=e;return e;}
const ray=()=>new THREE.Ray(new THREE.Vector3(0,1.5,0),new THREE.Vector3(0,0,1));
test('crosshair ray hits the actual mesh at range, without acquiring nearby targets',()=>{
  const centred=actor(0,25),offCentre=actor(2,4);
  assert.equal(traceScopeShot(ray(),[offCentre,centred],[],36).entity,centred);
  assert.equal(traceScopeShot(ray(),[offCentre],[],36).entity,null);
});
test('sky shots and shots just beside a target miss',()=>{
  const e=actor(0,15);assert.equal(traceScopeShot(new THREE.Ray(new THREE.Vector3(0,1.5,0),new THREE.Vector3(0,1,1).normalize()),[e],[],36).entity,null);
  assert.equal(traceScopeShot(new THREE.Ray(new THREE.Vector3(1,1.5,0),new THREE.Vector3(0,0,1)),[e],[],36).entity,null);
});
test('first target takes the shot and nothing behind it is selected',()=>{
  const near=actor(0,10),far=actor(0,20);assert.equal(traceScopeShot(ray(),[far,near],[],36).entity,near);
  near.hp=0;assert.equal(traceScopeShot(ray(),[far,near],[],36).entity,far);
});
test('solid cover and ground stop the same ray even if the actor is centred',()=>{
  const e=actor(0,20),obstacle={x:0,z:10,w:4,d:2,h:3};const shot=traceScopeShot(ray(),[e],[obstacle],36);
  assert.equal(shot.entity,null);assert.equal(shot.blocked,true);assert.ok(shot.distance<10);
  const down=traceScopeShot(new THREE.Ray(new THREE.Vector3(0,1.5,0),new THREE.Vector3(0,-1,1).normalize()),[e],[],36);
  assert.equal(down.entity,null);assert.equal(down.blocked,true);
});
test('targets outside range or hidden never receive damage',()=>{
  assert.equal(traceScopeShot(ray(),[actor(0,40)],[],36).entity,null);
  const hidden=actor(0,10);hidden.g.visible=false;assert.equal(traceScopeShot(ray(),[hidden],[],36).entity,null);
});
test('dragging is bounded and higher magnification provides finer adjustment',()=>{
  const normal=dragAim(0,0,100,100,2),zoom=dragAim(0,0,100,100,4);
  assert.ok(Math.abs(zoom.yaw)<Math.abs(normal.yaw));assert.ok(normal.pitch<0);
  assert.equal(dragAim(0,0,0,1e6,2).pitch,-.9);
});
