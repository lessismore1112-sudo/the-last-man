import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveFitness,canEquip,attackPlan,hitDamage,lineBlocked,staminaStep} from './game-rules.mjs';
const base=deriveFitness({});
test('missing, invalid and extreme fitness records stay playable and finite',()=>{
  assert.equal(base.maxHP,100);assert.equal(base.maxStamina,100);assert.equal(base.entered,0);
  for(const body of [{run5k:'oops',bench:-10},{run5k:Infinity,squat:NaN},{run5k:1,bench:9999,squat:99999}]){
    const f=deriveFitness(body);assert.ok(f.maxHP>=100&&f.maxHP<=140);assert.ok(f.maxStamina>=100&&f.maxStamina<=200);
  }
});
test('running record improves endurance without changing strength; lifting changes HP/power',()=>{
  const runner=deriveFitness({run5k:25}),lifter=deriveFitness({bench:100,dead:160,pullup:15,grip:60,squat:140});
  assert.ok(runner.maxStamina>base.maxStamina);assert.ok(runner.recovery>base.recovery);assert.equal(runner.maxHP,base.maxHP);
  assert.ok(lifter.maxHP>base.maxHP);assert.ok(lifter.meleeBonus>base.meleeBonus);assert.ok(lifter.runSpeed>base.runSpeed);
  assert.deepEqual(deriveFitness({bf:5}),deriveFitness({bf:30}));
});
test('rifle is locked for absent/studying license even when called directly',()=>{
  for(const lv of [undefined,0,1])assert.equal(canEquip('rifle',{'hunt-license':lv}),false);
  assert.ok(canEquip('rifle',{'hunt-license':2}));assert.equal(canEquip('knife',{}),false);
  const input={weapon:'rifle',levels:{},ammo:10,stamina:100,now:2,readyAt:0};assert.equal(attackPlan(input).ok,false);
});
test('one shot consumes exactly one round, locks rapid repeats, and rejects no ammo',()=>{
  const input={weapon:'rifle',levels:{'hunt-license':2},ammo:2,stamina:100,now:2,readyAt:0};
  const shot=attackPlan(input);assert.equal(shot.ammo,1);assert.equal(shot.stamina,98);
  assert.equal(attackPlan({...input,now:2.1,readyAt:shot.readyAt}).ok,false);
  assert.equal(attackPlan({...input,ammo:0}).ok,false);assert.equal(attackPlan({...input,stamina:1}).ok,false);
  assert.equal(attackPlan({...input,onBike:true}).ok,false);
});
test('walls block either direction, but do not block shots that pass alongside',()=>{
  const wall=[{x:0,z:0,w:4,d:4}];assert.ok(lineBlocked({x:-10,z:0},{x:10,z:0},wall));assert.ok(lineBlocked({x:10,z:0},{x:-10,z:0},wall));
  assert.ok(lineBlocked({x:0,z:-10},{x:0,z:10},wall));assert.equal(lineBlocked({x:-10,z:3},{x:10,z:3},wall),false);
});
test('distant shots work but melee, blocked fire and out-of-range shots never damage',()=>{
  const shot={weapon:'rifle',levels:{'hunt-license':2},fitness:base,distance:30,blocked:false,roll:0};
  assert.ok(hitDamage(shot)>0);assert.equal(hitDamage({...shot,distance:40}),0);assert.equal(hitDamage({...shot,blocked:true}),0);
  assert.equal(hitDamage({...shot,weapon:'fists'}),0);assert.ok(hitDamage({...shot,weapon:'fists',distance:2})>0);
});
test('running exhausts stamina and cannot restart until a quarter has recovered',()=>{
  let s={value:base.maxStamina,exhausted:false,delay:0};
  for(let i=0;i<57;i++)s=staminaStep(s,base,{dt:.1,moving:true,wantsRun:true});
  assert.ok(s.exhausted);assert.equal(s.sprinting,false);assert.ok(s.value<2);
  for(let i=0;i<40;i++)s=staminaStep(s,base,{dt:.1,moving:false,wantsRun:false});
  assert.ok(s.value>=25);assert.equal(s.exhausted,false);
  assert.ok(staminaStep(s,base,{dt:.1,moving:true,wantsRun:true}).sprinting);
});
test('standing against a wall or sitting on a bike does not drain stamina',()=>{
  for(const flags of [{moving:false,wantsRun:true},{moving:true,wantsRun:true,onBike:true}]){
    assert.equal(staminaStep({value:100,delay:0,exhausted:false},base,{dt:.1,...flags}).value,100);
  }
});
