import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPress,bindHold,bindChoice} from './touch-controls.mjs';
class Button extends EventTarget {style={};disabled=false;setPointerCapture(id){this.captured=id;} fire(type,props={}){const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,pointerId:1,...props});this.dispatchEvent(e);if(type==='click')this.onclick?.(e);}}
test('second finger triggers an action while sprint remains held; compatibility click does not duplicate',()=>{
 const run=new Button(),attack=new Button();let held=false,hits=0;
 bindHold(run,value=>held=value);bindPress(attack,()=>hits++);
 run.fire('pointerdown',{pointerId:2});attack.fire('pointerdown',{pointerId:3});attack.fire('click',{detail:1,pointerType:'touch'});
 assert.equal(held,true);assert.equal(hits,1);
 run.fire('pointerup',{pointerId:3});assert.equal(held,true);
 run.fire('pointerup',{pointerId:2});assert.equal(held,false);
});
test('cancellation, lost capture, focus loss and explicit reset release sprint',()=>{
 for(const event of ['pointercancel','lostpointercapture','blur']){const b=new Button();let held=false;bindHold(b,v=>held=v);b.fire('pointerdown');b.fire(event);assert.equal(held,false);}
 const b=new Button();let held=false;const reset=bindHold(b,v=>held=v);b.fire('pointerdown');reset();assert.equal(held,false);
});
test('hold ignores a second pointer, release does not toggle, and keyboard activation works',()=>{
 const b=new Button();let held=false;bindHold(b,v=>held=v);b.fire('pointerdown');b.fire('pointerdown',{pointerId:9});b.fire('pointerup');b.fire('click',{detail:1});assert.equal(held,false);
 b.fire('keydown',{key:' ',repeat:false});assert.equal(held,true);b.fire('keyup',{key:' '});assert.equal(held,false);
 let count=0;const action=new Button();bindPress(action,()=>count++);action.fire('click',{detail:0});assert.equal(count,1);action.disabled=true;action.fire('pointerdown');assert.equal(count,1);
});

test('inventory scroll does not equip; a second-finger tap equips exactly once',()=>{
 const b=new Button();let selected=0;bindChoice(b,()=>selected++);
 b.fire('pointerdown',{clientX:0,clientY:0});b.fire('pointermove',{clientX:0,clientY:30});b.fire('pointerup');assert.equal(selected,0);
 b.fire('pointerdown',{pointerId:7,clientX:0,clientY:0});b.fire('pointerup',{pointerId:7});b.fire('click',{detail:1,pointerType:'touch'});assert.equal(selected,1);
});
