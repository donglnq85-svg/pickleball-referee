import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addRulesVersion,addResource,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness,courtManagerView} from '../src/tournament-domain.js';
import {callPlayers,requestLoudspeaker,startWaiting,extendWaiting,markPlayersArrived,resolveNoShow,waitingElapsedSeconds,initializePreMatch,confirmAthlete,setEquipmentChecked,startWarmup,finishWarmup,skipWarmup,setPreMatchFinalSetup,createMatchStartSnapshot,stableParticipants} from '../src/tournament-operations.js';
import {beginTournamentMatch,recoverTournamentLaunches} from '../src/tournament-launch.js';
import {createTournamentRepository} from '../src/tournament-persistence.js';
import {createMatchRepository} from '../src/match-persistence.js';
import {rally} from '../src/match-engine.js';

const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),raw:map}};
const setup=(type='double',points=3,equipmentCheck='required')=>{
  const t=createTournament('Gate 3');
  const rules=addRulesVersion(t,{label:'Rules locked',authority:'Product Control',scoring:'side-out',format:{sets:1,points,rule:'touch'},procedures:{equipmentCheck}});
  const court=addResource(t,'courts','Sân 1');
  const players=type==='single'?{A:['An'],B:['Bình']}:{A:['An','Anh'],B:['Bình','Bảo']};
  const match=addScheduledMatch(t,{label:'Trận 1',courtId:court.id,type,players});
  const assignment=createAssignment(t,{label:'Ca sân 1',scopeKind:'court',scopeIds:[court.id]});
  const work=startWorkSession(t,assignment.id);setMatchReadiness(t,match.id,'ready');
  return {t,rules,court,match,work};
};
const prepare=(t,match,final={serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0},start={A:0,B:0})=>{
  markPlayersArrived(t,match.id,1000);initializePreMatch(t,match.id);
  for(const participant of stableParticipants(match)){
    confirmAthlete(t,match.id,participant.id);
    if(match.operations.preMatch.equipment.policy!=='disabled')setEquipmentChecked(t,match.id,participant.id);
  }
  skipWarmup(t,match.id,2000);setPreMatchFinalSetup(t,match.id,{start,final});
  return createMatchStartSnapshot(t,match.id,3000);
};

test('call, recall, loudspeaker and waiting clock are independent persisted operational facts',()=>{
  const db=storage(),{t,match}=setup();
  callPlayers(t,match.id,10_000);callPlayers(t,match.id,20_000);requestLoudspeaker(t,match.id,25_000);
  startWaiting(t,match.id,30_000);extendWaiting(t,match.id,120,'BTC duyệt',40_000);
  assert.deepEqual(match.operations.call.calls.map(item=>[item.kind,item.at]),[
    ['initial',new Date(10_000).toISOString()],['recall',new Date(20_000).toISOString()]
  ]);
  assert.equal(match.operations.waiting.startedAt,new Date(30_000).toISOString());
  assert.notEqual(match.operations.waiting.startedAt,match.operations.call.calls[0].at);
  assert.equal(waitingElapsedSeconds(match,95_000),65);
  createTournamentRepository(db).save(t);
  const reopened=createTournamentRepository(db).get(t.id),restored=reopened.schedule[0];
  assert.equal(waitingElapsedSeconds(restored,100_000),70);
  assert.equal(restored.operations.call.loudspeakerRequests.length,1);
  assert.equal(restored.operations.waiting.extensions[0].seconds,120);
});

test('arrival stops elapsed time; no-show resolution never creates a forfeit or Match Session',()=>{
  const db=storage(),first=setup(),second=setup('single');
  startWaiting(first.t,first.match.id,10_000);markPlayersArrived(first.t,first.match.id,40_000);
  assert.equal(waitingElapsedSeconds(first.match,90_000),30);
  startWaiting(second.t,second.match.id,10_000);resolveNoShow(second.t,second.match.id,'BTC ghi nhận vắng mặt',40_000);
  createTournamentRepository(db).save(second.t,{activeWorkSession:second.work.id});
  assert.equal(second.match.operations.waiting.resolution.automaticForfeit,false);
  assert.equal(second.match.matchSessionId,null);
  assert.equal(createMatchRepository(db).load().activeId,null);
});

