import {notifyDomainChange} from './domain-events.js';
import {validateTournament} from './tournament-domain.js';
import {migrateTournamentIdentity,migrateTournamentScoreSemantics} from './tournament-identity-migration.js';

export const TOURNAMENT_STORE_KEY='pickleball-referee:tournaments:v1';
const clone=value=>structuredClone(value);
const empty=()=>({version:2,tournaments:{},activeWorkSession:null});

export function createTournamentRepository(storage){
  function load(){
    const raw=storage.getItem(TOURNAMENT_STORE_KEY);
    if(raw===null)return empty();
    let document;
    try{document=JSON.parse(raw)}catch{throw Error('Dữ liệu giải bị hỏng. Không ghi đè dữ liệu đã lưu.');}
    if(![1,2].includes(document?.version)||!document.tournaments||typeof document.tournaments!=='object'||Array.isArray(document.tournaments))throw Error('Phiên bản dữ liệu giải chưa được hỗ trợ.');
    let migrated=document.version===1;
    for(const [tournamentId,tournament] of Object.entries(document.tournaments)){
      const identity=migrateTournamentIdentity(tournament),semantics=migrateTournamentScoreSemantics(identity.tournament);document.tournaments[tournamentId]=semantics.tournament;migrated||=identity.migrated||semantics.migrated;
    }
    document.version=2;
    for(const [id,tournament] of Object.entries(document.tournaments)){
      validateTournament(tournament);if(id!==tournament.id)throw Error('Định danh giải không khớp.');
    }
    if(document.activeWorkSession){const {tournamentId,workSessionId}=document.activeWorkSession;
      const t=document.tournaments[tournamentId];if(!t||!t.workSessions.some(s=>s.id===workSessionId&&s.status==='active'))throw Error('Nhiệm vụ đang mở không hợp lệ.');
    }
    if(migrated)storage.setItem(TOURNAMENT_STORE_KEY,JSON.stringify(document));
    return clone(document);
  }
  function save(tournament,{activeWorkSession}={}){
    validateTournament(tournament);
    const document=load();document.tournaments[tournament.id]=clone(tournament);
    if(activeWorkSession!==undefined){
      if(activeWorkSession!==null&&!tournament.workSessions.some(s=>s.id===activeWorkSession&&s.status==='active'))throw Error('Nhiệm vụ đang mở không hợp lệ.');
      if(activeWorkSession&&document.activeWorkSession&&
        (document.activeWorkSession.tournamentId!==tournament.id||document.activeWorkSession.workSessionId!==activeWorkSession))throw Error('Kết thúc nhiệm vụ đang mở trước khi bắt đầu nhiệm vụ khác.');
      if(activeWorkSession===null&&document.activeWorkSession){
        if(document.activeWorkSession.tournamentId!==tournament.id)throw Error('Không thể xóa nhiệm vụ của giải khác.');
        if(tournament.workSessions.some(s=>s.id===document.activeWorkSession.workSessionId&&s.status==='active'))throw Error('Kết thúc nhiệm vụ trước khi xóa trạng thái tiếp tục.');
      }
      document.activeWorkSession=activeWorkSession?{tournamentId:tournament.id,workSessionId:activeWorkSession}:null;
    }else if(document.activeWorkSession?.tournamentId===tournament.id){
      const sid=document.activeWorkSession.workSessionId;
      if(!tournament.workSessions.some(s=>s.id===sid&&s.status==='active'))document.activeWorkSession=null;
    }
    storage.setItem(TOURNAMENT_STORE_KEY,JSON.stringify(document));notifyDomainChange();return clone(tournament);
  }
  const list=()=>Object.values(load().tournaments).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const get=id=>load().tournaments[id]||null;
  return {load,save,list,get};
}
