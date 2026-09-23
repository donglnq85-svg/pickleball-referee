import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,rally} from '../src/match-engine.js';
import {createTournament,addRulesVersion,addResource,addPlayer,addEntry,addScheduledMatch,validateTournament} from '../src/tournament-domain.js';
import {createTournamentRepository} from '../src/tournament-persistence.js';
import {addRankingRulesVersion,deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,currentResult,calculateGroupSnapshot,assessGroupCompletion} from '../src/tournament-results.js';
import {deriveMatchReport,deriveGroupReport,currentMatchReport,currentGroupReport,markReportShared,markReportSent,reportingAttention,validateReportingOperations} from '../src/tournament-reporting.js';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
function entrant(t,name){const player=addPlayer(t,{displayName:name});return addEntry(t,{type:'single',playerIds:[player.id]})}
function setup(reporting={match:'required',group:'required'}){
  const t=createTournament('Gate 5'),rules=addRulesVersion(t,{label:'Rules',authority:'PC',scoring:'side-out',format:{sets:1,points:1,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting}});
  const group=addResource(t,'groups','Bảng A'),ranking=addRankingRulesVersion(t,{label:'Ranking',authority:'PC',criteria:[{metric:'matchWins',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'top',count:1}});
  const entries={A:entrant(t,'Alpha'),B:entrant(t,'Beta'),C:entrant(t,'Gamma')};
  const first=addScheduledMatch(t,{label:'Alpha – Beta',groupId:group.id,type:'single',entrantIds:{A:entries.A.id,B:entries.B.id}}),second=addScheduledMatch(t,{label:'Beta – Gamma',groupId:group.id,type:'single',entrantIds:{A:entries.B.id,B:entries.C.id}});
  return {t,rules,group,ranking,entries,first,second};
}
function finish(t,match,winner='A'){
  const players={A:[t.structure.players.find(player=>player.id===t.structure.entries.find(entry=>entry.id===match.entrantIds.A).playerIds[0]).displayName],B:[t.structure.players.find(player=>player.id===t.structure.entries.find(entry=>entry.id===match.entrantIds.B).playerIds[0]).displayName]};
  const session=createMatch({type:'single',sets:1,points:1,rule:'touch',scoring:'side-out',players,start:{A:0,B:0}},{serving:winner,courtLeft:'A'});session.tournamentContext={tournamentId:t.id,scheduledMatchId:match.id,rulesVersionId:t.activeRulesVersionId};match.matchSessionId=session.id;rally(session,winner);
  const result=deriveCanonicalResult(t,session);confirmCanonicalResult(t,match.id,result.id);return {session,result:currentResult(t,match.id)};
}

test('Match Report references exact Result Version and generated-but-unsent persists',()=>{
  const db=storage(),{t,first,rules}=setup(),{result}=finish(t,first),report=deriveMatchReport(t,first.id);
  assert.equal(report.status,'GENERATED');assert.deepEqual(report.source,{kind:'RESULT_VERSION',id:result.id,scheduledMatchId:first.id});assert.equal(report.rulesVersionId,rules.id);assert.ok(report.artifact.body.includes('Alpha'));
  assert.equal(reportingAttention(t).items.find(item=>item.reportId===report.id).kind,'REPORT_UNSENT');
  createTournamentRepository(db).save(t);const reopened=createTournamentRepository(db).get(t.id),restored=currentMatchReport(reopened,first.id);
  assert.equal(restored.id,report.id);assert.equal(restored.status,'GENERATED');validateTournament(reopened);
});

test('opening system share is not SENT and shared-but-unconfirmed persists',()=>{
  const db=storage(),{t,first}=setup(),{result}=finish(t,first),report=deriveMatchReport(t,first.id,result.id);markReportShared(t,report.id,10_000);
  assert.equal(currentMatchReport(t,first.id).status,'SHARED_UNCONFIRMED');assert.equal(currentMatchReport(t,first.id).sentAt,null);assert.ok(t.reporting.events.some(event=>event.type==='reportShareSheetOpened'));assert.ok(!t.reporting.events.some(event=>event.type==='reportSent'));
  createTournamentRepository(db).save(t);assert.equal(currentMatchReport(createTournamentRepository(db).get(t.id),first.id).status,'SHARED_UNCONFIRMED');
});

test('explicit sent confirmation persists as a Reporting Event',()=>{
  const db=storage(),{t,first}=setup(),{result}=finish(t,first),report=deriveMatchReport(t,first.id,result.id);markReportShared(t,report.id,10_000);markReportSent(t,report.id,20_000);
  assert.equal(currentMatchReport(t,first.id).status,'SENT');assert.equal(currentMatchReport(t,first.id).sentAt,new Date(20_000).toISOString());assert.ok(t.reporting.events.some(event=>event.type==='reportSent'));
  createTournamentRepository(db).save(t);assert.equal(currentMatchReport(createTournamentRepository(db).get(t.id),first.id).status,'SENT');
});

test('Result correction makes old report OUTDATED and sent report creates NEEDS_RESEND revision',()=>{
  const db=storage(),{t,first}=setup(),{result:v1}=finish(t,first),report1=deriveMatchReport(t,first.id,v1.id);markReportSent(t,report1.id,10_000);
  const v2=correctCanonicalResult(t,first.id,{completedGames:[{points:{A:0,B:1}}],reason:'BTC sửa'},20_000);assert.equal(t.reporting.match[first.id].versions[0].status,'OUTDATED');assert.equal(t.reporting.match[first.id].versions[0].wasSent,true);
  createTournamentRepository(db).save(t);assert.equal(createTournamentRepository(db).get(t.id).reporting.match[first.id].versions[0].status,'OUTDATED');
  confirmCanonicalResult(t,first.id,v2.id,21_000);const report2=deriveMatchReport(t,first.id,v2.id,null,22_000);
  assert.equal(report2.revision,2);assert.equal(report2.status,'NEEDS_RESEND');assert.equal(report2.source.id,v2.id);assert.equal(report2.attention.kind,'RESULT_CHANGED');assert.equal(reportingAttention(t).status,'ACTION_REQUIRED');
  createTournamentRepository(db).save(t);assert.equal(currentMatchReport(createTournamentRepository(db).get(t.id),first.id).status,'NEEDS_RESEND');
  markReportShared(t,report2.id,23_000);assert.equal(currentMatchReport(t,first.id).status,'SHARED_UNCONFIRMED');createTournamentRepository(db).save(t);assert.equal(currentMatchReport(createTournamentRepository(db).get(t.id),first.id).status,'SHARED_UNCONFIRMED');markReportSent(t,report2.id,24_000);assert.equal(currentMatchReport(t,first.id).status,'SENT');
  createTournamentRepository(db).save(t);const reopened=createTournamentRepository(db).get(t.id);assert.equal(reopened.reporting.match[first.id].versions.length,2);assert.equal(currentMatchReport(reopened,first.id).status,'SENT');
});

test('Group Report revision references exact Snapshot and qualification change is high attention',()=>{
  const db=storage(),{t,group,ranking,first,second}=setup();finish(t,first,'A');finish(t,second,'A');
  const snapshot1=calculateGroupSnapshot(t,group.id,ranking.id,10_000);assessGroupCompletion(t,group.id,11_000);const report1=deriveGroupReport(t,group.id,snapshot1.id,t.activeRulesVersionId,12_000);assert.equal(report1.attention.kind,'NONE');markReportSent(t,report1.id,13_000);
  const corrected=correctCanonicalResult(t,first.id,{completedGames:[{points:{A:0,B:1}}],reason:'BTC'},20_000);confirmCanonicalResult(t,first.id,corrected.id,21_000);const snapshot2=calculateGroupSnapshot(t,group.id,ranking.id,22_000);assessGroupCompletion(t,group.id,23_000);
  assert.ok(snapshot2.impact.includes('QUALIFICATION_CHANGED'));assert.equal(t.reporting.group[group.id].versions[0].status,'OUTDATED');
  const report2=deriveGroupReport(t,group.id,snapshot2.id,t.activeRulesVersionId,24_000);assert.equal(report2.status,'NEEDS_RESEND');assert.equal(report2.source.id,snapshot2.id);assert.equal(report2.attention.kind,'QUALIFICATION_CHANGED');assert.equal(report2.attention.severity,'high');assert.equal(reportingAttention(t).status,'HIGH_ATTENTION');
  markReportSent(t,report2.id,25_000);assert.equal(currentGroupReport(t,group.id).status,'SENT');assert.deepEqual(t.reporting.group[group.id].versions.map(report=>report.source.id),[snapshot1.id,snapshot2.id]);
  createTournamentRepository(db).save(t);const reopened=createTournamentRepository(db).get(t.id);assert.equal(currentGroupReport(reopened,group.id).source.id,snapshot2.id);assert.equal(reopened.reporting.group[group.id].versions[0].status,'OUTDATED');
});

test('Reporting Policy supports required, optional and disabled without hard-coded per-match send',()=>{
  const required=setup({match:'required',group:'optional'});finish(required.t,required.first);assert.equal(reportingAttention(required.t).items[0].kind,'MATCH_REPORT_REQUIRED');
  const optional=setup({match:'optional',group:'optional'});finish(optional.t,optional.first);assert.equal(reportingAttention(optional.t).status,'CLEAR');assert.equal(currentMatchReport(optional.t,optional.first.id),null);
  const disabled=setup({match:'disabled',group:'disabled'});const {result}=finish(disabled.t,disabled.first);assert.throws(()=>deriveMatchReport(disabled.t,disabled.first.id,result.id),/không cho tạo/);validateReportingOperations(disabled.t);
});
