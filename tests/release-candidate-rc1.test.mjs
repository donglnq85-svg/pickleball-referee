import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addRulesVersion,addResource,addPlayer,addEntry,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness} from '../src/tournament-domain.js';
import {callPlayers,requestLoudspeaker,startWaiting,extendWaiting,markPlayersArrived,initializePreMatch,confirmAthlete,skipWarmup,setPreMatchFinalSetup,createMatchStartSnapshot} from '../src/tournament-operations.js';
import {beginTournamentMatch,recoverTournamentLaunches} from '../src/tournament-launch.js';
import {createTournamentRepository,TOURNAMENT_STORE_KEY} from '../src/tournament-persistence.js';
import {createMatchRepository,STORE_KEY as MATCH_STORE_KEY} from '../src/match-persistence.js';
import {createMatch,rally,undo,redo,nextGame,prepareNextGame,resolveFinal,matchView,setCourtLeft,startPause,endPause} from '../src/match-engine.js';
import {addRankingRulesVersion,deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,currentResult,calculateGroupSnapshot,assessGroupCompletion} from '../src/tournament-results.js';
import {deriveMatchReport,deriveGroupReport,markReportShared,markReportSent,currentMatchReport,currentGroupReport} from '../src/tournament-reporting.js';
import {createHandoverSnapshot,completeWorkSession,currentShiftCompletion} from '../src/tournament-shift.js';
import {projectHistory,searchHistory} from '../src/history-read-model.js';

function faultStorage(){
  const values=new Map();let armed=null;
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>{if(armed===key){armed=null;throw Error(`injected ${key}`)}values.set(key,value)},arm:key=>{armed=key},raw:key=>values.get(key)??null};
}
const scorePoint=(state,team)=>{while(state.status==='playing'&&state.serving!==team)rally(state,team);if(state.status==='playing')rally(state,team)};
function assertDiagonal(state,label='state'){
  const view=matchView(state),server=view.participants.find(item=>item.server),receiver=view.participants.find(item=>item.receiver);
  assert.ok(server&&receiver,label);assert.equal(server.team,state.serving,label);assert.notEqual(server.team,receiver.team,label);
  assert.equal(server.lane,receiver.lane,label);assert.notEqual(server.end,receiver.end,label);assert.notEqual(server.top,receiver.top,label);
}
function addEntrant(t,type,names){const ids=names.map(displayName=>addPlayer(t,{displayName}).id);return addEntry(t,{type,playerIds:ids})}
function prepare(t,match,rulesVersionId,{waiting=false}={}){
  t.activeRulesVersionId=rulesVersionId;setMatchReadiness(t,match.id,'ready');callPlayers(t,match.id);
  if(waiting){requestLoudspeaker(t,match.id);startWaiting(t,match.id);extendWaiting(t,match.id,30,'BTC extension')}
  markPlayersArrived(t,match.id);const pre=initializePreMatch(t,match.id);for(const participant of pre.participants)confirmAthlete(t,match.id,participant.id);skipWarmup(t,match.id);
  const final={serving:'A',courtLeft:'A'};if(match.type==='double')Object.assign(final,{right:{A:0,B:0},serverIndex:0});
  setPreMatchFinalSetup(t,match.id,{start:{A:0,B:0},final});return createMatchStartSnapshot(t,match.id);
}
function finishSession(session){
  scorePoint(session,'A');
  while(session.status==='gameEnd'){
    nextGame(session,resolveFinal(session.config,prepareNextGame(session)));
    const winner=session.game===2?'B':'A';scorePoint(session,winner);
  }
  if(session.status!=='finished')scorePoint(session,'A');
  return session;
}

