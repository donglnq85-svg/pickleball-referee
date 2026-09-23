import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,rally} from '../src/match-engine.js';
import {createTournament,addRulesVersion,addResource,addPlayer,addEntry,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness,courtManagerView,validateTournament,matchPlayers} from '../src/tournament-domain.js';
import {createTournamentRepository} from '../src/tournament-persistence.js';
import {createMatchRepository} from '../src/match-persistence.js';
import {addRankingRulesVersion,deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,currentResult,calculateGroupSnapshot,assessGroupCompletion} from '../src/tournament-results.js';
import {resolveApplicationResume} from '../src/application-resume.js';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
const setup=()=>{
  const t=createTournament('Gate 4'),rules=addRulesVersion(t,{label:'Match Rules',authority:'Product Control',scoring:'side-out',format:{sets:1,points:1,rule:'touch'},procedures:{equipmentCheck:'disabled'}});
  const group=addResource(t,'groups','Bảng A'),court=addResource(t,'courts','Sân 1');
  const playerEntries=Object.fromEntries(['Alpha','Beta','Gamma'].map(displayName=>{const player=addPlayer(t,{displayName});return [displayName,addEntry(t,{type:'single',playerIds:[player.id]})]}));
  const first=addScheduledMatch(t,{label:'Alpha – Beta',groupId:group.id,courtId:court.id,type:'single',entrantIds:{A:playerEntries.Alpha.id,B:playerEntries.Beta.id}});
  const second=addScheduledMatch(t,{label:'Beta – Gamma',groupId:group.id,courtId:court.id,type:'single',entrantIds:{A:playerEntries.Beta.id,B:playerEntries.Gamma.id}});
  const assignment=createAssignment(t,{label:'Bảng A',scopeKind:'group',scopeIds:[group.id]}),work=startWorkSession(t,assignment.id);
  setMatchReadiness(t,first.id,'ready');setMatchReadiness(t,second.id,'ready');
  return {t,rules,group,court,first,second,work};
};
function finish(t,scheduled,winner='A'){
  const session=createMatch({type:'single',sets:1,points:1,rule:'touch',scoring:'side-out',players:matchPlayers(t,scheduled),start:{A:0,B:0}},{serving:winner,courtLeft:'A'});
  session.tournamentContext={tournamentId:t.id,scheduledMatchId:scheduled.id,rulesVersionId:t.activeRulesVersionId,matchStartSnapshotId:null};scheduled.matchSessionId=session.id;rally(session,winner);return session;
}

test('MATCH_ENDED and RESULT_CONFIRMED are separate facts and derive is idempotent',()=>{
  const {t,first}=setup(),session=finish(t,first,'A'),ended=session.finishedAt;
  const v1=deriveCanonicalResult(t,session,20_000);assert.equal(v1.status,'PENDING_CONFIRMATION');assert.equal(v1.matchEndedAt,ended);assert.equal(v1.confirmedAt,null);
  assert.equal(deriveCanonicalResult(t,session,21_000).id,v1.id);assert.equal(t.resultLedger.byMatch[first.id].versions.length,1);
  const confirmed=confirmCanonicalResult(t,first.id,v1.id,30_000);assert.equal(confirmed.status,'CONFIRMED');assert.equal(confirmed.confirmedAt,new Date(30_000).toISOString());assert.notEqual(confirmed.confirmedAt,confirmed.matchEndedAt);
  assert.throws(()=>confirmCanonicalResult(t,first.id,'old'),/hiện tại/);assert.equal(currentResult(t,first.id).id,v1.id);validateTournament(t);
});

test('standings reads only confirmed Canonical Result and incomplete ranking policy stays explicit',()=>{
  const {t,group,first}=setup(),session=finish(t,first,'A');deriveCanonicalResult(t,session);
  let snapshot=calculateGroupSnapshot(t,group.id,null);assert.equal(snapshot.resultVersionIds.length,0);assert.equal(snapshot.status,'NEEDS_CONFIRMATION');assert.equal(snapshot.reason,'RANKING_RULES_INCOMPLETE');
  confirmCanonicalResult(t,first.id,currentResult(t,first.id).id);
  snapshot=calculateGroupSnapshot(t,group.id,null);assert.equal(snapshot.resultVersionIds.length,1);assert.equal(snapshot.status,'NEEDS_CONFIRMATION');assert.equal(snapshot.qualification.status,'UNKNOWN');
  const completion=assessGroupCompletion(t,group.id);assert.equal(completion.status,'IN_PROGRESS');
});

