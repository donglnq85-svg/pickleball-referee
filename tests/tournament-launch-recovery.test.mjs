import test from 'node:test';
import assert from 'node:assert/strict';
import {createTournament,addRulesVersion,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness,courtManagerView} from '../src/tournament-domain.js';
import {createTournamentRepository,TOURNAMENT_STORE_KEY} from '../src/tournament-persistence.js';
import {createMatchRepository,STORE_KEY} from '../src/match-persistence.js';
import {beginTournamentMatch,recoverTournamentLaunches} from '../src/tournament-launch.js';
import {rally,matchView} from '../src/match-engine.js';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values}};
const final={serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0};
function setup(){
  const db=storage(),t=createTournament('Khôi phục'),version=addRulesVersion(t,{label:'2026',authority:'Rulebook',scoring:'side-out',format:{sets:3,points:11,rule:'touch'}});
  const m=addScheduledMatch(t,{label:'Đôi 1',type:'double',players:{A:['An','Bình'],B:['Chi','Dung']}});
  setMatchReadiness(t,m.id,'ready');const a=createAssignment(t,{label:'Trọng tài',scopeKind:'match',scopeIds:[m.id]}),w=startWorkSession(t,a.id);
  createTournamentRepository(db).save(t,{activeWorkSession:w.id});
  return {db,t,m,w,version};
}
const snapshot=({db,t,m})=>{
  const tr=createTournamentRepository(db),mr=createMatchRepository(db),s=tr.get(t.id).schedule.find(x=>x.id===m.id);
  const sessions=Object.values(mr.load().matches).filter(x=>x.tournamentContext?.scheduledMatchId===m.id);
  return {s,sessions,launch:tr.get(t.id).launches?.[m.id]};
};

for(const stage of ['beforeIntent','afterIntent','afterSession','afterLinkage'])test(`crash ${stage}: retry and reopen produce exactly one linked Gate #1 session`,()=>{
  const args=setup(),{db,t,m,w,version}=args;
  assert.throws(()=>beginTournamentMatch(t.id,w.id,m.id,final,db,{afterStage:at=>{if(at===stage)throw Error('simulated crash')}}),/simulated crash/);
  if(stage==='afterSession'){
    const existing=snapshot(args).sessions[0];
    rally(existing,'B');createMatchRepository(db).saveSession(existing);
  }
  // The tournament may adopt a new version while the launch is in flight;
  // the prepared snapshot remains the authority for this particular match.
  if(stage!=='beforeIntent'){
    const updated=createTournamentRepository(db).get(t.id);
    addRulesVersion(updated,{label:'2027',authority:'Future',scoring:'future',format:{sets:5,points:21,rule:'touch'}});
    createTournamentRepository(db).save(updated);
  }
  const recovered=recoverTournamentLaunches(db,t.id);
  assert.equal(recovered.length,stage==='beforeIntent'?0:1);
  const once=beginTournamentMatch(t.id,w.id,m.id,final,db),again=beginTournamentMatch(t.id,w.id,m.id,{...final,serving:'B'},db);
  const {s,sessions,launch}=snapshot(args);
  assert.equal(sessions.length,1);assert.equal(s.matchSessionId,once.id);assert.equal(again.id,once.id);
  assert.equal(launch.phase,'linked');assert.equal(sessions[0].tournamentContext.rulesVersionId,version.id);
  assert.equal(launch.rulesVersionId,version.id);assert.equal(sessions[0].config.points,11);
  assert.equal(courtManagerView(createTournamentRepository(db).get(t.id),w.id,createMatchRepository(db)).matches[0].progress,'playing');
  if(stage==='afterSession')assert.equal(matchView(sessions[0]).scoreCall,'0 – 0 – 1');
  assert.equal(createTournamentRepository(db).get(t.id).events.filter(e=>e.type==='matchSessionLinked').length,1);
});

test('storage write failure at intent, Match Store and linkage boundaries recovers without history loss',()=>{
  for(const failedWrite of [1,2,3]){
    const {db,t,m,w}=setup();let count=0;
    createMatchRepository(db).load(); // exclude first-time legacy migration from launch writes
    const flaky={getItem:db.getItem,setItem:(key,value)=>{count++;if(count===failedWrite)throw Error('quota/crash');db.setItem(key,value)}};
    assert.throws(()=>beginTournamentMatch(t.id,w.id,m.id,final,flaky),/quota\/crash/);
    const recovered=recoverTournamentLaunches(db,t.id);
    assert.equal(recovered.length,failedWrite===1?0:1);
    const session=beginTournamentMatch(t.id,w.id,m.id,final,db);
    assert.equal(snapshot({db,t,m}).sessions.length,1);
    assert.equal(createMatchRepository(db).get(session.id).id,session.id);
  }
});

test('linked session missing or corrupt intent fails closed and never rewrites completed history',()=>{
  const args=setup(),{db,t,m,w}=args,session=beginTournamentMatch(t.id,w.id,m.id,final,db);
  const matchDoc=JSON.parse(db.getItem(STORE_KEY));matchDoc.matches[session.id].status='finished';
  matchDoc.matches[session.id].games=[{game:1,score:{A:11,B:0},winner:'A'}];
  db.setItem(STORE_KEY,JSON.stringify(matchDoc));
  assert.equal(beginTournamentMatch(t.id,w.id,m.id,final,db).status,'finished');
  const preserved=db.getItem(STORE_KEY);
  const missing=JSON.parse(preserved);delete missing.matches[session.id];missing.activeId=null;db.setItem(STORE_KEY,JSON.stringify(missing));
  assert.throws(()=>recoverTournamentLaunches(db,t.id),/không khớp/);
  assert.equal(db.getItem(STORE_KEY),JSON.stringify(missing));
  db.setItem(STORE_KEY,preserved);
  const corrupt=JSON.parse(db.getItem(TOURNAMENT_STORE_KEY));delete corrupt.tournaments[t.id].launches[m.id].sessionId;
  db.setItem(TOURNAMENT_STORE_KEY,JSON.stringify(corrupt));
  assert.throws(()=>recoverTournamentLaunches(db,t.id),/journal/);
  assert.equal(db.getItem(STORE_KEY),preserved);
});

test('legacy orphan is reconciled only when its context is unique and matching',()=>{
  const args=setup(),{db,t,m,w}=args,session=beginTournamentMatch(t.id,w.id,m.id,final,db);
  const doc=JSON.parse(db.getItem(TOURNAMENT_STORE_KEY));doc.tournaments[t.id].launches={};doc.tournaments[t.id].schedule[0].matchSessionId=null;
  db.setItem(TOURNAMENT_STORE_KEY,JSON.stringify(doc));
  assert.deepEqual(recoverTournamentLaunches(db,t.id),[session.id]);
  assert.equal(snapshot(args).sessions.length,1);
  const duplicate=structuredClone(session);duplicate.id='conflicting-session';
  createMatchRepository(db).saveSession(duplicate);
  assert.throws(()=>recoverTournamentLaunches(db,t.id),/nhiều Match Session/);
});
