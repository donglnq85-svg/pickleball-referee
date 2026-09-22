import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,rally} from '../src/match-engine.js';
import {createMatchRepository} from '../src/match-persistence.js';
import {createTournament,addRulesVersion,addResource,addScheduledMatch,createAssignment,startWorkSession,setMatchReadiness} from '../src/tournament-domain.js';
import {createTournamentRepository} from '../src/tournament-persistence.js';
import {callPlayers,startWaiting,waitingElapsedSeconds,markPlayersArrived,initializePreMatch,confirmAthlete,skipWarmup,setPreMatchFinalSetup,createMatchStartSnapshot} from '../src/tournament-operations.js';
import {beginTournamentMatch} from '../src/tournament-launch.js';
import {resolveApplicationResume} from '../src/application-resume.js';

const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}};
const final={serving:'A',courtLeft:'A',right:{A:0,B:0},serverIndex:0};
function tournamentSetup(db,{points=3}={}){
  const t=createTournament('Resume QA');
  addRulesVersion(t,{label:'Locked',authority:'Product Control',scoring:'side-out',format:{sets:1,points,rule:'touch'},procedures:{equipmentCheck:'disabled'}});
  const court=addResource(t,'courts','Sân 1');
  const match=addScheduledMatch(t,{label:'Trận 1',courtId:court.id,type:'single',players:{A:['An'],B:['Bình']}});
  const assignment=createAssignment(t,{label:'Ca sân',scopeKind:'court',scopeIds:[court.id]});
  const work=startWorkSession(t,assignment.id);setMatchReadiness(t,match.id,'ready');
  createTournamentRepository(db).save(t,{activeWorkSession:work.id});
  return {t,match,work};
}

test('reload priority chooses active Match before an active Tournament Work Session',()=>{
  const db=memory(),{t,work}=tournamentSetup(db);
  const match=createMatch({type:'single',sets:1,points:3,rule:'touch',scoring:'side-out',players:{A:['Quick A'],B:['Quick B']},start:{A:0,B:0}},{serving:'A',courtLeft:'A'});
  createMatchRepository(db).saveSession(match);
  assert.deepEqual(resolveApplicationResume(db),{kind:'match',matchId:match.id});
  assert.equal(createTournamentRepository(db).load().activeWorkSession.workSessionId,work.id);
  assert.equal(createTournamentRepository(db).get(t.id).workSessions[0].status,'active');
});

test('reload with an active Work Session and no pending operation returns Court Manager',()=>{
  const db=memory(),{t,work}=tournamentSetup(db);
  assert.deepEqual(resolveApplicationResume(db),{kind:'tournament',screen:'court',tournamentId:t.id,workSessionId:work.id,matchId:null});
});

test('reload resumes Waiting directly and derived timer continues without reset',()=>{
  const db=memory(),{t,match,work}=tournamentSetup(db),repo=createTournamentRepository(db);
  const saved=repo.get(t.id);callPlayers(saved,match.id,10_000);startWaiting(saved,match.id,20_000);repo.save(saved);
  const before=waitingElapsedSeconds(repo.get(t.id).schedule[0],80_000),target=resolveApplicationResume(db);
  assert.deepEqual(target,{kind:'tournament',screen:'operations',tournamentId:t.id,workSessionId:work.id,matchId:match.id});
  assert.equal(waitingElapsedSeconds(createTournamentRepository(db).get(t.id).schedule[0],95_000),before+15);
  assert.equal(Object.keys(createMatchRepository(db).load().matches).length,0);
});

test('reload resumes Pre-Match with state and immutable unlaunched snapshot intact',()=>{
  const db=memory(),{t,match,work}=tournamentSetup(db),repo=createTournamentRepository(db);
  const saved=repo.get(t.id);markPlayersArrived(saved,match.id,10_000);initializePreMatch(saved,match.id);
  confirmAthlete(saved,match.id,'A1');confirmAthlete(saved,match.id,'B1');skipWarmup(saved,match.id,20_000);
  setPreMatchFinalSetup(saved,match.id,{start:{A:1,B:0},final:{serving:'A',courtLeft:'A'}});
  const snapshot=createMatchStartSnapshot(saved,match.id,30_000);repo.save(saved);
  assert.deepEqual(resolveApplicationResume(db),{kind:'tournament',screen:'prematch',tournamentId:t.id,workSessionId:work.id,matchId:match.id});
  assert.deepEqual(createTournamentRepository(db).get(t.id).schedule[0].matchStartSnapshot,snapshot);
  assert.equal(Object.keys(createMatchRepository(db).load().matches).length,0);
});

test('a just-finished Tournament Match reloads to Court Manager and never duplicates the Match',()=>{
  const db=memory(),{t,match,work}=tournamentSetup(db,{points:1}),tournaments=createTournamentRepository(db);
  const saved=tournaments.get(t.id);markPlayersArrived(saved,match.id);initializePreMatch(saved,match.id);
  confirmAthlete(saved,match.id,'A1');confirmAthlete(saved,match.id,'B1');skipWarmup(saved,match.id);
  setPreMatchFinalSetup(saved,match.id,{start:{A:0,B:0},final:{serving:'A',courtLeft:'A'}});createMatchStartSnapshot(saved,match.id);tournaments.save(saved);
  const session=beginTournamentMatch(t.id,work.id,match.id,null,db);rally(session,'A');createMatchRepository(db).saveSession(session);
  const first=resolveApplicationResume(db),second=resolveApplicationResume(db);
  assert.deepEqual(first,{kind:'tournament',screen:'court',tournamentId:t.id,workSessionId:work.id,matchId:null});assert.deepEqual(second,first);
  assert.equal(Object.keys(createMatchRepository(db).load().matches).length,1);
  assert.equal(tournaments.get(t.id).schedule[0].matchSessionId,session.id);
});

test('reload with no recoverable work preserves normal onboarding; draft remains resumable',()=>{
  const db=memory();assert.deepEqual(resolveApplicationResume(db),{kind:'normal'});
  createMatchRepository(db).saveDraft({phase:'warmup',config:{}});
  assert.deepEqual(resolveApplicationResume(db),{kind:'draft'});
});
