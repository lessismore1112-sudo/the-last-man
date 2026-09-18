// Independent pointer ownership lets the stick, sprint and actions run concurrently.
export function bindPress(button, action) {
  button.style.touchAction = 'none';
  button.addEventListener('pointerdown', e => {
    if (button.disabled || e.button !== 0) return;
    e.preventDefault();
    action(e);
  });
  button.onclick = e => {
    // Native keyboard/assistive activation remains available; pointer clicks are already handled.
    if (e.detail === 0 && !e.pointerType && !button.disabled) action(e);
  };
}
export function bindHold(button, change) {
  let owner = null;
  const reset = () => { owner = null; change(false); };
  button.style.touchAction = 'none';
  button.addEventListener('pointerdown', e => {
    if (button.disabled || e.button !== 0 || owner !== null) return;
    e.preventDefault(); owner = e.pointerId;
    button.setPointerCapture(owner); change(true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(type, e => { if (e.pointerId === owner) reset(); });
  }
  button.addEventListener('keydown', e => {
    if (![' ', 'Enter'].includes(e.key)) return;
    e.preventDefault(); if (!e.repeat) change(true);
  });
  button.addEventListener('keyup', e => { if ([' ', 'Enter'].includes(e.key)) {e.preventDefault();reset();} });
  button.addEventListener('blur', reset);
  button.onclick = e => e.preventDefault();
  return reset;
}

// Inventory choices activate on release, so a vertical drag can scroll the drawer.
export function bindChoice(button, action) {
  let press=null;
  button.style.touchAction='pan-y';
  button.addEventListener('pointerdown', e=>{if(!button.disabled&&e.button===0&&!press)press={id:e.pointerId,x:e.clientX,y:e.clientY};});
  button.addEventListener('pointermove',e=>{if(press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>12)press=null;});
  button.addEventListener('pointercancel',()=>press=null);
  button.addEventListener('pointerleave',()=>press=null);
  button.addEventListener('pointerup',e=>{if(press?.id!==e.pointerId)return;press=null;if(!button.disabled)action(e);});
  button.onclick=e=>{if(e.detail===0&&!e.pointerType&&!button.disabled)action(e);};
}
