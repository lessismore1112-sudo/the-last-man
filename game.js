import {STAGES,buildPlan,canPlaceBarrier} from './expedition-rules.mjs';
import {bindPress,bindHold,bindChoice} from './touch-controls.mjs';
import * as THREE from './vendor/three.module.js';
import {traceScopeShot,dragAim} from './scope-shot.mjs';
import {deriveFitness,WEAPONS,canEquip,attackPlan,hitDamage,lineBlocked,staminaStep} from './game-rules.mjs';
const $=s=>document.querySelector(s), clamp=THREE.MathUtils.clamp;
const stageId=Object.hasOwn(STAGES,new URLSearchParams(location.search).get('stage'))?new URLSearchParams(location.search).get('stage'):'city',stage=STAGES[stageId];
const SAVE='the-day-deadzone-save-v1'+(stageId==='city'?'':'-'+stageId), SNAP='the-day-deadzone-skills-v1';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}}
let skills=read(SNAP,{scores:{combat:.2,mobility:.3,shelter:.2,food:0,lifeline:0,tactics:0,body:0},levels:{'hunt-license':2}});
const sc=k=>clamp(Number(skills.scores?.[k])||0,0,1),lv=k=>clamp(Number(skills.levels?.[k])||0,0,5);
skills.body=read('the-day-body-v1',skills.body||{});
skills.levels={...skills.levels,...read('the-day-skills-v2',{})};
let fitness=deriveFitness(skills.body);
const fresh=()=>({x:0,z:14,hp:fitness.maxHP,maxHP:fitness.maxHP,stamina:fitness.maxStamina,maxStamina:fitness.maxStamina,ammo:18,med:1,loot:[],killed:[],harvested:[],wildlife:{},enemies:{},food:0,weapon:'fists',materials:6,structures:[],bridgeBuilt:false,seconds:0,won:false});
let state=fresh(),mode='intro',inside=null,near=null,onBike=false,angle=0,targetAngle=0,time=0,toastTime=0,saveTime=0,grace=0;
let stored=read(SAVE,null);if(stored&&Number.isFinite(stored.x)&&Array.isArray(stored.loot)&&stored.hp>0&&!stored.won)state={...fresh(),...stored};
state.hp=clamp(state.hp/(state.maxHP||100)*fitness.maxHP,0,fitness.maxHP);state.maxHP=fitness.maxHP;
state.stamina=clamp(state.stamina/(state.maxStamina||100)*fitness.maxStamina,0,fitness.maxStamina);state.maxStamina=fitness.maxStamina;
state.harvested=Array.isArray(state.harvested)?state.harvested:[];state.enemies=state.enemies||{};state.wildlife=state.wildlife||{};state.killed=Array.isArray(state.killed)?state.killed:[];
state.materials=Math.max(0,Number(state.materials)||0);state.structures=Array.isArray(state.structures)?state.structures:[];
if(!canEquip(state.weapon,skills.levels))state.weapon='fists';
const scene=new THREE.Scene();scene.background=new THREE.Color(stage.sky);scene.fog=new THREE.FogExp2(stage.sky,.012);
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){$('#loading').textContent='3D表示にはWebGL対応ブラウザが必要です。';$('#startButton').disabled=true;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.28;$('#world').append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.1,240);camera.position.set(20,23,35);
scene.add(new THREE.HemisphereLight('#b7d8dc','#394431',2.2));
const sun=new THREE.DirectionalLight('#ffcf92',3.5);sun.position.set(-25,45,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,near:1,far:160});sun.shadow.normalBias=.04;scene.add(sun);
const world=new THREE.Group();scene.add(world);const interiors=new THREE.Group();scene.add(interiors);interiors.visible=false;
const colliders=[],buildings=[],interactions=[],zombies=[],deer=[];const mats=new Map();
function mat(c){if(!mats.has(c))mats.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.87,flatShading:true}));return mats.get(c)}
const boxGeo=new THREE.BoxGeometry(1,1,1);
function box(parent,x,y,z,w,h,d,c,shadow=true){const m=new THREE.Mesh(boxGeo,mat(c));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m}
function cyl(parent,x,y,z,r,h,c,n=8){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function label(parent,text,x,y,z,w=5,color='#d7c795',background='#263c38'){const cv=document.createElement('canvas');cv.width=512;cv.height=128;const c=cv.getContext('2d');c.fillStyle=background;c.fillRect(0,0,512,128);c.fillStyle=color;c.textAlign='center';c.font='bold 52px sans-serif';c.fillText(text,256,85);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(w,w/4),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));m.position.set(x,y,z);parent.add(m);return m}
let seed=72819;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
box(world,0,-.35,0,140,.6,160,stage.ground);box(world,0,0,0,13,.08,145,'#333e3b');box(world,0,.01,6,130,.09,12,'#333e3b');box(world,0,.01,-29,90,.09,10,'#333e3b');
for(let z=-68;z<70;z+=7)box(world,0,.065,z,.15,.015,2.9,'#b6ae7d',false);
for(let x=-60;x<60;x+=7){if(Math.abs(x)>7)box(world,x,.07,6,3,.02,.15,'#b6ae7d',false)}
[-1,1].forEach(s=>{box(world,s*7,.12,0,1,.25,138,'#7a8171');box(world,s*35,.12,13,56,.25,1,'#7a8171');box(world,s*35,.12,-1,56,.25,1,'#7a8171')});
for(let i=0;i<7;i++)box(world,-5+i*1.6,.07,12,.75,.018,3,'#b7b9a2',false);
// Puddles and fine street markings.
const wet=new THREE.MeshStandardMaterial({color:'#607c77',roughness:.18,metalness:.38,transparent:true,opacity:.65});for(let i=0;i<24;i++){const m=new THREE.Mesh(new THREE.CircleGeometry(.5+rnd()*1.5,12),wet);m.rotation.x=-Math.PI/2;m.scale.y=.35+rnd()*.5;m.position.set((rnd()-.5)*10,.072,(rnd()-.5)*120);world.add(m)}
function building(x,z,w,d,h,color,name,id){const g=new THREE.Group();g.position.set(x,0,z);world.add(g);box(g,0,h/2,0,w,h,d,color);box(g,0,.4,0,w+.4,.8,d+.4,'#616758');box(g,0,h+.15,0,w+.6,.3,d+.6,'#414c46');box(g,0,h+.65,0,w-1,1,d-1,'#586354');box(g,1,h+1.5,0,2,1,2,'#778172');
for(let y=2.8;y<h-1;y+=2.6){for(let xx=-w/2+1.5;xx<w/2;xx+=2.4){box(g,xx,y,d/2+.035,1.25,1.6,.09,rnd()>.7?'#a29467':'#293e3e',false);box(g,xx,y,d/2+.1,1.45,.1,.3,'#8a8e78',false)}for(let zz=-d/2+1.5;zz<d/2;zz+=2.6)box(g,w/2+.04,y,zz,.08,1.6,1.3,'#2c4342',false)}
box(g,0,1.3,d/2+.08,1.8,2.5,.15,'#202f2c');box(g,-1,1.35,d/2+.16,.12,2.7,.25,'#98a08a');box(g,1,1.35,d/2+.16,.12,2.7,.25,'#98a08a');if(name){label(g,name,0,4.5,d/2+.14,Math.min(w-1,7));box(g,0,3.5,d/2+.7,w-.5,.15,1.5,'#7c7654');}
colliders.push({x,z,w:w+.2,d:d+.2,h:h+1.2});buildings.push({g,x,z,w,d,h});if(id)interactions.push({id,type:'door',x,z:z+d/2+1.25,name,building:g});return g;}
if(stageId==='city'){
building(-16,-13,13,16,10,'#697266','CLINIC','clinic');building(16,-13,13,16,7,'#867d67','MOTOR WORKS','garage');building(-18,25,17,15,15,'#73776a','WEST BLOCK');building(18,24,16,14,11,'#847762','NO SIGNAL');building(-17,-44,14,15,9,'#65746e','RADIO / 04','radio');building(20,-44,18,15,18,'#777e71','NORTH TOWER');building(-39,-12,14,15,12,'#69736a');building(39,-12,14,15,14,'#827b6a');building(-41,25,14,14,8,'#77735f');building(42,25,13,15,9,'#58685d');
}else if(stageId==='forest'){
 building(-16,-13,10,10,4,'#817b59',stage.names[0],'clinic');building(20,22,20,12,5,'#776244',stage.names[1],'garage');building(-17,-44,9,10,7,'#697461',stage.names[2],'radio');
 for(const [x,z] of [[-36,12],[36,-14],[-37,-40]])building(x,z,9,9,4,'#71664d','CABIN');
}else{
 building(-19,-13,19,12,5,'#65767d',stage.names[0],'clinic');building(23,24,24,14,6,'#82745e',stage.names[1],'garage');building(-20,-47,15,13,8,'#72828a',stage.names[2],'radio');
 for(let i=0;i<6;i++){const x=30+(i%2)*9,z=-38+Math.floor(i/2)*15;box(world,x,1.6,z,7,3.2,10,i%2?'#8a6248':'#4f6a68');colliders.push({x,z,w:7,d:10,h:3.2});}
 box(world,57,-.15,0,23,.1,145,'#345c6d');colliders.push({x:60,z:0,w:25,d:145,h:.1});for(const z of [-30,25]){cyl(world,48,9,z,.4,18,'#a49057');box(world,40,17,z,20,.5,.7,'#b2a16a');}
}
// Radio mast silhouette.
for(let i=0;i<4;i++){cyl(world,-18+i*.6,13,-45,.09,13,'#9ca899',5)}box(world,-17,18,-45,4,.1,.1,'#a7b2a2');box(world,-17,16,-45,.1,.1,4,'#a7b2a2');
function tree(x,z,s=1){colliders.push({x,z,w:.36*s,d:.36*s,h:3.2*s});const g=new THREE.Group();g.position.set(x,0,z);world.add(g);cyl(g,0,1.6*s,0,.18*s,3.2*s,'#6c6650');for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.ConeGeometry((2-i*.4)*s,3*s,7),mat(i===1?'#506650':'#3b574b'));m.position.y=(3+i*1.2)*s;m.castShadow=true;g.add(m)}}
for(let i=0;i<(stageId==='port'?20:stageId==='forest'?145:100);i++){let x=(rnd()-.5)*135,z=(rnd()-.5)*148;if(Math.abs(x)>(stageId==='forest'?28:52)||z>43||z< -58){if(Math.abs(x)>9)tree(x,z,.65+rnd()*.7)}}
for(let i=0;i<70;i++){let x=(rnd()-.5)*110,z=(rnd()-.5)*135;if(Math.abs(x)>8&&Math.abs(z-6)>8){const m=box(world,x,.15,z,.2+rnd()*.7,.25+rnd()*.45,.4+rnd()*.7,'#8b8a72');m.rotation.y=rnd()*6}}
function car(x,z,rot=0,color='#6e7868'){const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rot;world.add(g);box(g,0,.7,0,1.9,.6,3.8,color);box(g,0,1.22,-.2,1.65,.7,1.8,'#35494a');box(g,0,1.65,-.2,1.8,.1,2,color);[-.97,.97].forEach(xx=>[-1.15,1.15].forEach(zz=>{const m=cyl(g,xx,.42,zz,.4,.18,'#222c2b',10);m.rotation.z=Math.PI/2}));[-.6,.6].forEach(xx=>box(g,xx,.77,1.91,.4,.22,.03,'#d4bf87'));colliders.push({x,z,w:rot?4:2,d:rot?2:4,h:1.8})}
car(4,25,.12);car(-4,-19,-.1,'#9b8a68');car(26,8,Math.PI/2,'#78766a');car(-29,3,-Math.PI/2);car(4,-46,0,'#717e82');
for(let z=-55;z<60;z+=23){for(const s of [-1,1]){cyl(world,s*7.6,3.4,z,.09,6.8,'#333e37');box(world,s*6.8,6.8,z,1.7,.12,.15,'#333e37');const bulb=box(world,s*6,6.72,z,.55,.08,.4,'#efd192');bulb.material=new THREE.MeshStandardMaterial({color:'#ffdc94',emissive:'#ffc45c',emissiveIntensity:2});if(z===14||z===-9){const light=new THREE.PointLight('#ffc478',12,13,2);light.position.set(s*6,6,z);world.add(light)}}}
for(let x=-5;x<7;x+=2){box(world,x,.5,-66,1.7,1,.55,'#a89c70');box(world,x,.6,-65.7,.7,.24,.02,'#353f32')}
label(world,'EVACUATION',0,4,-69,8);cyl(world,-4,2,-69,.1,4,'#80917c');cyl(world,4,2,-69,.1,4,'#80917c');
const evac=new THREE.Mesh(new THREE.RingGeometry(2.4,2.6,48),new THREE.MeshBasicMaterial({color:'#d3c388',side:THREE.DoubleSide}));evac.rotation.x=-Math.PI/2;evac.position.set(0,.1,-61);world.add(evac);interactions.push({id:'evac',type:'evac',x:0,z:-61,name:'北ゲート / 脱出'});
function person(zombie=false){const g=new THREE.Group(),skin=zombie?'#81917a':'#bd9876',uniform=zombie?'#656951':'#58664e';box(g,0,1.25,0,.65,.75,.4,uniform);box(g,0,1.36,.22,.54,.5,.1,zombie?'#6c5544':'#303e34');cyl(g,0,1.78,0,.12,.16,skin);box(g,0,2.02,0,.4,.43,.36,skin);box(g,0,2.22,-.06,.43,.14,.35,'#30382e');box(g,0,2.1,.19,.3,.06,.02,zombie?'#5a392e':'#333b32');const limbs=[];for(const s of [-1,1]){let l=new THREE.Group();l.position.set(s*.2,.92,0);g.add(l);box(l,0,-.35,0,.26,.72,.3,uniform);box(l,0,-.75,.09,.28,.2,.46,'#242f2b');limbs.push(l);let a=new THREE.Group();a.position.set(s*.46,1.57,0);g.add(a);box(a,0,-.2,0,.22,.4,.3,uniform);box(a,0,-.5,0,.18,.25,.23,skin);if(zombie)a.rotation.x=-1.15;limbs.push(a)}if(!zombie){box(g,0,1.3,-.35,.52,.65,.35,'#8a805b');box(g,.5,1.4,.08,.13,.1,.25,'#aa9460')}g.userData.limbs=limbs;return g}
const player=person();scene.add(player);const rifle=new THREE.Group();player.add(rifle);box(rifle,.39,1.27,.43,.13,.15,.82,'#2b3530');box(rifle,.39,1.27,.98,.055,.06,.42,'#738075');box(rifle,.39,1.16,.32,.1,.24,.12,'#40483a');rifle.visible=state.weapon==='rifle';const flash=new THREE.PointLight('#ffd281',0,6);flash.position.set(.39,1.3,1.25);player.add(flash);let flashUntil=0,attackUntil=0;player.position.set(state.x,0,state.z);
const blade=new THREE.Group();player.add(blade);box(blade,.5,1.03,.18,.08,.2,.1,'#393e32');box(blade,.5,1.03,.47,.055,.16,.46,'#b6c0ac');blade.visible=state.weapon==='knife';
function animatePerson(g,t,speed){g.userData.limbs.forEach((l,i)=>{l.rotation.x=Math.sin(t*9+(i===0||i===3?0:Math.PI))*.55*speed});g.position.y=Math.abs(Math.sin(t*9))*.045*speed}
const spots=[[0,-8],[3,-36],[-8,6],[15,8],[-23,10],[1,39],[-9,-29],[33,7],[-31,-28],[4,-56]];
if(stageId!=='city')spots.push([24,-28],[-25,35],[0,-48]);
spots.forEach(([x,z],i)=>{if(state.killed.includes(i))return;let g=person(true);g.position.set(x,0,z);g.rotation.z=.06;world.add(g);const entity={g,x,z,id:i,type:'zombie',hp:clamp(state.enemies[i]?.hp||52,1,52),phase:rnd()*6,hitAt:0,stun:0};g.userData.entity=entity;zombies.push(entity)});
function makeBike(){const g=new THREE.Group();world.add(g);for(const z of [-.8,.8]){const m=cyl(g,0,.5,z,.47,.19,'#26332e',12);m.rotation.z=Math.PI/2;const hub=cyl(g,0,.5,z,.24,.21,'#8a9686');hub.rotation.z=Math.PI/2}box(g,0,.85,0,.36,.3,1.4,'#b09562');box(g,0,1.12,-.2,.45,.16,.7,'#2b362b');box(g,0,1.45,.65,.85,.08,.08,'#9aab9d');box(g,0,1.22,.8,.3,.28,.2,'#d0c69d');g.position.set(9,0,9);return g}
const bike=makeBike();interactions.push({id:'bike',type:'bike',x:9,z:9,name:'放置バイク / 乗る'});
for(const [id,[x,z]] of [[-15,49],[17,54],[-23,60]].entries()){if(state.harvested.includes(id))continue;const g=new THREE.Group();world.add(g);g.position.set(x,0,z);box(g,0,1,0,.65,.6,1.25,'#9a8260');box(g,0,1.7,.65,.32,.65,.32,'#aa936a');box(g,0,2,.85,.3,.3,.5,'#b09b77');for(const xx of [-.23,.23])for(const zz of [-.45,.45])box(g,xx,.42,zz,.09,.85,.1,'#6f644c');for(const xx of [-.2,.2]){box(g,xx,2.4,.65,.07,.6,.07,'#b9af86');box(g,xx*2,2.57,.65,.35,.06,.08,'#b9af86')}const saved=state.wildlife[id];if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.z))g.position.set(clamp(saved.x,-55,55),0,clamp(saved.z,44,69));const entity={g,x,z,id,type:'deer',hp:clamp(saved?.hp??44,0,44),phase:rnd()*6};g.userData.entity=entity;if(entity.hp===0){g.rotation.z=Math.PI/2;g.position.y=.35}deer.push(entity)}
// Indoor room is a separate 3D area; open roof keeps the view readable.
box(interiors,0,-.15,0,13,.3,13,'#727564');box(interiors,0,1.6,-6.5,13,3.2,.3,'#788070');box(interiors,-6.5,1.6,0,.3,3.2,13,'#697765');box(interiors,6.5,.6,0,.3,1.2,13,'#697765');
for(let i=-4;i<=4;i+=4){box(interiors,i,.9,-5,2.7,1.8,.65,'#485a4b');for(let j=0;j<3;j++){box(interiors,i,.35+j*.6,-4.6,2.7,.07,1,'#8b8c73');for(let k=0;k<3;k++)box(interiors,i-.8+k*.7,.57+j*.6,-4.5,.35,.35,.5,k===1?'#b4a16c':'#7c8e6b')}}
box(interiors,-4,.6,0,2.4,1.2,1.3,'#6d7762');box(interiors,-4,1.23,0,2.7,.12,1.5,'#b1aa88');const indoorProps={clinic:new THREE.Group(),garage:new THREE.Group(),radio:new THREE.Group()};Object.values(indoorProps).forEach(g=>interiors.add(g));box(indoorProps.clinic,4,.3,1,2,.6,3.5,'#657561');box(indoorProps.clinic,4,.67,1,2,.15,3.4,'#b3b2a0');box(indoorProps.clinic,-4,1.8,0,.8,1,.1,'#d9d2ba');box(indoorProps.clinic,-4,1.8,.06,.5,.15,.03,'#a46449');box(indoorProps.clinic,-4,1.8,.07,.15,.5,.03,'#a46449');for(let i=0;i<3;i++){cyl(indoorProps.garage,4,.22+i*.38,1,.7,.36,'#28372f',12)}box(indoorProps.garage,-4,1.65,0,1.3,.7,.6,'#45544a');box(indoorProps.garage,-4,2.02,0,1.5,.1,.8,'#8a9680');box(indoorProps.radio,4,.7,1,2,1.4,2.8,'#47594b');box(indoorProps.radio,4,1.5,1,2.2,.15,3,'#829277');box(indoorProps.radio,4,1.9,1,.8,.65,.5,'#263b31');box(indoorProps.radio,4,1.94,1.26,.65,.36,.02,'#a4b284');cyl(indoorProps.radio,4.6,2.2,1,.02,1.5,'#a5b49e');label(interiors,'EXIT',0,2,6,2.5);const crate=box(interiors,0,.45,-3,1.2,.9,1,'#bca36e');box(interiors,0,.92,-3,1.3,.08,1.1,'#dfc88c');const indoorLight=new THREE.PointLight('#e6cc86',9,16,1);indoorLight.position.set(0,4,0);interiors.add(indoorLight);
const markerGeo=new THREE.OctahedronGeometry(.25);const markers=[];interactions.filter(a=>a.type==='door').forEach(a=>{const m=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({color:'#ecc887'}));m.position.set(a.x,2,a.z);world.add(m);markers.push({m,id:a.id})});
// Light airborne ash makes distance readable without photographic assets.
const positions=new Float32Array(360);for(let i=0;i<120;i++){positions[i*3]=(rnd()-.5)*100;positions[i*3+1]=1+rnd()*12;positions[i*3+2]=(rnd()-.5)*120}const ashGeo=new THREE.BufferGeometry();ashGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));const ash=new THREE.Points(ashGeo,new THREE.PointsMaterial({color:'#c7c4a0',size:.06,transparent:true,opacity:.55}));world.add(ash);
// Construction has real collision, durability and persistent stage-local progress.
const structures=[];
function renderBarrier(record){const g=new THREE.Group();g.position.set(record.x,0,record.z);world.add(g);for(const x of [-1.6,1.6])box(g,x,.8,0,.18,1.6,.3,'#716343');for(const y of [.45,1,1.5])box(g,0,y,0,3.8,.2,.35,'#b19a6e');const collider={x:record.x,z:record.z,w:3.8,d:.5,h:1.7};colliders.push(collider);structures.push({record,g,collider});}
for(const record of state.structures)if(record.hp>0)renderBarrier(record);
const bridge=new THREE.Group();world.add(bridge);
if(stageId!=='city'){
 box(world,0,.8,-29,15,1.6,3,'#5f685c');colliders.push({x:0,z:-29,w:15,d:3,h:1.6});
 interactions.push({id:'crossing',type:'crossing',x:0,z:-24,name:'封鎖前 / 足場を建築'});
 interactions.push({id:'crossing-back',type:'crossing',x:0,z:-34,name:'足場で戻る'});
 for(let z=-33;z<=-25;z+=1)box(bridge,0,1.85,z,3,.2,.85,'#b49d73');for(const x of [-1.7,1.7]){box(bridge,x,2.35,-29,.1,.1,9,'#b49d73');box(bridge,x,1,-29,.15,2,.15,'#7d7256');}
 bridge.visible=!!state.bridgeBuilt;
}
// Real-time field controls: terrain clicks move, actor clicks target and attack.
let destination=null,waypoints=[],selected=null,runToggle=false,readyAt=0,damageReady=0,simTime=0,lastNoise=-100,noticeAt=0;
let stamina={value:state.stamina,exhausted:!!state.exhausted,delay:0,sprinting:false};
let releaseRun=()=>{};
const stick={x:0,y:0,id:null};
const isTouch=()=>matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
const keys=new Set(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const targetRing=new THREE.Mesh(new THREE.RingGeometry(.35,.46,24),new THREE.MeshBasicMaterial({color:'#efd092',side:THREE.DoubleSide}));targetRing.rotation.x=-Math.PI/2;targetRing.visible=false;scene.add(targetRing);
const aimRing=new THREE.Mesh(new THREE.RingGeometry(.7,.78,32),new THREE.MeshBasicMaterial({color:'#e3ac6a',side:THREE.DoubleSide,depthTest:false}));aimRing.rotation.x=-Math.PI/2;aimRing.renderOrder=3;aimRing.visible=false;scene.add(aimRing);
const tracers=[];
let canvasPointer=null;
let scoped=false,scopeYaw=0,scopePitch=0,scopeZoom=2,recoil=0,scopeDrag=null,scopeHitUntil=0;
const tracerMaterial=new THREE.LineBasicMaterial({color:'#ffe7a4',transparent:true,opacity:.9});
function activeTargets(){return inside?[]:[...zombies,...deer].filter(e=>e.hp>0&&e.g.visible)}
function distanceTo(e){return Math.hypot(e.g.position.x-player.position.x,e.g.position.z-player.position.z)}
function sightBlocked(e){return lineBlocked(player.position,e.g.position,colliders)}
function targetName(e){return e.type==='deer'?'鹿':'感染者'}
function setDestination(p,remaining=[]){waypoints=remaining;destination=p;targetRing.position.set(p.x,.12,p.z);targetRing.visible=true;}
function clearDestination(){waypoints=[];destination=null;targetRing.visible=false;}
renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','探索フィールド。WASDで移動、Shiftで走る、Fで攻撃。');
function positionScopeCamera(){
  const pitch=clamp(scopePitch+recoil,-.95,.95);
  camera.position.set(player.position.x,1.65,player.position.z);
  camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(scopeYaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(scopeYaw)*Math.cos(pitch))));
  camera.updateMatrixWorld(true);
}
function exitScope(){
  if(!scoped)return;scoped=false;scopeDrag=null;recoil=0;keys.clear();resetStick();releaseRun();player.visible=true;
  document.body.classList.remove('scoped');$('#scopeOverlay').hidden=true;camera.fov=43;camera.updateProjectionMatrix();
  updateEquipment();
}
function toggleScope(){
  if(scoped){exitScope();return;}
  if(mode!=='play'||state.weapon!=='rifle'||!canEquip('rifle',skills.levels))return;
  if(onBike||inside){notice(onBike?'バイクから降りてスコープを覗いてください。':'屋外でスコープを使用してください。');return;}
  scoped=true;clearDestination();selected=null;aimRing.visible=false;keys.clear();resetStick();releaseRun();runToggle=false;stamina.sprinting=false;
  scopeYaw=player.rotation.y;scopePitch=0;recoil=0;player.visible=false;
  document.body.classList.add('scoped');$('#scopeOverlay').hidden=false;setScopeZoom();positionScopeCamera();updateEquipment();
  $('#scopeFeedback').textContent='ドラッグで照準を合わせてください';
}
function setScopeZoom(){camera.fov=scopeZoom===2?22:11;camera.updateProjectionMatrix();$('#scopeZoom').textContent=scopeZoom+'× / Z';}
$('#scopeBack').onclick=exitScope;$('#scopeFire').onclick=()=>attack();
$('#scopeZoom').onclick=()=>{if(scoped){scopeZoom=scopeZoom===2?4:2;setScopeZoom();}};
renderer.domElement.addEventListener('pointerdown',e=>{
  if(mode!=='play'||e.button!==0)return;
  if(!scoped){canvasPointer=e.pointerId;return;}
  if(scopeDrag)return;
  scopeDrag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0};renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
  if(!scoped||!scopeDrag||scopeDrag.id!==e.pointerId)return;
  const dx=e.clientX-scopeDrag.x,dy=e.clientY-scopeDrag.y;
  scopeDrag.moved+=Math.abs(dx)+Math.abs(dy);scopeDrag.x=e.clientX;scopeDrag.y=e.clientY;
  const aim=dragAim(scopeYaw,scopePitch,dx,dy,scopeZoom);scopeYaw=aim.yaw;scopePitch=aim.pitch;
  player.rotation.y=scopeYaw;positionScopeCamera();
});
renderer.domElement.addEventListener('pointercancel',()=>{scopeDrag=null;canvasPointer=null;});
renderer.domElement.addEventListener('pointerup',e=>{
  if(mode!=='play'||e.button!==0)return;
  if(scoped){if(scopeDrag?.id!==e.pointerId)return;const clicked=scopeDrag.moved<5&&e.pointerType==='mouse';scopeDrag=null;if(clicked)attack();return;}
  if(canvasPointer!==e.pointerId)return;canvasPointer=null;
  if(e.pointerType==='touch')return;
  pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(pointer,camera);
  const hitActor=raycaster.intersectObjects(activeTargets().map(e=>e.g),true)[0];
  if(hitActor&&state.weapon==='rifle'){toggleScope();return;}
  if(hitActor){let object=hitActor.object;while(object&&!object.userData.entity)object=object.parent;selected=object?.userData.entity||null;clearDestination();attack();return;}
  const point=new THREE.Vector3();if(raycaster.ray.intersectPlane(groundPlane,point)){
    if(inside){point.x=clamp(point.x,-5.7,5.7);point.z=clamp(point.z,-5.7,5.7);}
    if(!inside&&blocked(point.x,point.z)){toast('そこには進めません。道路を選んでください。');return;}
    setDestination(point);
  }
});
function cycleTarget(){if(mode!=='play')return;if(state.weapon==='rifle'){toggleScope();return;}const choices=activeTargets().filter(e=>distanceTo(e)<=WEAPONS[state.weapon].range+10&&!sightBlocked(e)).sort((a,b)=>distanceTo(a)-distanceTo(b));selected=choices[(choices.indexOf(selected)+1)%choices.length]||null;if(!selected)toast('近くに見える対象がいません。');}
let audio=null,sound=false,resetting=false;
function tone(freq=200,duration=.08){if(!sound||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.5,audio.currentTime+duration);g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration)}
$('#sound').onclick=()=>{if(!audio)audio=new AudioContext();audio.resume();sound=!sound;$('#sound').textContent=sound?'SOUND ON':'SOUND OFF';tone(450)};
function toast(t){$('#toast').textContent=t;toastTime=3.2;$('#toast').classList.add('show')}
function notice(t){if(t&&simTime>=noticeAt){toast(t);noticeAt=simTime+1.1;}}
function save(){
  if(resetting)return;
  state.stamina=stamina.value;state.maxStamina=fitness.maxStamina;state.maxHP=fitness.maxHP;state.exhausted=stamina.exhausted;
  state.enemies=Object.fromEntries(zombies.map(e=>[e.id,{hp:e.hp}]));
  state.wildlife=Object.fromEntries(deer.map(e=>[e.id,{hp:e.hp,x:e.g.position.x,z:e.g.position.z}]));
  const s={...state,x:inside?inside.x:player.position.x,z:inside?inside.z:player.position.z};
  try{localStorage.setItem(SAVE,JSON.stringify(s))}catch{notice('保存できませんでした。ブラウザの保存設定を確認してください。')}
}
function updateHUD(){
  $('#buildButton').textContent='建築 / 資材 '+state.materials;$('#ammo').textContent=state.ammo+' ROUNDS';$('#med').textContent=state.med+' MEDKIT';$('#ride').textContent=onBike?'RIDING':state.food+' FOOD';
  $('#tasks').innerHTML=[['clinic','医療物資 / '+stage.names[0]],['garage','燃料 / '+stage.names[1]],['radio','無線部品 / '+stage.names[2]]].map(([id,t])=>`<button data-destination="${id}" class="${state.loot.includes(id)?'done':''}">${state.loot.includes(id)?'✓':'□'} ${t} ↗</button>`).join('');
  $('#objective').textContent=state.loot.length===3?'北の避難ゲートへ向かい、脱出せよ。':'病院・ガレージ・通信所から物資を回収';
  $('#skillinfo').textContent=`肉体記録 ${fitness.entered}/6項目反映 · ${fitness.entered?'実測値で補正中':'未入力は基本値'}`;
  $('#carcassButton').hidden=!deer.some(d=>d.hp<=0);markers.forEach(a=>{a.m.visible=!state.loot.includes(a.id)});updateEquipment();updateVitals();
}
function updateVitals(){
  $('#scopeAmmo').textContent=state.ammo+' ROUNDS';$('#scopeVitals').textContent='HP '+Math.ceil(state.hp)+' / '+fitness.maxHP;
  $('#health').textContent=`${Math.ceil(state.hp)} / ${fitness.maxHP}`;$('#hpbar').style.width=state.hp/fitness.maxHP*100+'%';
  $('#staminaValue').textContent=`${Math.floor(stamina.value)} / ${fitness.maxStamina}`;$('#staminaBar').style.width=stamina.value/fitness.maxStamina*100+'%';
  $('#staminaTrack').setAttribute('aria-valuenow',Math.floor(stamina.value));$('#staminaTrack').setAttribute('aria-valuemax',fitness.maxStamina);
  $('#runState').textContent=stamina.exhausted?'息切れ / 25%まで回復待ち':stamina.sprinting?'SPRINTING':runToggle?'SPRINT READY':'STAMINA';
  $('#runButton').textContent=stamina.exhausted?'息切れ':runToggle?'疾走中':'長押しで走る';$('#runButton').setAttribute('aria-pressed',String(runToggle));
}
function equip(weapon){if(mode!=='play'||!canEquip(weapon,skills.levels))return;exitScope();state.weapon=weapon;selected=null;updateEquipment();save();tone(380,.05);}
function updateEquipment(){
  rifle.visible=state.weapon==='rifle';blade.visible=state.weapon==='knife';
  document.querySelectorAll('[data-weapon]').forEach(b=>{const id=b.dataset.weapon;b.disabled=!canEquip(id,skills.levels);b.setAttribute('aria-pressed',String(id===state.weapon));if(id==='rifle')b.querySelector('span').textContent=b.disabled?'狩猟免許で解放':'狩猟免許 取得済';if(id==='knife')b.querySelector('span').textContent=b.disabled?'刃物スキル LV1で解放':'刃物スキル LV'+lv('knife');});
  const w=WEAPONS[state.weapon];$('#equipmentToggle').textContent='装備 / '+w.name+' ▴';$('#equipmentInfo').textContent=`${w.name} / 射程 ${w.range}m${state.weapon==='rifle'?' · 残弾 '+state.ammo:' · スタミナ −'+w.stamina}`;
  $('#attackButton').textContent=state.weapon==='rifle'?(scoped?'射撃 F':'覗く / F'):'打撃 F';$('#targetButton').textContent=state.weapon==='rifle'?(scoped?'覗くのをやめる':'スコープ T'):'照準 T';
  $('#healButton').disabled=state.med<1||state.hp>=fitness.maxHP;
}
function attack(){
  if(mode!=='play')return;
  if(state.weapon==='rifle'&&!scoped){toggleScope();return;}
  const plan=attackPlan({weapon:state.weapon,levels:skills.levels,ammo:state.ammo,stamina:stamina.value,now:simTime,readyAt,onBike,inside});
  if(!plan.ok){notice(plan.reason);return;}
  let shot=null,target=null;
  if(state.weapon==='rifle'){
    positionScopeCamera();
    shot=traceScopeShot(new THREE.Ray(camera.position.clone(),camera.getWorldDirection(new THREE.Vector3())),activeTargets(),colliders,WEAPONS.rifle.range);
    target=shot.entity;
  }else{
    if(!selected||selected.hp<=0)selected=activeTargets().filter(e=>distanceTo(e)<=WEAPONS[state.weapon].range&&!sightBlocked(e)).sort((a,b)=>distanceTo(a)-distanceTo(b))[0]||null;
    if(selected&&distanceTo(selected)>WEAPONS[state.weapon].range){notice('射程外です。対象に近づいてください。');return;}
    if(selected&&sightBlocked(selected)){notice('建物・車両で射線が遮られています。');return;}
    target=selected;
  }
  state.ammo=plan.ammo;stamina.value=plan.stamina;stamina.delay=.9;readyAt=plan.readyAt;attackUntil=time+.24;
  if(state.weapon==='rifle'){
    flash.intensity=12;flashUntil=time+.1;lastNoise=simTime;tone(65,.18);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([camera.position.clone(),shot.point]),tracerMaterial);scene.add(line);tracers.push({line,until:time+.12});
    recoil=.025;$('#scopeOverlay').classList.add('fired');setTimeout(()=>$('#scopeOverlay').classList.remove('fired'),100);
    $('#scopeFeedback').textContent=target?'命中':shot.blocked?'遮蔽物に着弾':'外れ';
  }else{tone(140,.1);if(target)player.rotation.y=Math.atan2(target.g.position.x-player.position.x,target.g.position.z-player.position.z);}
  if(target){const damage=hitDamage({weapon:state.weapon,levels:skills.levels,fitness,distance:shot?shot.distance:distanceTo(target),blocked:false});
    if(damage){target.hp=Math.max(0,target.hp-damage);target.stun=simTime+.25;toast(`${targetName(target)}に ${damage} ダメージ`);
      if(scoped){scopeHitUntil=time+.24;$('#scopeFeedback').textContent=`${targetName(target)} / ${shot.distance.toFixed(1)}m / ${damage} ダメージ`;}
      if(target.type==='zombie'&&state.weapon!=='rifle'){const d=distanceTo(target)||1;moveActor(target.g,(target.g.position.x-player.position.x)/d*.7,(target.g.position.z-player.position.z)/d*.7);}
      if(target.hp<=0){if(target.type==='zombie'){state.killed.push(target.id);target.g.visible=false;zombies.splice(zombies.indexOf(target),1);toast('感染者を排除。');}else{target.g.rotation.z=Math.PI/2;target.g.position.y=.35;toast('鹿を仕留めた。近づいて E で回収。');}selected=null;}
    }
  }else if(!scoped)notice('近くに攻撃対象がいません。');
  updateHUD();save();
}
function heal(){if(mode!=='play'||state.med<1||state.hp>=fitness.maxHP)return;state.med--;state.hp=Math.min(fitness.maxHP,state.hp+32+Math.round(sc('lifeline')*38));tone(600,.2);toast('応急処置で体力を回復。');updateHUD();save()}
function blocked(x,z){return Math.abs(x)>62||Math.abs(z)>72||colliders.some(b=>Math.abs(x-b.x)<b.w/2+.4&&Math.abs(z-b.z)<b.d/2+.4)}
function moveActor(g,dx,dz){let x=g.position.x+dx,z=g.position.z+dz;if(inside){const hit=(xx,zz)=>(xx< -2.4&&xx> -5.6&&Math.abs(zz)<1.1)||(xx>2.5&&xx<5.5&&zz> -1.1&&zz<3.1)||zz< -4;if(!hit(x,g.position.z))g.position.x=clamp(x,-5.7,5.7);if(!hit(g.position.x,z))g.position.z=clamp(z,-5.7,5.7)}else{if(!blocked(x,g.position.z))g.position.x=x;if(!blocked(g.position.x,z))g.position.z=z}}
function finish(won){exitScope();mode='end';clearDestination();keys.clear();resetStick();releaseRun();$('#ending').hidden=false;$('#endLabel').textContent=won?'EXTRACTION COMPLETE':'SIGNAL LOST';$('#endTitle').textContent=won?'生還。':'通信途絶。';$('#endText').textContent=won?`作戦時間 ${Math.floor(state.seconds/60)}分${Math.floor(state.seconds%60)}秒 / 排除 ${state.killed.length}体 / 狩猟 ${state.harvested.length}頭。`:'移動しながら距離を取り、スタミナを残して戦おう。装備室の肉体記録がHPと持久力に反映されます。';state.won=won;save()}
function interact(){
  if(mode!=='play'||!near)return;exitScope();clearDestination();selected=null;tone(450);
  if(near.type==='door'){onBike=false;inside=near;Object.entries(indoorProps).forEach(([id,g])=>g.visible=id===inside.id);world.visible=false;interiors.visible=true;player.position.set(0,0,4);scene.fog.density=.006;crate.visible=!state.loot.includes(near.id);toast(near.name+' / 奥の物資を調べる');}
  else if(near.type==='exit'){world.visible=true;interiors.visible=false;player.position.set(inside.x,0,inside.z+1);inside=null;scene.fog.density=.012;grace=3;}
  else if(near.type==='loot'&&!state.loot.includes(inside.id)){state.loot.push(inside.id);state.materials+=4;if(inside.id==='clinic')state.med+=2;if(inside.id==='garage')state.ammo+=12;crate.visible=false;toast(inside.name+'の物資を回収。'+(state.loot.length===3?'北ゲートへ向かえ。':'残り '+(3-state.loot.length)+'か所。'));}
  else if(near.type==='harvest'){const d=near.entity;if(!state.harvested.includes(d.id)){state.harvested.push(d.id);state.food+=2+Math.floor(sc('food')*3);d.g.visible=false;deer.splice(deer.indexOf(d),1);toast('鹿から食料を回収。糧食スキルで獲得量が増えます。');}}
  else if(near.type==='bike'){onBike=!onBike;toast(onBike?'バイクに乗った。攻撃するには E で降りる。':'バイクから降りた。');}
  else if(near.type==='crossing'){if(state.bridgeBuilt){player.position.set(0,0,near.id==='crossing'?-35:-23);grace=2;toast('建築した足場で封鎖を越えた。');}else{openBuild();return;}}
  else if(near.type==='evac'){if(state.loot.length===3)finish(true);else toast('脱出には医療物資・燃料・無線部品が必要。');}
  near=null;$('#interact').hidden=true;updateHUD();save();
}
function findNear(){const candidates=inside?[{type:'exit',x:0,z:5,name:'建物を出る'},...(!state.loot.includes(inside.id)?[{type:'loot',x:0,z:-3,name:'物資を回収'}]:[])]:[...interactions,...deer.filter(d=>d.hp<=0).map(d=>({type:'harvest',x:d.g.position.x,z:d.g.position.z,name:'鹿から食料を回収',entity:d}))];near=onBike?{type:'bike',name:'バイクを降りる'}:candidates.filter(a=>Math.hypot(player.position.x-a.x,player.position.z-a.z)<2.7).sort((a,b)=>Math.hypot(player.position.x-a.x,player.position.z-a.z)-Math.hypot(player.position.x-b.x,player.position.z-b.z))[0];$('#interact').hidden=!near||mode!=='play';if(near)$('#interact').textContent=(isTouch()?'':'E / ')+(near.type==='crossing'&&state.bridgeBuilt?'足場を渡る':near.name);}
$('#interact').onclick=interact;
$('#tasks').onclick=e=>{const b=e.target.closest('[data-destination]');if(!b||mode!=='play'||inside)return;const d=interactions.find(i=>i.id===b.dataset.destination);setDestination(new THREE.Vector3(d.x,0,d.z));toast(d.name+'へ移動。障害物は道路をクリックして迂回してください。');};
$('#forestButton').onclick=()=>{if(mode==='play'&&!inside){setDestination(new THREE.Vector3(0,0,6),[new THREE.Vector3(0,0,48)]);toast('南の森林へ移動。鹿は緑色のミニマップ表示。');}};
$('#carcassButton').onclick=()=>{if(mode!=='play'||inside)return;const d=deer.filter(e=>e.hp<=0).sort((a,b)=>distanceTo(a)-distanceTo(b))[0];if(d)setDestination(new THREE.Vector3(d.g.position.x,0,d.g.position.z));};
function pause(){if(mode==='play'){exitScope();mode='paused';clearDestination();keys.clear();resetStick();releaseRun();runToggle=false;stamina.sprinting=false;$('#pauseScreen').hidden=false;updateVitals();save();}}
function resume(){$('#buildPanel').hidden=true;mode='play';$('#pauseScreen').hidden=true;keys.clear();resetStick();releaseRun();}
$('#pause').onclick=pause;$('#resume').onclick=resume;
function restart(){resetting=true;state=fresh();try{localStorage.setItem(SAVE,JSON.stringify(state))}catch{}location.reload();}
$('#restart').onclick=()=>{if(confirm('この試作ゲームの作戦進行をリセットしますか？スキルの記録は残ります。'))restart();};$('#again').onclick=restart;
$('#startButton').textContent=stored&&state.seconds>0?'前回の作戦を続ける ↗':'作戦を開始する ↗';$('#startButton').onclick=()=>{requestLandscape();mode='play';grace=8;$('#start').hidden=true;document.body.classList.remove('briefing');toast(isTouch()?'左スティックで移動。走る・攻撃は右側。スコープ内をドラッグして照準。':'ライフルは T でスコープ。ドラッグで照準を合わせ、クリック / F で射撃。');updateHUD();};
function openBuild(){if(mode!=='play')return;pause();$('#pauseScreen').hidden=true;$('#buildPanel').hidden=false;renderBuildMenu();}
function renderBuildMenu(){
 $('#crossingRoute').hidden=stageId==='city';$('#crossingRoute').disabled=!!inside||onBike;
 $('#buildStock').textContent=`${stage.name} / 資材 ${state.materials} / 建築士 ${lv('architect')>=2?'取得済':'未取得'} / 大工 LV${lv('carpentry')}`;
 for(const type of ['barrier','bridge']){const plan=buildPlan(type,skills.levels,state.materials),button=$('[data-build="'+type+'"]');const place=type==='barrier'?!inside&&!onBike:stageId!=='city'&&!inside&&!onBike&&!state.bridgeBuilt&&Math.abs(player.position.x)<3&&Math.abs(player.position.z+24)<3;button.disabled=!plan.allowed||!place;button.querySelector('small').textContent=`資材 ${plan.cost} / ${type==='barrier'?'耐久 '+plan.hp:'北側の封鎖を越える'} / ${!place?(type==='bridge'?'封鎖の南側で建築（建築済の場合は利用可）':'屋外でバイクから降りてください'):plan.reason}`;}
}
$('#buildButton').onclick=openBuild;bindPress($('#buildButton'),openBuild);
$('#crossingRoute').onclick=()=>{if(stageId==='city'||inside||onBike)return;$('#buildPanel').hidden=true;resume();setDestination(new THREE.Vector3(0,0,player.position.z),[new THREE.Vector3(0,0,-24)]);toast('封鎖の南側へ。障害物がある場合はスティックで迂回してください。');};
$('#closeBuild').onclick=()=>{$('#buildPanel').hidden=true;resume();};
for(const button of document.querySelectorAll('[data-build]'))button.onclick=()=>{
 if(mode!=='paused'||$('#buildPanel').hidden)return;
 const type=button.dataset.build,plan=buildPlan(type,skills.levels,state.materials);if(!plan.allowed){renderBuildMenu();return;}
 if(inside||onBike)return;
 if(type==='barrier'){
 const x=player.position.x+Math.sin(player.rotation.y)*3.5,z=player.position.z+Math.cos(player.rotation.y)*3.5;
 if(!canPlaceBarrier(x,z,colliders,state.structures)||interactions.some(i=>Math.hypot(i.x-x,i.z-z)<4)||zombies.some(e=>Math.hypot(e.g.position.x-x,e.g.position.z-z)<3)){ $('#buildStock').textContent='ここには置けません。建物・入口・敵から離れてください。';return;}
 if(state.structures.filter(b=>b.hp>0).length>=10){$('#buildStock').textContent='設置上限は10基です。';return;}
 const record={x,z,hp:plan.hp};state.structures.push(record);renderBarrier(record);
 }else{if(stageId==='city'||state.bridgeBuilt||Math.abs(player.position.x)>3||Math.abs(player.position.z+24)>3)return;state.bridgeBuilt=true;bridge.visible=true;}
 state.materials-=plan.cost;$('#buildPanel').hidden=true;resume();updateHUD();save();toast(type==='barrier'?'バリケードを設置。感染者を足止めします。':'足場を建築。封鎖前の操作ボタンで渡れます。');
};
for(const [id,info] of Object.entries(STAGES)){const a=document.createElement('a');a.href='game.html?stage='+id;a.textContent=info.name;a.className=id===stageId?'selected':'';a.setAttribute('aria-label',info.name+'：'+info.subtitle);$('#stageSelect').append(a);}
$('#stageDescription').textContent=stage.name+' — '+stage.subtitle+' / 各ステージで進行を保存';
function closeEquipment(){ $('#equipmentDrawer').hidden=true;$('#equipmentToggle').setAttribute('aria-expanded','false');}
$('#equipmentToggle').onclick=()=>{const open=$('#equipmentDrawer').hidden;$('#equipmentDrawer').hidden=!open;$('#equipmentToggle').setAttribute('aria-expanded',String(open));};
for(const button of document.querySelectorAll('[data-weapon]'))button.onclick=()=>{equip(button.dataset.weapon);closeEquipment();};
$('#attackButton').onclick=attack;$('#targetButton').onclick=cycleTarget;$('#healButton').onclick=heal;
releaseRun=bindHold($('#runButton'),held=>{runToggle=held&&mode==='play'&&!scoped;updateVitals();});
function updateFitnessPanel(){
 const body=skills.body||{},entries=[['run5k','5km走','分'],['bench','ベンチプレス','kg'],['squat','スクワット','kg'],['dead','デッドリフト','kg'],['pullup','懸垂','回'],['grip','握力','kg'],['bf','体脂肪率','%']];
 $('#bodyRecords').replaceChildren(...entries.map(([id,label,unit])=>{const row=document.createElement('div');const name=document.createElement('span'),value=document.createElement('b');name.textContent=label;value.textContent=Number.isFinite(Number(body[id]))&&Number(body[id])>0?Number(body[id])+' '+unit:'未入力';row.append(name,value);return row;}));
 $('#bodyEffects').textContent=`最大HP ${fitness.maxHP} / 最大スタミナ ${fitness.maxStamina}\n回復 ${fitness.recovery.toFixed(1)}/秒 / 走る速さ ${fitness.runSpeed.toFixed(1)}m/秒\n打撃補正 +${fitness.meleeBonus} / 全力疾走 約${(fitness.maxStamina/18).toFixed(1)}秒`;
}
$('#fitnessButton').onclick=()=>{if(mode!=='play')return;pause();$('#pauseScreen').hidden=true;$('#fitnessPanel').hidden=false;updateFitnessPanel();};
$('#closeFitness').onclick=()=>{$('#fitnessPanel').hidden=true;resume();};
window.addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();if(e.target.matches('input,textarea,select'))return;
 if(e.repeat&&['f',' ','1','2','3','t','z'].includes(k))return;
 if(['arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
 if(k==='escape'){if(!$('#buildPanel').hidden){$('#buildPanel').hidden=true;resume();return;}if(scoped){exitScope();return;}if(!$('#fitnessPanel').hidden){$('#fitnessPanel').hidden=true;resume();}else mode==='paused'?resume():pause();return;}
 if(mode!=='play')return;
 if(scoped&&k==='z'&&!e.repeat){scopeZoom=scopeZoom===2?4:2;setScopeZoom();return;}
 if(['1','2','3'].includes(k)){equip(Object.keys(WEAPONS)[Number(k)-1]);return;}
 if(k==='e'&&!e.repeat)interact();else if(k==='h'&&!e.repeat)heal();else if(k==='t'&&!e.repeat)cycleTarget();
 else if(k===' '&&e.target.closest('button,a'))return;
 else{if(k===' ')e.preventDefault();keys.add(k);}
});
window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();resetStick();releaseRun();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',save);
function resetStick(){stick.x=0;stick.y=0;stick.id=null;$('#stickKnob').style.transform='translate(-50%,-50%)';$('#joystick').classList.remove('active');}
function moveStick(e){
 const r=$('#joystick').getBoundingClientRect(),radius=r.width*.32;
 let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;
 const length=Math.hypot(x,y);if(length>1){x/=length;y/=length;}
 const strength=Math.max(0,(Math.min(length,1)-.12)/.88);
 stick.x=length>.12?x/Math.hypot(x,y)*strength:0;stick.y=length>.12?y/Math.hypot(x,y)*strength:0;
 $('#stickKnob').style.transform=`translate(calc(-50% + ${x*radius}px),calc(-50% + ${y*radius}px))`;
}
$('#joystick').onpointerdown=e=>{if(mode!=='play'||scoped||stick.id!==null)return;e.preventDefault();stick.id=e.pointerId;clearDestination();$('#joystick').setPointerCapture(e.pointerId);$('#joystick').classList.add('active');moveStick(e);};
$('#joystick').onpointermove=e=>{if(e.pointerId===stick.id){e.preventDefault();moveStick(e);}};
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#joystick').addEventListener(event,e=>{if(e.pointerId===stick.id)resetStick();});
async function requestLandscape(){
 if(!isTouch())return;
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();}catch{}
 try{await screen.orientation?.lock?.('landscape');}catch{}
}
function checkOrientation(){
 const portrait=isTouch()&&innerHeight>innerWidth;
 $('#rotatePrompt').hidden=!portrait;
 if(portrait&&mode==='play')pause();
}
$('#landscapeButton').onclick=requestLandscape;
window.addEventListener('resize',checkOrientation);document.addEventListener('fullscreenchange',checkOrientation);checkOrientation();
$('#touchRotate').onclick=()=>targetAngle+=Math.PI/2;
// Pointerdown is delivered for every finger, unlike compatibility click events.
for(const button of document.querySelectorAll('#attackButton,#targetButton,#healButton,#interact,#touchRotate,#equipmentToggle,#scopeFire,#scopeZoom,#scopeBack')){const action=button.onclick;bindPress(button,action);}
for(const button of document.querySelectorAll('[data-weapon]')){const action=button.onclick;bindChoice(button,action);}
function refreshProfile(){
  const hpFraction=state.hp/fitness.maxHP,staminaFraction=stamina.value/fitness.maxStamina;
  skills=read(SNAP,skills);skills.body=read('the-day-body-v1',skills.body||{});skills.levels={...skills.levels,...read('the-day-skills-v2',{})};fitness=deriveFitness(skills.body);
  state.hp=clamp(hpFraction*fitness.maxHP,0,fitness.maxHP);stamina.value=clamp(staminaFraction*fitness.maxStamina,0,fitness.maxStamina);
  if(!canEquip(state.weapon,skills.levels)){exitScope();state.weapon='fists';}updateHUD();updateFitnessPanel();save();toast('装備室の肉体記録・スキルを反映しました。');
}
window.addEventListener('storage',e=>{if([SNAP,'the-day-body-v1','the-day-skills-v2'].includes(e.key))refreshProfile();});
const mini=$('#minimap').getContext('2d');
function drawMap(){mini.clearRect(0,0,200,200);mini.fillStyle='#172d28';mini.fillRect(0,0,200,200);const px=x=>100+x*1.3,pz=z=>100+z*1.3;mini.fillStyle='#4c6253';mini.fillRect(92,3,16,194);mini.fillRect(10,pz(0),180,14);mini.fillRect(30,pz(-34),140,12);mini.fillStyle='#738071';for(const b of buildings)mini.fillRect(px(b.x-b.w/2),pz(b.z-b.d/2),b.w*1.3,b.d*1.3);for(const i of interactions.filter(a=>a.type==='door'||a.type==='evac')){mini.fillStyle=state.loot.includes(i.id)?'#748271':'#e8bb6e';mini.fillRect(px(i.x)-2,pz(i.z)-2,4,4);}mini.fillStyle='#c67657';zombies.forEach(z=>mini.fillRect(px(z.g.position.x)-1.5,pz(z.g.position.z)-1.5,3,3));mini.fillStyle='#add1a0';deer.forEach(d=>mini.fillRect(px(d.g.position.x)-2,pz(d.g.position.z)-2,4,4));mini.fillStyle='#fff2cb';mini.beginPath();mini.arc(px(inside?inside.x:player.position.x),pz(inside?inside.z:player.position.z),3,0,7);mini.fill();}
function updateTarget(){
  if(state.weapon==='rifle'){aimRing.visible=false;selected=null;$('#targetInfo').textContent='Tでスコープ / 手動照準 / クリック・Fで射撃';return;}
  if(selected&&selected.hp<=0)selected=null;
  aimRing.visible=!!selected&&!inside;
  if(selected){aimRing.position.set(selected.g.position.x,.15,selected.g.position.z);const distance=distanceTo(selected),occluded=sightBlocked(selected);aimRing.material.color.set(occluded||distance>WEAPONS[state.weapon].range?'#ac7965':'#eccb7c');$('#targetInfo').textContent=`${targetName(selected)} / ${distance.toFixed(1)}m / HP ${selected.hp}${occluded?' · 遮蔽物あり':distance>WEAPONS[state.weapon].range?' · 射程外':''}`;}
  else $('#targetInfo').textContent='対象クリックで攻撃 / Tで照準切替';
}
for(const b of buildings)b.g.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.transparent=true;}});
let occlusionTick=0,hudTick=0;
const cameraAim=new THREE.Vector3(),cameraGoal=new THREE.Vector3();let previous=performance.now();
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-previous)/1000,.045);previous=now;time+=dt;
 if(time>flashUntil)flash.intensity=0;
 for(let i=tracers.length-1;i>=0;i--)if(time>tracers[i].until){scene.remove(tracers[i].line);tracers[i].line.geometry.dispose();tracers.splice(i,1);}
 player.rotation.x=mode==='play'&&time<attackUntil?Math.sin((attackUntil-time)*14)*.15:0;
 if(mode==='play'){
  simTime+=dt;state.seconds+=dt;grace=Math.max(0,grace-dt);
  let ix=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),iz=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0),dx=0,dz=0;
  if(!scoped&&(stick.x||stick.y)){ix=stick.x;iz=stick.y;}
  if(scoped){const turn=.48*(2/scopeZoom);scopeYaw+=((keys.has('arrowleft')?1:0)-(keys.has('arrowright')?1:0))*dt*turn;scopePitch=clamp(scopePitch+((keys.has('arrowup')?1:0)-(keys.has('arrowdown')?1:0))*dt*turn,-.9,.9);player.rotation.y=scopeYaw;ix=0;iz=0;}
  if(!scoped&&keys.has('q'))targetAngle+=dt*1.2;if(!scoped&&keys.has('r'))targetAngle-=dt*1.2;
  if(ix||iz){clearDestination();const l=Math.hypot(ix,iz),a=angle+.62,m=Math.min(1,l);dx=(ix/l*Math.cos(a)+iz/l*Math.sin(a))*m;dz=(-ix/l*Math.sin(a)+iz/l*Math.cos(a))*m;}
  else if(destination){const x=destination.x-player.position.x,z=destination.z-player.position.z,l=Math.hypot(x,z);if(l<.35){if(waypoints.length){const next=waypoints.shift();setDestination(next,waypoints);}else clearDestination();}else{dx=x/l;dz=z/l;}}
  const wantsRun=runToggle||keys.has('shift'),canRun=wantsRun&&!onBike&&!stamina.exhausted&&stamina.value>0;
  const speed=onBike?9+sc('mobility')*4:canRun?fitness.runSpeed:fitness.walkSpeed;
  const before=player.position.clone();if(dx||dz){moveActor(player,dx*speed*dt,dz*speed*dt);player.rotation.y=Math.atan2(dx,dz);}
  const moved=Math.hypot(player.position.x-before.x,player.position.z-before.z)>.001;
  if(!moved&&destination&&(dx||dz))clearDestination();
  stamina=staminaStep(stamina,fitness,{dt,moving:moved,wantsRun,onBike});
  animatePerson(player,time*(stamina.sprinting?1.5:1),onBike?0:moved?1:0);
  if(onBike){bike.position.copy(player.position);bike.rotation.y=player.rotation.y;player.position.y=.6;const bi=interactions.find(i=>i.id==='bike');bi.x=bike.position.x;bi.z=bike.position.z;}
  // A single trigger press fires once; holding the key never fires on scope entry.
  if(keys.has('f')||keys.has(' ')){keys.delete('f');keys.delete(' ');attack();}
  if(!inside){
   for(const z of zombies){
    let dx=player.position.x-z.g.position.x,dz=player.position.z-z.g.position.z,dist=Math.hypot(dx,dz);
    const barrier=structures.find(b=>b.record.hp>0&&Math.abs(z.g.position.x-b.record.x)<3&&Math.abs(z.g.position.z-b.record.z)<1.8);
    if(barrier&&dist<15&&grace<=0){if(simTime>z.hitAt){z.hitAt=simTime+1;barrier.record.hp=Math.max(0,barrier.record.hp-14);if(!barrier.record.hp){barrier.g.visible=false;colliders.splice(colliders.indexOf(barrier.collider),1);toast('バリケードが破壊された。');save();}}continue;}
    const audible=simTime-lastNoise<6&&dist<32;
    if((dist<13||audible)&&dist>1.2&&grace<=0&&simTime>(z.stun||0)){
      moveActor(z.g,dx/dist*dt*1.45,dz/dist*dt*1.45);z.g.rotation.y=Math.atan2(dx,dz);animatePerson(z.g,time+z.phase,.6);
    }else z.g.rotation.z=Math.sin(time+z.phase)*.04;
    if(dist<1.7&&grace<=0&&simTime>z.hitAt&&simTime>damageReady&&simTime>(z.stun||0)&&!lineBlocked(z.g.position,player.position,colliders)){
      z.hitAt=simTime+1.4;damageReady=simTime+.65;state.hp=Math.max(0,state.hp-10);tone(90,.12);notice('感染者の打撃 / HP −10');$('#damageFlash').classList.add('hit');setTimeout(()=>$('#damageFlash').classList.remove('hit'),170);updateHUD();if(state.hp<=0){finish(false);break;}
    }
   }
   for(const d of deer){if(d.hp<=0)continue;const dist=distanceTo(d);if(dist<9||(simTime-lastNoise<4&&dist<32)){const dx=d.g.position.x-player.position.x,dz=d.g.position.z-player.position.z;d.g.position.x=clamp(d.g.position.x+dx/Math.max(dist,1)*dt*4,-55,55);d.g.position.z=clamp(d.g.position.z+dz/Math.max(dist,1)*dt*4,44,69);d.g.rotation.y=Math.atan2(dx,dz);d.g.position.y=Math.abs(Math.sin(time*11))*.2;}else d.g.position.y=0;}
  }
  findNear();saveTime+=dt;if(saveTime>4){save();saveTime=0;}
  $('#district').textContent=inside?inside.name:stageId!=='city'?stage.name:player.position.z>40?'FOREST EDGE':player.position.z< -34?'NORTH DISTRICT':'OLD TOWN';
  $('#coords').textContent=`${inside?'INTERIOR':`X ${Math.round(player.position.x)} / Z ${Math.round(player.position.z)}`} · 17:${String(42+Math.floor(state.seconds/60)%18).padStart(2,'0')}`;
 }
 angle=THREE.MathUtils.damp(angle,targetAngle,7,dt);const p=player.position,distance=inside?15:innerWidth<760?23:25;
 recoil=THREE.MathUtils.damp(recoil,0,8,dt);
 if(scoped){positionScopeCamera();}else{cameraGoal.set(p.x+Math.sin(angle+.62)*distance,p.y+(inside?16:24),p.z+Math.cos(angle+.62)*distance);cameraAim.set(p.x,0,p.z-1);camera.position.lerp(cameraGoal,1-Math.exp(-dt*4));camera.lookAt(cameraAim);}
 $('#scopeOverlay').classList.toggle('hit-confirm',time<scopeHitUntil);
 markers.forEach(m=>{m.m.rotation.y=time;m.m.position.y=2.2+Math.sin(time*2)*.15;});evac.material.color.set(state.loot.length===3?'#f2d68e':'#8e9871');
 if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('#toast').classList.remove('show');}
 occlusionTick+=dt;if(occlusionTick>.15&&!inside){occlusionTick=0;const eye=player.position.clone().add(new THREE.Vector3(0,1.2,0)),v=camera.position.clone().sub(eye);raycaster.set(eye,v.clone().normalize());raycaster.far=v.length();for(const b of buildings){const faded=!scoped&&raycaster.intersectObject(b.g,true).length>0;b.g.traverse(m=>{if(m.isMesh){m.material.opacity=faded?.16:1;m.material.depthWrite=!faded;}});}raycaster.far=Infinity;}
 hudTick+=dt;if(hudTick>.1){hudTick=0;updateVitals();updateTarget();drawMap();}renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();toast('3D描画が中断されました。再読み込みすると保存地点から再開できます。');});
updateHUD();updateFitnessPanel();$('#loading').textContent='READY / 手動スコープ · リアルタイム戦闘 · 肉体連動';requestAnimationFrame(frame);