test('RC1 persistence boundary retries are idempotent from rally save through Shift Completion',()=>{
  const db=faultStorage(),tournaments=createTournamentRepository(db),matches=createMatchRepository(db),t=createTournament('RC1 boundaries');
  const rules=addRulesVersion(t,{label:'BO3 one point',authority:'RC1',scoring:'side-out',format:{sets:3,points:1,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'required',group:'optional'}}});
  const ranking=addRankingRulesVersion(t,{label:'Ranking',authority:'RC1',criteria:[{metric:'matchWins',direction:'desc'}],qualification:{kind:'top',count:1}}),court=addResource(t,'courts','Court'),group=addResource(t,'groups','Group');
  const a=addEntrant(t,'single',['A']),b=addEntrant(t,'single',['B']),scheduled=addScheduledMatch(t,{label:'Boundary match',courtId:court.id,groupId:group.id,type:'single',entrantIds:{A:a.id,B:b.id}}),assignment=createAssignment(t,{label:'Boundary shift',scopeKind:'group',scopeIds:[group.id]}),work=startWorkSession(t,assignment.id);
  prepare(t,scheduled,rules.id);tournaments.save(t,{activeWorkSession:work.id});

  // Launch journal recovers a crash after Match Store persistence.
  assert.throws(()=>beginTournamentMatch(t.id,work.id,scheduled.id,null,db,{afterStage:stage=>{if(stage==='afterSession')throw Error('launch crash')}}),/launch crash/);
  recoverTournamentLaunches(db,t.id);let savedTournament=tournaments.get(t.id),session=matches.get(savedTournament.schedule[0].matchSessionId);
  assert.equal(Object.keys(matches.load().matches).length,1);

  // A failed rally write leaves the durable state unchanged; retry records one transition.
  rally(session,'A');db.arm(MATCH_STORE_KEY);assert.throws(()=>matches.saveSession(session),/injected/);
  session=matches.get(session.id);assert.deepEqual(session.currentGamePoints,{A:0,B:0});rally(session,'A');matches.saveSession(session);
  assert.equal(matches.get(session.id).events.filter(event=>event.type==='rally').length,1);

  // A failed game-transition write recovers the gameEnd state and retries once.
  session=matches.get(session.id);assert.equal(session.status,'gameEnd');nextGame(session,resolveFinal(session.config,prepareNextGame(session)));
  db.arm(MATCH_STORE_KEY);assert.throws(()=>matches.saveSession(session),/injected/);session=matches.get(session.id);assert.equal(session.status,'gameEnd');
  nextGame(session,resolveFinal(session.config,prepareNextGame(session)));matches.saveSession(session);assert.equal(matches.get(session.id).events.filter(event=>event.type==='nextGame').length,1);
  scorePoint(session,'B');nextGame(session,resolveFinal(session.config,prepareNextGame(session)));scorePoint(session,'A');matches.saveSession(session);assert.equal(session.status,'finished');

  // Match End → result derivation and confirmation both retry without duplicate versions/events.
  savedTournament=tournaments.get(t.id);deriveCanonicalResult(savedTournament,session,10_000);db.arm(TOURNAMENT_STORE_KEY);assert.throws(()=>tournaments.save(savedTournament),/injected/);
  savedTournament=tournaments.get(t.id);assert.equal(currentResult(savedTournament,scheduled.id),null);let result=deriveCanonicalResult(savedTournament,session,11_000);tournaments.save(savedTournament);
  savedTournament=tournaments.get(t.id);confirmCanonicalResult(savedTournament,scheduled.id,result.id,12_000);db.arm(TOURNAMENT_STORE_KEY);assert.throws(()=>tournaments.save(savedTournament),/injected/);
  savedTournament=tournaments.get(t.id);result=currentResult(savedTournament,scheduled.id);assert.equal(result.status,'PENDING_CONFIRMATION');confirmCanonicalResult(savedTournament,scheduled.id,result.id,13_000);tournaments.save(savedTournament);
  savedTournament=tournaments.get(t.id);assert.equal(savedTournament.resultLedger.byMatch[scheduled.id].versions.length,1);assert.equal(savedTournament.events.filter(event=>event.type==='canonicalResultConfirmed').length,1);

  // Snapshot, completion, report generation and sent confirmation recover each write boundary.
  calculateGroupSnapshot(savedTournament,group.id,ranking.id,14_000);db.arm(TOURNAMENT_STORE_KEY);assert.throws(()=>tournaments.save(savedTournament),/injected/);
  savedTournament=tournaments.get(t.id);let snapshot=calculateGroupSnapshot(savedTournament,group.id,ranking.id,15_000);let completion=assessGroupCompletion(savedTournament,group.id,16_000);tournaments.save(savedTournament);
  savedTournament=tournaments.get(t.id);assert.equal(calculateGroupSnapshot(savedTournament,group.id,ranking.id,17_000).id,snapshot.id);assert.equal(assessGroupCompletion(savedTournament,group.id,18_000).id,completion.id);assert.equal(savedTournament.groupSnapshots.length,1);assert.equal(savedTournament.groupCompletions.length,1);
  deriveMatchReport(savedTournament,scheduled.id,result.id,rules.id,19_000);db.arm(TOURNAMENT_STORE_KEY);assert.throws(()=>tournaments.save(savedTournament),/injected/);
  savedTournament=tournaments.get(t.id);let report=deriveMatchReport(savedTournament,scheduled.id,result.id,rules.id,20_000);tournaments.save(savedTournament);savedTournament=tournaments.get(t.id);
  assert.equal(deriveMatchReport(savedTournament,scheduled.id,result.id,rules.id,21_000).id,report.id);markReportShared(savedTournament,report.id,22_000);markReportShared(savedTournament,report.id,23_000);assert.equal(savedTournament.events.filter(event=>event.type==='reportShareSheetOpened').length,1);
  markReportSent(savedTournament,report.id,24_000);db.arm(TOURNAMENT_STORE_KEY);assert.throws(()=>tournaments.save(savedTournament),/injected/);savedTournament=tournaments.get(t.id);assert.equal(currentMatchReport(savedTournament,scheduled.id).status,'GENERATED');
  markReportSent(savedTournament,report.id,25_000);tournaments.save(savedTournament);savedTournament=tournaments.get(t.id);markReportSent(savedTournament,report.id,26_000);assert.equal(savedTournament.events.filter(event=>event.type==='reportSent').length,1);

  // End Shift retry creates exactly one immutable business event.
  completeWorkSession(savedTournament,work.id,matches,{at:27_000});db.arm(TOURNAMENT_STORE_KEY);assert.throws(()=>tournaments.save(savedTournament,{activeWorkSession:null}),/injected/);
  savedTournament=tournaments.get(t.id);assert.equal(currentShiftCompletion(savedTournament,work.id),null);const shift=completeWorkSession(savedTournament,work.id,matches,{at:28_000});tournaments.save(savedTournament,{activeWorkSession:null});
  savedTournament=tournaments.get(t.id);assert.equal(completeWorkSession(savedTournament,work.id,matches).id,shift.id);assert.equal(savedTournament.shiftCompletions.length,1);assert.equal(savedTournament.events.filter(event=>event.type==='shiftCompleted').length,1);
});

