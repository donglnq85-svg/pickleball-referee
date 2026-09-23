import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addRulesVersion,addResource,addPlayer,addEntry,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness,courtManagerView,matchPlayers} from '../src/tournament-domain.js';
import {callPlayers,startWaiting,extendWaiting,markPlayersArrived,resolveNoShow,waitingElapsedSeconds,initializePreMatch,confirmAthlete,skipWarmup,setPreMatchFinalSetup,createMatchStartSnapshot} from '../src/tournament-operations.js';
import {beginTournamentMatch,recoverTournamentLaunches} from '../src/tournament-launch.js';
import {createTournamentRepository} from '../src/tournament-persistence.js';
import {createMatchRepository} from '../src/match-persistence.js';
import {rally,nextGame,prepareNextGame,resolveFinal} from '../src/match-engine.js';
import {addRankingRulesVersion,deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,currentResult,calculateGroupSnapshot,assessGroupCompletion} from '../src/tournament-results.js';
import {deriveMatchReport,deriveGroupReport,markReportShared,markReportSent,currentMatchReport,currentGroupReport,reportingAttention} from '../src/tournament-reporting.js';
import {resolveApplicationResume} from '../src/application-resume.js';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
function scorePoints(state,team,count){for(let i=0;i<count;i++){if(state.serving!==team)rally(state,team);rally(state,team)}}
function playGame(state,points){const winner=points.A>points.B?'A':'B',loser=winner==='A'?'B':'A';scorePoints(state,loser,points[loser]);scorePoints(state,winner,points[winner])}
function continueGame(state){nextGame(state,resolveFinal(state.config,prepareNextGame(state)))}
function setup(){
  const t=createTournament('Gate 6 integrity'),rules=addRulesVersion(t,{label:'BO3',authority:'Product Control',scoring:'side-out',format:{sets:3,points:11,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'required',group:'required'}}});
  const court=addResource(t,'courts','Sân 1'),groupA=addResource(t,'groups','Bảng A'),groupB=addResource(t,'groups','Bảng B'),entries={};
  for(const name of ['Alpha','Beta','Gamma','Delta']){const player=addPlayer(t,{displayName:name});entries[name]=addEntry(t,{type:'single',playerIds:[player.id]})}
  const match1=addScheduledMatch(t,{label:'A1',groupId:groupA.id,courtId:court.id,type:'single',entrantIds:{A:entries.Alpha.id,B:entries.Beta.id}});
  const match2=addScheduledMatch(t,{label:'A2',groupId:groupA.id,courtId:court.id,type:'single',entrantIds:{A:entries.Alpha.id,B:entries.Beta.id}});
  const noShow=addScheduledMatch(t,{label:'B1 no-show',groupId:groupB.id,courtId:court.id,type:'single',entrantIds:{A:entries.Gamma.id,B:entries.Delta.id}});
  const assignment=createAssignment(t,{label:'Sân 1',scopeKind:'court',scopeIds:[court.id]}),work=startWorkSession(t,assignment.id);
  const ranking=addRankingRulesVersion(t,{label:'Frozen ranking',authority:'Product Control',criteria:[{metric:'matchWins',direction:'desc'},{metric:'gameDifferential',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'top',count:1}});
  return {t,rules,court,groupA,groupB,match1,match2,noShow,work,ranking};
}
function readyPreMatch(t,match){
  setMatchReadiness(t,match.id,'ready');markPlayersArrived(t,match.id);const pre=initializePreMatch(t,match.id);
  for(const participant of pre.participants)confirmAthlete(t,match.id,participant.id);skipWarmup(t,match.id);
  setPreMatchFinalSetup(t,match.id,{start:{A:0,B:0},final:{serving:'A',courtLeft:'A'}});return createMatchStartSnapshot(t,match.id);
}

