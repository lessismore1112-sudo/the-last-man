export const STAGES={
 city:{name:'旧市街',subtitle:'建物を探索して物資を回収',sky:'#536b69',ground:'#4a5d49',names:['CLINIC','MOTOR WORKS','RADIO / 04']},
 forest:{name:'山間の集落',subtitle:'森の作業小屋と救護所を巡る',sky:'#63765b',ground:'#536044',names:['RANGER AID','SAWMILL','MOUNTAIN RADIO']},
 port:{name:'封鎖された港',subtitle:'倉庫街を抜け、足場で封鎖を越える',sky:'#526877',ground:'#555f5c',names:['PORT MEDICAL','FUEL DEPOT','COAST RADIO']}
};
export function buildPlan(type,levels={},materials=0){
 const architect=Math.max(0,Number(levels.architect)||0),carpentry=Math.max(0,Number(levels.carpentry)||0);
 const qualified=architect>=2||carpentry>=2;
 const cost=type==='bridge'?(architect>=2?4:6):(architect>=2?3:4);
 return {cost,hp:100+Math.min(5,carpentry)*25+(architect>=2?75:0),allowed:['barrier','bridge'].includes(type)&&(type!=='bridge'||qualified)&&materials>=cost,reason:type==='bridge'&&!qualified?'建築士取得済 または 大工LV2が必要':materials<cost?'資材が足りません':'建築できます'};
}
export function canPlaceBarrier(x,z,colliders,structures){return Math.abs(x)<58&&Math.abs(z)<68&&!colliders.some(b=>Math.abs(x-b.x)<b.w/2+2.5&&Math.abs(z-b.z)<b.d/2+1)&&!structures.some(b=>b.hp>0&&Math.hypot(b.x-x,b.z-z)<5);}