test('RC1 Match State stress preserves diagonal, server sequence, Undo/Redo and reload for Singles and Doubles',()=>{
  for(const type of ['single','double']){
    const db=faultStorage(),config={type,sets:3,points:99,rule:'touch',cap:99,start:{A:3,B:2},players:type==='single'?{A:['A1'],B:['B1']}:{A:['A1','A2'],B:['B1','B2']}},final=type==='single'?{serving:'A',courtLeft:'A'}:{serving:'A',courtLeft:'A',right:{A:0,B:1},serverIndex:0};
    let state=createMatch(config,resolveFinal(config,final));
    for(let index=0;index<320;index++){
      rally(state,['A','A','B','B','A','B'][index%6]);assertDiagonal(state,`${type}:${index}`);
      if(index%9===0){const before=structuredClone(matchView(state));undo(state);assertDiagonal(state,`${type}:undo:${index}`);redo(state);assert.deepEqual(matchView(state),before)}
      if(index%17===0){setCourtLeft(state,state.courtLeft==='A'?'B':'A');assertDiagonal(state,`${type}:end:${index}`)}
      if(index%29===0){startPause(state,'timeout',index%2?'A':'B');assertDiagonal(state,`${type}:pause:${index}`);endPause(state)}
      if(index%13===0){createMatchRepository(db).saveSession(state);state=createMatchRepository(db).active();assertDiagonal(state,`${type}:reload:${index}`)}
    }
    assert.deepEqual(state.gamesWon,{A:0,B:0});assert.deepEqual(state.completedGames,[]);assert.ok(state.events.length>350);
  }
});

