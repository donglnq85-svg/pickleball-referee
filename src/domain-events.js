// Notify projections after a successful domain write, without owning domain state.
export function notifyDomainChange(){
  if(typeof window!=='undefined')queueMicrotask(()=>window.dispatchEvent(new window.Event('referee-domain-changed')));
}
