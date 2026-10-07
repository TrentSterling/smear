// Player commands live beside the retained HUD/input closure.
function cancelBuddyPlacement(){if(compute?.placement){compute.cancelBuddy();notify('Placement cancelled.');lastHUDKey='';}}
function beginBuddyPlacement(restore=false){
 if(!compute?.ready||compute.buddyBusy)return;
 const base=restore&&selected?Math.floor((selected.id-1)/15)*15:compute.bodyCount;
 if(restore&&(!selected||base>=compute.bodyCount)){notify('Grab a buddy first, then press R to restore it.');return;}
 if(!restore&&base>=180){notify('All 12 buddy slots are in use. Grab one and press R to restore it.');return;}
 releaseGrab(false);resetToolTransient();demo=null;compute.beginBuddy(base);
 notify((restore?'Restore buddy '+(base/15+1):'Place a new buddy')+' | Aim at clear floor | Click: place | Q/E: turn | Esc: cancel',60);
 if(fpsControl.mode==='fps'&&!fpsControl.inspection&&!document.pointerLockElement)requestLook();
}
async function confirmBuddyPlacement(){
 if(!compute?.placement||compute.buddyBusy)return;
 mouse.left=false;const result=await compute.confirmBuddy();if(!result)return;
 if(result.status===1){selected=fullBodies[result.base];notify((result.adding?'Added':'Restored')+' buddy '+(result.base/15+1)+'. Room and stains preserved.');}
 else notify(({2:'Aim at the room floor.',3:'Move farther from the room edge.',4:'That spot intersects a wall or prop.',5:'Another buddy occupies that spot.',6:'All 12 buddy slots are in use.',7:'Place the buddy farther from you.'})[result.status]+' | Move the preview and click again.',60);
 lastHUDKey='';
}
