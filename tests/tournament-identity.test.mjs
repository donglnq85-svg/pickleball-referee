import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,rally} from '../src/match-engine.js';
import {createTournament,addRulesVersion,addResource,addPlayer,renamePlayer,addEntry,addTeam,addScheduledMatch,matchPlayers,validateTournament} from '../src/tournament-domain.js';
import {createTournamentRepository,TOURNAMENT_STORE_KEY} from '../src/tournament-persistence.js';
import {addRankingRulesVersion,deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,calculateGroupSnapshot,currentResult} from '../src/tournament-results.js';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
function base(){
  const t=createTournament('Identity Closure');
  addRulesVersion(t,{label:'Match Rules',authority:'PC',scoring:'side-out',format:{sets:1,points:1,rule:'touch'},procedures:{equipmentCheck:'disabled'}});
  const group=addResource(t,'groups','Bảng A');
  const ranking=addRankingRulesVersion(t,{label:'Ranking',authority:'PC',criteria:[{metric:'matchWins',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'top',count:1}});
  return {t,group,ranking};
}
function playerEntry(t,displayName,type='single',partner=null){
  const first=addPlayer(t,{displayName}),ids=[first.id];if(partner)ids.push(addPlayer(t,{displayName:partner}).id);
  return {player:first,entry:addEntry(t,{type,playerIds:ids})};
}
function finish(t,match,winner='A',scores=null){
  const session=createMatch({type:match.type,sets:1,points:1,rule:'touch',scoring:'side-out',players:matchPlayers(t,match),start:{A:0,B:0}},{serving:winner,courtLeft:'A',...(match.type==='double'?{right:{A:0,B:0},serverIndex:0}:{})});
  session.tournamentContext={tournamentId:t.id,scheduledMatchId:match.id,rulesVersionId:t.activeRulesVersionId};match.matchSessionId=session.id;rally(session,winner);
  const result=deriveCanonicalResult(t,session);confirmCanonicalResult(t,match.id,result.id);return {session,result:scores?correctCanonicalResult(t,match.id,{games:scores,reason:'correction'}):result};
}

test('duplicate display names remain distinct Player and Entry identities in standings',()=>{
  const {t,group,ranking}=base(),one=playerEntry(t,'Trùng Tên'),two=playerEntry(t,'Trùng Tên'),opponent=playerEntry(t,'Đối thủ');
  const m1=addScheduledMatch(t,{label:'M1',groupId:group.id,type:'single',entrantIds:{A:one.entry.id,B:opponent.entry.id}});
  const m2=addScheduledMatch(t,{label:'M2',groupId:group.id,type:'single',entrantIds:{A:two.entry.id,B:opponent.entry.id}});
  finish(t,m1,'A');finish(t,m2,'A');const snapshot=calculateGroupSnapshot(t,group.id,ranking.id);
  assert.notEqual(one.player.id,two.player.id);assert.notEqual(one.entry.id,two.entry.id);
  assert.equal(snapshot.rows.filter(row=>row.players[0]==='Trùng Tên').length,2);assert.ok(snapshot.rows.some(row=>row.entrantId===one.entry.id));assert.ok(snapshot.rows.some(row=>row.entrantId===two.entry.id));
});

test('display-name changes do not change standings identity or immutable history',()=>{
  const {t,group,ranking}=base(),entrant=playerEntry(t,'Tên cũ'),opponent=playerEntry(t,'Đối thủ');
  const match=addScheduledMatch(t,{label:'M1',groupId:group.id,type:'single',entrantIds:{A:entrant.entry.id,B:opponent.entry.id}});finish(t,match,'A');
  const first=calculateGroupSnapshot(t,group.id,ranking.id),frozen=structuredClone(first),resultId=currentResult(t,match.id).id;
  renamePlayer(t,entrant.player.id,'Tên mới');const second=calculateGroupSnapshot(t,group.id,ranking.id);
  assert.equal(match.entrantIds.A,entrant.entry.id);assert.equal(currentResult(t,match.id).id,resultId);assert.deepEqual(t.groupSnapshots[0],frozen);assert.equal(second.rows.find(row=>row.entrantId===entrant.entry.id).entrantId,entrant.entry.id);
});

test('Pair identity is stable across matches and correction keeps entrant mapping',()=>{
  const {t,group,ranking}=base(),pair=playerEntry(t,'A1','double','A2'),pairB=playerEntry(t,'B1','double','B2'),pairC=playerEntry(t,'C1','double','C2');
  const team=addTeam(t,{displayName:'CLB A',rosterPlayerIds:pair.entry.playerIds});pair.entry.teamId=team.id;
  const first=addScheduledMatch(t,{label:'D1',groupId:group.id,type:'double',entrantIds:{A:pair.entry.id,B:pairB.entry.id}}),second=addScheduledMatch(t,{label:'D2',groupId:group.id,type:'double',entrantIds:{A:pair.entry.id,B:pairC.entry.id}});
  finish(t,first,'A');finish(t,second,'A');const v1=currentResult(t,first.id),v2=correctCanonicalResult(t,first.id,{completedGames:[{points:{A:0,B:1}}],reason:'official'});confirmCanonicalResult(t,first.id,v2.id);
  const snapshot=calculateGroupSnapshot(t,group.id,ranking.id);
  assert.equal(v1.entrants.A.id,pair.entry.id);assert.equal(v2.entrants.A.id,pair.entry.id);assert.equal(currentResult(t,second.id).entrants.A.id,pair.entry.id);assert.equal(snapshot.rows.filter(row=>row.entrantId===pair.entry.id).length,1);validateTournament(t);
});

test('legacy reload migrates deterministically, rewrites references and never merges equal names',()=>{
  const db=storage(),{t,group}=base();
  const legacyMatches=[addScheduledMatch(t,{label:'Legacy 1',groupId:group.id,type:'single',players:{A:['Cùng tên'],B:['B1']}}),addScheduledMatch(t,{label:'Legacy 2',groupId:group.id,type:'single',players:{A:['Cùng tên'],B:['B2']}})];
  const legacy=structuredClone(t);legacy.schemaVersion=1;delete legacy.structure.players;delete legacy.structure.entries;delete legacy.structure.teams;for(const match of legacy.schedule)delete match.entrantIds;
  db.setItem(TOURNAMENT_STORE_KEY,JSON.stringify({version:1,tournaments:{[legacy.id]:legacy},activeWorkSession:null}));
  const repo=createTournamentRepository(db),migrated=repo.get(t.id),raw=JSON.parse(db.getItem(TOURNAMENT_STORE_KEY));
  assert.equal(raw.version,2);assert.equal(migrated.schemaVersion,2);assert.notEqual(migrated.schedule[0].entrantIds.A,migrated.schedule[1].entrantIds.A);
  const ids=migrated.schedule.map(match=>match.entrantIds.A),reopened=repo.get(t.id);assert.deepEqual(reopened.schedule.map(match=>match.entrantIds.A),ids);assert.ok(reopened.events.some(event=>event.type==='identitySchemaMigrated'));
  assert.equal(legacyMatches.length,2);validateTournament(reopened);
});

test('Group Snapshot stores exact stable Entry IDs and Canonical Result Version IDs',()=>{
  const {t,group,ranking}=base(),one=playerEntry(t,'A'),two=playerEntry(t,'B');
  const match=addScheduledMatch(t,{label:'M',groupId:group.id,type:'single',entrantIds:{A:one.entry.id,B:two.entry.id}});finish(t,match,'A');
  const result=currentResult(t,match.id),snapshot=calculateGroupSnapshot(t,group.id,ranking.id);
  assert.deepEqual(snapshot.resultVersionIds,[result.id]);assert.deepEqual(new Set(snapshot.rows.map(row=>row.entrantId)),new Set([one.entry.id,two.entry.id]));assert.ok(snapshot.qualification.qualified.every(id=>t.structure.entries.some(entry=>entry.id===id)));
});

test('unknown scheduled participants stay explicit and do not create fake Players',()=>{
  const {t}=base(),match=addScheduledMatch(t,{label:'Chưa xác định',type:'unknown'});
  assert.deepEqual(match.entrantIds,{A:null,B:null});assert.equal(t.structure.players.length,0);assert.equal(t.structure.entries.length,0);validateTournament(t);
});
