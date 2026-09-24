import {createMatch,rally} from './match-engine.js';
import {createMatchRepository,STORE_KEY} from './match-persistence.js';
import {createTournamentRepository,TOURNAMENT_STORE_KEY} from './tournament-persistence.js';
import {createTournament,addRulesVersion,addResource,addScheduledMatch,createAssignment,startWorkSession,finishWorkSession,setMatchReadiness} from './tournament-domain.js';

const QA_PARAMETER='__today_qa';
const ALLOWED=new Set(['no-work','work-today','working','active-match','completed']);
const at=(day,time)=>`${day}T${time}:00+07:00`;

function makeTournament(storage,{active=false,finished=0,total=7}={}){
  const tournament=createTournament('Vietnam Pickleball Open 2026');
  addRulesVersion(tournament,{label:'Luật thi đấu',authority:'Ban tổ chức',scoring:'side-out',format:{sets:3,points:11,rule:'touch'},procedures:{equipmentCheck:'optional'}});
  const court=addResource(tournament,'courts','Sân 06');
  const group=addResource(tournament,'groups','Đôi nam 4.5 · Tứ kết');
  const matches=[];
  const names=[
    [['Nguyễn Văn A','Trần Văn B'],['Lê Văn C','Phạm Văn D']],
    [['Nguyễn Văn E','Trần Văn F'],['Phạm Thị G','Lê Thị H']],
    [['Minh Quân','Đức Anh'],['Hoàng Nam','Tuấn Kiệt']]
  ];
  for(let index=0;index<total;index++){
    const pair=names[index%names.length];
    matches.push(addScheduledMatch(tournament,{label:`Trận #${36+index*6}`,courtId:court.id,groupId:group.id,type:'double',players:{A:pair[0],B:pair[1]}}));
  }
  const assignment=createAssignment(tournament,{label:'Sân 06 · Bảng A',scopeKind:'court',scopeIds:[court.id]});
  assignment.workPlan={startsAt:at('2026-09-24','07:30'),endsAt:at('2026-09-24','17:00'),location:'Cụm sân ABC Pickleball',city:'TP. Hồ Chí Minh'};
  const sessions=createMatchRepository(storage);
  for(let index=0;index<finished;index++){
    const scheduled=matches[index];
    const session=createMatch({type:'double',sets:1,points:1,rule:'touch',scoring:'side-out',players:scheduled.players,start:{A:0,B:0},note:scheduled.label},{serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0});
    rally(session,'A');session.tournamentContext={tournamentId:tournament.id,scheduledMatchId:scheduled.id,rulesVersionId:tournament.activeRulesVersionId};
    scheduled.matchSessionId=session.id;sessions.saveSession(session);
  }
  let workSession=null;
  if(active){workSession=startWorkSession(tournament,assignment.id);workSession.startedAt=at('2026-09-24','07:28')}
  createTournamentRepository(storage).save(tournament,{activeWorkSession:workSession?.id});
  return {tournament,court,group,matches,assignment,workSession,sessions};
}

function seedNoWork(storage){
  const upcoming=[['Vietnam Pickleball Open 2026','2026-09-26','Cụm sân ABC Pickleball'],['Hà Nội Open 2026','2026-10-10','Hà Nội'],['Pickleball Masters 2026','2026-10-24','Đà Nẵng']];
  const repo=createTournamentRepository(storage);
  for(const [name,day,location] of upcoming){
    const tournament=createTournament(name),court=addResource(tournament,'courts','Sân chưa chốt'),assignment=createAssignment(tournament,{label:'Công việc sắp tới',scopeKind:'court',scopeIds:[court.id]});
    assignment.workPlan={startsAt:at(day,'07:30'),location,city:name.startsWith('Vietnam')?'TP. Hồ Chí Minh':null};repo.save(tournament);
  }
}

function seedCompleted(storage){
  const data=makeTournament(storage,{active:true,finished:7,total:7});
  finishWorkSession(data.tournament,data.workSession.id);
  data.workSession.startedAt=at('2026-09-24','07:30');data.workSession.endedAt=at('2026-09-24','15:32');
  createTournamentRepository(storage).save(data.tournament,{activeWorkSession:null});
}

export function applyTodayQaFixtureIfRequested(storage=localStorage,locationValue=location){
  const params=new URLSearchParams(locationValue.search),fixture=params.get(QA_PARAMETER);
  const previewHost=locationValue.hostname.endsWith('.vercel.app')&&locationValue.hostname!=='pickleball-referee-two.vercel.app';
  if(!previewHost||!ALLOWED.has(fixture))return false;
  document.documentElement.dataset.todayQa='true';
  storage.removeItem(STORE_KEY);storage.removeItem(TOURNAMENT_STORE_KEY);
  if(fixture==='no-work')seedNoWork(storage);
  if(fixture==='work-today')makeTournament(storage);
  if(fixture==='working')makeTournament(storage,{active:true,finished:3});
  if(fixture==='completed')seedCompleted(storage);
  if(fixture==='active-match'){
    const data=makeTournament(storage,{active:true,finished:3});
    const scheduled=data.matches[3];setMatchReadiness(data.tournament,scheduled.id,'ready');
    const session=createMatch({type:'double',sets:3,points:11,rule:'touch',scoring:'side-out',players:scheduled.players,start:{A:0,B:0},note:scheduled.label},{serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0});
    session.currentGamePoints={A:8,B:6};session.game=2;session.tournamentContext={tournamentId:data.tournament.id,scheduledMatchId:scheduled.id,rulesVersionId:data.tournament.activeRulesVersionId};
    scheduled.matchSessionId=session.id;data.sessions.saveSession(session);createTournamentRepository(storage).save(data.tournament,{activeWorkSession:data.workSession.id});
  }
  return true;
}
