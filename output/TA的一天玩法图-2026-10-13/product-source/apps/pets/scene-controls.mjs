// One label/icon renderer for the town's existing buttons; callbacks stay with the game.
const marks={
 photo:'<path d="M3 6h5l2-2h4l2 2h5v14H3Z"/><circle cx="12" cy="13" r="4"/>',
 pet:'<ellipse cx="12" cy="15.5" rx="5" ry="4"/><circle cx="5" cy="8.5" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="15" cy="5.5" r="2"/><circle cx="19.5" cy="9" r="2"/>',
 wake:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 clock:'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
 door:'<path d="M5 20h14M7 20V4h10v16M13 12h.1M3 12h6m-3-3 3 3-3 3"/>',
 talk:'<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h5"/>',
 book:'<path d="M6 4h12v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM6 4v16M10 8h5M10 12h3"/>',
 care:'<path d="M5 4h14v16H5Z"/><path d="M8 4V2m8 2V2M9 10h6M9 14h4"/>',
 view:'<path d="M3 8V4h4m10 0h4v4m0 8v4h-4M7 20H3v-4"/><circle cx="12" cy="12" r="3"/>',
 full:'<path d="M5 9V5h4m6 0h4v4m0 6v4h-4M9 19H5v-4"/>',
 feed:'<path d="M4 12h16l-2 7H6l-2-7ZM8 8c-2-2 2-3 0-5m5 5c-2-2 2-3 0-5"/>',
 snack:'<path d="m8 7 9 9m-9-9a3 3 0 1 0-4 4c0 2 2 3 4 1l4 4c-2 2-1 4 1 4a3 3 0 1 0 4-4l-4-4c2-2 1-4-1-4a3 3 0 0 0-4-1Z"/>',
 ball:'<circle cx="12" cy="12" r="8"/><path d="M6 6c7 0 12 5 12 12M4 12c5 0 8 3 8 8M12 4c0 5 3 8 8 8"/>',
 mouse:'<path d="M6 16c-1-5 2-8 5-8 4 0 7 4 7 8H6Zm12 0c6-2 4-6 2-6"/><circle cx="9" cy="8" r="3"/><path d="M14 13h.1M5 16H3"/>',
 rest:'<path d="M4 19V8m16 11v-8H4m0 5h16M7 11V7h6v4"/><path d="M17 5h3l-3 3h3"/>',
 touch:'<path d="M7 12V7a2 2 0 0 1 4 0v4-6a2 2 0 0 1 4 0v6-4a2 2 0 0 1 4 0v8c0 4-3 6-6 6-2 0-4-1-5-3l-4-5a2 2 0 0 1 3-2l2 2"/>'
};
export function setSceneControlLabel(button,text,mark){if(!button)return;const label=button.querySelector('[data-control-label]');(label||button).textContent=text;const icon=mark&&button.querySelector('svg[data-control-mark]');if(icon&&marks[mark]&&icon.dataset.controlMark!==mark){icon.innerHTML=marks[mark];icon.dataset.controlMark=mark;}}
export function mountTownControls(doc=document){
 if(!doc.body.classList.contains('pet-game'))return;
 const decorate=(button,mark)=>{if(!button||button.querySelector('[data-control-label]'))return;const text=button.textContent;button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" data-control-mark="'+mark+'">'+marks[mark]+'</svg><span data-control-label></span>';setSceneControlLabel(button,text);};
 for(const[id,mark]of Object.entries({'selected-pet':'pet',light:'clock',back:'door','pet-talk':'talk','pet-work':'book','pet-status':'care','pet-photo':'photo','watch-view':'view',reset:'full'}))decorate(doc.getElementById(id),mark);
 for(const b of doc.querySelectorAll('#walk-actions [data-walk]'))decorate(b,({pause:'view',play:'ball',pet:'touch',resume:'door',home:'rest'})[b.dataset.walk]);
 for(const b of doc.querySelectorAll('#home-actions [data-care]'))decorate(b,({feed:'feed',snack:'snack',play:b.dataset.toy==='mouse'?'mouse':'ball',rest:'rest',pet:'touch'})[b.dataset.care]);
}
