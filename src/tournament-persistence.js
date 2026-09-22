import {validateTournament} from './tournament-domain.js';

export const TOURNAMENT_STORE_KEY='pickleball-referee:tournaments:v1';
const clone=value=>structuredClone(value);
const empty=()=>({version:1,tournaments:{},activeWorkSession:null});

export function createTournamentRepository(storage){
  function load(){
    const raw=storage.getItem(TOURNAMENT_STORE_KEY);
    if(raw===null)return empty();
    let document;
    try{document=JSON.parse(raw)}catch{throw Error('Dữ liệu giải bị hỏng. Không ghi đè dữ liệu đã lưu.');}
    if(document?.version!==1||!document.tournaments||typeof document.tournaments!=='object'||Array.isArray(document.tournaments))throw Error('Phiên bản dữ liệu giải chưa được hỗ trợ.');
    for(const [id,tournament] of Object.entries(document.tournaments)){
      validateTournament(tournament);if(id!==tournament.id)throw Error('Định danh giải không khớp.');
    }
    if(document.activeWorkSession){const {tournamentId,workSessionId}=document.activeWorkSession;
      const t=document.tournaments[tournamentId];if(!t||!t.workSessions.some(s=>s.id===workSessionId&&s.status==='active'))throw Error('Nhiệm vụ đang mở không hợp lệ.');
    }
    return clone(document);
  }
  function save(tournament,{activeWorkSession}={}){
    validateTournament(tournament);
    const document=load();document.tournaments[tournament.id]=clone(tournament);
    if(activeWorkSession!==undefined){
      if(activeWorkSession!==null&&!tournament.workSessions.some(s=>s.id===activeWorkSession&&s.status==='active'))throw Error('Nhiệm vụ đang mở không hợp lệ.');
      document.activeWorkSession=activeWorkSession?{tournamentId:tournament.id,workSessionId:activeWorkSession}:null;
    }else if(document.activeWorkSession?.tournamentId===tournament.id){
      const sid=document.activeWorkSession.workSessionId;
      if(!tournament.workSessions.some(s=>s.id===sid&&s.status==='active'))document.activeWorkSession=null;
    }
    storage.setItem(TOURNAMENT_STORE_KEY,JSON.stringify(document));return clone(tournament);
  }
  const list=()=>Object.values(load().tournaments).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const get=id=>load().tournaments[id]||null;
  return {load,save,list,get};
}
