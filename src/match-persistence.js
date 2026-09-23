import {MATCH_SCHEMA_VERSION, RULES_VERSION, validateMatchState} from './match-domain.js';

export const STORE_KEY = 'pickleball-referee:matches:v2';
const OLD = {active:'pickleball-referee:v1:active', draft:'pickleball-referee:v1:draft', history:'pickleball-referee:v1:history'};
const clone = value => structuredClone(value);
const empty = () => ({version:2, activeId:null, draft:null, matches:{}});

function upgradeSnapshot(input){
  if(!input||typeof input!=='object')return input;
  const state=clone(input);
  if(state.currentGamePoints===undefined&&state.score!==undefined){state.currentGamePoints=clone(state.score);delete state.score}
  if(state.completedGames===undefined&&Array.isArray(state.games)){
    state.completedGames=state.games.map((game,index)=>({gameNumber:game.game??index+1,points:clone(game.points??game.score),winner:game.winner}));delete state.games;
  }
  state.version=MATCH_SCHEMA_VERSION;state.rulesVersion=state.rulesVersion||RULES_VERSION;
  return state;
}
function upgradeMatch(input){
  const match=upgradeSnapshot(input);
  match.undo=(match.undo||[]).map(transition=>({...transition,before:upgradeSnapshot(transition.before),after:upgradeSnapshot(transition.after)}));
  match.redo=(match.redo||[]).map(transition=>({...transition,before:upgradeSnapshot(transition.before),after:upgradeSnapshot(transition.after)}));
  match.events=(match.events||[]).map(event=>({...event,before:upgradeSnapshot(event.before),after:upgradeSnapshot(event.after)}));
  return match;
}

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
      try {const upgraded=upgradeMatch(match);validateMatchState(upgraded);doc.matches[upgraded.id]=upgraded} catch { /* malformed legacy record */ }
    }
    if(oldActive) {
      try {const upgraded=upgradeMatch(oldActive);validateMatchState(upgraded);doc.matches[upgraded.id]=upgraded;doc.activeId=upgraded.id} catch { /* malformed legacy active */ }
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
    let migrated=false;
    for(const [matchId,match] of Object.entries(doc.matches)){
      const upgraded=upgradeMatch(match);validateMatchState(upgraded);doc.matches[matchId]=upgraded;
      migrated||=match.version!==MATCH_SCHEMA_VERSION||match.score!==undefined||match.games!==undefined;
    }
    if(migrated)commit(doc);
    return clone(doc);
  }
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