test('Result v1 correction creates v2, preserves old snapshot and classifies propagation impact',()=>{
  const db=storage(),{t,group,first,second,work}=setup();
  const ranking=addRankingRulesVersion(t,{label:'Ranking locked',authority:'Product Control',criteria:[{metric:'matchWins',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'top',count:1}});
  const session1=finish(t,first,'A'),session2=finish(t,second,'A');const matches=createMatchRepository(db);matches.saveSession(session1);matches.saveSession(session2);
  const result1=deriveCanonicalResult(t,session1,10_000),result2=deriveCanonicalResult(t,session2,11_000);confirmCanonicalResult(t,first.id,result1.id,12_000);confirmCanonicalResult(t,second.id,result2.id,13_000);
  const snapshot1=calculateGroupSnapshot(t,group.id,ranking.id,14_000);assert.equal(snapshot1.status,'RANKED');assert.equal(snapshot1.rows[0].players[0],'Alpha');assert.deepEqual(snapshot1.qualification.qualified,[snapshot1.rows[0].entrantId]);
  const futureRules=addRankingRulesVersion(t,{label:'Future ranking',authority:'Not applied retroactively',criteria:[{metric:'gameWins',direction:'desc'}],qualification:{kind:'top',count:2}});
  assert.equal(t.activeRankingRulesVersionId,futureRules.id);assert.equal(snapshot1.rankingRulesVersionId,ranking.id);
  const oldFrozen=structuredClone(snapshot1),v2=correctCanonicalResult(t,first.id,{completedGames:[{points:{A:5,B:11}}],reason:'Biên bản chính thức',actor:'chief referee'},20_000);
  assert.equal(v2.version,2);assert.equal(v2.status,'PENDING_CONFIRMATION');assert.equal(t.resultLedger.byMatch[first.id].versions.length,2);assert.equal(t.resultLedger.byMatch[first.id].versions[0].isCurrent,false);
  confirmCanonicalResult(t,first.id,v2.id,21_000);const snapshot2=calculateGroupSnapshot(t,group.id,ranking.id,22_000);
  assert.equal(snapshot2.rows[0].players[0],'Beta');assert.ok(snapshot2.impact.includes('RESULT_CHANGED'));assert.ok(snapshot2.impact.includes('RANKING_CHANGED'));assert.ok(snapshot2.impact.includes('QUALIFICATION_CHANGED'));
  assert.equal(deriveCanonicalResult(t,session1,22_500).id,v2.id);assert.equal(t.resultLedger.byMatch[first.id].versions.length,2);
  assert.deepEqual(t.groupSnapshots[0],oldFrozen);assert.ok(snapshot1.resultVersionIds.includes(result1.id));assert.ok(snapshot2.resultVersionIds.includes(v2.id));assert.ok(!snapshot2.resultVersionIds.includes(result1.id));
  const completion=assessGroupCompletion(t,group.id,23_000);assert.equal(completion.status,'READY');assert.equal(completion.groupSnapshotId,snapshot2.id);
  const repo=createTournamentRepository(db);repo.save(t,{activeWorkSession:work.id});const reopened=repo.get(t.id);
  assert.equal(currentResult(reopened,first.id).id,v2.id);assert.equal(reopened.groupSnapshots.length,2);assert.equal(courtManagerView(reopened,work.id,matches).progress.resultsConfirmed,2);validateTournament(reopened);
});

test('reload prioritizes a finished Match with an unconfirmed Canonical Result',()=>{
  const db=storage(),{t,first,work}=setup(),session=finish(t,first,'A');createMatchRepository(db).saveSession(session);createTournamentRepository(db).save(t,{activeWorkSession:work.id});
  assert.deepEqual(resolveApplicationResume(db),{kind:'tournament',screen:'result',tournamentId:t.id,workSessionId:work.id,matchId:first.id});
  assert.equal(Object.keys(createMatchRepository(db).load().matches).length,1);
});

test('unknown metric and unresolved tie never invent rank or qualification',()=>{
  const {t,group,first,second}=setup(),s1=finish(t,first,'A'),s2=finish(t,second,'A');
  for(const [match,session] of [[first,s1],[second,s2]]){const result=deriveCanonicalResult(t,session);confirmCanonicalResult(t,match.id,result.id)}
  let rules=addRankingRulesVersion(t,{label:'Unverified H2H',authority:'BTC',criteria:[{metric:'headToHead',direction:'desc'}],qualification:{kind:'top',count:1}});
  let snapshot=calculateGroupSnapshot(t,group.id,rules.id);assert.equal(snapshot.status,'NEEDS_CONFIRMATION');assert.equal(snapshot.reason,'RANKING_METRIC_UNSUPPORTED');assert.equal(snapshot.qualification.status,'NEEDS_CONFIRMATION');assert.equal(snapshot.rows.reduce((sum,row)=>sum+row.played,0),4);
  rules=addRankingRulesVersion(t,{label:'Wins only',authority:'BTC',criteria:[{metric:'matchWins',direction:'desc'}],qualification:{kind:'top',count:1}});
  snapshot=calculateGroupSnapshot(t,group.id,rules.id);assert.equal(snapshot.status,'NEEDS_CONFIRMATION');assert.equal(snapshot.reason,'UNRESOLVED_TIE');assert.ok(snapshot.rows.slice(0,2).every(row=>row.rank===null));
});