test('RC1 long tournament day spans two groups, two assignments, mixed formats, resend, handover and History',()=>{
  const db=faultStorage(),tournaments=createTournamentRepository(db),matches=createMatchRepository(db),t=createTournament('RC1 Long Day');
  const bo1=addRulesVersion(t,{label:'BO1',authority:'RC1',scoring:'side-out',format:{sets:1,points:1,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'required',group:'required'}}});
  const bo3=addRulesVersion(t,{label:'BO3',authority:'RC1',scoring:'side-out',format:{sets:3,points:1,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'required',group:'required'}}});
  const ranking=addRankingRulesVersion(t,{label:'Long-day ranking',authority:'RC1',criteria:[{metric:'matchWins',direction:'desc'},{metric:'gameDifferential',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'top',count:1}}),court=addResource(t,'courts','Center Court'),groupA=addResource(t,'groups','Group A'),groupB=addResource(t,'groups','Group B');
  const singles=[0,1,2,3].map(i=>addEntrant(t,'single',[`S${i}`])),pairs=[0,1,2,3].map(i=>addEntrant(t,'double',[`D${i}a`,`D${i}b`]));
  const scheduled=[
    addScheduledMatch(t,{label:'A-S-BO1',courtId:court.id,groupId:groupA.id,type:'single',entrantIds:{A:singles[0].id,B:singles[1].id}}),
    addScheduledMatch(t,{label:'A-D-BO3',courtId:court.id,groupId:groupA.id,type:'double',entrantIds:{A:pairs[0].id,B:pairs[1].id}}),
    addScheduledMatch(t,{label:'B-S-BO3',courtId:court.id,groupId:groupB.id,type:'single',entrantIds:{A:singles[2].id,B:singles[3].id}}),
    addScheduledMatch(t,{label:'B-D-BO1',courtId:court.id,groupId:groupB.id,type:'double',entrantIds:{A:pairs[2].id,B:pairs[3].id}}),
    addScheduledMatch(t,{label:'B-No-show',courtId:court.id,groupId:groupB.id,type:'single',entrantIds:{A:singles[0].id,B:singles[2].id}}),
  ];
  const assignmentA=createAssignment(t,{label:'Assignment A',scopeKind:'group',scopeIds:[groupA.id]}),assignmentB=createAssignment(t,{label:'Assignment B',scopeKind:'group',scopeIds:[groupB.id]}),workA=startWorkSession(t,assignmentA.id);tournaments.save(t,{activeWorkSession:workA.id});
  function run(match,rules,waiting=false){let current=tournaments.get(t.id);prepare(current,current.schedule.find(item=>item.id===match.id),rules.id,{waiting});tournaments.save(current);let session=beginTournamentMatch(t.id,current.workSessions.find(item=>item.status==='active').id,match.id,null,db);assertDiagonal(session);startPause(session,'timeout','A');matches.saveSession(session);session=matches.get(session.id);endPause(session);startPause(session,'medical','B',0);endPause(session);rally(session,'B');undo(session);redo(session);finishSession(session);matches.saveSession(session);current=tournaments.get(t.id);const result=deriveCanonicalResult(current,session);confirmCanonicalResult(current,match.id,result.id);const report=deriveMatchReport(current,match.id,result.id,rules.id);markReportSent(current,report.id);tournaments.save(current);return {session,result,report}}
  run(scheduled[0],bo1,true);run(scheduled[1],bo3);
  let current=tournaments.get(t.id),snapA=calculateGroupSnapshot(current,groupA.id,ranking.id),doneA=assessGroupCompletion(current,groupA.id),groupReportA=deriveGroupReport(current,groupA.id,snapA.id,bo3.id);markReportSent(current,groupReportA.id);
  const first=currentResult(current,scheduled[0].id),corrected=correctCanonicalResult(current,scheduled[0].id,{completedGames:[{points:{A:2,B:0}}],reason:'RC1 official correction'});confirmCanonicalResult(current,scheduled[0].id,corrected.id);const resend=deriveMatchReport(current,scheduled[0].id,corrected.id,bo1.id);assert.equal(resend.status,'NEEDS_RESEND');markReportSent(current,resend.id);snapA=calculateGroupSnapshot(current,groupA.id,ranking.id);doneA=assessGroupCompletion(current,groupA.id);groupReportA=deriveGroupReport(current,groupA.id,snapA.id,bo3.id);assert.equal(groupReportA.status,'NEEDS_RESEND');markReportSent(current,groupReportA.id);assert.notEqual(first.id,corrected.id);
  completeWorkSession(current,workA.id,matches);tournaments.save(current,{activeWorkSession:null});current=tournaments.get(t.id);const workB=startWorkSession(current,assignmentB.id);tournaments.save(current,{activeWorkSession:workB.id});
  run(scheduled[2],bo3,true);run(scheduled[3],bo1);current=tournaments.get(t.id);callPlayers(current,scheduled[4].id);requestLoudspeaker(current,scheduled[4].id);startWaiting(current,scheduled[4].id);tournaments.save(current);
  current=tournaments.get(t.id);const snapB=calculateGroupSnapshot(current,groupB.id,ranking.id);assessGroupCompletion(current,groupB.id);const groupReportB=deriveGroupReport(current,groupB.id,snapB.id,bo3.id);markReportSent(current,groupReportB.id);const handover=createHandoverSnapshot(current,workB.id,matches,{recipientName:'Referee next shift',context:'No-show unresolved'});assert.ok(handover.outstanding.some(item=>item.kind==='UNRESOLVED_WAITING'));completeWorkSession(current,workB.id,matches);tournaments.save(current,{activeWorkSession:null});

  const started=performance.now(),history=projectHistory(matches,tournaments),elapsed=performance.now()-started;
  assert.equal(history.tournaments.length,1);assert.equal(history.workSessions.length,2);assert.equal(history.matches.length,4);assert.equal(searchHistory(history,{query:'RC1 Long Day'}).length>=1,true);assert.ok(elapsed<2_000,`history projection ${elapsed}ms`);
  assert.equal(Object.keys(matches.load().matches).length,4);assert.equal(tournaments.get(t.id).shiftCompletions.length,2);assert.equal(tournaments.get(t.id).handovers.length,1);assert.equal(doneA.status,'READY');
  assert.equal(currentMatchReport(tournaments.get(t.id),scheduled[0].id).status,'SENT');assert.equal(currentGroupReport(tournaments.get(t.id),groupA.id).status,'SENT');
});

test('RC1 corrupt and partial persisted state fails closed without rewriting bytes',()=>{
  for(const [key,value,operation] of [
    [MATCH_STORE_KEY,'{"version":2,"activeId":"missing","matches":{}}',storage=>createMatchRepository(storage).load()],
    [TOURNAMENT_STORE_KEY,'{"version":2,"activeWorkSession":null,"tournaments":{"bad":{}}}',storage=>createTournamentRepository(storage).load()],
  ]){
    const db=faultStorage();db.setItem(key,value);assert.throws(()=>operation(db));assert.equal(db.raw(key),value);
  }
});
