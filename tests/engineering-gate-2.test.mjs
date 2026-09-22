import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addRulesVersion,addResource,addScheduledMatch,createAssignment,startWorkSession,finishWorkSession,setMatchReadiness,assignmentMatches,courtManagerView} from '../src/tournament-domain.js';
import {beginTournamentMatch,recoverTournamentLaunches} from '../src/tournament-launch.js';
import {createTournamentRepository,TOURNAMENT_STORE_KEY} from '../src/tournament-persistence.js';
import {createMatchRepository} from '../src/match-persistence.js';
import {matchView,rally} from '../src/match-engine.js';

const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),raw:map}};
const setup=()=>{
  const t=createTournament('Giải thử nghiệm');
  addRulesVersion(t,{label:'Phiên bản áp dụng',authority:'USA Pickleball 2026',scoring:'side-out',format:{sets:3,points:11,rule:'touch'}});
  const c1=addResource(t,'courts','Sân Trung tâm'),c2=addResource(t,'courts','Sân phụ');
  const g1=addResource(t,'groups','Bảng X'),g2=addResource(t,'groups','Bảng Y');
  const m1=addScheduledMatch(t,{label:'Trận mở màn',courtId:c1.id,groupId:g1.id,type:'double',players:{A:['An','Bình'],B:['Chi','Dung']}});
  const m2=addScheduledMatch(t,{label:'Trận tiếp',courtId:c2.id,groupId:g1.id});
  const m3=addScheduledMatch(t,{label:'Trận chưa xếp sân',groupId:g2.id});
  return {t,c1,c2,g1,g2,m1,m2,m3};
};

test('unknown is valid; structure, schedule and referee assignment have independent identities',()=>{
  const {t,c1,g1,m1,m2,m3}=setup();
  const court=createAssignment(t,{label:'Trọng tài sân',scopeKind:'court',scopeIds:[c1.id]});
  const group=createAssignment(t,{label:'Trọng tài bảng',scopeKind:'group',scopeIds:[g1.id]});
  const match=createAssignment(t,{label:'Trọng tài trận',scopeKind:'match',scopeIds:[m3.id]});
  assert.deepEqual(assignmentMatches(t,court.id).map(m=>m.id),[m1.id]);
  assert.deepEqual(assignmentMatches(t,group.id).map(m=>m.id),[m1.id,m2.id]);
  assert.deepEqual(assignmentMatches(t,match.id).map(m=>m.id),[m3.id]);
  assert.equal(m3.courtId,null);assert.equal(m3.type,'unknown');assert.equal(m3.players,null);assert.equal(m3.readiness,'unknown');
  assert.notEqual(t.structure.groups[0].id,group.id);
  assert.notEqual(t.schedule[0].id,match.id);
});

test('Work Session transitions and Court Manager progress persist across repository reopening',()=>{
  const db=storage(),repo=createTournamentRepository(db),{t,c1,m1,m2}=setup();
  const a=createAssignment(t,{label:'Sân chính',scopeKind:'court',scopeIds:[c1.id]});
  repo.save(t);assert.equal(repo.load().activeWorkSession,null);
  let reopened=createTournamentRepository(db).get(t.id);
  const s=startWorkSession(reopened,a.id);repo.save(reopened,{activeWorkSession:s.id});
  reopened=createTournamentRepository(db).get(t.id);
  assert.equal(createTournamentRepository(db).load().activeWorkSession.workSessionId,s.id);
  let view=courtManagerView(reopened,s.id);
  assert.equal(view.progress.total,1);assert.equal(view.progress.unknown,1);assert.equal(view.matches[0].id,m1.id);
  assert.ok(!view.matches.some(m=>m.id===m2.id));
  setMatchReadiness(reopened,m1.id,'blocked','Thiếu VĐV');repo.save(reopened);
  view=courtManagerView(createTournamentRepository(db).get(t.id),s.id);
  assert.equal(view.progress.blocked,1);assert.equal(view.matches[0].blockedReason,'Thiếu VĐV');
  reopened=createTournamentRepository(db).get(t.id);setMatchReadiness(reopened,m1.id,'ready');repo.save(reopened);
  assert.equal(courtManagerView(createTournamentRepository(db).get(t.id),s.id).progress.ready,1);
  finishWorkSession(reopened,s.id);repo.save(reopened,{activeWorkSession:null});
  assert.equal(createTournamentRepository(db).load().activeWorkSession,null);
  assert.throws(()=>startWorkSession(reopened,a.id),/nhiệm vụ khác/);
});

