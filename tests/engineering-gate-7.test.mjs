import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addRulesVersion,addResource,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness} from '../src/tournament-domain.js';
import {markPlayersArrived,initializePreMatch,confirmAthlete,skipWarmup,setPreMatchFinalSetup,createMatchStartSnapshot,callPlayers,startWaiting} from '../src/tournament-operations.js';
import {beginTournamentMatch} from '../src/tournament-launch.js';
import {createTournamentRepository} from '../src/tournament-persistence.js';
import {createMatchRepository} from '../src/match-persistence.js';
import {rally,matchView} from '../src/match-engine.js';
import {deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult} from '../src/tournament-results.js';
import {deriveMatchReport,markReportSent,currentMatchReport} from '../src/tournament-reporting.js';
import {addOperationalIssue,projectShiftCompletion,createHandoverSnapshot,completeWorkSession,currentShiftCompletion,mandatoryUnfinishedWork} from '../src/tournament-shift.js';
import {resolveApplicationResume} from '../src/application-resume.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
function setup(db,{reporting='optional',shiftCompletion={},type='single',points=3}={}){
  const t=createTournament('Gate 7 shift'),rules=addRulesVersion(t,{label:'Shift rules',authority:'Product Control',scoring:'side-out',format:{sets:1,points,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:reporting,group:'optional'},shiftCompletion}});
  const court=addResource(t,'courts','Sân 1'),players=type==='single'?{A:['An'],B:['Bình']}:{A:['An','Anh'],B:['Bình','Bảo']};
  const match=addScheduledMatch(t,{label:'Trận 1',courtId:court.id,type,players}),assignment=createAssignment(t,{label:'Ca sân 1',scopeKind:'court',scopeIds:[court.id]}),work=startWorkSession(t,assignment.id);
  createTournamentRepository(db).save(t,{activeWorkSession:work.id});return {t,rules,match,assignment,work};
}
function prepare(t,match){
  setMatchReadiness(t,match.id,'ready');markPlayersArrived(t,match.id);const pre=initializePreMatch(t,match.id);
  for(const participant of pre.participants)confirmAthlete(t,match.id,participant.id);
  skipWarmup(t,match.id);const final={serving:'A',courtLeft:'A'};
  if(match.type==='double')Object.assign(final,{right:{A:0,B:0},serverIndex:0});
  setPreMatchFinalSetup(t,match.id,{start:{A:0,B:0},final});createMatchStartSnapshot(t,match.id);
}

test('Shift Completion Check is a deterministic projection and waiting blocker survives reload',()=>{
  const db=memory(),{t,match,work}=setup(db),repo=createTournamentRepository(db),matches=createMatchRepository(db);
  callPlayers(t,match.id,1_000);startWaiting(t,match.id,2_000);repo.save(t,{activeWorkSession:work.id});
  const before=projectShiftCompletion(t,work.id,matches),reloaded=repo.get(t.id),after=projectShiftCompletion(reloaded,work.id,matches);
  assert.equal(before.status,'BLOCKED');assert.deepEqual(after,before);
  assert.deepEqual(before.blockers.map(item=>item.kind),['UNRESOLVED_WAITING']);
  assert.throws(()=>completeWorkSession(reloaded,work.id,matches),/BLOCKER/);
  assert.equal(resolveApplicationResume(db).screen,'operations');
});

