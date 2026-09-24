import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addResource,addPlayer,addEntry,addScheduledMatch,addRulesVersion,createAssignment} from '../src/tournament-domain.js';
import {createTournamentRepository} from '../src/tournament-persistence.js';
import {createMatchRepository} from '../src/match-persistence.js';
import {createMatch,rally} from '../src/match-engine.js';
import {deriveCanonicalResult,confirmCanonicalResult,correctCanonicalResult,calculateGroupSnapshot,addRankingRulesVersion} from '../src/tournament-results.js';
import {projectMatch,projectStandings,nextReadyMatchId} from '../src/tournament-experience-projection.js';

const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
function fixture(){
  const db=storage(),repo=createTournamentRepository(db),mr=createMatchRepository(db);let t=createTournament('Vietnam Pickleball Open 2026');repo.save(t);t=repo.get(t.id);
  const c=addResource(t,'courts','Sân 3');const a=createAssignment(t,{label:'Sân 3',scopeKind:'court',scopeIds:[c.id]});repo.save(t);t=repo.get(t.id);
  const g=addResource(t,'groups','Bảng A');g.entryIds=[];
  for(const pair of [['Nguyễn Hoàng Nam','Trần Minh Quân'],['Lê Tuấn Anh','Phạm Quốc Huy'],['Đỗ Gia Bảo','Vũ Thành Đạt'],['Ngô Minh Khoa','Hoàng Đức Thắng']])g.entryIds.push(addEntry(t,{type:'double',playerIds:pair.map(displayName=>addPlayer(t,{displayName}).id)}).id);
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)addScheduledMatch(t,{label:`Trận ${t.schedule.length+1}`,groupId:g.id,courtId:c.id,type:'double',entrantIds:{A:g.entryIds[i],B:g.entryIds[j]}});
  const rules=addRulesVersion(t,{label:'1 game',authority:'QA',scoring:'side-out',format:{sets:1,points:11,rule:'touch'},procedures:{equipmentCheck:'disabled'}});
  addRankingRulesVersion(t,{label:'QA confirmed rules',authority:'QA',criteria:[{metric:'matchWins',direction:'desc'},{metric:'pointDifferential',direction:'desc'}],qualification:{kind:'unknown'}});
  repo.save(t);t=repo.get(t.id);return {db,repo,mr,t,g,c,a,rules};
}
function play(f,index){const m=f.t.schedule[index],s=createMatch({type:'double',sets:1,points:11,rule:'touch',scoring:'side-out',start:{A:0,B:0},players:m.players},{serving:'A',courtLeft:'A',serverIndex:0,right:{A:0,B:0}});m.matchSessionId=s.id;s.tournamentContext={tournamentId:f.t.id,scheduledMatchId:m.id,rulesVersionId:f.rules.id};return {m,s}}

test('QG2 same tournament/assignment/court/pool/8 players/4 entries/6 matches survive reopen without duplicate truth',()=>{
  const f=fixture(),before=structuredClone(f.t);for(let n=0;n<3;n++){const t=createTournamentRepository(f.db).get(f.t.id);assert.deepEqual(t,before);assert.equal(t.schedule.length,6);assert.equal(t.structure.players.length,8);assert.equal(t.structure.entries.length,4);assert.equal(t.assignments[0].id,f.a.id);assert.equal(new Set(t.schedule.map(m=>[m.entrantIds.A,m.entrantIds.B].sort().join('|'))).size,6)}
});

test('QG2 current rally points are projected during LIVE; completed pre-confirmation is green with correct winner',()=>{
  const f=fixture(),{m,s}=play(f,0);for(let i=0;i<6;i++)rally(s,'A');f.mr.saveSession(s);
  let v=projectMatch(f.t,m,createMatchRepository(f.db).load().matches);assert.equal(v.status,'LIVE');assert.deepEqual(v.points,{A:6,B:0});assert.equal(v.winner,null);
  for(let i=0;i<5;i++)rally(s,'A');f.mr.saveSession(s);v=projectMatch(f.t,m,f.mr.load().matches);assert.equal(v.status,'COMPLETED');assert.equal(v.winner,'A');assert.deepEqual(v.points,{A:11,B:0});assert.equal(v.scoreKind,'GAME_POINTS');
});

test('QG2 result correction invalidates stale displayed ranking, updates statistics and survives reload without rewriting engine history',()=>{
  const f=fixture(),{m,s}=play(f,0);for(let i=0;i<11;i++)rally(s,'A');f.mr.saveSession(s);
  const v1=deriveCanonicalResult(f.t,s);confirmCanonicalResult(f.t,m.id,v1.id);const old=calculateGroupSnapshot(f.t,f.g.id);f.repo.save(f.t);
  const matchBefore=JSON.stringify(f.mr.get(s.id));assert.equal(projectStandings(f.t,f.g).snapshotId,old.id);
  const v2=correctCanonicalResult(f.t,m.id,{completedGames:[{points:{A:8,B:11}}],reason:'QA correction'});confirmCanonicalResult(f.t,m.id,v2.id);f.repo.save(f.t);
  let t=createTournamentRepository(f.db).get(f.t.id),p=projectStandings(t,f.g);assert.equal(p.snapshotId,null);assert.equal(p.needsConfirmation,true);assert.ok(p.rows.every(r=>r.rank===null));assert.equal(p.rows.find(r=>r.entry.id===m.entrantIds.B).wins,1);
  let view=projectMatch(t,m,f.mr.load().matches);assert.deepEqual(view.points,{A:8,B:11});assert.equal(view.winner,'B');assert.equal(view.resultVersionId,v2.id);
  const next=calculateGroupSnapshot(t,f.g.id);f.repo.save(t);t=f.repo.get(t.id);p=projectStandings(t,f.g);assert.equal(p.snapshotId,next.id);assert.deepEqual(p.resultVersionIds,[v2.id]);assert.deepEqual(t.groupSnapshots[0],old);assert.equal(JSON.stringify(f.mr.get(s.id)),matchBefore);
});

test('QG2 NEXT is derived from readiness, not first row index; blocked and unknown never become next',()=>{
  const f=fixture();assert.equal(nextReadyMatchId(f.t,f.g.id),null);f.t.schedule[1].readiness='blocked';f.t.schedule[3].readiness='ready';const id=nextReadyMatchId(f.t,f.g.id);assert.equal(id,f.t.schedule[3].id);assert.equal(projectMatch(f.t,f.t.schedule[3],{},id).status,'NEXT');assert.equal(projectMatch(f.t,f.t.schedule[0],{},id).status,'NOT_STARTED');
});

test('QG2 BO3 result renders match games won, never the final game points; projections do not mutate sources',()=>{
  const f=fixture(),m=f.t.schedule[0],v={id:'result-v1',status:'CONFIRMED',winner:'A',format:{sets:3},matchGamesWon:{A:2,B:1},completedGames:[{points:{A:11,B:4}},{points:{A:8,B:11}},{points:{A:11,B:6}}]};
  f.t.resultLedger={byMatch:{[m.id]:{currentVersionId:v.id,versions:[v]}}};const before=JSON.stringify(f.t);const view=projectMatch(f.t,m);assert.deepEqual(view.points,{A:2,B:1});assert.equal(view.scoreKind,'MATCH_GAMES_WON');assert.equal(view.completedGames.length,3);assert.equal(JSON.stringify(f.t),before);
});