test('only one active Work Session per referee; a second assignment cannot orphan resume',()=>{
  const db=storage(),repo=createTournamentRepository(db),{t,c1,g1}=setup();
  const court=createAssignment(t,{label:'Sân',scopeKind:'court',scopeIds:[c1.id]});
  const group=createAssignment(t,{label:'Bảng',scopeKind:'group',scopeIds:[g1.id]});
  const work=startWorkSession(t,court.id);repo.save(t,{activeWorkSession:work.id});
  assert.throws(()=>startWorkSession(t,group.id),/Đang có nhiệm vụ/);
  assert.throws(()=>repo.save(t,{activeWorkSession:null}),/Kết thúc nhiệm vụ/);
  assert.equal(repo.load().activeWorkSession.workSessionId,work.id);
  const other=createTournament('Giải khác'),otherMatch=addScheduledMatch(other,{label:'Trận'});
  const a=createAssignment(other,{label:'Trận',scopeKind:'match',scopeIds:[otherMatch.id]});
  const competing=startWorkSession(other,a.id);
  assert.throws(()=>repo.save(other,{activeWorkSession:competing.id}),/Kết thúc nhiệm vụ/);
  assert.equal(repo.load().activeWorkSession.workSessionId,work.id);
});

test('Rules Version is explicit and versioned; incomplete facts never launch a match',()=>{
  const db=storage(),{t,c1,m1,m3}=setup();
  const a=createAssignment(t,{label:'Trận',scopeKind:'match',scopeIds:[m3.id]});const s=startWorkSession(t,a.id);
  const tournamentRepo=createTournamentRepository(db);tournamentRepo.save(t,{activeWorkSession:s.id});
  assert.throws(()=>beginTournamentMatch(t.id,s.id,m3.id,{serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0},db),/chưa đủ/);
  assert.throws(()=>createAssignment(t,{label:'Sai',scopeKind:'court',scopeIds:[m1.id]}),/Không tìm thấy/);
  assert.throws(()=>addScheduledMatch(t,{label:'Sai sân',courtId:'missing'}),/Không tìm thấy/);
  assert.throws(()=>setMatchReadiness(t,m3.id,'blocked',''),/không được để trống/);
  const v=addRulesVersion(t,{label:'Đang chờ xác định',authority:'Ban tổ chức',scoring:'unknown',format:null});
  assert.equal(t.activeRulesVersionId,v.id);assert.equal(t.rulesVersions.length,2);
  assert.equal(t.rulesVersions[0].scoring,'side-out');
  const future=addRulesVersion(t,{label:'Phiên bản tương lai',authority:'Ban tổ chức',scoring:'future-scoring',format:{sets:7,points:25,rule:'future-format'}});
  assert.equal(future.format.sets,7);
  setMatchReadiness(t,m3.id,'ready');
  tournamentRepo.save(t);
  assert.throws(()=>beginTournamentMatch(t.id,s.id,m3.id,{serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0},db),/chưa đủ/);
  const m1Assignment=createAssignment(t,{label:'Trận khác',scopeKind:'match',scopeIds:[m1.id]});
  finishWorkSession(t,s.id);
  const next=startWorkSession(t,m1Assignment.id);setMatchReadiness(t,m1.id,'ready');
  tournamentRepo.save(t,{activeWorkSession:null});tournamentRepo.save(t,{activeWorkSession:next.id});
  assert.throws(()=>beginTournamentMatch(t.id,next.id,m1.id,{serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0},db),/chưa đủ/);
  assert.equal(t.structure.courts.find(c=>c.id===c1.id).label,'Sân Trung tâm');
});

test('Tournament match delegates to the one Gate #1 engine and projects progress from its repository',()=>{
  const db=storage(),{t,m1}=setup(),a=createAssignment(t,{label:'Trọng tài trận',scopeKind:'match',scopeIds:[m1.id]}),w=startWorkSession(t,a.id);
  setMatchReadiness(t,m1.id,'ready');
  const tournamentRepo=createTournamentRepository(db);tournamentRepo.save(t,{activeWorkSession:w.id});
  const final={serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0};
  const session=beginTournamentMatch(t.id,w.id,m1.id,final,db);
  assert.equal(session.tournamentContext.scheduledMatchId,m1.id);
  assert.equal(matchView(session).scoreCall,'0 – 0 – 2');
  rally(session,'B');createMatchRepository(db).saveSession(session);
  assert.equal(matchView(createMatchRepository(db).get(session.id)).scoreCall,'0 – 0 – 1');
  assert.equal(courtManagerView(tournamentRepo.get(t.id),w.id,createMatchRepository(db)).matches[0].progress,'playing');
  assert.equal(beginTournamentMatch(t.id,w.id,m1.id,final,db).id,session.id);
  assert.equal(recoverTournamentLaunches(db,t.id).length,1);
});

test('corrupt or unsupported Tournament document is refused without overwriting stored bytes',()=>{
  const db=storage(),repo=createTournamentRepository(db),t=createTournament('Không mất dữ liệu');repo.save(t);
  const old=db.getItem(TOURNAMENT_STORE_KEY);db.setItem(TOURNAMENT_STORE_KEY,'{broken');
  assert.throws(()=>repo.save(t),/bị hỏng/);assert.equal(db.getItem(TOURNAMENT_STORE_KEY),'{broken');
  db.setItem(TOURNAMENT_STORE_KEY,JSON.stringify({...JSON.parse(old),version:2}));
  assert.throws(()=>repo.load(),/chưa được hỗ trợ/);
});
