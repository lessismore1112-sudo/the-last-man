import * as THREE from './vendor/three.module.js';

// Only the centre ray counts. No nearest-target selection, aim snapping or random miss.
export function traceScopeShot(ray, entities, obstacles, range) {
  const caster=new THREE.Raycaster(ray.origin,ray.direction,0,range);
  const roots=entities.filter(e=>e.hp>0&&e.g.visible).map(e=>e.g);
  roots.forEach(g=>g.updateWorldMatrix(true,true));
  const hit=caster.intersectObjects(roots,true)[0];
  let entity=null;
  if(hit){let object=hit.object;while(object&&!object.userData.entity)object=object.parent;entity=object?.userData.entity||null;}
  let barrierDistance=range,barrierPoint=null;
  for(const o of obstacles){
    const bounds=new THREE.Box3(new THREE.Vector3(o.x-o.w/2,0,o.z-o.d/2),new THREE.Vector3(o.x+o.w/2,o.h??2,o.z+o.d/2));
    const p=ray.intersectBox(bounds,new THREE.Vector3());
    if(p){const d=ray.origin.distanceTo(p);if(d<=barrierDistance){barrierDistance=d;barrierPoint=p;}}
  }
  const ground=ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.07),new THREE.Vector3());
  if(ground&&ray.origin.distanceTo(ground)<barrierDistance){barrierDistance=ray.origin.distanceTo(ground);barrierPoint=ground;}
  if(hit&&entity&&hit.distance<barrierDistance)return {entity,distance:hit.distance,point:hit.point,blocked:false};
  return {entity:null,distance:barrierDistance,point:barrierPoint||ray.at(range,new THREE.Vector3()),blocked:!!barrierPoint};
}

export function dragAim(yaw,pitch,dx,dy,zoom=2) {
  const sensitivity=.0026*(2/zoom);
  return {yaw:yaw-dx*sensitivity,pitch:THREE.MathUtils.clamp(pitch-dy*sensitivity,-.9,.9)};
}