test('Gate 6 tournament integrity simulation crosses M02→M10 with recovery, no-show, readiness, correction and resend',()=>{
  const db=storage(),tournaments=createTournamentRepository(db),matches=createMatchRepository(db);let {t,rules,groupA,match1,match2,noShow,work,ranking}=setup();

  // A separate no-show clock is durable while the referee handles Group A.
  callPlayers(t,noShow.id,1_000);startWaiting(t,noShow.id,2_000);extendWaiting(t,noShow.id,60,'BTC cho thêm thời gian',3_000);
  setMatchReadiness(t,match2.id,'blocked','Đang trong thời gian nghỉ giữa hai trận');
  callPlayers(t,match1.id,4_000);startWaiting(t,match1.id,5_000);readyPreMatch(t,match1);
  tournaments.save(t,{activeWorkSession:work.id});
  t=tournaments.get(t.id);assert.equal(t.schedule.find(item=>item.id===match2.id).blockedReason,'Đang trong thời gian nghỉ giữa hai trận');assert.equal(waitingElapsedSeconds(t.schedule.find(item=>item.id===noShow.id),12_000),10);

  // Simulate a crash after Gate #1 Match Store persistence but before Tournament linkage.
  assert.throws(()=>beginTournamentMatch(t.id,work.id,match1.id,null,db,{afterStage:stage=>{if(stage==='afterSession')throw Error('simulated crash')}}),/simulated crash/);
  assert.equal(Object.keys(matches.load().matches).length,1);recoverTournamentLaunches(db,t.id);t=tournaments.get(t.id);
  let session=matches.get(t.schedule.find(item=>item.id===match1.id).matchSessionId);assert.equal(session.tournamentContext.rulesVersionId,rules.id);assert.equal(resolveApplicationResume(db).kind,'match');

  playGame(session,{A:11,B:4});matches.saveSession(session);assert.deepEqual(createMatchRepository(db).active().gamesWon,{A:1,B:0});assert.equal(resolveApplicationResume(db).matchId,session.id);
  session=createMatchRepository(db).active();continueGame(session);playGame(session,{A:8,B:11});matches.saveSession(session);continueGame(session);playGame(session,{A:11,B:6});matches.saveSession(session);
  assert.equal(session.status,'finished');assert.deepEqual(session.gamesWon,{A:2,B:1});assert.equal(resolveApplicationResume(db).screen,'result');
  t=tournaments.get(t.id);let result1=deriveCanonicalResult(t,session,20_000);confirmCanonicalResult(t,match1.id,result1.id,21_000);let report1=deriveMatchReport(t,match1.id,result1.id,rules.id,22_000);markReportShared(t,report1.id,23_000);markReportSent(t,report1.id,24_000);tournaments.save(t,{activeWorkSession:work.id});

  // Readiness/rest state survives reload, then an explicit operational decision releases Match 2.
  t=tournaments.get(t.id);assert.equal(t.schedule.find(item=>item.id===match2.id).readiness,'blocked');setMatchReadiness(t,match2.id,'ready');callPlayers(t,match2.id,25_000);readyPreMatch(t,match2);tournaments.save(t,{activeWorkSession:work.id});
  session=beginTournamentMatch(t.id,work.id,match2.id,null,db);playGame(session,{A:11,B:3});continueGame(session);playGame(session,{A:11,B:7});matches.saveSession(session);assert.deepEqual(session.gamesWon,{A:2,B:0});
  t=tournaments.get(t.id);const result2=deriveCanonicalResult(t,session,30_000);confirmCanonicalResult(t,match2.id,result2.id,31_000);const report2=deriveMatchReport(t,match2.id,result2.id,rules.id,32_000);markReportSent(t,report2.id,33_000);

  const snapshot1=calculateGroupSnapshot(t,groupA.id,ranking.id,34_000),completion1=assessGroupCompletion(t,groupA.id,35_000),groupReport1=deriveGroupReport(t,groupA.id,snapshot1.id,rules.id,36_000);markReportSent(t,groupReport1.id,37_000);
  assert.equal(completion1.status,'READY');assert.equal(snapshot1.rows[0].matchWins,2);assert.equal(snapshot1.rows[0].gameDifferential,3);assert.notEqual(snapshot1.rows[0].pointDifferential,snapshot1.rows[0].gameDifferential);

  // Correct one game point ledger; old snapshots/reports stay immutable and sent artifacts require resend.
  const frozenSnapshot=structuredClone(snapshot1),corrected=correctCanonicalResult(t,match1.id,{completedGames:[{points:{A:11,B:5}},{points:{A:8,B:11}},{points:{A:11,B:6}}],reason:'Biên bản BTC'},40_000);
  assert.equal(currentMatchReport(t,match1.id).status,'OUTDATED');confirmCanonicalResult(t,match1.id,corrected.id,41_000);
  const matchResend=deriveMatchReport(t,match1.id,corrected.id,rules.id,42_000);assert.equal(matchResend.status,'NEEDS_RESEND');markReportShared(t,matchResend.id,43_000);markReportSent(t,matchResend.id,44_000);
  const snapshot2=calculateGroupSnapshot(t,groupA.id,ranking.id,45_000);assert.deepEqual(t.groupSnapshots[0],frozenSnapshot);assert.ok(snapshot2.impact.includes('RESULT_CHANGED'));assert.ok(!snapshot2.resultVersionIds.includes(result1.id));assert.ok(snapshot2.resultVersionIds.includes(corrected.id));
  assert.equal(t.reporting.group[groupA.id].versions[0].status,'OUTDATED');const groupResend=deriveGroupReport(t,groupA.id,snapshot2.id,rules.id,46_000);assert.equal(groupResend.status,'NEEDS_RESEND');markReportSent(t,groupResend.id,47_000);assert.equal(assessGroupCompletion(t,groupA.id,48_000).status,'READY');

  // No-show is an explicit operational resolution, never an invented result or forfeit.
  resolveNoShow(t,noShow.id,'BTC xác nhận không xử thua tự động',50_000);tournaments.save(t,{activeWorkSession:work.id});t=tournaments.get(t.id);
  const noShowMatch=t.schedule.find(item=>item.id===noShow.id);assert.equal(noShowMatch.operations.waiting.resolution.automaticForfeit,false);assert.equal(noShowMatch.matchSessionId,null);assert.equal(currentResult(t,noShow.id),null);
  assert.equal(Object.keys(matches.load().matches).length,2);assert.equal(courtManagerView(t,work.id,matches).progress.resultsConfirmed,2);assert.deepEqual(reportingAttention(t),{status:'CLEAR',count:0,items:[]});
  assert.equal(currentMatchReport(t,match1.id).status,'SENT');assert.equal(currentGroupReport(t,groupA.id).status,'SENT');
  assert.deepEqual(currentResult(t,match1.id).matchGamesWon,{A:2,B:1});assert.deepEqual(currentResult(t,match2.id).matchGamesWon,{A:2,B:0});
});
