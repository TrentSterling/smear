// Explicit inspection positions the camera; the switch is operated by native input.
export async function aimMachineSwitch(page,id,distance=1.3){
 return page.eval(`(async()=>{const g=__smearGPU,T=g.THREE,p=(await __smear.props())[${id}],kind=g.props[${id}].kind;
 const local=({crusher:[.96,.85,.955],fan:[.30,-.12,.415],conveyor:[.95,.42,.805],launcher:[.57,.40,.655],spinner:[0,.62,.065]})[kind];
 const q=new T.Quaternion(...p.q),point=new T.Vector3(...local).applyQuaternion(q).add(new T.Vector3(...p.p));
 const origin=new T.Vector3(0,.35,${distance}).applyQuaternion(q).add(point);__smear.view(origin.toArray(),point.toArray());__smear.pointer(innerWidth/2,innerHeight/2);__smear.render();return {point:point.toArray(),origin:origin.toArray()};})()`);
}
export async function useMachineSwitch(page,id){
 await aimMachineSwitch(page,id);
 for(const type of ['keyDown','keyUp'])await page.call('Input.dispatchKeyEvent',{type,key:'e',code:'KeyE',windowsVirtualKeyCode:69});
 await page.eval('__smearGPU.device.queue.onSubmittedWorkDone()');
}
