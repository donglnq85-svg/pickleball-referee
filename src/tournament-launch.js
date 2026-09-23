import {createMatch} from './match-engine.js';
import {validateMatchSetup} from './match-domain.js';
import {createMatchRepository} from './match-persistence.js';
import {createTournamentRepository} from './tournament-persistence.js';
import {courtManagerView,matchPlayers} from './tournament-domain.js';

const clone=value=>structuredClone(value);
const sessionId=(tournamentId,scheduledMatchId)=>`tournament:${tournamentId}:match:${scheduledMatchId}`;
const fail=(stage,options)=>options?.afterStage?.(stage);
const context=(t,m,rulesVersionId,matchStartSnapshotId=null)=>({tournamentId:t.id,scheduledMatchId:m.id,rulesVersionId,matchStartSnapshotId});
function matchFor(repo,t,m){
  const matches=Object.values(repo.load().matches).filter(s=>s.tournamentContext?.tournamentId===t.id&&s.tournamentContext?.scheduledMatchId===m.id);
  if(matches.length>1)throw Error('Có nhiều Match Session cho cùng một trận. Dừng để bảo vệ lịch sử.');
  return matches[0]||null;
}
function verifySession(session,t,m,intent){
  if(!session||session.id!==intent.sessionId||session.tournamentContext?.tournamentId!==t.id||
    session.tournamentContext?.scheduledMatchId!==m.id||session.tournamentContext?.rulesVersionId!==intent.rulesVersionId||
    (intent.matchStartSnapshotId&&session.tournamentContext?.matchStartSnapshotId!==intent.matchStartSnapshotId))
    throw Error('Match Session không khớp launch journal. Không tạo trận thay thế.');
  return session;
}

// The journal is persisted before the Gate #1 repository is touched. A crash
// after either write resumes deterministically using the stable session ID.
export function beginTournamentMatch(tournamentId,workSessionId,matchId,final,storage,options={}){
  const tournaments=createTournamentRepository(storage),matches=createMatchRepository(storage);
  let t=tournaments.get(tournamentId);
  if(!t)throw Error('Không tìm thấy giải.');
  const scope=courtManagerView(t,workSessionId),m=t.schedule.find(item=>item.id===matchId);
  if(scope.workSession.status!=='active'||!scope.matches.some(item=>item.id===matchId)||!m)throw Error('Trận ngoài phạm vi nhiệm vụ đang hoạt động.');
  t.launches??={};
  let intent=t.launches[matchId];
  const existing=matchFor(matches,t,m);
  if(intent){
    if(existing&&existing.id!==intent.sessionId)throw Error('Match Session xung đột với journal.');
  }else if(m.matchSessionId||existing){
    // Reconcile a partially persisted pre-journal candidate without changing
    // its identity or rewriting its rally/Undo/event history.
    const recovered=existing||matches.get(m.matchSessionId);
    if(!recovered||!recovered.tournamentContext||recovered.tournamentContext.tournamentId!==t.id||
      recovered.tournamentContext.scheduledMatchId!==m.id||
      (m.matchSessionId&&m.matchSessionId!==recovered.id))throw Error('Linkage cũ không thể phục hồi an toàn.');
    intent={phase:'linked',sessionId:recovered.id,rulesVersionId:recovered.tournamentContext.rulesVersionId,config:clone(recovered.config),final:null,createdAt:recovered.createdAt};
    m.matchSessionId=recovered.id;t.launches[matchId]=intent;tournaments.save(t);
    return recovered;
  }else{
    const snapshot=m.matchStartSnapshot;
    const version=t.rulesVersions.find(v=>v.id===(snapshot?.rulesVersionId||t.activeRulesVersionId));
    const players=matchPlayers(t,m);
    if(m.readiness!=='ready'||!players||version?.scoring!=='side-out'||!version.format)throw Error('Trận hoặc luật chưa đủ điều kiện bắt đầu.');
    const config=snapshot?clone(snapshot.config):{...clone(version.format),type:m.type,players,start:{A:0,B:0},scoring:'side-out'};
    const launchFinal=snapshot?clone(snapshot.final):final;
    if(snapshot&&(snapshot.scheduledMatchId!==m.id||snapshot.rulesVersionId!==version.id))throw Error('Match Start Snapshot không nhất quán.');
    validateMatchSetup(config,launchFinal);
    fail('beforeIntent',options);
    intent={phase:'prepared',sessionId:sessionId(t.id,m.id),rulesVersionId:version.id,matchStartSnapshotId:snapshot?.id||null,config,final:clone(launchFinal),createdAt:new Date().toISOString()};
    t.launches[matchId]=intent;tournaments.save(t);
    fail('afterIntent',options);
  }
  if(intent.phase==='linked'){
    if(!m.matchSessionId)throw Error('Linkage đã đóng nhưng thiếu Match Session ID.');
    return verifySession(matches.get(intent.sessionId),t,m,intent);
  }
  // A prepared intent may have been committed before the Match Store write.
  let session=matches.get(intent.sessionId);
  if(!session){
    session=createMatch(intent.config,intent.final);
    session.id=intent.sessionId;
    session.tournamentContext=context(t,m,intent.rulesVersionId,intent.matchStartSnapshotId);
    session=matches.insertSessionIfAbsent(session);
  }
  verifySession(session,t,m,intent);
  fail('afterSession',options);
  t=tournaments.get(tournamentId);
  intent=t.launches?.[matchId];
  const current=t.schedule.find(item=>item.id===matchId);
  if(!intent||intent.sessionId!==session.id||current.matchSessionId&&current.matchSessionId!==session.id)throw Error('Launch journal đã thay đổi trong khi liên kết.');
  current.matchSessionId=session.id;intent.phase='linked';
  if(!t.events.some(e=>e.type==='matchSessionLinked'&&e.matchId===matchId))t.events.push({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),at:new Date().toISOString(),type:'matchSessionLinked',matchId,matchSessionId:session.id});
  t.updatedAt=new Date().toISOString();tournaments.save(t);
  fail('afterLinkage',options);
  return session;
}

