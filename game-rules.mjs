// Game balance, not a medical or real-world fitness assessment.
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const number = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0;
const ratio = (v, cap) => clamp(number(v) / cap, 0, 1);
export function deriveFitness(body = {}) {
  const endurance = number(body.run5k) ? clamp((40 - number(body.run5k)) / 20, 0, 1) : 0;
  const strength = (ratio(body.bench,100) + ratio(body.dead,160) + ratio(body.pullup,15) + ratio(body.grip,60)) / 4;
  const legs = ratio(body.squat,140);
  return { maxHP: Math.round(100 + strength * 40), maxStamina: Math.round(100 + endurance * 80 + legs * 20),
    recovery: 12 + endurance * 8, runSpeed: 6 + legs * 1.4, walkSpeed: 3.6,
    meleeBonus: Math.round(strength * 10), endurance, strength, legs,
    entered: ['bench','dead','pullup','grip','squat','run5k'].filter(k => number(body[k]) > 0).length };
}
export const WEAPONS = {
  fists: { name:'素手', range:2.3, cooldown:.55, stamina:9, damage:18, key:'1' },
  knife: { name:'ナイフ', range:2.7, cooldown:.48, stamina:7, damage:24, key:'2' },
  rifle: { name:'ライフル', range:36, cooldown:.85, stamina:2, damage:44, key:'3' },
};
export function canEquip(weapon,levels={}) {
  return weapon === 'fists' || (weapon === 'knife' && number(levels.knife) >= 1) || (weapon === 'rifle' && number(levels['hunt-license']) >= 2);
}
export function attackPlan({weapon,levels,ammo,stamina,now,readyAt,onBike,inside}) {
  if(!canEquip(weapon,levels))return {ok:false,reason:'この装備は未解放です。'};
  if(onBike)return {ok:false,reason:'バイクから降りて攻撃してください。'};
  if(inside)return {ok:false,reason:'屋内には攻撃対象がいません。'};
  if(now<readyAt)return {ok:false,reason:''};
  const w=WEAPONS[weapon];
  if(weapon==='rifle'&&ammo<1)return {ok:false,reason:'弾薬がありません。'};
  if(stamina<w.stamina)return {ok:false,reason:'スタミナ不足。少し休んでください。'};
  return {ok:true,ammo:ammo-(weapon==='rifle'?1:0),stamina:stamina-w.stamina,readyAt:now+w.cooldown};
}
// Segment against horizontal solid building/car rectangles. Even faded buildings block fire.
export function lineBlocked(a,b,obstacles) {
  return obstacles.some(o=>{
    let lo=0,hi=1;
    for(const [key,extent] of [['x','w'],['z','d']]){
      const delta=b[key]-a[key],min=o[key]-o[extent]/2,max=o[key]+o[extent]/2;
      if(Math.abs(delta)<1e-9){if(a[key]<min||a[key]>max)return false;}
      else {let t1=(min-a[key])/delta,t2=(max-a[key])/delta;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;}
    }
    return hi>=0&&lo<=1;
  });
}
export function hitDamage({weapon,levels={},fitness,distance,blocked}) {
  const w=WEAPONS[weapon];if(!w||distance>w.range||blocked||!canEquip(weapon,levels))return 0;
  if(weapon==='rifle'){
    return w.damage+Math.round(ratio(levels.marksman,5)*20);
  }
  return w.damage+fitness.meleeBonus+Math.round(ratio(levels[weapon==='knife'?'knife':'melee'],5)*20);
}
export function staminaStep({value,exhausted,delay},fitness,{dt,moving,wantsRun,onBike}) {
  const delta=clamp(dt,0,.1);
  let sprinting=!!(moving&&wantsRun&&!onBike&&!exhausted&&value>0);
  if(sprinting){value=Math.max(0,value-18*delta);delay=.9;if(value<=0){exhausted=true;sprinting=false;}}
  else {delay=Math.max(0,delay-delta);if(delay===0)value=Math.min(fitness.maxStamina,value+fitness.recovery*delta);}
  if(exhausted&&value>=fitness.maxStamina*.25)exhausted=false;
  return {value,exhausted,delay,sprinting};
}