test('Doubles pre-match preserves A1/A2/B1/B2 and required equipment gates immutable snapshot',()=>{
  const {t,match,rules}=setup('double');markPlayersArrived(t,match.id);const pre=initializePreMatch(t,match.id);
  assert.deepEqual(pre.participants.map(p=>p.id),['A1','A2','B1','B2']);
  for(const participant of pre.participants)confirmAthlete(t,match.id,participant.id);
  skipWarmup(t,match.id);setPreMatchFinalSetup(t,match.id,{start:{A:2,B:1},final:{serving:'B',courtLeft:'A',right:{A:1,B:0},serverIndex:0}});
  assert.throws(()=>createMatchStartSnapshot(t,match.id),/kiểm tra dụng cụ/);
  for(const participant of pre.participants)setEquipmentChecked(t,match.id,participant.id);
  const snapshot=createMatchStartSnapshot(t,match.id,50_000);
  assert.equal(snapshot.rulesVersionId,rules.id);assert.deepEqual(snapshot.config.start,{A:2,B:1});
  match.operations.preMatch.confirmations.A1='unknown';
  assert.deepEqual(createMatchStartSnapshot(t,match.id),snapshot);
});

test('Singles uses true two-athlete identity and supports a real warm-up transition',()=>{
  const {t,match}=setup('single',3,'disabled');markPlayersArrived(t,match.id);const pre=initializePreMatch(t,match.id);
  assert.deepEqual(pre.participants.map(p=>p.id),['A1','B1']);
  confirmAthlete(t,match.id,'A1');confirmAthlete(t,match.id,'B1');
  startWarmup(t,match.id,60,10_000);finishWarmup(t,match.id,30_000);
  setPreMatchFinalSetup(t,match.id,{start:{A:0,B:0},final:{serving:'A',courtLeft:'B'}});
  const snapshot=createMatchStartSnapshot(t,match.id,40_000);
  assert.equal(snapshot.config.type,'single');assert.equal(snapshot.participants.length,2);
  assert.deepEqual(snapshot.config.players,{A:['An'],B:['Bình']});
});

test('recovery after session persistence launches frozen snapshot once and Court Manager projects it',()=>{
  const db=storage(),{t,match,work,rules}=setup('double');const snapshot=prepare(t,match,undefined,{A:1,B:0});
  addRulesVersion(t,{label:'Rules future',authority:'BTC',scoring:'side-out',format:{sets:3,points:11,rule:'touch'},procedures:{equipmentCheck:'optional'}});
  const tournamentRepo=createTournamentRepository(db);tournamentRepo.save(t,{activeWorkSession:work.id});
  assert.throws(()=>beginTournamentMatch(t.id,work.id,match.id,null,db,{afterStage:stage=>{if(stage==='afterSession')throw Error('crash')}}),/crash/);
  assert.equal(Object.keys(createMatchRepository(db).load().matches).length,1);
  recoverTournamentLaunches(db,t.id);
  const reopened=tournamentRepo.get(t.id),session=beginTournamentMatch(t.id,work.id,match.id,null,db);
  assert.equal(Object.keys(createMatchRepository(db).load().matches).length,1);
  assert.equal(session.tournamentContext.rulesVersionId,rules.id);
  assert.equal(session.tournamentContext.matchStartSnapshotId,snapshot.id);
  assert.deepEqual(session.config.start,{A:1,B:0});assert.equal(session.config.sets,1);assert.equal(session.config.points,3);
  assert.equal(courtManagerView(reopened,work.id,createMatchRepository(db)).matches[0].progress,'playing');
});

test('Court Manager → Pre-Match → Gate 1 → reload → Result → Court Manager keeps one linked session',()=>{
  const db=storage(),{t,match,work}=setup('single',1,'disabled');
  callPlayers(t,match.id,10_000);startWaiting(t,match.id,20_000);prepare(t,match,{serving:'A',courtLeft:'A'});
  const tournaments=createTournamentRepository(db);tournaments.save(t,{activeWorkSession:work.id});
  let session=beginTournamentMatch(t.id,work.id,match.id,null,db);rally(session,'A');createMatchRepository(db).saveSession(session);
  session=createMatchRepository(db).get(session.id);
  assert.equal(session.status,'finished');assert.equal(session.tournamentContext.scheduledMatchId,match.id);
  assert.equal(recoverTournamentLaunches(db,t.id).length,1);
  const reopened=tournaments.get(t.id),view=courtManagerView(reopened,work.id,createMatchRepository(db));
  assert.equal(view.matches[0].progress,'finished');assert.equal(view.progress.finished,1);
  assert.equal(beginTournamentMatch(t.id,work.id,match.id,null,db).id,session.id);
  assert.equal(Object.keys(createMatchRepository(db).load().matches).length,1);
});
