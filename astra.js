(()=>{
const hq=document.querySelector('#panel-hq');
hq.insertAdjacentHTML('afterbegin','<div class="astra-heading"><div><p>PERSONNEL / FIELD READINESS</p><h2>生存者の装備室</h2></div><span class="live">● FIELD READY</span></div>');
const hero=document.querySelector('.hero');hero.append(document.querySelector('.zomcon'));
document.querySelector('.hero-side>.label').textContent='01 / OPERATOR · 3D LOADOUT';
document.querySelector('.hero-main>.label').textContent='02 / READINESS · 生存能力';
const box=document.querySelector('.avatar-box');box.insertAdjacentHTML('beforeend','<canvas id="operator3d" aria-label="ドラッグで回転できる3D隊員"></canvas><div class="viewer-tools"><span>↔ DRAG TO ROTATE</span><div><button id="resetView">正面</button> <button id="fullGear">フル装備を見る</button></div></div>');
hq.insertAdjacentHTML('beforeend','<p class="preview-note">THE LAST MAN — 登録したスキルと肉体データが3Dゲームに連動します。生存指数とゲーム能力はゲーム内の評価です。</p>');
const cv=document.querySelector('#operator3d'),ctx=cv.getContext('2d');let angle=-.34,tilt=.03,all=false,drag=null;
const reset=document.querySelector('#resetView');reset.onclick=()=>{angle=-.34;tilt=.03;draw()};document.querySelector('#fullGear').onclick=e=>{all=!all;e.target.classList.toggle('on',all);e.target.textContent=all?'現在の装備へ':'フル装備を見る';draw()};
cv.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(!drag)return;angle+=(e.clientX-drag.x)*.014;tilt=Math.max(-.2,Math.min(.25,tilt+(e.clientY-drag.y)*.003));drag={x:e.clientX,y:e.clientY};draw()};cv.onpointerup=cv.onpointercancel=()=>drag=null;
let faces=[];
function cube(x,y,z,w,h,d,color){const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(a=>[x+a[0]*w/2,y+a[1]*h/2,z+a[2]*d/2]);[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]].forEach(i=>faces.push({v:i.map(j=>v[j]),c:color}));}
function cylinder(x,y,z,r,h,color,n=12){for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n;faces.push({v:[[x+Math.cos(a)*r,y-h/2,z+Math.sin(a)*r],[x+Math.cos(b)*r,y-h/2,z+Math.sin(b)*r],[x+Math.cos(b)*r,y+h/2,z+Math.sin(b)*r],[x+Math.cos(a)*r,y+h/2,z+Math.sin(a)*r]],c:color});}faces.push({v:Array.from({length:n},(_,i)=>[x+Math.cos(i*2*Math.PI/n)*r,y+h/2,z+Math.sin(i*2*Math.PI/n)*r]),c:color});}
function mesh(){faces=[];const sc=Object.fromEntries(spokes().map(s=>[s.key,s.score]));const g=k=>all||sc[k]>=.3;const buff=all||sc.body>=.5;const olive='#65705a',dark='#303a32',skin='#c49673',boot='#272d29';
// Boots, segmented trousers, knee armor
[-.25,.25].forEach(x=>{cube(x,.17,.11,.37,.31,.67,boot);cube(x,.28,-.01,.31,.16,.4,'#454c3b');cube(x,.65,0,.31,.72,.35,olive);cube(x,.79,.22,.29,.28,.14,dark);cube(x,1.15,0,.36,.47,.4,olive);cube(x,1.04,-.22,.24,.26,.09,'#4c5948')});
cube(0,1.46,0,.83,.2,.49,boot);cube(0,1.48,.27,.13,.1,.07,'#baaa78');cube(0,1.98,0,.86,1.04,.46,olive);cube(0,2.03,.27,.74,.76,.13,dark);cube(0,2.13,.355,.57,.15,.045,'#74806c');
[-1,1].forEach(s=>{cube(s*.56,2.3,0,buff?.37:.31,.43,.42,olive);cube(s*.61,1.96,.025,.27,.38,.33,olive);cube(s*.63,1.67,.06,.24,.31,.3,skin);cube(s*.63,1.48,.08,.25,.17,.29,boot);cube(s*.63,1.39,.1,.23,.14,.26,skin);cube(s*.55,2.37,.25,.18,.14,.035,s<0?'#deb769':'#798979');});
cylinder(0,2.61,0,.15,.25,skin);cube(0,2.94,0,.48,.52,.44,skin);cube(0,3.01,-.12,.5,.45,.25,'#292d29');cube(0,3.24,-.03,.49,.16,.45,'#242a26');cube(0,3.28,.15,.35,.1,.14,'#292f2a');cube(0,2.76,.21,.29,.08,.06,'#655046');cube(0,2.84,.238,.24,.035,.018,'#433c31');cube(0,2.94,.257,.085,.1,.085,skin);[-.13,.13].forEach(x=>{cube(x,3.04,.23,.105,.025,.025,'#393b30');cube(x,3.0,.23,.055,.04,.02,'#272e27')});
// Visible modular equipment
if(g('mobility')){cylinder(0,3.23,0,.335,.24,'#899078');cube(0,3.13,.3,.57,.11,.08,dark);[-.15,.15].forEach(x=>cube(x,3.15,.35,.22,.11,.05,'#bdb276'));}
if(g('food')){cube(0,2.02,-.43,.75,.81,.42,'#8c7c59');cube(0,2.38,-.42,.75,.14,.42,'#a79569');[-.3,.3].forEach(x=>cube(x,2.12,.35,.09,.78,.065,'#9c8d68'));cylinder(0,2.57,-.44,.17,.22,'#b4a57d');}
if(g('combat')){cube(-.39,2.33,-.41,.16,1.12,.14,'#242b29');cube(-.39,2.98,-.41,.075,.31,.07,'#70776b');cube(-.39,1.86,-.41,.2,.27,.16,'#7b694c');cube(-.29,2.18,-.4,.15,.24,.12,'#242b29');[-.2,.02,.24].forEach(x=>cube(x,1.91,.4,.18,.28,.18,'#7c805e'));}
if(g('lifeline')){cube(.43,1.48,.23,.3,.3,.24,'#ad9d77');cube(.43,1.48,.361,.16,.055,.016,'#bc6954');cube(.43,1.48,.362,.05,.17,.017,'#bc6954');}
if(g('shelter')){cube(-.42,1.41,.12,.22,.3,.23,'#9b8050');cube(-.49,1.25,.29,.055,.42,.065,'#af9160');cube(-.49,1.48,.29,.23,.1,.1,'#8e9487');}
if(g('tactics')){cube(.28,2.28,.37,.15,.27,.12,'#242c28');cube(.28,2.6,.37,.025,.4,.025,'#969e84');cube(.27,2.3,.439,.08,.07,.008,'#d9ad60');cube(.28,2.96,.03,.1,.21,.15,dark);}
}
function draw(){const r=cv.getBoundingClientRect();if(!r.width)return;const ratio=Math.min(2,devicePixelRatio||1);cv.width=r.width*ratio;cv.height=r.height*ratio;ctx.setTransform(ratio,0,0,ratio,0,0);const w=r.width,h=r.height;ctx.clearRect(0,0,w,h);mesh();const scale=h/4.25,ca=Math.cos(angle),sa=Math.sin(angle),pitch=.12+tilt;
const transform=p=>{const x=p[0]*ca+p[2]*sa,z=-p[0]*sa+p[2]*ca;return [x,(p[1]-1.68)*Math.cos(pitch)-z*Math.sin(pitch),(p[1]-1.68)*Math.sin(pitch)+z*Math.cos(pitch)]};const project=p=>[w/2+p[0]*scale,h*.49-p[1]*scale];
ctx.strokeStyle='#66725440';ctx.lineWidth=1;for(let i=0;i<4;i++){ctx.beginPath();ctx.ellipse(w/2,h*.92,scale*(.9+i*.21),scale*(.19+i*.04),0,0,Math.PI*2);ctx.stroke()}const shadow=ctx.createRadialGradient(w/2,h*.92,0,w/2,h*.92,scale*.9);shadow.addColorStop(0,'#0008');shadow.addColorStop(1,'#0000');ctx.fillStyle=shadow;ctx.fillRect(0,h*.8,w,h*.2);
const ff=faces.map(f=>({...f,t:f.v.map(transform)})).sort((a,b)=>a.t.reduce((s,v)=>s+v[2],0)/a.t.length-b.t.reduce((s,v)=>s+v[2],0)/b.t.length);
ff.forEach(f=>{const a=f.t[0],b=f.t[1],c=f.t[2];const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const len=Math.hypot(...n)||1;const light=.67+.33*Math.max(0,(-n[0]+n[1]+n[2])/(len*1.73));const rgb=f.c.match(/\w\w/g).map(x=>Math.round(parseInt(x,16)*light));ctx.fillStyle=`rgb(${rgb})`;ctx.beginPath();f.t.forEach((v,i)=>{const p=project(v);i?ctx.lineTo(...p):ctx.moveTo(...p)});ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(0,0,0,.1)';ctx.lineWidth=.5;ctx.stroke();});
ctx.fillStyle='#99a28b';ctx.font='9px monospace';ctx.fillText(all?'LOADOUT / FULL PREVIEW':'LOADOUT / LIVE SKILLS',12,20);ctx.fillStyle='#efb45b';ctx.fillText('●',w-24,20);
}
new ResizeObserver(draw).observe(cv);new MutationObserver(draw).observe(document.querySelector('#gearGrid'),{childList:true,subtree:true});showTab('hq');draw();
})();
