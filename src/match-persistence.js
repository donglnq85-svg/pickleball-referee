import {MATCH_SCHEMA_VERSION, RULES_VERSION, validateMatchState} from './match-domain.js';

export const STORE_KEY = 'pickleball-referee:matches:v2';
const OLD = {active:'pickleball-referee:v1:active', draft:'pickleball-referee:v1:draft', history:'pickleball-referee:v1:history'};
const clone = value => structuredClone(value);
const empty = () => ({version:2, activeId:null, draft:null, matches:{}});

// One atomic localStorage write contains the active match, Undo/Redo stacks,
// draft, completed sessions and their event ledgers. Legacy keys remain untouched.
export function createMatchRepository(storage) {
  function commit(document) {
    storage.setItem(STORE_KEY, JSON.stringify(document));
    return document;
  }
  function migrate() {
    const doc=empty();
    const parse=key=>{try{return JSON.parse(storage.getItem(key))}catch{return null}};
    const oldActive=parse(OLD.active), oldHistory=parse(OLD.history);
    if(Array.isArray(oldHistory))for(const match of oldHistory) {
      try {validateMatchState(match);doc.matches[match.id]=upgrade(match)} catch { /* malformed legacy record */ }
    }
    if(oldActive) {
      try {validateMatchState(oldActive);doc.matches[oldActive.id]=upgrade(oldActive);doc.activeId=oldActive.id} catch { /* malformed legacy active */ }
    }
    doc.draft=parse(OLD.draft);
    return commit(doc);
  }
  function load() {
    const serialized=storage.getItem(STORE_KEY);
    if(serialized===null)return clone(migrate());
    let doc;
    try {doc=JSON.parse(serialized)} catch {throw Error('Dữ liệu trận đã lưu bị hỏng. Không ghi đè để có thể khôi phục.');}
    if(doc?.version!==2||!doc.matches||typeof doc.matches!=='object'||Array.isArray(doc.matches))throw Error('Phiên bản dữ liệu trận chưa được hỗ trợ.');
    if(doc.activeId && !doc.matches[doc.activeId])throw Error('Không tìm thấy trận đang diễn ra trong dữ liệu đã lưu.');
    for(const match of Object.values(doc.matches))validateMatchState(match);
    return clone(doc);
  }
  function upgrade(match) {return {...clone(match),version:MATCH_SCHEMA_VERSION,rulesVersion:match.rulesVersion||RULES_VERSION}}
  function saveSession(match,{draft,clearDraft=false}={}) {
    validateMatchState(match);
    const doc=load();
    doc.matches[match.id]=clone(match);
    doc.activeId=match.id;
    if(clearDraft)doc.draft=null;
    else if(draft!==undefined)doc.draft=clone(draft);
    commit(doc);
    return clone(match);
  }
  function insertSessionIfAbsent(match){
    validateMatchState(match);
    const doc=load();
    if(doc.matches[match.id])return clone(doc.matches[match.id]);
    doc.matches[match.id]=clone(match);doc.activeId=match.id;
    commit(doc);return clone(match);
  }
  function saveDraft(draft) {const doc=load();doc.draft=draft===null?null:clone(draft);commit(doc)}
  function active() {const doc=load();return doc.activeId?doc.matches[doc.activeId]:null}
  function history() {return Object.values(load().matches).filter(m=>m.status==='finished').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
  function get(id) {return load().matches[id]||null}
  return {load,active,history,get,saveSession,insertSessionIfAbsent,saveDraft};
}