test('Handover freezes exact active Match state, keeps issues unresolved and End Shift is idempotent',()=>{
  const db=memory(),{t,match,work,rules}=setup(db,{type:'double'}),tournaments=createTournamentRepository(db),matches=createMatchRepository(db);
  prepare(t,match);tournaments.save(t,{activeWorkSession:work.id});const session=beginTournamentMatch(t.id,work.id,match.id,null,db);
  rally(session,'A');rally(session,'B');matches.saveSession(session);let saved=tournaments.get(t.id);const issue=addOperationalIssue(saved,{scopeKind:'match',scopeId:match.id,description:'Bàn giao biên bản giấy'});tournaments.save(saved);
  const eventCount=session.events.length,view=matchView(session),handover=createHandoverSnapshot(saved,work.id,matches,{recipientName:'Trọng tài B',context:'Tiếp tục game 1',equipmentBall:'1 bóng'},10_000);
  assert.equal(handover.matches.length,1);const frozen=handover.matches[0];
  assert.deepEqual(frozen.currentGamePoints,session.currentGamePoints);assert.deepEqual(frozen.completedGames,session.completedGames);assert.deepEqual(frozen.gamesWon,session.gamesWon);
  assert.equal(frozen.serving,session.serving);assert.equal(frozen.serverNumber,session.serverNumber);assert.equal(frozen.server.name,view.server);assert.equal(frozen.receiver.name,view.receiver);
  assert.deepEqual(frozen.participantPositions,view.participants);assert.equal(frozen.courtLeft,view.courtLeft);assert.equal(frozen.courtRight,view.courtRight);assert.equal(frozen.tournamentRulesVersionId,rules.id);
  assert.equal(frozen.eventHistoryBoundary.eventCount,eventCount);assert.equal(matches.get(session.id).events.length,eventCount);
  assert.equal(saved.operationalIssues.find(item=>item.id===issue.id).status,'open');const handedOver=projectShiftCompletion(saved,work.id,matches);assert.equal(handedOver.blockers.length,0);assert.equal(handedOver.handover.status,'CURRENT');assert.ok(handedOver.outstanding.every(item=>item.handedOver));
  const completion=completeWorkSession(saved,work.id,matches,{at:20_000}),again=completeWorkSession(saved,work.id,matches,{at:30_000});
  assert.deepEqual(again,completion);assert.equal(saved.shiftCompletions.length,1);assert.equal(saved.events.filter(item=>item.type==='shiftCompleted').length,1);
  assert.equal(saved.status,'active');assert.equal(saved.operationalIssues.find(item=>item.id===issue.id).status,'open');assert.equal(mandatoryUnfinishedWork(saved,work.id,matches).critical.length,2);
  tournaments.save(saved,{activeWorkSession:null});assert.deepEqual(tournaments.get(t.id).shiftCompletions[0],completion);assert.equal(resolveApplicationResume(db).kind,'match');
});

test('clean End Shift snapshot is immutable across reload and never completes Tournament',()=>{
  const db=memory(),{t,work,assignment}=setup(db),repo=createTournamentRepository(db),matches=createMatchRepository(db);
  assert.equal(projectShiftCompletion(t,work.id,matches).status,'READY');repo.save(t,{activeWorkSession:work.id});
  const before=repo.get(t.id);assert.equal(currentShiftCompletion(before,work.id),null);
  const snapshot=completeWorkSession(before,work.id,matches,{at:50_000});repo.save(before,{activeWorkSession:null});
  const after=repo.get(t.id);assert.deepEqual(currentShiftCompletion(after,work.id),snapshot);assert.equal(after.status,'active');assert.equal(after.assignments.find(item=>item.id===assignment.id).status,'completed');
  assert.equal(after.workSessions[0].endedAt,new Date(50_000).toISOString());assert.equal(after.shiftCompletions.length,1);
  assert.deepEqual(resolveApplicationResume(db),{kind:'normal'});
});

test('Group Completion and handover obligations are classified by configured workflow policy',()=>{
  const db=memory(),t=createTournament('Configured shift');
  addRulesVersion(t,{label:'Rules',authority:'BTC',scoring:'side-out',format:{sets:1,points:3,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'optional',group:'optional'},shiftCompletion:{requireGroupCompletion:true,incompleteGroup:'blocker',handoverObligation:'reminder'}}});
  const group=addResource(t,'groups','Bảng A'),match=addScheduledMatch(t,{label:'A1',groupId:group.id,type:'single',players:{A:['An'],B:['Bình']}}),assignment=createAssignment(t,{label:'Bảng A',scopeKind:'group',scopeIds:[group.id]}),work=startWorkSession(t,assignment.id),matches=createMatchRepository(db);
  let projection=projectShiftCompletion(t,work.id,matches);assert.deepEqual(projection.blockers.map(item=>item.kind),['GROUP_COMPLETION']);
  t.rulesVersions.find(item=>item.id===t.activeRulesVersionId).procedures.shiftCompletion.incompleteGroup='reminder';
  markPlayersArrived(t,match.id);initializePreMatch(t,match.id);projection=projectShiftCompletion(t,work.id,matches);
  assert.equal(projection.status,'READY_WITH_REMINDERS');assert.deepEqual(new Set(projection.reminders.map(item=>item.kind)),new Set(['HANDOVER_OBLIGATION','GROUP_COMPLETION']));
});

