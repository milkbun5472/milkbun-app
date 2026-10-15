// Embedded pages use the host's shared Head, keeping one title bar and one safe area.
export function panelHeader(host,panel){
 const header=panel.querySelector('header');
 if(host?.setToolbar)header.hidden=true;
 return{show(){if(!host?.setToolbar)return;const [back,...actions]=header.querySelectorAll('button');host.setToolbar({title:header.querySelector('strong').textContent,back:()=>back.click(),actions:actions.map(b=>({id:b.id,label:b.textContent,run:()=>b.click()}))});},close(){host?.setToolbar?.(null);}};
}