export function recoverTournamentLaunches(storage,tournamentId=null){
  const tournaments=createTournamentRepository(storage),matches=createMatchRepository(storage);
  const list=tournamentId?[tournaments.get(tournamentId)]:tournaments.list();
  if(list.some(t=>!t))throw Error('Không tìm thấy giải.');
  const recovered=[];
  for(const t of list)for(const m of t.schedule){
    const intent=t.launches?.[m.id],orphan=matchFor(matches,t,m);
    if(!intent&&!m.matchSessionId&&!orphan)continue;
    if(intent?.phase==='linked'){
      verifySession(matches.get(intent.sessionId),t,m,intent);
      if(orphan&&orphan.id!==intent.sessionId)throw Error('Có Match Session xung đột.');
      recovered.push(intent.sessionId);continue;
    }
    // Recovery uses an active Work Session only for authorization of a new
    // session. A persisted intent itself is already an authorized launch.
    if(intent?.phase==='prepared'){
      let session=matches.get(intent.sessionId);
      if(!session){session=createMatch(intent.config,intent.final);session.id=intent.sessionId;session.tournamentContext=context(t,m,intent.rulesVersionId,intent.matchStartSnapshotId);session=matches.insertSessionIfAbsent(session);}
      verifySession(session,t,m,intent);
      const current=tournaments.get(t.id),entry=current.schedule.find(item=>item.id===m.id);
      if(entry.matchSessionId&&entry.matchSessionId!==session.id)throw Error('Linkage xung đột.');
      entry.matchSessionId=session.id;current.launches[m.id].phase='linked';current.updatedAt=new Date().toISOString();
      if(!current.events.some(e=>e.type==='matchSessionLinked'&&e.matchId===m.id))current.events.push({id:globalThis.crypto?.randomUUID?.()||String(Date.now()),at:current.updatedAt,type:'matchSessionLinked',matchId:m.id,matchSessionId:session.id});
      tournaments.save(current);recovered.push(session.id);continue;
    }
    if(!orphan||m.matchSessionId&&m.matchSessionId!==orphan.id||!orphan.tournamentContext?.rulesVersionId)throw Error('Linkage cũ không thể phục hồi an toàn.');
    const current=tournaments.get(t.id),entry=current.schedule.find(item=>item.id===m.id);
    entry.matchSessionId=orphan.id;current.launches??={};current.launches[m.id]={phase:'linked',sessionId:orphan.id,rulesVersionId:orphan.tournamentContext.rulesVersionId,matchStartSnapshotId:orphan.tournamentContext.matchStartSnapshotId||null,config:clone(orphan.config),final:null,createdAt:orphan.createdAt};
    tournaments.save(current);recovered.push(orphan.id);
  }
  return recovered;
}

// Browser Web Locks serialize launches across tabs. If the primitive is absent,
// fail closed instead of silently claiming exactly-once across tabs.
export async function launchTournamentMatch(tournamentId,workSessionId,matchId,final,storage=localStorage){
  if(!globalThis.navigator?.locks?.request)throw Error('Trình duyệt chưa hỗ trợ khóa mở trận an toàn.');
  return navigator.locks.request('pickleball-referee:tournament-launch',()=>beginTournamentMatch(tournamentId,workSessionId,matchId,final,storage));
}
