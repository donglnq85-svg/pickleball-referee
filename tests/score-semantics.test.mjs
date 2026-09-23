import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,rally,nextGame,prepareNextGame,resolveFinal,undo,redo} from '../src/match-engine.js';
import {createMatchRepository,STORE_KEY} from '../src/match-persistence.js';
import {createTournament,addRulesVersion,addResource,addPlayer,addEntry,addScheduledMatch} from '../src/tournament-domain.js';
import {addRankingRulesVersion,deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,calculateGroupSnapshot} from '../src/tournament-results.js';
import {deriveMatchReport,deriveGroupReport} from '../src/tournament-reporting.js';
import {createTournamentRepository,TOURNAMENT_STORE_KEY} from '../src/tournament-persistence.js';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
const config=()=>({type:'single',sets:3,points:11,rule:'touch',scoring:'side-out',start:{A:0,B:0},players:{A:['Alpha'],B:['Beta']}});
const final={serving:'A',courtLeft:'A'};
function scorePoints(state,team,count){for(let i=0;i<count;i++){if(state.serving!==team)rally(state,team);rally(state,team)}}
function playGame(state,points){
  const winner=points.A>points.B?'A':'B',loser=winner==='A'?'B':'A';
  scorePoints(state,loser,points[loser]);scorePoints(state,winner,points[winner]);
}
function playBestOfThree(state,scores){for(const [index,points] of scores.entries()){playGame(state,points);if(index<scores.length-1)nextGame(state,resolveFinal(state.config,prepareNextGame(state)))}}
function tournamentSetup(){
  const t=createTournament('Score semantics'),rules=addRulesVersion(t,{label:'BO3',authority:'Product Control',scoring:'side-out',format:{sets:3,points:11,rule:'touch'},procedures:{equipmentCheck:'disabled',reporting:{match:'optional',group:'optional'}}});
  const group=addResource(t,'groups','Bảng A'),court=addResource(t,'courts','Sân 1');
  const entries={};for(const name of ['Alpha','Beta']){const player=addPlayer(t,{displayName:name});entries[name]=addEntry(t,{type:'single',playerIds:[player.id]})}
  const scheduled=addScheduledMatch(t,{label:'Alpha – Beta',groupId:group.id,courtId:court.id,type:'single',entrantIds:{A:entries.Alpha.id,B:entries.Beta.id}});
  const ranking=addRankingRulesVersion(t,{label:'Separate metrics',authority:'Product Control',criteria:[{metric:'gameDifferential',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'top',count:1}});
  return {t,rules,group,scheduled,ranking};
}

test('best-of-3 keeps current points, immutable completed games and derived games won separate at every boundary',()=>{
  const s=createMatch(config(),final);
  playGame(s,{A:11,B:4});
  assert.equal(s.status,'gameEnd');assert.deepEqual(s.gamesWon,{A:1,B:0});assert.deepEqual(s.currentGamePoints,{A:11,B:4});
  assert.deepEqual(s.completedGames,[{gameNumber:1,points:{A:11,B:4},winner:'A'}]);
  const frozen=structuredClone(s.completedGames[0]);nextGame(s,resolveFinal(s.config,prepareNextGame(s)));
  playGame(s,{A:8,B:11});assert.equal(s.status,'gameEnd');assert.deepEqual(s.gamesWon,{A:1,B:1});assert.deepEqual(s.completedGames[0],frozen);
  nextGame(s,resolveFinal(s.config,prepareNextGame(s)));playGame(s,{A:11,B:6});
  assert.equal(s.status,'finished');assert.deepEqual(s.gamesWon,{A:2,B:1});assert.deepEqual(s.completedGames.map(game=>game.points),[{A:11,B:4},{A:8,B:11},{A:11,B:6}]);
});

test('best-of-3 2-0 ends after game two and Undo/Redo at game boundary restores all score layers',()=>{
  const s=createMatch(config(),final);playGame(s,{A:11,B:4});nextGame(s,resolveFinal(s.config,prepareNextGame(s)));playGame(s,{A:11,B:6});
  assert.equal(s.status,'finished');assert.deepEqual(s.gamesWon,{A:2,B:0});assert.equal(s.completedGames.length,2);
  undo(s);assert.equal(s.status,'playing');assert.deepEqual(s.gamesWon,{A:1,B:0});assert.equal(s.completedGames.length,1);assert.deepEqual(s.currentGamePoints,{A:10,B:6});
  redo(s);assert.equal(s.status,'finished');assert.deepEqual(s.gamesWon,{A:2,B:0});assert.deepEqual(s.completedGames.at(-1).points,{A:11,B:6});
});

test('reload between games preserves transition semantics and migrates legacy score fields once',()=>{
  const db=storage(),repo=createMatchRepository(db),s=createMatch(config(),final);playGame(s,{A:11,B:4});repo.saveSession(s);
  const reopened=createMatchRepository(db).active();assert.deepEqual(reopened.gamesWon,{A:1,B:0});assert.deepEqual(reopened.completedGames[0].points,{A:11,B:4});
  const legacy=JSON.parse(db.getItem(STORE_KEY)),saved=legacy.matches[s.id];saved.version=2;saved.score=saved.currentGamePoints;delete saved.currentGamePoints;saved.games=saved.completedGames.map(game=>({game:game.gameNumber,score:game.points,winner:game.winner}));delete saved.completedGames;db.setItem(STORE_KEY,JSON.stringify(legacy));
  const migrated=createMatchRepository(db).active();assert.equal(migrated.version,3);assert.equal('score' in migrated,false);assert.equal('games' in migrated,false);assert.deepEqual(migrated.completedGames[0].points,{A:11,B:4});
});

test('Canonical Result, standings and reports preserve match result vs exact per-game points',()=>{
  const {t,rules,group,scheduled,ranking}=tournamentSetup(),s=createMatch(config(),final);s.tournamentContext={tournamentId:t.id,scheduledMatchId:scheduled.id,rulesVersionId:rules.id,matchStartSnapshotId:null};scheduled.matchSessionId=s.id;
  playBestOfThree(s,[{A:11,B:4},{A:8,B:11},{A:11,B:6}]);
  const result=deriveCanonicalResult(t,s,10_000);assert.deepEqual(result.matchGamesWon,{A:2,B:1});assert.equal(result.winner,'A');assert.deepEqual(result.completedGames.map(game=>game.points),[{A:11,B:4},{A:8,B:11},{A:11,B:6}]);
  confirmCanonicalResult(t,scheduled.id,result.id,11_000);const snapshot=calculateGroupSnapshot(t,group.id,ranking.id,12_000),alpha=snapshot.rows.find(row=>row.entrantId===scheduled.entrantIds.A);
  assert.equal(alpha.matchWins,1);assert.equal(alpha.gameWins,2);assert.equal(alpha.gameLosses,1);assert.equal(alpha.gameDifferential,1);assert.equal(alpha.pointsFor,30);assert.equal(alpha.pointsAgainst,21);assert.equal(alpha.pointDifferential,9);
  const matchReport=deriveMatchReport(t,scheduled.id,result.id,rules.id,13_000),groupReport=deriveGroupReport(t,group.id,snapshot.id,rules.id,14_000);
  assert.match(matchReport.artifact.body,/Kết quả trận \(game thắng\): Alpha 2–1 Beta/);assert.match(matchReport.artifact.body,/Game 1: 11–4[\s\S]*Game 2: 8–11[\s\S]*Game 3: 11–6/);
  assert.match(groupReport.artifact.body,/game 2-1 \(HS 1\)/);assert.match(groupReport.artifact.body,/điểm 30-21 \(HS 9\)/);
});

test('correcting one game creates a new exact result version without confusing games won and point differential',()=>{
  const {t,rules,group,scheduled,ranking}=tournamentSetup(),s=createMatch(config(),final);s.tournamentContext={tournamentId:t.id,scheduledMatchId:scheduled.id,rulesVersionId:rules.id,matchStartSnapshotId:null};scheduled.matchSessionId=s.id;
  playBestOfThree(s,[{A:11,B:4},{A:8,B:11},{A:11,B:6}]);const v1=deriveCanonicalResult(t,s);confirmCanonicalResult(t,scheduled.id,v1.id);
  const v2=correctCanonicalResult(t,scheduled.id,{completedGames:[{points:{A:11,B:5}},{points:{A:8,B:11}},{points:{A:11,B:6}}],reason:'Biên bản chính thức'});confirmCanonicalResult(t,scheduled.id,v2.id);
  assert.deepEqual(v2.matchGamesWon,{A:2,B:1});assert.deepEqual(v1.completedGames[0].points,{A:11,B:4});assert.deepEqual(v2.completedGames[0].points,{A:11,B:5});
  const snapshot=calculateGroupSnapshot(t,group.id,ranking.id),alpha=snapshot.rows.find(row=>row.entrantId===scheduled.entrantIds.A);
  assert.equal(alpha.gameDifferential,1);assert.equal(alpha.pointDifferential,8);assert.ok(snapshot.resultVersionIds.includes(v2.id));assert.ok(!snapshot.resultVersionIds.includes(v1.id));
});

test('candidate Tournament data migrates legacy result and standings score names without losing version references',()=>{
  const db=storage(),{t,rules,group,scheduled,ranking}=tournamentSetup(),s=createMatch(config(),final);s.tournamentContext={tournamentId:t.id,scheduledMatchId:scheduled.id,rulesVersionId:rules.id,matchStartSnapshotId:null};scheduled.matchSessionId=s.id;
  playBestOfThree(s,[{A:11,B:4},{A:8,B:11},{A:11,B:6}]);const result=deriveCanonicalResult(t,s);confirmCanonicalResult(t,scheduled.id,result.id);const snapshot=calculateGroupSnapshot(t,group.id,ranking.id);
  const legacy=structuredClone(t),storedResult=legacy.resultLedger.byMatch[scheduled.id].versions[0];storedResult.games=storedResult.completedGames.map(game=>({game:game.gameNumber,score:game.points,winner:game.winner}));delete storedResult.completedGames;storedResult.gamesWon=storedResult.matchGamesWon;delete storedResult.matchGamesWon;delete storedResult.format;
  for(const row of legacy.groupSnapshots[0].rows){row.pointsWon=row.pointsFor;row.pointsLost=row.pointsAgainst;delete row.pointsFor;delete row.pointsAgainst;delete row.gameDifferential;delete row.pointDifferential}
  db.setItem(TOURNAMENT_STORE_KEY,JSON.stringify({version:2,tournaments:{[legacy.id]:legacy},activeWorkSession:null}));
  const reopened=createTournamentRepository(db).get(t.id),migrated=reopened.resultLedger.byMatch[scheduled.id].versions[0],migratedSnapshot=reopened.groupSnapshots[0];
  assert.equal(migrated.id,result.id);assert.deepEqual(migrated.completedGames[0].points,{A:11,B:4});assert.deepEqual(migrated.matchGamesWon,{A:2,B:1});assert.deepEqual(migratedSnapshot.resultVersionIds,snapshot.resultVersionIds);
  assert.equal(migratedSnapshot.rows.find(row=>row.entrantId===scheduled.entrantIds.A).pointDifferential,9);
});