test('post-completion correction produces NEEDS_RESEND and remains mandatory outstanding work',()=>{
  const db=memory(),{t,match,work}=setup(db,{reporting:'required',points:1}),tournaments=createTournamentRepository(db),matches=createMatchRepository(db);
  prepare(t,match);tournaments.save(t,{activeWorkSession:work.id});const session=beginTournamentMatch(t.id,work.id,match.id,null,db);rally(session,'A');matches.saveSession(session);
  let saved=tournaments.get(t.id),result=deriveCanonicalResult(saved,session,10_000);assert.deepEqual(projectShiftCompletion(saved,work.id,matches).blockers.map(item=>item.kind),['UNCONFIRMED_RESULT']);confirmCanonicalResult(saved,match.id,result.id,11_000);const report=deriveMatchReport(saved,match.id,result.id,undefined,12_000);markReportSent(saved,report.id,13_000);
  assert.equal(projectShiftCompletion(saved,work.id,matches).status,'READY');completeWorkSession(saved,work.id,matches,{at:14_000});tournaments.save(saved,{activeWorkSession:null});
  saved=tournaments.get(t.id);const corrected=correctCanonicalResult(saved,match.id,{completedGames:[{points:{A:2,B:0}}],reason:'BTC sửa điểm'},20_000);confirmCanonicalResult(saved,match.id,corrected.id,21_000);
  const resend=deriveMatchReport(saved,match.id,corrected.id,undefined,22_000);assert.equal(resend.status,'NEEDS_RESEND');tournaments.save(saved);
  const outstanding=mandatoryUnfinishedWork(tournaments.get(t.id),work.id,matches).critical;
  assert.deepEqual(outstanding.map(item=>item.kind),['REQUIRED_MATCH_REPORT']);assert.equal(currentMatchReport(saved,match.id).status,'NEEDS_RESEND');
  assert.deepEqual(resolveApplicationResume(db),{kind:'tournament',screen:'shiftAttention',tournamentId:t.id,workSessionId:work.id,matchId:null});
});

test('bootstrap priority is Active Match, mandatory work, Active Work Session, next Assignment, then Home',()=>{
  const db=memory(),{t,match,work}=setup(db),repo=createTournamentRepository(db),matches=createMatchRepository(db);
  assert.equal(resolveApplicationResume(db).screen,'court');
  addOperationalIssue(t,{scopeKind:'assignment',scopeId:work.assignmentId,description:'Chờ xác nhận BTC'});repo.save(t,{activeWorkSession:work.id});assert.equal(resolveApplicationResume(db).screen,'shiftAttention');
  prepare(t,match);repo.save(t);const session=beginTournamentMatch(t.id,work.id,match.id,null,db);assert.deepEqual(resolveApplicationResume(db),{kind:'match',matchId:session.id});
  const separate=memory(),setup2=setup(separate),repo2=createTournamentRepository(separate),saved=repo2.get(setup2.t.id);saved.workSessions[0].status='completed';saved.workSessions[0].endedAt=new Date().toISOString();saved.assignments[0].status='assigned';repo2.save(saved,{activeWorkSession:null});
  assert.deepEqual(resolveApplicationResume(separate),{kind:'tournament',screen:'assignment',tournamentId:saved.id,workSessionId:null,matchId:null});
  const empty=memory();assert.deepEqual(resolveApplicationResume(empty),{kind:'normal'});
});
